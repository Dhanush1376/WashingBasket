import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useToast } from '@/components/ui/Toast';
import { useOperationalLocation, type LocationValue } from '@/hooks/useOperationalLocation';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { ago, date, matches } from '@/lib/format';
import { TONES } from '@/lib/status';
import { useLaundryState } from '@/laundry/store';
import { activeOrdersForStaff, findLocation } from '@customer/mock/engine/selectors';
import { setStaffStatus } from '@customer/mock/services/staffService';
import type { MockState, Staff, StaffRole } from '@customer/mock/types';
import { ResetDemoButton, SyncPill } from './shared';

const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  COUNTER_STAFF: 'Counter staff',
  PICKUP_AGENT: 'Pickup & delivery agent',
  LOCATION_MANAGER: 'Location manager',
};

type Row = Staff & {
  locationName: string;
  active: number;
  lastAction?: { at: string; message: string; orderId: string };
};

type StaffFilter = 'all' | 'active' | 'counter' | 'pickup' | 'manager' | 'suspended';

function toRows(s: MockState): Row[] {
  return s.staff.map((st) => {
    const last = s.activities
      .filter((a) => a.actor.kind === 'staff' && a.actor.id === st.id)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return {
      ...st,
      locationName: findLocation(s, st.locationId)?.shortName ?? '—',
      active: activeOrdersForStaff(s, st).length,
      lastAction: last ? { at: last.at, message: last.message, orderId: last.orderId } : undefined,
    };
  });
}

