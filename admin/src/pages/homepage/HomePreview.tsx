import { ART, ART_TINT } from '@/components/domain/art';
import { OfferTicket } from '@/components/domain/OfferTicket';
import { Icon, isIconName } from '@/components/ui/Icon';
import { dayDate, money } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { ORDER_STATUS } from '@/lib/status';
import { catalogApi, customersApi, offersApi } from '@/services';
import type { HomepageContent, HomeSectionId } from '@/types';
import { TINT_COLOR } from './ContentEditors';

/** The customer used for the preview: the app's own sample account, so the numbers match the customer app. */
const SAMPLE_CUSTOMER = 'u-1001';

/**
 * A scaled-down copy of the customer app's Home screen (mobile/src/screens/app/HomeScreen.tsx), drawn with
 * the same colours, shapes and wording, in the order and with the sections chosen on this page.
 */
export function HomePreview({ home }: { home: HomepageContent }) {
  const customer = useQuery(`customer:${SAMPLE_CUSTOMER}`, () => customersApi.getCustomer(SAMPLE_CUSTOMER));
  const services = useQuery('services', catalogApi.listServices);
  const offers = useQuery('offers', offersApi.listOffers);
  const d = customer.data;
  const first = d?.customer.fullName.split(' ')[0] ?? 'there';
  const active = d?.orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled') ?? [];
  const lead = active[0];
  const shownOffers = (offers.data ?? []).filter((o) => o.visible);
  const home1 = d?.addresses.find((a) => a.isDefault);

  const render: Record<HomeSectionId, () => React.ReactNode> = {
    greeting: () => (
      <div className="hp-greeting">
        <h3>
          Hello,
          <br />
          {first}!
        </h3>
        <div className="hp-today">
          <span>
            <i /> Slots open today
          </span>
          <strong>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
        </div>
      </div>
    ),
    overview: () => (
      <div className="hp-overview">
        <div className="hp-tile hp-tile--dark">
          <div className="hp-row">
            <span className="hp-chip hp-chip--dark">
              <i style={{ background: '#FFA742' }} /> In progress
            </span>
            <span className="hp-chip hp-chip--dark">
              <i style={{ background: '#12AD2B' }} /> {d?.orders.filter((o) => o.status === 'delivered').length ?? 0} done
            </span>
          </div>
          <div className="hp-row hp-row--end">
            <div>
              <strong className="hp-big">{active.length}</strong>
              <span className="hp-cap">Active orders</span>
            </div>
            {lead ? (
              <div className="hp-lead">
                <span>#{lead.id}</span>
                <strong>{ORDER_STATUS[lead.status].label}</strong>
              </div>
            ) : null}
          </div>
        </div>
        <div className="hp-pair">
          <div className="hp-tile hp-tile--light">
            <span className="hp-chip">
              <i style={{ background: '#013E86' }} /> Next pickup
            </span>
            <div>
              <strong className="hp-mid">{dayDate(new Date().toISOString())}</strong>
              <span className="hp-cap">10:00 AM – 12:00 PM</span>
            </div>
          </div>
          <div className="hp-tile hp-tile--orange">
            <span className="hp-chip hp-chip--orange">Wallet</span>
            <div>
              <strong className="hp-mid">{money(d?.wallet.balance ?? 0)}</strong>
              {d?.wallet.pending ? <span className="hp-cap">+{money(d.wallet.pending)} pending</span> : null}
            </div>
          </div>
        </div>
      </div>
    ),
    perks: () => (
      <div className="hp-perks">
        {home.perks.map((p, i) => (
          <span key={p.id} className="hp-perk">
            {i ? <b aria-hidden /> : null}
            <Icon name={isIconName(p.icon) ? p.icon : 'star'} size={11} color={TINT_COLOR[p.tint]} strokeWidth={2.2} />
            {p.label || '…'}
          </span>
        ))}
      </div>
    ),
    booking: () => (
      <div className="hp-booking">
        <span className="hp-booking__halo" aria-hidden />
        <img src={ART[home.booking.art] ?? ART.steam} alt="" className="hp-booking__art" />
        <div className="hp-booking__body">
          <span className="hp-chip hp-chip--white">
            <i style={{ background: '#FFA742' }} /> {home.booking.kicker}
          </span>
          <strong className="hp-booking__title">{home.booking.title}</strong>
          <span className="hp-booking__cta">
            {home.booking.cta} <Icon name="arrowRight" size={10} color="#fff" strokeWidth={2.4} />
          </span>
        </div>
      </div>
    ),
    recentOrders: () => (
      <div>
        <div className="hp-section-head">
          <strong>Recent orders</strong>
          <span>View all →</span>
        </div>
        <div className="hp-orders">
          {(d?.orders ?? []).slice(0, 2).map((o) => (
            <div key={o.id} className="hp-order">
              <span className="hp-order__art" style={{ background: ART_TINT.collecting }}>
                <img src={ART.collecting} alt="" />
              </span>
              <span className="grow">
                <strong>{o.serviceName}</strong>
                <span>
                  #{o.id} · {ORDER_STATUS[o.status].label}
                </span>
              </span>
              <strong>{money(o.total)}</strong>
            </div>
          ))}
        </div>
      </div>
    ),
    services: () => (
      <div>
        <div className="hp-section-head">
          <strong>Our services</strong>
          <span>Price list →</span>
        </div>
        <div className="hp-services">
          {(services.data ?? [])
            .filter((s) => s.available)
            .map((s) => (
              <div key={s.id} className="hp-service">
                <span className="hp-service__art" style={{ background: ART_TINT[s.art] ?? '#F4F5F7' }}>
                  <img src={ART[s.art]} alt="" />
                </span>
                <strong>{s.name}</strong>
                {s.startingPrice ? (
                  <span>
                    from <b>{money(s.startingPrice.price)}</b> / {s.startingPrice.unit}
                  </span>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    ),
    offers: () =>
      shownOffers.length ? (
        <div className="hp-offers">
          <div className="hp-section-head">
            <strong>Available offers</strong>
            <span>View all →</span>
          </div>
          <div className="hp-offers__deck">
            <OfferTicket offer={shownOffers[0]} index={0} width={230} />
          </div>
        </div>
      ) : null,
  };

  return (
    <div className="phone" role="img" aria-label="Preview of the customer app home page">
      <div className="phone__screen">
        <div className="hp-topbar">
          <img src="/logo.png" alt="" />
          <span className="hp-topbar__addr">
            <strong>
              <i /> {home1?.label ?? 'Home'}
            </strong>
            <span>{home1?.line2 ?? ''}</span>
          </span>
          <span className="hp-round">
            <Icon name="bell" size={12} />
          </span>
          <span className="hp-round">
            <Icon name="menu" size={12} />
          </span>
        </div>
        <div className="hp-body">
          {home.sections
            .filter((s) => s.visible)
            .map((s) => (
              <div key={s.id} className="hp-section">
                {render[s.id]()}
              </div>
            ))}
        </div>
        <div className="hp-tabbar" aria-hidden>
          {(['home', 'wallet', 'plus', 'bag', 'user'] as const).map((ic, i) => (
            <span key={ic} className={i === 0 ? 'on' : ''}>
              <Icon name={ic} size={12} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
