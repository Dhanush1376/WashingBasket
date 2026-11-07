/** Refer & earn, notifications and support: everything the team uses to talk to customers. */
import type { AdminNotification, AdminReferral, AdminTicket, Faq, NotificationType, ReferralProgramSettings, SupportData } from '@/types';
import { db, newest, nextId, nowIso, respond } from './db';
import { customerName } from './lookups';

/* ───────────── Refer & earn ───────────── */

export type ReferralRow = AdminReferral & { referrerName: string };
export type ReferralOverview = {
  program: ReferralProgramSettings;
  referrals: ReferralRow[];
  paid: number;
  waiting: number;
};

export function getReferralOverview(): Promise<ReferralOverview> {
  const referrals = [...db.referrals].sort((a, b) => newest(a.date, b.date)).map((r) => ({ ...r, referrerName: customerName(r.referrerId) }));
  return respond(
    {
      program: db.referralProgram,
      referrals,
      paid: referrals.filter((r) => r.status === 'rewarded').reduce((s, r) => s + r.reward, 0),
      waiting: referrals.filter((r) => r.status === 'joined').reduce((s, r) => s + r.reward, 0),
    },
    'referrals',
  );
}

/** SIMULATED: the new amounts apply to future referrals only; rewards already promised don't change. */
export function updateReferralProgram(next: ReferralProgramSettings): Promise<ReferralProgramSettings> {
  db.referralProgram = { ...next, steps: next.steps.map((s) => s.trim()).filter(Boolean) };
  return respond(db.referralProgram, '', 450);
}

/* ───────────── Notifications ───────────── */

export type NotificationRow = AdminNotification & { customerName: string | null };

export function listNotifications(): Promise<NotificationRow[]> {
  return respond(
    [...db.notifications].sort((a, b) => newest(a.createdAt, b.createdAt)).map((n) => ({ ...n, customerName: n.customerId ? customerName(n.customerId) : null })),
    'notifications',
  );
}

export type NotificationInput = { customerId: string | null; type: NotificationType; title: string; body: string };

/** SIMULATED: saved to the sample data so it shows in the list. No message is delivered to any phone. */
export function sendNotification(input: NotificationInput): Promise<AdminNotification> {
  const n: AdminNotification = {
    id: nextId(db.notifications.map((x) => x.id), 'n-'),
    customerId: input.customerId,
    type: input.type,
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: nowIso(),
    read: false,
    sentBy: 'team',
  };
  db.notifications.unshift(n);
  return respond(n, '', 600);
}

/* ───────────── Support ───────────── */

export type TicketRow = AdminTicket & { customerName: string; categoryTitle: string };

export function getSupport(): Promise<Omit<SupportData, 'tickets'> & { tickets: TicketRow[] }> {
  const cat = (id: string) => db.support.categories.find((c) => c.id === id)?.title ?? 'Other';
  return respond(
    {
      ...db.support,
      tickets: [...db.support.tickets]
        .sort((a, b) => newest(a.createdAt, b.createdAt))
        .map((t) => ({ ...t, customerName: customerName(t.customerId), categoryTitle: cat(t.categoryId) })),
    },
    'support',
  );
}

/** SIMULATED: the reply is stored with the request in the sample data; it isn't delivered to the customer. */
export function replyToTicket(id: string, body: string, resolve: boolean): Promise<AdminTicket> {
  const t = db.support.tickets.find((x) => x.id === id);
  if (!t) return Promise.reject(new Error('Request not found'));
  t.replies.push({ id: nextId(db.support.tickets.flatMap((x) => x.replies.map((r) => r.id)), 're-'), from: 'team', body: body.trim(), at: nowIso() });
  if (resolve) t.status = 'resolved';
  return respond(t, '', 500);
}

/** SIMULATED */
export function setTicketStatus(id: string, status: AdminTicket['status']): Promise<AdminTicket> {
  const t = db.support.tickets.find((x) => x.id === id);
  if (!t) return Promise.reject(new Error('Request not found'));
  t.status = status;
  return respond(t, '', 300);
}

/** SIMULATED: the phone, email and hours on the customer app's Support page. */
export function updateSupportContact(contact: SupportData['contact']): Promise<SupportData['contact']> {
  db.support.contact = { phone: contact.phone.trim(), email: contact.email.trim(), hours: contact.hours.trim() };
  return respond(db.support.contact, '', 400);
}

export function listFaqs(): Promise<Faq[]> {
  return respond(db.faq, 'support');
}

export type FaqInput = Omit<Faq, 'id'>;

/** SIMULATED */
export function saveFaq(input: FaqInput, id?: string): Promise<Faq> {
  const clean = { ...input, question: input.question.trim(), answer: input.answer.trim() };
  const existing = id ? db.faq.find((f) => f.id === id) : undefined;
  if (existing) {
    Object.assign(existing, clean);
    return respond(existing, '', 400);
  }
  const faq: Faq = { id: nextId(db.faq.map((f) => f.id), 'f-'), ...clean };
  db.faq.push(faq);
  return respond(faq, '', 400);
}

/** SIMULATED */
export function deleteFaq(id: string): Promise<void> {
  db.faq = db.faq.filter((f) => f.id !== id);
  return respond(undefined, '', 300);
}

/** SIMULATED */
export function moveFaq(id: string, direction: -1 | 1): Promise<Faq[]> {
  const i = db.faq.findIndex((f) => f.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < db.faq.length) [db.faq[i], db.faq[j]] = [db.faq[j], db.faq[i]];
  return respond(db.faq, '', 200);
}
