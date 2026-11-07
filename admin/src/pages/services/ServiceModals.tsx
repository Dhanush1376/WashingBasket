import { useState, type FormEvent } from 'react';

import { ART, ART_CHOICES } from '@/components/domain/art';
import { Button } from '@/components/ui/Button';
import { Field, FieldRow, Select, TextArea, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { catalogApi, type ServiceRow } from '@/services';
import type { PriceItem, PriceUnit, ServiceId } from '@/types';

const UNITS: { value: PriceUnit; label: string }[] = [
  { value: 'piece', label: 'per piece' },
  { value: 'kg', label: 'per kg' },
  { value: 'pair', label: 'per pair' },
  { value: 'panel', label: 'per panel' },
];

export function PriceItemModal({ serviceId, serviceName, item, onClose }: { serviceId: ServiceId; serviceName: string; item: PriceItem | null; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [unit, setUnit] = useState<PriceUnit>(item?.unit ?? 'piece');
  const [tried, setTried] = useState(false);
  const value = Number(price);
  const errors = {
    name: tried && name.trim().length < 2 ? 'Enter the item’s name, e.g. “Shirt / T-shirt”.' : undefined,
    price: tried && (!value || value < 1 || value > 99999) ? 'Enter a price between ₹1 and ₹99,999.' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (name.trim().length < 2 || !value || value < 1 || value > 99999) return;
    const input = { name, price: Math.round(value), unit };
    const ok = item
      ? await run('save', () => catalogApi.updatePriceItem(item.id, input), `${name.trim()} updated`)
      : await run('save', () => catalogApi.addPriceItem(serviceId, input), `${name.trim()} added to ${serviceName}`);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={item ? 'Edit price' : `Add an item to ${serviceName}`}
      description={item ? 'The new price applies to every order that uses this item and isn’t paid yet.' : 'It appears on the customer app’s price list straight away.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="price-form" loading={isBusy('save')}>
            {item ? 'Save price' : 'Add item'}
          </Button>
        </>
      }
    >
      <form id="price-form" className="form" onSubmit={submit} noValidate>
        <Field label="Item name" error={errors.name}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} data-autofocus />
        </Field>
        <FieldRow>
          <Field label="Price" error={errors.price}>
            <TextInput prefix="₹" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Charged">
            <Select value={unit} onChange={(e) => setUnit(e.target.value as PriceUnit)}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldRow>
      </form>
    </Modal>
  );
}

export function ServiceModal({ service, note: initialNote, onClose }: { service: ServiceRow; note: string; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [v, setV] = useState({ name: service.name, tagline: service.tagline, description: service.description, turnaround: service.turnaround, art: service.art });
  const [note, setNote] = useState(initialNote);
  const [tried, setTried] = useState(false);
  const errors = {
    name: tried && v.name.trim().length < 3 ? 'Enter the service name.' : undefined,
    tagline: tried && v.tagline.trim().length < 3 ? 'Add a short line under the name.' : undefined,
    turnaround: tried && !v.turnaround.trim() ? 'e.g. “48 hours” or “5 days”.' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean) || v.name.trim().length < 3 || v.tagline.trim().length < 3 || !v.turnaround.trim()) return;
    const ok = await run(
      'save',
      async () => {
        await catalogApi.updateCategoryNote(service.id, note);
        return catalogApi.updateService(service.id, v);
      },
      `${v.name.trim()} saved`,
    );
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${service.name}`}
      description="How this service is described on Home, when booking and on the price list."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="service-form" loading={isBusy('save')}>
            Save service
          </Button>
        </>
      }
    >
      <form id="service-form" className="form" onSubmit={submit} noValidate>
        <Field label="Name" error={errors.name}>
          <TextInput value={v.name} maxLength={28} onChange={(e) => setV({ ...v, name: e.target.value })} data-autofocus />
        </Field>
        <Field label="Short line" error={errors.tagline} hint="Shown under the name, e.g. “Everyday clothes, by the kilo”.">
          <TextInput value={v.tagline} maxLength={44} onChange={(e) => setV({ ...v, tagline: e.target.value })} />
        </Field>
        <Field label="Description">
          <TextArea value={v.description} maxLength={160} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        <FieldRow>
          <Field label="Ready in" error={errors.turnaround}>
            <TextInput value={v.turnaround} maxLength={16} onChange={(e) => setV({ ...v, turnaround: e.target.value })} />
          </Field>
          <Field label="Picture">
            <Select value={v.art} onChange={(e) => setV({ ...v, art: e.target.value })}>
              {ART_CHOICES.filter((a) => ART[a.key]).map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldRow>
        <Field label="Note on the price list" optional hint="e.g. “Priced per kilogram of dry laundry.”">
          <TextInput value={note} maxLength={70} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
