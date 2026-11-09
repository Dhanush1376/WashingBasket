import { useState } from 'react';

import { dayDate, money } from '@/lib/format';

type Day = { date: string; count: number; revenue: number };

export function RevenueChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState(days.length - 1);
  const max = Math.max(1000, ...days.map((d) => d.revenue));
  const steps = 4;
  const rawStep = max / steps;
  const step = Math.ceil(rawStep / 500) * 500 || 500;
  const top = step * steps;
  const current = days[active] ?? days[days.length - 1] ?? { count: 0, date: new Date().toISOString(), revenue: 0 };

  const width = 600;
  const height = 140;
  const paddingX = 20;
  const paddingY = 16;
  const plotW = width - paddingX * 2;
  const plotH = height - paddingY * 2;

  const points = days.map((d, i) => {
    const x = paddingX + (i / Math.max(1, days.length - 1)) * plotW;
    const y = height - paddingY - (d.revenue / top) * plotH;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div className="chart chart--revenue">
      <div className="chart__readout" aria-live="polite">
        <strong className="num">{money(current.revenue)}</strong> earned on {dayDate(current.date)}
        <span className="muted"> · {current.count} {current.count === 1 ? 'order' : 'orders'}</span>
      </div>
      <div className="chart__plot chart__plot--line">
        <div className="chart__grid" aria-hidden>
          {Array.from({ length: steps + 1 }, (_, i) => {
            const val = top - step * i;
            return (
              <span key={i} className="chart__gridline">
                <span className="chart__tick num">₹{val >= 1000 ? `${(val / 1000).toFixed(val % 1000 ? 1 : 0)}k` : val}</span>
              </span>
            );
          })}
        </div>

        <div className="chart__svg-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} className="chart__svg" preserveAspectRatio="none">
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A1C3E" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#0A1C3E" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#revGrad)" />
            <path d={pathD} fill="none" stroke="#0A1C3E" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => {
              const isToday = i === days.length - 1;
              const isActive = i === active;
              return (
                <circle
                  key={p.date}
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 6 : isToday ? 5 : 3.5}
                  fill={isToday ? '#FFA742' : isActive ? '#0A1C3E' : '#FFFFFF'}
                  stroke={isToday ? '#FFA742' : '#0A1C3E'}
                  strokeWidth={isActive || isToday ? 2.5 : 1.8}
                />
              );
            })}
          </svg>

          <div className="chart__interactive-overlay">
            {days.map((d, i) => {
              const isToday = i === days.length - 1;
              return (
                <button
                  key={d.date}
                  type="button"
                  className={`chart__line-btn${i === active ? ' chart__line-btn--on' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-label={`${dayDate(d.date)}: ${money(d.revenue)}`}
                >
                  <span className="chart__label">{isToday ? 'Today' : new Date(`${d.date}T12:00:00`).getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
