import { useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Fact, Facts } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Drawer } from '@/components/ui/Overlay';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { date, money, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { CUSTOMER_STATUS, ORDER_STATUS, REFERRAL_STATUS, TICKET_STATUS, TXN_SOURCE, TXN_STATUS } from '@/lib/status';
import { customersApi, type CustomerDetail } from '@/services';
import { EditCustomerModal } from './EditCustomerModal';

type Tab = 'profile' | 'orders' | 'wallet' | 'more';

export function CustomerDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const detail = useQuery(`customer:${customerId}`, () => customersApi.getCustomer(customerId));
  const c = detail.data?.customer;
  return (
    <Drawer
      open
      onClose={onClose}
      width={640}
      title={c ? c.fullName : 'Customer'}
      subtitle={c ? <>{c.id} · Joined {date(c.customerSince)}</> : undefined}
      footer={detail.data ? <CustomerActions d={detail.data} /> : undefined}
    >
      <QueryView query={detail}>
        {(d) => (d ? <CustomerBody d={d} /> : <EmptyState icon="user" title="Customer not found" message="They may have been removed. Close this panel to go back." />)}
      </QueryView>
    </Drawer>
  );
}

function CustomerActions({ d }: { d: CustomerDetail }) {
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const c = d.customer;
  const pausing = c.status === 'active';
  return (
    <>
      <Button variant="ghost" icon={pausing ? 'lock' : 'refresh'} onClick={() => setConfirm(true)}>
        {pausing ? 'Pause account' : 'Reactivate account'}
      </Button>
      <Button variant="primary" icon="edit" onClick={() => setEditing(true)}>
        Edit details
      </Button>
      {editing ? <EditCustomerModal customer={c} onClose={() => setEditing(false)} /> : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone={pausing ? 'danger' : 'primary'}
        icon={pausing ? 'lock' : 'refresh'}
        title={pausing ? `Pause ${c.fullName}’s account?` : `Reactivate ${c.fullName}?`}
        message={
          pausing ? (
            <>
              They can still sign in and see their orders, but they <strong>can’t book new pickups</strong> until you reactivate the account. Orders already in progress continue as normal.
            </>
          ) : (
            <>They’ll be able to book pickups again straight away.</>
          )
        }
        confirmLabel={pausing ? 'Pause account' : 'Reactivate'}
        loading={isBusy('status')}
        onConfirm={async () => {
          await run('status', () => customersApi.setCustomerStatus(c.id, pausing ? 'paused' : 'active'), pausing ? 'Account paused' : 'Account reactivated');
          setConfirm(false);
        }}
      />
    </>
  );
}

function CustomerBody({ d }: { d: CustomerDetail }) {
  const [tab, setTab] = useState<Tab>('profile');
  const c = d.customer;
  return (
    <>
      <Card tone="dark" className="profile-card">
        <Avatar name={c.fullName} url={c.avatarUrl} size={64} />
        <div className="profile-card__text">
          <div className="row row--wrap">
            <h3 className="profile-card__name">{c.fullName}</h3>
            <StatusBadge size="sm" {...CUSTOMER_STATUS[c.status]} />
          </div>
          <a className="profile-card__line" href={`tel:${c.phone.replace(/\s/g, '')}`}>
            <Icon name="phone" size={14} /> {c.phone}
          </a>
          <a className="profile-card__line" href={`mailto:${c.email}`}>
            <Icon name="mail" size={14} /> {c.email}
          </a>
        </div>
        <dl className="profile-card__stats">
          <div>
            <dt>Orders</dt>
            <dd className="num">{c.orders}</dd>
          </div>
          <div>
            <dt>Wallet</dt>
            <dd className="num">{money(d.wallet.balance)}</dd>
          </div>
          <div>
            <dt>Paid so far</dt>
            <dd className="num">{money(c.totalSpent)}</dd>
          </div>
        </dl>
      </Card>

      <FilterPills<Tab>
        label="Customer details"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'profile', label: 'Profile' },
          { value: 'orders', label: 'Orders', count: d.orders.length },
          { value: 'wallet', label: 'Wallet', count: d.wallet.entries.length },
          { value: 'more', label: 'Referrals & help' },
        ]}
      />

      {tab === 'profile' ? <ProfileTab d={d} /> : null}
      {tab === 'orders' ? <OrdersTab d={d} /> : null}
      {tab === 'wallet' ? <WalletTab d={d} /> : null}
      {tab === 'more' ? <MoreTab d={d} /> : null}
    </>
  );
}

