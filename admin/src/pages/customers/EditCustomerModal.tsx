import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Field, FormAlert, TextArea, TextInput } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { customersApi, type CustomerRow } from '@/services';

type Errors = Partial<Record<'fullName' | 'phone' | 'email', string>>;

function validate(v: { fullName: string; phone: string; email: string }): Errors {
  const e: Errors = {};
  if (v.fullName.trim().length < 2) e.fullName = 'Enter the customer’s full name.';
  const digits = v.phone.replace(/\D/g, '');
  if (!(digits.length === 12 && digits.startsWith('91')) && digits.length !== 10) e.phone = 'Enter a 10-digit Indian mobile number.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Enter an email address like name@example.com.';
  return e;
}

/** Formats any 10-digit or +91 number the way the customer app shows it: +91 98765 43210. */
function tidyPhone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : raw;
}

export function EditCustomerModal({ customer, onClose }: { customer: CustomerRow; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [v, setV] = useState({ fullName: customer.fullName, phone: customer.phone, email: customer.email, note: customer.note });
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    const next = { ...v, [k]: e.target.value };
    setV(next);
    if (tried) setErrors(validate(next));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const ok = await run(
      'save',
      () => customersApi.updateCustomer(customer.id, { fullName: v.fullName.trim(), phone: tidyPhone(v.phone), email: v.email.trim(), note: v.note.trim() }),
      'Customer details saved',
    );
    if (ok) onClose();
  };

  const count = Object.keys(errors).length;

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit customer details"
      description="Fix a typo or update contact details. The customer sees their new name, phone and email in the app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-customer" loading={isBusy('save')}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-customer" className="form" onSubmit={submit} noValidate>
        {tried && count ? <FormAlert>Please fix the {count === 1 ? 'field' : `${count} fields`} marked in red.</FormAlert> : null}
        <Field label="Full name" error={errors.fullName}>
          <TextInput value={v.fullName} onChange={set('fullName')} autoComplete="off" data-autofocus />
        </Field>
        <Field label="Mobile number" error={errors.phone} hint="They sign in with this number, so double-check it.">
          <TextInput value={v.phone} onChange={set('phone')} inputMode="tel" autoComplete="off" />
        </Field>
        <Field label="Email" error={errors.email}>
          <TextInput value={v.email} onChange={set('email')} type="email" autoComplete="off" />
        </Field>
        <Field label="Team note" optional hint="Only your team sees this, e.g. “Prefers evening pickups”.">
          <TextArea value={v.note} onChange={set('note')} maxLength={240} />
        </Field>
      </form>
    </Modal>
  );
}
