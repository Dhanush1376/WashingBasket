import { useMemo, useState } from 'react';

import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, MiniSwitch, Select } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { useUrlState } from '@/hooks/useUrlState';
import { dateParts } from '@customer/lib/format';
import { matches } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { TONES } from '@/lib/status';
import { schedulingApi, type AreaRow } from '@/services';
import type { AdminPickupSlot } from '@/types';
import { AreaModal, SlotModal } from './ScheduleModals';

type Tab = 'slots' | 'areas';
type PeriodFilter = 'all' | 'Morning' | 'Afternoon' | 'Evening';
type AreaFilter = 'all' | 'active' | 'paused';

export default function SchedulePage() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'slots');
  const [q, setQ] = useUrlState('q', '');
  const [period, setPeriod] = useUrlState<PeriodFilter>('period', 'all');
  const [areaStatus, setAreaStatus] = useUrlState<AreaFilter>('status', 'all');

  const slots = useQuery('slots', schedulingApi.getPickupSlots);
  const areas = useQuery('areas', schedulingApi.listServiceAreas);

  const [editingSlot, setEditingSlot] = useState<AdminPickupSlot | 'new' | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<AdminPickupSlot | null>(null);
  const [editingArea, setEditingArea] = useState<AreaRow | 'new' | null>(null);
  const [deletingArea, setDeletingArea] = useState<AreaRow | null>(null);

  const { run, isBusy } = useAction();

  const slotsData = slots.data?.slots ?? [];
  const usageData = slots.data?.usage ?? {};
  const fullyBookedData = slots.data?.fullyBooked ?? [];
  const daysAhead = slots.data?.daysAhead ?? 5;

  const areasData = areas.data ?? [];

  // Compute metrics for Pickup Slots tab
  const enabledSlotsCount = useMemo(() => slotsData.filter((s) => s.enabled).length, [slotsData]);
  const totalBookingsAhead = useMemo(
    () => Object.values(usageData).reduce((sum, n) => sum + (n || 0), 0),
    [usageData],
  );

  // Compute metrics for Service Areas tab
  const activeAreasCount = useMemo(() => areasData.filter((a) => a.active).length, [areasData]);
  const totalCustomers = useMemo(() => areasData.reduce((sum, a) => sum + (a.customers || 0), 0), [areasData]);

  // Filtered Slots
  const filteredSlots = useMemo(() => {
    return slotsData.filter((s) => {
      if (period !== 'all' && s.period !== period) return false;
      if (q.trim() && !matches(q, s.label, s.period)) return false;
      return true;
    });
  }, [slotsData, period, q]);

  // Filtered Areas
  const filteredAreas = useMemo(() => {
    return areasData.filter((a) => {
      if (areaStatus === 'active' && !a.active) return false;
      if (areaStatus === 'paused' && a.active) return false;
      if (q.trim() && !matches(q, a.pincode, a.area, a.city, a.note ?? '')) return false;
      return true;
    });
  }, [areasData, areaStatus, q]);

  const resetAll = () => {
    setQ('');
    setPeriod('all');
    setAreaStatus('all');
  };

  const hasActiveFilters = q.trim() !== '' || period !== 'all' || areaStatus !== 'all';

  return (
    <div className="page customers-page schedule-page">
      {/* ── 1. Page Header with Single-Line Stats Bar ── */}
      <PageHeader
        title={tab === 'slots' ? 'Pickup Times & Schedule' : 'Service Areas & Coverage'}
        description={
          tab === 'slots' ? (
            <div className="customers-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                <strong>{slotsData.length}</strong> Total Slots
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                <strong>{enabledSlotsCount}</strong> Active Slots
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{totalBookingsAhead}</strong> Booked Ahead
              </span>
              <span className="customers-header-stat">
                Booking Window: Up to <strong>{daysAhead} days ahead</strong>
              </span>
            </div>
          ) : (
            <div className="customers-header-desc">
              <span className="customers-header-stat customers-header-stat--main">
                <strong>{areasData.length}</strong> Covered Areas
              </span>
              <span className="customers-header-stat customers-header-stat--green">
                <span className="customers-stats-dot customers-stats-dot--green" />
                <strong>{activeAreasCount}</strong> Collecting Active
              </span>
              <span className="customers-header-stat customers-header-stat--blue">
                <span className="customers-stats-dot customers-stats-dot--blue" />
                <strong>{totalCustomers}</strong> Registered Customers
              </span>
              <span className="customers-header-stat">
                PIN Codes: <strong>{areasData.map((a) => a.pincode).join(', ')}</strong>
              </span>
            </div>
          )
        }
        actions={
          tab === 'slots' ? (
            <Button variant="accent" icon="plus" onClick={() => setEditingSlot('new')}>
              Add Time Slot
            </Button>
          ) : (
            <Button variant="accent" icon="plus" onClick={() => setEditingArea('new')}>
              Add Service Area
            </Button>
          )
        }
      />

      {/* ── 2. Unified 4-Tile KPI Summary Bar ── */}
      <div className="customers-stats-bar" role="region" aria-label="Schedule statistics overview bar">
        {tab === 'slots' ? (
          <>
            {/* Tile 1: Active Slots */}
            <div className="customers-stats-bar__item customers-stats-bar__item--dark">
              <div className="overview-sub-card__top">
                <span className="overview-tag overview-tag--dark">
                  <span className="overview-tag__dot overview-tag__dot--green" />
                  Active Slots
                </span>
                <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
                  <Icon name="clock" size={17} />
                </span>
              </div>
              <div className="overview-sub-card__bottom">
                <span className="overview-sub-card__value">
                  {enabledSlotsCount} of {slotsData.length}
                </span>
                <span className="overview-sub-card__caption">
                  {slotsData.length - enabledSlotsCount === 0
                    ? 'All slots available to customers'
                    : `${slotsData.length - enabledSlotsCount} slot paused`}
                </span>
              </div>
            </div>

            {/* Tile 2: Advance Bookings */}
            <div className="customers-stats-bar__item customers-stats-bar__item--orange">
              <div className="overview-sub-card__top">
                <span className="overview-tag overview-tag--orange">Advance Bookings</span>
                <span className="overview-sub-card__icon-circle" aria-hidden>
                  <Icon name="calendar" size={15} />
                </span>
              </div>
              <div className="overview-sub-card__bottom">
                <span className="overview-sub-card__value">{totalBookingsAhead} Pickups</span>
                <span className="overview-sub-card__caption">Booked across upcoming days</span>
              </div>
            </div>

            {/* Tile 3: Booking Window */}
            <div className="customers-stats-bar__item customers-stats-bar__item--light">
              <div className="overview-sub-card__top">
                <span className="overview-tag overview-tag--light">
                  <span className="overview-tag__dot overview-tag__dot--blue" />
                  Booking Window
                </span>
                <span className="overview-sub-card__icon-squircle" aria-hidden>
                  <Icon name="sliders" size={17} />
                </span>
              </div>
              <div className="overview-sub-card__bottom">
                <span className="overview-sub-card__value">{daysAhead} Days Ahead</span>
                <span className="overview-sub-card__caption">Customers can reserve in advance</span>
              </div>
            </div>

            {/* Tile 4: Busy Days */}
            <div className="customers-stats-bar__item customers-stats-bar__item--light">
              <div className="overview-sub-card__top">
                <span className="overview-tag overview-tag--success">
                  <span className="overview-tag__dot overview-tag__dot--green" />
                  Full Slots
                </span>
                <span className="overview-sub-card__icon-squircle" aria-hidden>
                  <Icon name="check" size={17} />
                </span>
              </div>
              <div className="overview-sub-card__bottom">
                <span className="overview-sub-card__value">{fullyBookedData.length} Closed</span>
                <span className="overview-sub-card__caption">Manually marked full on busy days</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Tile 1: Active Coverage Areas */}
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
                  {activeAreasCount} of {areasData.length}
                </span>
                <span className="overview-sub-card__caption">Service PIN codes accepting pickups</span>
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
                <span className="overview-sub-card__caption">Across covered area pincodes</span>
              </div>
            </div>

            {/* Tile 3: Covered Cities */}
            <div className="customers-stats-bar__item customers-stats-bar__item--light">
              <div className="overview-sub-card__top">
                <span className="overview-tag overview-tag--light">
                  <span className="overview-tag__dot overview-tag__dot--blue" />
                  Covered Cities
                </span>
                <span className="overview-sub-card__icon-squircle" aria-hidden>
                  <Icon name="sparkle" size={17} />
                </span>
              </div>
              <div className="overview-sub-card__bottom">
                <span className="overview-sub-card__value">Phagwara & Jalandhar</span>
                <span className="overview-sub-card__caption">2 operational campus and city regions</span>
              </div>
            </div>

            {/* Tile 4: Home Delivery Zone */}
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
                <span className="overview-sub-card__caption">Model Town store doorstep radius</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 3. Sticky Action Bar: Dedicated Tabs & Filters ── */}
      <div className="customers-sticky-bar-wrapper">
        <div className="customers-action-card">
          <div className="customers-action-bar">
            {/* Search Box */}
            <div className="customers-search-box">
              <Icon name="search" size={17} className="customers-search-icon" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  tab === 'slots'
                    ? 'Search time slots (e.g. 8:00 AM, Morning, Evening)...'
                    : 'Search areas by PIN code, name, city (e.g. 144011, NIT, Model Town)...'
                }
                className="customers-search-input"
                aria-label="Search schedule"
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

            {/* Main Tabs Switcher: Separate Pickup Slots from Service Areas */}
            <div className="customers-view-toggle" role="tablist" aria-label="Section selector">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'slots'}
                className={`customers-view-toggle__btn${tab === 'slots' ? ' is-active' : ''}`}
                onClick={() => {
                  setTab('slots');
                  setQ('');
                }}
              >
                <Icon name="clock" size={15} />
                <span className="customers-view-toggle__label">
                  Pickup Slots ({slotsData.length})
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'areas'}
                className={`customers-view-toggle__btn${tab === 'areas' ? ' is-active' : ''}`}
                onClick={() => {
                  setTab('areas');
                  setQ('');
                }}
              >
                <Icon name="mapPin" size={15} />
                <span className="customers-view-toggle__label">
                  Service Areas ({areasData.length})
                </span>
              </button>
            </div>

            {/* Sub-Filters */}
            <div className="customers-action-controls">
              {tab === 'slots' ? (
                <FilterPills<PeriodFilter>
                  label="Filter by time of day"
                  value={period}
                  onChange={setPeriod}
                  options={[
                    { value: 'all', label: 'All Periods' },
                    { value: 'Morning', label: 'Morning' },
                    { value: 'Afternoon', label: 'Afternoon' },
                    { value: 'Evening', label: 'Evening' },
                  ]}
                />
              ) : (
                <FilterPills<AreaFilter>
                  label="Filter by area status"
                  value={areaStatus}
                  onChange={setAreaStatus}
                  options={[
                    { value: 'all', label: 'All Areas', count: areasData.length },
                    { value: 'active', label: 'Collecting', count: activeAreasCount },
                    { value: 'paused', label: 'Paused', count: areasData.length - activeAreasCount },
                  ]}
                />
              )}

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

      {/* ── 4. Main Body: Dedicated Tab Content ── */}
      {tab === 'slots' ? (
        /* ── SEPARATE SECTION 1: PICKUP TIMES & SLOTS ── */
        <div className="schedule-section-stack">
          {/* Card A: Time Slots Management */}
          <Card>
            <CardHeader
              title="Daily Pickup Time Slots"
              hint="Customers choose one of these arrival windows when booking a doorstep pickup."
              icon="clock"
              action={
                <Button size="sm" variant="accent" icon="plus" onClick={() => setEditingSlot('new')}>
                  Add Slot
                </Button>
              }
            />
            <QueryView query={slots} skeleton={<SkeletonRows rows={4} height={52} />}>
              {() =>
                filteredSlots.length ? (
                  <ul className="slot-list">
                    {filteredSlots.map((slot) => {
                      const bookedAhead = usageData[slot.id] || 0;
                      return (
                        <li key={slot.id} className={`slot-row${slot.enabled ? '' : ' slot-row--off'}`}>
                          <span className="slot-row__period">
                            <Icon name="clock" size={13} />
                            {slot.period}
                          </span>
                          <strong className="grow" style={{ fontSize: 14.5 }}>
                            {slot.label}
                          </strong>
                          {bookedAhead > 0 ? (
                            <Tag tone="navy">{bookedAhead} booked ahead</Tag>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>No bookings</span>
                          )}
                          <MiniSwitch
                            checked={slot.enabled}
                            label={slot.enabled ? `Stop offering ${slot.label}` : `Offer ${slot.label} again`}
                            onChange={(v) =>
                              run(
                                `en-${slot.id}`,
                                () => schedulingApi.updateSlot(slot.id, { enabled: v }),
                                v ? 'Slot is offered again' : 'Slot is no longer offered',
                                v ? undefined : 'Pickups already booked in it are kept.',
                              )
                            }
                          />
                          <IconButton
                            icon="edit"
                            label={`Edit ${slot.label}`}
                            size={34}
                            onClick={() => setEditingSlot(slot)}
                          />
                          <IconButton
                            icon="trash"
                            tone="danger"
                            label={`Delete ${slot.label}`}
                            size={34}
                            onClick={() => setDeletingSlot(slot)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    compact
                    icon="clock"
                    title={q ? 'No matching time slots' : 'No time slots configured'}
                    message={
                      q
                        ? 'Try clearing your search query.'
                        : 'Add at least one time slot so customers can book pickups.'
                    }
                    action={
                      q ? (
                        <Button variant="outline" size="sm" onClick={resetAll}>
                          Clear search
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
            </QueryView>
          </Card>

          {/* Card B: Busy Days & Fully Booked Calendar Matrix */}
          <Card>
            <CardHeader
              title="Busy Days & Booking Calendar"
              hint="Close a time slot on a specific day when at capacity. Closed slots appear as 'Full' to customers."
              icon="calendar"
            />
            <QueryView query={slots}>
              {(s) => (
                <FullGrid
                  data={s}
                  busy={isBusy('full')}
                  onToggle={(day, slot) => run('full', () => schedulingApi.toggleFull(day, slot), 'Slot updated')}
                  onDays={(n) => run('days', () => schedulingApi.setDaysAhead(n), `Customers can now book ${n} days ahead`)}
                />
              )}
            </QueryView>
          </Card>
        </div>
      ) : (
        /* ── SEPARATE SECTION 2: SERVICE AREAS & PIN CODES ── */
        <div className="schedule-section-stack">
          <Card>
            <CardHeader
              title="Covered Service Areas & PIN Codes"
              hint="When customers register or enter their PIN, the app checks against this list to confirm doorstep service availability."
              icon="mapPin"
              action={
                <Button size="sm" variant="accent" icon="plus" onClick={() => setEditingArea('new')}>
                  Add Service Area
                </Button>
              }
            />
            <QueryView query={areas} skeleton={<SkeletonRows rows={4} height={52} />}>
              {() =>
                filteredAreas.length ? (
                  <div className="schedule-area-grid">
                    {filteredAreas.map((a) => (
                      <div key={a.pincode} className="schedule-area-card">
                        <div className="schedule-area-card__top">
                          <span className="schedule-area-card__pin-badge mono">PIN {a.pincode}</span>
                          <div className="schedule-area-card__info">
                            <strong className="schedule-area-card__name">{a.area}</strong>
                            <span className="schedule-area-card__sub">{a.city}</span>
                            <div className="schedule-area-card__chips">
                              {a.customers ? (
                                <span className="svc-preset-chip svc-preset-chip--sm">
                                  👥 {a.customers} registered
                                </span>
                              ) : null}
                              {a.note ? (
                                <span className="svc-preset-chip svc-preset-chip--sm">
                                  📍 {a.note}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

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
                                  `a-${a.pincode}`,
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
                ) : (
                  <EmptyState
                    compact
                    icon="mapPin"
                    title={q ? 'No matching service areas' : 'No service areas configured'}
                    message={
                      q
                        ? 'Try a different keyword or clear search.'
                        : 'Add the PIN codes you collect from so customers can sign up.'
                    }
                    action={
                      q ? (
                        <Button variant="outline" size="sm" onClick={resetAll}>
                          Clear search
                        </Button>
                      ) : undefined
                    }
                  />
                )
              }
            </QueryView>
          </Card>
        </div>
      )}

      {/* ── 5. Modals & Confirmation Dialogs ── */}
      {editingSlot ? (
        <SlotModal slot={editingSlot === 'new' ? null : editingSlot} onClose={() => setEditingSlot(null)} />
      ) : null}

      {editingArea ? (
        <AreaModal area={editingArea === 'new' ? null : editingArea} onClose={() => setEditingArea(null)} />
      ) : null}

      <ConfirmDialog
        open={!!deletingSlot}
        onClose={() => setDeletingSlot(null)}
        title={`Delete the ${deletingSlot?.label ?? ''} slot?`}
        message={
          slots.data?.usage[deletingSlot?.id ?? ''] ? (
            <>
              <strong>{slots.data.usage[deletingSlot!.id]} pickups</strong> are booked in this slot. They stay booked,
              but the slot will show as “Slot removed”. To stop new bookings only, switch it off instead.
            </>
          ) : (
            <>Customers won’t be able to choose it any more.</>
          )
        }
        confirmLabel="Delete slot"
        loading={isBusy('del')}
        onConfirm={async () => {
          if (!deletingSlot) return;
          await run('del', () => schedulingApi.deleteSlot(deletingSlot.id), 'Slot deleted');
          setDeletingSlot(null);
        }}
      />

      <ConfirmDialog
        open={!!deletingArea}
        onClose={() => setDeletingArea(null)}
        title={`Delete PIN ${deletingArea?.pincode ?? ''}?`}
        message={
          <>
            New customers in <strong>{deletingArea?.area}</strong> won’t be able to sign up.{' '}
            {deletingArea?.customers ? `The ${deletingArea.customers} existing customers there keep their accounts.` : ''}{' '}
            To pause collection without deleting, switch it off instead.
          </>
        }
        confirmLabel="Delete area"
        loading={isBusy('del-area')}
        onConfirm={async () => {
          if (!deletingArea) return;
          await run('del-area', () => schedulingApi.deleteServiceArea(deletingArea.pincode), 'Area deleted');
          setDeletingArea(null);
        }}
      />
    </div>
  );
}

function FullGrid({
  data,
  onToggle,
  onDays,
  busy,
}: {
  data: Awaited<ReturnType<typeof schedulingApi.getPickupSlots>>;
  onToggle: (day: number, slot: string) => void;
  onDays: (n: number) => void;
  busy: boolean;
}) {
  const enabled = data.slots.filter((s) => s.enabled);
  const days = Array.from({ length: data.daysAhead }, (_, i) => {
    const d = new Date(Date.now() + (i + 1) * 86400_000);
    return { offset: i, ...dateParts(d.toISOString()) };
  });
  const isFull = (day: number, slot: string) => data.fullyBooked.some((f) => f.dayOffset === day && f.slotId === slot);

  return (
    <div className="stack">
      <Field label="Customer booking advance window" hint="How many days in advance customers can schedule a pickup.">
        <Select value={String(data.daysAhead)} onChange={(e) => onDays(Number(e.target.value))} className="select--narrow">
          {[3, 5, 7, 10, 14].map((n) => (
            <option key={n} value={n}>
              Up to {n} days ahead
            </option>
          ))}
        </Select>
      </Field>
      {enabled.length ? (
        <div className="full-grid-wrap">
          <table className="full-grid">
            <caption className="sr-only">Open and full slots by day</caption>
            <thead>
              <tr>
                <th scope="col">Slot</th>
                {days.map((d) => (
                  <th key={d.offset} scope="col">
                    <span className="full-grid__day">{d.offset === 0 ? 'Tmrw' : d.weekday}</span>
                    <span className="full-grid__date">
                      {d.day} {d.month}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enabled.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.label}</th>
                  {days.map((d) => {
                    const full = isFull(d.offset, s.id);
                    return (
                      <td key={d.offset}>
                        <button
                          type="button"
                          className={`full-cell${full ? ' full-cell--full' : ''}`}
                          aria-pressed={full}
                          disabled={busy}
                          onClick={() => onToggle(d.offset, s.id)}
                          aria-label={`${s.label} on ${d.weekday} ${d.day} ${d.month}: ${full ? 'full, click to open' : 'open, click to mark full'}`}
                        >
                          {full ? 'Full' : 'Open'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState compact icon="clock" title="No slots offered" message="Switch on a time slot above to manage busy days." />
      )}
      <p className="muted small">Tap any box to toggle between Open (green) and Full (dark). Scroll sideways on small screens to view all days.</p>
    </div>
  );
}
