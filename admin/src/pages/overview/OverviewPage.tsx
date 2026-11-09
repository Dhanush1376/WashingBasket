import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MiniSwitch } from '@/components/ui/Form';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { ago, change, money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { ORDER_STATUS, TONES } from '@/lib/status';
import { useOperationalLocation } from '@/hooks/useOperationalLocation';
import { useLaundryState } from '@/laundry/store';
import { dashboardApi, type ActivityKind, type Dashboard } from '@/services';
import { setLocationStatus } from '@customer/mock/services/locationService';
import { OrdersChart } from './OrdersChart';
import { RevenueChart } from './RevenueChart';

const ACTIVITY_ICON: Record<ActivityKind, IconName> = { order: 'bag', pickup: 'calendar', signup: 'user', wallet: 'wallet', support: 'headset' };

const LOCATION_ORDER: Record<string, number> = {
  'loc-nit': 1,
  'loc-lpu': 2,
  'loc-outside': 3,
};

function getStoreLogo(locId: string, name?: string): string {
  const id = locId.toLowerCase();
  const n = (name || '').toLowerCase();
  if (id === 'loc-nit' || n.includes('nit')) {
    return `${import.meta.env.BASE_URL}logos/nitj.png`;
  }
  if (id === 'loc-lpu' || n.includes('lpu') || n.includes('lovely')) {
    return `${import.meta.env.BASE_URL}logos/lpu.png`;
  }
  return `${import.meta.env.BASE_URL}logos/wb.png`;
}

export default function OverviewPage() {
  const dashboard = useQuery('dashboard', dashboardApi.getDashboard);
  const { label: locLabel, isFiltered, setLocation } = useOperationalLocation();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const d = dashboard.data;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description={
          <div className="customers-header-desc">
            <span className="customers-header-stat customers-header-stat--main">
              Today · <strong>{today}</strong>
            </span>
            {isFiltered ? (
              <span className="customers-header-stat customers-header-stat--orange">
                <span className="customers-stats-dot customers-stats-dot--orange" />
                Hub: <strong>{locLabel}</strong>
              </span>
            ) : null}
            {d ? (
              <>
                <span className="customers-header-stat customers-header-stat--orange">
                  <span className="customers-stats-dot customers-stats-dot--orange" />
                  <strong>{d.orders.active}</strong> Active Orders
                </span>
                <span className="customers-header-stat customers-header-stat--blue">
                  <span className="customers-stats-dot customers-stats-dot--blue" />
                  <strong>{d.pendingRequests}</strong> Pickups to Confirm
                </span>
                <span className="customers-header-stat customers-header-stat--green">
                  <span className="customers-stats-dot customers-stats-dot--green" />
                  <strong>{d.customers.total}</strong> Customers
                </span>
              </>
            ) : (
              <span className="customers-header-stat">Review items that need attention first.</span>
            )}
          </div>
        }
      />
      <QueryView query={dashboard} skeleton={<OverviewSkeleton />}>
        {(data) => <OverviewBody d={data} locLabel={locLabel} isFiltered={isFiltered} onClearLoc={() => setLocation('all')} />}
      </QueryView>
    </div>
  );
}

