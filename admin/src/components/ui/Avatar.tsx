import { useState } from 'react';

import { initials } from '@/lib/format';

/** Round avatar: the customer's photo if there is one, otherwise initials on the brand orange (as in the customer app). */
export function Avatar({ name, url, size = 36, tone = 'orange' }: { name: string; url?: string; size?: number; tone?: 'orange' | 'navy' | 'stone' }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`avatar avatar--${tone}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {url && !failed ? <img src={url} alt="" width={size} height={size} onError={() => setFailed(true)} /> : initials(name)}
    </span>
  );
}
