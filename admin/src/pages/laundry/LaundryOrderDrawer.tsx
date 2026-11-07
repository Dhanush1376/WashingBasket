import { useState } from 'react';

import { StatusBadge, Tag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, Fact, Facts } from '@/components/ui/Card';
import { Field, TextArea } from '@/components/ui/Form';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/States';
import { FilterPills } from '@/components/ui/Toolbar';
import { useToast } from '@/components/ui/Toast';
import { date, money, when } from '@/lib/format';
import { ADMIN_NAME, LAUNDRY_TONE, statusBadge, useLaundryState } from '@/laundry/store';
import { MODE_COPY, PAYMENT_COPY, QR_PURPOSE_COPY } from '@customer/mock/engine/lifecycle';
import { activitiesFor, findCustomer, findLocation, findOrder, findReceipt, findStaff, qrState, walletBalance } from '@customer/mock/engine/selectors';
import { resolveIssue } from '@customer/mock/services/orderService';
import type { IssueKind, LaundryOrder, MockState } from '@customer/mock/types';

const ISSUE_KIND_LABEL: Record<IssueKind, string> = { MISSING_ITEMS: 'Missing items', DAMAGED: 'Damaged', WRONG_ITEMS: 'Wrong items', OTHER: 'Other' };

type Tab = 'overview' | 'history' | 'payments' | 'qr' | 'staff' | 'customer';

/** One laundry order, everything about it: the same record the customer and staff see, read live. */
export function LaundryOrderDrawer({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const state = useLaundryState();
  const [tab, setTab] = useState<Tab>('overview');
  const order = state ? findOrder(state, orderId) : undefined;
  return (
    <Drawer open onClose={onClose} title={`Order ${orderId}`} width={640} subtitle={order ? <StatusBadge size="sm" {...statusBadge(order.status)} /> : undefined}>
      {!state ? null : !order ? (
        <EmptyState icon="bag" title="Order not found" message="It may have been reset. Close this panel to go back to the list." />
      ) : (
        <div className="stack">
          <FilterPills<Tab>
            label="Order details"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'history', label: 'Status history' },
              { value: 'payments', label: 'Payments' },
              { value: 'qr', label: 'QR codes' },
              { value: 'staff', label: 'Staff' },
              { value: 'customer', label: 'Customer' },
            ]}
          />
          {tab === 'overview' ? <Overview s={state} o={order} /> : null}
          {tab === 'history' ? <History s={state} o={order} only="status" /> : null}
          {tab === 'payments' ? <Payments s={state} o={order} /> : null}
          {tab === 'qr' ? <QrHistory s={state} o={order} /> : null}
          {tab === 'staff' ? <History s={state} o={order} only="staff" /> : null}
          {tab === 'customer' ? <CustomerTab s={state} o={order} /> : null}
        </div>
      )}
    </Drawer>
  );
}

