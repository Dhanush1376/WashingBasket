import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  withRepeat,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FloatingBottomBar } from '../../components/navigation/FloatingBottomBar';
import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { TopBar } from '../../components/app/TopBar';
import { Icon, isIconName, type IconName } from '../../components/app/Icon';
import { EASE_OUT, Rise } from '../../components/app/motion';
import { Button } from '../../components/app/primitives';
import { ErrorState, Skeleton } from '../../components/app/states';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { formStyles, FORM, PillField, PillTextArea } from '../../components/ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { invalidate, keys, useQuery } from '../../lib/query';
import type { ScreenProps } from '../../navigation/types';
import { createTicket, getSupport, listFaqs } from '../../services/mock/engagement.service';
import { app, brand, colors, fonts, space, text } from '../../theme';
import type { Faq } from '../../types/models';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* The profile page's shades: the logo's navy and the illustrations' yellow, on warm white and beige. */
const BG = '#FAF9F6';
const BEIGE = '#F1EDE4';
const CHIP = '#F4F2EE';
const CHARCOAL = '#0A1C3E';
const RADIUS = 26;
const PAGE = space.lg;

const SMOOTH = { duration: 340, easing: EASE_OUT };
const LAYOUT = LinearTransition.duration(320).easing(EASE_OUT);


