import { useState, type FormEvent } from 'react';

import { OfferTicket } from '@/components/domain/OfferTicket';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, FieldRow, FormAlert, Select, Switch, TextArea, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { todayKey } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi, offersApi, type OfferInput } from '@/services';
import type { AdminOffer, ServiceId } from '@/types';

const BADGE_IDEAS = ['10% OFF', '15% OFF', '20% OFF', 'FREE DELIVERY', 'EXTRA CARE'];
const LABEL_IDEAS = ['Limited Offer', 'Best Value', 'Popular Deal', 'New'];
const ELIGIBILITY = ['All customers', 'New customers'];

const blank = (): OfferInput => {
  const today = todayKey();
  const month = todayKey(new Date(Date.now() + 30 * 86400_000));
  return { title: '', description: '', code: '', discountBadge: '10% OFF', badgeLabel: 'Limited Offer', validFrom: today, validUntil: month, eligibility: 'All customers', serviceIds: 'all', visible: true };
};

const fromOffer = (o: AdminOffer): OfferInput => ({
  title: o.title,
  description: o.description,
  code: o.code ?? '',
  discountBadge: o.discountBadge ?? '',
  badgeLabel: o.badgeLabel ?? '',
  validFrom: o.validFrom,
  validUntil: o.validUntil,
  eligibility: o.eligibility,
  serviceIds: o.serviceIds,
  visible: o.visible,
});

type Errors = Partial<Record<keyof OfferInput, string>>;

function validate(v: OfferInput, editingId?: string): Errors {
  const e: Errors = {};
  if (v.title.trim().length < 3) e.title = 'Give the offer a short title, e.g. “Flat 20% off”.';
  if (v.description.trim().length < 5) e.description = 'Say in one line what the customer gets.';
  if (!/^[A-Z0-9]{4,12}$/i.test(v.code.trim())) e.code = 'Use 4–12 letters or numbers, no spaces.';
  else if (offersApi.isCodeTaken(v.code, editingId)) e.code = 'Another offer already uses this code.';
  if (!v.discountBadge.trim()) e.discountBadge = 'What the coupon shows in big letters, e.g. “20% OFF”.';
  if (!v.validFrom) e.validFrom = 'Choose a start date.';
  if (!v.validUntil) e.validUntil = 'Choose an end date.';
  else if (v.validFrom && v.validUntil < v.validFrom) e.validUntil = 'The end date must be on or after the start date.';
  if (Array.isArray(v.serviceIds) && !v.serviceIds.length) e.serviceIds = 'Pick at least one service, or choose “All services”.';
  if (!v.eligibility.trim()) e.eligibility = 'Say who can use it.';
  return e;
}

