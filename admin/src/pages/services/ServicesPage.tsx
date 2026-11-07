import { useState } from 'react';

import { ART, ART_TINT } from '@/components/domain/art';
import { Tag } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MiniSwitch } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { useUrlState } from '@/hooks/useUrlState';
import { money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi, type ServiceRow } from '@/services';
import type { PriceItem, ServiceId } from '@/types';
import { FeesCard } from './FeesCard';
import { PriceItemModal, ServiceModal } from './ServiceModals';

export default function ServicesPage() {
  const services = useQuery('services', catalogApi.listServices);
  const pricing = useQuery('pricing', catalogApi.getPricing);
  const [selected, setSelected] = useUrlState<string>('service', '');
  const { run, isBusy } = useAction();
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);

  const list = services.data ?? [];
  const current = list.find((s) => s.id === selected) ?? list[0];

  return (
    <div className="page">
      <PageHeader
        icon="list"
        title="Services & prices"
        description="Manage the services, availability and pricing customers can book."
      />

      <div className="services-split">
        <Card aria-labelledby="svc-title">
          <CardHeader id="svc-title" title="Services" hint="Shown in this order on Home and when booking." />
          <QueryView query={services}>
            {() => (
              <ol className="svc-list">
                {list.map((s, i) => (
                  <li key={s.id}>
                    <div className={`svc-row${current?.id === s.id ? ' svc-row--on' : ''}${s.available ? '' : ' svc-row--off'}`}>
                      <button type="button" className="svc-row__main" onClick={() => setSelected(s.id)} aria-pressed={current?.id === s.id}>
                        <span className="svc-row__art" style={{ background: ART_TINT[s.art] ?? '#F4F5F7' }}>
                          <img src={ART[s.art]} alt="" />
                        </span>
                        <span className="grow">
                          <strong className="block">{s.name}</strong>
                          <span className="muted small">
                            {s.startingPrice ? `from ${money(s.startingPrice.price)} / ${s.startingPrice.unit}` : 'No prices yet'} · {s.turnaround}
                          </span>
                        </span>
                        {!s.available ? <Tag tone="orange">Paused</Tag> : null}
                      </button>
                      <span className="svc-row__controls">
                        <IconButton icon="arrowUp" label={`Move ${s.name} up`} size={32} disabled={i === 0} onClick={() => run('mv', () => catalogApi.moveService(s.id, -1), 'Order updated')} />
                        <IconButton icon="arrowDown" label={`Move ${s.name} down`} size={32} disabled={i === list.length - 1} onClick={() => run('mv', () => catalogApi.moveService(s.id, 1), 'Order updated')} />
                        <MiniSwitch
                          checked={s.available}
                          label={s.available ? `Pause ${s.name}` : `Make ${s.name} bookable`}
                          disabled={isBusy(`av-${s.id}`)}
                          onChange={(v) => run(`av-${s.id}`, () => catalogApi.setServiceAvailable(s.id, v), v ? `${s.name} can be booked` : `${s.name} paused`, v ? undefined : 'It stays on the price list but customers can’t book it.')}
                        />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </QueryView>
        </Card>

        <div className="stack">
          {current ? (
            <PriceListCard service={current} items={pricing.data?.categories.find((c) => c.serviceId === current.id)?.items ?? []} note={pricing.data?.categories.find((c) => c.serviceId === current.id)?.note ?? ''} loading={!pricing.data} onEditService={() => setEditingService(current)} />
          ) : (
            <Card>
              <SkeletonRows rows={4} />
            </Card>
          )}
          <FeesCard />
        </div>
      </div>

      {editingService ? <ServiceModal service={editingService} note={pricing.data?.categories.find((c) => c.serviceId === editingService.id)?.note ?? ''} onClose={() => setEditingService(null)} /> : null}
    </div>
  );
}

function PriceListCard({ service, items, note, loading, onEditService }: { service: ServiceRow; items: PriceItem[]; note: string; loading: boolean; onEditService: () => void }) {
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState<PriceItem | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PriceItem | null>(null);
  const inUse = deleting ? catalogApi.priceItemInUse(deleting.id) : 0;

  return (
    <Card aria-labelledby="price-title">
      <div className="svc-head">
        <span className="svc-head__art" style={{ background: ART_TINT[service.art] ?? '#F4F5F7' }}>
          <img src={ART[service.art]} alt="" />
        </span>
        <div className="grow">
          <h2 className="svc-head__title" id="price-title">
            {service.name}
          </h2>
          <p className="soft">{service.tagline}</p>
          <p className="muted small">
            Ready in {service.turnaround} · {service.ordersLast30} orders in the last 30 days
          </p>
        </div>
        <Button size="sm" icon="edit" onClick={onEditService}>
          Edit service
        </Button>
      </div>

      <div className="price-head">
        <div>
          <h3 className="form-section__title">Price list</h3>
          {note ? <p className="muted small">“{note}”</p> : null}
        </div>
        <Button size="sm" variant="accent" icon="plus" onClick={() => setEditing('new')}>
          Add item
        </Button>
      </div>

      {loading ? (
        <SkeletonRows rows={3} height={48} />
      ) : items.length ? (
        <ul className="price-list">
          {items.map((i) => (
            <li key={i.id} className="price-row">
              <span className="grow">
                <strong>{i.name}</strong>
                <span className="muted small block">per {i.unit}</span>
              </span>
              <span className="price-row__price num">{money(i.price)}</span>
              <IconButton icon="edit" label={`Edit ${i.name}`} size={34} onClick={() => setEditing(i)} />
              <IconButton icon="trash" tone="danger" label={`Remove ${i.name}`} size={34} onClick={() => setDeleting(i)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon="list" title="No prices yet" message="Add the first item so customers can see what this service costs." />
      )}

      {editing ? <PriceItemModal serviceId={service.id as ServiceId} serviceName={service.name} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name ?? 'item'}?`}
        message={
          inUse ? (
            <>
              <strong>{inUse} {inUse === 1 ? 'order uses' : 'orders use'} this item.</strong> Their totals will drop this line. Only remove it if you’re sure; otherwise change the price instead.
            </>
          ) : (
            <>It will disappear from the customer app’s price list.</>
          )
        }
        confirmLabel="Remove item"
        loading={isBusy('del')}
        onConfirm={async () => {
          if (!deleting) return;
          await run('del', () => catalogApi.deletePriceItem(deleting.id), `${deleting.name} removed`);
          setDeleting(null);
        }}
      />
    </Card>
  );
}
