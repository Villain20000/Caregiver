import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { BillingService } from './billing.service.js';
import type { UserProfile, CreateClaimRequest, SubmitClaimRequest, AdjudicateClaimRequest, PostPaymentRequest, ClaimResponse, BillingSummaryResponse } from '@caregiver/contracts';

@Controller('billing')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('claims')
  @RequirePermission('billing.claim_create')
  async createClaim(
    @Body() body: CreateClaimRequest,
    @Request() req: { user: UserProfile },
  ): Promise<ClaimResponse> {
    return this.billingService.createClaim(body, req.user.id, req.user.role);
  }

  @Post('claims/:id/submit')
  @RequirePermission('billing.claim_submit')
  async submitClaim(
    @Param('id') id: string,
    @Body() body: SubmitClaimRequest,
    @Request() req: { user: UserProfile },
  ): Promise<ClaimResponse> {
    return this.billingService.submitClaim(id, body, req.user.id, req.user.role);
  }

  @Post('adjudicate')
  @RequirePermission('billing.adjudicate')
  async adjudicate(
    @Body() body: AdjudicateClaimRequest,
    @Request() req: { user: UserProfile },
  ): Promise<ClaimResponse> {
    return this.billingService.adjudicateClaim(body, req.user.id, req.user.role);
  }

  @Post('payments')
  @RequirePermission('billing.post_payment')
  async postPayment(
    @Body() body: PostPaymentRequest,
    @Request() req: { user: UserProfile },
  ): Promise<ClaimResponse> {
    return this.billingService.postPayment(body, req.user.id, req.user.role);
  }

  @Get('claims')
  @RequirePermission('billing.claim_create')
  async listClaims(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ClaimResponse[]> {
    return this.billingService.findAllClaims(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('claims/:id')
  @RequirePermission('billing.claim_create')
  async getClaim(@Param('id') id: string): Promise<ClaimResponse> {
    return this.billingService.getClaimById(id);
  }

  @Get('summary')
  @RequirePermission('billing.denial_report')
  async summary(): Promise<BillingSummaryResponse> {
    return this.billingService.getSummary();
  }
}
