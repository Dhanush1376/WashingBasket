import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  interpolate,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { TopBar } from '../../components/app/TopBar';
import { Icon, isIconName, type IconName } from '../../components/app/Icon';
import { EASE_OUT, Rise } from '../../components/app/motion';
import { Button } from '../../components/app/primitives';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FORM, formStyles, PillField, PillTextArea } from '../../components/ui/SheetForm';
import { haptic } from '../../lib/haptics';
import type { StaffTabProps } from '../../navigation/types';
import { brand, colors, fonts, space, text } from '../../theme';
import { useStaff } from './kit';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

const BG = '#FAF9F6';
const BG_RGB = '250, 249, 246';
const BEIGE = '#F1EDE4';
const CHIP = '#F4F2EE';
const CHARCOAL = '#0A1C3E';
const RADIUS = 26;
const PAGE = space.lg;

const SMOOTH = { duration: 340, easing: EASE_OUT };
const LAYOUT = LinearTransition.duration(320).easing(EASE_OUT);

export type StaffTopic = {
  id: string;
  title: string;
  icon: IconName;
  hint: string;
};

const STAFF_TOPICS: StaffTopic[] = [
  { id: 'leave', title: 'Leave application', icon: 'calendar', hint: 'Casual, sick, or earned leave request' },
  { id: 'advance', title: 'Salary advance', icon: 'wallet', hint: 'Emergency advance or payout adjustment' },
  { id: 'shift', title: 'Shift swap / timing', icon: 'clock', hint: 'Trade shifts or request schedule change' },
  { id: 'equipment', title: 'Equipment breakdown', icon: 'alert', hint: 'Washer, dryer, boiler or iron failure' },
  { id: 'payroll', title: 'Attendance / pay query', icon: 'edit', hint: 'Missing punch, overtime, or slip correction' },
  { id: 'other', title: 'General HR support', icon: 'info', hint: 'Uniform, policies, safety or documentation' },
];

export type StaffFaq = {
  id: string;
  topicId: string;
  question: string;
  answer: string;
};

const STAFF_FAQS: StaffFaq[] = [
  {
    id: 'faq-leave-1',
    topicId: 'leave',
    question: 'How do I apply for casual, sick, or earned leave?',
    answer:
      'Tap "Raise a request" below and select "Leave application". Choose your leave category (Casual, Sick, or Earned) and enter your dates and reason. Your branch supervisor will review and approve within 24 hours. Once approved, it updates automatically in your monthly attendance record.',
  },
  {
    id: 'faq-leave-2',
    topicId: 'leave',
    question: 'What should I do if I am suddenly unwell on my shift day?',
    answer:
      'Call your shift supervisor at least 2 hours before your shift begins, then submit an emergency sick leave request here. For sick leaves exceeding 2 consecutive days, please present a medical fitness note upon your return.',
  },
  {
    id: 'faq-leave-3',
    topicId: 'leave',
    question: 'How many days of leave do I have each year?',
    answer:
      'Full-time branch staff receive 12 Casual Leaves, 12 Sick Leaves, and 15 Earned Leaves annually, credited on January 1st. Unused earned leaves carry forward or can be encashed as per the company workforce policy.',
  },
  {
    id: 'faq-salary-1',
    topicId: 'salary',
    question: 'When is my salary credited each month?',
    answer:
      'Salaries are disbursed directly into your registered bank account on the 1st of every calendar month. If the 1st falls on a bank holiday or Sunday, the deposit is credited on the next working banking day.',
  },
  {
    id: 'faq-salary-2',
    topicId: 'salary',
    question: 'Can I request a salary advance for emergencies?',
    answer:
      'Yes! Staff with at least 3 months of completed service can request an advance of up to 50% of their net monthly salary. Choose "Salary advance" in Raise a Request below, specify the requested amount, and HR will process it within 2 working days.',
  },
  {
    id: 'faq-salary-3',
    topicId: 'salary',
    question: 'How is overtime calculated and paid?',
    answer:
      'Approved hours worked beyond your standard 8-hour shift or on a scheduled rest day are compensated at 1.5x your standard hourly rate. Overtime is tracked via shift check-out timestamps and credited on your monthly payslip.',
  },
  {
    id: 'faq-shift-1',
    topicId: 'shift',
    question: 'Can I swap a shift with a colleague?',
    answer:
      'Yes, shift swaps are allowed provided both team members agree and the request is submitted at least 24 hours in advance under "Shift swap / timing". Your branch manager will approve it as long as floor coverage remains balanced.',
  },
  {
    id: 'faq-shift-2',
    topicId: 'shift',
    question: 'What if the app fails to record my shift check-in?',
    answer:
      'If GPS or network issues prevent check-in, alert your shift supervisor immediately. They can log a supervisor attendance override on the admin portal so your hours and on-time record are preserved.',
  },
  {
    id: 'faq-equipment-1',
    topicId: 'equipment',
    question: 'What do I do if a washer, dryer, or iron breaks down?',
    answer:
      'Immediately place an "Out of Order" sign on the machine, notify your shift lead, and raise an "Equipment breakdown" request with the machine unit number. Floor technicians are dispatched within 2 hours for critical laundry equipment.',
  },
  {
    id: 'faq-equipment-2',
    topicId: 'equipment',
    question: 'How do I handle garments that are torn or stained before washing?',
    answer:
      'Always inspect clothes during intake. If an item is already damaged or has loose buttons, flag it on the scanner app before washing. Photograph the item in the app to notify the customer and ensure the digital audit trail protects you.',
  },
  {
    id: 'faq-uniform-1',
    topicId: 'other',
    question: 'How do I get a new uniform, apron, or name badge?',
    answer:
      'Staff are entitled to 2 free company t-shirts/aprons and a fresh photo badge every 6 months. Submit a request under "General HR support" with your required size.',
  },
];

