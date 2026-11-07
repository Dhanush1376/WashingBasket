import { useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, Fact, Facts } from '@/components/ui/Card';
import { Field, TextArea } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { Drawer } from '@/components/ui/Overlay';
import { useAction } from '@/hooks/useAction';
import { when } from '@/lib/format';
import { TICKET_STATUS } from '@/lib/status';
import { engagementApi, type TicketRow } from '@/services';

export function TicketDrawer({ ticket: t, onClose }: { ticket: TicketRow; onClose: () => void }) {
  const { run, isBusy } = useAction();
  const [reply, setReply] = useState('');
  const [tried, setTried] = useState(false);
  const error = tried && reply.trim().length < 2 ? 'Write a reply first.' : undefined;

  const send = async (resolve: boolean) => {
    setTried(true);
    if (reply.trim().length < 2) return;
    const ok = await run(resolve ? 'resolve' : 'reply', () => engagementApi.replyToTicket(t.id, reply, resolve), resolve ? 'Reply saved and request resolved' : 'Reply saved', 'Sample data only: the customer doesn’t receive it.');
    if (ok) {
      setReply('');
      setTried(false);
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={t.subject}
      subtitle={`${t.id} · ${t.categoryTitle}`}
      headerExtra={<StatusBadge {...TICKET_STATUS[t.status]} />}
      footer={
        t.status === 'open' ? (
          <>
            <Button variant="outline" onClick={() => send(false)} loading={isBusy('reply')}>
              Send reply
            </Button>
            <Button variant="primary" icon="check" onClick={() => send(true)} loading={isBusy('resolve')}>
              Reply & resolve
            </Button>
          </>
        ) : (
          <Button variant="outline" icon="refresh" onClick={() => run('reopen', () => engagementApi.setTicketStatus(t.id, 'open'), 'Request reopened')} loading={isBusy('reopen')}>
            Reopen request
          </Button>
        )
      }
    >
      <Card>
        <Facts>
          <Fact label="Customer">
            <Link to={`/customers?open=${t.customerId}`}>{t.customerName}</Link>
          </Fact>
          <Fact label="Sent">{when(t.createdAt)}</Fact>
          {t.orderId ? (
            <Fact label="About order">
              <Link to={`/orders?open=${t.orderId}`}>{t.orderId}</Link>
            </Fact>
          ) : null}
        </Facts>
      </Card>

      <section aria-label="Conversation" className="thread">
        <div className="bubble bubble--customer">
          <Avatar name={t.customerName} size={30} tone="navy" />
          <div className="bubble__body">
            <p>{t.message ?? 'The customer didn’t add a message.'}</p>
            <span className="bubble__meta">
              {t.customerName} · {when(t.createdAt)}
            </span>
          </div>
        </div>
        {t.replies.map((r) => (
          <div key={r.id} className={`bubble bubble--${r.from}`}>
            {r.from === 'customer' ? <Avatar name={t.customerName} size={30} tone="navy" /> : null}
            <div className="bubble__body">
              <p>{r.body}</p>
              <span className="bubble__meta">
                {r.from === 'team' ? 'Your team' : t.customerName} · {when(r.at)}
              </span>
            </div>
          </div>
        ))}
      </section>

      {t.status === 'open' ? (
        <Field label="Your reply" error={error}>
          <TextArea value={reply} maxLength={600} onChange={(e) => setReply(e.target.value)} placeholder="Hi! Thanks for writing to us…" />
        </Field>
      ) : (
        <p className="note">
          <Icon name="check" size={16} /> This request is resolved. Reopen it if the customer still needs help.
        </p>
      )}
    </Drawer>
  );
}