export function SupportScreen({ navigation }: ScreenProps<'Support'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar(); // the top bar slides away as you read down and comes back as you scroll up
  const support = useQuery(keys.support, getSupport);
  const faqs = useQuery(keys.faqs, listFaqs);

  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // request form, in a bottom sheet like the profile page's edit drawer
  const [formOpen, setFormOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  const errors = {
    category: !categoryId ? 'Choose what this is about.' : null,
    subject: subject.trim().length < 4 ? 'Add a short subject.' : null,
    message: message.trim().length < 10 ? 'Tell us a little more (10 characters or more).' : null,
  };
  const valid = !errors.category && !errors.subject && !errors.message;

  const openForm = (preset?: string | null) => {
    setTouched(false);
    if (preset) setCategoryId(preset);
    setFormOpen(true);
  };

  const submit = async () => {
    setTouched(true);
    if (!valid || sending || !categoryId) return;
    setSending(true);
    const ticket = await createTicket({ categoryId, subject, message });
    invalidate(keys.support);
    haptic.success();
    setSending(false);
    setFormOpen(false);
    setSentId(ticket.id);
    setSubject('');
    setMessage('');
    setCategoryId(null);
    setTouched(false);
  };


  const data = support.data;
  const call = () => data && Linking.openURL(`tel:${data.contact.phone.replace(/\s/g, '')}`);
  const email = () => data && Linking.openURL(`mailto:${data.contact.email}`);

  const q = query.trim().toLowerCase();
  const shownFaqs = useMemo(
    () =>
      (faqs.data ?? []).filter(
        (f) => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q),
      ),
    [faqs.data, q],
  );
  const catOf = (id: string) => data?.categories.find((c) => c.id === id);

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={[styles.page, { paddingTop: bar.height + space.xs, paddingBottom: insets.bottom + 96 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── heading + search ── */}
        <Rise distance={10} style={styles.intro}>
          <Text style={styles.heading}>How can we help{'\n'}you today?</Text>
          <SearchBar value={query} onChange={setQuery} />
        </Rise>

        {sentId ? (
          <Animated.View entering={FadeInDown.duration(380).easing(EASE_OUT)} exiting={FadeOutUp.duration(240)} layout={LAYOUT} style={styles.sent}>
            <View style={styles.sentTick}>
              <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={styles.sentText}>
              Request <Text style={styles.sentStrong}>{sentId}</Text> created. In this preview it stays on your device and isn’t sent to a support team.
            </Text>
            <Pressable onPress={() => setSentId(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss" style={webCursor}>
              <Icon name="x" size={16} color={colors.inkSoft} />
            </Pressable>
          </Animated.View>
        ) : null}

        {support.loading ? (
          <View style={{ gap: space.md }}>
            <Skeleton height={150} radius={RADIUS} />
            <Skeleton height={200} radius={RADIUS} />
          </View>
        ) : support.error || !data ? (
          <ErrorState onRetry={support.refetch} />
        ) : (
          <>
            {/* ── answers ── */}
            <Rise delay={140} distance={12}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>{q ? 'Search results' : 'Popular questions'}</Text>
                <Animated.Text key={shownFaqs.length} entering={FadeIn.duration(220)} style={styles.count}>
                  {shownFaqs.length}
                </Animated.Text>
              </View>
              <Animated.View layout={LAYOUT} style={styles.listCard}>
                {faqs.loading ? (
                  <Skeleton height={160} radius={16} style={{ margin: space.sm }} />
                ) : shownFaqs.length ? (
                  shownFaqs.map((f, i) => (
                    <Animated.View
                      key={`${q}-${f.id}`}
                      entering={FadeInDown.delay(i * 45).duration(320).easing(EASE_OUT)}
                      exiting={FadeOut.duration(150)}
                      layout={LAYOUT}
                    >
                      <FaqItem faq={f} first={i === 0} open={openFaq === f.id} onToggle={() => setOpenFaq(openFaq === f.id ? null : f.id)} />
                    </Animated.View>
                  ))
                ) : (
                  <Animated.View entering={FadeIn.duration(260)} style={styles.empty}>
                    <View style={styles.emptyIcon}>
                      <Icon name="search" size={20} color={colors.inkSoft} />
                    </View>
                    <Text style={styles.emptyTitle}>No answers found</Text>
                    <Text style={styles.emptyText}>Try other words, or ask our team directly.</Text>
                    <PressScale onPress={() => openForm()} style={styles.darkPill} label="Ask our team">
                      <Text style={styles.darkPillText}>Ask our team</Text>
                      <Icon name="arrowRight" size={13} color="#FFFFFF" strokeWidth={2.2} />
                    </PressScale>
                  </Animated.View>
                )}
              </Animated.View>
            </Rise>

            {/* ── still need help ── */}
            <Rise delay={320} distance={12}>
              <View style={styles.contact}>
                <View style={styles.contactHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactTitle}>Still need help?</Text>
                    <View style={styles.hoursRow}>
                      <LiveDot />
                      <Text style={styles.hoursText}>Our team is available {data.contact.hours.toLowerCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.contactBadge}>
                    <Icon name="headset" size={22} color={brand.orange} strokeWidth={2.2} />
                  </View>
                </View>

                <View style={styles.contactRow}>
                  <PressScale grow onPress={call} style={styles.contactBtn} label={`Call ${data.contact.phone}`}>
                    <Icon name="phone" size={15} color={brand.navy} strokeWidth={2.2} />
                    <Text style={styles.contactBtnText}>Call us</Text>
                  </PressScale>
                  <PressScale grow onPress={email} style={styles.contactBtn} label={`Email ${data.contact.email}`}>
                    <Icon name="mail" size={15} color={brand.navy} strokeWidth={2.2} />
                    <Text style={styles.contactBtnText}>Email us</Text>
                  </PressScale>
                </View>

                <PressScale onPress={() => openForm()} style={styles.raise} label="Raise a request">
                  <Icon name="edit" size={16} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.raiseText}>Raise a request</Text>
                  <Icon name="arrowRight" size={16} color="#FFFFFF" strokeWidth={2.2} />
                </PressScale>
              </View>
            </Rise>
          </>
        )}
      </Animated.ScrollView>

      {/* ── header: over the page, frosted once the page moves under it ── */}
      <CollapsingBar bar={bar} style={{ paddingTop: Math.max(insets.top, 6) }}>
        <View style={styles.barInner}>
          <TopBar padded={false} title="Help & support" />
        </View>
      </CollapsingBar>

      <FloatingBottomBar />

      <BottomSheet visible={formOpen} onClose={() => setFormOpen(false)}>
        {data ? (
          <View style={styles.drawerForm}>
            <Rise delay={30}>
              <Text style={text.h1}>Raise a request</Text>
              <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>
                Include an order number if it’s about an order.
              </Text>
            </Rise>

            {/* Category topic selector */}
            <Rise delay={80}>
              <Text style={styles.drawerSectionLabel}>Choose topic</Text>
              <TopicSelector
                categories={data.categories}
                selectedId={categoryId}
                onSelect={(id) => setCategoryId(id)}
                invalid={touched && !!errors.category}
              />
              {touched && errors.category ? (
                <Text style={styles.drawerErrorText}>{errors.category}</Text>
              ) : null}
            </Rise>

            {/* Subject PillField */}
            <Rise delay={150} style={styles.fieldGap}>
              <PillField
                icon="edit"
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject (e.g. Order issue, refund)"
                invalid={touched && !!errors.subject}
                maxLength={80}
              />
            </Rise>

            {/* Message PillTextArea */}
            <Rise delay={210} style={styles.fieldGap}>
              <PillTextArea
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what happened in detail..."
                invalid={touched && !!errors.message}
                maxLength={600}
              />
              <Text style={[styles.helper, touched && !valid && { color: colors.danger }]}>
                {touched && (errors.category || errors.subject || errors.message)
                  ? (errors.category ?? errors.subject ?? errors.message)
                  : 'Our support team reviews requests every day from 8 AM to 9 PM.'}
              </Text>
            </Rise>

            {/* Action button */}
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
        ) : null}
      </BottomSheet>
    </View>
  );
}

/* ───────────── pieces ───────────── */

const iconOf = (name: string | undefined, fallback: IconName): IconName => (name && isIconName(name) ? name : fallback);

/** Springs down a touch under the finger and back on release. */
function PressScale({ onPress, style, label, grow, children }: { onPress: () => void; style: object | object[]; label: string; grow?: boolean; children: React.ReactNode }) {
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

/**
 * The search field is the drawers' own PillField (Top up, Edit details), so it has the exact same pill, fill, edge,
 * divider and focus ring. The search icon sits at the end; once there's text, a clear button fades in in its place.
 */
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.searchWrap}>
      <PillField
        icon="search"
        value={value}
        onChangeText={onChange}
        placeholder="Search for help, e.g. refund"
        accessibilityLabel="Search help articles"
        returnKeyType="search"
        trailing={
          value ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.searchTrail}>
              <View style={formStyles.divider} />
              <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={[styles.searchClear, webCursor]}>
                <Icon name="x" size={12} color="#FFFFFF" strokeWidth={2.6} />
              </Pressable>
            </Animated.View>
          ) : undefined
        }
      />
    </View>
  );
}