function OverviewBody({
  d,
  locLabel,
  isFiltered,
  onClearLoc,
}: {
  d: Dashboard;
  locLabel?: string;
  isFiltered?: boolean;
  onClearLoc?: () => void;
}) {
  const [activeChart, setActiveChart] = useState<'orders' | 'revenue'>('orders');
  const [showAllAttention, setShowAllAttention] = useState(false);
  const totalRev14 = d.ordersByDay.reduce((s, x) => s + x.revenue, 0);
  const totalOrders14 = d.ordersByDay.reduce((s, x) => s + x.count, 0);
  const aov = totalOrders14 > 0 ? Math.round(totalRev14 / totalOrders14) : 0;

  return (
    <div className="overview-layout">
      {isFiltered && (
        <div className="location-filter-banner">
          <div className="location-filter-banner__left">
            <div className="location-filter-banner__icon-wrap">
              <Icon name="mapPin" size={17} />
            </div>
            <div className="location-filter-banner__content">
              <div className="location-filter-banner__headline">
                <span className="location-filter-banner__pill">
                  <span className="location-filter-banner__dot" />
                  Hub Active
                </span>
                <span className="location-filter-banner__name">{locLabel}</span>
              </div>
              <p className="location-filter-banner__sub">
                Hub-specific laundry operations, orders, and pickups isolated for <strong>{locLabel}</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="location-filter-banner__btn"
            onClick={onClearLoc}
            title="Switch to All locations"
          >
            <Icon name="x" size={13} strokeWidth={2.4} />
            <span>Switch to All locations</span>
          </button>
        </div>
      )}

      {/* ── 3 Locations Store Availability Toggles ── */}
      <DashboardLocationToggles />

      <DashboardHero d={d} />

      <div className="overview-grid">
        <div className="overview-grid__main">
          {/* Mobile Chart Segment Toggle: Switch between Orders & Revenue on small screens */}
          <div className="mobile-chart-tabs" role="tablist" aria-label="Overview charts">
            <button
              type="button"
              role="tab"
              aria-selected={activeChart === 'orders'}
              className={`mobile-chart-tab${activeChart === 'orders' ? ' mobile-chart-tab--on' : ''}`}
              onClick={() => setActiveChart('orders')}
            >
              <Icon name="bag" size={14} />
              <span>Orders (14d)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeChart === 'revenue'}
              className={`mobile-chart-tab${activeChart === 'revenue' ? ' mobile-chart-tab--on' : ''}`}
              onClick={() => setActiveChart('revenue')}
            >
              <Icon name="receipt" size={14} />
              <span>Revenue (14d)</span>
            </button>
          </div>

          <div className="overview-charts-pair">
            <div className={`overview-chart-panel${activeChart !== 'orders' ? ' overview-chart-panel--hide-mobile' : ''}`}>
              <Card className="overview-grid__chart" aria-labelledby="chart-title">
                <CardHeader id="chart-title" title="Orders, last 14 days" hint={`${d.orders.placedLast30} orders in last 30d (${d.orders.placedPrev30} prev)`} />
                <OrdersChart days={d.ordersByDay} />
              </Card>
            </div>

            <div className={`overview-chart-panel${activeChart !== 'revenue' ? ' overview-chart-panel--hide-mobile' : ''}`}>
              <Card className="overview-card-revenue" aria-labelledby="rev-chart-title">
                <CardHeader
                  id="rev-chart-title"
                  title="Revenue, last 14 days"
                  hint={`${money(totalRev14)} total · avg ${money(aov)}/order`}
                  icon="receipt"
                />
                <RevenueChart days={d.ordersByDay} />
              </Card>
            </div>
          </div>
        </div>

        <aside className="overview-grid__aside">
          <Card className="overview-col-card overview-attention-card" aria-labelledby="attention-title">
            <CardHeader id="attention-title" title="Needs your attention" hint="Sorted by customer priority" icon="bell" />
            {d.attention.length ? (
              <>
                <ul className="attention">
                  {(showAllAttention ? d.attention : d.attention.slice(0, 8)).map((a) => (
                    <li key={a.id}>
                      <Link to={a.link} className="attention__item">
                        <span className="attention__dot" style={{ background: TONES[a.tone].fg }} aria-hidden />
                        <span className="attention__text">
                          <strong>{a.title}</strong>
                          <span>{a.detail}</span>
                        </span>
                        <span className="attention__action">
                          {a.action} <Icon name="chevronRight" size={14} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {d.attention.length > 8 && !showAllAttention ? (
                  <button
                    type="button"
                    className="attention__expand-btn"
                    onClick={() => setShowAllAttention(true)}
                  >
                    View all {d.attention.length} items <Icon name="chevronDown" size={14} />
                  </button>
                ) : null}
              </>
            ) : (
              <EmptyState compact icon="check" title="You’re all caught up" message="No pickups to confirm, late orders or unanswered help requests." />
            )}
          </Card>
        </aside>
      </div>

      <div className="overview-row-three">
        <Card className="overview-col-card" aria-labelledby="pipeline-title">
          <CardHeader id="pipeline-title" title="Where orders are now" hint="Every order that isn’t delivered yet" action={<ButtonLink to="/orders?status=active" size="sm" iconRight="arrowRight">All orders</ButtonLink>} />
          <ul className="pipeline">
            {d.pipeline.map((p) => {
              const max = Math.max(1, ...d.pipeline.map((x) => x.count));
              return (
                <li key={p.status}>
                  <Link to={`/orders?status=${p.status}`} className="pipeline__row">
                    <span className="pipeline__label">{ORDER_STATUS[p.status].label}</span>
                    <span className="pipeline__bar" aria-hidden>
                      <span style={{ width: `${(p.count / max) * 100}%` }} />
                    </span>
                    <span className="pipeline__count num">{p.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="overview-col-card" aria-labelledby="activity-title">
          <CardHeader id="activity-title" title="Recent activity" hint="The latest things that happened" />
          <ul className="activity">
            {d.activity.map((a) => (
              <li key={a.id}>
                <Link to={a.link} className="activity__item">
                  <span className={`activity__icon activity__icon--${a.kind}`}>
                    <Icon name={ACTIVITY_ICON[a.kind]} size={16} />
                  </span>
                  <span className="activity__text">
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </span>
                  <time className="activity__time" dateTime={a.at}>
                    {ago(a.at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overview-col-card" aria-labelledby="services-title">
          <CardHeader id="services-title" title="Most booked services" hint="Last 30 days" action={<ButtonLink to="/services" size="sm" iconRight="arrowRight">Prices</ButtonLink>} />
          {d.topServices.length ? (
            <ul className="top-services">
              {d.topServices.map((s, i) => (
                <li key={s.name}>
                  <span className="top-services__rank">{i + 1}</span>
                  <span className="grow">{s.name}</span>
                  <span className="strong num">{s.count}</span>
                  <span className="muted">{s.count === 1 ? 'order' : 'orders'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon="list" title="No orders yet" message="Services will be ranked here once customers book." />
          )}
        </Card>
      </div>
    </div>
  );
}

function DashboardLocationToggles() {
  const state = useLaundryState();
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rawLocations = state?.locations ?? [];
  const locations = [...rawLocations].sort(
    (a, b) => (LOCATION_ORDER[a.id] ?? a.sortOrder) - (LOCATION_ORDER[b.id] ?? b.sortOrder)
  );

  const openCount = locations.filter((l) => l.status === 'ACTIVE').length;

  const toggle = async (id: string, active: boolean, name: string) => {
    setBusyId(id);
    try {
      await setLocationStatus(id, active ? 'ACTIVE' : 'PAUSED');
      show(
        'success',
        active ? `${name} store is now OPEN` : `${name} store is now CLOSED`,
        active
          ? 'Store is taking orders and bookable on the customer app.'
          : 'Store is temporarily closed. New customer orders are paused.'
      );
    } catch (e) {
      show('error', 'Update failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  if (!locations.length) return null;

  return (
    <div className="dash-stores-bar" role="region" aria-label="3 Locations store open and close controls">
      <div className="dash-stores-bar__head">
        <div className="dash-stores-bar__title-wrap">
          <span className="dash-stores-bar__icon" aria-hidden>
            <Icon name="mapPin" size={16} />
          </span>
          <div className="dash-stores-bar__titles">
            <span className="dash-stores-bar__title">Store Availability</span>
            <span className="dash-stores-bar__sub">
              {openCount === locations.length
                ? 'All 3 stores open & taking orders'
                : `${openCount} of ${locations.length} stores open · ${locations.length - openCount} closed`}
            </span>
          </div>
        </div>
        <Link to="/laundry/locations" className="dash-stores-bar__link" title="Manage all store locations & staff">
          <span>Manage hubs</span>
          <Icon name="arrowRight" size={13} />
        </Link>
      </div>

      <div className="dash-stores-bar__grid">
        {locations.map((loc) => {
          const isOpen = loc.status === 'ACTIVE';
          const isBusy = busyId === loc.id;

          return (
            <div
              key={loc.id}
              className={`dash-store-card${isOpen ? ' dash-store-card--open' : ' dash-store-card--closed'}`}
            >
              <div className="dash-store-card__lead">
                <span className={`dash-store-card__icon-squircle dash-store-card__icon-squircle--${loc.id}`} aria-hidden>
                  <img
                    src={getStoreLogo(loc.id, loc.shortName || loc.name)}
                    alt={loc.name}
                    className="dash-store-card__logo-img"
                  />
                </span>
                <div className="dash-store-card__text">
                  <div className="dash-store-card__name-row">
                    <strong className="dash-store-card__name">{loc.shortName || loc.name}</strong>
                    <span className="dash-store-card__pin">PIN {loc.pincode}</span>
                  </div>
                  <div className="dash-store-card__status-row">
                    <span className={`dash-store-card__dot${isOpen ? ' dash-store-card__dot--open' : ''}`} />
                    <span className="dash-store-card__status-text">
                      {isOpen ? 'Open · Taking orders' : 'Closed · Paused'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="dash-store-card__switch">
                <MiniSwitch
                  checked={isOpen}
                  disabled={isBusy}
                  onChange={(active) => toggle(loc.id, active, loc.shortName || loc.name)}
                  label={`Toggle store open or close for ${loc.name}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardHero({ d }: { d: Dashboard }) {
  const revTrend = change(d.revenue.last30, d.revenue.prev30);

  return (
    <div className="customers-stats-bar" role="region" aria-label="Dashboard summary statistics bar">
      {/* ── 1. Dark Card: Orders in progress matching Customers Bar Segment 1 ── */}
      <Link
        to="/orders?status=active"
        className="customers-stats-bar__item customers-stats-bar__item--dark"
        title="View active orders in progress"
      >
        <div className="overview-sub-card__top">
          <span className="overview-tag overview-tag--dark">
            <span
              className={`overview-tag__dot ${
                d.orders.overdue ? 'overview-tag__dot--orange' : d.orders.active ? 'overview-tag__dot--green' : ''
              }`}
              style={!d.orders.overdue && !d.orders.active ? { background: 'rgba(255,255,255,0.4)' } : undefined}
            />
            {d.orders.overdue ? 'Needs attention' : 'In progress'}
          </span>
          <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
            <Icon name="truck" size={17} />
          </span>
        </div>
        <div className="overview-sub-card__bottom">
          <span className="overview-sub-card__value overview-sub-card__value--white">{d.orders.active}</span>
          <span className="overview-sub-card__caption overview-sub-card__caption--dark">
            {d.orders.overdue ? (
              <span className="overview-sub-card__alert">{d.orders.overdue} overdue</span>
            ) : (
              'All on time'
            )}
          </span>
        </div>
      </Link>

      {/* ── 2. Orange Card: Pickups to confirm matching Customers Bar Segment 2 ── */}
      <Link
        to="/pickups?status=pending"
        className="customers-stats-bar__item customers-stats-bar__item--orange"
        title="View pending pickups waiting confirmation"
      >
        <div className="overview-sub-card__top">
          <span className="overview-tag overview-tag--orange">Pickups to confirm</span>
          <span className="overview-sub-card__icon-circle" aria-hidden>
            <Icon name="calendar" size={15} />
          </span>
        </div>
        <div className="overview-sub-card__bottom">
          <span className="overview-sub-card__value">{d.pendingRequests}</span>
          <span className="overview-sub-card__caption">
            {d.pendingRequests ? 'Waiting confirmation' : 'All confirmed'}
          </span>
        </div>
      </Link>

      {/* ── 3. White Card: Customers matching Customers Bar Segment 3 ── */}
      <Link
        to="/customers"
        className="customers-stats-bar__item customers-stats-bar__item--light"
        title="View all registered customers"
      >
        <div className="overview-sub-card__top">
          <span className="overview-tag overview-tag--light">
            <span className="overview-tag__dot overview-tag__dot--blue" />
            Customers
          </span>
          <span className="overview-sub-card__icon-squircle" aria-hidden>
            <Icon name="users" size={17} />
          </span>
        </div>
        <div className="overview-sub-card__bottom">
          <span className="overview-sub-card__value">{d.customers.total}</span>
          <span className="overview-sub-card__caption">
            {d.customers.activeLast30} active this month
          </span>
        </div>
      </Link>

      {/* ── 4. White Card: Revenue (30d) matching Customers Bar Segment 4 ── */}
      <Link
        to="/orders?status=completed"
        className="customers-stats-bar__item customers-stats-bar__item--light"
        title="View completed orders and revenue"
      >
        <div className="overview-sub-card__top">
          <span className="overview-tag overview-tag--success">
            <span className="overview-tag__dot overview-tag__dot--green" />
            Revenue (30d)
          </span>
          <span className="overview-sub-card__icon-squircle" aria-hidden>
            <Icon name="receipt" size={17} />
          </span>
        </div>
        <div className="overview-sub-card__bottom">
          <span className="overview-sub-card__value">{money(d.revenue.last30)}</span>
          <span className="overview-sub-card__trend" style={revTrend !== null && revTrend < 0 ? { color: '#DC2626' } : undefined}>
            {revTrend !== null ? (
              <>
                <Icon name={revTrend >= 0 ? 'arrowUp' : 'arrowDown'} size={12} strokeWidth={2.4} />
                {Math.abs(revTrend)}% vs last month
              </>
            ) : (
              <span className="muted">Completed orders</span>
            )}
          </span>
        </div>
      </Link>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="overview-layout" role="status" aria-label="Loading overview">
      <Skeleton height={124} radius={16} />
      <div className="overview-grid">
        <div className="overview-grid__main">
          <div className="overview-charts-pair">
            <Skeleton height={270} radius={14} />
            <Skeleton height={270} radius={14} />
          </div>
        </div>
        <aside className="overview-grid__aside">
          <Skeleton height={552} radius={14} />
        </aside>
      </div>
      <div className="overview-row-three">
        <Skeleton height={320} radius={14} />
        <Skeleton height={320} radius={14} />
        <Skeleton height={320} radius={14} />
      </div>
    </div>
  );
}