function exportStaffToCsv(data: Row[]) {
  if (!data.length) return;
  const headers = [
    'Staff ID',
    'Full Name',
    'Phone',
    'Location',
    'Role',
    'Status',
    'Active Orders',
    'Demo Login',
    'Joined Date',
  ];
  const csvRows = data.map((r) => [
    `"${r.id}"`,
    `"${r.name.replace(/"/g, '""')}"`,
    `"${r.phone}"`,
    `"${r.locationName}"`,
    `"${STAFF_ROLE_LABEL[r.role]}"`,
    `"${r.status}"`,
    r.active,
    r.demoLogin ? 'Yes' : 'No',
    `"${r.joinedAt}"`,
  ]);
  const content = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `washing-basket-staff-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const testStaffFilter = (r: Row, f: StaffFilter) => {
  if (f === 'all') return true;
  if (f === 'active') return r.active > 0;
  if (f === 'counter') return r.role === 'COUNTER_STAFF';
  if (f === 'pickup') return r.role === 'PICKUP_AGENT';
  if (f === 'manager') return r.role === 'LOCATION_MANAGER';
  return r.status === 'SUSPENDED';
};

/**
 * Redesigned 1:1 with Customers Page:
 * KPI statistics bar, sticky search & filters, table vs grid view toggle,
 * CSV export, and quick-inspection side drawer.
 */
export default function LaundryStaffPage() {
  const state = useLaundryState();
  const { show } = useToast();
  const { location: loc, setLocation: setLoc, label: locLabel, isFiltered } = useOperationalLocation();
  const [filter, setFilter] = useUrlState<StaffFilter>('filter', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [openId, setOpenId] = useUrlState('open', '');
  const [viewMode, setViewMode] = useViewMode('view', 'table');
  const [page, setPage] = usePageParam();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const all = toRows(state);
  const scoped = loc === 'all' ? all : all.filter((r) => r.locationId === loc);

  // Metrics
  const activeWorkloadCount = scoped.filter((r) => r.active > 0).length;
  const counterCount = scoped.filter((r) => r.role === 'COUNTER_STAFF').length;
  const pickupCount = scoped.filter((r) => r.role === 'PICKUP_AGENT').length;
  const activeStatusCount = scoped.filter((r) => r.status === 'ACTIVE').length;
  const suspendedCount = scoped.filter((r) => r.status === 'SUSPENDED').length;

  // Filtered rows
  const rows = scoped.filter((r) => {
    if (!testStaffFilter(r, filter)) return false;
    return matches(q, r.name, r.phone, r.locationName, STAFF_ROLE_LABEL[r.role], r.id);
  });

  const toggle = async (r: Row) => {
    const next = r.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await setStaffStatus(r.id, next);
      show(
        'success',
        next === 'ACTIVE' ? `${r.name} reactivated` : `${r.name} paused`,
        next === 'ACTIVE'
          ? 'They can sign in and scan again.'
          : 'Their scans and actions are refused until reactivated.',
      );
    } catch (e) {
      show('error', 'That didn’t work', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const resetAll = () => {
    setFilter('all');
    setLoc('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || loc !== 'all' || q.trim() !== '';

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openStaff = scoped.find((r) => r.id === openId);

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Staff member',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="cell-main">
          <Avatar name={r.name} size={32} tone={r.status === 'ACTIVE' ? 'navy' : 'stone'} />
          <div className="cell-main__text">
            <span className="cell-main__title" style={{ fontSize: 13.5 }}>
              {r.name} {r.demoLogin ? <Tag tone="orange">Demo sign-in</Tag> : null}
            </span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>{r.phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role & Scope',
      sortValue: (r) => r.role,
      render: (r) => (
        <div className="cell-main__text">
          <span style={{ fontWeight: 650, color: '#0A1C3E', fontSize: 13 }}>
            {STAFF_ROLE_LABEL[r.role]}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>{r.permissions.length} system permissions</span>
        </div>
      ),
    },
    {
      key: 'loc',
      header: 'Location Hub',
      sortValue: (r) => r.locationName,
      render: (r) => (
        <div className="cell-main__text">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#0A1C3E', fontSize: 13 }}>
            <Icon name="mapPin" size={12} color="#EA580C" />
            {r.locationName}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>Joined {date(r.joinedAt)}</span>
        </div>
      ),
    },
    {
      key: 'active',
      header: 'Workload',
      align: 'right',
      sortValue: (r) => r.active,
      render: (r) => (
        <div className="cell-main__text" style={{ alignItems: 'flex-end' }}>
          <span className="cell-main__title num" style={{ fontSize: 13.5 }}>{r.active}</span>
          <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
            {r.active > 0 ? (
              <span style={{ color: '#EA580C', fontWeight: 600 }}>{r.active} live</span>
            ) : (
              'available'
            )}
          </span>
        </div>
      ),
    },
    {
      key: 'last',
      header: 'Latest action',
      width: '260px',
      sortValue: (r) => r.lastAction?.at ?? '',
      hideOnTablet: true,
      render: (r) =>
        r.lastAction ? (
          <Link
            to={`/orders?open=${r.lastAction.orderId}`}
            className="cell-main__text"
            style={{ textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#0F172A',
                lineHeight: 1.25,
                maxWidth: 240,
                display: 'block',
              }}
              className="clamp-1"
            >
              <strong style={{ color: '#013E86', fontWeight: 700 }}>{r.lastAction.orderId}</strong> &bull; {r.lastAction.message}
            </span>
            <span style={{ fontSize: 11, color: '#64748B', lineHeight: 1.2 }}>{ago(r.lastAction.at)}</span>
          </Link>
        ) : (
          <span style={{ color: '#94A3B8', fontSize: 12, paddingLeft: 2 }}>—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusBadge
          size="sm"
          label={r.status === 'ACTIVE' ? 'Active' : 'Paused'}
          tone={r.status === 'ACTIVE' ? TONES.done : TONES.muted}
        />
      ),
    },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          <Button
            size="sm"
            variant={r.status === 'ACTIVE' ? 'ghost' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              toggle(r);
            }}
          >
            {r.status === 'ACTIVE' ? 'Pause' : 'Reactivate'}
          </Button>
          <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="View staff profile">
            <Icon name="chevronRight" size={15} />
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="page customers-page staff-page">
      {/* ── Page Header (1:1 with Customers Page) ── */}
      <PageHeader
        icon="shield"
        title="Staff"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              <strong>{scoped.length}</strong> Total Staff
            </span>
            <span className="customers-header-stat customers-header-stat--orange">
              <span className="customers-stats-dot customers-stats-dot--orange" />
              <strong>{activeWorkloadCount}</strong> On Active Shift
            </span>
            <span className="customers-header-stat customers-header-stat--green">
              <span className="customers-stats-dot customers-stats-dot--green" />
              <strong>{activeStatusCount}</strong> Active Accounts
            </span>
            <span className="customers-header-stat customers-header-stat--blue">
              <span className="customers-stats-dot customers-stats-dot--blue" />
              <strong>{counterCount}</strong> Counter · <strong>{pickupCount}</strong> Pickup
            </span>
          </div>
        }
        actions={
          <>
            <SyncPill />
            <ResetDemoButton />
          </>
        }
      />

      <div className="overview-layout">
        {/* ── 1. Unified Staff KPI Stats Bar (1:1 with Customers Bar) ── */}
        <div className="customers-stats-bar" role="region" aria-label="Staff summary statistics bar">
          {/* Segment 1: Dark Navy - Active On Shift */}
          <button
            type="button"
            className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'active' ? ' is-active' : ''}`}
            onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
            title="Filter staff members currently assigned to live jobs"
          >
            <div className="overview-sub-card__top">
              <span className="overview-tag overview-tag--dark">
                <span className="overview-tag__dot overview-tag__dot--green" />
                On shift today
              </span>
              <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                <Icon name="shield" size={17} />
              </span>
            </div>
            <div className="overview-sub-card__bottom">
              <span className="overview-sub-card__value overview-sub-card__value--white">{activeWorkloadCount}</span>
              <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                {activeWorkloadCount > 0 ? (
                  <span className="overview-sub-card__alert">{activeWorkloadCount} handling live jobs</span>
                ) : (
                  'No active workload'
                )}
              </span>
            </div>
          </button>

          {/* Segment 2: Orange - Counter Desk */}
          <button
            type="button"
            className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'counter' ? ' is-active' : ''}`}
            onClick={() => setFilter(filter === 'counter' ? 'all' : 'counter')}
            title="Filter front-desk counter staff"
          >
            <div className="overview-sub-card__top">
              <span className="overview-tag overview-tag--orange">Counter desk</span>
              <span className="overview-sub-card__icon-circle" aria-hidden>
                <Icon name="receipt" size={16} />
              </span>
            </div>
            <div className="overview-sub-card__bottom">
              <span className="overview-sub-card__value">{counterCount}</span>
              <span className="overview-sub-card__caption">
                {counterCount > 0 ? `${counterCount} intake & counter staff` : 'No counter staff'}
              </span>
            </div>
          </button>

          {/* Segment 3: Light - Pickup Agents */}
          <button
            type="button"
            className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'pickup' ? ' is-active' : ''}`}
            onClick={() => setFilter(filter === 'pickup' ? 'all' : 'pickup')}
            title="Filter pickup and delivery logistics agents"
          >
            <div className="overview-sub-card__top">
              <span className="overview-tag overview-tag--light">
                <span className="overview-tag__dot overview-tag__dot--blue" />
                Pickup & delivery
              </span>
              <span className="overview-sub-card__icon-squircle" aria-hidden>
                <Icon name="truck" size={17} />
              </span>
            </div>
            <div className="overview-sub-card__bottom">
              <span className="overview-sub-card__value">{pickupCount}</span>
              <span className="overview-sub-card__caption">
                {pickupCount > 0 ? `${pickupCount} field agents` : 'No pickup agents'}
              </span>
            </div>
          </button>

          {/* Segment 4: Light - Total Staff Roster */}
          <button
            type="button"
            className="customers-stats-bar__item customers-stats-bar__item--light"
            onClick={resetAll}
            title="View all registered staff members"
          >
            <div className="overview-sub-card__top">
              <span className="overview-tag overview-tag--success">
                <span className="overview-tag__dot overview-tag__dot--green" />
                Total roster
              </span>
              <span className="overview-sub-card__icon-squircle" aria-hidden>
                <Icon name="users" size={17} />
              </span>
            </div>
            <div className="overview-sub-card__bottom">
              <span className="overview-sub-card__value">{scoped.length}</span>
              <span className="overview-sub-card__caption">
                {suspendedCount > 0
                  ? `${scoped.length - suspendedCount} active · ${suspendedCount} paused`
                  : 'All staff accounts active'}
              </span>
            </div>
          </button>
        </div>

        {/* ── 2. Standalone Sticky Action Bar Card (1:1 with Customers Page) ── */}
        <div className="customers-sticky-bar-wrapper">
          <div className="customers-action-card">
            <div className="customers-action-bar">
              <div className="customers-search-box">
                <Icon name="search" size={17} className="customers-search-icon" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search staff by name, phone, role, hub..."
                  className="customers-search-input"
                  aria-label="Search staff members"
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
                  className={`customers-ctrl-btn customers-ctrl-btn--filters${showFilterPanel || filter !== 'all' || loc !== 'all' ? ' is-active' : ''}`}
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  title="Filter staff roster"
                  aria-label="Filter staff roster"
                  aria-expanded={showFilterPanel}
                >
                  <Icon name="sliders" size={16} />
                  <span className="customers-ctrl-btn__label">Filters</span>
                  {filter !== 'all' || loc !== 'all' ? (
                    <span className="customers-filter-count-badge">
                      {(filter !== 'all' ? 1 : 0) + (loc !== 'all' ? 1 : 0)}
                    </span>
                  ) : null}
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
                  onClick={() => exportStaffToCsv(rows)}
                  title="Export staff roster to CSV"
                >
                  <Icon name="download" size={15} />
                  <span className="customers-ctrl-btn__label">Export</span>
                </button>
              </div>
            </div>

            {/* Quick Filter Drawer */}
            {showFilterPanel ? (
              <div className="customers-filter-drawer">
                <FilterPills
                  label="Role filter"
                  value={filter}
                  onChange={(v) => setFilter(v as StaffFilter)}
                  options={[
                    { value: 'all', label: 'All Roles', count: scoped.length },
                    { value: 'active', label: 'On Shift', count: scoped.filter((r) => r.active > 0).length },
                    { value: 'counter', label: 'Counter Desk', count: scoped.filter((r) => r.role === 'COUNTER_STAFF').length },
                    { value: 'pickup', label: 'Pickup Agent', count: scoped.filter((r) => r.role === 'PICKUP_AGENT').length },
                    { value: 'manager', label: 'Location Manager', count: scoped.filter((r) => r.role === 'LOCATION_MANAGER').length },
                    { value: 'suspended', label: 'Paused Accounts', count: scoped.filter((r) => r.status === 'SUSPENDED').length },
                  ]}
                />
                <div style={{ marginTop: 10 }}>
                  <FilterPills
                    label="Location Hub"
                    value={loc}
                    onChange={(val) => setLoc(val as LocationValue)}
                    options={[
                      { value: 'all', label: 'All Hubs', count: all.length },
                      ...state.locations.map((l) => ({
                        value: l.id,
                        label: l.shortName,
                        count: all.filter((r) => r.locationId === l.id).length,
                      })),
                    ]}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── 3. Active Filter Feedback Note ── */}
        <div className="customers-filter-feedback">
          <div className="customers-filter-feedback__text">
            Showing <strong>{rows.length}</strong> of <strong>{scoped.length}</strong> staff members
            {isFiltered ? <> at <strong>{locLabel}</strong></> : null}
            {filter !== 'all' ? <> &bull; Filter: <strong>{filter}</strong></> : null}
            {q ? <> &bull; Matching &ldquo;<strong>{q}</strong>&rdquo;</> : null}
          </div>
          {hasActiveFilters ? (
            <button type="button" className="customers-filter-feedback__reset" onClick={resetAll}>
              <Icon name="refresh" size={13} />
              <span>Reset all</span>
            </button>
          ) : null}
        </div>

        {/* ── 4. Main Directory Card (Table or Grid View) ── */}
        <Card className="customers-directory-card" padded={false}>
          {viewMode === 'table' ? (
            <>
              <div className="customers-table-scroll-hint">
                <Icon name="arrowRight" size={13} />
                <span>Scroll table horizontally for full data</span>
              </div>
              <DataTable
                caption="Staff members"
                rows={pagedRows}
                columns={columns}
                rowKey={(r) => r.id}
                initialSort={{ key: 'name', dir: 'asc' }}
                onRowClick={(r) => setOpenId(r.id)}
                mobileCard={(r) => (
                  <div className="row-card" onClick={() => setOpenId(r.id)}>
                    <div className="row-card__top">
                      <div className="row-card__user">
                        <Avatar name={r.name} size={36} tone={r.status === 'ACTIVE' ? 'navy' : 'stone'} />
                        <div>
                          <div className="row-card__name">
                            {r.name}
                            {r.demoLogin ? (
                              <span style={{ marginLeft: 6 }}>
                                <Tag tone="orange">Demo</Tag>
                              </span>
                            ) : null}
                          </div>
                          <div className="row-card__meta">
                            {r.phone} &bull; {r.locationName}
                          </div>
                        </div>
                      </div>
                      <StatusBadge
                        size="sm"
                        label={r.status === 'ACTIVE' ? 'Active' : 'Paused'}
                        tone={r.status === 'ACTIVE' ? TONES.done : TONES.muted}
                      />
                    </div>

                    <div className="row-card__bottom">
                      <div className="row-card__orders">
                        <span style={{ fontWeight: 650, color: '#0F172A' }}>{STAFF_ROLE_LABEL[r.role]}</span>
                        {r.active > 0 ? (
                          <span style={{ color: '#EA580C', fontWeight: 600, marginLeft: 6 }}>
                            &bull; {r.active} live
                          </span>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={r.status === 'ACTIVE' ? 'ghost' : 'outline'}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r);
                        }}
                      >
                        {r.status === 'ACTIVE' ? 'Pause' : 'Reactivate'}
                      </Button>
                    </div>
                  </div>
                )}
                empty={
                  <EmptyState
                    icon="users"
                    title="No staff match"
                    message={
                      hasActiveFilters
                        ? 'No staff members match your current filters. Click reset to see all.'
                        : 'No staff registered yet.'
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
          ) : (
            <>
              {rows.length === 0 ? (
                <div className="customers-grid-empty">
                  <EmptyState
                    icon="users"
                    title="No staff match"
                    message={
                      hasActiveFilters
                        ? 'No staff members match your current filters. Click reset to see all.'
                        : 'No staff registered yet.'
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
                            <Avatar name={r.name} size={40} tone={r.status === 'ACTIVE' ? 'navy' : 'stone'} />
                            <div className="customer-grid-card__info">
                              <div className="customer-grid-card__name">
                                {r.name}
                                {r.demoLogin ? (
                                  <span style={{ marginLeft: 6 }}>
                                    <Tag tone="orange">Demo</Tag>
                                  </span>
                                ) : null}
                              </div>
                              <div className="customer-grid-card__phone">{r.phone}</div>
                            </div>
                          </div>
                          <StatusBadge
                            size="sm"
                            label={r.status === 'ACTIVE' ? 'Active' : 'Paused'}
                            tone={r.status === 'ACTIVE' ? TONES.done : TONES.muted}
                          />
                        </div>

                        <div className="customer-grid-card__details">
                          <span className="customer-grid-card__area" title={r.locationName}>
                            <Icon name="mapPin" size={12} color="#EA580C" /> {r.locationName} Hub
                          </span>
                          <span className="status-badge status-badge--blue status-badge--sm" style={{ fontWeight: 600 }}>
                            {STAFF_ROLE_LABEL[r.role]}
                          </span>
                        </div>

                        <div className="customer-grid-card__footer">
                          <div className="customer-grid-card__orders">
                            <strong>{r.active}</strong> {r.active === 1 ? 'active job' : 'active jobs'}
                            {r.active > 0 ? (
                              <span className="customer-grid-card__active-pill">
                                &bull; In progress
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B' }}>
                            {r.lastAction ? ago(r.lastAction.at) : 'No actions yet'}
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

      {/* ── 5. Slide-Out Staff Details Drawer (1:1 with Customer Drawer) ── */}
      {openStaff ? (
        <StaffDrawer
          staff={openStaff}
          state={state}
          onClose={() => setOpenId('')}
          onToggle={toggle}
        />
      ) : null}
    </div>
  );
}

function StaffDrawer({
  staff,
  state,
  onClose,
  onToggle,
}: {
  staff: Row;
  state: MockState;
  onClose: () => void;
  onToggle: (r: Row) => void;
}) {
  const staffActivities = useMemo(
    () => state.activities.filter((a) => a.actor.kind === 'staff' && a.actor.id === staff.id).slice(0, 10),
    [state.activities, staff.id],
  );

  const staffOrders = useMemo(
    () => activeOrdersForStaff(state, staff),
    [state, staff],
  );

  return (
    <Drawer
      open
      onClose={onClose}
      width={620}
      title={staff.name}
      subtitle={
        <>
          {staff.locationName} Hub &bull; {STAFF_ROLE_LABEL[staff.role]} &bull; Joined {date(staff.joinedAt)}
        </>
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Button
            variant={staff.status === 'ACTIVE' ? 'ghost' : 'primary'}
            icon={staff.status === 'ACTIVE' ? 'lock' : 'refresh'}
            onClick={() => onToggle(staff)}
          >
            {staff.status === 'ACTIVE' ? 'Pause staff account' : 'Reactivate account'}
          </Button>
          <a
            href={`tel:${staff.phone}`}
            className="btn btn--outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="phone" size={14} />
            <span>Call {staff.phone}</span>
          </a>
        </div>
      }
    >
      <div className="stack" style={{ gap: 20 }}>
        {/* Profile Card */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={staff.name} size={48} tone={staff.status === 'ACTIVE' ? 'navy' : 'stone'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0F172A' }}>{staff.name}</h3>
                {staff.demoLogin ? <Tag tone="orange">Demo Sign-in Active</Tag> : null}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, color: '#64748B', fontSize: 13 }}>
                <span>ID: <strong>{staff.id}</strong></span>
                <span>&bull;</span>
                <span>{staff.phone}</span>
                <span>&bull;</span>
                <span>{staff.locationName} Hub</span>
              </div>
            </div>
            <StatusBadge
              size="sm"
              label={staff.status === 'ACTIVE' ? 'Active' : 'Paused'}
              tone={staff.status === 'ACTIVE' ? TONES.done : TONES.muted}
            />
          </div>
        </Card>

        {/* Facts Summary */}
        <Facts>
          <Fact label="Operational Hub">{staff.locationName}</Fact>
          <Fact label="Staff Role">{STAFF_ROLE_LABEL[staff.role]}</Fact>
          <Fact label="Active Workload">{staff.active} active orders</Fact>
          <Fact label="Joined Team">{date(staff.joinedAt)}</Fact>
        </Facts>

        {/* Assigned System Permissions */}
        <Card>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
            System Permissions & Scope
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {staff.permissions.map((p) => (
              <span
                key={p}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <Icon name="check" size={12} color="#16A34A" />
                {p.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </Card>

        {/* Active Orders Assigned */}
        <Card>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
            Active Order Assignments ({staffOrders.length})
          </h4>
          {staffOrders.length === 0 ? (
            <div style={{ padding: '10px 0', color: '#64748B', fontSize: 13 }}>
              No active orders currently assigned to this staff member.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staffOrders.map((o) => (
                <Link
                  key={o.id}
                  to={`/orders?open=${o.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    textDecoration: 'none',
                    color: '#0F172A',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                      Order #{o.id}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      {o.serviceMode.replace(/_/g, ' ')} &bull; {o.pieces} pieces
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag tone="orange">{o.status.replace(/_/g, ' ')}</Tag>
                    <Icon name="chevronRight" size={14} color="#94A3B8" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Actions Timeline */}
        <Card>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
            Activity Timeline
          </h4>
          {staffActivities.length === 0 ? (
            <div style={{ padding: '10px 0', color: '#64748B', fontSize: 13 }}>
              No recorded system activities yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {staffActivities.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#F8FAFC',
                    borderLeft: '3px solid #3B82F6',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{a.message}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Order: {a.orderId}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{ago(a.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Drawer>
  );
}
