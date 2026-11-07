import { useMemo, useState } from 'react';

import { OfferTicket } from '@/components/domain/OfferTicket';
import { StatusBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MiniSwitch } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { useUrlState } from '@/hooks/useUrlState';
import { date, matches } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { OFFER_STATUS } from '@/lib/status';
import { catalogApi, offersApi } from '@/services';
import type { AdminOffer } from '@/types';
import { OfferEditor } from './OfferEditor';

type Filter = 'all' | 'active' | 'upcoming' | 'expired' | 'hidden';

export default function OffersPage() {
  const offers = useQuery('offers', offersApi.listOffers);
  const services = useQuery('services', catalogApi.listServices);
  const [filter, setFilter] = useUrlState<Filter>('show', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [isNew, setNew] = useUrlState('new', '');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminOffer | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { run, isBusy } = useAction();
  const { show: showToast } = useToast();

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast('success', 'Promo code copied', code);
    window.setTimeout(() => setCopiedCode((curr) => (curr === code ? null : curr)), 1800);
  };

  const all = offers.data ?? [];

  // Metrics for header
  const runningCount = useMemo(() => all.filter((o) => o.visible && o.status === 'active').length, [all]);
  const upcomingCount = useMemo(() => all.filter((o) => o.visible && o.status === 'upcoming').length, [all]);
  const endedCount = useMemo(() => all.filter((o) => o.visible && o.status === 'expired').length, [all]);
  const hiddenCount = useMemo(() => all.filter((o) => !o.visible).length, [all]);

  // Filtered rows
  const rows = useMemo(() => {
    return all.filter((o) => {
      // Status filter
      if (filter === 'hidden') {
        if (o.visible) return false;
      } else if (filter !== 'all') {
        if (!o.visible || o.status !== filter) return false;
      }

      // Search filter
      return matches(q, o.title, o.description, o.code, o.discountBadge, o.discountValue, o.badgeLabel, o.eligibility);
    });
  }, [all, filter, q]);

  const resetAll = () => {
    setFilter('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || q.trim() !== '';

  const editing = editId ? all.find((o) => o.id === editId) ?? null : null;
  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name ?? id;
  const visibleIndex = (o: AdminOffer) => all.filter((x) => x.visible).findIndex((x) => x.id === o.id);

  return (
    <div className="page customers-page">
      {/* ── 1. Page Header with Customers Page Single-Line Stats Bar ── */}
      <PageHeader
        title="Offers"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              <strong>{all.length}</strong> Total Offers
            </span>
            <span className="customers-header-stat customers-header-stat--green">
              <span className="customers-stats-dot customers-stats-dot--green" />
              <strong>{runningCount}</strong> Running
            </span>
            <span className="customers-header-stat customers-header-stat--orange">
              <span className="customers-stats-dot customers-stats-dot--orange" />
              <strong>{upcomingCount}</strong> Starts Soon
            </span>
            <span className="customers-header-stat customers-header-stat--blue">
              <span className="customers-stats-dot customers-stats-dot--muted" />
              <strong>{endedCount}</strong> Ended
            </span>
            {hiddenCount > 0 ? (
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--muted" />
                <strong>{hiddenCount}</strong> Hidden
              </span>
            ) : null}
          </div>
        }
        actions={
          <Button variant="accent" icon="plus" onClick={() => setNew('1')}>
            Add offer
          </Button>
        }
      />

      {/* ── 2. Sticky Action Card (Search & Filter Pills 1:1 with Customers Page) ── */}
      <div className="customers-sticky-bar-wrapper">
        <div className="customers-action-card">
          <div className="customers-action-bar">
            {/* Search Box */}
            <div className="customers-search-box">
              <Icon name="search" size={17} className="customers-search-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search offers by title, code, or discount..."
                className="customers-search-input"
                aria-label="Search offers"
              />
              {q ? (
                <button
                  type="button"
                  className="customers-search-clear"
                  onClick={() => setQ('')}
                  aria-label="Clear search"
                >
                  <Icon name="x" size={13} />
                </button>
              ) : null}
            </div>

            {/* Controls */}
            <div className="customers-action-controls">
              <FilterPills<Filter>
                label="Show offers"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All', count: all.length },
                  { value: 'active', label: 'Running', count: runningCount },
                  { value: 'upcoming', label: 'Starts soon', count: upcomingCount },
                  { value: 'expired', label: 'Ended', count: endedCount },
                  { value: 'hidden', label: 'Hidden', count: hiddenCount },
                ]}
              />

              {hasActiveFilters ? (
                <button
                  type="button"
                  className="btn btn--subtle btn--sm"
                  onClick={resetAll}
                  style={{ flexShrink: 0 }}
                >
                  <Icon name="x" size={13} /> Reset
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Offer Tickets Grid ── */}
      <QueryView
        query={offers}
        skeleton={
          <div className="offer-grid">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={340} radius={20} />
            ))}
          </div>
        }
      >
        {() =>
          rows.length ? (
            <ol className="offer-grid" style={{ marginTop: 16 }}>
              {rows.map((o) => {
                const pos = all.findIndex((x) => x.id === o.id);
                return (
                  <li key={o.id}>
                    <Card className={`offer-card${o.visible ? '' : ' offer-card--hidden'}`} padded={false}>
                      <div className="offer-card__stage">
                        <OfferTicket offer={o} index={Math.max(0, visibleIndex(o))} width={300} faded={!o.visible} />
                        {!o.visible ? <span className="offer-card__hidden-tag">Hidden from customers</span> : null}
                      </div>
                      <div className="offer-card__body">
                        <div className="offer-card__header-row">
                          <StatusBadge size="sm" {...OFFER_STATUS[o.status]} />
                          <span className="offer-card__position-badge">
                            <span className="offer-card__position-num">#{pos + 1}</span> on app
                          </span>
                        </div>
                        <div className="offer-card__main-info">
                          <h3 className="offer-card__title">{o.title}</h3>
                          <p className="offer-card__desc">{o.description}</p>
                        </div>
                        {o.code ? (
                          <div className="offer-card__coupon-box">
                            <Icon name="tag" size={11} color="#EA580C" />
                            <span className="offer-card__coupon-label">CODE:</span>
                            <code className="offer-card__coupon-code">{o.code}</code>
                            <button
                              type="button"
                              className={`offer-card__coupon-copy${copiedCode === o.code ? ' offer-card__coupon-copy--copied' : ''}`}
                              title="Copy coupon code"
                              onClick={() => copyCode(o.code!)}
                            >
                              <Icon name={copiedCode === o.code ? 'check' : 'copy'} size={11} />
                              <span>{copiedCode === o.code ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        ) : null}
                        <div className="offer-card__meta-chips">
                          <span className="offer-meta-chip offer-meta-chip--audience" title="Customer eligibility">
                            <Icon name="users" size={12} />
                            <span>{o.eligibility}</span>
                          </span>
                          <span className="offer-meta-chip offer-meta-chip--service" title="Applicable services">
                            <Icon name="bag" size={12} />
                            <span>{o.serviceIds === 'all' ? 'All services' : o.serviceIds.map(serviceName).join(', ')}</span>
                          </span>
                        </div>
                        <div className="offer-card__validity">
                          <Icon name="calendar" size={13} className="offer-card__validity-icon" />
                          <span className="offer-card__validity-text">
                            Valid: <strong>{date(o.validFrom)}</strong> &ndash; <strong>{date(o.validUntil)}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="offer-card__actions">
                        <label className="row offer-card__visible">
                          <MiniSwitch
                            checked={o.visible}
                            label={o.visible ? `Hide ${o.title}` : `Show ${o.title}`}
                            disabled={isBusy(`vis-${o.id}`)}
                            onChange={(v) => run(`vis-${o.id}`, () => offersApi.setOfferVisible(o.id, v), v ? 'Offer is visible to customers' : 'Offer hidden from customers')}
                          />
                          <span className="small">{o.visible ? 'Shown' : 'Hidden'}</span>
                        </label>
                        <span className="grow" />
                        <IconButton icon="arrowUp" label="Move earlier" disabled={pos === 0 || filter !== 'all'} onClick={() => run(`mv-${o.id}`, () => offersApi.moveOffer(o.id, -1), 'Order updated')} size={36} />
                        <IconButton icon="arrowDown" label="Move later" disabled={pos === all.length - 1 || filter !== 'all'} onClick={() => run(`mv-${o.id}`, () => offersApi.moveOffer(o.id, 1), 'Order updated')} size={36} />
                        <IconButton icon="edit" label={`Edit ${o.title}`} onClick={() => setEditId(o.id)} size={36} />
                        <IconButton icon="trash" tone="danger" label={`Delete ${o.title}`} onClick={() => setDeleting(o)} size={36} />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div style={{ marginTop: 16 }}>
              <Card>
                <EmptyState
                  icon="tag"
                  title={filter === 'all' && !q ? 'No offers yet' : 'No offers match'}
                  message={filter === 'all' && !q ? 'Add your first offer and it will appear on the customer app’s Offers page.' : 'Try adjusting your search terms or clearing the filter pills.'}
                  action={
                    hasActiveFilters ? (
                      <Button variant="outline" size="sm" onClick={resetAll}>
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="accent" icon="plus" onClick={() => setNew('1')}>
                        Add offer
                      </Button>
                    )
                  }
                />
              </Card>
            </div>
          )
        }
      </QueryView>

      {filter !== 'all' && rows.length > 1 ? <p className="muted small" style={{ marginTop: 12 }}>To change the display order, switch to &ldquo;All&rdquo;.</p> : null}

      {isNew || editing ? (
        <OfferEditor
          offer={editing}
          nextIndex={all.filter((o) => o.visible).length}
          onClose={() => {
            setNew('');
            setEditId(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this offer?"
        message={
          <>
            <strong>{deleting?.title}</strong> will disappear from the customer app straight away. If you only want to pause it, use <strong>Hide</strong> instead.
          </>
        }
        confirmLabel="Delete offer"
        loading={isBusy('delete')}
        onConfirm={async () => {
          if (!deleting) return;
          await run('delete', () => offersApi.deleteOffer(deleting.id), 'Offer deleted');
          setDeleting(null);
        }}
      />
    </div>
  );
}
