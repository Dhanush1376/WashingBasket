import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Tag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { PageHeader } from '@/components/ui/PageHeader';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { FilterPills, ResultNote, SearchInput, Toolbar } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { usePageParam, useUrlState } from '@/hooks/useUrlState';
import { matches, when } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { NOTIFICATION_TYPE } from '@/lib/status';
import { customersApi, engagementApi, type NotificationRow } from '@/services';
import type { NotificationType } from '@/types';

type Source = 'all' | 'team' | 'automatic';

export default function NotificationsPage() {
  const list = useQuery('notifications', engagementApi.listNotifications);
  const [compose, setCompose] = useUrlState<'' | '1'>('compose', '');

  return (
    <div className="page">
      <PageHeader
        icon="bell"
        title="Messages"
        description="Send announcements and review messages customers receive."
        actions={
          <Button variant="accent" icon="send" onClick={() => setCompose('1')}>
            Write a message
          </Button>
        }
      />
      <Card>
        <QueryView query={list}>{(all) => <MessageTable all={all} />}</QueryView>
      </Card>
      {compose ? <ComposeModal onClose={() => setCompose('')} /> : null}
    </div>
  );
}

function MessageTable({ all }: { all: NotificationRow[] }) {
  const [source, setSource] = useUrlState<Source>('from', 'all');
  const [type, setType] = useUrlState<'any' | NotificationType>('type', 'any');
  const [q, setQ] = useUrlState('q', '');
  const [page, setPage] = usePageParam();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = useMemo(
    () => all.filter((n) => (source === 'all' || n.sentBy === source) && (type === 'any' || n.type === type) && matches(q, n.title, n.body, n.customerName ?? 'everyone', n.orderId)),
    [all, source, type, q],
  );
  const open = all.find((n) => n.id === openId) ?? null;

  const to = (n: NotificationRow) => (n.customerId ? <Link to={`/customers?open=${n.customerId}`} onClick={(e) => e.stopPropagation()}>{n.customerName}</Link> : <Tag tone="orange">Every customer</Tag>);

  const columns: Column<NotificationRow>[] = [
    {
      key: 'msg',
      header: 'Message',
      sortValue: (n) => n.title,
      render: (n) => (
        <div className="cell-main">
          <span className="txn-icon">
            <Icon name={NOTIFICATION_TYPE[n.type].icon} size={16} />
          </span>
          <div className="cell-main__text">
            <span className="cell-main__title">{n.title}</span>
            <span className="cell-main__sub">{n.body}</span>
          </div>
        </div>
      ),
    },
    { key: 'to', header: 'Sent to', sortValue: (n) => n.customerName ?? '', render: to },
    { key: 'from', header: 'Sent by', sortValue: (n) => n.sentBy, render: (n) => <span className="soft">{n.sentBy === 'team' ? 'Your team' : 'Automatic'}</span>, hideOnTablet: true },
    { key: 'when', header: 'When', sortValue: (n) => n.createdAt, render: (n) => <span className="soft nowrap">{when(n.createdAt)}</span> },
    { key: 'read', header: 'Seen', align: 'center', sortValue: (n) => (n.read ? 1 : 0), render: (n) => (n.customerId ? (n.read ? <Icon name="check" size={16} className="positive" /> : <span className="muted">Not yet</span>) : <span className="muted">—</span>), hideOnTablet: true },
  ];

  return (
    <div className="stack">
      <Toolbar
        end={
          <>
            <Select className="select--compact" value={type} onChange={(e) => setType(e.target.value as 'any' | NotificationType)} aria-label="Kind of message">
              <option value="any">Every kind</option>
              {(Object.keys(NOTIFICATION_TYPE) as NotificationType[]).map((t) => (
                <option key={t} value={t}>
                  {NOTIFICATION_TYPE[t].label}
                </option>
              ))}
            </Select>
            <SearchInput value={q} onChange={setQ} placeholder="Search messages or names" />
          </>
        }
      >
        <FilterPills<Source>
          label="Who sent it"
          value={source}
          onChange={setSource}
          options={[
            { value: 'all', label: 'All', count: all.length },
            { value: 'team', label: 'Written by your team', count: all.filter((n) => n.sentBy === 'team').length },
            { value: 'automatic', label: 'Automatic', count: all.filter((n) => n.sentBy === 'automatic').length },
          ]}
        />
      </Toolbar>
      <ResultNote shown={rows.length} total={all.length} noun="messages" onReset={() => { setSource('all'); setType('any'); setQ(''); }} />
      <DataTable
        caption="Messages sent to customers"
        rows={rows}
        columns={columns}
        rowKey={(n) => n.id}
        initialSort={{ key: 'when', dir: 'desc' }}
        onRowClick={(n) => setOpenId(n.id)}
        rowLabel={(n) => `Open message ${n.title}`}
        page={page}
        onPageChange={setPage}
        mobileCard={(n) => (
          <div className="cell-main grow">
            <span className="txn-icon">
              <Icon name={NOTIFICATION_TYPE[n.type].icon} size={16} />
            </span>
            <div className="mcard">
              <div className="mcard__title">{n.title}</div>
              <div className="mcard__sub clamp-2">{n.body}</div>
              <div className="mcard__sub">
                {n.customerName ?? 'Every customer'} · {when(n.createdAt)}
              </div>
            </div>
          </div>
        )}
        empty={<EmptyState icon="bell" title="No messages match" message="Try another filter or clear the search." />}
      />

      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ''} description={open ? `${NOTIFICATION_TYPE[open.type].label} · ${when(open.createdAt)}` : undefined} size="sm">
        {open ? (
          <div className="stack">
            <p>{open.body}</p>
            <Facts>
              <Fact label="Sent to">{to(open)}</Fact>
              <Fact label="Sent by">{open.sentBy === 'team' ? 'Your team' : 'Automatic order update'}</Fact>
              {open.customerId ? <Fact label="Seen">{open.read ? 'Yes' : 'Not yet'}</Fact> : null}
              {open.orderId ? (
                <Fact label="Order">
                  <Link to={`/orders?open=${open.orderId}`}>{open.orderId}</Link>
                </Fact>
              ) : null}
            </Facts>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

const TEMPLATES: { label: string; type: NotificationType; title: string; body: string }[] = [
  { label: 'Holiday hours', type: 'account', title: 'Holiday hours this week', body: 'We’re closed on the holiday. Pickups booked for that day move to the next morning.' },
  { label: 'Running late', type: 'pickup', title: 'Your pickup is running late', body: 'Sorry, our rider is about 30 minutes behind. We’ll be with you shortly.' },
  { label: 'New offer', type: 'account', title: 'A new offer is waiting', body: 'Open Offers on the Home screen to see this week’s savings.' },
];

function ComposeModal({ onClose }: { onClose: () => void }) {
  const customers = useQuery('customers', customersApi.listCustomers);
  const { run, isBusy } = useAction();
  const [audience, setAudience] = useState<'all' | 'one'>('one');
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState<NotificationType>('account');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tried, setTried] = useState(false);
  const problems = {
    customer: audience === 'one' && !customerId ? 'Choose who gets this message.' : undefined,
    title: title.trim().length < 3 ? 'Write a short title (at least 3 letters).' : undefined,
    body: body.trim().length < 5 ? 'Write the message.' : undefined,
  };
  const errors = tried ? problems : ({} as Partial<typeof problems>);
  const count = audience === 'all' ? (customers.data?.filter((c) => c.status === 'active').length ?? 0) : 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    const ok = await run(
      'send',
      () => engagementApi.sendNotification({ customerId: audience === 'all' ? null : customerId, type, title, body }),
      'Message added to the list',
      'Sample data only: nothing was delivered to any phone.',
    );
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Write a message"
      description="It appears in the bell on the customer’s Home screen."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="compose-form" icon="send" loading={isBusy('send')}>
            {audience === 'all' ? `Send to ${count} customers` : 'Send message'}
          </Button>
        </>
      }
    >
      <form id="compose-form" className="form" onSubmit={submit} noValidate>
        <FilterPills<'all' | 'one'>
          label="Who gets it"
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'one', label: 'One customer' },
            { value: 'all', label: 'Every active customer' },
          ]}
        />
        {audience === 'one' ? (
          <Field label="Customer" error={errors.customer}>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-autofocus>
              <option value="">Choose a customer…</option>
              {(customers.data ?? [])
                .slice()
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} · {c.phone}
                  </option>
                ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Kind" hint="Sets the little icon next to the message.">
          <Select value={type} onChange={(e) => setType(e.target.value as NotificationType)}>
            {(Object.keys(NOTIFICATION_TYPE) as NotificationType[]).map((t) => (
              <option key={t} value={t}>
                {NOTIFICATION_TYPE[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="template-row" aria-label="Start from a template">
          <span className="muted small">Start from:</span>
          {TEMPLATES.map((t) => (
            <button key={t.label} type="button" className="chip" onClick={() => { setType(t.type); setTitle(t.title); setBody(t.body); }}>
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Title" error={errors.title} hint={`${title.length}/48`}>
          <TextInput value={title} maxLength={48} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Message" error={errors.body} hint={`${body.length}/160`}>
          <TextArea value={body} maxLength={160} onChange={(e) => setBody(e.target.value)} className="textarea--short" />
        </Field>
        <p className="note">
          <Icon name="info" size={16} />
          This portal runs on sample data, so the message is only added to the list here. No customer receives it.
        </p>
      </form>
    </Modal>
  );
}