/** A sleek topic selector pill that expands a menu of choices when tapped. */
function TopicSelector({
  categories,
  selectedId,
  onSelect,
  invalid,
}: {
  categories: { id: string; title: string; icon?: string }[];
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
              <Icon name={iconOf(selectedCat.icon, 'info')} size={13} color="#FFFFFF" strokeWidth={2.4} />
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
            {selectedCat ? selectedCat.title : 'Select a topic (e.g. Orders, Refunds)'}
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
                    name={iconOf(c.icon, 'info')}
                    size={13}
                    color={isSel ? '#FFFFFF' : brand.navy}
                    strokeWidth={2.2}
                  />
                </View>

                <Text style={[styles.menuItemLabel, isSel && styles.menuItemLabelActive]} numberOfLines={1}>
                  {c.title}
                </Text>

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

/** Animates its children's height open and shut: measures them off to the side, then eases between 0 and that. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0);
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    p.set(reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: 360, easing: EASE_OUT }));
  }, [open, p, reduced]);
  const box = useAnimatedStyle(() => ({ height: h.value * p.value }));
  const inner = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.5, 1], [0, 0.4, 1]), transform: [{ translateY: (1 - p.value) * -6 }] }));
  return (
    <Animated.View style={[styles.collapse, box]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.collapseInner, inner]} onLayout={(e) => h.set(e.nativeEvent.layout.height)}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/** A chevron that turns over as its section opens. */
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

/** One question: the answer slides open beneath it and the row warms to beige while open. */
function FaqItem({ faq, first, open, onToggle }: { faq: Faq; first: boolean; open: boolean; onToggle: () => void }) {
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.set(withTiming(open ? 1 : 0, SMOOTH));
  }, [open, t]);
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, [0, 1], ['rgba(250,249,246,0)', '#FAF9F6']) }));
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

