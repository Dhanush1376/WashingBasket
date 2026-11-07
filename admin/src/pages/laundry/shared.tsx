import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { useToast } from '@/components/ui/Toast';
import { mockStore, useLaundryView } from '@/laundry/store';
import { useState } from 'react';

/** Live (shared with the customer and staff app through the dev relay) or this browser only. */
export function SyncPill() {
  const { sync } = useLaundryView();
  const live = sync === 'live';
  return (
    <span className="demo-pill" title={live ? 'Changes from the app appear here within seconds' : 'Start the portal dev server to sync with the app'}>
      <span className="demo-pill__dot" style={{ background: live ? '#12AD2B' : sync === 'starting' ? '#8C93A1' : '#B97800' }} aria-hidden />
      {live ? 'Live with the app' : sync === 'starting' ? 'Connecting…' : 'This browser only'}
    </span>
  );
}

/** Puts the laundry demo back to its seed data everywhere it's connected. */
export function ResetDemoButton() {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      await mockStore.reset();
      show('success', 'Demo data reset', 'Every order, wallet and QR is back to the starting data.');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button icon="refresh" onClick={() => setOpen(true)}>
        Reset demo
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={reset}
        loading={busy}
        title="Reset the laundry demo?"
        message="All laundry orders, payments, QR codes, receipts and issues go back to the starting mock data, in the portal and in the connected app."
        confirmLabel="Reset demo data"
      />
    </>
  );
}
