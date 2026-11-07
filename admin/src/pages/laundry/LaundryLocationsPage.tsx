import { Link } from 'react-router-dom';

import { MiniSwitch } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useOperationalLocation } from '@/hooks/useOperationalLocation';
import { money } from '@/lib/format';
import { useLaundryState } from '@/laundry/store';
import { MODE_COPY } from '@customer/mock/engine/lifecycle';
import { locationStats } from '@customer/mock/engine/selectors';
import { setLocationStatus } from '@customer/mock/services/locationService';
import { ResetDemoButton, SyncPill } from './shared';

const LOCATION_ORDER: Record<string, number> = {
  'loc-nit': 1,
  'loc-lpu': 2,
  'loc-outside': 3,
};

const LOCATION_THEMES: Record<string, {
  theme: 'dark' | 'orange' | 'light';
  tag: string;
  dot: 'green' | 'blue';
  icon: 'mapPin' | 'sparkle' | 'truck';
}> = {
  'loc-nit': {
    theme: 'dark',
    tag: 'Tech Campus',
    dot: 'green',
    icon: 'sparkle',
  },
  'loc-lpu': {
    theme: 'orange',
    tag: 'Campus Hub',
    dot: 'green',
    icon: 'mapPin',
  },
  'loc-outside': {
    theme: 'light',
    tag: 'City Store & Delivery',
    dot: 'blue',
    icon: 'truck',
  },
};

