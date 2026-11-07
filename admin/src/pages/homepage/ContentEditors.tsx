import { useEffect, useState, type FormEvent } from 'react';

import { ART, ART_CHOICES } from '@/components/domain/art';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, FieldRow, Select, TextArea, TextInput } from '@/components/ui/Form';
import { Icon, isIconName } from '@/components/ui/Icon';
import { useAction } from '@/hooks/useAction';
import { homepageApi } from '@/services';
import type { HomepageContent, HomePerk, PerkTint } from '@/types';

/** The big "Book a pickup" banner: its small label, headline, button text and picture. */
export function BookingEditor({ home }: { home: HomepageContent }) {
  const { run, isBusy } = useAction();
  const [b, setB] = useState(home.booking);
  const [tried, setTried] = useState(false);
  useEffect(() => setB(home.booking), [home.booking]);

  const errors = {
    kicker: tried && !b.kicker.trim() ? 'Add a short label.' : undefined,
    title: tried && !b.title.trim() ? 'Add a headline.' : undefined,
    cta: tried && !b.cta.trim() ? 'Add the button text.' : undefined,
  };
  const dirty = JSON.stringify(b) !== JSON.stringify(home.booking);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!b.kicker.trim() || !b.title.trim() || !b.cta.trim()) return;
    await run('booking', () => homepageApi.updateHomepageContent({ booking: { ...b, kicker: b.kicker.trim(), title: b.title.trim(), cta: b.cta.trim() } }), 'Banner saved', 'Customers see it next time they open the app.');
  };

  return (
    <Card>
      <CardHeader title="Book a pickup banner" hint="The large card that takes customers to booking." icon="calendar" />
      <form className="form" onSubmit={submit} noValidate>
        <FieldRow>
          <Field label="Small label" error={errors.kicker}>
            <TextInput value={b.kicker} maxLength={24} onChange={(e) => setB({ ...b, kicker: e.target.value })} />
          </Field>
          <Field label="Button text" error={errors.cta}>
            <TextInput value={b.cta} maxLength={16} onChange={(e) => setB({ ...b, cta: e.target.value })} />
          </Field>
        </FieldRow>
        <Field label="Headline" error={errors.title} hint="Press Enter to start a new line. Two short lines look best.">
          <TextArea value={b.title} rows={2} maxLength={48} onChange={(e) => setB({ ...b, title: e.target.value })} className="textarea--short" />
        </Field>
        <Field label="Picture">
          <div className="art-picker" role="radiogroup" aria-label="Picture">
            {ART_CHOICES.map((a) => (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={b.art === a.key}
                className={`art-picker__item${b.art === a.key ? ' art-picker__item--on' : ''}`}
                onClick={() => setB({ ...b, art: a.key })}
                title={a.label}
              >
                <img src={ART[a.key]} alt="" />
                <span className="sr-only">{a.label}</span>
              </button>
            ))}
          </div>
        </Field>
        <div className="form-actions">
          <Button variant="ghost" disabled={!dirty} onClick={() => setB(home.booking)}>
            Undo changes
          </Button>
          <Button variant="primary" type="submit" disabled={!dirty} loading={isBusy('booking')}>
            Save banner
          </Button>
        </div>
      </form>
    </Card>
  );
}

const PERK_ICONS = ['truck', 'clock', 'shield', 'sparkle', 'star', 'droplet', 'package', 'tag', 'gift'] as const;
const TINTS: { value: PerkTint; label: string }[] = [
  { value: 'orange', label: 'Orange' },
  { value: 'navy', label: 'Navy' },
  { value: 'green', label: 'Green' },
];
export const TINT_COLOR: Record<PerkTint, string> = { orange: '#FE8701', navy: '#013E86', green: '#1F9D3A' };

/** The short promises under the summary ("Free pickup · 48h turnaround · Quality assured"). */
export function PerksEditor({ home }: { home: HomepageContent }) {
  const { run, isBusy } = useAction();
  const [perks, setPerks] = useState<HomePerk[]>(home.perks);
  const [tried, setTried] = useState(false);
  useEffect(() => setPerks(home.perks), [home.perks]);
  const dirty = JSON.stringify(perks) !== JSON.stringify(home.perks);
  const update = (i: number, patch: Partial<HomePerk>) => setPerks((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (perks.some((p) => !p.label.trim())) return;
    await run('perks', () => homepageApi.savePerks(perks), 'Promises saved');
  };

  return (
    <Card>
      <CardHeader title="Promise strip" hint="Up to four short promises. Keep each to two or three words." icon="shield" />
      <form className="form" onSubmit={submit} noValidate>
        <ul className="perk-list">
          {perks.map((p, i) => (
            <li key={p.id} className="perk-edit">
              <span className="perk-edit__icon" style={{ color: TINT_COLOR[p.tint] }}>
                <Icon name={isIconName(p.icon) ? p.icon : 'star'} size={18} strokeWidth={2} />
              </span>
              <div className="perk-edit__fields">
                <Field label={`Promise ${i + 1}`} error={tried && !p.label.trim() ? 'Write the promise or remove it.' : undefined}>
                  <TextInput value={p.label} maxLength={22} onChange={(e) => update(i, { label: e.target.value })} />
                </Field>
                <FieldRow>
                  <Field label="Icon">
                    <Select value={p.icon} onChange={(e) => update(i, { icon: e.target.value })}>
                      {PERK_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic[0].toUpperCase() + ic.slice(1)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Colour">
                    <Select value={p.tint} onChange={(e) => update(i, { tint: e.target.value as PerkTint })}>
                      {TINTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </FieldRow>
              </div>
              <Button size="sm" variant="ghost" icon="trash" disabled={perks.length <= 1} onClick={() => setPerks((x) => x.filter((_, j) => j !== i))} aria-label={`Remove promise ${i + 1}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="form-actions form-actions--between">
          <Button size="sm" icon="plus" disabled={perks.length >= 4} onClick={() => setPerks((x) => [...x, { id: `new-${Date.now()}`, icon: 'star', label: '', tint: 'navy' }])}>
            Add a promise
          </Button>
          <div className="row">
            <Button variant="ghost" disabled={!dirty} onClick={() => setPerks(home.perks)}>
              Undo
            </Button>
            <Button variant="primary" type="submit" disabled={!dirty} loading={isBusy('perks')}>
              Save promises
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
