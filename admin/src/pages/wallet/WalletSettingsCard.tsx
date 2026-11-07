import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, FieldRow, FormAlert, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { QueryView } from '@/components/ui/QueryView';
import { useAction } from '@/hooks/useAction';
import { money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { walletApi } from '@/services';
import type { WalletConfig } from '@/types';

type Draft = { presets: string[]; min: string; max: string; percent: string; minAmount: string };

const toDraft = (c: WalletConfig): Draft => ({
  presets: c.presets.map(String),
  min: String(c.limits.min),
  max: String(c.limits.max),
  percent: String(c.topUpBonus.percent),
  minAmount: String(c.topUpBonus.minAmount),
});

const n = (s: string) => Number(s.replace(/[^\d.]/g, ''));

function validate(d: Draft) {
  const e: Record<string, string> = {};
  const min = n(d.min);
  const max = n(d.max);
  if (!min || min < 10) e.min = 'At least ₹10.';
  if (!max || max <= min) e.max = 'Must be more than the smallest top-up.';
  d.presets.forEach((p, i) => {
    const v = n(p);
    if (!v) e[`p${i}`] = 'Enter an amount.';
    else if (v < min || v > max) e[`p${i}`] = `Between ${money(min)} and ${money(max)}.`;
  });
  const pct = n(d.percent);
  if (d.percent === '' || pct < 0 || pct > 50) e.percent = 'Between 0 and 50%.';
  if (!n(d.minAmount)) e.minAmount = 'Enter an amount.';
  return e;
}

/** The rules behind the customer app's Top Up screen: quick amounts, limits and the bonus. */
export function WalletSettingsCard() {
  const settings = useQuery('wallet-settings', walletApi.getWalletSettings);
  return (
    <Card>
      <CardHeader title="Top-up settings" hint="These control the customer app’s Top Up screen. They don’t change any balance." icon="sliders" />
      <QueryView query={settings}>{(s) => <SettingsForm initial={s} />}</QueryView>
    </Card>
  );
}

function SettingsForm({ initial }: { initial: WalletConfig }) {
  const { run, isBusy } = useAction();
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [tried, setTried] = useState(false);
  useEffect(() => setD(toDraft(initial)), [initial]);
  const errors = tried ? validate(d) : {};
  const bonusExample = n(d.minAmount) ? Math.round((n(d.minAmount) * n(d.percent)) / 100) : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(d)).length) return;
    await run(
      'save',
      () =>
        walletApi.updateWalletSettings({
          presets: d.presets.map(n),
          limits: { min: n(d.min), max: n(d.max) },
          topUpBonus: { percent: n(d.percent), minAmount: n(d.minAmount) },
        }),
      'Top-up settings saved',
      'Customers see the new amounts next time they open Top Up.',
    );
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {tried && Object.keys(errors).length ? <FormAlert>Some amounts need fixing before saving.</FormAlert> : null}
      <section className="form-section">
        <h3 className="form-section__title">Quick amounts</h3>
        <p className="form-section__hint">The buttons customers tap to top up in one go.</p>
        <div className="preset-grid">
          {d.presets.map((p, i) => (
            <Field key={i} label={`Button ${i + 1}`} error={errors[`p${i}`]}>
              <TextInput
                prefix="₹"
                inputMode="numeric"
                value={p}
                onChange={(e) => setD({ ...d, presets: d.presets.map((x, j) => (j === i ? e.target.value.replace(/\D/g, '') : x)) })}
              />
            </Field>
          ))}
        </div>
      </section>
      <section className="form-section">
        <h3 className="form-section__title">Limits for one top-up</h3>
        <FieldRow>
          <Field label="Smallest" error={errors.min}>
            <TextInput prefix="₹" inputMode="numeric" value={d.min} onChange={(e) => setD({ ...d, min: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Largest" error={errors.max}>
            <TextInput prefix="₹" inputMode="numeric" value={d.max} onChange={(e) => setD({ ...d, max: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </FieldRow>
      </section>
      <section className="form-section">
        <h3 className="form-section__title">Top-up bonus</h3>
        <FieldRow>
          <Field label="Bonus" error={errors.percent} hint="Set 0 to turn the bonus off.">
            <TextInput suffix="%" inputMode="decimal" value={d.percent} onChange={(e) => setD({ ...d, percent: e.target.value.replace(/[^\d.]/g, '') })} />
          </Field>
          <Field label="On top-ups of at least" error={errors.minAmount}>
            <TextInput prefix="₹" inputMode="numeric" value={d.minAmount} onChange={(e) => setD({ ...d, minAmount: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </FieldRow>
        <p className="note">
          <Icon name="info" size={16} />
          {n(d.percent) > 0 ? `Example: a customer who adds ${money(n(d.minAmount))} gets ${money(bonusExample)} extra.` : 'No bonus will be given.'}
        </p>
      </section>
      <div className="form-actions">
        <Button variant="ghost" onClick={() => { setD(toDraft(initial)); setTried(false); }}>
          Undo changes
        </Button>
        <Button variant="primary" type="submit" loading={isBusy('save')}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
