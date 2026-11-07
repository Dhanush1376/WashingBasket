import { useMemo, useState } from 'react';

import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { date, matches, money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { CUSTOMER_STATUS } from '@/lib/status';
import { customersApi, type CustomerRow } from '@/services';
import { CustomerDrawer } from './CustomerDrawer';

type Filter = 'all' | 'active-orders' | 'new' | 'with-balance' | 'paused';
const DAY = 86400_000;
const isNew = (c: CustomerRow) => Date.now() - Date.parse(`${c.customerSince}T00:00:00`) < 30 * DAY;

function exportCustomersToCsv(data: CustomerRow[]) {
  if (!data.length) return;
  const headers = [
    'Customer ID',
    'Full Name',
    'Phone',
    'Email',
    'Area',
    'Pincode',
    'Status',
    'Total Orders',
    'Active Orders',
    'Wallet Balance (INR)',
    'Total Spent (INR)',
    'Customer Since',
  ];
  const csvRows = data.map((c) => [
    `"${c.id}"`,
    `"${c.fullName.replace(/"/g, '""')}"`,
    `"${c.phone}"`,
    `"${c.email.replace(/"/g, '""')}"`,
    `"${c.area.replace(/"/g, '""')}"`,
    `"${c.pincode || ''}"`,
    `"${c.status}"`,
    c.orders,
    c.activeOrders,
    c.walletBalance,
    c.totalSpent,
    `"${c.customerSince}"`,
  ]);
  const content = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `washing-basket-customers-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const test = (c: CustomerRow, f: Filter) => {
  if (f === 'all') return true;
  if (f === 'active-orders') return c.activeOrders > 0;
  if (f === 'new') return isNew(c);
  if (f === 'with-balance') return c.walletBalance > 0;
  return c.status === 'paused';
};

export default function CustomersPage() {
  const customers = useQuery('customers', customersApi.listCustomers);
  const [filter, setFilter] = useUrlState<Filter>('show', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [openId, setOpenId] = useUrlState('open', '');
  const [viewMode, setViewMode] = useViewMode('view', 'table');
  const [page, setPage] = usePageParam();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const all = customers.data ?? [];

  // Metrics
  const activeOrdersCount = useMemo(() => all.filter((c) => c.activeOrders > 0).length, [all]);
  const newCount = useMemo(() => all.filter(isNew).length, [all]);
  const pausedCount = useMemo(() => all.filter((c) => c.status === 'paused').length, [all]);
  const withBalanceCount = useMemo(() => all.filter((c) => c.walletBalance > 0).length, [all]);
  const totalWallet = useMemo(() => all.reduce((s, c) => s + c.walletBalance, 0), [all]);

  // Filtered rows
  const rows = useMemo(
    () =>
      all.filter((c) => {
        if (!test(c, filter)) return false;
        return matches(q, c.fullName, c.phone, c.email, c.area, c.pincode, c.id, c.referralCode);
      }),
    [all, filter, q],
  );

  const resetAll = () => {
    setFilter('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || q.trim() !== '';

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (c) => c.fullName,
      render: (c) => (
        <div className="cell-main">
          <Avatar name={c.fullName} url={c.avatarUrl} size={38} />
          <div className="cell-main__text">
            <span className="cell-main__title">{c.fullName}</span>
            <span className="cell-main__sub">{c.phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'area',
      header: 'Area & Campus',
      sortValue: (c) => c.area,
      hideOnTablet: true,
      render: (c) => (
        <div className="cell-main__text">
          <span style={{ fontWeight: 600, color: '#0A1C3E' }}>{c.area}</span>
          <span className="cell-main__sub">{c.pincode ? `PIN ${c.pincode}` : 'No pincode'}</span>
        </div>
      ),
    },
    {
      key: 'since',
      header: 'Joined',
      sortValue: (c) => c.customerSince,
      render: (c) => (
        <div className="cell-main__text">
          <span>{date(c.customerSince)}</span>
          {isNew(c) ? <span className="cell-main__sub" style={{ color: '#EA580C', fontWeight: 600 }}>New this month</span> : null}
        </div>
      ),
      hideOnTablet: true,
    },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      sortValue: (c) => c.orders,
      render: (c) => (
        <div className="cell-main__text" style={{ alignItems: 'flex-end' }}>
          <span className="cell-main__title num">{c.orders}</span>
          <span className="cell-main__sub">
            {c.activeOrders ? (
              <span style={{ color: '#EA580C', fontWeight: 600 }}>{c.activeOrders} in progress</span>
            ) : (
              'none active'
            )}
          </span>
        </div>
      ),
    },
    {
      key: 'wallet',
      header: 'Wallet',
      align: 'right',
      sortValue: (c) => c.walletBalance,
      render: (c) => (
        <div className="cell-main__text" style={{ alignItems: 'flex-end' }}>
          <span className="num" style={{ fontWeight: 650, color: '#0A1C3E' }}>{money(c.walletBalance)}</span>
          <span className="cell-main__sub">Spent {money(c.totalSpent)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Account',
      sortValue: (c) => c.status,
      render: (c) => <StatusBadge {...CUSTOMER_STATUS[c.status]} />,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="View customer profile">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  return (
    <div className="page customers-page">
      <PageHeader
        title="Customers"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              <strong>{all.length}</strong> Total Customers
            </span>
            <span className="customers-header-stat customers-header-stat--orange">
              <span className="customers-stats-dot customers-stats-dot--orange" />
              <strong>{activeOrdersCount}</strong> With Orders
            </span>
            <span className="customers-header-stat customers-header-stat--green">
              <span className="customers-stats-dot customers-stats-dot--green" />
              <strong>{all.length - pausedCount}</strong> Active
            </span>
            {withBalanceCount > 0 ? (
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{withBalanceCount}</strong> With Funds
              </span>
            ) : null}
          </div>
        }
      />

      <QueryView query={customers} skeleton={<CustomersSkeleton />}>
        {() => (
          <div className="overview-layout">
            {/* ── 1. Unified Customers Stats Bar ── */}
            <div className="customers-stats-bar" role="region" aria-label="Customer summary statistics bar">
              {/* Segment 1: Dark Navy - Active Orders */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'active-orders' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'active-orders' ? 'all' : 'active-orders')}
                title="Filter customers with active orders in progress"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--dark">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Active orders
                  </span>
                  <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                    <Icon name="truck" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value overview-sub-card__value--white">{activeOrdersCount}</span>
                  <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                    {activeOrdersCount > 0 ? (
                      <span className="overview-sub-card__alert">{activeOrdersCount} live jobs today</span>
                    ) : (
                      'All orders delivered'
                    )}
                  </span>
                </div>
              </button>

              {/* Segment 2: Orange - New This Month */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'new' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'new' ? 'all' : 'new')}
                title="Filter customers who joined in the last 30 days"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--orange">New this month</span>
                  <span className="overview-sub-card__icon-circle" aria-hidden>
                    <Icon name="userPlus" size={16} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{newCount}</span>
                  <span className="overview-sub-card__caption">
                    {newCount > 0 ? `${newCount} signups (30d)` : 'No new signups'}
                  </span>
                </div>
              </button>

              {/* Segment 3: Light - Total Accounts */}
              <button
                type="button"
                className="customers-stats-bar__item customers-stats-bar__item--light"
                onClick={resetAll}
                title="View all registered customer accounts"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--light">
                    <span className="overview-tag__dot overview-tag__dot--blue" />
                    Total accounts
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="users" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{all.length}</span>
                  <span className="overview-sub-card__caption">
                    {pausedCount > 0 ? `${all.length - pausedCount} active · ${pausedCount} paused` : 'All accounts in good standing'}
                  </span>
                </div>
              </button>

              {/* Segment 4: Light - Wallet Holdings */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'with-balance' ? ' is-active' : ''}`}
                onClick={() => setFilter(filter === 'with-balance' ? 'all' : 'with-balance')}
                title="Filter customers with positive wallet balance"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--success">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Wallet funds
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="wallet" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(totalWallet)}</span>
                  <span className="overview-sub-card__trend">
                    <Icon name="wallet" size={12} />
                    {withBalanceCount} accounts with balance
                  </span>
                </div>
              </button>
            </div>

            {/* ── 2. Standalone Sticky Action Bar Card (Separated from Table Container) ── */}
            <div className="customers-sticky-bar-wrapper">
              <div className="customers-action-card">
                <div className="customers-action-bar">
                  <div className="customers-search-box">
                    <Icon name="search" size={17} className="customers-search-icon" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search customers..."
                      className="customers-search-input"
                      aria-label="Search customers"
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
                      className={`customers-ctrl-btn customers-ctrl-btn--filters${showFilterPanel || filter !== 'all' ? ' is-active' : ''}`}
                      onClick={() => setShowFilterPanel(!showFilterPanel)}
                      title="Filter customers"
                      aria-label="Filter customers"
                      aria-expanded={showFilterPanel}
                    >
                      <Icon name="sliders" size={16} />
                      <span className="customers-ctrl-btn__label">Filters</span>
                      {filter !== 'all' ? <span className="customers-filter-count-badge">1</span> : null}
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
                      onClick={() => exportCustomersToCsv(rows)}
                      title="Export customer directory to CSV"
                    >
                      <Icon name="download" size={15} />
                      <span className="customers-ctrl-btn__label">Export</span>
                    </button>
                  </div>
                </div>

                {/* Quick Filter Drawer */}
                {showFilterPanel ? (
                  <div className="customers-filter-drawer">
                    <FilterPills<Filter>
                      label="Filter customer accounts"
                      value={filter}
                      onChange={(v) => setFilter(v)}
                      options={[
                        { value: 'all', label: 'All', count: all.length },
                        { value: 'active-orders', label: 'In progress', count: activeOrdersCount },
                        { value: 'new', label: 'New (30d)', count: newCount },
                        { value: 'with-balance', label: 'With funds', count: withBalanceCount },
                        { value: 'paused', label: 'Paused', count: pausedCount },
                      ]}
                    />
                    {hasActiveFilters ? (
                      <button type="button" className="btn btn--subtle btn--sm" onClick={resetAll} style={{ flexShrink: 0 }}>
                        <Icon name="x" size={13} /> Reset
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── 3. Customer Directory Container (Separate Card) ── */}
            <Card className="customers-directory-card" padded={false}>

              {/* 2c. Content View: Table or Responsive Cards Grid */}
              {viewMode === 'table' ? (
                <>
                  <div className="customers-table-scroll-hint" aria-hidden>
                    <Icon name="arrowRight" size={13} />
                    <span>Swipe horizontally for full table</span>
                  </div>
                  <DataTable
                    caption="Customers"
                    rows={rows}
                    columns={columns}
                    rowKey={(c) => c.id}
                    onRowClick={(c) => setOpenId(c.id)}
                    rowLabel={(c) => `Open ${c.fullName}`}
                    selectedKey={openId || null}
                    page={page}
                    onPageChange={setPage}
                    pageSize={pageSize}
                    mobileCard={(c) => (
                      <div className="customer-grid-card customer-grid-card--mobile-row">
                        <div className="customer-grid-card__header">
                          <div className="customer-grid-card__user">
                            <Avatar name={c.fullName} url={c.avatarUrl} size={40} />
                            <div className="customer-grid-card__info">
                              <div className="customer-grid-card__name">{c.fullName}</div>
                              <div className="customer-grid-card__phone">{c.phone}</div>
                            </div>
                          </div>
                          <StatusBadge size="sm" {...CUSTOMER_STATUS[c.status]} />
                        </div>

                        <div className="customer-grid-card__details">
                          <span className="customer-grid-card__area" title={c.area}>
                            <Icon name="mapPin" size={12} /> {c.area}
                          </span>
                          {isNew(c) ? (
                            <span className="status-badge status-badge--orange status-badge--sm" style={{ fontWeight: 600 }}>
                              New
                            </span>
                          ) : null}
                        </div>

                        <div className="customer-grid-card__footer">
                          <div className="customer-grid-card__orders">
                            <strong>{c.orders}</strong> {c.orders === 1 ? 'order' : 'orders'}
                            {c.activeOrders ? (
                              <span className="customer-grid-card__active-pill">
                                · {c.activeOrders} active
                              </span>
                            ) : null}
                          </div>
                          <div className="customer-grid-card__wallet">
                            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginRight: 3 }}>Wallet</span>
                            {money(c.walletBalance)}
                          </div>
                        </div>
                      </div>
                    )}
                    empty={
                      <EmptyState
                        icon="users"
                        title="No customers match"
                        message={
                          hasActiveFilters
                            ? 'No customer accounts match your current filters. Click reset to see all.'
                            : 'No customer accounts registered yet.'
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
                        icon="users"
                        title="No customers match"
                        message={
                          hasActiveFilters
                            ? 'No customer accounts match your current filters. Click reset to see all.'
                            : 'No customer accounts registered yet.'
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
                        {pagedRows.map((c) => (
                          <div
                            key={c.id}
                            className="customer-grid-card"
                            onClick={() => setOpenId(c.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setOpenId(c.id);
                              }
                            }}
                          >
                            <div className="customer-grid-card__header">
                              <div className="customer-grid-card__user">
                                <Avatar name={c.fullName} url={c.avatarUrl} size={40} />
                                <div className="customer-grid-card__info">
                                  <div className="customer-grid-card__name">{c.fullName}</div>
                                  <div className="customer-grid-card__phone">{c.phone}</div>
                                </div>
                              </div>
                              <StatusBadge size="sm" {...CUSTOMER_STATUS[c.status]} />
                            </div>

                            <div className="customer-grid-card__details">
                              <span className="customer-grid-card__area" title={c.area}>
                                <Icon name="mapPin" size={12} /> {c.area}
                              </span>
                              {isNew(c) ? (
                                <span className="status-badge status-badge--orange status-badge--sm" style={{ fontWeight: 600 }}>
                                  New
                                </span>
                              ) : null}
                            </div>

                            <div className="customer-grid-card__footer">
                              <div className="customer-grid-card__orders">
                                <strong>{c.orders}</strong> {c.orders === 1 ? 'order' : 'orders'}
                                {c.activeOrders > 0 ? (
                                  <span className="customer-grid-card__active-pill">
                                    · {c.activeOrders} active
                                  </span>
                                ) : null}
                              </div>
                              <div className="customer-grid-card__wallet">
                                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginRight: 3 }}>Wallet</span>
                                {money(c.walletBalance)}
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

      {openId ? <CustomerDrawer customerId={openId} onClose={() => setOpenId('')} /> : null}
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div className="overview-layout" role="status" aria-label="Loading customer data">
      <div style={{ marginTop: 10 }}>
        <Skeleton height={124} radius={16} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Skeleton height={420} radius={14} />
      </div>
    </div>
  );
}
