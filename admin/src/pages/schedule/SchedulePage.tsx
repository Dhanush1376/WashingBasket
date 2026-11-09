import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { Tag } from '@/components/ui/Badge';
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
import { schedulingApi } from '@/services';
import type { AdminPickupSlot } from '@/types';
import { SlotModal } from './ScheduleModals';

type PeriodFilter = 'all' | 'Morning' | 'Afternoon' | 'Evening';

export default function SchedulePage() {
  const [tab] = useUrlState('tab', 'slots');
  const [q, setQ] = useUrlState('q', '');
  const [period, setPeriod] = useUrlState<PeriodFilter>('period', 'all');

  // If someone navigated with ?tab=areas, seamlessly direct them to the dedicated Service Areas page
  if (tab === 'areas') {
    return <Navigate to="/service-areas" replace />;
  }

  const slots = useQuery('slots', schedulingApi.getPickupSlots);

  const [editingSlot, setEditingSlot] = useState<AdminPickupSlot | 'new' | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<AdminPickupSlot | null>(null);

  const { run, isBusy } = useAction();

  const slotsData = slots.data?.slots ?? [];
  const usageData = slots.data?.usage ?? {};
  const fullyBookedData = slots.data?.fullyBooked ?? [];
  const daysAhead = slots.data?.daysAhead ?? 5;

  const enabledSlotsCount = useMemo(() => slotsData.filter((s) => s.enabled).length, [slotsData]);
  const totalBookingsAhead = useMemo(
    () => Object.values(usageData).reduce((sum, n) => sum + (n || 0), 0),
    [usageData],
  );

  const filteredSlots = useMemo(() => {
    return slotsData.filter((s) => {
      if (period !== 'all' && s.period !== period) return false;
      if (q.trim() && !matches(q, s.label, s.period)) return false;
      return true;
    });
  }, [slotsData, period, q]);

  const resetAll = () => {
    setQ('');
    setPeriod('all');
  };

  const hasActiveFilters = q.trim() !== '' || period !== 'all';

  return (
    <div className="page customers-page schedule-page">
      {/* ── 1. Page Header with Single-Line Stats Bar ── */}
      <PageHeader
        title="Pickup Times & Schedule"
        description={
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
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/service-areas" className="btn btn--outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="mapPin" size={15} />
              <span>Service areas &amp; PINs</span>
            </Link>
            <Button variant="accent" icon="plus" onClick={() => setEditingSlot('new')}>
              Add Time Slot
            </Button>
          </div>
        }
      />

      {/* ── 2. Unified 4-Tile KPI Summary Bar ── */}
      <div className="customers-stats-bar" role="region" aria-label="Schedule statistics overview bar">
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
                ? 'All arrival windows available'
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

        {/* Tile 4: Busy Days & Full Slots */}
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
      </div>

      {/* ── 3. Sticky Action Bar: Search & Sub-Filters ── */}
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
                placeholder="Search time slots (e.g. 8:00 AM, Morning, Evening)..."
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

            {/* Time of Day Filter */}
            <div className="customers-action-controls">
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

      {/* ── 4. Main Body: Slots & Busy Days Matrix ── */}
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

      {/* ── 5. Modals & Confirmation Dialogs ── */}
      {editingSlot ? (
        <SlotModal slot={editingSlot === 'new' ? null : editingSlot} onClose={() => setEditingSlot(null)} />
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
    </div>
  );
}

function FullGrid({
  data,
  busy,
  onToggle,
  onDays,
}: {
  data: Awaited<ReturnType<typeof schedulingApi.getPickupSlots>>;
  busy: boolean;
  onToggle: (dayOffset: number, slotId: string) => void;
  onDays: (daysAhead: number) => void;
}) {
  const enabled = data.slots.filter((s) => s.enabled);
  const now = new Date();
  const days = Array.from({ length: data.daysAhead }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i);
    const iso = d.toISOString().slice(0, 10);
    return { offset: i, iso, ...dateParts(iso) };
  });

  const isFull = (dayOffset: number, slotId: string) =>
    data.fullyBooked.some((f) => f.dayOffset === dayOffset && f.slotId === slotId);

  return (
    <div className="flow">
      <Field label="Customer booking advance window" hint="How many days in advance customers can schedule a pickup.">
        <Select
          value={String(data.daysAhead)}
          onChange={(e) => onDays(Number(e.target.value))}
        >
          {[3, 4, 5, 6, 7, 10, 14].map((n) => (
            <option key={n} value={String(n)}>
              {n} days ahead
            </option>
          ))}
        </Select>
      </Field>

      {enabled.length ? (
        <div className="full-grid-wrap">
          <table className="full-grid" aria-label="Slot availability matrix">
            <thead>
              <tr>
                <th scope="col" className="full-grid__corner">
                  Slot
                </th>
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
      <p className="muted small">Tap a box to switch between Open and Full. Scroll sideways on small screens to see every day.</p>
    </div>
  );
}
