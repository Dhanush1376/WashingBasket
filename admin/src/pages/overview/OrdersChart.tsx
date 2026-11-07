import { useState } from 'react';

import { dayDate, money } from '@/lib/format';

type Day = { date: string; count: number; revenue: number };

/** Simple bars, one per day; hover or focus a bar to read its numbers. Today is orange. */
export function OrdersChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.count));
  const steps = max <= 4 ? max : 4;
  const top = Math.ceil(max / steps) * steps;
  const current = days[active] ?? days[days.length - 1] ?? { count: 0, date: new Date().toISOString(), revenue: 0 };

  return (
    <div className="chart">
      <div className="chart__readout" aria-live="polite">
        <strong className="num">{current.count}</strong> {current.count === 1 ? 'order' : 'orders'} on {dayDate(current.date)}
        <span className="muted"> · {money(current.revenue)}</span>
      </div>
      <div className="chart__plot">
        <div className="chart__grid" aria-hidden>
          {Array.from({ length: steps + 1 }, (_, i) => (
            <span key={i} className="chart__gridline">
              <span className="chart__tick num">{Math.round(top - (top / steps) * i)}</span>
            </span>
          ))}
        </div>
        <div className="chart__bars" role="list" aria-label="Orders per day">
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <button
                key={d.date}
                type="button"
                role="listitem"
                className={`chart__col${i === active ? ' chart__col--on' : ''}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${dayDate(d.date)}: ${d.count} orders, ${money(d.revenue)}`}
              >
                <span className="chart__bar-wrap">
                  <span className={`chart__bar${isToday ? ' chart__bar--today' : ''}`} style={{ height: `${(d.count / top) * 100}%` }} />
                </span>
                <span className="chart__label">{isToday ? 'Today' : new Date(`${d.date}T12:00:00`).getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
