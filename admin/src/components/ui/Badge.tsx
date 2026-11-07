import type { Tone } from '@/lib/status';

/** The customer app's status badge: a soft tinted pill with a dot. */
export function StatusBadge({ label, tone, size = 'md' }: { label: string; tone: Tone; size?: 'md' | 'sm' }) {
  return (
    <span className={`badge badge--${size}`} style={{ color: tone.fg, background: tone.bg }}>
      <span className="badge__dot" style={{ background: tone.fg }} aria-hidden />
      {label}
    </span>
  );
}

/** A small neutral label, e.g. "Hidden" or "Default". */
export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'orange' | 'navy' | 'dark' }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}
