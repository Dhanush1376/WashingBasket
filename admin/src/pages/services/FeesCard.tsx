import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, FieldRow, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi } from '@/services';

const QUICK_FEES = [0, 29, 49, 79];
const QUICK_FREE_THRESHOLDS = [299, 499, 799, 999];

export function FeesCard({ asModal, onClose }: { asModal?: boolean; onClose?: () => void }) {
  const pricing = useQuery('pricing', catalogApi.getPricing);
  const { run, isBusy } = useAction();
  const [fee, setFee] = useState('');
  const [free, setFree] = useState('');
  const [testAmount, setTestAmount] = useState('350');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!pricing.data) return;
    setFee(String(pricing.data.fees.delivery));
    setFree(String(pricing.data.fees.freeDeliveryAbove));
  }, [pricing.data]);

  const f = Number(fee) || 0;
  const fr = Number(free) || 0;
  const testVal = Number(testAmount) || 0;
  const isTestFree = f === 0 || (fr > 0 && testVal >= fr);
  const testDeliveryCharged = isTestFree ? 0 : f;

  const errors = {
    fee: tried && (fee === '' || f > 999) ? 'Enter fee between ₹0 and ₹999.' : undefined,
    free: tried && (free === '' || fr > 99999) ? 'Enter minimum amount (0 means delivery is always free).' : undefined,
  };
  const dirty = pricing.data && (f !== pricing.data.fees.delivery || fr !== pricing.data.fees.freeDeliveryAbove);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (fee === '' || free === '' || f > 999 || fr > 99999) return;
    const ok = await run('fees', () => catalogApi.updateFees({ delivery: f, freeDeliveryAbove: fr }), 'Delivery policy saved');
    if (ok && onClose) onClose();
  };

  const formBody = (
    <form className="form" onSubmit={submit} noValidate>
      {/* Visual Rule Explainer Banner */}
      <div className="svc-fees-banner">
        <div className="svc-fees-banner__icon">
          <Icon name="truck" size={28} />
        </div>
        <div className="svc-fees-banner__content">
          <h4 className="svc-fees-banner__title">
            {f === 0
              ? 'Free Delivery on every single order!'
              : fr === 0
              ? `Flat ${money(f)} delivery fee on all orders`
              : `Orders under ${money(fr)} pay ${money(f)} delivery · Orders of ${money(fr)}+ get FREE delivery`}
          </h4>
          <p className="svc-fees-banner__sub">
            Customers see this delivery badge clearly on the home screen, cart, and checkout bill.
          </p>
        </div>
      </div>

      <FieldRow>
        <Field label="Standard delivery fee" error={errors.fee} hint="Added to small orders. Set ₹0 if delivery is always free.">
          <div>
            <TextInput
              prefix="₹"
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))}
              placeholder="49"
            />
            <div className="svc-preset-row" aria-label="Quick delivery fee choices">
              {QUICK_FEES.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`svc-preset-chip${f === val ? ' svc-preset-chip--active' : ''}`}
                  onClick={() => setFee(String(val))}
                >
                  {val === 0 ? 'Free (₹0)' : `₹${val}`}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Free delivery on orders above" error={errors.free} hint="Orders at or above this amount pay zero delivery fee.">
          <div>
            <TextInput
              prefix="₹"
              inputMode="numeric"
              value={free}
              onChange={(e) => setFree(e.target.value.replace(/\D/g, ''))}
              placeholder="499"
            />
            <div className="svc-preset-row" aria-label="Quick free delivery thresholds">
              {QUICK_FREE_THRESHOLDS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`svc-preset-chip${fr === val ? ' svc-preset-chip--active' : ''}`}
                  onClick={() => setFree(String(val))}
                >
                  ₹{val}+
                </button>
              ))}
            </div>
          </div>
        </Field>
      </FieldRow>

      {/* Interactive Delivery Calculator Preview */}
      <div className="svc-calc-card">
        <div className="svc-calc-card__head">
          <span className="svc-calc-card__title">
            <Icon name="sparkle" size={16} /> Live Order Simulation
          </span>
          <span className="svc-calc-card__hint">Try any order amount to see how the bill looks:</span>
        </div>
        <div className="svc-calc-card__grid">
          <div className="svc-calc-input-box">
            <label className="svc-calc-label" htmlFor="sim-cart-input">Customer Cart Value:</label>
            <div className="svc-calc-input-wrap">
              <span className="svc-calc-input-prefix">₹</span>
              <input
                id="sim-cart-input"
                type="text"
                inputMode="numeric"
                className="svc-calc-input"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="350"
              />
            </div>
            <div className="svc-preset-row" style={{ marginTop: 6 }}>
              {[199, 350, 499, 700].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`svc-preset-chip svc-preset-chip--sm${testVal === num ? ' svc-preset-chip--active' : ''}`}
                  onClick={() => setTestAmount(String(num))}
                >
                  ₹{num}
                </button>
              ))}
            </div>
          </div>

          <div className={`svc-calc-result ${isTestFree ? 'svc-calc-result--free' : 'svc-calc-result--charged'}`}>
            <div className="svc-calc-result__status">
              {isTestFree ? (
                <>
                  <span className="svc-calc-result__badge svc-calc-result__badge--green">
                    <Icon name="check" size={14} /> FREE DELIVERY
                  </span>
                  <strong className="svc-calc-result__total">{money(testVal)}</strong>
                  <span className="svc-calc-result__note">
                    {f > 0 ? `Customer saves ${money(f)} on delivery!` : 'Delivery is always free.'}
                  </span>
                </>
              ) : (
                <>
                  <span className="svc-calc-result__badge svc-calc-result__badge--orange">
                    <Icon name="truck" size={14} /> +{money(f)} Delivery Fee
                  </span>
                  <strong className="svc-calc-result__total">{money(testVal + testDeliveryCharged)}</strong>
                  <span className="svc-calc-result__note">
                    {fr > testVal
                      ? `Add ${money(fr - testVal)} more to qualify for Free Delivery`
                      : 'Delivery fee applies'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 16 }}>
        {onClose ? (
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
        ) : null}
        <Button variant="primary" type="submit" disabled={!dirty} loading={isBusy('fees')}>
          Save Delivery Rules
        </Button>
      </div>
    </form>
  );

  if (asModal && onClose) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Delivery Fees & Free Delivery Policy"
        description="Set standard delivery fees and the threshold where delivery becomes 100% free for customers."
        size="md"
      >
        {formBody}
      </Modal>
    );
  }

  return (
    <Card className="svc-fees-container-card">
      <CardHeader
        title="Delivery Fees & Free Delivery"
        hint="Shown on the price list, customer cart, and bill calculation."
        icon="truck"
      />
      {formBody}
    </Card>
  );
}
