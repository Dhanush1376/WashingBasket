import { useMemo, useState, type ReactNode } from 'react';

import { Icon } from './Icon';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Makes the column sortable by this value. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Hide on tablets (under 1100px) to keep the table readable. */
  hideOnTablet?: boolean;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** What a row looks like as a card on phones, where a table would need sideways scrolling. */
  mobileCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  /** Read out for each clickable row, e.g. "Open order WB1024". */
  rowLabel?: (row: T) => string;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  caption: string;
  selectedKey?: string | null;
};

/**
 * One table for every list in the portal: sortable headers, pages of ten, clickable rows,
 * and on phones each row becomes a card instead of a squeezed table.
 */
export function DataTable<T>({ rows, columns, rowKey, mobileCard, onRowClick, rowLabel, pageSize = 10, page: pageProp, onPageChange, initialSort, empty, caption, selectedKey }: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [ownPage, setOwnPage] = useState(1);
  const page = pageProp ?? ownPage;
  const setPage = onPageChange ?? setOwnPage;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true });
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  if (!rows.length) return <>{empty}</>;

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const activate = (row: T) => onRowClick?.(row);

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  style={{ width: c.width, textAlign: c.align ?? 'left' }}
                  className={c.hideOnTablet ? 'hide-tablet' : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className={`th-sort${active ? ' th-sort--on' : ''}`} onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <Icon name={active && sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={13} strokeWidth={2.2} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={`${onRowClick ? 'tr--click' : ''}${selectedKey === key ? ' tr--selected' : ''}`}
                onClick={onRowClick ? () => activate(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          activate(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }} className={c.hideOnTablet ? 'hide-tablet' : undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="cards-list" aria-label={caption}>
        {visible.map((row) => (
          <li key={rowKey(row)}>
            {onRowClick ? (
              <button type="button" className="row-card" onClick={() => activate(row)} aria-label={rowLabel?.(row)}>
                {mobileCard(row)}
                <Icon name="chevronRight" size={18} className="row-card__chevron" />
              </button>
            ) : (
              <div className="row-card">{mobileCard(row)}</div>
            )}
          </li>
        ))}
      </ul>

      {sorted.length > pageSize ? <Pagination page={current} pages={pages} total={sorted.length} pageSize={pageSize} onChange={setPage} /> : null}
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onChange }: { page: number; pages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label="Pages">
      <span className="pagination__info">
        Showing <strong>{from}–{to}</strong> of {total}
      </span>
      <div className="pagination__buttons">
        <button type="button" className="pagination__btn" onClick={() => onChange(page - 1)} disabled={page <= 1}>
          <Icon name="chevronLeft" size={16} /> Previous
        </button>
        <span className="pagination__page" aria-current="page">
          Page {page} of {pages}
        </span>
        <button type="button" className="pagination__btn" onClick={() => onChange(page + 1)} disabled={page >= pages}>
          Next <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </nav>
  );
}
