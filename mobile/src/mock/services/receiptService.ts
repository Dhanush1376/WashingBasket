/** Receipts. A receipt is always built from its accepted order; it is never stored separately. */
import * as ops from '../engine/ops.ts';
import { findCustomer, findLocation, findOrder, findReceipt, findStaff } from '../engine/selectors.ts';
import { MODE_COPY, PAYMENT_COPY } from '../engine/lifecycle.ts';
import { rupees } from '../engine/util.ts';
import { mockStore } from '../store/mockStore.ts';
import type { MockState } from '../types.ts';

export function markAnimationShown(receiptId: string) {
  return mockStore.transact((s, ctx) => ops.markReceiptAnimationShown(s, ctx, { receiptId }));
}

/** Everything on a receipt, from the order record. Null when the order has no receipt (not accepted). */
export function receiptView(s: MockState, orderId: string) {
  const order = findOrder(s, orderId);
  const receipt = findReceipt(s, orderId);
  if (!order || !receipt) return null;
  return {
    receipt,
    order,
    customer: findCustomer(s, order.customerId),
    location: findLocation(s, order.locationId),
    staff: findStaff(s, receipt.acceptedBy),
    mode: MODE_COPY[order.serviceMode].label,
    payment: PAYMENT_COPY[order.payment.status].label,
  };
}

export type ReceiptView = NonNullable<ReturnType<typeof receiptView>>;

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Plain-text receipt, for sharing. */
export function receiptText(v: ReceiptView): string {
  const { order, receipt } = v;
  const rows = order.lines.map((l) => `${l.name} (${l.categoryName}) × ${l.qty} @ ${rupees(l.unitPrice)} = ${rupees(l.amount)}`);
  return [
    'WASHING BASKET — ORDER RECEIPT',
    `Receipt ${receipt.number} · Order ${order.id}`,
    `Customer: ${v.customer?.name ?? ''}`,
    `Location: ${v.location?.name ?? ''} · ${v.mode}`,
    `Submitted: ${when(order.createdAt)}`,
    `Accepted: ${order.acceptedAt ? when(order.acceptedAt) : ''}${v.staff ? ` by ${v.staff.name}` : ''}`,
    '',
    ...rows,
    '',
    `Pieces: ${order.pieces}`,
    `Subtotal: ${rupees(order.subtotal)}`,
    `Service charge: ${order.serviceCharge ? rupees(order.serviceCharge) : 'Free'}`,
    `Total: ${rupees(order.total)}`,
    `Payment: ${v.payment} (wallet)`,
    '',
    'Demo receipt from mock data. No real payment was made.',
  ].join('\n');
}

/** A standalone HTML receipt, for downloading on the web. */
export function receiptHtml(v: ReceiptView): string {
  const { order, receipt } = v;
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const rows = order.lines
    .map((l) => `<tr><td>${esc(l.name)}<br><small>${esc(l.categoryName)} · ${l.qty} × ${rupees(l.unitPrice)}</small></td><td style="text-align:right">${rupees(l.amount)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${receipt.number}</title>
<style>body{font-family:Inter,system-ui,sans-serif;background:#F4F5F7;color:#0A1C3E;margin:0;padding:24px}main{max-width:420px;margin:auto;background:#fff;border-radius:20px;padding:28px}h1{font-size:20px;margin:0}small{color:#8C93A1}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px 0;border-bottom:1px dashed #E3E6EB;vertical-align:top}.k{color:#5B6475}.t{font-size:18px;font-weight:700}</style></head>
<body><main><h1>Washing Basket</h1><small>Order receipt · demo data, no real payment</small>
<p><span class="k">Receipt</span> ${receipt.number}<br><span class="k">Order</span> ${order.id}<br><span class="k">Customer</span> ${esc(v.customer?.name ?? '')}<br><span class="k">Location</span> ${esc(v.location?.name ?? '')} · ${v.mode}<br><span class="k">Submitted</span> ${when(order.createdAt)}<br><span class="k">Accepted</span> ${order.acceptedAt ? when(order.acceptedAt) : ''}${v.staff ? ` by ${esc(v.staff.name)}` : ''}</p>
<table>${rows}<tr><td>Pieces</td><td style="text-align:right">${order.pieces}</td></tr><tr><td>Subtotal</td><td style="text-align:right">${rupees(order.subtotal)}</td></tr><tr><td>Service charge</td><td style="text-align:right">${order.serviceCharge ? rupees(order.serviceCharge) : 'Free'}</td></tr><tr><td class="t">Total</td><td class="t" style="text-align:right">${rupees(order.total)}</td></tr></table>
<p class="k">Payment: ${v.payment} (wallet)</p></main></body></html>`;
}
