import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { DataTable, type Column, Pagination } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { date, matches, money, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { TXN_SOURCE, TXN_STATUS, TXN_TYPE } from '@/lib/status';
import { walletApi, type TxnRow, type WalletBalanceRow, type WalletOverview } from '@/services';
import type { WalletTxnSource } from '@/types';
import { WalletSettingsCard } from './WalletSettingsCard';

type View = 'history' | 'balances' | 'settings';
type Kind = 'all' | 'in' | 'out' | 'pending';

function WalletSkeleton() {
  return (
    <div className="overview-layout">
      <div className="skeleton" style={{ height: 108, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 60, borderRadius: 14 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
    </div>
  );
}

function exportTransactionsToCsv(rows: TxnRow[]) {
  const headers = ['Transaction ID', 'Title', 'Customer', 'Type', 'Source', 'Amount', 'Status', 'Date', 'Order ID'];
  const csvRows = rows.map((t) => [
    t.id,
    `"${(t.title || '').replace(/"/g, '""')}"`,
    `"${(t.customerName || '').replace(/"/g, '""')}"`,
    t.type,
    t.source ?? '',
    t.amount,
    t.status,
    t.date,
    t.orderId ?? '',
  ]);
  const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportBalancesToCsv(rows: WalletBalanceRow[]) {
  const headers = ['Customer ID', 'Customer Name', 'Total Entries', 'Last Activity', 'Pending Amount', 'Available Balance'];
  const csvRows = rows.map((r) => [
    r.customerId,
    `"${(r.customerName || '').replace(/"/g, '""')}"`,
    r.entries,
    r.lastEntryAt ? date(r.lastEntryAt) : '',
    r.pending,
    r.balance,
  ]);
  const csvContent = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `wallet-balances-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function WalletPage() {
  const overview = useQuery('wallet', walletApi.getWalletOverview);
  const [view, setView] = useUrlState<View>('view', 'history');
  const [viewMode, setViewMode] = useViewMode('mode', 'table');
  const [kind, setKind] = useUrlState<Kind>('kind', 'all');
  const [source, setSource] = useUrlState<'any' | WalletTxnSource>('source', 'any');
  const [q, setQ] = useUrlState('q', '');
  const [page, setPage] = usePageParam();
  const [openId, setOpenId] = useUrlState('open', '');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const pageSize = 12;

  const o: WalletOverview | undefined = overview.data;
  const allTxns = useMemo(() => o?.transactions ?? [], [o]);
  const allBalances = useMemo(() => o?.balances ?? [], [o]);

  // Metrics
  const inCount = useMemo(() => allTxns.filter((t) => t.type !== 'debit').length, [allTxns]);
  const outCount = useMemo(() => allTxns.filter((t) => t.type === 'debit').length, [allTxns]);
  const pendingCount = useMemo(() => allTxns.filter((t) => t.status === 'pending').length, [allTxns]);

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    return allTxns.filter((t) => {
      if (kind === 'in' && t.type === 'debit') return false;
      if (kind === 'out' && t.type !== 'debit') return false;
      if (kind === 'pending' && t.status !== 'pending') return false;
      if (source !== 'any' && t.source !== source) return false;
      if (q && !matches(q, t.customerName, t.title, t.id, t.orderId)) return false;
      return true;
    });
  }, [allTxns, kind, source, q]);

  // Filtered balances
  const filteredBalances = useMemo(() => {
    return allBalances.filter((b) => {
      if (q && !matches(q, b.customerName)) return false;
      return true;
    });
  }, [allBalances, q]);

  const hasActiveFilters = kind !== 'all' || source !== 'any' || q.trim() !== '';

  const resetAll = () => {
    setKind('all');
    setSource('any');
    setQ('');
  };

  const openTxn = allTxns.find((t) => t.id === openId) ?? null;

  // Pagination for grid mode
  const totalItems = view === 'history' ? filteredTxns.length : filteredBalances.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedTxns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTxns.slice(start, start + pageSize);
  }, [filteredTxns, currentPage, pageSize]);

  const pagedBalances = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBalances.slice(start, start + pageSize);
  }, [filteredBalances, currentPage, pageSize]);

  // Columns for History Table
  const historyColumns: Column<TxnRow>[] = [
    {
      key: 'what',
      header: 'What happened',
      sortValue: (t) => t.title,
      render: (t) => (
        <div className="cell-main">
          <span className={`txn-icon txn-icon--${t.type}`}>
            <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={16} />
          </span>
          <div className="cell-main__text">
            <span className="cell-main__title">{t.title}</span>
            <span className="cell-main__sub">{TXN_SOURCE[t.source ?? 'topup'].label}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (t) => t.customerName,
      render: (t) => (
        <div className="cell-main__text">
          <span style={{ fontWeight: 600, color: '#0A1C3E' }}>{t.customerName}</span>
          {t.orderId ? (
            <span className="cell-main__sub" style={{ color: '#64748B' }}>
              Order #{t.orderId}
            </span>
          ) : (
            <span className="cell-main__sub" style={{ color: '#94A3B8' }}>
              ID: {t.id}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'When',
      sortValue: (t) => t.date,
      render: (t) => (
        <div className="cell-main__text">
          <span>{when(t.date)}</span>
          <span className="cell-main__sub">{date(t.date)}</span>
        </div>
      ),
      hideOnTablet: true,
    },
    {
      key: 'source',
      header: 'Source',
      sortValue: (t) => t.source ?? '',
      render: (t) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 6,
            background: '#F1F5F9',
            color: '#334155',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={12} />
          {TXN_SOURCE[t.source ?? 'topup'].label}
        </span>
      ),
      hideOnTablet: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => t.status,
      render: (t) => <StatusBadge {...TXN_STATUS[t.status]} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortValue: (t) => (t.type === 'debit' ? -t.amount : t.amount),
      render: (t) => (
        <span
          className="num"
          style={{
            fontWeight: 700,
            fontSize: 14.5,
            color: t.type === 'debit' ? '#0A1C3E' : '#16A34A',
          }}
        >
          {TXN_TYPE[t.type].sign}
          {money(t.amount)}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="View details">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  // Columns for Balances Table
  const balanceColumns: Column<WalletBalanceRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      sortValue: (r) => r.customerName,
      render: (r) => (
        <div className="cell-main">
          <Avatar name={r.customerName} size={36} />
          <div className="cell-main__text">
            <span className="cell-main__title">{r.customerName}</span>
            <span className="cell-main__sub">ID: {r.customerId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'entries',
      header: 'Activity',
      align: 'right',
      sortValue: (r) => r.entries,
      render: (r) => (
        <div className="cell-main__text" style={{ alignItems: 'flex-end' }}>
          <span className="num" style={{ fontWeight: 650, color: '#0A1C3E' }}>
            {r.entries} {r.entries === 1 ? 'entry' : 'entries'}
          </span>
          <span className="cell-main__sub">{r.lastEntryAt ? when(r.lastEntryAt) : 'No transactions'}</span>
        </div>
      ),
      hideOnTablet: true,
    },
    {
      key: 'last',
      header: 'Last Active',
      sortValue: (r) => r.lastEntryAt ?? '',
      render: (r) => <span className="soft">{r.lastEntryAt ? date(r.lastEntryAt) : '—'}</span>,
      hideOnTablet: true,
    },
    {
      key: 'pending',
      header: 'Pending',
      align: 'right',
      sortValue: (r) => r.pending,
      render: (r) => (
        <span className="num" style={{ fontWeight: 600, color: r.pending > 0 ? '#EA580C' : '#94A3B8' }}>
          {r.pending ? money(r.pending) : '—'}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Available Funds',
      align: 'right',
      sortValue: (r) => r.balance,
      render: (r) => (
        <span className="num" style={{ fontWeight: 700, fontSize: 14.5, color: '#0A1C3E' }}>
          {money(r.balance)}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (r) => (
        <Link
          to={`/customers?open=${r.customerId}`}
          style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }}
          title={`Open ${r.customerName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="chevronRight" size={15} />
        </Link>
      ),
    },
  ];

  return (
    <div className="page customers-page wallet-page">
      {/* ── Page Header (1:1 with Customers Page) ── */}
      <PageHeader
        title="Wallet"
        description={
          o ? (
            <div className="customers-header-desc wallet-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                <strong>{money(o.totalBalance)}</strong> Active Funds
              </span>
              <span className="customers-header-stat customers-header-stat--orange">
                <span className="customers-stats-dot customers-stats-dot--orange" />
                <strong>{money(o.pendingCredits)}</strong> Pending
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                <strong>{money(o.addedThisMonth)}</strong> Added (30d)
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{money(o.spentThisMonth)}</strong> Spent (30d)
              </span>
            </div>
          ) : (
            'Review customer wallet balances, credits, debits and refunds.'
          )
        }
      />

      <QueryView query={overview} skeleton={<WalletSkeleton />}>
        {(ov) => (
          <div className="overview-layout">
            {/* ── 1. Unified Wallet Stats Bar (Exactly like Customers Stats Bar) ── */}
            <div className="customers-stats-bar wallet-stats-bar" role="region" aria-label="Wallet summary statistics bar">
              {/* Segment 1: Dark Navy - Total in Wallets */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--dark${kind === 'all' && view === 'history' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('history');
                  setKind('all');
                }}
                title="View all wallet transactions"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--dark">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Available balance
                  </span>
                  <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                    <Icon name="wallet" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value overview-sub-card__value--white">{money(ov.totalBalance)}</span>
                  <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                    {allBalances.length > 0 ? (
                      <span className="overview-sub-card__alert">{allBalances.length} customer balances</span>
                    ) : (
                      'In customer accounts'
                    )}
                  </span>
                </div>
              </button>

              {/* Segment 2: Orange - Pending Funds */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--orange${kind === 'pending' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('history');
                  setKind(kind === 'pending' ? 'all' : 'pending');
                }}
                title="Filter pending rewards awaiting delivery"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--orange">Pending funds</span>
                  <span className="overview-sub-card__icon-circle" aria-hidden>
                    <Icon name="clock" size={16} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(ov.pendingCredits)}</span>
                  <span className="overview-sub-card__caption">
                    {pendingCount > 0 ? `${pendingCount} entries awaiting order` : 'Zero pending'}
                  </span>
                </div>
              </button>

              {/* Segment 3: Light - Added This Month */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${kind === 'in' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('history');
                  setKind(kind === 'in' ? 'all' : 'in');
                }}
                title="Filter money added into wallets in the last 30 days"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--light">
                    <span className="overview-tag__dot overview-tag__dot--blue" />
                    Top-ups (30d)
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="plus" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(ov.addedThisMonth)}</span>
                  <span className="overview-sub-card__caption">
                    {inCount > 0 ? `${inCount} credit top-ups` : 'No top-ups yet'}
                  </span>
                </div>
              </button>

              {/* Segment 4: Light - Spent This Month */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${kind === 'out' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('history');
                  setKind(kind === 'out' ? 'all' : 'out');
                }}
                title="Filter money spent on orders in the last 30 days"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--success">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Spent (30d)
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="bag" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(ov.spentThisMonth)}</span>
                  <span className="overview-sub-card__trend">
                    <Icon name="bag" size={12} />
                    {outCount} orders paid with wallet
                  </span>
                </div>
              </button>
            </div>

            {/* ── 2. Combined Sticky Action Bar Card (Tabs + Search + Filters + View Mode + Export) ── */}
            <div className="customers-sticky-bar-wrapper">
              <div className="customers-action-card customers-action-card--combined">
                <div className="customers-action-bar customers-action-bar--combined">
                  {/* View Segment Tabs (Integrated directly inside the bar) */}
                  <div className="wallet-view-tabs wallet-view-tabs--inline" role="tablist" aria-label="Wallet sections">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'history'}
                      className={`wallet-view-tab${view === 'history' ? ' is-active' : ''}`}
                      onClick={() => setView('history')}
                    >
                      <Icon name="list" size={15} />
                      <span>All Activity</span>
                      <span className="wallet-tab-count">{allTxns.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'balances'}
                      className={`wallet-view-tab${view === 'balances' ? ' is-active' : ''}`}
                      onClick={() => setView('balances')}
                    >
                      <Icon name="users" size={15} />
                      <span>Customer Balances</span>
                      <span className="wallet-tab-count">{allBalances.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'settings'}
                      className={`wallet-view-tab${view === 'settings' ? ' is-active' : ''}`}
                      onClick={() => setView('settings')}
                    >
                      <Icon name="sliders" size={15} />
                      <span>Top-up Rules</span>
                    </button>
                  </div>

                  {view !== 'settings' ? (
                    <div className="customers-action-bar-row2">
                      <div className="customers-search-box">
                        <Icon name="search" size={17} className="customers-search-icon" />
                        <input
                          type="search"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder={view === 'history' ? 'Search customer, title, or order...' : 'Search customer name...'}
                          className="customers-search-input"
                          aria-label="Search wallet"
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
                          title="Filter wallet entries"
                          aria-label="Filter wallet entries"
                          aria-expanded={showFilterPanel}
                        >
                          <Icon name="sliders" size={16} />
                          <span className="customers-ctrl-btn__label">Filters</span>
                          {hasActiveFilters ? <span className="customers-filter-count-badge">1</span> : null}
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
                          onClick={() => (view === 'history' ? exportTransactionsToCsv(filteredTxns) : exportBalancesToCsv(filteredBalances))}
                          title="Export directory to CSV"
                        >
                          <Icon name="download" size={15} />
                          <span className="customers-ctrl-btn__label">Export</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Quick Filter Drawer */}
                {view !== 'settings' && showFilterPanel ? (
                      <div className="customers-filter-drawer">
                        <FilterPills<Kind>
                          label="Filter entries"
                          value={kind}
                          onChange={(v) => setKind(v)}
                          options={[
                            { value: 'all', label: 'All', count: allTxns.length },
                            { value: 'in', label: 'Money in', count: inCount },
                            { value: 'out', label: 'Spent', count: outCount },
                            { value: 'pending', label: 'Pending', count: pendingCount },
                          ]}
                        />

                        {view === 'history' ? (
                          <div className="wallet-source-filter">
                            <select
                              className="wallet-source-select"
                              value={source}
                              onChange={(e) => setSource(e.target.value as 'any' | WalletTxnSource)}
                              aria-label="Filter by source"
                            >
                              <option value="any">All Sources</option>
                              {(Object.keys(TXN_SOURCE) as WalletTxnSource[]).map((s) => (
                                <option key={s} value={s}>
                                  {TXN_SOURCE[s].label}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}

                        {hasActiveFilters ? (
                          <button type="button" className="btn btn--subtle btn--sm" onClick={resetAll} style={{ flexShrink: 0 }}>
                            <Icon name="x" size={13} /> Reset
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* ── 3. Directory Card Container (Exactly like Customers Directory Card) ── */}
                {view === 'settings' ? (
                  <div style={{ marginTop: 12 }}>
                    <WalletSettingsCard />
                  </div>
                ) : (
                  <Card className="customers-directory-card" padded={false}>
                  {view === 'history' ? (
                    /* History View: Table or Grid */
                    viewMode === 'table' ? (
                      <>
                        <div className="customers-table-scroll-hint" aria-hidden>
                          <Icon name="arrowRight" size={13} />
                          <span>Swipe horizontally for full table</span>
                        </div>
                        <DataTable
                          caption="Wallet activity"
                          rows={filteredTxns}
                          columns={historyColumns}
                          rowKey={(t) => t.id}
                          initialSort={{ key: 'date', dir: 'desc' }}
                          onRowClick={(t) => setOpenId(t.id)}
                          rowLabel={(t) => `Open ${t.title} for ${t.customerName}`}
                          selectedKey={openId || null}
                          page={page}
                          onPageChange={setPage}
                          pageSize={pageSize}
                          mobileCard={(t) => (
                            <div className="customer-grid-card customer-grid-card--mobile-row">
                              <div className="customer-grid-card__header">
                                <div className="customer-grid-card__user">
                                  <span className={`txn-icon txn-icon--${t.type}`}>
                                    <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={16} />
                                  </span>
                                  <div className="customer-grid-card__info">
                                    <div className="customer-grid-card__name">{t.title}</div>
                                    <div className="customer-grid-card__phone">{t.customerName}</div>
                                  </div>
                                </div>
                                <StatusBadge size="sm" {...TXN_STATUS[t.status]} />
                              </div>

                              <div className="customer-grid-card__details">
                                <span className="customer-grid-card__area">
                                  <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={12} /> {TXN_SOURCE[t.source ?? 'topup'].label}
                                </span>
                                <span className="soft" style={{ fontSize: 12 }}>
                                  {when(t.date)}
                                </span>
                              </div>

                              <div className="customer-grid-card__footer">
                                <div className="customer-grid-card__orders">
                                  {t.orderId ? `Order #${t.orderId}` : t.id}
                                </div>
                                <div
                                  className="customer-grid-card__wallet"
                                  style={{ color: t.type === 'debit' ? '#0A1C3E' : '#16A34A' }}
                                >
                                  {TXN_TYPE[t.type].sign}
                                  {money(t.amount)}
                                </div>
                              </div>
                            </div>
                          )}
                          empty={<EmptyState icon="wallet" title="No entries match" message="Try another filter or clear the search." />}
                        />
                      </>
                    ) : (
                      <>
                        {filteredTxns.length === 0 ? (
                          <div className="customers-grid-empty">
                            <EmptyState
                              icon="wallet"
                              title="No entries match"
                              message={hasActiveFilters ? 'No wallet entries match your search or filters.' : 'No transactions recorded yet.'}
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
                              {pagedTxns.map((t) => (
                                <div
                                  key={t.id}
                                  className="customer-grid-card"
                                  onClick={() => setOpenId(t.id)}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setOpenId(t.id);
                                    }
                                  }}
                                >
                                  <div className="customer-grid-card__header">
                                    <div className="customer-grid-card__user">
                                      <span className={`txn-icon txn-icon--${t.type}`}>
                                        <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={16} />
                                      </span>
                                      <div className="customer-grid-card__info">
                                        <div className="customer-grid-card__name">{t.title}</div>
                                        <div className="customer-grid-card__phone">{t.customerName}</div>
                                      </div>
                                    </div>
                                    <StatusBadge size="sm" {...TXN_STATUS[t.status]} />
                                  </div>

                                  <div className="customer-grid-card__details">
                                    <span className="customer-grid-card__area">
                                      <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={12} /> {TXN_SOURCE[t.source ?? 'topup'].label}
                                    </span>
                                    <span className="soft" style={{ fontSize: 12 }}>
                                      {when(t.date)}
                                    </span>
                                  </div>

                                  <div className="customer-grid-card__footer">
                                    <div className="customer-grid-card__orders">
                                      {t.orderId ? `Order #${t.orderId}` : t.id}
                                    </div>
                                    <div
                                      className="customer-grid-card__wallet"
                                      style={{ color: t.type === 'debit' ? '#0A1C3E' : '#16A34A', fontSize: 15 }}
                                    >
                                      {TXN_TYPE[t.type].sign}
                                      {money(t.amount)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {filteredTxns.length > pageSize ? (
                              <Pagination
                                page={currentPage}
                                pages={totalPages}
                                total={filteredTxns.length}
                                pageSize={pageSize}
                                onChange={setPage}
                              />
                            ) : null}
                          </>
                        )}
                      </>
                    )
                  ) : (
                    /* Balances View: Table or Grid */
                    viewMode === 'table' ? (
                      <>
                        <div className="customers-table-scroll-hint" aria-hidden>
                          <Icon name="arrowRight" size={13} />
                          <span>Swipe horizontally for full table</span>
                        </div>
                        <DataTable
                          caption="Wallet balance per customer"
                          rows={filteredBalances}
                          columns={balanceColumns}
                          rowKey={(r) => r.customerId}
                          initialSort={{ key: 'balance', dir: 'desc' }}
                          page={page}
                          onPageChange={setPage}
                          pageSize={pageSize}
                          mobileCard={(r) => (
                            <div className="customer-grid-card customer-grid-card--mobile-row">
                              <div className="customer-grid-card__header">
                                <div className="customer-grid-card__user">
                                  <Avatar name={r.customerName} size={38} />
                                  <div className="customer-grid-card__info">
                                    <div className="customer-grid-card__name">{r.customerName}</div>
                                    <div className="customer-grid-card__phone">{r.entries} transactions</div>
                                  </div>
                                </div>
                              </div>

                              <div className="customer-grid-card__details">
                                <span className="soft" style={{ fontSize: 12 }}>
                                  Last active: {r.lastEntryAt ? date(r.lastEntryAt) : 'None'}
                                </span>
                                {r.pending > 0 ? (
                                  <span className="status-badge status-badge--orange status-badge--sm" style={{ fontWeight: 600 }}>
                                    {money(r.pending)} pending
                                  </span>
                                ) : null}
                              </div>

                              <div className="customer-grid-card__footer">
                                <div className="customer-grid-card__orders">Available to spend</div>
                                <div className="customer-grid-card__wallet" style={{ fontSize: 15 }}>
                                  {money(r.balance)}
                                </div>
                              </div>
                            </div>
                          )}
                          empty={<EmptyState icon="users" title="No customers match" message="Check the spelling of the name." />}
                        />
                      </>
                    ) : (
                      <>
                        {filteredBalances.length === 0 ? (
                          <div className="customers-grid-empty">
                            <EmptyState
                              icon="users"
                              title="No customers match"
                              message="Check the spelling of the customer name."
                              action={
                                q ? (
                                  <button type="button" className="btn btn--subtle" onClick={() => setQ('')}>
                                    Clear search
                                  </button>
                                ) : undefined
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <div className="customers-grid-view">
                              {pagedBalances.map((r) => (
                                <Link
                                  key={r.customerId}
                                  to={`/customers?open=${r.customerId}`}
                                  className="customer-grid-card"
                                  style={{ textDecoration: 'none' }}
                                >
                                  <div className="customer-grid-card__header">
                                    <div className="customer-grid-card__user">
                                      <Avatar name={r.customerName} size={40} />
                                      <div className="customer-grid-card__info">
                                        <div className="customer-grid-card__name">{r.customerName}</div>
                                        <div className="customer-grid-card__phone">{r.entries} activity entries</div>
                                      </div>
                                    </div>
                                    <span style={{ color: '#94A3B8' }}>
                                      <Icon name="chevronRight" size={16} />
                                    </span>
                                  </div>

                                  <div className="customer-grid-card__details">
                                    <span className="soft" style={{ fontSize: 12 }}>
                                      Last entry: {r.lastEntryAt ? date(r.lastEntryAt) : 'None'}
                                    </span>
                                    {r.pending > 0 ? (
                                      <span className="status-badge status-badge--orange status-badge--sm" style={{ fontWeight: 600 }}>
                                        {money(r.pending)} pending
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="customer-grid-card__footer">
                                    <div className="customer-grid-card__orders">Available Balance</div>
                                    <div className="customer-grid-card__wallet" style={{ fontSize: 15 }}>
                                      {money(r.balance)}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>

                            {filteredBalances.length > pageSize ? (
                              <Pagination
                                page={currentPage}
                                pages={totalPages}
                                total={filteredBalances.length}
                                pageSize={pageSize}
                                onChange={setPage}
                              />
                            ) : null}
                          </>
                        )}
                      </>
                    )
                  )}
                </Card>
              )}
            </div>
          )}
        </QueryView>

      {/* ── 4. Slide-over Details Drawer ── */}
      <Drawer
        open={!!openTxn}
        onClose={() => setOpenId('')}
        title={openTxn?.title ?? 'Transaction Details'}
        subtitle={openTxn ? openTxn.id : undefined}
        width={480}
      >
        {openTxn ? (
          <>
            <Card tone={openTxn.type === 'debit' ? 'white' : 'stone'} className="txn-hero">
              <span className="muted">{TXN_TYPE[openTxn.type].label}</span>
              <strong className={`txn-hero__amount num ${openTxn.type === 'debit' ? '' : 'positive'}`}>
                {TXN_TYPE[openTxn.type].sign}
                {money(openTxn.amount)}
              </strong>
              <StatusBadge {...TXN_STATUS[openTxn.status]} />
            </Card>

            <Card>
              <Facts>
                <Fact label="Customer">
                  <Link to={`/customers?open=${openTxn.customerId}`} className="wallet-drawer-link">
                    {openTxn.customerName}
                  </Link>
                </Fact>
                <Fact label="When">{when(openTxn.date)}</Fact>
                <Fact label="Type">{TXN_SOURCE[openTxn.source ?? 'topup'].label}</Fact>
                <Fact label="Reference">
                  <span className="mono">{openTxn.id}</span>
                </Fact>
                {openTxn.orderId ? (
                  <Fact label="Order">
                    <Link to={`/orders?open=${openTxn.orderId}`} className="wallet-drawer-link">
                      {openTxn.orderId}
                    </Link>
                  </Fact>
                ) : null}
              </Facts>
            </Card>

            {openTxn.status === 'pending' ? (
              <p className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="info" size={16} /> Pending money isn’t spendable yet. Referral rewards become available once the friend’s first order is delivered.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  );
}
