import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CancelDialog } from '@/components/domain/CancelDialog';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { dayDate, matches, todayKey, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { REQUEST_STATUS } from '@/lib/status';
import { requestsApi, type RequestRow } from '@/services';
import type { RequestStatus } from '@/types';

type Filter = 'all' | RequestStatus;
type DateFilter = 'all' | 'today' | 'tomorrow';

function exportPickupsToCsv(data: RequestRow[]) {
  if (!data.length) return;
  const headers = [
    'Pickup ID',
    'Customer Name',
    'Service',
    'Pickup Date',
    'Time Slot',
    'Store Location',
    'Doorstep Address',
    'Status',
    'Order ID',
    'Customer Notes',
    'Created At',
  ];
  const csvRows = data.map((r) => [
    `"${r.id}"`,
    `"${r.customerName.replace(/"/g, '""')}"`,
    `"${r.serviceName.replace(/"/g, '""')}"`,
    `"${r.pickupDate}"`,
    `"${r.slotLabel}"`,
    `"Outside Campus (Model Town Store)"`,
    `"${r.addressLine.replace(/"/g, '""')}"`,
    `"${r.status}"`,
    `"${r.orderId || ''}"`,
    `"${(r.notes || '').replace(/"/g, '""')}"`,
    `"${r.createdAt}"`,
  ]);
  const content = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `washing-basket-pickups-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function PickupsSkeleton() {
  return (
    <div className="overview-layout">
      <Skeleton height={118} radius={18} />
      <Skeleton height={56} radius={14} />
      <Skeleton height={420} radius={18} />
    </div>
  );
}

export default function PickupsPage() {
  const requests = useQuery('requests', requestsApi.listRequests);
  const [filter, setFilter] = useUrlState<Filter>('status', 'all');
  const [dateFilter, setDateFilter] = useUrlState<DateFilter>('day', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [openId, setOpenId] = useUrlState('open', '');
  const [viewMode, setViewMode] = useViewMode('view', 'table');
  const [page, setPage] = usePageParam();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const all = requests.data ?? [];

  // Metrics
  const today = todayKey();
  const tomorrow = todayKey(new Date(Date.now() + 86400_000));

  const pendingCount = useMemo(() => all.filter((r) => r.status === 'pending').length, [all]);
  const confirmedCount = useMemo(() => all.filter((r) => r.status === 'confirmed').length, [all]);
  const pickedUpCount = useMemo(() => all.filter((r) => r.status === 'picked_up').length, [all]);
  const cancelledCount = useMemo(() => all.filter((r) => r.status === 'cancelled').length, [all]);
  const todayCount = useMemo(() => all.filter((r) => r.pickupDate === today && r.status !== 'cancelled').length, [all, today]);

  // Filtered rows
  const rows = useMemo(() => {
    return all.filter((r) => {
      // Status filter
      if (filter !== 'all' && r.status !== filter) return false;

      // Date filter
      if (dateFilter === 'today' && r.pickupDate !== today) return false;
      if (dateFilter === 'tomorrow' && r.pickupDate !== tomorrow) return false;

      // Text search
      return matches(q, r.id, r.customerName, r.serviceName, r.addressLine, r.slotLabel, r.orderId, r.notes);
    });
  }, [all, filter, dateFilter, today, tomorrow, q]);

  const resetAll = () => {
    setFilter('all');
    setDateFilter('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || dateFilter !== 'all' || q.trim() !== '';

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );

  const open = all.find((r) => r.id === openId) ?? null;

  const columns: Column<RequestRow>[] = [
    {
      key: 'id',
      header: 'Pickup ID',
      sortValue: (r) => r.id,
      render: (r) => (
        <div className="cell-main__text">
          <span className="cell-main__title" style={{ fontSize: 13.5, color: '#013E86', fontWeight: 700 }}>
            {r.id}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
            Asked {when(r.createdAt)}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer & Contact',
      sortValue: (r) => r.customerName,
      render: (r) => (
        <div className="cell-main">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#EEF4FF',
              color: '#013E86',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {r.customerName.charAt(0).toUpperCase()}
          </div>
          <div className="cell-main__text">
            <span className="cell-main__title" style={{ fontSize: 13.5, fontWeight: 650 }}>
              {r.customerName}
            </span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
              ID: {r.customerId}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'when',
      header: 'Slot & Pickup Day',
      sortValue: (r) => `${r.pickupDate}${r.slotId}`,
      render: (r) => {
        const isToday = r.pickupDate === today;
        return (
          <div className="cell-main__text">
            <span
              className="cell-main__title"
              style={{
                fontSize: 13,
                fontWeight: 650,
                color: isToday ? '#EA580C' : '#0A1C3E',
              }}
            >
              {pickupDay(r.pickupDate)}
            </span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
              {r.slotLabel}
            </span>
          </div>
        );
      },
    },
    {
      key: 'service',
      header: 'Service',
      sortValue: (r) => r.serviceName,
      render: (r) => (
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#013E86',
            background: '#F0F5FF',
            padding: '3px 9px',
            borderRadius: 6,
            display: 'inline-block',
          }}
        >
          {r.serviceName}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Doorstep Address (Outside Campus)',
      sortValue: (r) => r.addressLine,
      render: (r) => (
        <div className="cell-main__text" style={{ maxWidth: 260 }}>
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: '#1E293B',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={r.addressLine}
          >
            {r.addressLine}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11, color: '#64748B' }}>
            Model Town Delivery Zone (8 km)
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge size="sm" {...REQUEST_STATUS[r.status]} />,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="Open pickup details">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  return (
    <div className="page customers-page">
      {/* ── 1. Page Header with Customers Page Single-Line Stats Bar ── */}
      <PageHeader
        title="Pickup requests"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              <strong>{all.length}</strong> Total Requests
            </span>
            <span className="customers-header-stat customers-header-stat--orange">
              <span className="customers-stats-dot customers-stats-dot--orange" />
              <strong>{pendingCount}</strong> Needs Confirming
            </span>
            <span className="customers-header-stat customers-header-stat--green">
              <span className="customers-stats-dot customers-stats-dot--green" />
              <strong>{confirmedCount}</strong> Confirmed
            </span>
            <span className="customers-header-stat customers-header-stat--blue">
              <span className="customers-stats-dot customers-stats-dot--blue" />
              <strong>{pickedUpCount}</strong> Picked Up
            </span>
            {cancelledCount > 0 ? (
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--muted" />
                <strong>{cancelledCount}</strong> Cancelled
              </span>
            ) : null}
          </div>
        }
        actions={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              color: '#C2410C',
              fontSize: 12.5,
              fontWeight: 650,
            }}
          >
            <Icon name="truck" size={15} />
            <span>Outside Campus Store Exclusive</span>
          </div>
        }
      />

      <QueryView query={requests} skeleton={<PickupsSkeleton />}>
        {() => (
          <div className="overview-layout">
            {/* ── 2. Unified 4-Segment KPI Stats Bar (1:1 with Customers Page) ── */}
            <div className="customers-stats-bar" role="region" aria-label="Pickup requests statistics bar">
              {/* Segment 1: Dark Navy - Needs Confirming */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'pending' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
                title="Filter pickups needing confirmation"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--dark">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Needs confirming
                  </span>
                  <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                    <Icon name="calendar" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value overview-sub-card__value--white">{pendingCount}</span>
                  <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                    {pendingCount > 0 ? (
                      <span className="overview-sub-card__alert">{pendingCount} waiting for dispatch</span>
                    ) : (
                      'All pickups confirmed'
                    )}
                  </span>
                </div>
              </button>

              {/* Segment 2: Orange - Confirmed for Collection */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'confirmed' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'confirmed' ? 'all' : 'confirmed')}
                title="Filter confirmed pickups ready for collection"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--orange">Confirmed pickups</span>
                  <span className="overview-sub-card__icon-circle" aria-hidden>
                    <Icon name="truck" size={16} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{confirmedCount}</span>
                  <span className="overview-sub-card__caption">
                    {todayCount > 0 ? `${todayCount} scheduled for today` : `${confirmedCount} queued for pickup`}
                  </span>
                </div>
              </button>

              {/* Segment 3: Light - Picked Up */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'picked_up' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'picked_up' ? 'all' : 'picked_up')}
                title="Filter pickups collected from customer"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--light">
                    <span className="overview-tag__dot overview-tag__dot--blue" />
                    Picked up & open
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="check" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{pickedUpCount}</span>
                  <span className="overview-sub-card__caption">
                    Orders generated & processing
                  </span>
                </div>
              </button>

              {/* Segment 4: Light - Store Hub & Coverage Radius */}
              <div
                className="customers-stats-bar__item customers-stats-bar__item--light"
                title="Outside Campus store is the sole doorstep collection facility"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--success">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Outside campus store
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="mapPin" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">8 km</span>
                  <span className="overview-sub-card__trend">
                    <Icon name="truck" size={12} />
                    Model Town Hub &bull; 4 daily slots
                  </span>
                </div>
              </div>
            </div>

            {/* ── 3. Dedicated Store Coverage Banner (Outside Campus Only) ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                fontSize: 12,
                color: '#475569',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ color: '#013E86', display: 'inline-flex', flexShrink: 0 }}>
                  <Icon name="info" size={14} />
                </span>
                <span style={{ lineHeight: 1.4 }}>
                  Doorstep pickups are fulfilled by <strong style={{ color: '#013E86' }}>Model Town store</strong> (within 8 km). Campus branches are drop-off counters only.
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#013E86',
                  background: '#EEF4FF',
                  padding: '2px 8px',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Model Town Hub
              </span>
            </div>

            {/* ── 4. Standalone Sticky Action Bar Card (1:1 with Customers Page) ── */}
            <div className="customers-sticky-bar-wrapper">
              <div className="customers-action-card">
                <div className="customers-action-bar">
                  <div className="customers-search-box">
                    <Icon name="search" size={17} className="customers-search-icon" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search pickups by ID, customer name, service, address..."
                      className="customers-search-input"
                      aria-label="Search pickup requests"
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
                      title="Filter pickup requests"
                      aria-label="Filter pickup requests"
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
                      onClick={() => exportPickupsToCsv(rows)}
                      title="Export filtered pickup requests to CSV"
                    >
                      <Icon name="download" size={15} />
                      <span className="customers-ctrl-btn__label">Export</span>
                    </button>
                  </div>
                </div>

                {/* Filter Drawer */}
                {showFilterPanel ? (
                  <div className="customers-filter-drawer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                      <FilterPills<Filter>
                        label="Filter pickups by status"
                        value={filter}
                        onChange={(v) => setFilter(v)}
                        options={[
                          { value: 'all', label: 'All', count: all.length },
                          { value: 'pending', label: 'Needs confirming', count: pendingCount },
                          { value: 'confirmed', label: 'Confirmed', count: confirmedCount },
                          { value: 'picked_up', label: 'Picked up', count: pickedUpCount },
                          { value: 'cancelled', label: 'Cancelled', count: cancelledCount },
                        ]}
                      />
                      {hasActiveFilters ? (
                        <button
                          type="button"
                          className="btn btn--subtle btn--sm"
                          onClick={resetAll}
                          style={{ flexShrink: 0, marginLeft: 'auto' }}
                        >
                          <Icon name="x" size={13} /> Reset
                        </button>
                      ) : null}
                    </div>

                    {/* Secondary row: Date and Day filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Pickup day:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className={`chip${dateFilter === 'all' ? ' chip--on' : ''}`}
                          onClick={() => setDateFilter('all')}
                          style={{ fontSize: 11.5, padding: '3px 9px' }}
                        >
                          All dates
                        </button>
                        <button
                          type="button"
                          className={`chip${dateFilter === 'today' ? ' chip--on' : ''}`}
                          onClick={() => setDateFilter(dateFilter === 'today' ? 'all' : 'today')}
                          style={{ fontSize: 11.5, padding: '3px 9px' }}
                        >
                          Today ({todayCount})
                        </button>
                        <button
                          type="button"
                          className={`chip${dateFilter === 'tomorrow' ? ' chip--on' : ''}`}
                          onClick={() => setDateFilter(dateFilter === 'tomorrow' ? 'all' : 'tomorrow')}
                          style={{ fontSize: 11.5, padding: '3px 9px' }}
                        >
                          Tomorrow
                        </button>
                      </div>

                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          Showing <strong>{rows.length}</strong> of {all.length} requests
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── 5. Main Pickups Directory Card (Table or Grid View) ── */}
            <Card className="customers-directory-card" padded={false}>
              {viewMode === 'table' ? (
                <>
                  <div className="customers-table-scroll-hint" aria-hidden>
                    <Icon name="arrowRight" size={13} />
                    <span>Swipe horizontally for full table</span>
                  </div>
                  <DataTable
                    caption="Pickup requests directory"
                    rows={rows}
                    columns={columns}
                    rowKey={(r) => r.id}
                    onRowClick={(r) => setOpenId(r.id)}
                    rowLabel={(r) => `Open pickup ${r.id} for ${r.customerName}`}
                    selectedKey={openId || null}
                    page={page}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    mobileCard={(r) => (
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
                              <Icon name="truck" size={17} />
                            </div>
                            <div className="customer-grid-card__info">
                              <div className="customer-grid-card__name">
                                {r.id} &bull; {r.customerName}
                              </div>
                              <div className="customer-grid-card__phone">
                                {r.serviceName} &bull; {pickupDay(r.pickupDate)} ({r.slotLabel})
                              </div>
                            </div>
                          </div>
                          <StatusBadge size="sm" {...REQUEST_STATUS[r.status]} />
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                          {r.addressLine}
                        </div>
                      </div>
                    )}
                    empty={
                      <EmptyState
                        icon="calendar"
                        title={filter === 'pending' && !q ? 'No pickups to confirm' : 'No pickups match'}
                        message={
                          filter === 'pending' && !q
                            ? 'New pickup requests from the customer app will appear here.'
                            : 'Try adjusting your search terms or clearing the filter.'
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
                        icon="calendar"
                        title="No pickups match"
                        message={
                          hasActiveFilters
                            ? 'No pickups match your current filters. Click reset to see all.'
                            : 'No pickup requests recorded yet.'
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
                        {pagedRows.map((r) => (
                          <div
                            key={r.id}
                            className="customer-grid-card"
                            onClick={() => setOpenId(r.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpenId(r.id);
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
                                  <Icon name="truck" size={18} />
                                </div>
                                <div className="customer-grid-card__info">
                                  <div className="customer-grid-card__name">{r.id} &bull; {r.customerName}</div>
                                  <div className="customer-grid-card__phone">{r.serviceName}</div>
                                </div>
                              </div>
                              <StatusBadge size="sm" {...REQUEST_STATUS[r.status]} />
                            </div>

                            <div style={{ marginTop: 10, padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, fontSize: 12 }}>
                              <div style={{ fontWeight: 600, color: '#0A1C3E' }}>
                                {pickupDay(r.pickupDate)} &bull; {r.slotLabel}
                              </div>
                              <div style={{ color: '#64748B', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {r.addressLine}
                              </div>
                            </div>

                            <div className="customer-grid-card__footer" style={{ marginTop: 10 }}>
                              <div className="customer-grid-card__orders">
                                <span style={{ color: '#013E86', fontWeight: 600, fontSize: 12 }}>
                                  Outside Campus Hub
                                </span>
                              </div>
                              <div className="customer-grid-card__wallet">
                                <span style={{ color: '#64748B', fontSize: 11.5 }}>
                                  {when(r.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {rows.length > pageSize ? (
                        <div style={{ padding: '12px 18px', borderTop: '1px solid #E2E8F0' }}>
                          <Pagination
                            page={currentPage}
                            pages={pages}
                            total={rows.length}
                            pageSize={pageSize}
                            onChange={setPage}
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </QueryView>

      <PickupDrawer request={open} onClose={() => setOpenId('')} />
    </div>
  );
}

function pickupDay(date: string) {
  const today = todayKey();
  const tomorrow = todayKey(new Date(Date.now() + 86400_000));
  if (date === today) return 'Today';
  if (date === tomorrow) return 'Tomorrow';
  return dayDate(date);
}

function PickupDrawer({ request: r, onClose }: { request: RequestRow | null; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [cancelling, setCancelling] = useState(false);
  if (!r) return null;

  const canConfirm = r.status === 'pending';
  const canCollect = r.status === 'pending' || r.status === 'confirmed';

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={`Pickup ${r.id}`}
        subtitle={<StatusBadge size="sm" {...REQUEST_STATUS[r.status]} />}
        footer={
          canCollect ? (
            <>
              <Button variant="ghost" onClick={() => setCancelling(true)}>
                Cancel pickup
              </Button>
              {canConfirm ? (
                <Button
                  variant="outline"
                  icon="check"
                  loading={isBusy('confirm')}
                  onClick={() =>
                    run(
                      'confirm',
                      () => requestsApi.confirmRequest(r.id),
                      'Pickup confirmed',
                      'The customer sees it as confirmed in the app.',
                    )
                  }
                >
                  Confirm pickup
                </Button>
              ) : null}
              <Button
                variant="primary"
                icon="truck"
                loading={isBusy('collect')}
                onClick={() =>
                  run(
                    'collect',
                    () => requestsApi.markPickedUp(r.id),
                    (x) => `Picked up. Order ${x.orderId} is open`,
                    'Add the items on the order once they’re counted at Model Town store.',
                  )
                }
              >
                Mark as picked up
              </Button>
            </>
          ) : undefined
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Store Location Notice inside Drawer */}
          <div
            style={{
              padding: '10px 14px',
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: 10,
              fontSize: 12.5,
              color: '#9A3412',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon name="truck" size={16} />
            <div>
              <strong>Outside Campus Store:</strong> Model Town Road, Jalandhar &bull; Doorstep Pickup Hub (8 km)
            </div>
          </div>

          <Card>
            <Facts>
              <Fact label="Customer">
                <Link to={`/customers?open=${r.customerId}`}>{r.customerName}</Link>
              </Fact>
              <Fact label="Service">{r.serviceName}</Fact>
              <Fact label="Pickup day">{pickupDay(r.pickupDate)}</Fact>
              <Fact label="Time slot">{r.slotLabel}</Fact>
              <Fact label="Doorstep address" wide>
                {r.addressLine}
              </Fact>
              {r.notes ? (
                <Fact label="Note from customer" wide>
                  “{r.notes}”
                </Fact>
              ) : null}
              <Fact label="Requested">{when(r.createdAt)}</Fact>
              {r.orderId ? (
                <Fact label="Generated Order">
                  <Link to={`/orders?open=${r.orderId}`}>{r.orderId}</Link>
                </Fact>
              ) : null}
              {r.cancelReason ? (
                <Fact label="Why it was cancelled" wide>
                  {r.cancelReason}
                </Fact>
              ) : null}
            </Facts>
          </Card>

          <Card tone="stone">
            <p className="help-steps__title">Pickup Fulfillment Flow</p>
            <ol className="help-steps">
              <li className={r.status !== 'pending' && r.status !== 'cancelled' ? 'is-done' : ''}>
                Confirm the pickup request so our Model Town rider is dispatched.
              </li>
              <li className={r.status === 'picked_up' ? 'is-done' : ''}>
                After collecting the laundry at the door, mark as picked up. An order opens automatically.
              </li>
              <li>Count and tag items at the Model Town store, then move through washing to clean delivery.</li>
            </ol>
          </Card>
        </div>
      </Drawer>

      <CancelDialog
        open={cancelling}
        what={`pickup ${r.id}`}
        busy={isBusy('cancel')}
        onClose={() => setCancelling(false)}
        onConfirm={async (reason) => {
          await run('cancel', () => requestsApi.cancelRequest(r.id, reason), 'Pickup cancelled');
          setCancelling(false);
        }}
      />
    </>
  );
}
