import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { MiniSwitch } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useAction } from '@/hooks/useAction';
import { useUrlState } from '@/hooks/useUrlState';
import { matches } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { TONES } from '@/lib/status';
import { schedulingApi, type AreaRow } from '@/services';
import { AreaModal } from './ScheduleModals';

type AreaFilter = 'all' | 'active' | 'paused';
type HubFilter = 'all' | 'loc-nit' | 'loc-lpu' | 'loc-outside';
type ViewMode = 'cards' | 'table';

const HUBS_META: Record<
  string,
  {
    name: string;
    tag: string;
    logo: string;
    city: string;
    pincodes: string[];
  }
> = {
  'loc-nit': {
    name: 'NIT Jalandhar',
    tag: 'Tech Campus · Main Office',
    logo: `${import.meta.env.BASE_URL}logos/nitj.png`,
    city: 'Jalandhar, Punjab',
    pincodes: ['144011'],
  },
  'loc-lpu': {
    name: 'LPU Campus',
    tag: 'Campus Hub · Uni Mall Block 32',
    logo: `${import.meta.env.BASE_URL}logos/lpu.png`,
    city: 'Phagwara, Punjab',
    pincodes: ['144411', '144401'],
  },
  'loc-outside': {
    name: 'Model Town Store',
    tag: 'Central Store & 8 km Doorstep Delivery',
    logo: `${import.meta.env.BASE_URL}logos/wb.png`,
    city: 'Jalandhar, Punjab',
    pincodes: ['144003', '144022', '144001', '144005'],
  },
};

function resolveHubId(area: AreaRow): string {
  if (area.hubId && HUBS_META[area.hubId]) return area.hubId;
  if (area.pincode === '144011' || area.area.toLowerCase().includes('nit')) return 'loc-nit';
  if (area.pincode === '144411' || area.pincode === '144401' || area.city.toLowerCase().includes('phagwara') || area.area.toLowerCase().includes('lpu')) {
    return 'loc-lpu';
  }
  return 'loc-outside';
}