function Overview({ s, o }: { s: MockState; o: LaundryOrder }) {
  const loc = findLocation(s, o.locationId);
  const receipt = findReceipt(s, o.id);
  const issue = s.issues.find((i) => i.orderId === o.id && i.status === 'OPEN') ?? s.issues.find((i) => i.orderId === o.id);
  const staff = (id?: string) => (id ? findStaff(s, id)?.name ?? id : '—');
  return (
    <>
      {issue ? <IssueCard s={s} issueId={issue.id} /> : null}
      <Card tone="stone">
        <Facts>
          <Fact label="Location">{loc?.name}</Fact>
          <Fact label="Service">{MODE_COPY[o.serviceMode].label}</Fact>
          <Fact label="Customer">{findCustomer(s, o.customerId)?.name}</Fact>
          <Fact label="Placed">{when(o.createdAt)}</Fact>
          <Fact label="Payment">
            <span style={{ color: LAUNDRY_TONE[PAYMENT_COPY[o.payment.status].tone].fg }}>{PAYMENT_COPY[o.payment.status].label}</span>
          </Fact>
          <Fact label="Receipt">{receipt ? receipt.number : '—'}</Fact>
          <Fact label="Accepted by">{o.acceptedBy ? `${staff(o.acceptedBy)} · ${o.acceptedAt ? when(o.acceptedAt) : ''}` : o.rejectedBy ? `Rejected by ${staff(o.rejectedBy)}` : '—'}</Fact>
          <Fact label="Delivered">{o.deliveredAt ? `${when(o.deliveredAt)} · ${staff(o.deliveredBy)}` : '—'}</Fact>
          {o.rejectionReason ? (
            <Fact label="Rejection reason" wide>
              {o.rejectionReason}
            </Fact>
          ) : null}
          {o.cancelReason ? (
            <Fact label="Cancelled" wide>
              {o.cancelReason}
            </Fact>
          ) : null}
          {o.pickup ? (
            <Fact label="Pickup" wide>
              {date(`${o.pickup.date}T00:00:00`)} · {o.pickup.slotLabel} · {o.pickup.address}
              {o.pickup.landmark ? ` (${o.pickup.landmark})` : ''} · {o.pickup.contactPhone}
            </Fact>
          ) : null}
          {o.verification ? <Fact label="Customer verified">{`${o.verification.piecesConfirmed} pieces · ${when(o.verification.confirmedAt)}`}</Fact> : null}
          {o.instructions ? (
            <Fact label="Instructions" wide>
              {o.instructions}
            </Fact>
          ) : null}
        </Facts>
      </Card>
      <Card>
        <CardHeader title="Items" hint={`${o.pieces} pieces`} />
        <ul className="count-list">
          {o.lines.map((l) => (
            <li key={l.itemId} className="count-list__row">
              <span className="grow">
                {l.name} <span className="muted">· {l.categoryName}</span>
              </span>
              <span className="num">
                {l.qty} × {money(l.unitPrice)}
              </span>
              <span className="strong num">{money(l.amount)}</span>
            </li>
          ))}
          <li className="count-list__row">
            <span className="grow">Service charge</span>
            <span className="num">{o.serviceCharge ? money(o.serviceCharge) : 'Free'}</span>
          </li>
          <li className="count-list__summary">
            <span>Total</span>
            <span className="num">{money(o.total)}</span>
          </li>
        </ul>
      </Card>
    </>
  );
}

