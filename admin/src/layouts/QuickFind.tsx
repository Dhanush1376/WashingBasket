import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';

import { Icon } from '@/components/ui/Icon';
import { matches } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { customersApi, ordersApi, requestsApi } from '@/services';

type Hit = { id: string; kind: 'Customer' | 'Order' | 'Pickup'; title: string; detail: string; to: string };

/** One box to find any customer, order or pickup by name, phone or number. Press / or ⌘K to jump to it. */
export function QuickFind() {
  const [q, setQ] = useState('');
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const customers = useQuery('customers', customersApi.listCustomers);
  const orders = useQuery('orders', ordersApi.listOrders);
  const requests = useQuery('requests', requestsApi.listRequests);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if ((e.key === '/' || isCmdK) && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const c = (customers.data ?? [])
      .filter((x) => matches(q, x.fullName, x.phone, x.email, x.id))
      .slice(0, 4)
      .map((x) => ({ id: x.id, kind: 'Customer' as const, title: x.fullName, detail: `${x.phone} · ${x.area}`, to: `/customers?open=${x.id}` }));
    const o = (orders.data ?? [])
      .filter((x) => matches(q, x.id, x.customerName))
      .slice(0, 4)
      .map((x) => ({ id: x.id, kind: 'Order' as const, title: `Order ${x.id}`, detail: `${x.customerName} · ${x.serviceName}`, to: `/orders?open=${x.id}` }));
    const r = (requests.data ?? [])
      .filter((x) => matches(q, x.id))
      .slice(0, 3)
      .map((x) => ({ id: x.id, kind: 'Pickup' as const, title: `Pickup ${x.id}`, detail: `${x.customerName} · ${x.serviceName}`, to: `/pickups?open=${x.id}` }));
    return [...c, ...o, ...r];
  }, [q, customers.data, orders.data, requests.data]);

  const go = (hit: Hit) => {
    navigate(hit.to);
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div className="quickfind">
      <Icon name="search" size={15} className="quickfind__icon" />
      <input
        ref={input}
        className="quickfind__input"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        placeholder={narrow ? 'Search…' : 'Search customers, orders, pickups…'}
        aria-label="Find a customer, order or pickup"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(hits.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && hits[active]) {
            e.preventDefault();
            go(hits[active]);
          } else if (e.key === 'Escape') {
            setQ('');
            setOpen(false);
          }
        }}
      />
      <kbd className="quickfind__kbd" aria-hidden title="Press / or ⌘K to search">
        <span className="quickfind__kbd-cmd">⌘</span>K
      </kbd>
      {showList ? (
        <ul className="quickfind__list" id={listId} role="listbox" aria-label="Matches">
          {hits.length ? (
            hits.map((h, i) => (
              <li
                key={`${h.kind}-${h.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`quickfind__hit${i === active ? ' quickfind__hit--on' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(h);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className={`quickfind__kind quickfind__kind--${h.kind.toLowerCase()}`}>{h.kind}</span>
                <span className="quickfind__text">
                  <strong>{h.title}</strong>
                  <span>{h.detail}</span>
                </span>
              </li>
            ))
          ) : (
            <li className="quickfind__none" role="option" aria-selected={false} aria-disabled>
              Nothing matches “{q.trim()}”. Try a name, phone number or order number like WB1024.
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** True on phones, where the search box is too small for the full hint. */
const PHONE = '(max-width: 767px)';
function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(PHONE);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(PHONE).matches,
  );
}
