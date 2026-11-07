import { ORDER_STATUS } from '@/lib/status';
import { ORDER_STAGES, type OrderStatus } from '@/types';
import { Icon } from '@/components/ui/Icon';

const SHORT: Record<(typeof ORDER_STAGES)[number], string> = {
  pickup_scheduled: 'Pickup',
  collected: 'Collected',
  washing: 'Washing',
  drying: 'Drying',
  ironing: 'Ironing',
  packing: 'Packing',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
};

/** The garment journey the customer follows in the app, as a row of steps (a column on phones). */
export function OrderJourney({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="journey journey--cancelled">
        <Icon name="x" size={16} /> This order was cancelled, so it won’t move any further.
      </div>
    );
  }
  const at = (ORDER_STAGES as readonly string[]).indexOf(status);
  return (
    <ol className="journey" aria-label={`Order progress: ${ORDER_STATUS[status].label}, step ${at + 1} of ${ORDER_STAGES.length}`}>
      {ORDER_STAGES.map((s, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return (
          <li key={s} className={`journey__step journey__step--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="journey__dot">{state === 'done' ? <Icon name="check" size={11} strokeWidth={3} /> : null}</span>
            <span className="journey__label">{SHORT[s]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** A thin bar for list rows: how far along the order is. */
export function JourneyBar({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const at = (ORDER_STAGES as readonly string[]).indexOf(status);
  return (
    <span className="journey-bar" aria-hidden>
      {ORDER_STAGES.map((s, i) => (
        <span key={s} className={`journey-bar__seg${i <= at ? ' journey-bar__seg--on' : ''}${i === at ? ' journey-bar__seg--now' : ''}`} />
      ))}
    </span>
  );
}