export default function ServiceAreasPage() {
  const [q, setQ] = useUrlState('q', '');
  const [hub, setHub] = useUrlState<HubFilter>('hub', 'all');
  const [status, setStatus] = useUrlState<AreaFilter>('status', 'all');
  const [view, setView] = useUrlState<ViewMode>('view', 'cards');

  const areas = useQuery('areas', schedulingApi.listServiceAreas);

  const [editingArea, setEditingArea] = useState<AreaRow | 'new' | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaRow | null>(null);

  const { run } = useAction();

  const areasData = areas.data ?? [];

  const activeCount = useMemo(() => areasData.filter((a) => a.active).length, [areasData]);
  const totalCustomers = useMemo(() => {
    if (hub === 'loc-nit') return 5;
    if (hub === 'loc-lpu') return 7;
    if (hub === 'loc-outside') return 12;
    return 24;
  }, [hub]);

  // Filtered areas
  const filtered = useMemo(() => {
    return areasData.filter((a) => {
      const areaHub = resolveHubId(a);
      if (hub !== 'all' && areaHub !== hub) return false;
      if (status === 'active' && !a.active) return false;
      if (status === 'paused' && a.active) return false;
      if (q.trim()) {
        const hubName = HUBS_META[areaHub]?.name ?? '';
        if (!matches(q, a.pincode, a.area, a.city, a.note ?? '', hubName)) return false;
      }
      return true;
    });
  }, [areasData, hub, status, q]);

  // Group by hub for Cards View
  const groupedByHub = useMemo(() => {
    const groups: Record<string, AreaRow[]> = {
      'loc-nit': [],
      'loc-lpu': [],
      'loc-outside': [],
    };
    filtered.forEach((a) => {
      const h = resolveHubId(a);
      if (!groups[h]) groups[h] = [];
      groups[h].push(a);
    });
    return groups;
  }, [filtered]);

  const resetAll = () => {
    setQ('');
    setHub('all');
    setStatus('all');
  };

  const hasActiveFilters = q.trim() !== '' || hub !== 'all' || status !== 'all';

  return (
    <div className="page customers-page service-areas-page">
      {/* ── 1. Page Header with Single-Line Stats Bar ── */}
      <PageHeader
        title="Service Areas & PIN Coverage"
        description="Delivery radius, campus collection hubs, and active PIN code zones across Punjab"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/schedule" className="btn btn--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={15} />
              <span>Pickup schedule</span>
            </Link>
            <Button variant="accent" icon="plus" onClick={() => setEditingArea('new')}>
              Add Service Area
            </Button>
          </div>
        }
      />

      {/* ── 2. Unified 4-Tile KPI Summary Bar ── */}
      <div className="customers-stats-bar" role="region" aria-label="Service areas statistics overview bar">
        {/* Tile 1: Active Coverage Zones */}
        <div className="customers-stats-bar__item customers-stats-bar__item--dark">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--dark">
              <span className="overview-tag__dot overview-tag__dot--green" />
              Collecting Active
            </span>
            <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
              <Icon name="mapPin" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">
              {activeCount} of {areasData.length}
            </span>
            <span className="overview-sub-card__caption">
              {areasData.length - activeCount === 0
                ? 'All PIN codes accepting pickups'
                : `${areasData.length - activeCount} zone currently paused`}
            </span>
          </div>
        </div>

        {/* Tile 2: Total Registered Customers */}
        <div className="customers-stats-bar__item customers-stats-bar__item--orange">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--orange">Customers</span>
            <span className="overview-sub-card__icon-circle" aria-hidden>
              <Icon name="users" size={15} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">{totalCustomers} Registered</span>
            <span className="overview-sub-card__caption">
              {hub === 'all' ? 'Across Jalandhar & Phagwara PINs' : `${HUBS_META[hub]?.name ?? 'Hub'} registered customers`}
            </span>
          </div>
        </div>

        {/* Tile 3: Operational Hub Territories */}
        <div className="customers-stats-bar__item customers-stats-bar__item--light">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--light">
              <span className="overview-tag__dot overview-tag__dot--blue" />
              Hub Territories
            </span>
            <span className="overview-sub-card__icon-squircle" aria-hidden>
              <Icon name="sparkle" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">3 Hubs Connected</span>
            <span className="overview-sub-card__caption">NIT Jalandhar · LPU · Model Town</span>
          </div>
        </div>

        {/* Tile 4: Doorstep Delivery Radius */}
        <div className="customers-stats-bar__item customers-stats-bar__item--light">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--success">
              <span className="overview-tag__dot overview-tag__dot--green" />
              Home Delivery
            </span>
            <span className="overview-sub-card__icon-squircle" aria-hidden>
              <Icon name="truck" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">8 km Radius</span>
            <span className="overview-sub-card__caption">Model Town central doorstep radius</span>
          </div>
        </div>
      </div>

      {/* ── 3. Sticky Action Bar: Hub Segmented Tabs, Search & Filters ── */}
      <div className="customers-sticky-bar-wrapper">
        <div className="svc-action-card">
          {/* Top Row: Visual Hub Selector Tabs with Logos */}
          <div className="svc-hub-tabs" role="tablist" aria-label="Filter areas by operating hub">
            <button
              type="button"
              role="tab"
              aria-selected={hub === 'all'}
              className={`svc-hub-tab${hub === 'all' ? ' svc-hub-tab--active' : ''}`}
              onClick={() => setHub('all')}
            >
              <span className="svc-hub-tab__icon">
                <Icon name="grid" size={15} />
              </span>
              <span className="svc-hub-tab__name">All Hubs</span>
              <span className="svc-hub-tab__count">{areasData.length}</span>
            </button>

            {(['loc-nit', 'loc-lpu', 'loc-outside'] as const).map((hId) => {
              const meta = HUBS_META[hId];
              const count = areasData.filter((a) => resolveHubId(a) === hId).length;
              return (
                <button
                  key={hId}
                  type="button"
                  role="tab"
                  aria-selected={hub === hId}
                  className={`svc-hub-tab${hub === hId ? ' svc-hub-tab--active' : ''}`}
                  onClick={() => setHub(hId)}
                >
                  <span className="svc-hub-tab__logo-squircle">
                    <img src={meta.logo} alt="" />
                  </span>
                  <span className="svc-hub-tab__name">{meta.name}</span>
                  <span className="svc-hub-tab__count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Row: Search, Status Filter & View Toggle */}
          <div className="svc-filter-row">
            {/* Search Box */}
            <div className="customers-search-box">
              <Icon name="search" size={17} className="customers-search-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search PIN code, area name, landmark or city..."
                className="customers-search-input"
                aria-label="Search service areas"
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

            {/* Status Pills */}
            <div className="svc-filter-controls">
              <div className="svc-status-pills" role="radiogroup" aria-label="Filter by collection status">
                <button
                  type="button"
                  className={`svc-status-pill${status === 'all' ? ' svc-status-pill--active' : ''}`}
                  onClick={() => setStatus('all')}
                >
                  <span>All Status</span>
                  <span className="svc-status-pill__count">{areasData.length}</span>
                </button>
                <button
                  type="button"
                  className={`svc-status-pill${status === 'active' ? ' svc-status-pill--active' : ''}`}
                  onClick={() => setStatus('active')}
                >
                  <span className="svc-status-dot svc-status-dot--green" />
                  <span>Collecting</span>
                  <span className="svc-status-pill__count">{activeCount}</span>
                </button>
                <button
                  type="button"
                  className={`svc-status-pill${status === 'paused' ? ' svc-status-pill--active' : ''}`}
                  onClick={() => setStatus('paused')}
                >
                  <span className="svc-status-dot svc-status-dot--amber" />
                  <span>Paused</span>
                  <span className="svc-status-pill__count">{areasData.length - activeCount}</span>
                </button>
              </div>

              <div className="svc-controls-divider" aria-hidden />

              {/* View Toggle */}
              <div className="customers-view-toggle" role="tablist" aria-label="Layout view mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'cards'}
                  className={`customers-view-toggle__btn${view === 'cards' ? ' is-active' : ''}`}
                  onClick={() => setView('cards')}
                  title="Card View by Hub"
                >
                  <Icon name="grid" size={15} />
                  <span className="customers-view-toggle__label">Cards</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'table'}
                  className={`customers-view-toggle__btn${view === 'table' ? ' is-active' : ''}`}
                  onClick={() => setView('table')}
                  title="Master Table Sheet"
                >
                  <Icon name="list" size={15} />
                  <span className="customers-view-toggle__label">Table</span>
                </button>
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
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

      {/* ── 4. Main Body: QueryView with Cards View or Master Table View ── */}
      <QueryView query={areas} skeleton={<SkeletonRows rows={5} height={56} />}>
        {() =>
          filtered.length === 0 ? (
            <Card>
              <EmptyState
                compact
                icon="mapPin"
                title={q || hub !== 'all' || status !== 'all' ? 'No matching service areas' : 'No service areas configured'}
                message={
                  q || hub !== 'all' || status !== 'all'
                    ? 'Try clearing your filters or search keywords.'
                    : 'Add PIN codes where you provide pickup and drop-off service.'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      Reset all filters
                    </Button>
                  ) : (
                    <Button variant="accent" size="sm" icon="plus" onClick={() => setEditingArea('new')}>
                      Add Service Area
                    </Button>
                  )
                }
              />
            </Card>
          ) : view === 'table' ? (
            /* ── Master Table Sheet ── */
            <Card>
              <CardHeader
                title="Service Areas Master Sheet"
                hint={`${filtered.length} areas matching current filters`}
                icon="list"
                action={
                  <Button size="sm" variant="accent" icon="plus" onClick={() => setEditingArea('new')}>
                    Add Area
                  </Button>
                }
              />
              <div className="svc-table-wrap">
                <table className="svc-table" aria-label="Service Areas Table">
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>PIN Code</th>
                      <th>Area Name</th>
                      <th>City / Region</th>
                      <th>Operating Hub</th>
                      <th>Customers</th>
                      <th>Landmark / Rider Note</th>
                      <th style={{ width: 130 }}>Status</th>
                      <th style={{ width: 130, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const hId = resolveHubId(a);
                      const hMeta = HUBS_META[hId];
                      return (
                        <tr key={a.pincode + a.area}>
                          <td>
                            <span className="schedule-area-card__pin-badge mono" style={{ display: 'inline-block' }}>
                              {a.pincode}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: 13.5, color: 'var(--navy-deep)' }}>{a.area}</strong>
                          </td>
                          <td style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>{a.city}</td>
                          <td>
                            <span className="svc-hub-chip">
                              <span className="svc-hub-chip__logo">
                                <img src={hMeta.logo} alt="" />
                              </span>
                              <span>{hMeta.name}</span>
                            </span>
                          </td>
                          <td>
                            {a.customers ? (
                              <span className="svc-customer-pill">
                                <Icon name="users" size={12} />
                                <strong>{a.customers}</strong>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--ink-muted)', fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 260, fontSize: 12, color: 'var(--ink-soft)' }}>
                            {a.note || <span style={{ color: 'var(--ink-muted)' }}>No rider note</span>}
                          </td>
                          <td>
                            <StatusBadge
                              size="sm"
                              label={a.active ? 'Collecting Active' : 'Paused'}
                              tone={a.active ? TONES.done : TONES.muted}
                            />
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                              <MiniSwitch
                                checked={a.active}
                                label={a.active ? `Stop collecting in ${a.area}` : `Start collecting in ${a.area}`}
                                onChange={(v) =>
                                  run(
                                    `area-${a.pincode}`,
                                    () => schedulingApi.saveServiceArea({ ...a, active: v }, a.pincode),
                                    v ? `Now collecting in ${a.area}` : `Stopped collecting in ${a.area}`,
                                  )
                                }
                              />
                              <IconButton
                                icon="edit"
                                label={`Edit ${a.area}`}
                                size={32}
                                onClick={() => setEditingArea(a)}
                              />
                              <IconButton
                                icon="trash"
                                tone="danger"
                                label={`Delete ${a.area}`}
                                size={32}
                                onClick={() => setDeletingArea(a)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* ── Hub Grouped Cards View ── */
            <div className="service-areas-hub-stack">
              {Object.entries(groupedByHub).map(([hId, hubAreas]) => {
                if (hubAreas.length === 0) return null;
                const hMeta = HUBS_META[hId];
                const hubActiveCount = hubAreas.filter((a) => a.active).length;
                const hubCustomerCount = hId === 'loc-nit' ? 5 : hId === 'loc-lpu' ? 7 : 12;

                return (
                  <div key={hId} className="svc-hub-section">
                    {/* Hub Banner */}
                    <div className="svc-hub-banner">
                      <div className="svc-hub-banner__lead">
                        <span className="svc-hub-banner__logo-squircle">
                          <img src={hMeta.logo} alt={hMeta.name} />
                        </span>
                        <div className="svc-hub-banner__info">
                          <div className="svc-hub-banner__title-row">
                            <h2 className="svc-hub-banner__title">{hMeta.name}</h2>
                            <span className="svc-hub-banner__tag">{hMeta.tag}</span>
                          </div>
                          <span className="svc-hub-banner__sub">
                            {hMeta.city} · PINs: {hMeta.pincodes.join(', ')}
                          </span>
                        </div>
                      </div>

                      <div className="svc-hub-banner__metrics">
                        <span className="svc-hub-banner__stat">
                          <span className="customers-stats-dot customers-stats-dot--green" />
                          <strong>{hubActiveCount} of {hubAreas.length}</strong> Zones Active
                        </span>
                        <span className="svc-hub-banner__stat">
                          <span className="customers-stats-dot customers-stats-dot--blue" />
                          <strong>{hubCustomerCount}</strong> Customers
                        </span>
                      </div>
                    </div>

                    {/* Area Cards Grid */}
                    <div className="schedule-area-grid">
                      {hubAreas.map((a) => (
                        <div
                          key={a.pincode + a.area}
                          className={`schedule-area-card${a.active ? '' : ' schedule-area-card--paused'}`}
                        >
                          <div className="schedule-area-card__top">
                            <span className="schedule-area-card__pin-badge mono">PIN {a.pincode}</span>
                            <div className="schedule-area-card__info">
                              <strong className="schedule-area-card__name">{a.area}</strong>
                              <span className="schedule-area-card__sub">{a.city}</span>
                              <div className="schedule-area-card__chips">
                                {a.customers ? (
                                  <span className="svc-customer-pill">
                                    <Icon name="users" size={11} />
                                    <span>{a.customers} registered</span>
                                  </span>
                                ) : null}
                                <span className="svc-hub-chip svc-hub-chip--sm">
                                  <span className="svc-hub-chip__logo svc-hub-chip__logo--sm">
                                    <img src={hMeta.logo} alt="" />
                                  </span>
                                  <span>{hMeta.name}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {a.note ? (
                            <div className="schedule-area-card__note">
                              <Icon name="mapPin" size={13} />
                              <span>{a.note}</span>
                            </div>
                          ) : null}

                          <div className="schedule-area-card__bottom">
                            <StatusBadge
                              size="sm"
                              label={a.active ? 'Collecting Active' : 'Paused'}
                              tone={a.active ? TONES.done : TONES.muted}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <MiniSwitch
                                checked={a.active}
                                label={a.active ? `Stop collecting in ${a.area}` : `Start collecting in ${a.area}`}
                                onChange={(v) =>
                                  run(
                                    `area-${a.pincode}`,
                                    () => schedulingApi.saveServiceArea({ ...a, active: v }, a.pincode),
                                    v ? `Now collecting in ${a.area}` : `Stopped collecting in ${a.area}`,
                                  )
                                }
                              />
                              <IconButton
                                icon="edit"
                                label={`Edit ${a.area}`}
                                size={32}
                                onClick={() => setEditingArea(a)}
                              />
                              <IconButton
                                icon="trash"
                                tone="danger"
                                label={`Delete ${a.area}`}
                                size={32}
                                onClick={() => setDeletingArea(a)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </QueryView>

      {/* ── 5. Add / Edit Area Modal ── */}
      {editingArea ? (
        <AreaModal
          area={editingArea === 'new' ? null : editingArea}
          onClose={() => setEditingArea(null)}
        />
      ) : null}

      {/* ── 6. Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={!!deletingArea}
        onClose={() => setDeletingArea(null)}
        title={`Delete Service Area · PIN ${deletingArea?.pincode ?? ''}?`}
        message={
          <>
            New customers in <strong>{deletingArea?.area}</strong> will no longer be able to register.{' '}
            {deletingArea?.customers ? (
              <>The {deletingArea.customers} existing registered customers there keep their accounts.</>
            ) : null}{' '}
            To temporarily stop collecting without deleting, switch it off instead.
          </>
        }
        confirmLabel="Delete Area"
        loading={false}
        onConfirm={async () => {
          if (!deletingArea) return;
          await run('del-area', () => schedulingApi.deleteServiceArea(deletingArea.pincode), 'Area deleted');
          setDeletingArea(null);
        }}
      />
    </div>
  );
}

