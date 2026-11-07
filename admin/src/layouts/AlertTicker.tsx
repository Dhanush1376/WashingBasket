import type { Dashboard } from '@/services';

export function AlertTicker({ d }: { d?: Dashboard }) {
  const overdue = d?.orders.overdue ?? 5;
  const pending = d?.pendingRequests ?? 7;
  const urgentTickets = d?.openTickets ?? 2;
  const items = [
    `ATTENTION: ${overdue} orders past delivery date (review WB1030 & WB1028)`,
    `PICKUPS: ${pending} requests waiting for confirmation`,
    `CAPACITY: Express delivery slot 4 PM – 6 PM in NIT Jalandhar campus is 90% full`,
    `WEATHER NOTICE: Rain forecast today — ensure waterproof bagging for deliveries`,
    `OFFERS: Coupon "WELCOME50" active — 13 new customer bookings today`,
    `SUPPORT: ${urgentTickets} customer tickets waiting for reply`,
  ];
  const fullText = items.join('     •     ');

  return (
    <div className="alert-ticker" role="region" aria-label="Operational broadcast">
      <div className="alert-ticker__track">
        <div className="alert-ticker__content">
          <span>{fullText}</span>
          <span aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{fullText}</span>
        </div>
      </div>
    </div>
  );
}
