import { useState } from 'react';

import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, MiniSwitch, Select } from '@/components/ui/Form';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { dateParts } from '@customer/lib/format';
import { useQuery } from '@/lib/query';
import { TONES } from '@/lib/status';
import { schedulingApi, type AreaRow } from '@/services';
import type { AdminPickupSlot } from '@/types';
import { AreaModal, SlotModal } from './ScheduleModals';

export default function SchedulePage() {
  return (
    <div className="page">
      <PageHeader
        icon="clock"
        title="Pickup times & areas"
        description="Set available pickup slots and service areas."
      />
      <div className="schedule-grid">
        <SlotsCard />
        <AreasCard />
      </div>
    </div>
  );
}

function SlotsCard() {
  const slots = useQuery('slots', schedulingApi.getPickupSlots);
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState<AdminPickupSlot | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminPickupSlot | null>(null);

  return (
    <>
      <Card className="schedule-grid__wide">
        <CardHeader
          title="Time slots"
          hint="Customers choose one of these when they book a pickup."
          icon="clock"
          action={
            <Button size="sm" variant="accent" icon="plus" onClick={() => setEditing('new')}>
              Add slot
            </Button>
          }
        />
        <QueryView query={slots}>
          {(s) =>
            s.slots.length ? (
              <ul className="slot-list">
                {s.slots.map((slot) => (
                  <li key={slot.id} className={`slot-row${slot.enabled ? '' : ' slot-row--off'}`}>
                    <span className="slot-row__period">{slot.period}</span>
                    <strong className="grow">{slot.label}</strong>
                    {s.usage[slot.id] ? <Tag tone="navy">{s.usage[slot.id]} booked ahead</Tag> : null}
                    <MiniSwitch
                      checked={slot.enabled}
                      label={slot.enabled ? `Stop offering ${slot.label}` : `Offer ${slot.label} again`}
                      onChange={(v) => run(`en-${slot.id}`, () => schedulingApi.updateSlot(slot.id, { enabled: v }), v ? 'Slot is offered again' : 'Slot is no longer offered', v ? undefined : 'Pickups already booked in it are kept.')}
                    />
                    <IconButton icon="edit" label={`Edit ${slot.label}`} size={34} onClick={() => setEditing(slot)} />
                    <IconButton icon="trash" tone="danger" label={`Delete ${slot.label}`} size={34} onClick={() => setDeleting(slot)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon="clock" title="No time slots" message="Add at least one slot so customers can book pickups." />
            )
          }
        </QueryView>
      </Card>

      <Card className="schedule-grid__wide">
        <CardHeader title="Busy days" hint="Close a slot on a day when you’re fully booked. Customers see it as full." icon="calendar" />
        <QueryView query={slots}>{(s) => <FullGrid data={s} busy={isBusy('full')} onToggle={(day, slot) => run('full', () => schedulingApi.toggleFull(day, slot), 'Slot updated')} onDays={(n) => run('days', () => schedulingApi.setDaysAhead(n), `Customers can now book ${n} days ahead`)} />}</QueryView>
      </Card>

      {editing ? <SlotModal slot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete the ${deleting?.label ?? ''} slot?`}
        message={
          slots.data?.usage[deleting?.id ?? ''] ? (
            <>
              <strong>{slots.data.usage[deleting!.id]} pickups</strong> are booked in this slot. They stay booked, but the slot will show as “Slot removed”. To stop new bookings only, switch it off instead.
            </>
          ) : (
            <>Customers won’t be able to choose it any more.</>
          )
        }
        confirmLabel="Delete slot"
        loading={isBusy('del')}
        onConfirm={async () => {
          if (!deleting) return;
          await run('del', () => schedulingApi.deleteSlot(deleting.id), 'Slot deleted');
          setDeleting(null);
        }}
      />
    </>
  );
}

function FullGrid({ data, onToggle, onDays, busy }: { data: Awaited<ReturnType<typeof schedulingApi.getPickupSlots>>; onToggle: (day: number, slot: string) => void; onDays: (n: number) => void; busy: boolean }) {
  const enabled = data.slots.filter((s) => s.enabled);
  const days = Array.from({ length: data.daysAhead }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400_000);
    return { offset: i, ...dateParts(d.toISOString()) };
  });
  const isFull = (day: number, slot: string) => data.fullyBooked.some((f) => f.dayOffset === day && f.slotId === slot);

  return (
    <div className="stack">
      <Field label="Customers can book" hint="Counting from tomorrow.">
        <Select value={String(data.daysAhead)} onChange={(e) => onDays(Number(e.target.value))} className="select--narrow">
          {[3, 5, 7, 10, 14].map((n) => (
            <option key={n} value={n}>
              Up to {n} days ahead
            </option>
          ))}
        </Select>
      </Field>
      {enabled.length ? (
        <div className="full-grid-wrap">
          <table className="full-grid">
            <caption className="sr-only">Open and full slots by day</caption>
            <thead>
              <tr>
                <th scope="col">Slot</th>
                {days.map((d) => (
                  <th key={d.offset} scope="col">
                    <span className="full-grid__day">{d.offset === 0 ? 'Tmrw' : d.weekday}</span>
                    <span className="full-grid__date">
                      {d.day} {d.month}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enabled.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  {days.map((d) => {
                    const full = isFull(d.offset, s.id);
                    return (
                      <td key={d.offset}>
                        <button
                          type="button"
                          className={`full-cell${full ? ' full-cell--full' : ''}`}
                          aria-pressed={full}
                          disabled={busy}
                          onClick={() => onToggle(d.offset, s.id)}
                          aria-label={`${s.label} on ${d.weekday} ${d.day} ${d.month}: ${full ? 'full, click to open' : 'open, click to mark full'}`}
                        >
                          {full ? 'Full' : 'Open'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState compact icon="clock" title="No slots offered" message="Switch on a time slot above to manage busy days." />
      )}
      <p className="muted small">Tap a box to switch between Open and Full. Scroll sideways on small screens to see every day.</p>
    </div>
  );
}

function AreasCard() {
  const areas = useQuery('areas', schedulingApi.listServiceAreas);
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState<AreaRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AreaRow | null>(null);

  return (
    <Card className="schedule-grid__wide">
      <CardHeader
        title="Pickup areas"
        hint="When a new customer signs up, the app checks their PIN code against this list."
        icon="mapPin"
        action={
          <Button size="sm" variant="accent" icon="plus" onClick={() => setEditing('new')}>
            Add area
          </Button>
        }
      />
      <QueryView query={areas}>
        {(list) =>
          list.length ? (
            <ul className="area-list">
              {list.map((a) => (
                <li key={a.pincode} className="area-row">
                  <span className="area-row__pin mono">{a.pincode}</span>
                  <span className="grow">
                    <strong>{a.area}</strong>
                    <span className="muted small block">
                      {a.city}
                      {a.customers ? ` · ${a.customers} ${a.customers === 1 ? 'customer' : 'customers'}` : ''}
                      {a.note ? ` · ${a.note}` : ''}
                    </span>
                  </span>
                  <StatusBadge size="sm" label={a.active ? 'Collecting' : 'Not yet'} tone={a.active ? TONES.done : TONES.muted} />
                  <MiniSwitch checked={a.active} label={a.active ? `Stop collecting in ${a.area}` : `Start collecting in ${a.area}`} onChange={(v) => run(`a-${a.pincode}`, () => schedulingApi.saveServiceArea({ ...a, active: v }, a.pincode), v ? `Now collecting in ${a.area}` : `Stopped collecting in ${a.area}`)} />
                  <IconButton icon="edit" label={`Edit ${a.area}`} size={34} onClick={() => setEditing(a)} />
                  <IconButton icon="trash" tone="danger" label={`Delete ${a.area}`} size={34} onClick={() => setDeleting(a)} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon="mapPin" title="No pickup areas" message="Add the PIN codes you collect from so new customers can sign up." />
          )
        }
      </QueryView>
      {editing ? <AreaModal area={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.pincode ?? ''}?`}
        message={
          <>
            New customers in <strong>{deleting?.area}</strong> won’t be able to sign up. {deleting?.customers ? `The ${deleting.customers} existing customers there keep their accounts.` : ''} To pause it for now, switch it off instead.
          </>
        }
        confirmLabel="Delete area"
        loading={isBusy('del')}
        onConfirm={async () => {
          if (!deleting) return;
          await run('del', () => schedulingApi.deleteServiceArea(deleting.pincode), 'Area deleted');
          setDeleting(null);
        }}
      />
    </Card>
  );
}
