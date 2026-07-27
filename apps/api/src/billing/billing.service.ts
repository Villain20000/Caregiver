import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  CreateClaimRequest,
  SubmitClaimRequest,
  AdjudicateClaimRequest,
  PostPaymentRequest,
  ClaimResponse,
  BillingSummaryResponse,
  ClaimCreatedPayload,
  ClaimSubmittedPayload,
  ClaimAdjudicatedPayload,
  PaymentPostedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  async createClaim(
    req: CreateClaimRequest,
    createdBy: string,
    createdByRole: string,
  ): Promise<ClaimResponse> {
    const totalAmount = req.items.reduce((sum, item) => sum + item.netAmount, 0);

    const [claim] = await this.db
      .insert(schema.claims)
      .values({
        patientId: req.patientId,
        providerId: req.providerId,
        insurerId: req.insurerId,
        status: 'draft',
        type: req.type,
        use: req.use,
        totalAmount,
        items: req.items,
      })
      .returning();

    if (!claim) throw new Error('Failed to create claim');

    const payload: ClaimCreatedPayload = {
      claimId: claim.id,
      patientId: claim.patientId!,
      providerId: claim.providerId!,
      insurerId: claim.insurerId!,
      type: claim.type,
      use: claim.use,
      totalAmount: claim.totalAmount,
    };

    await this.producer.send('claim.created', payload, {
      userId: createdBy,
      userRole: createdByRole,
    });

    this.logger.log(`Claim ${claim.id} created by ${createdBy}`);

    return this.toResponse(claim);
  }

  async submitClaim(
    id: string,
    req: SubmitClaimRequest,
    submittedBy: string,
    submittedByRole: string,
  ): Promise<ClaimResponse> {
    const [current] = await this.db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, id))
      .limit(1);

    if (!current) throw new NotFoundException(`Claim ${id} not found`);

    const [updated] = await this.db
      .update(schema.claims)
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.claims.id, id))
      .returning();

    if (!updated) throw new Error('Failed to submit claim');

    const payload: ClaimSubmittedPayload = {
      claimId: id,
      submittedBy: req.submittedBy || submittedBy,
      submittedAt: new Date().toISOString(),
    };

    await this.producer.send('claim.submitted', payload, {
      userId: submittedBy,
      userRole: submittedByRole,
    });

    this.logger.log(`Claim ${id} submitted by ${submittedBy}`);

    return this.toResponse(updated);
  }

  async adjudicateClaim(
    req: AdjudicateClaimRequest,
    adjudicatedBy: string,
    adjudicatedByRole: string,
  ): Promise<ClaimResponse> {
    const [current] = await this.db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, req.claimId))
      .limit(1);

    if (!current) throw new NotFoundException(`Claim ${req.claimId} not found`);

    const totalApproved = req.lineItems.reduce((sum, item) => sum + item.amountApproved, 0);
    const totalDenied = req.lineItems.reduce((sum, item) => sum + item.amountDenied, 0);

    const [updated] = await this.db
      .update(schema.claims)
      .set({
        status: req.outcome,
        items: req.lineItems,
        amountApproved: totalApproved,
        amountPaid: req.outcome === 'adjudicated' ? totalApproved : null,
        adjudicatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.claims.id, req.claimId))
      .returning();

    if (!updated) throw new Error('Failed to adjudicate claim');

    const payload: ClaimAdjudicatedPayload = {
      claimId: req.claimId,
      outcome: req.outcome,
      totalApproved,
      totalDenied,
    };

    await this.producer.send('claim.adjudicated', payload, {
      userId: adjudicatedBy,
      userRole: adjudicatedByRole,
    });

    this.logger.log(`Claim ${req.claimId} adjudicated (${req.outcome}) by ${adjudicatedBy}`);

    return this.toResponse(updated);
  }

  async postPayment(
    req: PostPaymentRequest,
    postedBy: string,
    postedByRole: string,
  ): Promise<ClaimResponse> {
    const [current] = await this.db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, req.claimId))
      .limit(1);

    if (!current) throw new NotFoundException(`Claim ${req.claimId} not found`);

    const [updated] = await this.db
      .update(schema.claims)
      .set({
        status: 'paid',
        amountPaid: req.amount,
        paidAt: new Date(req.paymentDate),
        updatedAt: new Date(),
      })
      .where(eq(schema.claims.id, req.claimId))
      .returning();

    if (!updated) throw new Error('Failed to post payment');

    const payload: PaymentPostedPayload = {
      claimId: req.claimId,
      amount: req.amount,
      paymentDate: req.paymentDate,
      paymentMethod: req.paymentMethod,
    };

    await this.producer.send('payment.posted', payload, {
      userId: postedBy,
      userRole: postedByRole,
    });

    this.logger.log(`Payment of ${req.amount} posted for claim ${req.claimId}`);

    return this.toResponse(updated);
  }

  async findAllClaims(limit = 100, offset = 0): Promise<ClaimResponse[]> {
    const results = await this.db
      .select()
      .from(schema.claims)
      .orderBy(desc(schema.claims.createdAt))
      .limit(limit)
      .offset(offset);
    return results.map((r) => this.toResponse(r));
  }

  async getClaimById(id: string): Promise<ClaimResponse> {
    const [claim] = await this.db
      .select()
      .from(schema.claims)
      .where(eq(schema.claims.id, id))
      .limit(1);
    if (!claim) throw new NotFoundException(`Claim ${id} not found`);
    return this.toResponse(claim);
  }

  async getSummary(): Promise<BillingSummaryResponse> {
    const claims = await this.db.select().from(schema.claims);
    const totalClaims = claims.length;
    const totalBilled = claims.reduce((sum, c) => sum + Number(c.totalAmount), 0);
    const totalApproved = claims.reduce((sum, c) => sum + Number(c.amountApproved ?? 0), 0);
    const totalPaid = claims.reduce((sum, c) => sum + Number(c.amountPaid ?? 0), 0);
    const denied = claims.filter((c) => c.status === 'denied');
    const totalDenied = denied.reduce((sum, c) => sum + Number(c.totalAmount), 0);
    const denialRate = totalBilled > 0 ? totalDenied / totalBilled : 0;

    return { totalClaims, totalBilled, totalApproved, totalPaid, totalDenied, denialRate };
  }

  private toResponse(row: typeof schema.claims.$inferSelect): ClaimResponse {
    return {
      id: row.id,
      fhirId: row.fhirId ?? undefined,
      patientId: row.patientId!,
      providerId: row.providerId!,
      insurerId: row.insurerId!,
      status: row.status as ClaimResponse['status'],
      type: row.type,
      use: row.use,
      totalAmount: Number(row.totalAmount),
      amountApproved: row.amountApproved ? Number(row.amountApproved) : undefined,
      amountPaid: row.amountPaid ? Number(row.amountPaid) : undefined,
      items: (row.items as Array<Record<string, unknown>>)?.map((item) => ({
        serviceCode: item.serviceCode as string,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        netAmount: Number(item.netAmount),
        amountApproved: item.amountApproved ? Number(item.amountApproved) : undefined,
        denialReason: item.denialReason as string | undefined,
      })) ?? [],
      submittedAt: row.submittedAt?.toISOString(),
      adjudicatedAt: row.adjudicatedAt?.toISOString(),
      paidAt: row.paidAt?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
