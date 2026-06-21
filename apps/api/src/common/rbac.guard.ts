/**
 * apps/api/src/common/rbac.guard.ts
 *
 * RBAC guard — enforces the permission matrix on protected routes.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RbacGuard)
 *   @RequirePermission('appointment.schedule')
 *   @Post('appointments')
 *   createAppointment() { ... }
 *
 * The guard:
 *   1. Reads the required feature from the @RequirePermission decorator
 *   2. Gets the user's role from req.user (set by JwtAuthGuard)
 *   3. Calls canAccess() from @caregiver/rbac with the user's context
 *   4. Allows or denies the request based on the result
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAccess, type Role, type Feature, type PermissionContext } from '@caregiver/rbac';
import type { UserProfile } from '@caregiver/contracts';

/** Metadata key for the required permission decorator. */
export const PERMISSION_KEY = 'requiredPermission';

/**
 * Decorator: @RequirePermission('feature.name')
 * Marks a route as requiring a specific permission.
 * Must be used with both JwtAuthGuard and RbacGuard.
 */
export const RequirePermission = (feature: Feature) => SetMetadata(PERMISSION_KEY, feature);

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the required feature from the route metadata.
    const requiredFeature = this.reflector.getAllAndOverride<Feature>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permission is required, allow (just auth is enough).
    if (!requiredFeature) {
      return true;
    }

    // Get the authenticated user from the request (set by JwtAuthGuard).
    const request = context.switchToHttp().getRequest<{
      user: UserProfile;
      params: Record<string, string>;
      body: Record<string, unknown>;
    }>();
    const user = request.user;

    // If no user (shouldn't happen if JwtAuthGuard ran first), deny.
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Build the permission context for conditional evaluation.
    const permissionContext: PermissionContext = {
      userId: user.id,
      role: user.role,
      // For patient-scoped resources, extract the target owner from the body/params.
      targetOwnerId: (request.body?.patientId as string) ?? (request.params?.patientId as string) ?? user.id,
      targetResourceId: request.params?.id as string,
      targetResourceType: context.getClass().name.replace('Controller', ''),
    };

    // Evaluate the permission.
    const result = canAccess(user.role as Role, requiredFeature, permissionContext);

    if (!result.granted) {
      throw new ForbiddenException(result.reason);
    }

    return true;
  }
}