/** Create or edit an offer, with the coupon updating live next to the form. */
export function OfferEditor({ offer, onClose, nextIndex }: { offer: AdminOffer | null; onClose: () => void; nextIndex: number }) {
  const services = useQuery('services', catalogApi.listServices);
  const { run, isBusy } = useAction();
  const [v, setV] = useState<OfferInput>(() => (offer ? fromOffer(offer) : blank()));
  const [tried, setTried] = useState(false);
  const errors = tried ? validate(v, offer?.id) : {};
  const count = Object.keys(errors).length;

  const set = <K extends keyof OfferInput>(k: K, value: OfferInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const status = offersApi.statusFromDates(v.validFrom || todayKey(), v.validUntil || todayKey());
  const preview: AdminOffer = {
    ...(offer ?? { id: 'new', position: 99 }),
    ...v,
    code: v.code.toUpperCase() || 'CODE',
    discountBadge: v.discountBadge.toUpperCase(),
    status,
  } as AdminOffer;

  const toggleService = (id: ServiceId, on: boolean) => {
    const current = v.serviceIds === 'all' ? [] : v.serviceIds;
    set('serviceIds', on ? [...current, id] : current.filter((x) => x !== id));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(v, offer?.id)).length) return;
    const ok = offer
      ? await run('save', () => offersApi.updateOffer(offer.id, v), 'Offer saved')
      : await run('save', () => offersApi.createOffer(v), 'Offer added', v.visible ? 'It’s now on the customer app’s Offers page.' : 'It’s saved but hidden from customers.');
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={offer ? 'Edit offer' : 'Add an offer'}
      description="Fill in the details on the left. The coupon on the right is exactly what customers will see."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="offer-form" loading={isBusy('save')}>
            {offer ? 'Save offer' : 'Add offer'}
          </Button>
        </>
      }
    >
      <div className="editor-split">
        <form id="offer-form" className="form" onSubmit={submit} noValidate>
          {tried && count ? <FormAlert>Please fix the {count === 1 ? 'field' : `${count} fields`} marked in red.</FormAlert> : null}
          <Field label="Title" error={errors.title}>
            <TextInput value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={40} placeholder="Flat 20% off" data-autofocus />
          </Field>
          <Field label="What the customer gets" error={errors.description}>
            <TextArea value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={120} placeholder="On your first 3 laundry pickups." />
          </Field>
          <FieldRow>
            <Field label="Big text on the coupon" error={errors.discountBadge} hint="e.g. 20% OFF or FREE DELIVERY">
              <TextInput value={v.discountBadge} onChange={(e) => set('discountBadge', e.target.value.toUpperCase())} list="badge-ideas" maxLength={18} />
            </Field>
            <Field label="Small label" optional hint="e.g. Limited Offer">
              <TextInput value={v.badgeLabel} onChange={(e) => set('badgeLabel', e.target.value)} list="label-ideas" maxLength={16} />
            </Field>
          </FieldRow>
          <datalist id="badge-ideas">
            {BADGE_IDEAS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <datalist id="label-ideas">
            {LABEL_IDEAS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <Field label="Coupon code" error={errors.code} hint="Customers type or copy this at checkout.">
            <TextInput value={v.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} maxLength={12} placeholder="FIRSTWASH" className="mono" />
          </Field>
          <FieldRow>
            <Field label="Starts on" error={errors.validFrom}>
              <TextInput type="date" value={v.validFrom} onChange={(e) => set('validFrom', e.target.value)} />
            </Field>
            <Field label="Ends on" error={errors.validUntil}>
              <TextInput type="date" value={v.validUntil} min={v.validFrom} onChange={(e) => set('validUntil', e.target.value)} />
            </Field>
          </FieldRow>
          <Field label="Who can use it" error={errors.eligibility}>
            <Select value={ELIGIBILITY.includes(v.eligibility) ? v.eligibility : 'All customers'} onChange={(e) => set('eligibility', e.target.value)}>
              {ELIGIBILITY.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <fieldset className="fieldset">
            <legend className="field__label">Which services</legend>
            <Checkbox checked={v.serviceIds === 'all'} onChange={(on) => set('serviceIds', on ? 'all' : [])} label="All services" />
            {v.serviceIds !== 'all' ? (
              <div className="check-grid">
                {services.data?.map((s) => (
                  <Checkbox key={s.id} checked={(v.serviceIds as ServiceId[]).includes(s.id)} onChange={(on) => toggleService(s.id, on)} label={s.name} />
                ))}
              </div>
            ) : null}
            {errors.serviceIds ? (
              <p className="field__error" role="alert">
                {errors.serviceIds}
              </p>
            ) : null}
          </fieldset>
          <Switch checked={v.visible} onChange={(on) => set('visible', on)} label="Show to customers" description="Turn off to save it without customers seeing it." />
        </form>

        <aside className="editor-preview" aria-label="Customer preview">
          <p className="editor-preview__label">How customers see it</p>
          <div className="editor-preview__stage">
            <OfferTicket offer={preview} index={offer ? Math.max(0, offer.position - 1) : nextIndex} width={290} faded={!v.visible} />
          </div>
          <p className="muted small">
            {status === 'active' ? 'Running now: customers can redeem it.' : status === 'upcoming' ? 'Starts later: shown as “Coming soon”.' : 'Already ended: shown as “Expired”.'}
            {!v.visible ? ' Hidden, so customers won’t see it.' : ''}
          </p>
        </aside>
      </div>
    </Modal>
  );
}
