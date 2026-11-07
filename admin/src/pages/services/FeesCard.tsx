import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, FieldRow, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { useAction } from '@/hooks/useAction';
import { money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi } from '@/services';

/** The delivery fee and the order value above which delivery is free. */
export function FeesCard() {
  const pricing = useQuery('pricing', catalogApi.getPricing);
  const { run, isBusy } = useAction();
  const [fee, setFee] = useState('');
  const [free, setFree] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    if (!pricing.data) return;
    setFee(String(pricing.data.fees.delivery));
    setFree(String(pricing.data.fees.freeDeliveryAbove));
  }, [pricing.data]);

  const f = Number(fee);
  const fr = Number(free);
  const errors = {
    fee: tried && (fee === '' || f > 999) ? 'Between ₹0 and ₹999.' : undefined,
    free: tried && (free === '' || fr > 99999) ? 'Enter an amount (0 means delivery is always free).' : undefined,
  };
  const dirty = pricing.data && (f !== pricing.data.fees.delivery || fr !== pricing.data.fees.freeDeliveryAbove);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (fee === '' || free === '' || f > 999 || fr > 99999) return;
    await run('fees', () => catalogApi.updateFees({ delivery: f, freeDeliveryAbove: fr }), 'Delivery fee saved');
  };

  return (
    <Card>
      <CardHeader title="Delivery fee" hint="Added to small orders. Shown on the price list and the bill." icon="truck" />
      <form className="form" onSubmit={submit} noValidate>
        <FieldRow>
          <Field label="Delivery fee" error={errors.fee}>
            <TextInput prefix="₹" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label="Free delivery on orders of" error={errors.free}>
            <TextInput prefix="₹" inputMode="numeric" value={free} onChange={(e) => setFree(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </FieldRow>
        <p className="note">
          <Icon name="info" size={16} />
          {f ? `Orders under ${money(fr)} pay ${money(f)} for delivery; ${money(fr)} or more is free.` : 'Delivery is free on every order.'}
        </p>
        <div className="form-actions">
          <Button variant="primary" type="submit" disabled={!dirty} loading={isBusy('fees')}>
            Save delivery fee
          </Button>
        </div>
      </form>
    </Card>
  );
}