/** The green "we're open" dot, breathing softly. */
function LiveDot() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduced) p.set(withRepeat(withTiming(1, { duration: 1700, easing: EASE_OUT }), -1, false));
    return () => cancelAnimation(p);
  }, [p, reduced]);
  const halo = useAnimatedStyle(() => ({ opacity: (1 - p.value) * 0.6, transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveHalo, halo]} />
      <View style={styles.liveDot} />
    </View>
  );
}


const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(40, 30, 10, 0.06)' } as object)
    : { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 };

// a thin warm edge on the white cards, so they hold their shape on the light background
const hairline = { borderWidth: 1, borderColor: '#E8E4DA' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  barInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  page: { paddingHorizontal: PAGE, gap: space.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.3, color: colors.ink },

  intro: { gap: space.sm, marginTop: space.xs },
  heading: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  searchWrap: { marginTop: space.sm },
  searchTrail: { flexDirection: 'row', alignItems: 'center' },
  searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.inkMuted, alignItems: 'center', justifyContent: 'center' },

  sent: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 20, backgroundColor: '#EEF8F0', borderWidth: 1, borderColor: '#CDEBD3' },
  sentTick: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0F8A26', alignItems: 'center', justifyContent: 'center' },
  sentText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  sentStrong: { fontFamily: fonts.semibold, color: colors.ink },

  meta: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted, marginTop: 2 },

  section: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.4, color: colors.ink, marginBottom: space.md },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft, marginBottom: space.md, minWidth: 26, textAlign: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: CHIP, overflow: 'hidden' },

  listCard: { borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: 6, overflow: 'hidden', ...soft, ...hairline },
  rule: { borderTopWidth: 1, borderTopColor: '#F0EDE7' },
  faq: { borderRadius: 18, paddingHorizontal: space.md },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 15 },
  faqQ: { flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  faqA: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.inkSoft, paddingBottom: space.md, paddingRight: 36 },
  chevron: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  collapse: { overflow: 'hidden' },
  collapseInner: { position: 'absolute', left: 0, right: 0, top: 0 },

  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, gap: 6 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: BEIGE, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, textAlign: 'center' },
  darkPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: CHARCOAL, marginTop: space.sm },
  darkPillText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },

                
  contact: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.25,
    borderColor: '#DDD7CA',
    padding: 20,
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 4px rgba(10, 28, 62, 0.04), 0 8px 24px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 }),
  },
  contactHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  contactTitle: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  hoursText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  contactBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFF1E0',
    borderWidth: 1,
    borderColor: '#FFE4C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: { flexDirection: 'row', gap: 10 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F8F6F1',
    borderWidth: 1.25,
    borderColor: '#E8E3D8',
  },
  contactBtnText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink },
  raise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: brand.orange,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 14px rgba(254, 135, 1, 0.32)' } as object)
      : { shadowColor: brand.orange, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }),
  },
  raiseText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },

  live: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC6B' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC6B' },

  drawerForm: { gap: space.md },
  drawerSectionLabel: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: -0.2, color: colors.inkSoft, marginBottom: 4 },
  selectorWrap: { gap: 6 },
  selectorHead: {
    height: 52,
    borderRadius: 26,
    backgroundColor: FORM.field,
    borderWidth: 1.25,
    borderColor: FORM.edge,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  selectorHeadOpen: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.ink,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(10, 28, 62, 0.08)' } as object)
      : { shadowColor: colors.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }),
  },
  selectorBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorBadgeMuted: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EBE8DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14.5,
    color: colors.ink,
  },
  selectorPlaceholder: {
    color: colors.inkMuted,
  },
  selectorMenu: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E4DE',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 6px 20px rgba(10, 28, 62, 0.07)' } as object)
      : { shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 }),
  },
  selectorMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  selectorMenuDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F5F3EF',
  },
  selectorMenuItemActive: {
    backgroundColor: '#FAF9F6',
  },
  menuItemIconDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIconDiscActive: {
    backgroundColor: colors.ink,
  },
  menuItemLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkSoft,
  },
  menuItemLabelActive: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  menuCheckDisc: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerErrorText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: 4, paddingHorizontal: 4 },
  fieldGap: { marginTop: space.xs },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft, marginTop: 6, paddingHorizontal: 4 },
});
