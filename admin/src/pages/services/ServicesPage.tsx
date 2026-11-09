import { useMemo, useState } from 'react';

import { ART, ART_TINT } from '@/components/domain/art';
import { Button, IconButton } from '@/components/ui/Button';
import { Column, DataTable } from '@/components/ui/DataTable';
import { MiniSwitch } from '@/components/ui/Form';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { useUrlState, useViewMode } from '@/hooks/useUrlState';
import { matches, money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { catalogApi, type ServiceRow } from '@/services';
import type { PriceItem, ServiceId } from '@/types';
import { FeesCard } from './FeesCard';
import { PriceItemModal, ServiceModal } from './ServiceModals';

type Filter = 'all' | 'active' | 'paused' | 'piece' | 'kg' | 'pair' | 'panel';

const GARMENT_ICONS: Record<string, IconName> = {
  shirt: 'shirt',
  trouser: 'bag',
  jean: 'bag',
  saree: 'sparkle',
  kurta: 'shirt',
  blazer: 'shirt',
  jacket: 'shirt',
  suit: 'shirt',
  bedsheet: 'bookmark',
  blanket: 'bookmark',
  curtain: 'layout',
  shoe: 'sparkle',
  leather: 'shirt',
  bridal: 'sparkle',
};

function getGarmentIcon(name: string): IconName {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(GARMENT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return 'tag';
}

type FlatPriceItem = PriceItem & {
  serviceId: ServiceId;
  serviceName: string;
  serviceArt: string;
  serviceAvailable: boolean;
};

export default function ServicesPage() {
  const services = useQuery('services', catalogApi.listServices);
  const pricing = useQuery('pricing', catalogApi.getPricing);

  // URL States for deep-linking & back navigation
  const [filter, setFilter] = useUrlState<Filter>('filter', 'all');
  const [selectedCategory, setSelectedCategory] = useUrlState<string>('cat', 'all');
  const [q, setQ] = useUrlState('q', '');
  const [viewMode, setViewMode] = useViewMode('view', 'grid');

  // Accordion expanded set for Services
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Modals
  const [editingService, setEditingService] = useState<ServiceRow | null | 'new'>(null);
  const [editingPriceItem, setEditingPriceItem] = useState<{ item: PriceItem | null; serviceId?: ServiceId; serviceName?: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState<PriceItem | null>(null);
  const [showFeesModal, setShowFeesModal] = useState(false);

  const { run, isBusy } = useAction();

  const servicesList = services.data ?? [];
  const pricingData = pricing.data;

  // Compute stats
  const activeCount = useMemo(() => servicesList.filter((s) => s.available).length, [servicesList]);
  const pausedCount = useMemo(() => servicesList.filter((s) => !s.available).length, [servicesList]);

  // All price items flattened for search and Master Table view
  const allPriceItems: FlatPriceItem[] = useMemo(() => {
    if (!pricingData) return [];
    const result: FlatPriceItem[] = [];
    for (const cat of pricingData.categories) {
      const svc = servicesList.find((s) => s.id === cat.serviceId);
      for (const item of cat.items) {
        result.push({
          ...item,
          serviceId: cat.serviceId,
          serviceName: svc?.name ?? cat.serviceId,
          serviceArt: svc?.art ?? 'washing',
          serviceAvailable: svc?.available ?? true,
        });
      }
    }
    return result;
  }, [pricingData, servicesList]);

  const totalItems = allPriceItems.length;
  const deliveryFee = pricingData?.fees.delivery ?? 49;
  const freeDeliveryAbove = pricingData?.fees.freeDeliveryAbove ?? 499;

  // Filtered Services for Cards view
  const filteredServices = useMemo(() => {
    return servicesList.filter((s) => {
      // Category jump filter
      if (selectedCategory !== 'all' && s.id !== selectedCategory) return false;

      // Status filter
      if (filter === 'active' && !s.available) return false;
      if (filter === 'paused' && s.available) return false;

      // Unit filter
      const svcItems = pricingData?.categories.find((c) => c.serviceId === s.id)?.items ?? [];
      if (['piece', 'kg', 'pair', 'panel'].includes(filter)) {
        if (!svcItems.some((i) => i.unit === filter)) return false;
      }

      // Search query (matches service name, tagline, description, turnaround or any garment in it)
      if (q.trim()) {
        const matchesService = matches(q, s.name, s.tagline, s.description, s.turnaround);
        const matchesGarment = svcItems.some((i) => matches(q, i.name, String(i.price), i.unit));
        if (!matchesService && !matchesGarment) return false;
      }

      return true;
    });
  }, [servicesList, pricingData, selectedCategory, filter, q]);

  // Filtered Flat Items for Price Sheet view
  const filteredPriceItems = useMemo(() => {
    return allPriceItems.filter((i) => {
      if (selectedCategory !== 'all' && i.serviceId !== selectedCategory) return false;
      if (filter === 'active' && !i.serviceAvailable) return false;
      if (filter === 'paused' && i.serviceAvailable) return false;
      if (['piece', 'kg', 'pair', 'panel'].includes(filter) && i.unit !== filter) return false;
      if (q.trim() && !matches(q, i.name, i.serviceName, String(i.price), i.unit)) return false;
      return true;
    });
  }, [allPriceItems, selectedCategory, filter, q]);

  // Accordion Expand/Collapse helper
  const isServiceExpanded = (serviceId: string) => {
    if (q.trim() !== '') return true;
    if (selectedCategory !== 'all' && selectedCategory === serviceId) return true;
    return expandedIds.has(serviceId);
  };

  const toggleServiceExpanded = (serviceId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(filteredServices.map((s) => s.id)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const allExpanded = filteredServices.length > 0 && filteredServices.every((s) => isServiceExpanded(s.id));

  const resetAll = () => {
    setFilter('all');
    setSelectedCategory('all');
    setQ('');
  };

  const hasActiveFilters = filter !== 'all' || selectedCategory !== 'all' || q.trim() !== '';

  const inUseCount = deletingItem ? catalogApi.priceItemInUse(deletingItem.id) : 0;

  // Table Columns for Master Price Sheet
  const tableColumns: Column<FlatPriceItem>[] = [
    {
      key: 'name',
      header: 'Garment / Sub-service',
      sortValue: (r) => r.name,
      render: (r) => (
        <div className="svc-table-garment-cell">
          <span className="svc-table-garment-icon" aria-hidden>
            <Icon name={getGarmentIcon(r.name)} size={18} />
          </span>
          <div className="cell-main__text">
            <span className="cell-main__title">{r.name}</span>
            <span className="cell-main__sub">Charged per {r.unit}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      header: 'Service Category',
      sortValue: (r) => r.serviceName,
      render: (r) => (
        <span className="svc-table-svc-badge">
          <img src={ART[r.serviceArt]} alt="" className="svc-table-svc-art" />
          {r.serviceName}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Customer Price',
      sortValue: (r) => r.price,
      render: (r) => (
        <span className="svc-table-price-badge num">{money(r.price)}</span>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      sortValue: (r) => r.unit,
      render: (r) => (
        <span className="svc-preset-chip svc-preset-chip--sm">per {r.unit}</span>
      ),
    },
    {
      key: 'status',
      header: 'Booking Status',
      sortValue: (r) => (r.serviceAvailable ? 1 : 0),
      render: (r) =>
        r.serviceAvailable ? (
          <span className="svc-card__status-badge svc-card__status-badge--active">
            <Icon name="check" size={12} /> Live
          </span>
        ) : (
          <span className="svc-card__status-badge svc-card__status-badge--paused">
            Paused
          </span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="svc-garment-tile__actions">
          <IconButton
            icon="edit"
            label={`Edit price for ${r.name}`}
            size={34}
            onClick={() => setEditingPriceItem({ item: r, serviceId: r.serviceId, serviceName: r.serviceName })}
          />
          <IconButton
            icon="trash"
            tone="danger"
            label={`Remove ${r.name}`}
            size={34}
            onClick={() => setDeletingItem(r)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="page customers-page services-page">
      {/* ── 1. Page Header (Clean, concise) ── */}
      <PageHeader
        title="Services & Prices"
        description="Manage laundry service categories, turnaround times, and garment prices."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="outline"
              icon="truck"
              onClick={() => setShowFeesModal(true)}
              title="Configure delivery fees"
            >
              Delivery Charges
            </Button>
            <Button
              variant="outline"
              icon="plus"
              onClick={() => setEditingPriceItem({ item: null })}
              title="Add a garment to any service"
            >
              Add Garment
            </Button>
            <Button
              variant="accent"
              icon="plus"
              onClick={() => setEditingService('new')}
              title="Create a new service category"
            >
              Add Service
            </Button>
          </div>
        }
      />

      {/* ── 2. Unified 3-Tile KPI Summary Bar (Clean, Distinctive Themes) ── */}
      <div className="customers-stats-bar" role="region" aria-label="Services overview statistics bar">
        {/* Segment 1: Dark Navy - Active Services */}
        <button
          type="button"
          className={`customers-stats-bar__item customers-stats-bar__item--dark${filter === 'active' ? ' is-active' : ''}`}
          onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}
          title="Filter live services"
        >
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--dark">
              <span className="overview-tag__dot overview-tag__dot--green" />
              Live Services
            </span>
            <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
              <Icon name="sparkle" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">
              {activeCount} of {servicesList.length}
            </span>
            <span className="overview-sub-card__caption">
              {pausedCount === 0 ? 'All services taking bookings' : `${pausedCount} service paused`}
            </span>
          </div>
        </button>

        {/* Segment 2: Vibrant Orange - Total Priced Garments */}
        <button
          type="button"
          className={`customers-stats-bar__item customers-stats-bar__item--orange${viewMode === 'table' ? ' is-active' : ''}`}
          onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
          title="Toggle between Cards and Master Price Sheet"
        >
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--orange">Priced Garments</span>
            <span className="overview-sub-card__icon-circle" aria-hidden>
              <Icon name="tag" size={16} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">{totalItems} Items</span>
            <span className="overview-sub-card__caption">
              {viewMode === 'table' ? 'Viewing master price sheet' : 'Click to view price sheet'}
            </span>
          </div>
        </button>

        {/* Segment 3: Light - Delivery Policy */}
        <button
          type="button"
          className="customers-stats-bar__item customers-stats-bar__item--light"
          onClick={() => setShowFeesModal(true)}
          title="Change delivery charges and free delivery threshold"
        >
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--success">
              <span className="overview-tag__dot overview-tag__dot--green" />
              Delivery Policy
            </span>
            <span className="overview-sub-card__icon-squircle" aria-hidden>
              <Icon name="truck" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value">
              {money(deliveryFee)} / Free {money(freeDeliveryAbove)}+
            </span>
            <span className="overview-sub-card__caption">Click to adjust fees</span>
          </div>
        </button>
      </div>

      {/* ── 3. Sticky Action & Search Card with Category Tabs ── */}
      <div className="customers-sticky-bar-wrapper">
        <div className="customers-action-card">
          <div className="customers-action-bar">
            {/* Search Input */}
            <div className="customers-search-box">
              <Icon name="search" size={17} className="customers-search-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search services or garments (e.g. Shirt, Saree, Blazer)..."
                className="customers-search-input"
                aria-label="Search services and pricing"
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
                label="Filter by status"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All Services', count: servicesList.length },
                  { value: 'active', label: 'Live', count: activeCount },
                  { value: 'paused', label: 'Paused', count: pausedCount },
                ]}
              />

              {/* View Switcher: Cards vs Price Sheet Table */}
              <div className="customers-view-toggle" role="group" aria-label="View layout">
                <button
                  type="button"
                  className={`customers-view-toggle__btn${viewMode === 'grid' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Service cards view"
                  aria-pressed={viewMode === 'grid'}
                >
                  <Icon name="grid" size={15} />
                  <span className="customers-view-toggle__label">Cards</span>
                </button>
                <button
                  type="button"
                  className={`customers-view-toggle__btn${viewMode === 'table' ? ' is-active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Master price sheet table"
                  aria-pressed={viewMode === 'table'}
                >
                  <Icon name="list" size={15} />
                  <span className="customers-view-toggle__label">Price Sheet</span>
                </button>
              </div>

              {viewMode === 'grid' ? (
                <Button
                  variant="outline"
                  size="sm"
                  icon={allExpanded ? 'chevronUp' : 'chevronDown'}
                  onClick={allExpanded ? collapseAll : expandAll}
                  title={allExpanded ? 'Collapse all services' : 'Expand all services to view all prices'}
                >
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </Button>
              ) : null}

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

          {/* Category Tabs */}
          <div className="svc-cat-tabs" role="tablist" aria-label="Filter by service category">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              className={`svc-cat-tab${selectedCategory === 'all' ? ' svc-cat-tab--active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Categories
              <span className="svc-cat-tab__count">{servicesList.length}</span>
            </button>
            {servicesList.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === s.id}
                className={`svc-cat-tab${selectedCategory === s.id ? ' svc-cat-tab--active' : ''}`}
                onClick={() => {
                  setSelectedCategory(s.id);
                  setExpandedIds((prev) => new Set([...prev, s.id]));
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Main Body: Cards View OR Master Price Sheet View ── */}
      <QueryView query={services} skeleton={<SkeletonRows rows={4} height={180} />}>
        {() => (
          <>
            {viewMode === 'table' ? (
              /* Master Price Sheet (Table View) */
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <DataTable<FlatPriceItem>
                  caption="Master price catalog of all garments and sub-services"
                  rows={filteredPriceItems}
                  columns={tableColumns}
                  rowKey={(r) => r.id}
                  pageSize={15}
                  empty={
                    <EmptyState
                      compact
                      icon="search"
                      title="No garments match your filters"
                      message="Try adjusting your search keywords or clear filters to see all prices."
                      action={
                        <Button variant="outline" size="sm" onClick={resetAll}>
                          Clear all filters
                        </Button>
                      }
                    />
                  }
                  mobileCard={(r) => (
                    <div className="svc-garment-tile">
                      <div className="svc-garment-tile__lead">
                        <span className="svc-garment-tile__icon">
                          <Icon name={getGarmentIcon(r.name)} size={16} />
                        </span>
                        <div className="svc-garment-tile__info">
                          <span className="svc-garment-tile__name">{r.name}</span>
                          <span className="svc-garment-tile__unit">
                            {r.serviceName} · per {r.unit}
                          </span>
                        </div>
                      </div>
                      <div className="svc-garment-tile__tail">
                        <span className="svc-garment-tile__price num">{money(r.price)}</span>
                        <IconButton
                          icon="edit"
                          size={32}
                          label={`Edit price for ${r.name}`}
                          onClick={() => setEditingPriceItem({ item: r, serviceId: r.serviceId, serviceName: r.serviceName })}
                        />
                      </div>
                    </div>
                  )}
                />
              </div>
            ) : (
              /* Service Cards View (Compact & Collapsible) */
              <div className="svc-cards-stack">
                {filteredServices.length ? (
                  filteredServices.map((service, index) => {
                    const catData = pricingData?.categories.find((c) => c.serviceId === service.id);
                    const items = catData?.items ?? [];
                    const note = catData?.note ?? '';
                    const isExpanded = isServiceExpanded(service.id);

                    return (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        items={items}
                        note={note}
                        isExpanded={isExpanded}
                        onToggleExpand={() => toggleServiceExpanded(service.id)}
                        isFirst={index === 0}
                        isLast={index === filteredServices.length - 1}
                        onEditService={() => setEditingService(service)}
                        onAddItem={() => setEditingPriceItem({ item: null, serviceId: service.id as ServiceId, serviceName: service.name })}
                        onEditItem={(item) => setEditingPriceItem({ item, serviceId: service.id as ServiceId, serviceName: service.name })}
                        onDeleteItem={(item) => setDeletingItem(item)}
                        searchFilter={q}
                      />
                    );
                  })
                ) : (
                  <EmptyState
                    icon="search"
                    title="No services match your search"
                    message="Try clearing your search query or filters to see all available services."
                    action={
                      <Button variant="outline" onClick={resetAll}>
                        Clear search & filters
                      </Button>
                    }
                  />
                )}
              </div>
            )}
          </>
        )}
      </QueryView>

      {/* ── 5. Modals & Dialogs ── */}
      {editingService ? (
        <ServiceModal
          service={editingService === 'new' ? null : editingService}
          note={editingService === 'new' ? '' : pricingData?.categories.find((c) => c.serviceId === editingService.id)?.note ?? ''}
          onClose={() => setEditingService(null)}
        />
      ) : null}

      {editingPriceItem ? (
        <PriceItemModal
          serviceId={editingPriceItem.serviceId}
          serviceName={editingPriceItem.serviceName}
          servicesList={servicesList}
          item={editingPriceItem.item}
          onClose={() => setEditingPriceItem(null)}
        />
      ) : null}

      {showFeesModal ? <FeesCard asModal onClose={() => setShowFeesModal(false)} /> : null}

      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        title={`Remove ${deletingItem?.name ?? 'item'} from price list?`}
        message={
          inUseCount > 0 ? (
            <>
              <strong>
                {inUseCount} active {inUseCount === 1 ? 'order uses' : 'orders use'} this garment item.
              </strong>{' '}
              Removing it drops this line from their breakdown. Only remove it if you no longer provide this service;
              otherwise change the price instead.
            </>
          ) : (
            <>This item will disappear from the customer app and booking price catalog immediately.</>
          )
        }
        confirmLabel="Remove Item"
        loading={isBusy('del-item')}
        onConfirm={async () => {
          if (!deletingItem) return;
          await run('del-item', () => catalogApi.deletePriceItem(deletingItem.id), `${deletingItem.name} removed`);
          setDeletingItem(null);
        }}
      />
    </div>
  );
}

function ServiceCard({
  service,
  items,
  note,
  isExpanded,
  onToggleExpand,
  isFirst,
  isLast,
  onEditService,
  onAddItem,
  onEditItem,
  onDeleteItem,
  searchFilter,
}: {
  service: ServiceRow;
  items: PriceItem[];
  note: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isFirst: boolean;
  isLast: boolean;
  onEditService: () => void;
  onAddItem: () => void;
  onEditItem: (item: PriceItem) => void;
  onDeleteItem: (item: PriceItem) => void;
  searchFilter: string;
}) {
  const { run, isBusy } = useAction();

  // Instant quick adjustment (+₹5 / -₹5)
  const quickNudgePrice = async (item: PriceItem, delta: number) => {
    const nextPrice = Math.max(1, item.price + delta);
    await run(
      `nudge-${item.id}`,
      () => catalogApi.updatePriceItem(item.id, { name: item.name, price: nextPrice, unit: item.unit }),
      `${item.name} updated to ${money(nextPrice)}`,
    );
  };

  const startingPrice = service.startingPrice;

  // Filter items matching search if query is active
  const visibleItems = useMemo(() => {
    if (!searchFilter.trim()) return items;
    return items.filter((i) => matches(searchFilter, i.name, String(i.price), i.unit));
  }, [items, searchFilter]);

  return (
    <article
      className={`svc-card${service.available ? '' : ' svc-card--off'}${isExpanded ? ' svc-card--expanded' : ''}`}
      aria-label={service.name}
    >
      {/* Clickable Compact Top Bar (~64px height) */}
      <div
        className="svc-card__compact-top"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <div className="svc-card__lead">
          <span className="svc-card__art" style={{ background: ART_TINT[service.art] ?? '#F4F5F7' }}>
            <img src={ART[service.art]} alt="" />
          </span>

          <div className="svc-card__body">
            <div className="svc-card__title-row">
              <h2 className="svc-card__title">{service.name}</h2>
              {service.available ? (
                <span className="svc-card__status-badge svc-card__status-badge--active">
                  <Icon name="check" size={12} /> Live
                </span>
              ) : (
                <span className="svc-card__status-badge svc-card__status-badge--paused">
                  Paused
                </span>
              )}
            </div>

            <div className="svc-card__meta-bar" style={{ marginTop: 2 }}>
              <span className="svc-card__meta-chip svc-card__meta-chip--accent">
                <Icon name="clock" size={12} /> {service.turnaround}
              </span>
              {startingPrice ? (
                <span className="svc-card__meta-chip svc-card__meta-chip--warm">
                  From {money(startingPrice.price)}/{startingPrice.unit}
                </span>
              ) : null}
              <span className="svc-card__meta-chip">
                {items.length} {items.length === 1 ? 'item' : 'garments'} priced
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="svc-card__controls" onClick={(e) => e.stopPropagation()}>
          <div className="svc-card__reorder-group" aria-label="Reorder service">
            <IconButton
              icon="arrowUp"
              size={28}
              label={`Move ${service.name} up`}
              disabled={isFirst}
              onClick={() => run('mv', () => catalogApi.moveService(service.id, -1), 'Position moved up')}
            />
            <IconButton
              icon="arrowDown"
              size={28}
              label={`Move ${service.name} down`}
              disabled={isLast}
              onClick={() => run('mv', () => catalogApi.moveService(service.id, 1), 'Position moved down')}
            />
          </div>

          <div className="svc-card__toggle-box">
            <MiniSwitch
              checked={service.available}
              label={service.available ? `Pause ${service.name}` : `Make ${service.name} bookable`}
              disabled={isBusy(`toggle-${service.id}`)}
              onChange={(v) =>
                run(
                  `toggle-${service.id}`,
                  () => catalogApi.setServiceAvailable(service.id, v),
                  v ? `${service.name} is now taking orders!` : `${service.name} paused`,
                  v ? 'Customers can book this immediately.' : 'Hidden from new bookings; ongoing orders continue.',
                )
              }
            />
            <span className={`svc-card__toggle-label ${service.available ? 'svc-card__toggle-label--active' : 'svc-card__toggle-label--paused'}`}>
              {service.available ? 'Live' : 'Paused'}
            </span>
          </div>

          <IconButton
            icon="edit"
            size={32}
            label={`Edit ${service.name} settings`}
            onClick={onEditService}
          />

          <button
            type="button"
            className={`svc-card__expand-btn${isExpanded ? ' svc-card__expand-btn--active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            aria-label={isExpanded ? `Hide prices for ${service.name}` : `View prices for ${service.name}`}
          >
            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={14} />
            <span>{isExpanded ? 'Hide' : `${items.length} Prices`}</span>
          </button>
        </div>
      </div>

      {/* Expanded Garments and Note Section */}
      {isExpanded ? (
        <>
          {note ? (
            <div className="svc-card__note-callout">
              <Icon name="info" size={15} />
              <span>
                <strong>Customer note:</strong> “{note}”
              </span>
            </div>
          ) : null}

          <div className="svc-card__garments-section" style={{ borderTop: note ? undefined : '1px solid var(--hairline)' }}>
            <div className="svc-card__garments-head">
              <div className="svc-card__garments-title">
                <Icon name="tag" size={16} />
                <span>Priced Items & Garments</span>
                <span className="svc-card__garments-count">{items.length}</span>
              </div>
              <Button size="sm" variant="accent" icon="plus" onClick={onAddItem}>
                Add Garment
              </Button>
            </div>

            {visibleItems.length ? (
              <div className="svc-garment-grid">
                {visibleItems.map((item) => (
                  <div key={item.id} className="svc-garment-tile">
                    <div className="svc-garment-tile__lead">
                      <span className="svc-garment-tile__icon" aria-hidden>
                        <Icon name={getGarmentIcon(item.name)} size={16} />
                      </span>
                      <div className="svc-garment-tile__info">
                        <strong className="svc-garment-tile__name" title={item.name}>
                          {item.name}
                        </strong>
                        <span className="svc-garment-tile__unit">per {item.unit}</span>
                      </div>
                    </div>

                    <div className="svc-garment-tile__tail">
                      <div className="svc-garment-tile__price-block">
                        <span className="svc-garment-tile__price num">{money(item.price)}</span>
                      </div>

                      {/* 1-Click Quick Price Nudge Buttons (-₹5 / +₹5) */}
                      <div className="svc-garment-tile__quick-stepper" title="Quickly adjust price by ₹5">
                        <button
                          type="button"
                          className="svc-garment-tile__quick-btn"
                          onClick={() => quickNudgePrice(item, -5)}
                          disabled={isBusy(`nudge-${item.id}`) || item.price <= 5}
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          className="svc-garment-tile__quick-btn"
                          onClick={() => quickNudgePrice(item, 5)}
                          disabled={isBusy(`nudge-${item.id}`)}
                        >
                          +5
                        </button>
                      </div>

                      {/* Action Buttons */}
                      <div className="svc-garment-tile__actions">
                        <IconButton
                          icon="edit"
                          size={30}
                          label={`Edit ${item.name}`}
                          onClick={() => onEditItem(item)}
                        />
                        <IconButton
                          icon="trash"
                          size={30}
                          tone="danger"
                          label={`Remove ${item.name}`}
                          onClick={() => onDeleteItem(item)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon="list"
                title={searchFilter ? 'No matching garments in this service' : 'No garments priced yet'}
                message={
                  searchFilter
                    ? 'Try a different keyword or clear search.'
                    : 'Add the first item so customers can see what this service costs.'
                }
                action={
                  !searchFilter ? (
                    <Button size="sm" variant="accent" icon="plus" onClick={onAddItem}>
                      Add First Garment
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </>
      ) : null}
    </article>
  );
}
