/**
 * Wallet payments. SIMULATED: no payment gateway is connected and no real money moves. Paying debits the mock
 * wallet once per order (an idempotency key makes a second debit impossible) and unlocks the order's QR.
 */
import * as ops from '../engine/ops.ts';
import { mockStore, simulateLatency } from '../store/mockStore.ts';

export async function payOrder(
  orderId: string,
  customerId: string,
  coupon?: { code: string; discount: number }
): Promise<ops.PayResult> {
  await simulateLatency(1100);
  return mockStore.transact((s, ctx) =>
    ops.payOrder(s, ctx, {
      orderId,
      customerId,
      discount: coupon?.discount,
      couponCode: coupon?.code,
    })
  );
}
