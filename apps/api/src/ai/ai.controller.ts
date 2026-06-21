/**
 * apps/api/src/ai/ai.controller.ts
 *
 * AI controller — REST endpoints for AI-assisted diagnosis.
 *
 * Endpoints:
 *   POST /api/ai/diagnose              → request diagnosis (requires 'ai.request_diagnosis')
 *   GET  /api/ai/diagnoses/:id         → get diagnosis by ID (requires 'ai.view_diagnosis')
 *   POST /api/ai/diagnoses/:id/review  → review diagnosis (requires 'ai.approve_diagnosis' or 'ai.override_diagnosis')
 */
import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { AiService } from './ai.service.js';
import type { UserProfile, RequestDiagnosisRequest, ReviewDiagnosisRequest, AiDiagnosisResponse } from '@caregiver/contracts';

@Controller('ai')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /api/ai/diagnose — request an AI-assisted diagnosis.
   * Requires 'ai.request_diagnosis' permission.
   */
  @Post('diagnose')
  @RequirePermission('ai.request_diagnosis')
  async requestDiagnosis(
    @Body() body: RequestDiagnosisRequest,
    @Request() req: { user: UserProfile },
  ): Promise<AiDiagnosisResponse> {
    return this.aiService.requestDiagnosis(body, req.user.id, req.user.role);
  }

  /**
   * GET /api/ai/diagnoses/:id — get a diagnosis by ID.
   * Requires 'ai.view_diagnosis' permission.
   */
  @Get('diagnoses/:id')
  @RequirePermission('ai.view_diagnosis')
  async getById(@Param('id') id: string): Promise<AiDiagnosisResponse> {
    return this.aiService.getById(id);
  }

  /**
   * POST /api/ai/diagnoses/:id/review — approve or override a diagnosis.
   * Requires 'ai.approve_diagnosis' permission (covers both approve and override).
   */
  @Post('diagnoses/:id/review')
  @RequirePermission('ai.approve_diagnosis')
  async review(
    @Param('id') id: string,
    @Body() body: ReviewDiagnosisRequest,
    @Request() req: { user: UserProfile },
  ): Promise<AiDiagnosisResponse> {
    return this.aiService.review(id, body, req.user.id, req.user.role);
  }
}
