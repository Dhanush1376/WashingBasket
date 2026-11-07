import { useEffect, useState, type FormEvent } from 'react';

import { Tag } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, MiniSwitch, Select, TextArea, TextInput } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog, Modal } from '@/components/ui/Overlay';
import { QueryView } from '@/components/ui/QueryView';
import { EmptyState } from '@/components/ui/States';
import { FilterPills, SearchInput, Toolbar } from '@/components/ui/Toolbar';
import { useAction } from '@/hooks/useAction';
import { matches } from '@/lib/format';
import { useQuery } from '@/lib/query';
import { engagementApi } from '@/services';
import type { Faq, SupportCategory, SupportData } from '@/types';

/* ───────────── Common questions (FAQ Manager) ───────────── */

export function FaqManager() {
  const faqs = useQuery('faqs', engagementApi.listFaqs);
  const support = useQuery('support', engagementApi.getSupport);
  const { run, isBusy } = useAction();
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Faq | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Faq | null>(null);
  const categories = support.data?.categories ?? [];
  const catTitle = (id: string) => categories.find((c) => c.id === id)?.title ?? 'Other';
  const filtering = cat !== 'all' || !!q;

  return (
    <Card padded={false} className="customers-directory-card">
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1C3E', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF4FF', display: 'grid', placeItems: 'center', color: '#013E86' }}>
              <Icon name="info" size={16} />
            </span>
            Common Questions (FAQ)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748B' }}>
            Frequently asked questions shown in the customer app's Help screen.
          </p>
        </div>
        <Button size="sm" variant="accent" icon="plus" onClick={() => setEditing('new')}>
          Add question
        </Button>
      </div>

      <QueryView query={faqs}>
        {(all) => {
          const rows = all.filter((f) => (cat === 'all' || f.categoryId === cat) && matches(q, f.question, f.answer));
          return (
            <div style={{ padding: '20px 24px' }}>
              <Toolbar end={<SearchInput value={q} onChange={setQ} placeholder="Search questions..." />}>
                <FilterPills
                  label="Topic"
                  value={cat}
                  onChange={setCat}
                  options={[
                    { value: 'all', label: 'All topics', count: all.length },
                    ...categories.map((c) => ({
                      value: c.id,
                      label: c.title,
                      count: all.filter((f) => f.categoryId === c.id).length,
                    })),
                  ]}
                />
              </Toolbar>

              {filtering ? (
                <p className="muted small" style={{ margin: '10px 0 16px 0' }}>
                  Clear topic and search filters to rearrange question order.
                </p>
              ) : null}

              {rows.length ? (
                <ol className="faq-list" style={{ marginTop: 14 }}>
                  {rows.map((f) => {
                    const i = all.indexOf(f);
                    return (
                      <li key={f.id} className="faq-row">
                        <details className="faq-row__body">
                          <summary>
                            <span className="strong">{f.question}</span>
                            <Tag>{catTitle(f.categoryId)}</Tag>
                          </summary>
                          <p className="soft">{f.answer}</p>
                        </details>
                        <span className="faq-row__controls">
                          {!filtering ? (
                            <>
                              <IconButton
                                icon="arrowUp"
                                label={`Move “${f.question}” up`}
                                size={32}
                                disabled={i === 0}
                                onClick={() => run('mv', () => engagementApi.moveFaq(f.id, -1), 'Order updated')}
                              />
                              <IconButton
                                icon="arrowDown"
                                label={`Move “${f.question}” down`}
                                size={32}
                                disabled={i === all.length - 1}
                                onClick={() => run('mv', () => engagementApi.moveFaq(f.id, 1), 'Order updated')}
                              />
                            </>
                          ) : null}
                          <IconButton icon="edit" label={`Edit “${f.question}”`} size={32} onClick={() => setEditing(f)} />
                          <IconButton icon="trash" tone="danger" label={`Delete “${f.question}”`} size={32} onClick={() => setDeleting(f)} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EmptyState
                  compact
                  icon="info"
                  title={all.length ? 'No questions match' : 'No questions yet'}
                  message={all.length ? 'Try another topic or clear the search.' : 'Add the questions customers ask most often.'}
                />
              )}
            </div>
          );
        }}
      </QueryView>

      {editing ? (
        <FaqModal
          faq={editing === 'new' ? null : editing}
          categories={categories}
          defaultCategory={cat === 'all' ? categories[0]?.id : cat}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this question?"
        message={<>&ldquo;{deleting?.question}&rdquo; will disappear from the Help screen.</>}
        confirmLabel="Delete question"
        loading={isBusy('del')}
        onConfirm={async () => {
          if (!deleting) return;
          await run('del', () => engagementApi.deleteFaq(deleting.id), 'Question deleted');
          setDeleting(null);
        }}
      />
    </Card>
  );
}

function FaqModal({
  faq,
  categories,
  defaultCategory,
  onClose,
}: {
  faq: Faq | null;
  categories: SupportCategory[];
  defaultCategory?: string;
  onClose: () => void;
}) {
  const { run, isBusy } = useAction();
  const [v, setV] = useState({
    categoryId: faq?.categoryId ?? defaultCategory ?? '',
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
  });
  const [tried, setTried] = useState(false);
  const problems = {
    question: v.question.trim().length < 8 ? 'Write the question the way a customer would ask it.' : undefined,
    answer: v.answer.trim().length < 10 ? 'Write a helpful answer (at least 10 letters).' : undefined,
    categoryId: !v.categoryId ? 'Choose a topic.' : undefined,
  };
  const errors = tried ? problems : ({} as Partial<typeof problems>);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    const ok = await run('save', () => engagementApi.saveFaq(v, faq?.id), faq ? 'Question saved' : 'Question added');
    if (ok) onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={faq ? 'Edit question' : 'Add a question'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="faq-form" loading={isBusy('save')}>
            {faq ? 'Save question' : 'Add question'}
          </Button>
        </>
      }
    >
      <form id="faq-form" className="form" onSubmit={submit} noValidate>
        <Field label="Topic" error={errors.categoryId}>
          <Select value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Question" error={errors.question}>
          <TextInput value={v.question} maxLength={120} onChange={(e) => setV({ ...v, question: e.target.value })} data-autofocus />
        </Field>
        <Field label="Answer" error={errors.answer} hint={`${v.answer.length}/500`}>
          <TextArea value={v.answer} maxLength={500} onChange={(e) => setV({ ...v, answer: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

/* ───────────── Redesigned Contact Details (Customer Care Channels) ───────────── */

export function ContactCard({ contact }: { contact: SupportData['contact'] }) {
  const { run, isBusy } = useAction();
  const [v, setV] = useState(contact);
  const [tried, setTried] = useState(false);
  const [phoneEnabled, setPhoneEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => setV(contact), [contact]);

  const problems = {
    phone: v.phone.replace(/\D/g, '').length < 10 ? 'Enter a phone number with at least 10 digits.' : undefined,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()) ? 'Enter a valid email address.' : undefined,
    hours: v.hours.trim().length < 3 ? 'e.g. “8 AM – 9 PM, every day”.' : undefined,
  };
  const errors = tried ? problems : ({} as Partial<typeof problems>);
  const dirty = v.phone !== contact.phone || v.email !== contact.email || v.hours !== contact.hours;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (Object.values(problems).some(Boolean)) return;
    await run('contact', () => engagementApi.updateSupportContact(v), 'Contact details saved');
    setTried(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. 3-Box Channel KPI Bar (1:1 with rest of Admin) ── */}
      <div className="customers-stats-bar" role="region" aria-label="Support channels summary">
        {/* Box 1: Navy Theme - Helpline Phone */}
        <div className="customers-stats-bar__item customers-stats-bar__item--dark">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--dark">
              <span className="overview-tag__dot overview-tag__dot--green" />
              Direct Phone Support
            </span>
            <span className="overview-sub-card__icon-squircle overview-sub-card__icon-squircle--dark" aria-hidden>
              <Icon name="phone" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value overview-sub-card__value--white" style={{ fontSize: 18, letterSpacing: -0.2 }}>
              {v.phone || 'No phone set'}
            </span>
            <span className="overview-sub-card__caption overview-sub-card__caption--dark">
              One-tap call link live on customer app
            </span>
          </div>
        </div>

        {/* Box 2: Orange Theme - Official Email */}
        <div className="customers-stats-bar__item customers-stats-bar__item--orange">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--orange">Support Email</span>
            <span className="overview-sub-card__icon-circle" aria-hidden>
              <Icon name="mail" size={16} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value" style={{ fontSize: 16, wordBreak: 'break-all' }}>
              {v.email || 'No email set'}
            </span>
            <span className="overview-sub-card__caption">
              Direct inbox for inquiries and billing
            </span>
          </div>
        </div>

        {/* Box 3: Light Theme - Service Hours */}
        <div className="customers-stats-bar__item customers-stats-bar__item--light">
          <div className="overview-sub-card__top">
            <span className="overview-tag overview-tag--light">
              <span className="overview-tag__dot overview-tag__dot--blue" />
              Operating Hours
            </span>
            <span className="overview-sub-card__icon-squircle" aria-hidden>
              <Icon name="clock" size={17} />
            </span>
          </div>
          <div className="overview-sub-card__bottom">
            <span className="overview-sub-card__value" style={{ fontSize: 17 }}>
              {v.hours || 'Hours unconfigured'}
            </span>
            <span className="overview-sub-card__caption">
              Staff availability shown to users
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Responsive 2-Column Split: Form on Left, Live Mockup on Right ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left: Configuration Form Card */}
        <Card padded={false} className="customers-directory-card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1C3E', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: '#EEF4FF', display: 'grid', placeItems: 'center', color: '#013E86' }}>
                    <Icon name="phone" size={16} />
                  </span>
                  Support Channel Configuration
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748B' }}>
                  Update your contact details shown on the Help screen. Changes sync live with the customer app.
                </p>
              </div>
              {dirty ? (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 650,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#FFF7ED',
                    color: '#EA580C',
                    border: '1px solid #FED7AA',
                  }}
                >
                  Unsaved changes
                </span>
              ) : null}
            </div>
          </div>

          <form onSubmit={submit} noValidate style={{ padding: '22px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Phone Field */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#0A1C3E', marginBottom: 6 }}>
                  Customer Helpline Phone <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    value={v.phone}
                    maxLength={20}
                    onChange={(e) => setV({ ...v, phone: e.target.value })}
                    placeholder="+91 80 4718 2020"
                    style={{
                      width: '100%',
                      height: 42,
                      padding: '0 14px',
                      fontSize: 14,
                      borderRadius: 10,
                      border: errors.phone ? '1.5px solid #DC2626' : '1.5px solid #CBD5E1',
                      outline: 'none',
                      backgroundColor: '#FFFFFF',
                      color: '#0A1C3E',
                      fontWeight: 550,
                    }}
                  />
                </div>
                {errors.phone ? (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#DC2626' }}>{errors.phone}</p>
                ) : (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B' }}>
                    Tap-to-call link for customers seeking immediate assistance.
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#0A1C3E', marginBottom: 6 }}>
                  Support Email Address <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="email"
                  value={v.email}
                  maxLength={60}
                  onChange={(e) => setV({ ...v, email: e.target.value })}
                  placeholder="care@washingbasket.example"
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 14px',
                    fontSize: 14,
                    borderRadius: 10,
                    border: errors.email ? '1.5px solid #DC2626' : '1.5px solid #CBD5E1',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0A1C3E',
                    fontWeight: 550,
                  }}
                />
                {errors.email ? (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#DC2626' }}>{errors.email}</p>
                ) : (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B' }}>
                    Inquiries and billing disputes will be directed here.
                  </p>
                )}
              </div>

              {/* Opening Hours Field */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 650, color: '#0A1C3E', marginBottom: 6 }}>
                  Operating Hours <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={v.hours}
                  maxLength={40}
                  onChange={(e) => setV({ ...v, hours: e.target.value })}
                  placeholder="8 AM – 9 PM, every day"
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 14px',
                    fontSize: 14,
                    borderRadius: 10,
                    border: errors.hours ? '1.5px solid #DC2626' : '1.5px solid #CBD5E1',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                    color: '#0A1C3E',
                    fontWeight: 550,
                  }}
                />
                {errors.hours ? (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#DC2626' }}>{errors.hours}</p>
                ) : (
                  <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748B' }}>
                    Shown on the app so customers know when active response is available.
                  </p>
                )}
              </div>

              {/* Channel Availability Switches */}
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0A1C3E', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Active Support Channels
                </span>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: '#0A1C3E' }}>Direct Phone Calling</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Enable click-to-call button on customer app</div>
                  </div>
                  <MiniSwitch checked={phoneEnabled} onChange={setPhoneEnabled} label="Toggle phone support" />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 650, color: '#0A1C3E' }}>Email Inquiries</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>Allow customers to email support desk directly</div>
                  </div>
                  <MiniSwitch checked={emailEnabled} onChange={setEmailEnabled} label="Toggle email support" />
                </div>
              </div>
            </div>

            {/* Form Actions Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 24,
                paddingTop: 18,
                borderTop: '1px solid #F1F5F9',
              }}
            >
              <button
                type="button"
                className="btn btn--subtle"
                disabled={!dirty}
                onClick={() => {
                  setV(contact);
                  setTried(false);
                }}
              >
                Undo changes
              </button>

              <button
                type="submit"
                className="btn btn--primary"
                disabled={!dirty}
                style={{
                  height: 40,
                  padding: '0 22px',
                  fontSize: 13.5,
                  fontWeight: 650,
                  borderRadius: 10,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: !dirty ? '#94A3B8' : '#013E86',
                  color: '#FFFFFF',
                  cursor: !dirty ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                <Icon name="check" size={15} />
                {isBusy('contact') ? 'Saving...' : 'Save contact details'}
              </button>
            </div>
          </form>
        </Card>

        {/* Right: Customer Mobile App Live Mockup */}
        <Card padded={false} className="customers-directory-card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0A1C3E', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: '#FFF7ED', display: 'grid', placeItems: 'center', color: '#EA580C' }}>
                <Icon name="phoneDevice" size={16} />
              </span>
              Customer Mobile App Live Preview
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748B' }}>
              Real-time rendering of what customers see in the WashingBasket app.
            </p>
          </div>

          <div style={{ padding: '24px' }}>
            {/* Phone Screen Mockup Container */}
            <div
              style={{
                maxWidth: 360,
                margin: '0 auto',
                background: '#FFFFFF',
                borderRadius: 28,
                border: '3px solid #0A1C3E',
                boxShadow: '0 12px 30px -10px rgba(10, 28, 62, 0.15)',
                overflow: 'hidden',
              }}
            >
              {/* Phone Header / Status Bar */}
              <div
                style={{
                  background: '#0A1C3E',
                  color: '#FFFFFF',
                  padding: '12px 18px 16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Help &amp; Support</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>WashingBasket Care</div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} title="Online" />
              </div>

              {/* Phone Content */}
              <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 14, background: '#F8FAFC' }}>
                {/* Greeting banner */}
                <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 13, fontWeight: 750, color: '#0A1C3E', marginBottom: 2 }}>
                    How can we help you?
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4 }}>
                    Our campus and delivery care team is ready to assist you.
                  </div>
                </div>

                {/* Call Support Button */}
                {phoneEnabled ? (
                  <a
                    href={`tel:${v.phone}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#013E86',
                      color: '#FFFFFF',
                      borderRadius: 14,
                      padding: '14px 16px',
                      textDecoration: 'none',
                      boxShadow: '0 4px 12px rgba(1, 62, 134, 0.25)',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="phone" size={18} color="#FFFFFF" />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#BAE6FD', textTransform: 'uppercase', fontWeight: 650 }}>Call Care Desk</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF' }}>{v.phone || '+91 80 4718 2020'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', color: '#BAE6FD' }}>&rarr;</span>
                  </a>
                ) : null}

                {/* Email Support Button */}
                {emailEnabled ? (
                  <a
                    href={`mailto:${v.email}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#FFFFFF',
                      color: '#0A1C3E',
                      borderRadius: 14,
                      padding: '14px 16px',
                      border: '1.5px solid #E2E8F0',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF7ED', display: 'grid', placeItems: 'center', color: '#EA580C' }}>
                      <Icon name="mail" size={18} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 650 }}>Email Support</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0A1C3E', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {v.email || 'care@washingbasket.example'}
                      </div>
                    </div>
                  </a>
                ) : null}

                {/* Operating Hours Box */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <span style={{ color: '#013E86', marginTop: 2 }}>
                    <Icon name="clock" size={16} />
                  </span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Operating Hours</div>
                    <div style={{ fontSize: 12.5, fontWeight: 650, color: '#0A1C3E', marginTop: 1 }}>{v.hours || '8 AM – 9 PM, every day'}</div>
                    <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginTop: 3 }}>Campus Desks &amp; Pickup Active</div>
                  </div>
                </div>

                {/* Campus Desks Footer */}
                <div style={{ textAlign: 'center', padding: '4px 0 2px 0' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                    Serving LPU Campus &bull; NIT Jalandhar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
