import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Button';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { DataTable, type Column, Pagination } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { date, matches, money, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { REFERRAL_STATUS } from '@/lib/status';
import { engagementApi, type ReferralRow } from '@/services';
import type { ReferralProgramSettings, ReferralStatus } from '@/types';

type View = 'referrals' | 'settings';
type Filter = 'all' | ReferralStatus;

function ReferralsSkeleton() {
  return (
    <div className="overview-layout">
      <div className="skeleton" style={{ height: 108, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 60, borderRadius: 14 }} />
      <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
    </div>
  );
}

function exportReferralsToCsv(rows: ReferralRow[]) {
  const headers = ['Referral ID', 'Friend Name', 'Friend Customer ID', 'Invited By', 'Referrer ID', 'Date', 'Status', 'Reward Amount'];
  const csvRows = rows.map((r) => [
    r.id,
    `"${(r.friendName || '').replace(/"/g, '""')}"`,
    r.friendCustomerId ?? '',
    `"${(r.referrerName || '').replace(/"/g, '""')}"`,
    r.referrerId,
    r.date,
    r.status,
    r.reward,
  ]);
  const csvContent = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `referrals-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ReferralsPage() {
  const overview = useQuery('referrals', engagementApi.getReferralOverview);
  const [view, setView] = useUrlState<View>('view', 'referrals');
  const [viewMode, setViewMode] = useViewMode('mode', 'table');
  const [filter, setFilter] = useUrlState<Filter>('status', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [page, setPage] = usePageParam();
  const [openId, setOpenId] = useUrlState('open', '');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const pageSize = 12;

  const o = overview.data;
  const all = useMemo(() => o?.referrals ?? [], [o]);

  // Metrics
  const rewardedCount = useMemo(() => all.filter((r) => r.status === 'rewarded').length, [all]);
  const joinedCount = useMemo(() => all.filter((r) => r.status === 'joined').length, [all]);
  const invitedCount = useMemo(() => all.filter((r) => r.status === 'invited').length, [all]);

  // Filtered referrals
  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (q && !matches(q, r.referrerName, r.friendName, r.id)) return false;
      return true;
    });
  }, [all, filter, q]);

  const hasActiveFilters = filter !== 'all' || q.trim() !== '';

  const resetAll = () => {
    setFilter('all');
    setQ('');
  };

  const openReferral = all.find((r) => r.id === openId) ?? null;

  // Pagination for grid mode
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const columns: Column<ReferralRow>[] = [
    {
      key: 'friend',
      header: 'Friend',
      sortValue: (r) => r.friendName,
      render: (r) => (
        <div className="cell-main">
          <Avatar name={r.friendName} size={36} />
          <div className="cell-main__text">
            {r.friendCustomerId ? (
              <Link to={`/customers?open=${r.friendCustomerId}`} className="cell-main__title wallet-drawer-link">
                {r.friendName}
              </Link>
            ) : (
              <span className="cell-main__title">{r.friendName}</span>
            )}
            <span className="cell-main__sub">
              {r.friendCustomerId ? 'Registered Customer' : 'Invited contact'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'by',
      header: 'Invited by',
      sortValue: (r) => r.referrerName,
      render: (r) => (
        <div className="cell-main__text">
          <Link to={`/customers?open=${r.referrerId}`} style={{ fontWeight: 600, color: '#0A1C3E', textDecoration: 'none' }}>
            {r.referrerName}
          </Link>
          <span className="cell-main__sub">Ref ID: {r.id}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Invited on',
      sortValue: (r) => r.date,
      render: (r) => (
        <div className="cell-main__text">
          <span>{date(r.date)}</span>
          <span className="cell-main__sub">{when(r.date)}</span>
        </div>
      ),
      hideOnTablet: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge {...REFERRAL_STATUS[r.status]} />,
    },
    {
      key: 'reward',
      header: 'Reward',
      align: 'right',
      sortValue: (r) => r.reward,
      render: (r) => (
        <span
          className="num"
          style={{
            fontWeight: 700,
            fontSize: 14.5,
            color: r.status === 'rewarded' ? '#16A34A' : r.status === 'joined' ? '#EA580C' : '#64748B',
          }}
        >
          {r.status === 'rewarded' ? '+' : ''}
          {money(r.reward)}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="View referral details">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  return (
    <div className="page customers-page referrals-page">
      {/* ── Page Header (1:1 with Customers Page) ── */}
      <PageHeader
        title="Refer & Earn"
        description={
          o ? (
            <div className="customers-header-desc referrals-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                <strong>{all.length}</strong> Total Referrals
              </span>
              <span className="customers-header-stat customers-header-stat--orange">
                <span className="customers-stats-dot customers-stats-dot--orange" />
                <strong>{money(o.paid)}</strong> Rewards Paid
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                <strong>{money(o.waiting)}</strong> Rewards Waiting
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{money(o.program.rewardPerReferral)}</strong> Per Friend
              </span>
            </div>
          ) : (
            'Review referral invitations, reward payouts, and program rules.'
          )
        }
      />

      <QueryView query={overview} skeleton={<ReferralsSkeleton />}>
        {(ov) => (
          <div className="overview-layout">
            {/* ── 1. Unified Continuous Stats Bar (Matching Customers Stats Bar) ── */}
            <div className="customers-stats-bar referrals-stats-bar" role="region" aria-label="Referral summary statistics bar">
              {/* Segment 1: Dark Navy - Rewards Paid */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'rewarded' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('referrals');
                  setFilter(filter === 'rewarded' ? 'all' : 'rewarded');
                }}
                title="Filter successfully paid referral rewards"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--dark">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Rewards paid
                  </span>
                  <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                    <Icon name="gift" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value overview-sub-card__value--white">{money(ov.paid)}</span>
                  <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                    {rewardedCount > 0 ? (
                      <span className="overview-sub-card__alert">{rewardedCount} rewards credited</span>
                    ) : (
                      'Credited to customer wallets'
                    )}
                  </span>
                </div>
              </button>

              {/* Segment 2: Orange - Rewards Waiting */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'joined' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('referrals');
                  setFilter(filter === 'joined' ? 'all' : 'joined');
                }}
                title="Filter referrals awaiting first order delivery"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--orange">Rewards waiting</span>
                  <span className="overview-sub-card__icon-circle" aria-hidden>
                    <Icon name="clock" size={16} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(ov.waiting)}</span>
                  <span className="overview-sub-card__caption">
                    {joinedCount > 0 ? `${joinedCount} friends awaiting 1st order` : 'None waiting'}
                  </span>
                </div>
              </button>

              {/* Segment 3: Light - Friends Invited */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'all' && view === 'referrals' ? ' is-active' : ''}`}
                onClick={() => {
                  setView('referrals');
                  setFilter('all');
                }}
                title="View all invited referrals"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--light">
                    <span className="overview-tag__dot overview-tag__dot--blue" />
                    Friends invited
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="users" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{all.length}</span>
                  <span className="overview-sub-card__caption">
                    {all.length - invitedCount > 0 ? `${all.length - invitedCount} have joined so far` : 'Awaiting signups'}
                  </span>
                </div>
              </button>

              {/* Segment 4: Light - Reward Settings */}
              <button
                type="button"
                className={`customers-stats-bar__item customers-stats-bar__item--light${view === 'settings' ? ' is-active' : ''}`}
                onClick={() => {
                  setView(view === 'settings' ? 'referrals' : 'settings');
                }}
                title="Configure referral bonus rules"
              >
                <div className="overview-sub-card__top">
                  <span className="overview-tag overview-tag--success">
                    <span className="overview-tag__dot overview-tag__dot--green" />
                    Reward rules
                  </span>
                  <span className="overview-sub-card__icon-squircle" aria-hidden>
                    <Icon name="wallet" size={17} />
                  </span>
                </div>
                <div className="overview-sub-card__bottom">
                  <span className="overview-sub-card__value">{money(ov.program.rewardPerReferral)}</span>
                  <span className="overview-sub-card__trend">
                    <Icon name="gift" size={12} />
                    Friend gets {money(ov.program.welcomeReward)}
                  </span>
                </div>
              </button>
            </div>

            {/* ── 2. Combined Sticky Action Bar Card (Tabs + Search + Filters + View Mode + Export) ── */}
            <div className="customers-sticky-bar-wrapper">
              <div className="customers-action-card customers-action-card--combined">
                <div className="customers-action-bar customers-action-bar--combined">
                  {/* View Segment Tabs (Integrated directly inside the bar) */}
                  <div className="wallet-view-tabs wallet-view-tabs--inline" role="tablist" aria-label="Referral sections">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'referrals'}
                      className={`wallet-view-tab${view === 'referrals' ? ' is-active' : ''}`}
                      onClick={() => setView('referrals')}
                    >
                      <Icon name="gift" size={15} />
                      <span>All Referrals</span>
                      <span className="wallet-tab-count">{all.length}</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'settings'}
                      className={`wallet-view-tab${view === 'settings' ? ' is-active' : ''}`}
                      onClick={() => setView('settings')}
                    >
                      <Icon name="sliders" size={15} />
                      <span>Rewards & Rules</span>
                    </button>
                  </div>

                  {view === 'referrals' ? (
                    <div className="customers-action-bar-row2">
                      <div className="customers-search-box">
                        <Icon name="search" size={17} className="customers-search-icon" />
                        <input
                          type="search"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Search friend, referrer, or ID..."
                          className="customers-search-input"
                          aria-label="Search referrals"
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
                          title="Filter referrals"
                          aria-label="Filter referrals"
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
                          onClick={() => exportReferralsToCsv(filtered)}
                          title="Export referrals to CSV"
                        >
                          <Icon name="download" size={15} />
                          <span className="customers-ctrl-btn__label">Export</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Quick Filter Drawer */}
                {view === 'referrals' && showFilterPanel ? (
                  <div className="customers-filter-drawer">
                    <FilterPills<Filter>
                      label="Filter by status"
                      value={filter}
                      onChange={(v) => setFilter(v)}
                      options={[
                        { value: 'all', label: 'All', count: all.length },
                        { value: 'rewarded', label: 'Reward paid', count: rewardedCount },
                        { value: 'joined', label: 'Joined, reward waiting', count: joinedCount },
                        { value: 'invited', label: 'Invited', count: invitedCount },
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

            {view === 'settings' ? (
              /* Program Settings View */
              <div style={{ marginTop: 12 }}>
                <ProgramCard program={ov.program} />
              </div>
            ) : (
              <>
                {/* ── 3. Directory Card Container (Exactly like Customers Directory Card) ── */}
                <Card className="customers-directory-card" padded={false}>
                  {viewMode === 'table' ? (
                    <>
                      <div className="customers-table-scroll-hint" aria-hidden>
                        <Icon name="arrowRight" size={13} />
                        <span>Swipe horizontally for full table</span>
                      </div>
                      <DataTable
                        caption="Referrals activity"
                        rows={filtered}
                        columns={columns}
                        rowKey={(r) => r.id}
                        initialSort={{ key: 'date', dir: 'desc' }}
                        onRowClick={(r) => setOpenId(r.id)}
                        rowLabel={(r) => `Open referral for ${r.friendName}`}
                        selectedKey={openId || null}
                        page={page}
                        onPageChange={setPage}
                        pageSize={pageSize}
                        mobileCard={(r) => (
                          <div className="customer-grid-card customer-grid-card--mobile-row">
                            <div className="customer-grid-card__header">
                              <div className="customer-grid-card__user">
                                <Avatar name={r.friendName} size={38} />
                                <div className="customer-grid-card__info">
                                  <div className="customer-grid-card__name">{r.friendName}</div>
                                  <div className="customer-grid-card__phone">Invited by {r.referrerName}</div>
                                </div>
                              </div>
                              <StatusBadge size="sm" {...REFERRAL_STATUS[r.status]} />
                            </div>

                            <div className="customer-grid-card__details">
                              <span className="customer-grid-card__area">
                                <Icon name="calendar" size={12} /> {date(r.date)}
                              </span>
                              <span className="soft" style={{ fontSize: 12 }}>
                                {when(r.date)}
                              </span>
                            </div>

                            <div className="customer-grid-card__footer">
                              <div className="customer-grid-card__orders">Referral ID: {r.id}</div>
                              <div
                                className="customer-grid-card__wallet"
                                style={{ color: r.status === 'rewarded' ? '#16A34A' : r.status === 'joined' ? '#EA580C' : '#64748B' }}
                              >
                                {r.status === 'rewarded' ? '+' : ''}
                                {money(r.reward)}
                              </div>
                            </div>
                          </div>
                        )}
                        empty={<EmptyState icon="gift" title="No referrals match" message="Try another filter or clear the search." />}
                      />
                    </>
                  ) : (
                    <>
                      {filtered.length === 0 ? (
                        <div className="customers-grid-empty">
                          <EmptyState
                            icon="gift"
                            title="No referrals match"
                            message={hasActiveFilters ? 'No referrals match your search or filters.' : 'No referral invitations yet.'}
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
                                    <Avatar name={r.friendName} size={40} />
                                    <div className="customer-grid-card__info">
                                      <div className="customer-grid-card__name">{r.friendName}</div>
                                      <div className="customer-grid-card__phone">Invited by {r.referrerName}</div>
                                    </div>
                                  </div>
                                  <StatusBadge size="sm" {...REFERRAL_STATUS[r.status]} />
                                </div>

                                <div className="customer-grid-card__details">
                                  <span className="customer-grid-card__area">
                                    <Icon name="calendar" size={12} /> {date(r.date)}
                                  </span>
                                  <span className="soft" style={{ fontSize: 12 }}>
                                    {when(r.date)}
                                  </span>
                                </div>

                                <div className="customer-grid-card__footer">
                                  <div className="customer-grid-card__orders">ID: {r.id}</div>
                                  <div
                                    className="customer-grid-card__wallet"
                                    style={{
                                      fontSize: 15,
                                      color: r.status === 'rewarded' ? '#16A34A' : r.status === 'joined' ? '#EA580C' : '#64748B',
                                    }}
                                  >
                                    {r.status === 'rewarded' ? '+' : ''}
                                    {money(r.reward)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {filtered.length > pageSize ? (
                            <Pagination
                              page={currentPage}
                              pages={totalPages}
                              total={filtered.length}
                              pageSize={pageSize}
                              onChange={setPage}
                            />
                          ) : null}
                        </>
                      )}
                    </>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </QueryView>

      {/* ── 4. Slide-over Referral Details Drawer ── */}
      <Drawer
        open={!!openReferral}
        onClose={() => setOpenId('')}
        title={openReferral?.friendName ? `Referral: ${openReferral.friendName}` : 'Referral Details'}
        subtitle={openReferral ? openReferral.id : undefined}
        width={480}
      >
        {openReferral ? (
          <>
            <Card tone={openReferral.status === 'rewarded' ? 'white' : 'stone'} className="txn-hero">
              <span className="muted">{REFERRAL_STATUS[openReferral.status].label}</span>
              <strong
                className="txn-hero__amount num"
                style={{
                  color: openReferral.status === 'rewarded' ? '#16A34A' : openReferral.status === 'joined' ? '#EA580C' : '#0A1C3E',
                }}
              >
                {money(openReferral.reward)}
              </strong>
              <StatusBadge {...REFERRAL_STATUS[openReferral.status]} />
            </Card>

            <Card>
              <Facts>
                <Fact label="Friend">
                  {openReferral.friendCustomerId ? (
                    <Link to={`/customers?open=${openReferral.friendCustomerId}`} className="wallet-drawer-link">
                      {openReferral.friendName}
                    </Link>
                  ) : (
                    openReferral.friendName
                  )}
                </Fact>
                <Fact label="Invited by">
                  <Link to={`/customers?open=${openReferral.referrerId}`} className="wallet-drawer-link">
                    {openReferral.referrerName}
                  </Link>
                </Fact>
                <Fact label="Date invited">
                  {date(openReferral.date)} ({when(openReferral.date)})
                </Fact>
                <Fact label="Referral ID">
                  <span className="mono">{openReferral.id}</span>
                </Fact>
                <Fact label="Reward amount">
                  <span className="strong num">{money(openReferral.reward)}</span>
                </Fact>
              </Facts>
            </Card>

            {openReferral.status === 'joined' ? (
              <p className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="info" size={16} /> The friend has registered! The {money(openReferral.reward)} referral reward will be automatically credited to {openReferral.referrerName} once the friend's first order is successfully delivered.
              </p>
            ) : openReferral.status === 'invited' ? (
              <p className="note" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="info" size={16} /> This referral is currently pending sign up. The reward will trigger when the friend registers with their referral code and completes an order.
              </p>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </div>
  );
}

function ProgramCard({ program }: { program: ReferralProgramSettings }) {
  const { run, isBusy } = useAction();
  const toForm = (p: ReferralProgramSettings) => ({
    reward: String(p.rewardPerReferral),
    welcome: String(p.welcomeReward),
    min: String(p.codeLength.min),
    max: String(p.codeLength.max),
    steps: [...p.steps],
  });
  const [v, setV] = useState(() => toForm(program));
  const [tried, setTried] = useState(false);
  useEffect(() => setV(toForm(program)), [program]);

  const n = { reward: Number(v.reward) || 0, welcome: Number(v.welcome) || 0, min: Number(v.min) || 6, max: Number(v.max) || 12 };

  const isDirty = useMemo(() => {
    return (
      v.reward !== String(program.rewardPerReferral) ||
      v.welcome !== String(program.welcomeReward) ||
      v.min !== String(program.codeLength.min) ||
      v.max !== String(program.codeLength.max) ||
      JSON.stringify(v.steps) !== JSON.stringify(program.steps)
    );
  }, [v, program]);

  const problems = {
    reward: !v.reward || n.reward < 1 || n.reward > 5000 ? 'Between ₹1 and ₹5,000' : undefined,
    welcome: v.welcome === '' || n.welcome > 5000 ? 'Between ₹0 and ₹5,000' : undefined,
    min: !v.min || n.min < 4 || n.min > 12 ? '4 to 12 letters' : undefined,
    max: !v.max || n.max < n.min || n.max > 16 ? `${n.min || 4} to 16 letters` : undefined,
    steps: v.steps.filter((s) => s.trim()).length < 1 ? 'Keep at least one step' : undefined,
  };
  const errors = tried ? problems : ({} as Partial<typeof problems>);

  const adjustReward = (delta: number) => {
    const cur = Number(v.reward) || 0;
    const next = Math.max(1, Math.min(5000, cur + delta));
    setV((prev) => ({ ...prev, reward: String(next) }));
  };

  const adjustWelcome = (delta: number) => {
    const cur = Number(v.welcome) || 0;
    const next = Math.max(0, Math.min(5000, cur + delta));
    setV((prev) => ({ ...prev, welcome: String(next) }));
  };

  const adjustMin = (delta: number) => {
    const cur = Number(v.min) || 6;
    const next = Math.max(4, Math.min(Math.min(12, n.max), cur + delta));
    setV((prev) => ({ ...prev, min: String(next) }));
  };

  const adjustMax = (delta: number) => {
    const cur = Number(v.max) || 12;
    const next = Math.max(Math.max(4, n.min), Math.min(16, cur + delta));
    setV((prev) => ({ ...prev, max: String(next) }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    await run(
      'program',
      () =>
        engagementApi.updateReferralProgram({
          rewardPerReferral: n.reward,
          welcomeReward: n.welcome,
          codeLength: { min: n.min, max: n.max },
          steps: v.steps.filter((s) => s.trim().length > 0),
        }),
      'Settings saved',
      'New referral rewards and steps are now active.',
    );
    setTried(false);
  };

  const setStep = (i: number, text: string) => setV({ ...v, steps: v.steps.map((s, j) => (j === i ? text : s)) });
  const moveStep = (i: number, d: -1 | 1) => {
    const steps = [...v.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    setV({ ...v, steps });
  };

  return (
    <Card className="customers-directory-card" padded>
      <div className="reward-settings-wrap">
        {/* Header */}
        <div className="reward-card-header">
          <div className="reward-card-header__left">
            <span className="reward-card-header__icon">
              <Icon name="sliders" size={17} />
            </span>
            <div>
              <h2 className="reward-card-header__title">Rewards & rules</h2>
              <p className="reward-card-header__sub">Amounts and steps for Refer & Earn</p>
            </div>
          </div>
          {isDirty ? (
            <span className="reward-status-pill reward-status-pill--dirty">
              ● Unsaved
            </span>
          ) : (
            <span className="reward-status-pill reward-status-pill--clean">
              <Icon name="check" size={13} strokeWidth={2.5} /> Active
            </span>
          )}
        </div>

        <form onSubmit={submit} noValidate>
          {/* 1. Two Clean Amount Cards */}
          <div className="reward-hero-cards">
            {/* Card 1: Customer gets */}
            <div className="reward-hero-card reward-hero-card--referrer">
              <div className="reward-hero-card__header">
                <span className="reward-hero-card__label">Customer gets</span>
                <span className="reward-hero-card__sublabel">Referrer</span>
              </div>

              <div className="reward-stepper-box">
                <button
                  type="button"
                  className="reward-stepper-btn"
                  onClick={() => adjustReward(-25)}
                  disabled={n.reward <= 25}
                  aria-label="Decrease customer reward"
                >
                  <Icon name="minus" size={15} strokeWidth={2.4} />
                </button>
                <div className="reward-stepper-input-wrap">
                  <span className="reward-stepper-rupee">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={v.reward}
                    onChange={(e) => setV({ ...v, reward: e.target.value.replace(/\D/g, '') })}
                    className="reward-stepper-input"
                    aria-label="Customer reward"
                  />
                </div>
                <button
                  type="button"
                  className="reward-stepper-btn"
                  onClick={() => adjustReward(25)}
                  disabled={n.reward >= 5000}
                  aria-label="Increase customer reward"
                >
                  <Icon name="plus" size={15} strokeWidth={2.4} />
                </button>
              </div>

              <div className="reward-presets">
                {[100, 150, 200, 250, 500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`reward-preset-btn${n.reward === amt ? ' reward-preset-btn--active' : ''}`}
                    onClick={() => setV({ ...v, reward: String(amt) })}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {errors.reward ? <p style={{ color: '#DC2626', fontSize: 11.5, margin: '2px 0 0', fontWeight: 600 }}>{errors.reward}</p> : null}
              <span className="reward-hero-card__caption">Credited on 1st delivery</span>
            </div>

            {/* Card 2: Friend gets */}
            <div className="reward-hero-card reward-hero-card--friend">
              <div className="reward-hero-card__header">
                <span className="reward-hero-card__label">Friend gets</span>
                <span className="reward-hero-card__sublabel">Welcome gift</span>
              </div>

              <div className="reward-stepper-box">
                <button
                  type="button"
                  className="reward-stepper-btn"
                  onClick={() => adjustWelcome(-25)}
                  disabled={n.welcome <= 0}
                  aria-label="Decrease friend gift"
                >
                  <Icon name="minus" size={15} strokeWidth={2.4} />
                </button>
                <div className="reward-stepper-input-wrap">
                  <span className="reward-stepper-rupee">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={v.welcome}
                    onChange={(e) => setV({ ...v, welcome: e.target.value.replace(/\D/g, '') })}
                    className="reward-stepper-input"
                    aria-label="Friend welcome gift"
                  />
                </div>
                <button
                  type="button"
                  className="reward-stepper-btn"
                  onClick={() => adjustWelcome(25)}
                  disabled={n.welcome >= 5000}
                  aria-label="Increase friend gift"
                >
                  <Icon name="plus" size={15} strokeWidth={2.4} />
                </button>
              </div>

              <div className="reward-presets">
                {[50, 75, 100, 150, 200].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`reward-preset-btn${n.welcome === amt ? ' reward-preset-btn--active' : ''}`}
                    onClick={() => setV({ ...v, welcome: String(amt) })}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {errors.welcome ? <p style={{ color: '#DC2626', fontSize: 11.5, margin: '2px 0 0', fontWeight: 600 }}>{errors.welcome}</p> : null}
              <span className="reward-hero-card__caption">Credited on signup</span>
            </div>
          </div>

          {/* Row 2: Code Length (Left) + Steps Editor (Right) Side-by-Side */}
          <div className="reward-sections-row">
            {/* 2. Referral Code Length */}
            <div className="reward-section-card">
              <div className="reward-section-card__head">
                <span className="reward-section-card__title">Referral code length</span>
                <span className="reward-code-range-pill">{n.min}–{n.max} chars</span>
              </div>
              <div className="reward-code-steppers">
                <div className="reward-code-box">
                  <div className="reward-code-box__label-wrap">
                    <span className="reward-code-box__label">Shortest</span>
                    <span className="reward-code-box__sub">Min length</span>
                  </div>
                  <div className="reward-code-box__stepper">
                    <button
                      type="button"
                      className="reward-code-btn"
                      onClick={() => adjustMin(-1)}
                      disabled={n.min <= 4}
                      aria-label="Decrease minimum length"
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <span className="reward-code-val">{n.min} letters</span>
                    <button
                      type="button"
                      className="reward-code-btn"
                      onClick={() => adjustMin(1)}
                      disabled={n.min >= Math.min(12, n.max)}
                      aria-label="Increase minimum length"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </div>
                </div>

                <div className="reward-code-box">
                  <div className="reward-code-box__label-wrap">
                    <span className="reward-code-box__label">Longest</span>
                    <span className="reward-code-box__sub">Max length</span>
                  </div>
                  <div className="reward-code-box__stepper">
                    <button
                      type="button"
                      className="reward-code-btn"
                      onClick={() => adjustMax(-1)}
                      disabled={n.max <= Math.max(4, n.min)}
                      aria-label="Decrease maximum length"
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <span className="reward-code-val">{n.max} letters</span>
                    <button
                      type="button"
                      className="reward-code-btn"
                      onClick={() => adjustMax(1)}
                      disabled={n.max >= 16}
                      aria-label="Increase maximum length"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="reward-code-preview-tip">
                <span className="reward-code-preview-tip__badge">Example</span>
                <span>Codes are generated with {n.min} to {n.max} letters (e.g. <code>WASH88</code>)</span>
              </div>
            </div>

            {/* 3. Steps Editor */}
            <div className="reward-section-card">
              <div className="reward-section-card__head">
                <span className="reward-section-card__title">How it works (in customer app)</span>
                <span className="reward-code-range-pill">{v.steps.length} steps</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {v.steps.map((s, i) => (
                  <div key={i} className="reward-step-item">
                    <span className="reward-step-badge">{i + 1}</span>
                    <input
                      type="text"
                      value={s}
                      maxLength={90}
                      placeholder={`Step ${i + 1}`}
                      onChange={(e) => setStep(i, e.target.value)}
                      className="reward-step-input"
                      aria-label={`Step ${i + 1}`}
                    />
                    <div className="reward-step-actions">
                      <IconButton
                        icon="arrowUp"
                        label="Move up"
                        size={26}
                        disabled={i === 0}
                        onClick={() => moveStep(i, -1)}
                      />
                      <IconButton
                        icon="arrowDown"
                        label="Move down"
                        size={26}
                        disabled={i === v.steps.length - 1}
                        onClick={() => moveStep(i, 1)}
                      />
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label="Remove"
                        size={26}
                        disabled={v.steps.length <= 1}
                        onClick={() => setV({ ...v, steps: v.steps.filter((_, j) => j !== i) })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {errors.steps ? <p style={{ color: '#DC2626', fontSize: 11.5, marginTop: 4, fontWeight: 600 }}>{errors.steps}</p> : null}

              {v.steps.length < 5 ? (
                <button
                  type="button"
                  className="reward-add-step-btn"
                  onClick={() => setV({ ...v, steps: [...v.steps, ''] })}
                >
                  <Icon name="plus" size={14} strokeWidth={2.4} />
                  Add step
                </button>
              ) : null}
            </div>
          </div>

          {/* 4. Actions Footer */}
          <div className="reward-footer-bar">
            <button
              type="button"
              className="reward-undo-btn"
              onClick={() => {
                setV(toForm(program));
                setTried(false);
              }}
              disabled={!isDirty}
            >
              <Icon name="refresh" size={14} />
              Undo changes
            </button>

            <button
              type="submit"
              className="reward-save-btn"
              disabled={isBusy('program')}
            >
              <Icon name="check" size={15} strokeWidth={2.4} />
              {isBusy('program') ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