/** The three Washing Basket locations: 3 boxes in a row with live operations, staff & orders. */
export default function LaundryLocationsPage() {
  const state = useLaundryState();
  const { show } = useToast();
  const { location, label, isFiltered, setLocation } = useOperationalLocation();

  if (!state) {
    return (
      <div className="page">
        <SkeletonRows rows={3} height={160} />
      </div>
    );
  }

  const allLocations = [...state.locations].sort(
    (a, b) => (LOCATION_ORDER[a.id] ?? a.sortOrder) - (LOCATION_ORDER[b.id] ?? b.sortOrder)
  );
  const locations = isFiltered
    ? allLocations.filter((l) => l.id === location)
    : allLocations;

  const toggle = async (id: string, active: boolean, name: string) => {
    try {
      await setLocationStatus(id, active ? 'ACTIVE' : 'PAUSED');
      show(
        'success',
        active ? `${name} is taking orders` : `${name} paused`,
        active ? 'Customers can choose it again in the app.' : 'Customers see it as paused; existing orders carry on.'
      );
    } catch (e) {
      show('error', 'That didn’t work', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="mapPin"
        title="Locations"
        description={
          isFiltered
            ? `Showing operational details for ${label} only.`
            : 'View each location’s status, staff coverage and active orders.'
        }
        actions={
          <>
            <SyncPill />
            <ResetDemoButton />
          </>
        }
      />

      {isFiltered && (
        <div className="location-filter-banner" style={{ marginBottom: 16 }}>
          <div className="location-filter-banner__left">
            <div className="location-filter-banner__icon-wrap">
              <Icon name="mapPin" size={18} color="#EA580C" />
            </div>
            <div className="location-filter-banner__content">
              <div className="location-filter-banner__headline">
                <span className="location-filter-banner__pill">
                  <span className="location-filter-banner__dot" />
                  Active Operational Hub
                </span>
                <span className="location-filter-banner__name">{label} Hub</span>
              </div>
              <p className="location-filter-banner__sub">
                Hub-specific location details isolated. Showing <strong>{label}</strong> only.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="location-filter-banner__btn"
            onClick={() => setLocation('all')}
          >
            Switch to All locations
          </button>
        </div>
      )}

      {/* ── 3 Boxes in a Row Grid (Matches Picture 2 Layout) ── */}
      <div className="locations-grid">
        {locations.map((l, idx) => {
          const st = locationStats(state, l);
          const meta = LOCATION_THEMES[l.id] ?? {
            theme: idx === 0 ? 'dark' : idx === 1 ? 'orange' : 'light',
            tag: 'Laundry Hub',
            dot: 'green' as const,
            icon: 'mapPin' as const,
          };
          const isActive = l.status === 'ACTIVE';
          const activeStaff = st.staff.filter((x) => x.status === 'ACTIVE').length;

          return (
            <div key={l.id} className={`location-box location-box--${meta.theme}`}>
              {/* Top Details & Metrics */}
              <div>
                {/* Header Tag & Squircle Icon Badge */}
                <div className="location-box__header">
                  <span className="location-box__tag">
                    <span className={`location-box__tag-dot location-box__tag-dot--${isActive ? meta.dot : 'muted'}`} />
                    {meta.tag} &bull; {isActive ? 'Active' : 'Paused'}
                  </span>
                  <span className="location-box__icon-badge" aria-hidden>
                    <Icon name={meta.icon} size={18} />
                  </span>
                </div>

                {/* Title & PIN code */}
                <h3 className="location-box__title">
                  <span>{l.name}</span>
                  <span className="location-box__pin-chip">PIN {l.pincode}</span>
                </h3>

                {/* Subtitle / Description */}
                <p className="location-box__desc">
                  {l.description}
                </p>

                {/* 4-Stat Grid (2x2) */}
                <div className="location-box__stats">
                  <Link
                    to="/orders?status=active"
                    className="location-box__stat-tile"
                    title="View open orders for this location"
                  >
                    <span className="location-box__stat-num">{st.open}</span>
                    <span className="location-box__stat-label">Open orders &rarr;</span>
                  </Link>

                  <div className="location-box__stat-tile">
                    <span className="location-box__stat-num">{st.counts.delivered}</span>
                    <span className="location-box__stat-label">Delivered</span>
                  </div>

                  <Link
                    to={`/laundry/staff?location=${l.id}`}
                    className="location-box__stat-tile"
                    title="View staff roster for this location"
                  >
                    <span className="location-box__stat-num">{st.staff.length}</span>
                    <span className="location-box__stat-label">{activeStaff} active staff &rarr;</span>
                  </Link>

                  <div className="location-box__stat-tile">
                    <span className="location-box__stat-num">{money(st.revenue)}</span>
                    <span className="location-box__stat-label">Paid volume</span>
                  </div>
                </div>

                {/* Services Pills */}
                <div className="location-box__services">
                  {l.serviceModes.map((m) => (
                    <span
                      key={m}
                      className={`location-box__service-pill${m === 'HOME_PICKUP' ? ' location-box__service-pill--orange' : ''}`}
                    >
                      <Icon name={m === 'HOME_PICKUP' ? 'truck' : 'bag'} size={12} />
                      {MODE_COPY[m].label}
                    </span>
                  ))}
                </div>

                {/* Office & Hours Info Box */}
                <div className="location-box__office-card">
                  <div className="location-box__office-row">
                    <Icon name="mapPin" size={13} />
                    <span><strong>{l.office.name}</strong> &ndash; {l.office.address}</span>
                  </div>
                  <div className="location-box__office-row">
                    <Icon name="clock" size={13} />
                    <span>{l.office.hours}</span>
                  </div>
                  <div className="location-box__office-row">
                    <Icon name="phone" size={13} />
                    <span>{l.office.phone}</span>
                  </div>
                  {l.homePickup ? (
                    <div className="location-box__office-row" style={{ marginTop: 2 }}>
                      <Icon name="truck" size={13} />
                      <span>{l.homePickup.areaNote} ({l.homePickup.slots.length} daily slots)</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Footer Switch Toggle */}
              <div className="location-box__footer">
                <div className="location-box__switch-info">
                  <span className="location-box__switch-label">Taking new orders</span>
                  <span className="location-box__switch-desc">
                    {isActive ? 'Accepting customer bookings' : 'Paused for new orders'}
                  </span>
                </div>
                <MiniSwitch
                  checked={isActive}
                  onChange={(on) => toggle(l.id, on, l.shortName)}
                  label={`Taking new orders for ${l.name}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
