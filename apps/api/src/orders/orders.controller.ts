import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { OrdersService } from './orders.service.js';
import type { UserProfile, CreateLabOrderRequest, CreateImagingOrderRequest, CreateMedicationOrderRequest, FillOrderRequest, DispenseOrderRequest, OrderResponse } from '@caregiver/contracts';

@Controller('orders')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('lab')
  @RequirePermission('order.lab_create')
  async createLab(
    @Body() body: CreateLabOrderRequest,
    @Request() req: { user: UserProfile },
  ): Promise<OrderResponse> {
    return this.ordersService.createOrder(body, req.user.id, req.user.role);
  }

  @Post('imaging')
  @RequirePermission('order.imaging_create')
  async createImaging(
    @Body() body: CreateImagingOrderRequest,
    @Request() req: { user: UserProfile },
  ): Promise<OrderResponse> {
    return this.ordersService.createOrder(body, req.user.id, req.user.role);
  }

  @Post('medication')
  @RequirePermission('order.medication_create')
  async createMedication(
    @Body() body: CreateMedicationOrderRequest,
    @Request() req: { user: UserProfile },
  ): Promise<OrderResponse> {
    return this.ordersService.createOrder(body, req.user.id, req.user.role);
  }

  @Post(':id/fill')
  @RequirePermission('order.fill')
  async fill(
    @Param('id') id: string,
    @Body() body: FillOrderRequest,
    @Request() req: { user: UserProfile },
  ): Promise<OrderResponse> {
    return this.ordersService.fillOrder(id, body, req.user.id, req.user.role);
  }

  @Post(':id/dispense')
  @RequirePermission('order.dispense')
  async dispense(
    @Param('id') id: string,
    @Body() body: DispenseOrderRequest,
    @Request() req: { user: UserProfile },
  ): Promise<OrderResponse> {
    return this.ordersService.dispenseOrder(id, body, req.user.id, req.user.role);
  }

  @Get()
  @RequirePermission('order.lab_create')
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<OrderResponse[]> {
    return this.ordersService.findAll(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id')
  @RequirePermission('order.lab_create')
  async getById(@Param('id') id: string): Promise<OrderResponse> {
    return this.ordersService.getById(id);
  }
}
