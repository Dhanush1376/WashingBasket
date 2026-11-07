import { useState } from 'react';
import { Link } from 'react-router-dom';

import { CancelDialog } from '@/components/domain/CancelDialog';
import { OrderJourney } from '@/components/domain/OrderJourney';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Fact, Facts } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Form';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { dayDate, money, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { NEXT_STEP_ACTION, ORDER_STATUS, PAYMENT_STATUS } from '@/lib/status';
import { ordersApi, type OrderDetail } from '@/services';
import { ORDER_STAGES, type OrderStage } from '@/types';
import { EditItemsModal } from './EditItemsModal';

export function OrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const detail = useQuery(`order:${orderId}`, () => ordersApi.getOrder(orderId));
  const title = detail.data?.order ? `Order ${orderId}` : `Order ${orderId}`;
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      width={600}
      subtitle={detail.data ? <StatusBadge size="sm" {...ORDER_STATUS[detail.data.order.status]} /> : undefined}
      footer={detail.data ? <OrderActions d={detail.data} /> : undefined}
    >
      <QueryView query={detail}>
        {(d) => (d ? <OrderBody d={d} /> : <EmptyState icon="bag" title="Order not found" message="It may have been removed. Close this panel to go back to the list." />)}
      </QueryView>
    </Drawer>
  );
}

function OrderActions({ d }: { d: OrderDetail }) {
  const { run, isBusy } = useAction();
  const [cancelling, setCancelling] = useState(false);
  const o = d.order;
  const next = ordersApi.nextStage(o.status);
  const finished = o.status === 'delivered' || o.status === 'cancelled';
  if (finished) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setCancelling(true)}>
        Cancel order
      </Button>
      {next ? (
        <Button
          variant="primary"
          iconRight="arrowRight"
          loading={isBusy('next')}
          onClick={() => run('next', () => ordersApi.setOrderStatus(o.id, next as OrderStage), `${o.id} is now “${ORDER_STATUS[next].label}”`, 'The customer sees the new step in their app.')}
        >
          {NEXT_STEP_ACTION[next] ?? 'Next step'}
        </Button>
      ) : null}
      <CancelDialog
        open={cancelling}
        what={`order ${o.id}`}
        busy={isBusy('cancel')}
        onClose={() => setCancelling(false)}
        onConfirm={async (reason) => {
          await run('cancel', () => ordersApi.cancelOrder(o.id, reason), `Order ${o.id} cancelled`, o.payment.status === 'paid' ? 'It was already paid. Arrange any refund outside this portal.' : undefined);
          setCancelling(false);
        }}
      />
    </>
  );
}

function OrderBody({ d }: { d: OrderDetail }) {
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const o = d.order;
  const t = d.totals;
  const finished = o.status === 'delivered' || o.status === 'cancelled';

  return (
    <>
      <Card>
        <CardHeader title="Progress" hint="The same steps the customer follows in the app" />
        <OrderJourney status={o.status} />
        {!finished ? (
          <div className="fix-step">
            <Field label="Put it on a different step" hint="Use this to correct a mistake. Customers see the step you choose.">
              <Select
                value={o.status}
                disabled={isBusy('step')}
                onChange={(e) => run('step', () => ordersApi.setOrderStatus(o.id, e.target.value as OrderStage), `${o.id} moved to “${ORDER_STATUS[e.target.value as OrderStage].label}”`)}
              >
                {ORDER_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        {o.cancelReason ? <p className="note note--danger">Cancelled: {o.cancelReason}</p> : null}
      </Card>

      <Card>
        <CardHeader title="Customer and pickup" />
        <Facts>
          <Fact label="Customer">{d.customer ? <Link to={`/customers?open=${d.customer.id}`}>{d.customer.fullName}</Link> : 'Unknown'}</Fact>
          <Fact label="Phone">{d.customer ? <a href={`tel:${d.customer.phone.replace(/\s/g, '')}`}>{d.customer.phone}</a> : '—'}</Fact>
          <Fact label="Service">{o.serviceName}</Fact>
          <Fact label="Placed">{when(o.placedAt)}</Fact>
          <Fact label="Pickup">
            {dayDate(o.pickup.date)} · {o.slotLabel}
          </Fact>
          <Fact label={o.status === 'delivered' ? 'Delivered' : 'Delivery due'}>{o.deliveredAt ? when(o.deliveredAt) : dayDate(o.estimatedDelivery)}</Fact>
          <Fact label="Address" wide>
            {d.address ? `${d.address.line1}, ${d.address.line2}, ${d.address.city} ${d.address.pincode}` : 'Address removed'}
            {d.address?.pickupInstructions ? <span className="block muted">“{d.address.pickupInstructions}”</span> : null}
          </Fact>
          {o.requestId ? (
            <Fact label="From pickup request">
              <Link to={`/pickups?open=${o.requestId}`}>{o.requestId}</Link>
            </Fact>
          ) : null}
        </Facts>
      </Card>

      <Card>
        <CardHeader
          title="Items and amount"
          hint="Prices come from the price list"
          action={
            o.status !== 'cancelled' ? (
              <Button size="sm" icon="edit" onClick={() => setEditing(true)}>
                {t.lines.length ? 'Edit items' : 'Count items'}
              </Button>
            ) : undefined
          }
        />
        {t.lines.length ? (
          <table className="bill">
            <caption className="sr-only">Items in order {o.id}</caption>
            <tbody>
              {t.lines.map((l) => (
                <tr key={l.item.id}>
                  <td>
                    {l.item.name}
                    <span className="muted">
                      {' '}
                      · {l.qty} {l.item.unit === 'kg' ? 'kg' : `× ${money(l.item.price)}`}
                    </span>
                  </td>
                  <td className="num">{money(l.amount)}</td>
                </tr>
              ))}
              <tr className="bill__sub">
                <td>Items</td>
                <td className="num">{money(t.subtotal)}</td>
              </tr>
              <tr>
                <td>Delivery</td>
                <td className="num">{t.delivery ? money(t.delivery) : 'Free'}</td>
              </tr>
              {t.discount ? (
                <tr>
                  <td>Discount</td>
                  <td className="num positive">−{money(t.discount)}</td>
                </tr>
              ) : null}
              <tr className="bill__total">
                <td>Total</td>
                <td className="num">{money(t.total)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <EmptyState compact icon="shirt" title="Items not counted yet" message="Count the clothes at the store, then add them here so the customer sees the bill." />
        )}
        <div className="pay-row">
          <div>
            <span className="muted">Payment · {o.payment.method}</span>
            <div>
              <StatusBadge size="sm" {...PAYMENT_STATUS[o.payment.status]} />
            </div>
          </div>
          {o.payment.status === 'pending' && o.payment.method === 'Pay on delivery' && t.total > 0 ? (
            <Button size="sm" variant="outline" icon="check" onClick={() => setConfirmPaid(true)}>
              Mark as paid
            </Button>
          ) : null}
        </div>
      </Card>

      {editing ? <EditItemsModal order={o} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={confirmPaid}
        onClose={() => setConfirmPaid(false)}
        tone="primary"
        icon="receipt"
        title="Mark as paid?"
        message={
          <>
            Only do this once the customer has paid <strong>{money(t.total)}</strong> for {o.id}. This records the payment; it doesn’t collect any money.
          </>
        }
        confirmLabel="Yes, it’s paid"
        loading={isBusy('paid')}
        onConfirm={async () => {
          await run('paid', () => ordersApi.markOrderPaid(o.id), `${o.id} marked as paid`);
          setConfirmPaid(false);
        }}
      />
    </>
  );
}
