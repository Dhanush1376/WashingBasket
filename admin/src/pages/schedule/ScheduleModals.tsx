import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, Switch, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { schedulingApi, type AreaRow } from '@/services';
import type { AdminPickupSlot, PickupSlot } from '@/types';

type Period = PickupSlot['period'];

/** Times every 30 minutes from 6 AM to 10 PM, shown the way the customer app writes them. */
const TIMES = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30);
const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
/** "8:00 – 10:00 AM" when both are in the same half of the day, as in pickup-slots.json. */
const label = (a: number, b: number) => {
  const sa = fmt(a);
  const sb = fmt(b);
  return sa.slice(-2) === sb.slice(-2) ? `${sa.slice(0, -3)} – ${sb}` : `${sa} – ${sb}`;
};
const periodFor = (m: number): Period => (m < 12 * 60 ? 'Morning' : m < 17 * 60 ? 'Afternoon' : 'Evening');

function parse(lbl: string): [number, number] | null {
  const m = lbl.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  const to = (h: string, mm: string, ap: string) => ((Number(h) % 12) + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(mm);
  return [to(m[1], m[2], m[3] ?? m[6]), to(m[4], m[5], m[6])];
}

export function SlotModal({ slot, onClose }: { slot: AdminPickupSlot | null; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const initial = (slot && parse(slot.label)) ?? [8 * 60, 10 * 60];
  const [start, setStart] = useState(initial[0]);
  const [end, setEnd] = useState(initial[1]);
  const [tried, setTried] = useState(false);
  const error = tried && end <= start ? 'The end time must be after the start time.' : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (end <= start) return;
    const input = { label: label(start, end), period: periodFor(start) };
    const ok = slot ? await run('save', () => schedulingApi.updateSlot(slot.id, input), 'Slot updated') : await run('save', () => schedulingApi.addSlot(input), `${input.label} added`);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={slot ? 'Edit time slot' : 'Add a time slot'}
      description="Customers see it when they choose a pickup time."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="slot-form" loading={isBusy('save')}>
            {slot ? 'Save slot' : 'Add slot'}
          </Button>
        </>
      }
    >
      <form id="slot-form" className="form" onSubmit={submit} noValidate>
        <FieldRow>
          <Field label="From">
            <Select value={start} onChange={(e) => setStart(Number(e.target.value))} data-autofocus>
              {TIMES.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {fmt(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To" error={error}>
            <Select value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {TIMES.slice(1).map((t) => (
                <option key={t} value={t}>
                  {fmt(t)}
                </option>
              ))}
            </Select>
          </Field>
        </FieldRow>
        <p className="note">
          Customers will see <strong>{end > start ? label(start, end) : '—'}</strong> under {periodFor(start)}.
        </p>
      </form>
    </Modal>
  );
}

export function AreaModal({ area, onClose }: { area: AreaRow | null; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [v, setV] = useState({ pincode: area?.pincode ?? '', area: area?.area ?? '', city: area?.city ?? 'Bengaluru', active: area?.active ?? true, note: area?.note ?? '' });
  const [tried, setTried] = useState(false);
  const pinError = !/^[1-9]\d{5}$/.test(v.pincode)
    ? 'Six digits, not starting with 0.'
    : schedulingApi.areaExists(v.pincode, area?.pincode)
      ? 'This PIN code is already on the list.'
      : undefined;
  const errors = {
    pincode: tried ? pinError : undefined,
    area: tried && v.area.trim().length < 2 ? 'Enter the area name, e.g. “Koramangala”.' : undefined,
    city: tried && v.city.trim().length < 2 ? 'Enter the city.' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (pinError || v.area.trim().length < 2 || v.city.trim().length < 2) return;
    const ok = await run('save', () => schedulingApi.saveServiceArea(v, area?.pincode), area ? 'Area saved' : `${v.pincode} added`);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={area ? `Edit ${area.pincode}` : 'Add a pickup area'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="area-form" loading={isBusy('save')}>
            {area ? 'Save area' : 'Add area'}
          </Button>
        </>
      }
    >
      <form id="area-form" className="form" onSubmit={submit} noValidate>
        <Field label="PIN code" error={errors.pincode}>
          <TextInput value={v.pincode} inputMode="numeric" maxLength={6} onChange={(e) => setV({ ...v, pincode: e.target.value.replace(/\D/g, '') })} className="mono" data-autofocus />
        </Field>
        <FieldRow>
          <Field label="Area" error={errors.area}>
            <TextInput value={v.area} maxLength={40} onChange={(e) => setV({ ...v, area: e.target.value })} />
          </Field>
          <Field label="City" error={errors.city}>
            <TextInput value={v.city} maxLength={30} onChange={(e) => setV({ ...v, city: e.target.value })} />
          </Field>
        </FieldRow>
        <Field label="Note for the team" optional>
          <TextInput value={v.note} maxLength={80} onChange={(e) => setV({ ...v, note: e.target.value })} />
        </Field>
        <Switch checked={v.active} onChange={(on) => setV({ ...v, active: on })} label="Collecting here now" description="Switch off to add the area for later without customers signing up yet." />
      </form>
    </Modal>
  );
}
