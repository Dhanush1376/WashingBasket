import { useMemo, useState } from 'react';

import { JourneyBar } from '@/components/domain/OrderJourney';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { dayDate, matches, money, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { ORDER_STATUS, PAYMENT_STATUS } from '@/lib/status';
import { catalogApi, ordersApi, type OrderRow } from '@/services';
import { ORDER_STAGES, type OrderStatus } from '@/types';
import { OrderDrawer } from './OrderDrawer';

type Group = 'all' | 'active' | 'ready' | 'completed' | 'cancelled';

const isActive = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';

function exportOrdersToCsv(data: OrderRow[]) {
  if (!data.length) return;
  const headers = [
    'Order ID',
    'Customer Name',
    'Service',
    'Status',
    'Items',
    'Amount (INR)',
    'Payment Status',
    'Placed At',
    'Estimated Delivery',
    'Delivered At',
  ];
  const csvRows = data.map((o) => [
    `"${o.id}"`,
    `"${o.customerName.replace(/"/g, '""')}"`,
    `"${o.serviceName.replace(/"/g, '""')}"`,
    `"${o.status}"`,
    `"${o.itemsLabel}"`,
    o.total,
    `"${o.payment.status}"`,
    `"${o.placedAt}"`,
    `"${o.estimatedDelivery}"`,
    `"${o.deliveredAt || ''}"`,
  ]);
  const content = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `washing-basket-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function OrdersPage() {
  const orders = useQuery('orders', ordersApi.listOrders);
  const services = useQuery('services', catalogApi.listServices);
  const [filter, setFilter] = useUrlState<Group>('status', 'all');
  const [service, setService] = useUrlState('service', 'any');
  const [step, setStep] = useUrlState<string>('step', 'any');
  const [q, setQ] = useUrlState('q', '');
  const [openId, setOpenId] = useUrlState('open', '');
  const [viewMode, setViewMode] = useViewMode('view', 'table');
  const [page, setPage] = usePageParam();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const all = orders.data ?? [];

  // Metrics
  const activeCount = useMemo(() => all.filter((o) => isActive(o.status)).length, [all]);
  const readyOrDueCount = useMemo(
    () => all.filter((o) => o.status === 'out_for_delivery' || o.status === 'ironing' || o.status === 'packing').length,
    [all],
  );
  const deliveredCount = useMemo(() => all.filter((o) => o.status === 'delivered').length, [all]);
  const cancelledCount = useMemo(() => all.filter((o) => o.status === 'cancelled').length, [all]);
  const totalRevenue = useMemo(() => all.filter((o) => o.payment.status === 'paid').reduce((sum, o) => sum + o.total, 0), [all]);
  const paidCount = useMemo(() => all.filter((o) => o.payment.status === 'paid').length, [all]);

  // Filtered rows
  const rows = useMemo(() => {
    return all.filter((o) => {
      // Group filter
      if (filter === 'active' && !isActive(o.status)) return false;
      if (filter === 'ready' && o.status !== 'out_for_delivery' && o.status !== 'packing') return false;
      if (filter === 'completed' && o.status !== 'delivered') return false;
      if (filter === 'cancelled' && o.status !== 'cancelled') return false;

      // Stage step filter
      if (step !== 'any' && o.status !== step) return false;

      // Service filter
      if (service !== 'any' && o.serviceId !== service) return false;

      // Text search
      return matches(q, o.id, o.customerName, o.serviceName, o.itemsLabel, o.requestId);
    });
  }, [all, filter, step, service, q]);

  const resetAll = () => {
    setFilter('all');
    setStep('any');
    setService('any');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || step !== 'any' || service !== 'any' || q.trim() !== '';

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );

  const columns: Column<OrderRow>[] = [
    {
      key: 'id',
      header: 'Order',
      sortValue: (o) => o.placedAt,
      render: (o) => (
        <div className="cell-main__text">
          <span className="cell-main__title" style={{ fontSize: 13.5, color: '#013E86', fontWeight: 700 }}>
            {o.id}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>{when(o.placedAt)}</span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer & Service',
      sortValue: (o) => o.customerName,
      render: (o) => (
        <div className="cell-main__text">
          <span className="cell-main__title" style={{ fontSize: 13.5 }}>{o.customerName}</span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>{o.serviceName}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Fulfillment Stage',
      sortValue: (o) => (o.status === 'cancelled' ? -1 : (ORDER_STAGES as readonly string[]).indexOf(o.status)),
      render: (o) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          <StatusBadge size="sm" {...ORDER_STATUS[o.status]} />
          <JourneyBar status={o.status} />
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Schedule / Delivery',
      sortValue: (o) => o.deliveredAt ?? o.estimatedDelivery,
      hideOnTablet: true,
      render: (o) =>
        o.status === 'delivered' && o.deliveredAt ? (
          <div className="cell-main__text">
            <span style={{ color: '#059669', fontWeight: 650, fontSize: 13 }}>Delivered</span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>{dayDate(o.deliveredAt)}</span>
          </div>
        ) : o.status === 'cancelled' ? (
          <span className="muted" style={{ fontSize: 12 }}>—</span>
        ) : (
          <div className="cell-main__text">
            <span
              style={{
                fontSize: 13,
                fontWeight: 650,
                color: o.estimatedDelivery < new Date().toISOString().slice(0, 10) ? '#DC2626' : '#0A1C3E',
              }}
            >
              Due {dayDate(o.estimatedDelivery)}
            </span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
              {o.estimatedDelivery < new Date().toISOString().slice(0, 10) ? 'Overdue' : 'On schedule'}
            </span>
          </div>
        ),
    },
    {
      key: 'items',
      header: 'Count',
      hideOnTablet: true,
      render: (o) => (
        <span style={{ fontSize: 12.5, color: o.itemsLabel === 'Not counted yet' ? '#94A3B8' : '#334155', fontWeight: 550 }}>
          {o.itemsLabel}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Amount',
      align: 'right',
      sortValue: (o) => o.total,
      render: (o) => (
        <div className="cell-main__text" style={{ alignItems: 'flex-end' }}>
          <span className="cell-main__title num" style={{ fontSize: 13.5, fontWeight: 700 }}>{money(o.total)}</span>
          <span
            className="cell-main__sub"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: o.payment.status === 'paid' ? '#059669' : o.payment.status === 'pending' ? '#EA580C' : '#94A3B8',
            }}
          >
            {PAYMENT_STATUS[o.payment.status].label}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="Open order details">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  return (
    <div className="page customers-page">
      {/* ── 1. Page Header with Single-Line Live Stats Bar ── */}
      <PageHeader
        title="Orders"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              <strong>{all.length}</strong> Total Orders
            </span>
            <span className="customers-header-stat customers-header-stat--orange">
              <span className="customers-stats-dot customers-stats-dot--orange" />
              <strong>{activeCount}</strong> In Progress
            </span>
            <span className="customers-header-stat customers-header-stat--green">
              <span className="customers-stats-dot customers-stats-dot--green" />
              <strong>{deliveredCount}</strong> Delivered
            </span>
            {cancelledCount > 0 ? (
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--muted" />
                <strong>{cancelledCount}</strong> Cancelled
              </span>
            ) : null}
          </div>
        }
      />

      <QueryView query={orders} skeleton={<OrdersSkeleton />}>
        {() => (
          <div className="overview-layout">
            {/* ── 2. Unified 4-Segment KPI Stats Bar (1:1 with Customers Page) ── */}
            <div className="customers-stats-bar" role="region" aria-label="Orders summary statistics bar">
              {/* Segment 1: Dark Navy - Live Active Orders */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'active' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
                title="Filter active orders currently being processed"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--dark">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Live workload
                  </span>
                  <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                    <Icon name="truck" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value overview-sub-card__value--white">{activeCount}</span>
                  <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                    {activeCount > 0 ? (
                      <span className="overview-sub-card__alert">{activeCount} live processing & in-flight</span>
                    ) : (
                      'All orders completed'
                    )}
                  </span>
                </div>
              </button>

              {/* Segment 2: Orange - Scheduled & Ready */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'ready' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'ready' ? 'all' : 'ready')}
                title="Filter orders packed or ready for delivery"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--orange">Awaiting delivery</span>
                  <span className="overview-sub-card__icon-circle" aria-hidden>
                    <Icon name="clock" size={16} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{readyOrDueCount}</span>
                  <span className="overview-sub-card__caption">
                    {readyOrDueCount > 0 ? `${readyOrDueCount} packed & ready` : 'No packed orders'}
                  </span>
                </div>
              </button>

              {/* Segment 3: Light - Delivered Orders */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'completed' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
                title="Filter delivered orders"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--light">
                    <span className="overview-tag__dot overview-tag__dot--blue" />
                    Delivered
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="check" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{deliveredCount}</span>
                  <span className="overview-sub-card__caption">
                    {deliveredCount > 0 ? `${deliveredCount} fulfilled successfully` : 'No orders delivered'}
                  </span>
                </div>
              </button>

              {/* Segment 4: Light - Revenue Paid Volume */}
              <button
                type="button"
                className="customers-stats-bar__item customers-stats-bar__item--light"
                onClick={resetAll}
                title="View total order revenue volume"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--success">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Paid volume
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="wallet" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(totalRevenue)}</span>
                  <span className="overview-sub-card__trend">
                    <Icon name="wallet" size={12} />
                    {paidCount} paid transactions
                  </span>
                </div>
              </button>
            </div>

            {/* ── 3. Standalone Sticky Action Bar Card (1:1 with Customers Page) ── */}
            <div className="customers-sticky-bar-wrapper">
              <div className="customers-action-card">
                <div className="customers-action-bar">
                  <div className="customers-search-box">
                    <Icon name="search" size={17} className="customers-search-icon" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search orders by ID, customer name, service..."
                      className="customers-search-input"
                      aria-label="Search orders"
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

                  <div className="customers-action-controls">
                    {/* Filters Toggle Button */}
                    <button
                      type="button"
                      className={`customers-ctrl-btn customers-ctrl-btn--filters${showFilterPanel || hasActiveFilters ? ' is-active' : ''}`}
                      onClick={() => setShowFilterPanel(!showFilterPanel)}
                      title="Filter orders"
                      aria-label="Filter orders"
                      aria-expanded={showFilterPanel}
                    >
                      <Icon name="sliders" size={16} />
                      <span className="customers-ctrl-btn__label">Filters</span>
                      {hasActiveFilters ? <span className="customers-filter-count-badge">!</span> : null}
                    </button>

                    {/* View Switcher: Table vs Cards Grid */}
                    <div className="customers-view-toggle" role="group" aria-label="View layout">
                      <button
                        type="button"
                        className={`customers-view-toggle__btn${viewMode === 'table' ? ' is-active' : ''}`}
                        onClick={() => setViewMode('table')}
                        title="Table view"
                        aria-pressed={viewMode === 'table'}
                      >
                        <Icon name="list" size={15} />
                        <span className="customers-view-toggle__label">Table</span>
                      </button>
                      <button
                        type="button"
                        className={`customers-view-toggle__btn${viewMode === 'grid' ? ' is-active' : ''}`}
                        onClick={() => setViewMode('grid')}
                        title="Card grid view"
                        aria-pressed={viewMode === 'grid'}
                      >
                        <Icon name="grid" size={15} />
                        <span className="customers-view-toggle__label">Cards</span>
                      </button>
                    </div>

                    {/* Export Button */}
                    <button
                      type="button"
                      className="customers-ctrl-btn customers-ctrl-btn--export"
                      onClick={() => exportOrdersToCsv(rows)}
                      title="Export filtered orders to CSV"
                    >
                      <Icon name="download" size={15} />
                      <span className="customers-ctrl-btn__label">Export</span>
                    </button>
                  </div>
                </div>

                {/* Quick Filter Drawer */}
                {showFilterPanel ? (
                  <div className="customers-filter-drawer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                      <FilterPills<Group>
                        label="Filter orders by stage"
                        value={filter}
                        onChange={(v) => setFilter(v)}
                        options={[
                          { value: 'all', label: 'All', count: all.length },
                          { value: 'active', label: 'In progress', count: activeCount },
                          { value: 'ready', label: 'Ready / Delivery', count: readyOrDueCount },
                          { value: 'completed', label: 'Delivered', count: deliveredCount },
                          { value: 'cancelled', label: 'Cancelled', count: cancelledCount },
                        ]}
                      />
                      {hasActiveFilters ? (
                        <button type="button" className="btn btn--subtle btn--sm" onClick={resetAll} style={{ flexShrink: 0, marginLeft: 'auto' }}>
                          <Icon name="x" size={13} /> Reset
                        </button>
                      ) : null}
                    </div>

                    {/* Secondary filters row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Specific stage:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        <button
                          type="button"
                          className={`chip${step === 'any' ? ' chip--on' : ''}`}
                          onClick={() => setStep('any')}
                          style={{ fontSize: 11.5, padding: '3px 8px' }}
                        >
                          Any stage
                        </button>
                        {ORDER_STAGES.filter((s) => s !== 'delivered').map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`chip${step === s ? ' chip--on' : ''}`}
                            onClick={() => setStep(step === s ? 'any' : s)}
                            style={{ fontSize: 11.5, padding: '3px 8px' }}
                          >
                            {ORDER_STATUS[s].label}
                          </button>
                        ))}
                      </div>

                      {services.data?.length ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Service:</span>
                          <select
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            style={{
                              fontSize: 12,
                              padding: '4px 8px',
                              borderRadius: 6,
                              border: '1px solid #CBD5E1',
                              background: '#FFFFFF',
                              color: '#0A1C3E',
                            }}
                          >
                            <option value="any">All services</option>
                            {services.data.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── 4. Main Orders Directory Card (Table or Grid View) ── */}
            <Card className="customers-directory-card" padded={false}>
              {viewMode === 'table' ? (
                <>
                  <div className="customers-table-scroll-hint" aria-hidden>
                    <Icon name="arrowRight" size={13} />
                    <span>Swipe horizontally for full table</span>
                  </div>
                  <DataTable
                    caption="Orders directory"
                    rows={rows}
                    columns={columns}
                    rowKey={(o) => o.id}
                    onRowClick={(o) => setOpenId(o.id)}
                    rowLabel={(o) => `Open order ${o.id} for ${o.customerName}`}
                    selectedKey={openId || null}
                    page={page}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    mobileCard={(o) => (
                      <div className="customer-grid-card customer-grid-card--mobile-row">
                        <div className="customer-grid-card__header">
                          <div className="customer-grid-card__user">
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: '#EEF4FF',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#013E86',
                                flexShrink: 0,
                              }}
                            >
                              <Icon name="bag" size={17} />
                            </div>
                            <div className="customer-grid-card__info">
                              <div className="customer-grid-card__name">{o.id} &bull; {o.customerName}</div>
                              <div className="customer-grid-card__phone">{o.serviceName} &bull; {o.itemsLabel}</div>
                            </div>
                          </div>
                          <StatusBadge size="sm" {...ORDER_STATUS[o.status]} />
                        </div>

                        <div style={{ margin: '6px 0 8px 0' }}>
                          <JourneyBar status={o.status} />
                        </div>

                        <div className="customer-grid-card__footer">
                          <div className="customer-grid-card__orders">
                            {o.status === 'delivered' ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>Delivered</span>
                            ) : o.status === 'cancelled' ? (
                              <span style={{ color: '#94A3B8' }}>Cancelled</span>
                            ) : (
                              <span style={{ color: '#EA580C', fontWeight: 600 }}>Due {dayDate(o.estimatedDelivery)}</span>
                            )}
                          </div>
                          <div className="customer-grid-card__wallet">
                            <span style={{ fontSize: 11, color: '#64748B', marginRight: 3 }}>
                              {PAYMENT_STATUS[o.payment.status].label}
                            </span>
                            {money(o.total)}
                          </div>
                        </div>
                      </div>
                    )}
                    empty={
                      <EmptyState
                        icon="bag"
                        title="No orders match"
                        message={
                          hasActiveFilters
                            ? 'No orders match your current filters. Click reset to see all.'
                            : 'No orders recorded yet.'
                        }
                        action={
                          hasActiveFilters ? (
                            <button type="button" className="btn btn--subtle" onClick={resetAll}>
                              Clear filters
                            </button>
                          ) : undefined
                        }
                      />
                    }
                  />
                </>
              ) : (
                <>
                  {rows.length === 0 ? (
                    <div className="customers-grid-empty">
                      <EmptyState
                        icon="bag"
                        title="No orders match"
                        message={
                          hasActiveFilters
                            ? 'No orders match your current filters. Click reset to see all.'
                            : 'No orders recorded yet.'
                        }
                        action={
                          hasActiveFilters ? (
                            <button type="button" className="btn btn--subtle" onClick={resetAll}>
                              Clear filters
                            </button>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : (
                    <>
                      <div className="customers-grid-view">
                        {pagedRows.map((o) => (
                          <div
                            key={o.id}
                            className="customer-grid-card"
                            onClick={() => setOpenId(o.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpenId(o.id);
                              }
                            }}
                          >
                            <div className="customer-grid-card__header">
                              <div className="customer-grid-card__user">
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 10,
                                    background: '#EEF4FF',
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: '#013E86',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Icon name="bag" size={18} />
                                </div>
                                <div className="customer-grid-card__info">
                                  <div className="customer-grid-card__name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>{o.id}</span>
                                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>&bull; {when(o.placedAt)}</span>
                                  </div>
                                  <div className="customer-grid-card__phone">{o.customerName}</div>
                                </div>
                              </div>
                              <StatusBadge size="sm" {...ORDER_STATUS[o.status]} />
                            </div>

                            <div style={{ margin: '8px 0 10px 0' }}>
                              <JourneyBar status={o.status} />
                            </div>

                            <div className="customer-grid-card__details">
                              <span className="customer-grid-card__area" title={o.serviceName}>
                                <Icon name="shirt" size={12} /> {o.serviceName}
                              </span>
                              <span style={{ fontSize: 11.5, color: '#64748B' }}>
                                {o.itemsLabel}
                              </span>
                            </div>

                            <div className="customer-grid-card__footer">
                              <div className="customer-grid-card__orders">
                                {o.status === 'delivered' && o.deliveredAt ? (
                                  <span style={{ color: '#059669', fontWeight: 600 }}>Delivered {dayDate(o.deliveredAt)}</span>
                                ) : o.status === 'cancelled' ? (
                                  <span style={{ color: '#94A3B8' }}>Cancelled</span>
                                ) : (
                                  <span
                                    style={{
                                      color: o.estimatedDelivery < new Date().toISOString().slice(0, 10) ? '#DC2626' : '#EA580C',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Due {dayDate(o.estimatedDelivery)}
                                  </span>
                                )}
                              </div>
                              <div className="customer-grid-card__wallet">
                                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginRight: 4 }}>
                                  {PAYMENT_STATUS[o.payment.status].label}
                                </span>
                                {money(o.total)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {rows.length > pageSize ? (
                        <Pagination
                          page={currentPage}
                          pages={pages}
                          total={rows.length}
                          pageSize={pageSize}
                          onChange={setPage}
                        />
                      ) : null}
                    </>
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </QueryView>

      {openId ? <OrderDrawer orderId={openId} onClose={() => setOpenId('')} /> : null}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="overview-layout" role="status" aria-label="Loading orders data">
      <div style={{ marginTop: 10 }}>
        <Skeleton height={124} radius={16} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Skeleton height={420} radius={14} />
      </div>
    </div>
  );
}
