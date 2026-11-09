import { useState, type FormEvent } from 'react';

import { ART, ART_CHOICES, ART_TINT } from '@/components/domain/art';
import { Button } from '@/components/ui/Button';
import { Field, TextArea, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { money } from '@/lib/format';
import { catalogApi, type ServiceRow } from '@/services';
import type { PriceItem, PriceUnit, ServiceId } from '@/types';

const UNITS: { value: PriceUnit; label: string; icon: string; desc: string }[] = [
  { value: 'piece', label: 'Per Piece', icon: '👕', desc: 'Single garments (shirt, pant, saree)' },
  { value: 'kg', label: 'Per Kilogram (Kg)', icon: '⚖️', desc: 'Weighed dry clothes / laundry bags' },
  { value: 'pair', label: 'Per Pair', icon: '👟', desc: 'Footwear, socks, or gloves' },
  { value: 'panel', label: 'Per Panel', icon: '🪟', desc: 'Curtains, drapes, and fabric panels' },
];

const COMMON_GARMENTS = [
  'Shirt / T-shirt',
  'Trousers / Jeans',
  'Kurta',
  'Cotton saree',
  'Silk saree',
  'Blazer',
  'Suit (2 piece)',
  'Jacket',
  'Bedsheet',
  'Blanket / Quilt',
  'Curtain',
  'Shoe cleaning',
];

const TURNAROUND_PRESETS = ['24 hours', '48 hours', '72 hours', '3 days', '5 days'];

export function PriceItemModal({
  serviceId: initialServiceId,
  serviceName: initialServiceName,
  servicesList = [],
  item,
  onClose,
}: {
  serviceId?: ServiceId;
  serviceName?: string;
  servicesList?: ServiceRow[];
  item: PriceItem | null;
  onClose: () => void;
}) {
  const { run, isBusy } = useAction();
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceId>(
    initialServiceId || (servicesList[0]?.id as ServiceId) || 'wash-fold',
  );
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [unit, setUnit] = useState<PriceUnit>(item?.unit ?? 'piece');
  const [tried, setTried] = useState(false);

  const value = Number(price) || 0;
  const currentServiceName =
    initialServiceName || servicesList.find((s) => s.id === selectedServiceId)?.name || 'Service';

  const errors = {
    name: tried && name.trim().length < 2 ? 'Enter the item name (e.g. “Shirt / T-shirt”).' : undefined,
    price: tried && (!value || value < 1 || value > 99999) ? 'Enter a price between ₹1 and ₹99,999.' : undefined,
  };

  const adjustPrice = (delta: number) => {
    const next = Math.max(1, value + delta);
    setPrice(String(next));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (name.trim().length < 2 || !value || value < 1 || value > 99999) return;
    const input = { name: name.trim(), price: Math.round(value), unit };
    const ok = item
      ? await run('save', () => catalogApi.updatePriceItem(item.id, input), `${name.trim()} updated`)
      : await run('save', () => catalogApi.addPriceItem(selectedServiceId, input), `${name.trim()} added to ${currentServiceName}`);
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={item ? `Edit Price: ${item.name}` : `Add Garment to ${currentServiceName}`}
      description={
        item
          ? 'New price updates immediately on the customer app and applies to new or unpaid orders.'
          : 'Added garment will immediately appear in the customer price catalog.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="price-form" loading={isBusy('save')}>
            {item ? 'Save Price' : 'Add to Price List'}
          </Button>
        </>
      }
    >
      <form id="price-form" className="form" onSubmit={submit} noValidate>
        {/* If adding from master table without preselected service */}
        {!initialServiceId && servicesList.length > 0 && !item ? (
          <Field label="Service Category" hint="Choose which service this garment belongs to.">
            <div className="svc-select-grid">
              {servicesList.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`svc-select-tile${selectedServiceId === s.id ? ' svc-select-tile--active' : ''}`}
                  onClick={() => setSelectedServiceId(s.id as ServiceId)}
                >
                  <span className="svc-select-tile__art" style={{ background: ART_TINT[s.art] ?? '#F4F5F7' }}>
                    <img src={ART[s.art]} alt="" />
                  </span>
                  <span className="svc-select-tile__name">{s.name}</span>
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        {/* Garment Name with Quick Suggestion Chips */}
        <Field label="Garment / Item Name" error={errors.name} hint="What the customer calls this item.">
          <div>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Shirt / T-shirt, Kurta, Silk Saree"
              data-autofocus
            />
            <div className="svc-preset-row" style={{ marginTop: 8 }} aria-label="Popular item name suggestions">
              {COMMON_GARMENTS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`svc-preset-chip svc-preset-chip--sm${name === g ? ' svc-preset-chip--active' : ''}`}
                  onClick={() => setName(g)}
                >
                  + {g}
                </button>
              ))}
            </div>
          </div>
        </Field>

        {/* Price Input with Large Stepper / Adjustments */}
        <Field label="Price" error={errors.price} hint="Rate charged to the customer.">
          <div className="svc-price-input-cluster">
            <TextInput
              prefix="₹"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
            />
            <div className="svc-price-stepper-row">
              <button type="button" className="svc-step-btn" onClick={() => adjustPrice(-10)}>
                -₹10
              </button>
              <button type="button" className="svc-step-btn" onClick={() => adjustPrice(-5)}>
                -₹5
              </button>
              <button type="button" className="svc-step-btn svc-step-btn--plus" onClick={() => adjustPrice(5)}>
                +₹5
              </button>
              <button type="button" className="svc-step-btn svc-step-btn--plus" onClick={() => adjustPrice(10)}>
                +₹10
              </button>
              <button type="button" className="svc-step-btn svc-step-btn--plus" onClick={() => adjustPrice(50)}>
                +₹50
              </button>
            </div>
          </div>
        </Field>

        {/* Billing Unit Selector Cards */}
        <Field label="How is this charged?">
          <div className="svc-unit-grid">
            {UNITS.map((u) => (
              <button
                key={u.value}
                type="button"
                className={`svc-unit-card${unit === u.value ? ' svc-unit-card--active' : ''}`}
                onClick={() => setUnit(u.value)}
              >
                <span className="svc-unit-card__icon">{u.icon}</span>
                <strong className="svc-unit-card__title">{u.label}</strong>
                <span className="svc-unit-card__desc">{u.desc}</span>
              </button>
            ))}
          </div>
        </Field>

        {/* Live Customer Preview Pill */}
        {name.trim() && value > 0 ? (
          <div className="svc-live-preview-pill">
            <Icon name="sparkle" size={16} />
            <span>
              Customer sees: <strong>{name.trim()}</strong> · <span className="num">{money(value)}</span> per{' '}
              {unit}
            </span>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

export function ServiceModal({
  service,
  note: initialNote,
  onClose,
}: {
  service: ServiceRow | null; // null means creating a new service
  note?: string;
  onClose: () => void;
}) {
  const isNew = !service;
  const { run, isBusy } = useAction();
  const [v, setV] = useState({
    name: service?.name ?? '',
    tagline: service?.tagline ?? '',
    description: service?.description ?? '',
    turnaround: service?.turnaround ?? '48 hours',
    art: service?.art ?? 'washing',
  });
  const [note, setNote] = useState(initialNote ?? '');
  const [tried, setTried] = useState(false);

  const errors = {
    name: tried && v.name.trim().length < 3 ? 'Enter the service name (e.g. Wash & Fold).' : undefined,
    tagline: tried && v.tagline.trim().length < 3 ? 'Add a short subtitle for the card.' : undefined,
    turnaround: tried && !v.turnaround.trim() ? 'Specify turnaround (e.g. “48 hours”).' : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(errors).some(Boolean) || v.name.trim().length < 3 || v.tagline.trim().length < 3 || !v.turnaround.trim())
      return;

    if (isNew) {
      const ok = await run(
        'save-service',
        () => catalogApi.addService(v),
        `${v.name.trim()} service created!`,
      );
      if (ok) onClose();
    } else {
      const ok = await run(
        'save-service',
        async () => {
          await catalogApi.updateCategoryNote(service.id, note);
          return catalogApi.updateService(service.id, v);
        },
        `${v.name.trim()} updated!`,
      );
      if (ok) onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={isNew ? 'Create New Service' : `Edit Service: ${service.name}`}
      description={
        isNew
          ? 'Add a new laundry service category with its picture, turnaround promise and pricing.'
          : 'Changes appear on the customer app home screen, service card and price list.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="service-form" loading={isBusy('save-service')}>
            {isNew ? 'Create Service' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id="service-form" className="form" onSubmit={submit} noValidate>
        {/* Visual Illustration Selector Grid */}
        <Field label="Choose Service Picture" hint="Select the illustration shown to customers on the app.">
          <div className="svc-art-picker-grid">
            {ART_CHOICES.filter((a) => ART[a.key]).map((a) => (
              <button
                key={a.key}
                type="button"
                className={`svc-art-tile${v.art === a.key ? ' svc-art-tile--active' : ''}`}
                onClick={() => setV({ ...v, art: a.key })}
                title={a.label}
              >
                <span className="svc-art-tile__squircle" style={{ background: ART_TINT[a.key] ?? '#F4F5F7' }}>
                  <img src={ART[a.key]} alt="" />
                </span>
                <span className="svc-art-tile__label">{a.label}</span>
                {v.art === a.key ? (
                  <span className="svc-art-tile__check">
                    <Icon name="check" size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Service Name" error={errors.name} hint="e.g. Wash & Fold, Dry Cleaning, Express Steam Iron">
          <TextInput
            value={v.name}
            maxLength={28}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            placeholder="e.g. Wash & Fold"
            data-autofocus
          />
        </Field>

        <Field label="Short Tagline" error={errors.tagline} hint="Shown right below the name on the customer app.">
          <TextInput
            value={v.tagline}
            maxLength={44}
            onChange={(e) => setV({ ...v, tagline: e.target.value })}
            placeholder="e.g. Everyday clothes, by the kilo"
          />
        </Field>

        <Field label="Customer Description" optional hint="Explains what is included in this service.">
          <TextArea
            value={v.description}
            maxLength={160}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder="e.g. Machine washed with gentle detergent, tumble dried and neatly folded."
            rows={2}
          />
        </Field>

        <Field label="Ready In / Turnaround" error={errors.turnaround} hint="How fast clothes are ready for delivery.">
          <div>
            <TextInput
              value={v.turnaround}
              maxLength={16}
              onChange={(e) => setV({ ...v, turnaround: e.target.value })}
              placeholder="e.g. 48 hours"
            />
            <div className="svc-preset-row" style={{ marginTop: 6 }} aria-label="Turnaround presets">
              {TURNAROUND_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`svc-preset-chip svc-preset-chip--sm${v.turnaround === t ? ' svc-preset-chip--active' : ''}`}
                  onClick={() => setV({ ...v, turnaround: t })}
                >
                  ⏱️ {t}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Price List Note" optional hint="Shown at the top of this category's price list (e.g. 'Priced per kilogram of dry laundry.').">
          <TextInput
            value={note}
            maxLength={70}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Priced per kilogram of dry laundry."
          />
        </Field>
      </form>
    </Modal>
  );
}
