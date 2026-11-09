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

const HUBS = [
  {
    id: 'loc-nit',
    name: 'NIT Jalandhar',
    code: 'NIT',
    logo: `${import.meta.env.BASE_URL}logos/nitj.png`,
    city: 'Jalandhar, Punjab',
    pincode: '144011',
    presets: ['Mega Boys Hostels', 'Girls Hostel Complex', 'Faculty Quarters', 'GT Road Bye-Pass'],
  },
  {
    id: 'loc-lpu',
    name: 'LPU Campus',
    code: 'LPU',
    logo: `${import.meta.env.BASE_URL}logos/lpu.png`,
    city: 'Phagwara, Punjab',
    pincode: '144411',
    presets: ['Uni Mall (Block 32)', 'Law Gate PGs', 'Central Campus Hostels', 'Chehru'],
  },
  {
    id: 'loc-outside',
    name: 'Model Town Store',
    code: 'Model Town',
    logo: `${import.meta.env.BASE_URL}logos/wb.png`,
    city: 'Jalandhar, Punjab',
    pincode: '144003',
    presets: ['Model Town & Market', 'Urban Estate Phase 1', 'Urban Estate Phase 2', 'Civil Lines', 'Jalandhar Cantt'],
  },
];

export function AreaModal({ area, onClose }: { area: AreaRow | null; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [selectedHub, setSelectedHub] = useState<string>(() => {
    if (area?.hubId) return area.hubId;
    if (area?.pincode === '144011') return 'loc-nit';
    if (area?.pincode === '144411' || area?.pincode === '144401') return 'loc-lpu';
    return 'loc-outside';
  });

  const [v, setV] = useState({
    pincode: area?.pincode ?? '144003',
    area: area?.area ?? '',
    city: area?.city ?? 'Jalandhar, Punjab',
    active: area?.active ?? true,
    note: area?.note ?? '',
    hubId: area?.hubId ?? 'loc-outside',
  });
  const [tried, setTried] = useState(false);

  const activeHubMeta = HUBS.find((h) => h.id === selectedHub) ?? HUBS[2];

  const onSelectHub = (hubId: string) => {
    setSelectedHub(hubId);
    const meta = HUBS.find((h) => h.id === hubId);
    if (meta) {
      setV((prev) => ({
        ...prev,
        hubId,
        city: meta.city,
        pincode:
          prev.pincode && prev.pincode !== '144003' && prev.pincode !== '144011' && prev.pincode !== '144411'
            ? prev.pincode
            : meta.pincode,
      }));
    }
  };

  const pinError = !/^[1-9]\d{5}$/.test(v.pincode)
    ? 'Six digits, not starting with 0.'
    : schedulingApi.areaExists(v.pincode, area?.pincode)
      ? 'This PIN code is already on the list.'
      : undefined;

  const errors = {
    pincode: tried ? pinError : undefined,
    area: tried && v.area.trim().length < 2 ? 'Enter the area name, e.g. “Model Town”.' : undefined,
    city: tried && v.city.trim().length < 2 ? 'Enter the city.' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (pinError || v.area.trim().length < 2 || v.city.trim().length < 2) return;
    const ok = await run(
      'save',
      () => schedulingApi.saveServiceArea({ ...v, hubId: selectedHub }, area?.pincode),
      area ? 'Area saved' : `PIN ${v.pincode} added`,
    );
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={area ? `Edit Service Area · PIN ${area.pincode}` : 'Add New Service Area'}
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
        {/* Hub Selector Cards */}
        <div>
          <label className="field-label" style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13 }}>
            Operating Hub Territory
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            {HUBS.map((hub) => {
              const isSelected = selectedHub === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => onSelectHub(hub.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 6px',
                    borderRadius: 9,
                    border: `1.5px solid ${isSelected ? 'var(--orange, #FFA742)' : 'var(--hairline, #E2E8F0)'}`,
                    background: isSelected ? '#FFF9F2' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: '#FFFFFF',
                      border: '1px solid rgba(10,28,62,0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      padding: 2,
                    }}
                  >
                    <img src={hub.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: isSelected ? 750 : 600, color: 'var(--navy-deep, #0A1C3E)' }}>
                    {hub.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN Code */}
        <Field label="Postal PIN Code" error={errors.pincode}>
          <TextInput
            value={v.pincode}
            inputMode="numeric"
            maxLength={6}
            onChange={(e) => setV({ ...v, pincode: e.target.value.replace(/\D/g, '') })}
            className="mono"
            placeholder="e.g. 144011"
            data-autofocus
          />
        </Field>

        {/* Area Name with Quick Suggestions */}
        <div>
          <Field label="Area Name" error={errors.area}>
            <TextInput
              value={v.area}
              maxLength={40}
              placeholder="e.g. Mega Boys Hostels, Model Town Market"
              onChange={(e) => setV({ ...v, area: e.target.value })}
            />
          </Field>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, marginBottom: 10 }}>
            {activeHubMeta.presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setV((prev) => ({ ...prev, area: preset }))}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: '1px solid var(--hairline, #E2E8F0)',
                  background: v.area === preset ? 'var(--navy-deep, #0A1C3E)' : '#F8FAFC',
                  color: v.area === preset ? '#FFFFFF' : 'var(--navy-deep, #0A1C3E)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* City */}
        <Field label="City / Region" error={errors.city}>
          <TextInput
            value={v.city}
            maxLength={30}
            placeholder="Jalandhar, Punjab"
            onChange={(e) => setV({ ...v, city: e.target.value })}
          />
        </Field>

        {/* Team / Rider Note */}
        <Field label="Pickup instructions & landmarks" optional hint="Shown to riders during doorstep pickups.">
          <TextInput
            value={v.note}
            maxLength={90}
            placeholder="e.g. Near Uni Mall Block 32 counter or 8 km store radius"
            onChange={(e) => setV({ ...v, note: e.target.value })}
          />
        </Field>

        <Switch
          checked={v.active}
          onChange={(on) => setV({ ...v, active: on })}
          label="Collecting in this area now"
          description="Customers in this PIN code can register and schedule laundry pickups."
        />
      </form>
    </Modal>
  );
}
