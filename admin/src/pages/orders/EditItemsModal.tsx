import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { QueryView } from '@/components/ui/QueryView';
import { useAction } from '@/hooks/useAction';
import { money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi, ordersApi, type OrderRow } from '@/services';

/** Count the clothes on an order from the service's price list. The total updates as you count. */
export function EditItemsModal({ order, onClose }: { order: OrderRow; onClose: () => void }) {
  const pricing = useQuery('pricing', catalogApi.getPricing);
  const { run, isBusy } = useAction();
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(order.items.map((i) => [i.priceItemId, i.qty])));

  const items = useMemo(() => pricing.data?.categories.find((c) => c.serviceId === order.serviceId)?.items ?? [], [pricing.data, order.serviceId]);
  const fees = pricing.data?.fees;
  const subtotal = items.reduce((s, i) => s + i.price * (qty[i.id] ?? 0), 0);
  const delivery = !fees || subtotal === 0 || subtotal >= fees.freeDeliveryAbove ? 0 : fees.delivery;
  const total = Math.max(0, subtotal + delivery - order.discount);

  const save = async () => {
    const next = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([priceItemId, n]) => ({ priceItemId, qty: n }));
    const ok = await run('items', () => ordersApi.updateOrderItems(order.id, next), `Items saved for ${order.id}`, `New total ${money(total)}`);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Items in ${order.id}`}
      description={`${order.serviceName} price list. Set how many of each item the customer handed over.`}
      footer={
        <>
          <span className="modal__total">
            Total <strong className="num">{money(total)}</strong>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={isBusy('items')}>
            Save items
          </Button>
        </>
      }
    >
      <QueryView query={pricing}>
        {() => (
          <ul className="count-list">
            {items.map((i) => (
              <li key={i.id} className="count-list__row">
                <span className="grow">
                  <strong>{i.name}</strong>
                  <span className="muted block">
                    {money(i.price)} per {i.unit}
                  </span>
                </span>
                <Stepper label={`${i.name} (${i.unit})`} value={qty[i.id] ?? 0} onChange={(n) => setQty((q) => ({ ...q, [i.id]: n }))} />
              </li>
            ))}
            <li className="count-list__summary">
              <span>Items {money(subtotal)}</span>
              <span>Delivery {delivery ? money(delivery) : 'free'}</span>
              {order.discount ? <span>Discount −{money(order.discount)}</span> : null}
            </li>
          </ul>
        )}
      </QueryView>
    </Modal>
  );
}
