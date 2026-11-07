import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { usePageParam, useUrlState, useViewMode } from '@/hooks/useUrlState';
import { matches, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { TICKET_STATUS } from '@/lib/status';
import { engagementApi, type TicketRow } from '@/services';
import { ContactCard, FaqManager } from './SupportEditors';
import { TicketDrawer } from './TicketDrawer';

type View = 'requests' | 'faqs' | 'contact';
type Filter = 'all' | 'waiting' | 'in-discussion' | 'resolved';

function exportTicketsToCsv(data: TicketRow[]) {
  if (!data.length) return;
  const headers = [
    'Ticket ID',
    'Customer Name',
    'Subject',
    'Category',
    'Order ID',
    'Status',
    'Last Reply By',
    'Created At',
  ];
  const csvRows = data.map((t) => {
    const lastFrom = t.replies[t.replies.length - 1]?.from ?? 'customer';
    return [
      `"${t.id}"`,
      `"${t.customerName.replace(/"/g, '""')}"`,
      `"${t.subject.replace(/"/g, '""')}"`,
      `"${t.categoryTitle.replace(/"/g, '""')}"`,
      `"${t.orderId || ''}"`,
      `"${t.status}"`,
      `"${lastFrom}"`,
      `"${t.createdAt}"`,
    ];
  });
  const content = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `support-requests-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function SupportPage() {
  const support = useQuery('support', engagementApi.getSupport);
  const [view, setView] = useUrlState<View>('view', 'requests');
  const [filter, setFilter] = useUrlState<Filter>('status', 'all');
  const [category, setCategory] = useUrlState<string>('cat', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [openId, setOpenId] = useUrlState('open', '');
  const [viewMode, setViewMode] = useViewMode('layout', 'table');
  const [page, setPage] = usePageParam();
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const all = support.data?.tickets ?? [];
  const categories = support.data?.categories ?? [];

  // Metrics
  const lastFrom = (t: TicketRow) => t.replies[t.replies.length - 1]?.from ?? 'customer';
  const openCount = useMemo(() => all.filter((t) => t.status === 'open').length, [all]);
  const waitingCount = useMemo(
    () => all.filter((t) => t.status === 'open' && lastFrom(t) === 'customer').length,
    [all],
  );
  const inDiscussionCount = useMemo(
    () => all.filter((t) => t.status === 'open' && lastFrom(t) === 'team').length,
    [all],
  );
  const resolvedCount = useMemo(() => all.filter((t) => t.status === 'resolved').length, [all]);
  const resolutionRate = all.length ? Math.round((resolvedCount / all.length) * 100) : 100;

  // Filtered rows
  const rows = useMemo(() => {
    return all.filter((t) => {
      // Status filter
      if (filter === 'waiting' && (t.status !== 'open' || lastFrom(t) !== 'customer')) return false;
      if (filter === 'in-discussion' && (t.status !== 'open' || lastFrom(t) !== 'team')) return false;
      if (filter === 'resolved' && t.status !== 'resolved') return false;

      // Category filter
      if (category !== 'all' && t.categoryId !== category) return false;

      // Search
      return matches(q, t.subject, t.customerName, t.id, t.orderId, t.message, t.categoryTitle);
    });
  }, [all, filter, category, q]);

  const resetAll = () => {
    setFilter('all');
    setCategory('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || category !== 'all' || q.trim() !== '';

  const pageSize = 12;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );

  const openTicket = all.find((t) => t.id === openId) ?? null;

  const columns: Column<TicketRow>[] = [
    {
      key: 'subject',
      header: 'Request & Category',
      sortValue: (t) => t.subject,
      render: (t) => (
        <div className="cell-main__text">
          <span className="cell-main__title" style={{ fontSize: 13.5, color: '#013E86', fontWeight: 700 }}>
            {t.subject}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{t.id}</span>
            <span>&bull;</span>
            <span style={{ color: '#0A1C3E', fontWeight: 600 }}>{t.categoryTitle}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (t) => t.customerName,
      render: (t) => (
        <div className="cell-main">
          <Avatar name={t.customerName} size={34} />
          <div className="cell-main__text">
            <span className="cell-main__title" style={{ fontSize: 13.5 }}>{t.customerName}</span>
            <span className="cell-main__sub" style={{ fontSize: 11.5 }}>
              {t.replies.length} {t.replies.length === 1 ? 'message' : 'messages'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'order',
      header: 'Linked Order',
      sortValue: (t) => t.orderId ?? '',
      hideOnTablet: true,
      render: (t) =>
        t.orderId ? (
          <Link
            to={`/orders?open=${t.orderId}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12.5,
              fontWeight: 650,
              color: '#013E86',
              textDecoration: 'none',
              padding: '3px 8px',
              borderRadius: 6,
              background: '#EEF4FF',
            }}
            title="Open order in Orders directory"
          >
            <Icon name="bag" size={13} />
            {t.orderId}
          </Link>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => (t.status === 'open' ? (lastFrom(t) === 'customer' ? 0 : 1) : 2),
      render: (t) =>
        t.status === 'open' ? (
          lastFrom(t) === 'team' ? (
            <Tag tone="navy">You replied</Tag>
          ) : (
            <Tag tone="orange">Needs reply</Tag>
          )
        ) : (
          <StatusBadge size="sm" {...TICKET_STATUS[t.status]} />
        ),
    },
    {
      key: 'when',
      header: 'Activity',
      sortValue: (t) => t.createdAt,
      hideOnTablet: true,
      render: (t) => (
        <div className="cell-main__text">
          <span style={{ fontSize: 12.5, fontWeight: 550, color: '#334155' }}>
            {when(t.createdAt)}
          </span>
          <span className="cell-main__sub" style={{ fontSize: 11 }}>
            {lastFrom(t) === 'team' ? 'Staff responded' : 'Customer inquiry'}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => (
        <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center' }} title="Open discussion thread">
          <Icon name="chevronRight" size={15} />
        </span>
      ),
    },
  ];

  return (
    <div className="page customers-page">
      {/* ── 1. Page Header with Single-Line Live Stats Bar & View Switcher ── */}
      <PageHeader
        title={view === 'contact' ? 'Contact Details' : view === 'faqs' ? 'Common Questions' : 'Help Requests'}
        description={
          view === 'contact' ? (
            <div className="customers-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                Customer Support Channels
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                Live on mobile app
              </span>
              <span className="customers-header-stat customers-header-stat--orange">
                <span className="customers-stats-dot customers-stats-dot--orange" />
                Helpline &amp; Email
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                {support.data?.contact.hours || '8 AM – 9 PM'}
              </span>
            </div>
          ) : view === 'faqs' ? (
            <div className="customers-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                Frequently Asked Questions
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                {categories.length} Topics
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                Customer App Knowledgebase
              </span>
            </div>
          ) : (
            <div className="customers-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                <strong>{all.length}</strong> Total Tickets
              </span>
              <span className="customers-header-stat customers-header-stat--orange">
                <span className="customers-stats-dot customers-stats-dot--orange" />
                <strong>{waitingCount}</strong> Waiting on Staff
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{inDiscussionCount}</strong> In Discussion
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                <strong>{resolvedCount}</strong> Resolved
              </span>
            </div>
          )
        }
        actions={
          <div className="customers-view-toggle" style={{ height: 38 }} role="tablist" aria-label="Support navigation">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'requests'}
              className={`customers-view-toggle__btn${view === 'requests' ? ' is-active' : ''}`}
              onClick={() => setView('requests')}
            >
              <Icon name="headset" size={15} />
              <span className="customers-view-toggle__label">Requests {openCount > 0 ? `(${openCount})` : ''}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'faqs'}
              className={`customers-view-toggle__btn${view === 'faqs' ? ' is-active' : ''}`}
              onClick={() => setView('faqs')}
            >
              <Icon name="info" size={15} />
              <span className="customers-view-toggle__label">FAQs</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'contact'}
              className={`customers-view-toggle__btn${view === 'contact' ? ' is-active' : ''}`}
              onClick={() => setView('contact')}
            >
              <Icon name="mail" size={15} />
              <span className="customers-view-toggle__label">Contact Info</span>
            </button>
          </div>
        }
      />

      <QueryView query={support} skeleton={<SupportSkeleton />}>
        {() => (
          <>
            {view === 'faqs' ? (
              <div className="overview-layout">
                <FaqManager />
              </div>
            ) : view === 'contact' ? (
              <div className="overview-layout">
                {support.data ? <ContactCard contact={support.data.contact} /> : null}
              </div>
            ) : (
              <div className="overview-layout">
                {/* ── 2. Unified 4-Segment KPI Stats Bar (1:1 with Customers Page) ── */}
                <div className="customers-stats-bar" role="region" aria-label="Help requests statistics bar">
                  {/* Segment 1: Dark Navy - Awaiting Reply */}
                  <button
                    type="button"
                    className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'waiting' ? ' is-active' : ''}`}
                    onClick={() => setFilter(filter === 'waiting' ? 'all' : 'waiting')}
                    title="Filter tickets waiting for staff response"
                  >
                    <div className="overview-sub-card__top">
                      <span className="overview-tag overview-tag--dark">
                        <span className="overview-tag__dot overview-tag__dot--green" />
                        Needs reply
                      </span>
                      <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                        <Icon name="headset" size={17} />
                      </span>
                    </div>
                    <div className="overview-sub-card__bottom">
                      <span className="overview-sub-card__value overview-sub-card__value--white">{waitingCount}</span>
                      <span className="overview-sub-card__caption overview-sub-card__caption--dark">
                        {waitingCount > 0 ? (
                          <span className="overview-sub-card__alert">{waitingCount} customers awaiting response</span>
                        ) : (
                          'All customer messages answered'
                        )}
                      </span>
                    </div>
                  </button>

                  {/* Segment 2: Orange - Total Open / In Progress */}
                  <button
                    type="button"
                    className={`customers-stats-bar__item customers-stats-bar__item--orange${filter === 'in-discussion' ? ' is-active' : ''}`}
                    onClick={() => setFilter(filter === 'in-discussion' ? 'all' : 'in-discussion')}
                    title="Filter tickets currently being handled"
                  >
                    <div className="overview-sub-card__top">
                      <span className="overview-tag overview-tag--orange">In discussion</span>
                      <span className="overview-sub-card__icon-circle" aria-hidden>
                        <Icon name="clock" size={16} />
                      </span>
                    </div>
                    <div className="overview-sub-card__bottom">
                      <span className="overview-sub-card__value">{inDiscussionCount}</span>
                      <span className="overview-sub-card__caption">
                        {inDiscussionCount > 0 ? `${inDiscussionCount} active dialog threads` : 'No threads in progress'}
                      </span>
                    </div>
                  </button>

                  {/* Segment 3: Light - Resolved */}
                  <button
                    type="button"
                    className={`customers-stats-bar__item customers-stats-bar__item--light${filter === 'resolved' ? ' is-active' : ''}`}
                    onClick={() => setFilter(filter === 'resolved' ? 'all' : 'resolved')}
                    title="Filter resolved tickets"
                  >
                    <div className="overview-sub-card__top">
                      <span className="overview-tag overview-tag--light">
                        <span className="overview-tag__dot overview-tag__dot--blue" />
                        Resolved
                      </span>
                      <span className="overview-sub-card__icon-squircle" aria-hidden>
                        <Icon name="check" size={17} />
                      </span>
                    </div>
                    <div className="overview-sub-card__bottom">
                      <span className="overview-sub-card__value">{resolvedCount}</span>
                      <span className="overview-sub-card__caption">
                        {resolvedCount > 0 ? `${resolvedCount} customer issues resolved` : 'No resolved tickets'}
                      </span>
                    </div>
                  </button>

                  {/* Segment 4: Light - Resolution Rate */}
                  <button
                    type="button"
                    className="customers-stats-bar__item customers-stats-bar__item--light"
                    onClick={resetAll}
                    title="Reset to all tickets"
                  >
                    <div className="overview-sub-card__top">
                      <span className="overview-tag overview-tag--success">
                        <span className="overview-tag__dot overview-tag__dot--green" />
                        Resolution rate
                      </span>
                      <span className="overview-sub-card__icon-squircle" aria-hidden>
                        <Icon name="chart" size={17} />
                      </span>
                    </div>
                    <div className="overview-sub-card__bottom">
                      <span className="overview-sub-card__value">{resolutionRate}%</span>
                      <span className="overview-sub-card__trend">
                        <Icon name="check" size={12} />
                        {resolvedCount} of {all.length} closed
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
                          placeholder="Search by subject, customer name, ticket ID, order ID..."
                          className="customers-search-input"
                          aria-label="Search help requests"
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
                        {/* Category Dropdown */}
                        <select
                          className="select--compact"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          aria-label="Filter by topic"
                          style={{
                            height: 38,
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 10,
                            border: '1.5px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            padding: '0 12px',
                            color: '#0A1C3E',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="all">All topics</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>

                        {/* Filters Toggle Button */}
                        <button
                          type="button"
                          className={`customers-ctrl-btn customers-ctrl-btn--filters${showFilterPanel || hasActiveFilters ? ' is-active' : ''}`}
                          onClick={() => setShowFilterPanel(!showFilterPanel)}
                          title="Filter requests"
                          aria-label="Filter requests"
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
                          onClick={() => exportTicketsToCsv(rows)}
                          title="Export filtered tickets to CSV"
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
                          <FilterPills<Filter>
                            label="Filter requests"
                            value={filter}
                            onChange={(v) => setFilter(v)}
                            options={[
                              { value: 'all', label: 'All requests', count: all.length },
                              { value: 'waiting', label: 'Waiting on staff', count: waitingCount },
                              { value: 'in-discussion', label: 'In discussion', count: inDiscussionCount },
                              { value: 'resolved', label: 'Resolved', count: resolvedCount },
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

                        {/* Topic chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Topic:</span>
                          <button
                            type="button"
                            className={`chip${category === 'all' ? ' chip--on' : ''}`}
                            onClick={() => setCategory('all')}
                            style={{ fontSize: 11.5, padding: '3px 8px' }}
                          >
                            All topics
                          </button>
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`chip${category === c.id ? ' chip--on' : ''}`}
                              onClick={() => setCategory(category === c.id ? 'all' : c.id)}
                              style={{ fontSize: 11.5, padding: '3px 8px' }}
                            >
                              {c.title}
                            </button>
                          ))}

                          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>
                            Showing <strong>{rows.length}</strong> of {all.length} requests
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* ── 4. Main Directory Card (Table or Grid View) ── */}
                <Card className="customers-directory-card" padded={false}>
                  {viewMode === 'table' ? (
                    <>
                      <div className="customers-table-scroll-hint" aria-hidden>
                        <Icon name="arrowRight" size={13} />
                        <span>Swipe horizontally for full table</span>
                      </div>
                      <DataTable
                        caption="Help requests directory"
                        rows={rows}
                        columns={columns}
                        rowKey={(t) => t.id}
                        initialSort={{ key: 'when', dir: 'desc' }}
                        onRowClick={(t) => setOpenId(t.id)}
                        rowLabel={(t) => `Open request ${t.subject}`}
                        selectedKey={openId || null}
                        page={page}
                        onPageChange={setPage}
                        pageSize={pageSize}
                        empty={
                          <EmptyState
                            icon="headset"
                            title={filter === 'waiting' && !q ? 'All caught up!' : 'No requests match your filters'}
                            message={
                              filter === 'waiting' && !q
                                ? 'No customer is currently waiting for a reply.'
                                : 'Try adjusting your search terms or clearing the filter pills.'
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
                        mobileCard={(t) => (
                          <div className="customer-grid-card customer-grid-card--mobile-row" onClick={() => setOpenId(t.id)}>
                            <div className="customer-grid-card__header">
                              <div className="customer-grid-card__user">
                                <Avatar name={t.customerName} size={36} />
                                <div className="customer-grid-card__info">
                                  <div className="customer-grid-card__name">{t.subject}</div>
                                  <div className="customer-grid-card__phone">
                                    {t.customerName} &bull; {t.categoryTitle}
                                  </div>
                                </div>
                              </div>
                              {t.status === 'open' ? (
                                lastFrom(t) === 'team' ? (
                                  <Tag tone="navy">Replied</Tag>
                                ) : (
                                  <Tag tone="orange">Needs reply</Tag>
                                )
                              ) : (
                                <StatusBadge size="sm" {...TICKET_STATUS[t.status]} />
                              )}
                            </div>
                            <div className="customer-grid-card__footer">
                              <div className="customer-grid-card__orders">
                                {t.orderId ? `Order: ${t.orderId}` : `${t.replies.length} replies`}
                              </div>
                              <div className="customer-grid-card__wallet">
                                {when(t.createdAt)}
                              </div>
                            </div>
                          </div>
                        )}
                      />
                    </>
                  ) : (
                    /* Grid / Cards Mode */
                    <div style={{ padding: 18 }}>
                      {rows.length === 0 ? (
                        <EmptyState
                          icon="headset"
                          title={filter === 'waiting' && !q ? 'All caught up!' : 'No requests match your filters'}
                          message={
                            filter === 'waiting' && !q
                              ? 'No customer is currently waiting for a reply.'
                              : 'Try adjusting your search terms or clearing the filter pills.'
                          }
                          action={
                            hasActiveFilters ? (
                              <button type="button" className="btn btn--subtle" onClick={resetAll}>
                                Clear filters
                              </button>
                            ) : undefined
                          }
                        />
                      ) : (
                        <>
                          <div className="customers-grid-view">
                            {pagedRows.map((t) => (
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
                                    <Avatar name={t.customerName} size={36} />
                                    <div className="customer-grid-card__info">
                                      <div className="customer-grid-card__name">{t.customerName}</div>
                                      <div className="customer-grid-card__phone">{t.categoryTitle}</div>
                                    </div>
                                  </div>
                                  {t.status === 'open' ? (
                                    lastFrom(t) === 'team' ? (
                                      <Tag tone="navy">You replied</Tag>
                                    ) : (
                                      <Tag tone="orange">Needs reply</Tag>
                                    )
                                  ) : (
                                    <StatusBadge size="sm" {...TICKET_STATUS[t.status]} />
                                  )}
                                </div>

                                <div style={{ margin: '10px 0 6px 0' }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A1C3E', lineHeight: 1.35, marginBottom: 4 }}>
                                    {t.subject}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: '#64748B',
                                      lineHeight: 1.45,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {t.message}
                                  </div>
                                </div>

                                <div className="customer-grid-card__footer">
                                  <div className="customer-grid-card__orders">
                                    {t.orderId ? (
                                      <span style={{ fontWeight: 600, color: '#013E86' }}>
                                        Order {t.orderId}
                                      </span>
                                    ) : (
                                      <span>{t.id}</span>
                                    )}
                                  </div>
                                  <div className="customer-grid-card__wallet" style={{ fontSize: 12 }}>
                                    {when(t.createdAt)}
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
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </QueryView>

      {/* Slide-out ticket drawer */}
      {openTicket ? <TicketDrawer ticket={openTicket} onClose={() => setOpenId('')} /> : null}
    </div>
  );
}

function SupportSkeleton() {
  return (
    <div className="overview-layout" role="status" aria-label="Loading help requests">
      <div style={{ marginTop: 10 }}>
        <Skeleton height={124} radius={16} />
      </div>
      <div style={{ marginTop: 14 }}>
        <Skeleton height={420} radius={14} />
      </div>
    </div>
  );
}