const LEAVE_TYPES = ['Casual leave', 'Sick leave', 'Earned leave'] as const;

export function StaffSupportScreen({ navigation }: StaffTabProps<'StaffSupport'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const { me, unread } = useStaff();

  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // request form bottom sheet
  const [formOpen, setFormOpen] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>('Casual leave');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  const errors = {
    topic: !topicId ? 'Choose what your request is about.' : null,
    subject: subject.trim().length < 4 ? 'Add a short subject (4 characters or more).' : null,
    message: message.trim().length < 8 ? 'Tell us a little more (8 characters or more).' : null,
  };
  const valid = !errors.topic && !errors.subject && !errors.message;

  const openFormWithPreset = (preset?: string | null) => {
    setTouched(false);
    if (preset) {
      setTopicId(preset);
      if (preset === 'leave' && !subject) {
        setSubject('Casual leave request');
      }
    }
    setFormOpen(true);
  };

  const handleTopicSelect = (id: string) => {
    setTopicId(id);
    if (id === 'leave') {
      if (!subject || subject.includes('leave')) {
        setSubject(`${leaveType} request`);
      }
    } else if (id === 'advance') {
      if (!subject) setSubject('Salary advance request');
    } else if (id === 'shift') {
      if (!subject) setSubject('Shift timing / swap request');
    } else if (id === 'equipment') {
      if (!subject) setSubject('Machine issue report');
    }
  };

  const handleLeaveTypeSelect = (type: (typeof LEAVE_TYPES)[number]) => {
    setLeaveType(type);
    setSubject(`${type} request`);
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || sending || !topicId) return;
    setSending(true);

    // simulate saving to ticket service
    await new Promise((r) => setTimeout(r, 450));
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newId = `STF-${randomNum}`;

    haptic.success();
    setSending(false);
    setFormOpen(false);
    setSentId(newId);
    setSubject('');
    setMessage('');
    setTopicId(null);
    setTouched(false);
  };

  const q = query.trim().toLowerCase();
  const shownFaqs = useMemo(
    () =>
      STAFF_FAQS.filter(
        (f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
      ),
    [q],
  );

  const callSupervisor = () => Linking.openURL('tel:+919814011000');
  const emailHR = () => Linking.openURL('mailto:hr@washingbasket.in?subject=Staff%20Inquiry');

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={[
          styles.page,
          { paddingTop: bar.height + space.xs, paddingBottom: Math.max(insets.bottom, 12) + 68 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Heading + Search ── */}
        <Rise distance={10} style={styles.intro}>
          <Text style={styles.heading}>Staff Support &{'\n'}Workplace Help</Text>
          <SearchBar value={query} onChange={setQuery} />
        </Rise>

        {sentId ? (
          <Animated.View
            entering={FadeInDown.duration(380).easing(EASE_OUT)}
            exiting={FadeOutUp.duration(240)}
            layout={LAYOUT}
            style={styles.sent}
          >
            <View style={styles.sentTick}>
              <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.sentText}>
              Request <Text style={styles.sentStrong}>{sentId}</Text> submitted. Logged with HR and your branch supervisor.
            </Text>
            <Pressable
              onPress={() => setSentId(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss confirmation"
              style={webCursor}
            >
              <Icon name="x" size={16} color={colors.inkSoft} />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ── Staff FAQs Accordion ── */}
        <Rise delay={140} distance={12}>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{q ? 'Search results' : 'Popular questions'}</Text>
            <Animated.Text key={shownFaqs.length} entering={FadeIn.duration(220)} style={styles.count}>
              {shownFaqs.length}
            </Animated.Text>
          </View>

          <Animated.View layout={LAYOUT} style={styles.listCard}>
            {shownFaqs.length ? (
              shownFaqs.map((f, i) => (
                <Animated.View
                  key={`${q}-${f.id}`}
                  entering={FadeInDown.delay(i * 35).duration(300).easing(EASE_OUT)}
                  exiting={FadeOut.duration(150)}
                  layout={LAYOUT}
                >
                  <FaqItem
                    faq={f}
                    first={i === 0}
                    open={openFaq === f.id}
                    onToggle={() => setOpenFaq(openFaq === f.id ? null : f.id)}
                  />
                </Animated.View>
              ))
            ) : (
              <Animated.View entering={FadeIn.duration(260)} style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Icon name="search" size={20} color={colors.inkSoft} />
                </View>
                <Text style={styles.emptyTitle}>No matching answers</Text>
                <Text style={styles.emptyText}>
                  Try other keywords, or submit a request directly to HR and your supervisor.
                </Text>
                <PressScale onPress={() => openFormWithPreset()} style={styles.darkPill} label="Raise a request">
                  <Text style={styles.darkPillText}>Raise a request</Text>
                  <Icon name="arrowRight" size={13} color="#FFFFFF" strokeWidth={2.2} />
                </PressScale>
              </Animated.View>
            )}
          </Animated.View>
        </Rise>

        {/* ── Direct Support / Still Need Help Hub ── */}
        <Rise delay={260} distance={12}>
          <View style={styles.contact}>
            <View style={styles.contactHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactTitle}>Still need help?</Text>
                <View style={styles.hoursRow}>
                  <LiveDot />
                  <Text style={styles.hoursText}>
                    Supervisor & HR support active during shift hours
                  </Text>
                </View>
              </View>
              <View style={styles.contactBadge}>
                <Icon name="headset" size={22} color={brand.orange} strokeWidth={2.2} />
              </View>
            </View>

            <View style={styles.contactRow}>
              <PressScale grow onPress={callSupervisor} style={styles.contactBtn} label="Call supervisor">
                <Icon name="phone" size={15} color={brand.navy} strokeWidth={2.2} />
                <Text style={styles.contactBtnText}>Call supervisor</Text>
              </PressScale>
              <PressScale grow onPress={emailHR} style={styles.contactBtn} label="Email HR">
                <Icon name="mail" size={15} color={brand.navy} strokeWidth={2.2} />
                <Text style={styles.contactBtnText}>Email HR</Text>
              </PressScale>
            </View>

            <PressScale onPress={() => openFormWithPreset()} style={styles.raise} label="Raise a request">
              <Icon name="edit" size={16} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.raiseText}>Raise a request</Text>
              <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2.2} />
            </PressScale>
          </View>
        </Rise>
      </Animated.ScrollView>

      {/* ── Top Bar (Exact same as other staff pages: Logo + Title + Bell + Drawer) ── */}
      <CollapsingBar bar={bar} tint={BG_RGB} style={{ paddingTop: Math.max(insets.top, 6) }}>
        <View style={styles.barInner}>
          <TopBar
            padded={false}
            title="Help & support"
            unread={unread}
            onBell={() => navigation.navigate('StaffNotifications')}
            onHome={() => navigation.navigate('StaffHome')}
          />
        </View>
      </CollapsingBar>

      {/* ── Raise a Request Drawer Form ── */}
      <BottomSheet visible={formOpen} onClose={() => setFormOpen(false)}>
        <View style={styles.drawerForm}>
          <Rise delay={30}>
            <Text style={text.h1}>Raise a request</Text>
            <Text style={[text.body, { marginTop: 2 }]}>
              Ask leaves, salary advances, shift swaps, or equipment repairs.
            </Text>
          </Rise>

          {/* Topic Selector */}
          <Rise delay={80}>
            <Text style={styles.drawerSectionLabel}>Choose topic</Text>
            <TopicSelector
              categories={STAFF_TOPICS}
              selectedId={topicId}
              onSelect={handleTopicSelect}
              invalid={touched && !!errors.topic}
            />
            {touched && errors.topic ? (
              <Text style={styles.drawerErrorText}>{errors.topic}</Text>
            ) : null}
          </Rise>

          {/* Quick Leave Type Chips if Leave is selected */}
          {topicId === 'leave' ? (
            <Rise delay={110} style={styles.leaveTypeWrap}>
              <Text style={styles.drawerSectionLabel}>Leave category</Text>
              <View style={styles.leaveChipsRow}>
                {LEAVE_TYPES.map((lt) => {
                  const sel = leaveType === lt;
                  return (
                    <Pressable
                      key={lt}
                      onPress={() => handleLeaveTypeSelect(lt)}
                      style={[styles.leaveChip, sel && styles.leaveChipActive, webCursor]}
                    >
                      <View style={[styles.leaveChipDot, sel && styles.leaveChipDotActive]} />
                      <Text style={[styles.leaveChipText, sel && styles.leaveChipTextActive]}>
                        {lt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Rise>
          ) : null}

          {/* Subject Field */}
          <Rise delay={150} style={styles.fieldGap}>
            <PillField
              icon="edit"
              value={subject}
              onChangeText={setSubject}
              placeholder={
                topicId === 'leave'
                  ? 'e.g. 2 days casual leave (15 Nov - 16 Nov)'
                  : topicId === 'advance'
                    ? 'e.g. Advance request ₹5,000'
                    : 'Subject of your request'
              }
              invalid={touched && !!errors.subject}
              maxLength={80}
            />
          </Rise>

          {/* Message Area */}
          <Rise delay={210} style={styles.fieldGap}>
            <PillTextArea
              value={message}
              onChangeText={setMessage}
              placeholder={
                topicId === 'leave'
                  ? 'Details of your leave request, dates, and reason...'
                  : topicId === 'advance'
                    ? 'Reason for advance and suggested repayment month...'
                    : topicId === 'shift'
                      ? 'Specify your current shift date, colleague name, and proposed swap...'
                      : 'Describe the details of your request or issue...'
              }
              invalid={touched && !!errors.message}
              maxLength={600}
            />
            <Text style={[styles.helper, touched && !valid && { color: colors.danger }]}>
              {touched && (errors.topic || errors.subject || errors.message)
                ? (errors.topic ?? errors.subject ?? errors.message)
                : 'Branch supervisors and HR review requests daily.'}
            </Text>
          </Rise>

          {/* Submit Button */}
          <Rise delay={270} style={{ marginTop: space.sm }}>
            <Button
              label="Submit request"
              variant="dark"
              icon="check"
              loading={sending}
              onPress={submit}
            />
          </Rise>
        </View>
      </BottomSheet>
    </View>
  );
}

/* ───────────── Shared Pieces ───────────── */

function PressScale({
  onPress,
  style,
  label,
  grow,
  children,
}: {
  onPress: () => void;
  style: object | object[];
  label: string;
  grow?: boolean;
  children: React.ReactNode;
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => s.set(withSpring(0.96, { damping: 18, stiffness: 340 }))}
      onPressOut={() => s.set(withSpring(1, { damping: 14, stiffness: 260 }))}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[grow ? { flex: 1 } : null, webCursor]}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.searchWrap}>
      <PillField
        icon="search"
        value={value}
        onChangeText={onChange}
        placeholder="Search staff help, leaves, salary..."
        accessibilityLabel="Search help articles"
        returnKeyType="search"
        trailing={
          value ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.searchTrail}>
              <View style={formStyles.divider} />
              <Pressable
                onPress={() => onChange('')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={[styles.searchClear, webCursor]}
              >
                <Icon name="x" size={12} color="#FFFFFF" strokeWidth={2.6} />
              </Pressable>
            </Animated.View>
          ) : undefined
        }
      />
    </View>
  );
}

function TopicSelector({
  categories,
  selectedId,
  onSelect,
  invalid,
}: {
  categories: StaffTopic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedCat = categories.find((c) => c.id === selectedId);

  return (
    <View style={styles.selectorWrap}>
      <Pressable
        onPress={() => {
          haptic.tap();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel="Choose topic"
        style={webCursor}
      >
        <View
          style={[
            styles.selectorHead,
            open && styles.selectorHeadOpen,
            invalid && formStyles.fieldError,
          ]}
        >
          {selectedCat ? (
            <View style={[styles.selectorBadge, { backgroundColor: brand.orange }]}>
              <Icon name={selectedCat.icon} size={13} color="#FFFFFF" strokeWidth={2.4} />
            </View>
          ) : (
            <View style={styles.selectorBadgeMuted}>
              <Icon name="tag" size={13} color={colors.inkSoft} strokeWidth={2} />
            </View>
          )}

          <View style={formStyles.divider} />

          <Text
            style={[
              styles.selectorText,
              !selectedCat && styles.selectorPlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedCat ? selectedCat.title : 'Select a topic (e.g. Leave, Advance)'}
          </Text>

          <View style={formStyles.divider} />

          <Chevron open={open} />
        </View>
      </Pressable>

      <Collapse open={open}>
        <View style={styles.selectorMenu}>
          {categories.map((c, i) => {
            const isSel = c.id === selectedId;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  haptic.tap();
                  onSelect(c.id);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={c.title}
                style={[
                  styles.selectorMenuItem,
                  i > 0 && styles.selectorMenuDivider,
                  isSel && styles.selectorMenuItemActive,
                  webCursor,
                ]}
              >
                <View style={[styles.menuItemIconDisc, isSel && styles.menuItemIconDiscActive]}>
                  <Icon
                    name={c.icon}
                    size={13}
                    color={isSel ? '#FFFFFF' : brand.navy}
                    strokeWidth={2.2}
                  />
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.menuItemLabel, isSel && styles.menuItemLabelActive]} numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text style={styles.menuItemHint} numberOfLines={1}>
                    {c.hint}
                  </Text>
                </View>

                {isSel ? (
                  <View style={styles.menuCheckDisc}>
                    <Icon name="check" size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Collapse>
    </View>
  );
}

function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0);
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    p.set(reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 360, easing: EASE_OUT }));
  }, [open, p, reduced]);
  const box = useAnimatedStyle(() => ({ height: h.value * p.value }));
  const inner = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5, 1], [0, 0.4, 1]),
    transform: [{ translateY: (1 - p.value) * -6 }],
  }));
  return (
    <Animated.View style={[styles.collapse, box]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.collapseInner, inner]} onLayout={(e) => h.set(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const r = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    r.set(withSpring(open ? 1 : 0, { damping: 16, stiffness: 180 }));
  }, [open, r]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${r.value * 180}deg` }],
    backgroundColor: interpolateColor(Math.min(1, Math.max(0, r.value)), [0, 1], [BEIGE, CHARCOAL]),
  }));
  return (
    <Animated.View style={[styles.chevron, anim]}>
      <Icon name="chevronDown" size={16} color={open ? '#FFFFFF' : colors.ink} strokeWidth={2.2} />
    </Animated.View>
  );
}

function FaqItem({
  faq,
  first,
  open,
  onToggle,
}: {
  faq: StaffFaq;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.set(withTiming(open ? 1 : 0, SMOOTH));
  }, [open, t]);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['rgba(250,249,246,0)', '#FAF9F6']),
  }));
  return (
    <Animated.View style={[styles.faq, !first && styles.rule, bg]}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.faqHead, webCursor]}
      >
        <Text style={styles.faqQ}>{faq.question}</Text>
        <Chevron open={open} />
      </Pressable>
      <Collapse open={open}>
        <Text style={styles.faqA}>{faq.answer}</Text>
      </Collapse>
    </Animated.View>
  );
}

function LiveDot() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduced) p.set(withRepeat(withTiming(1, { duration: 1700, easing: EASE_OUT }), -1, false));
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const halo = useAnimatedStyle(() => ({
    opacity: (1 - p.value) * 0.6,
    transform: [{ scale: 1 + p.value * 1.6 }],
  }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveHalo, halo]} />
      <View style={styles.liveDot} />
    </View>
  );
}

/* ───────────── Styles ───────────── */

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 2px 10px rgba(10, 28, 62, 0.05)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 };

const hairline = { borderWidth: 1, borderColor: '#E5E1D8' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  page: { paddingHorizontal: PAGE, gap: space.md },
  barInner: { paddingHorizontal: PAGE },

  intro: { gap: space.md, marginTop: space.sm },
  heading: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.8, color: colors.ink },

  searchWrap: { marginTop: 2 },
  searchTrail: { flexDirection: 'row', alignItems: 'center' },
  searchClear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  sent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: space.md,
    borderRadius: RADIUS - 6,
    backgroundColor: '#EAF8EE',
    borderWidth: 1,
    borderColor: '#BFE7C8',
  },
  sentTick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0D7A21',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: '#0D7A21' },
  sentStrong: { fontFamily: fonts.bold },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm, marginBottom: space.xs },
  section: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  count: { fontFamily: fonts.bold, fontSize: 12, color: brand.orange, backgroundColor: '#FFF2DF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  listCard: { borderRadius: RADIUS, backgroundColor: '#FFFFFF', overflow: 'hidden', ...soft, ...hairline },
  rule: { borderTopWidth: 1, borderColor: '#E5E1D8' },

  faq: { paddingHorizontal: space.md, paddingVertical: space.md },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  faqQ: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, letterSpacing: -0.2, color: colors.ink },
  faqA: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: space.sm },

  collapse: { overflow: 'hidden' },
  collapseInner: { position: 'absolute', top: 0, left: 0, right: 0 },
  chevron: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  empty: { alignItems: 'center', padding: space.xl, gap: space.xs },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft, textAlign: 'center', maxWidth: 260 },
  darkPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: brand.navy, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 18, marginTop: space.sm },
  darkPillText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#FFFFFF' },

  contact: { borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, gap: space.md, ...soft, ...hairline },
  contactHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  contactTitle: { fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.ink },
  contactBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF2DF', alignItems: 'center', justifyContent: 'center' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  hoursText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft },
  live: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#22A04B' },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#12AD2B' },

  contactRow: { flexDirection: 'row', gap: space.sm },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E5E1D8',
  },
  contactBtnText: { fontFamily: fonts.bold, fontSize: 13, color: brand.navy },

  raise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: brand.navy,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 8px rgba(10, 28, 62, 0.22)' } as object) : null),
  },
  raiseText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' },

  drawerForm: { gap: space.md, paddingBottom: space.md },
  drawerSectionLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.3, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 6 },
  drawerErrorText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 4, marginLeft: 12 },
  fieldGap: { gap: 4 },
  helper: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft, marginLeft: 12, marginTop: 2 },

  selectorWrap: { position: 'relative' },
  selectorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    paddingHorizontal: 12,
  },
  selectorHeadOpen: { borderColor: brand.navy },
  selectorBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  selectorBadgeMuted: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EAE6DB', alignItems: 'center', justifyContent: 'center' },
  selectorText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink, paddingHorizontal: 10 },
  selectorPlaceholder: { color: colors.inkSoft, fontFamily: fonts.medium },

  selectorMenu: {
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    overflow: 'hidden',
    ...soft,
  },
  selectorMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  selectorMenuDivider: { borderTopWidth: 1, borderColor: '#F0ECE4' },
  selectorMenuItemActive: { backgroundColor: '#F8F6F2' },
  menuItemIconDisc: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4F2EE', alignItems: 'center', justifyContent: 'center' },
  menuItemIconDiscActive: { backgroundColor: brand.navy },
  menuItemLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  menuItemLabelActive: { color: brand.navy },
  menuItemHint: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  menuCheckDisc: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0D7A21', alignItems: 'center', justifyContent: 'center' },

  leaveTypeWrap: { gap: 6 },
  leaveChipsRow: { flexDirection: 'row', gap: 8 },
  leaveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E5E1D8',
  },
  leaveChipActive: { backgroundColor: '#FFF2DF', borderColor: brand.orange },
  leaveChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.inkMuted },
  leaveChipDotActive: { backgroundColor: brand.orange },
  leaveChipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  leaveChipTextActive: { fontFamily: fonts.bold, color: brand.navy },
});