function IssueCard({ s, issueId }: { s: MockState; issueId: string }) {
  const { show } = useToast();
  const issue = s.issues.find((i) => i.id === issueId)!;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const resolve = async () => {
    setBusy(true);
    try {
      await resolveIssue(issue.id, text, ADMIN_NAME);
      show('success', `Issue on ${issue.orderId} resolved`, 'The customer is asked to check their clothes again.');
      setText('');
    } catch (e) {
      show('error', 'That didn’t work', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title={issue.status === 'OPEN' ? 'Open issue' : 'Resolved issue'} icon="alert" hint={`Reported ${when(issue.reportedAt)}`} action={<Tag tone={issue.status === 'OPEN' ? 'orange' : 'neutral'}>{ISSUE_KIND_LABEL[issue.kind]}</Tag>} />
      <div className="stack stack--sm">
        {issue.mismatches.length ? <p>{issue.mismatches.map((m) => `${m.name}: received ${m.received} of ${m.expected}`).join(' · ')}</p> : null}
        {issue.note ? <p className="soft">“{issue.note}”</p> : null}
        {issue.status === 'OPEN' ? (
          <>
            <Field label="How was it resolved?" hint="The customer sees this, and can then confirm delivery.">
              <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Missing shirt found at the counter and handed over" />
            </Field>
            <div>
              <Button variant="primary" icon="check" onClick={resolve} loading={busy} disabled={text.trim().length < 3}>
                Mark resolved
              </Button>
            </div>
          </>
        ) : (
          <p className="soft">
            {issue.resolution} · {issue.resolvedBy} · {issue.resolvedAt ? when(issue.resolvedAt) : ''}
          </p>
        )}
      </div>
    </Card>
  );
}

function History({ s, o, only }: { s: MockState; o: LaundryOrder; only: 'status' | 'staff' }) {
  const all = activitiesFor(s, o.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const list = only === 'status' ? all.filter((a) => a.type === 'STATUS_CHANGED') : all.filter((a) => a.actor.kind === 'staff' || a.actor.kind === 'admin');
  if (!list.length) return <EmptyState compact icon="clock" title="Nothing yet" message={only === 'staff' ? 'No staff have worked on this order yet.' : 'No status changes yet.'} />;
  return (
    <ul className="activity">
      {list.map((a) => (
        <li key={a.id}>
          <div className="activity__item">
            <span className={`activity__icon activity__icon--${a.actor.kind === 'staff' ? 'order' : a.actor.kind === 'customer' ? 'signup' : 'pickup'}`} />
            <span className="activity__text">
              <strong>{a.to ? statusBadge(a.to).label : a.message}</strong>
              <span>
                {a.to ? `${a.message} · ` : ''}
                {a.actor.name}
              </span>
            </span>
            <time className="activity__time" dateTime={a.at}>
              {when(a.at)}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Payments({ s, o }: { s: MockState; o: LaundryOrder }) {
  const txns = s.walletTransactions.filter((t) => t.orderId === o.id);
  const failures = activitiesFor(s, o.id).filter((a) => a.type === 'PAYMENT_FAILED');
  return (
    <>
      <Card tone="stone">
        <Facts>
          <Fact label="Status">{PAYMENT_COPY[o.payment.status].label}</Fact>
          <Fact label="Amount">{money(o.payment.amount)}</Fact>
          <Fact label="Method">Wallet (demo)</Fact>
          <Fact label="Failed attempts">{o.payment.failedAttempts}</Fact>
        </Facts>
      </Card>
      <ul className="count-list">
        {txns.map((t) => (
          <li key={t.id} className="count-list__row">
            <span className="grow">
              {t.title} <span className="muted">· {t.id}</span>
            </span>
            <span className="soft">{when(t.date)}</span>
            <span className={`strong num ${t.type === 'debit' ? 'negative' : 'positive'}`}>
              {t.type === 'debit' ? '−' : '+'}
              {money(t.amount)}
            </span>
          </li>
        ))}
        {failures.map((a) => (
          <li key={a.id} className="count-list__row">
            <span className="grow negative">{a.message}</span>
            <span className="soft">{when(a.at)}</span>
          </li>
        ))}
      </ul>
      {!txns.length && !failures.length ? <EmptyState compact icon="wallet" title="No payments yet" message="The customer hasn’t paid for this order." /> : null}
      <p className="muted small">Each order is paid once (idempotency key pay:{o.id}); a rejection or cancellation refunds once (reverse:{o.id}). Mock wallet: no real money.</p>
    </>
  );
}

function QrHistory({ s, o }: { s: MockState; o: LaundryOrder }) {
  const qrs = s.qrTokens.filter((q) => q.orderId === o.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const now = new Date().toISOString();
  return (
    <div className="stack">
      {qrs.map((q) => (
        <Card key={q.id}>
          <CardHeader title={QR_PURPOSE_COPY[q.purpose].label} hint={`${q.id} · created ${when(q.createdAt)}${q.expiresAt ? ` · expires ${when(q.expiresAt)}` : ''}`} action={<Tag tone={qrState(q, now) === 'ACTIVE' ? 'navy' : 'neutral'}>{qrState(q, now).toLowerCase()}</Tag>} />
          {q.scans.length ? (
            <ul className="count-list">
              {q.scans.map((sc, i) => (
                <li key={i} className="count-list__row">
                  <span className={`grow ${sc.result === 'REFUSED' ? 'negative' : ''}`}>
                    {sc.result === 'REFUSED' ? 'Refused' : sc.result === 'CONSUMED' ? 'Used' : 'Valid scan'} · {sc.reason}
                  </span>
                  <span className="soft">
                    {findStaff(s, sc.staffId)?.name ?? sc.staffId} · {when(sc.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Not scanned yet.</p>
          )}
          {q.revokeReason ? <p className="muted small">Revoked: {q.revokeReason}</p> : null}
        </Card>
      ))}
      <p className="muted small">The QR holds only a random token and its purpose, never customer details. Each code works once, at its own location, until it expires.</p>
    </div>
  );
}

function CustomerTab({ s, o }: { s: MockState; o: LaundryOrder }) {
  const c = findCustomer(s, o.customerId);
  if (!c) return <EmptyState compact icon="user" title="Customer not found" message="" />;
  const theirs = s.orders.filter((x) => x.customerId === c.id);
  return (
    <Card tone="stone">
      <Facts>
        <Fact label="Name">{c.name}</Fact>
        <Fact label="Phone">{c.phone || '—'}</Fact>
        <Fact label="Email">{c.email || '—'}</Fact>
        <Fact label="Home location">{c.homeLocationId ? findLocation(s, c.homeLocationId)?.shortName : '—'}</Fact>
        <Fact label="Wallet balance">{money(walletBalance(s, c.id))}</Fact>
        <Fact label="Laundry orders">{theirs.length}</Fact>
        <Fact label="Customer since">{date(c.createdAt)}</Fact>
        <Fact label="ID">{c.id}</Fact>
      </Facts>
    </Card>
  );
}