function ProfileTab({ d }: { d: CustomerDetail }) {
  const c = d.customer;
  return (
    <>
      <Card>
        <CardHeader title="Account" />
        <Facts>
          <Fact label="Customer since">{date(c.customerSince)}</Fact>
          <Fact label="Last active">{c.lastActiveAt ? when(c.lastActiveAt) : 'Not yet'}</Fact>
          <Fact label="Phone verified">{c.verification.phone ? 'Yes' : 'Not yet'}</Fact>
          <Fact label="Email verified">{c.verification.email ? 'Yes' : 'Not yet'}</Fact>
          <Fact label="Referral code">
            <span className="mono">{c.referralCode}</span>
          </Fact>
          <Fact label="Joined with a code from">{d.referredByName ?? 'No one'}</Fact>
          {c.note ? (
            <Fact label="Team note (private)" wide>
              {c.note}
            </Fact>
          ) : null}
        </Facts>
      </Card>
      <Card>
        <CardHeader title="Saved addresses" hint="Where we collect from. Customers manage these in the app." />
        {d.addresses.length ? (
          <ul className="address-list">
            {d.addresses.map((a) => (
              <li key={a.id} className="address">
                <span className="address__icon">
                  <Icon name={a.label === 'Work' ? 'bag' : 'home'} size={16} />
                </span>
                <div className="grow">
                  <div className="row row--wrap">
                    <strong>{a.label}</strong>
                    {a.isDefault ? <Tag tone="dark">Default</Tag> : null}
                  </div>
                  <p className="soft">
                    {a.line1}, {a.line2}, {a.city} {a.pincode}
                  </p>
                  {a.pickupInstructions ? <p className="muted">“{a.pickupInstructions}”</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon="mapPin" title="No addresses yet" message="The customer hasn’t added a pickup address." />
        )}
      </Card>
    </>
  );
}

function OrdersTab({ d }: { d: CustomerDetail }) {
  if (!d.orders.length) return <EmptyState icon="bag" title="No orders yet" message="Their orders will show here after the first pickup." />;
  return (
    <ul className="mini-list">
      {d.orders.map((o) => (
        <li key={o.id}>
          <Link to={`/orders?open=${o.id}`} className="mini-row">
            <span className="grow">
              <strong>
                {o.id} · {o.serviceName}
              </strong>
              <span className="muted block">
                {when(o.placedAt)} · {o.itemsLabel}
              </span>
            </span>
            <span className="mini-row__end">
              <span className="strong num">{money(o.total)}</span>
              <StatusBadge size="sm" {...ORDER_STATUS[o.status]} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function WalletTab({ d }: { d: CustomerDetail }) {
  return (
    <>
      <div className="wallet-split">
        <div className="wallet-split__item wallet-split__item--main">
          <span>Available</span>
          <strong className="num">{money(d.wallet.balance)}</strong>
        </div>
        <div className="wallet-split__item">
          <span>Pending</span>
          <strong className="num">{money(d.wallet.pending)}</strong>
        </div>
      </div>
      <p className="muted small">Pending money (like a referral reward) becomes available once the friend’s first order is delivered. The balance is worked out from completed entries only.</p>
      {d.wallet.entries.length ? (
        <ul className="mini-list">
          {d.wallet.entries.map((t) => (
            <li key={t.id} className="mini-row">
              <span className="txn-icon">
                <Icon name={TXN_SOURCE[t.source ?? 'topup'].icon} size={16} />
              </span>
              <span className="grow">
                <strong>{t.title}</strong>
                <span className="muted block">{when(t.date)}</span>
              </span>
              <span className="mini-row__end">
                <span className={`strong num ${t.type === 'debit' ? '' : 'positive'}`}>
                  {t.type === 'debit' ? '−' : '+'}
                  {money(t.amount)}
                </span>
                {t.status === 'pending' ? <StatusBadge size="sm" {...TXN_STATUS.pending} /> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon="wallet" title="No wallet activity" message="Top-ups, rewards and payments will show here." />
      )}
      <Link to={`/wallet?q=${encodeURIComponent(d.customer.fullName)}`} className="text-link">
        See in Wallet <Icon name="arrowRight" size={14} />
      </Link>
    </>
  );
}

function MoreTab({ d }: { d: CustomerDetail }) {
  return (
    <>
      <Card>
        <CardHeader title="Friends they referred" hint={`Code ${d.customer.referralCode}`} />
        {d.referrals.length ? (
          <ul className="mini-list">
            {d.referrals.map((r) => (
              <li key={r.id} className="mini-row">
                <span className="grow">
                  <strong>{r.friendLabel}</strong>
                  <span className="muted block">{date(r.date)}</span>
                </span>
                <span className="mini-row__end">
                  {r.reward ? <span className="strong num">{money(r.reward)}</span> : null}
                  <StatusBadge size="sm" {...REFERRAL_STATUS[r.status]} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon="gift" title="No referrals yet" message="When friends join with their code, they’ll show here." />
        )}
      </Card>
      <Card>
        <CardHeader title="Help requests" />
        {d.tickets.length ? (
          <ul className="mini-list">
            {d.tickets.map((t) => (
              <li key={t.id}>
                <Link to={`/support?open=${t.id}`} className="mini-row">
                  <span className="grow">
                    <strong>{t.subject}</strong>
                    <span className="muted block">
                      {t.id} · {when(t.createdAt)}
                    </span>
                  </span>
                  <StatusBadge size="sm" {...TICKET_STATUS[t.status]} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon="headset" title="No help requests" message="This customer hasn’t asked for help." />
        )}
      </Card>
    </>
  );
}
