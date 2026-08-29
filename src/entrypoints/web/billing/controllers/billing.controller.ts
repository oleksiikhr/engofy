import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import type { Subscription } from '../../../../modules/auth/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../../../modules/auth/enums/subscription-plan.enum.js';
import { BillingService } from '../../../../modules/billing/billing.service.js';
import { SubscriptionResponseDto } from '../dto/subscription-response.dto.js';

const FREE_RESPONSE: SubscriptionResponseDto = {
  plan: SubscriptionPlan.Free,
  active: false,
  currentPeriodEnd: null,
  isMockPayment: false,
};

function toDto(subscription: Subscription | null): SubscriptionResponseDto {
  if (!subscription) {
    return FREE_RESPONSE;
  }
  return {
    plan: subscription.plan,
    active: true,
    currentPeriodEnd:
      subscription.currentPeriodEnd.toISO() ??
      subscription.currentPeriodEnd.toString(),
    isMockPayment: subscription.isMockPayment ?? false,
  };
}

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // Mock checkout (PLAN.md §8): grants a month of premium, no real payment.
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @CurrentUser() actor: UserActor,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.billing.activateMockSubscription(actor.id);
    return toDto(subscription);
  }

  @Get('subscription')
  async current(
    @CurrentUser() actor: UserActor,
  ): Promise<SubscriptionResponseDto> {
    return toDto(await this.billing.getActiveSubscription(actor.id));
  }
}
