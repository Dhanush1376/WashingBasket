import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Overlay';

const REASONS = ['Cancelled by the customer before pickup.', 'No one was available at the pickup address.', 'Address is outside our pickup areas.', 'Other reason'];

/** Asks why before cancelling, since the customer sees the reason in their app. */
export function CancelDialog({ open, onClose, onConfirm, what, busy }: { open: boolean; onClose: () => void; onConfirm: (reason: string) => void; what: string; busy?: boolean }) {
  const [choice, setChoice] = useState(REASONS[0]);
  const [other, setOther] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const reason = choice === 'Other reason' ? other.trim() : choice;
    if (!reason) {
      setError('Please write a short reason. The customer will see it.');
      return;
    }
    onConfirm(reason);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Cancel ${what}?`}
      description="The customer will see this as cancelled in their app, with the reason you choose. This can’t be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Yes, cancel
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label="Reason">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        {choice === 'Other reason' ? (
          <Field label="Write the reason" error={error} hint="Keep it short and polite, the customer reads this.">
            <TextArea
              value={other}
              maxLength={140}
              onChange={(e) => {
                setOther(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Our van broke down; we’ll call you to rebook."
            />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
