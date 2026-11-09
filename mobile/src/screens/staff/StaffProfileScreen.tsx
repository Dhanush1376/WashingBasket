import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollapsingBar, useCollapsingBar } from '../../components/app/CollapsingBar';
import { Icon, type IconName } from '../../components/app/Icon';
import { LogoutConfirm } from '../../components/app/LogoutConfirm';
import { EASE_OUT, Rise, RollingNumber, useFocusReplay } from '../../components/app/motion';
import { Avatar, MenuRow } from '../../components/app/primitives';
import { Skeleton } from '../../components/app/states';
import { TopBar } from '../../components/app/TopBar';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { PillField } from '../../components/ui/SheetForm';
import { STAFF_ROLE_LABEL } from '../../laundry/labels';
import { haptic } from '../../lib/haptics';
import { date, money } from '../../lib/format';
import { mockStore } from '../../mock/store/mockStore';
import type { Staff } from '../../mock/types';
import type { StaffTabProps } from '../../navigation/types';
import { useSession } from '../../session/session';
import {
  announcementsFor,
  CONTACTS,
  dayKey,
  monthSummary,
  PAY_DAY_NOTE,
  payrollFor,
  POLICIES,
  profileWithEdits,
  saveProfile,
  savePrefs,
  workforceStore,
  type Announcement,
  type NotificationPrefs,
  type Payroll,
  type SalaryStatement,
} from '../../staff/workforce';
import { app, brand, colors, fonts, space } from '../../theme';
import { IdCard } from './IdCard';
import { Button, CHIP, Line, Notice, RoundIcon, shared, Tag, useStaff } from './kit';

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

/* the customer Profile's own shades and measures */
const BG = '#FAF9F6';
const BG_RGB = '250, 249, 246';
const BEIGE = '#F1EDE4';
const CHARCOAL = '#0A1C3E';
const YELLOW = app.yellow;
const RADIUS = 26;
const PAGE = space.lg;

const SMOOTH = { duration: 340, easing: EASE_OUT };

const POLICY_ICONS: Record<string, IconName> = {
  'pol-attendance': 'clock',
  'pol-leave': 'calendar',
  'pol-handover': 'scan',
  'pol-garment-care': 'sparkle',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const PREF_ROWS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'newOrders', label: 'New orders', detail: 'Paid drop-offs and pickups' },
  { key: 'deliveries', label: 'Ready & delivery', detail: 'Customers checking clothes' },
  { key: 'issues', label: 'Issues', detail: 'Problems raised on orders' },
  { key: 'announcements', label: 'Announcements', detail: 'Branch and company news' },
];

type Sheet = null | 'id' | 'pay' | 'notices' | 'help' | 'edit' | 'alerts' | 'policies' | 'security' | 'switch' | 'reset' | 'logout';

/**
 * Me, laid out exactly like the customer's Profile: who I am with four quick actions, then two rows of tiles — my
 * pay and this month's attendance, my leave and the latest notices — and one short menu. The detail lives one tap
 * away in sheets and on my ID card. Pay shown is only ever my own.
 */
export function StaffProfileScreen({ navigation }: StaffTabProps<'StaffProfile'>) {
  const insets = useSafeAreaInsets();
  const bar = useCollapsingBar();
  const replay = useFocusReplay();
  const { state, me, wf, prefs, unread } = useStaff();
  const { signOut, switchStaff } = useSession();
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  const st = me?.staff;
  const pay = st ? payrollFor(st.id) : undefined; // the signed-in person's own record only
  const month = dayKey().slice(0, 7);
  const sum = wf && st ? monthSummary(wf, st, month) : null;
  const notes = st ? announcementsFor(st) : [];
  const lastPaid = pay?.statements.find((s) => s.status === 'PAID');
  const profile = wf && st ? profileWithEdits(wf, st.id) : undefined;
  const colleagues = state && st ? state.staff.filter((s) => s.locationId === st.locationId && s.id !== st.id && s.status === 'ACTIVE') : [];

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        contentContainerStyle={[styles.page, { paddingTop: bar.height + space.xs, paddingBottom: Math.max(insets.bottom, 12) + 64 }]}
        showsVerticalScrollIndicator={false}
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
      >
        {/* ── who ── */}
        <Rise replay={replay} delay={40} distance={18} scale={0.97}>
          <View style={styles.profile}>
            {!me || !st ? (
              <View style={styles.idRow}>
                <Skeleton height={68} width={68} radius={34} />
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skeleton height={20} width={170} radius={8} />
                  <Skeleton height={14} width={120} radius={6} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.idRow}>
                  {/* the avatar opens my ID card */}
                  <Pressable
                    onPress={() => setSheet('id')}
                    accessibilityRole="button"
                    accessibilityLabel="View my ID card"
                    style={({ pressed }) => [styles.avatarRing, webCursor, pressed && { transform: [{ scale: 0.96 }] }]}
                  >
                    <Avatar name={st.name} size={64} />
                    <View style={styles.avatarBadge}>
                      <Icon name="shield" size={11} color="#FFFFFF" strokeWidth={2.4} />
                    </View>
                  </Pressable>
                  <View style={styles.idText}>
                    <Text style={styles.hello}>Hello,</Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {st.name}
                    </Text>
                    <View style={styles.rolePill}>
                      <View style={styles.roleDot} />
                      <Text style={styles.roleText} numberOfLines={1}>
                        {STAFF_ROLE_LABEL[st.role]} · {me.location.shortName}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.idRule} />
                <View style={styles.actions}>
                  <QuickAction icon="shield" label="ID card" onPress={() => setSheet('id')} />
                  <QuickAction icon="edit" label="Edit" onPress={() => setSheet('edit')} />
                  <QuickAction icon="wallet" label="Salary" onPress={() => navigation.navigate('StaffSalary')} />
                  <QuickAction icon="headset" label="Help" onPress={() => navigation.navigate('StaffSupport')} />
                </View>
              </>
            )}
          </View>
        </Rise>

        {/* ── row 2: pay + this month ── */}
        <Rise replay={replay} delay={120} distance={18} scale={0.97} style={styles.row}>
          <Tile onPress={() => navigation.navigate('StaffSalary')} flex={1} style={styles.payCard} label="Open my earnings">
            <View style={styles.tileHead}>
              <View style={styles.tileIcon}>
                <Icon name="wallet" size={18} color={colors.ink} />
              </View>
              <View style={styles.arrowDark}>
                <Icon name="arrowUpRight" size={16} color="#FFFFFF" strokeWidth={2} />
              </View>
            </View>
            <View>
              <Text style={styles.payLabel}>{lastPaid ? `${MONTHS[Number(lastPaid.month.slice(5)) - 1]} salary` : 'Monthly salary'}</Text>
              {pay ? <RollingNumber value={lastPaid?.net ?? pay.salary.monthlyGross} style={styles.payAmount} delay={200} /> : <Skeleton height={34} width={110} radius={8} style={{ marginTop: 4 }} />}
              <View style={styles.payChip}>
                <Text style={styles.payChipText}>{lastPaid?.paidOn ? `Paid ${date(`${lastPaid.paidOn}T00:00:00`)}` : 'Not set up yet'}</Text>
              </View>
            </View>
          </Tile>

          <Tile flex={1} style={styles.statsCard} label="This month's summary" onPress={() => haptic.tap()}>
            <View style={styles.tileHead}>
              <Text style={styles.cardKicker}>{MONTHS[Number(month.slice(5)) - 1]}</Text>
              <View style={styles.arrowLight}>
                <Icon name="clock" size={16} color={colors.ink} strokeWidth={2} />
              </View>
            </View>
            {sum ? (
              <>
                <Text style={styles.statsTotal}>
                  {sum.worked}
                  <Text style={styles.statsOf}>/{sum.scheduled}</Text>
                </Text>
                <View style={{ gap: 6 }}>
                  <StatLine color="#62D487" label="Hours" value={`${Math.round(sum.hours / 3_600_000)}`} />
                  <StatLine color="#FFA742" label="Late" value={`${sum.late}`} />
                  <StatLine color="#F87C87" label="Missed" value={`${sum.missed}`} />
                </View>
              </>
            ) : (
              <Skeleton height={96} radius={12} style={{ marginTop: space.sm }} />
            )}
          </Tile>
        </Rise>

        {/* ── row 3: account ── */}
        <Rise replay={replay} delay={200} distance={18} scale={0.97}>
          <View style={styles.menuCard}>
            <MenuRow icon="bell" label="Notifications" badge={unread || undefined} onPress={() => setSheet('alerts')} />
            <MenuRow divider icon="headset" label="Help & support" onPress={() => navigation.navigate('StaffSupport')} />
            <MenuRow divider icon="bookmark" label="Workplace policies" onPress={() => setSheet('policies')} />
            <MenuRow divider icon="logout" label="Log out" danger onPress={() => setSheet('logout')} />
          </View>
        </Rise>
      </Animated.ScrollView>

      <CollapsingBar bar={bar} tint={BG_RGB} style={{ paddingTop: Math.max(insets.top, 6) }}>
        <View style={styles.barInner}>
          <TopBar
            padded={false}
            title="Profile"
            unread={unread}
            onBell={() => navigation.navigate('StaffNotifications')}
            onHome={() => navigation.navigate('StaffHome')}
          />
        </View>
      </CollapsingBar>

      <BottomSheet visible={!!sheet} onClose={close}>
        {!me || !st || !wf ? null : sheet === 'id' ? (
          <View>
            <Text style={shared.h1}>My ID card</Text>
            <Text style={[shared.body, { marginTop: 2, marginBottom: space.lg }]}>Show it at the branch when asked.</Text>
            <IdCard
              data={{
                name: st.name,
                designation: profile?.designation ?? STAFF_ROLE_LABEL[st.role],
                employeeId: profile?.employeeId ?? st.id,
                joined: new Date(st.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
                location: me.location.shortName,
              }}
            />
            <Text style={[shared.caption, { textAlign: 'center', marginTop: space.md }]}>Demo card · not valid as identification</Text>
          </View>
        ) : sheet === 'pay' ? (
          <PaySheet pay={pay} staff={st} branch={me.location.shortName} onClose={close} />
        ) : sheet === 'notices' ? (
          <NoticesSheet notes={notes} branch={me.location.shortName} />
        ) : sheet === 'help' ? (
          <HelpSheet />
        ) : sheet === 'edit' && profile ? (
          <EditDetails staffId={st.id} email={profile.email} contact={profile.emergencyContact} onDone={close} />
        ) : sheet === 'alerts' ? (
          <View>
            <Text style={shared.h1}>Notifications</Text>
            <Text style={[shared.body, { marginTop: 2, marginBottom: space.sm }]}>What shows in your bell and on Home.</Text>
            {PREF_ROWS.map((p, i) => (
              <View key={p.key} style={[styles.prefRow, i > 0 && styles.rule]}>
                <View style={{ flex: 1 }}>
                  <Text style={shared.strong}>{p.label}</Text>
                  <Text style={shared.caption}>{p.detail}</Text>
                </View>
                <Toggle on={prefs[p.key]} label={p.label} onChange={(v) => savePrefs(st.id, { ...prefs, [p.key]: v }).catch(() => {})} />
              </View>
            ))}
          </View>
        ) : sheet === 'policies' ? (
          <PoliciesSheet onClose={close} />
        ) : sheet === 'security' ? (
          <View style={{ gap: space.sm }}>
            <Text style={shared.h1}>Sign-in & security</Text>
            <Notice tone="info" icon="phone" title="One-time codes">
              You sign in with your phone and a code sent by SMS. Nobody from Washing Basket will ask for it.
            </Notice>
            <Notice tone="info" icon="mapPin" title="Your branch">
              The branch PIN picks your branch. You only see that branch’s orders.
            </Notice>
            <Notice tone="info" icon="lock" title="Customer details">
              Phone numbers and addresses show only when your job needs them.
            </Notice>
          </View>
        ) : sheet === 'switch' ? (
          <SwitchAccount
            colleagues={colleagues}
            current={st}
            onPick={async (id) => {
              await switchStaff(id);
              haptic.success();
              close();
              navigation.navigate('StaffHome');
            }}
          />
        ) : sheet === 'reset' ? (
          <ResetDemo onDone={close} />
        ) : sheet === 'logout' ? (
          <LogoutConfirm
            onCancel={close}
            onConfirm={() => {
              close();
              signOut();
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

/* ───────────── pieces, as on the customer Profile ───────────── */

function Tile({ onPress, flex, style, label, children }: { onPress: () => void; flex?: number; style: object; label: string; children: React.ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => s.set(withSpring(0.97, { damping: 18, stiffness: 320 }))}
      onPressOut={() => s.set(withSpring(1, { damping: 16, stiffness: 260 }))}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[flex ? { flex, minWidth: 0 } : null, webCursor]}
    >
      <Animated.View style={[style, flex ? styles.tileFill : null, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quick, webCursor, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <View style={styles.quickIcon}>
        <Icon name={icon} size={18} color={colors.ink} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function StatLine({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.statLine}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const t = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(on ? 1 : 0, { duration: 200 });
  }, [on, t]);
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(t.value, [0, 1], ['#E2DDD2', colors.ink]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * 18 }] }));
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onChange(!on);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={8}
      style={webCursor}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

/* ───────────── sheets ───────────── */

function PaySheet({ pay, staff, branch, onClose }: { pay?: Payroll; staff: Staff; branch: string; onClose?: () => void }) {
  const [open, setOpen] = useState<SalaryStatement | null>(null);
  const [tab, setTab] = useState<'credits' | 'structure'>('credits');

  if (!pay) {
    return (
      <View style={{ gap: space.sm, paddingVertical: space.md }}>
        <Text style={shared.h1}>Salary & Earnings</Text>
        <Text style={shared.body}>Your pay details aren’t set up yet. HR adds them after your first month.</Text>
      </View>
    );
  }

  if (open) return <Statement s={open} staff={staff} onBack={() => setOpen(null)} />;

  const lastPaid = pay.statements.find((s) => s.status === 'PAID') ?? pay.statements[0];
  const lastAmount = lastPaid?.net ?? pay.salary.monthlyGross;

  return (
    <View style={styles.paySheetRoot}>
      {/* ── Top Header ── */}
      <View style={styles.paySheetTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.paySheetTitle}>Salary & Earnings</Text>
          <Text style={styles.paySheetSub}>Official monthly disbursements & tax slips</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.payVerifiedBadge}>
            <View style={styles.payVerifiedDot} />
            <Text style={styles.payVerifiedText}>Direct Deposit</Text>
          </View>
          {onClose ? (
            <Pressable
              onPress={() => {
                haptic.tap();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Close salary sheet"
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeBtn,
                webCursor,
                pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
              ]}
            >
              <Icon name="x" size={16} color={colors.ink} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Stacked Wallet Cards (Dual Card Look matching WalletScreen) ── */}
      <View style={styles.walletCardsWrap}>
        {/* Navy Card behind */}
        <View style={styles.walletBackCard}>
          <View style={styles.walletBackLeft}>
            <View style={styles.walletBackIcon}>
              <Icon name="shield" size={13} color={brand.navy} strokeWidth={2.4} />
            </View>
            <Text style={styles.walletBackTitle}>HDFC Bank A/C •••• 4821</Text>
          </View>
          <Text style={styles.walletBackCycle}>Cycle: 1st of month</Text>
        </View>

        {/* Front Yellow/Amber Card */}
        <View style={styles.walletFrontCard}>
          <View style={styles.walletFrontTop}>
            <View style={styles.walletFrontIconDisc}>
              <Icon name="wallet" size={16} color={colors.ink} strokeWidth={2.2} />
            </View>
            <View style={styles.walletFrontAccWrap}>
              <Text style={styles.walletFrontAcc}>
                •••• •••• {staff.id.replace(/\D/g, '').slice(-4) || '4821'}
              </Text>
            </View>
          </View>

          <View style={styles.walletFrontMid}>
            <Text style={styles.walletFrontLabel}>
              {lastPaid ? `${monthName(lastPaid.month)} salary credited` : 'Monthly net salary'}
            </Text>
            <RollingNumber value={lastAmount} style={styles.walletFrontAmount} delay={150} />
            <View style={styles.walletFrontChip}>
              <View style={styles.walletFrontChipDot} />
              <Text style={styles.walletFrontChipText}>
                {lastPaid?.paidOn ? `Paid on ${date(`${lastPaid.paidOn}T00:00:00`)}` : 'Processing'}
              </Text>
            </View>
          </View>

          <View style={styles.walletFrontBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.walletFrontEmpLabel}>Employee</Text>
              <Text style={styles.walletFrontName} numberOfLines={1}>
                {staff.name}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                haptic.tap();
                setTab((v) => (v === 'credits' ? 'structure' : 'credits'));
              }}
              style={({ pressed }) => [
                styles.walletNotchBtn,
                webCursor,
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle salary structure"
            >
              <Icon
                name={tab === 'credits' ? 'receipt' : 'list'}
                size={13}
                color="#FFFFFF"
                strokeWidth={2.2}
              />
              <Text style={styles.walletNotchBtnText}>
                {tab === 'credits' ? 'Structure' : 'History'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Lower Section: Transactions / Salary Credits List (Matching WalletScreen) ── */}
      {tab === 'credits' ? (
        <View style={styles.salaryTxnCard}>
          <View style={styles.salaryTxnHead}>
            <Text style={styles.salaryTxnTitle}>Salary credits</Text>
            <Text style={styles.salaryTxnCount}>{pay.statements.length}</Text>
          </View>

          {pay.statements.map((s, i) => {
            const isPaid = s.status === 'PAID';
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  haptic.tap();
                  setOpen(s);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${monthName(s.month)} salary, credited ${money(s.net)}`}
                style={({ pressed }) => [
                  styles.salaryTxnRow,
                  i > 0 && styles.salaryTxnDivider,
                  webCursor,
                  pressed && { backgroundColor: '#F8F6F1' },
                ]}
              >
                {/* Green circular icon disc matching WalletScreen TxnRow */}
                <View style={[styles.salaryTxnIcon, !isPaid && styles.salaryTxnIconWarn]}>
                  <Icon
                    name={isPaid ? 'wallet' : 'clock'}
                    size={16}
                    color={isPaid ? '#0D7A21' : colors.ink}
                    strokeWidth={2.2}
                  />
                </View>

                {/* Title & Date when credited */}
                <View style={styles.salaryTxnInfo}>
                  <Text style={styles.salaryTxnLabel}>{monthName(s.month)} salary</Text>
                  <Text style={styles.salaryTxnWhen} numberOfLines={1}>
                    {isPaid && s.paidOn
                      ? `Credited ${date(`${s.paidOn}T00:00:00`)} · Ref ${s.reference}`
                      : 'Under review · HR Payroll'}
                  </Text>
                </View>

                {/* Amount in bold green */}
                <View style={styles.salaryTxnRight}>
                  <Text style={[styles.salaryTxnAmount, !isPaid && { color: colors.ink }]}>
                    + {money(s.net)}
                  </Text>
                  <View style={[styles.salaryStatusPill, !isPaid && styles.salaryStatusPillWarn]}>
                    <Text style={[styles.salaryStatusText, !isPaid && styles.salaryStatusTextWarn]}>
                      {isPaid ? 'Credited' : 'Processing'}
                    </Text>
                  </View>
                </View>
                <Icon name="chevronRight" size={14} color={colors.inkMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        /* ── Monthly Salary Structure View ── */
        <View style={styles.salaryTxnCard}>
          <View style={styles.salaryTxnHead}>
            <Text style={styles.salaryTxnTitle}>Monthly package</Text>
            <Tag label="Gross" tone="navy" />
          </View>
          <View style={styles.structGrossBox}>
            <Text style={styles.structGrossLabel}>Fixed monthly gross</Text>
            <Text style={styles.structGrossAmount}>{money(pay.salary.monthlyGross)}</Text>
          </View>
          {pay.salary.components.map((c, i) => (
            <View key={c.label} style={[styles.structLine, i > 0 && styles.salaryTxnDivider]}>
              <Text style={styles.structLabel}>{c.label}</Text>
              <Text style={styles.structValue}>{money(c.amount)}</Text>
            </View>
          ))}
          <Text style={styles.structEffective}>
            Effective from {date(`${pay.salary.effectiveFrom}T00:00:00`)} · Standard monthly CTC
          </Text>
        </View>
      )}

      {/* ── Footer Notice ── */}
      <View style={styles.payFootBanner}>
        <View style={styles.payFootIconWrap}>
          <Icon name="info" size={14} color={brand.navy} strokeWidth={2.4} />
        </View>
        <Text style={styles.payFootText}>
          {PAY_DAY_NOTE} Tap any month above to view and verify your full payslip.
        </Text>
      </View>
    </View>
  );
}

function Statement({ s, staff, onBack }: { s: SalaryStatement; staff?: Staff; onBack: () => void }) {
  const deductions = s.deductions.reduce((n, d) => n + d.amount, 0);
  const isPaid = s.status === 'PAID';
  return (
    <View style={styles.statementRoot}>
      <Pressable onPress={onBack} accessibilityRole="button" style={[styles.backLink, webCursor]}>
        <Icon name="chevronLeft" size={16} color={colors.navy} />
        <Text style={styles.link}>All salary credits</Text>
      </Pressable>

      <View style={styles.statementHeader}>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>{monthName(s.month)} payslip</Text>
          <Text style={styles.statementSub}>
            {isPaid && s.paidOn ? `Disbursed on ${date(`${s.paidOn}T00:00:00`)}` : 'Disbursement in progress'}
          </Text>
        </View>
        <Tag label={isPaid ? 'Credited' : 'Processing'} tone={isPaid ? 'ok' : 'warn'} />
      </View>

      <View style={styles.statementCard}>
        {/* Days attendance */}
        <View style={styles.statementRow}>
          <Text style={styles.statementLabel}>Working days</Text>
          <Text style={styles.statementVal}>{`${s.daysPayable} of ${s.daysInMonth} days`}</Text>
        </View>
        {s.lossOfPayDays ? (
          <View style={styles.statementRow}>
            <Text style={styles.statementLabel}>Unpaid / Loss of pay</Text>
            <Text style={[styles.statementVal, { color: colors.danger }]}>{`${s.lossOfPayDays} days`}</Text>
          </View>
        ) : null}

        <View style={styles.statementDivider} />

        {/* Earnings */}
        <View style={styles.statementRow}>
          <Text style={styles.statementLabel}>Basic + Allowances</Text>
          <Text style={styles.statementVal}>{money(s.earnedBase)}</Text>
        </View>

        {s.incentives.map((x) => (
          <View key={x.label} style={styles.statementRow}>
            <Text style={styles.statementLabel}>{x.label}</Text>
            <Text style={[styles.statementVal, { color: '#0D7A21' }]}>{`+ ${money(x.amount)}`}</Text>
          </View>
        ))}

        {s.deductions.map((x) => (
          <View key={x.label} style={styles.statementRow}>
            <Text style={styles.statementLabel}>{x.label}</Text>
            <Text style={[styles.statementVal, { color: colors.inkSoft }]}>{`− ${money(x.amount)}`}</Text>
          </View>
        ))}

        <View style={styles.statementDivider} />

        <View style={styles.statementRow}>
          <Text style={styles.statementTotalLabel}>Gross salary</Text>
          <Text style={styles.statementTotalVal}>{money(s.gross)}</Text>
        </View>
        <View style={styles.statementRow}>
          <Text style={styles.statementTotalLabel}>Total deductions</Text>
          <Text style={[styles.statementTotalVal, { color: colors.danger }]}>{`− ${money(deductions)}`}</Text>
        </View>

        <View style={styles.statementNetBox}>
          <View>
            <Text style={styles.statementNetLabel}>Net salary credited</Text>
            <Text style={styles.statementNetSub}>Transferred to bank account</Text>
          </View>
          <Text style={styles.statementNetVal}>{money(s.net)}</Text>
        </View>
      </View>

      {/* Reference & Audit */}
      <View style={styles.statementRefCard}>
        <View style={styles.statementRefRow}>
          <Text style={styles.statementRefLabel}>Reference ID</Text>
          <Text style={styles.statementRefVal}>{s.reference}</Text>
        </View>
        <View style={styles.statementRefRow}>
          <Text style={styles.statementRefLabel}>Payment Mode</Text>
          <Text style={styles.statementRefVal}>NEFT / Direct Bank Credit</Text>
        </View>
        <View style={styles.statementRefRow}>
          <Text style={styles.statementRefLabel}>Beneficiary</Text>
          <Text style={styles.statementRefVal}>{staff?.name || 'Staff Member'}</Text>
        </View>
      </View>

      <Button
        label="Done"
        variant="outline"
        onPress={onBack}
        style={{ marginTop: space.sm }}
      />
    </View>
  );
}

function NoticesSheet({ notes, branch }: { notes: Announcement[]; branch: string }) {
  const [open, setOpen] = useState<Announcement | null>(null);
  if (open) {
    return (
      <View>
        <Pressable onPress={() => setOpen(null)} accessibilityRole="button" style={[styles.backLink, webCursor]}>
          <Icon name="chevronLeft" size={16} color={colors.navy} />
          <Text style={styles.link}>Notices</Text>
        </Pressable>
        <Text style={shared.kicker}>
          {open.kind === 'branch' ? branch : 'Company'} · {date(open.publishedAt)}
        </Text>
        <Text style={[shared.h1, { marginTop: 2 }]}>{open.title}</Text>
        <Text style={[shared.body, { marginTop: space.md }]}>{open.body}</Text>
        <Text style={[shared.caption, { marginTop: space.md }]}>— {open.author}</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={[shared.h1, { marginBottom: space.sm }]}>Notices</Text>
      {notes.length ? (
        notes.map((n, i) => (
          <Pressable key={n.id} onPress={() => setOpen(n)} accessibilityRole="button" style={({ pressed }) => [styles.listRow, i > 0 && styles.rule, webCursor, pressed && { opacity: 0.7 }]}>
            <RoundIcon icon={n.kind === 'branch' ? 'store' : 'megaphone'} tone={n.pinned ? 'orange' : 'beige'} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={shared.strong} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={shared.caption}>
                {n.author} · {date(n.publishedAt)}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.inkMuted} />
          </Pressable>
        ))
      ) : (
        <Text style={shared.body}>Nothing new.</Text>
      )}
    </View>
  );
}

/** A chevron that turns over as its section opens (matching SupportScreen). */
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

/** Animates its children's height open and shut (matching SupportScreen). */
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

/** One workplace policy item: slides open beneath it with smooth height animation and chevron rotation. */
function PolicyItem({
  policy,
  first,
  open,
  onToggle,
}: {
  policy: (typeof POLICIES)[number];
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

  const iconName = POLICY_ICONS[policy.id] ?? 'bookmark';

  return (
    <Animated.View style={[styles.policyItem, !first && styles.policyRule, bg]}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={[styles.policyHead, webCursor]}
      >
        <View style={[styles.policyIconBadge, open && styles.policyIconBadgeOpen]}>
          <Icon
            name={iconName}
            size={16}
            color={open ? brand.orange : brand.navy}
            strokeWidth={2.2}
          />
        </View>
        <Text style={[styles.policyTitle, open && styles.policyTitleOpen, { flex: 1 }]}>
          {policy.title}
        </Text>
        <Chevron open={open} />
      </Pressable>
      <Collapse open={open}>
        <View style={styles.policyBodyWrap}>
          <Text style={styles.policyBody}>{policy.body}</Text>
        </View>
      </Collapse>
    </Animated.View>
  );
}

function PoliciesSheet({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={styles.policySheet}>
      <View style={styles.policySectionRow}>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Workplace policies</Text>
          <Text style={styles.policySectionSub}>Rules and operational standards for every shift</Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={() => {
              haptic.tap();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close workplace policies"
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              webCursor,
              pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
            ]}
          >
            <Icon name="x" size={16} color={colors.ink} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.policyCleanList}>
        {POLICIES.map((p, i) => (
          <PolicyItem
            key={p.id}
            policy={p}
            first={i === 0}
            open={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)}
          />
        ))}
      </View>
    </View>
  );
}

function HelpSheet() {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={shared.h1}>Help</Text>
      <Text style={[shared.body, { marginTop: 2, marginBottom: space.xs }]}>Who to call during and after your shift.</Text>
      <View style={styles.policyCleanList}>
        {CONTACTS.map((c, i) => (
          <View key={c.id} style={[styles.helpRow, i > 0 && styles.policyRule]}>
            <RoundIcon icon={c.kind === 'emergency' ? 'alert' : c.kind === 'hr' ? 'users' : 'headset'} tone={c.kind === 'emergency' ? 'danger' : 'beige'} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={shared.strong}>{c.label}</Text>
              <Text style={shared.caption}>{c.hours}</Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`).catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel={`Call ${c.label}, ${c.phone}`}
              hitSlop={6}
              style={({ pressed }) => [styles.call, c.kind === 'emergency' && { backgroundColor: colors.danger }, webCursor, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <Icon name="phone" size={16} color={c.kind === 'emergency' ? '#FFFFFF' : colors.ink} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

function EditDetails({ staffId, email: email0, contact, onDone }: { staffId: string; email: string; contact: { name: string; relation: string; phone: string }; onDone: () => void }) {
  const [email, setEmail] = useState(email0);
  const [name, setName] = useState(contact.name);
  const [relation, setRelation] = useState(contact.relation);
  const [phone, setPhone] = useState(contact.phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfile(staffId, { email, emergencyContact: { name, relation, phone } });
      haptic.success();
      onDone();
    } catch (e) {
      haptic.error();
      setError(e instanceof Error ? e.message : 'Couldn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: space.sm }}>
      <Text style={shared.h1}>Edit my details</Text>
      <Text style={shared.body}>Name, phone, role and pay come from HR.</Text>
      <Text style={styles.label}>Email</Text>
      <PillField value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} icon="mail" accessibilityLabel="Email" />
      <Text style={styles.label}>Emergency contact</Text>
      <PillField value={name} onChangeText={setName} placeholder="Name" icon="user" accessibilityLabel="Emergency contact name" />
      <PillField value={relation} onChangeText={setRelation} placeholder="Relation, e.g. Mother" accessibilityLabel="Relation" />
      <PillField value={phone} onChangeText={setPhone} placeholder="+91 98140 00000" keyboardType="phone-pad" icon="phone" accessibilityLabel="Emergency contact phone" />
      {error ? (
        <Text style={shared.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label="Save" onPress={save} loading={busy} style={{ marginTop: space.sm }} />
    </View>
  );
}

function SwitchAccount({ colleagues, current, onPick }: { colleagues: Staff[]; current: Staff; onPick: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const people = [current, ...colleagues];
  return (
    <View>
      <Text style={shared.h1}>Switch demo account</Text>
      <Text style={[shared.body, { marginTop: 2, marginBottom: space.sm }]}>See the app as someone else at this branch. Demo only.</Text>
      {people.map((c, i) => {
        const mine = c.id === current.id;
        return (
          <Pressable
            key={c.id}
            disabled={mine || !!busy}
            onPress={async () => {
              setBusy(c.id);
              try {
                await onPick(c.id);
              } finally {
                setBusy(null);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={mine ? `${c.name}, current account` : `Switch to ${c.name}, ${STAFF_ROLE_LABEL[c.role]}`}
            style={({ pressed }) => [styles.listRow, i > 0 && styles.rule, webCursor, pressed && { opacity: 0.7 }]}
          >
            <Avatar name={c.name} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={shared.strong}>{c.name}</Text>
              <Text style={shared.caption}>{STAFF_ROLE_LABEL[c.role]}</Text>
            </View>
            {mine ? <Tag label="You" tone="navy" /> : busy === c.id ? <Text style={shared.caption}>Switching…</Text> : <Icon name="chevronRight" size={16} color={colors.inkMuted} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function ResetDemo({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Text style={shared.h1}>Reset demo data?</Text>
      <Text style={shared.body}>Orders and QR codes go back to the demo start for everyone, and check-ins, leave and settings on this phone are cleared.</Text>
      <View style={styles.buttons}>
        <Button label="Cancel" variant="outline" onPress={onDone} disabled={busy} style={{ flex: 1 }} />
        <Button
          label="Reset"
          variant="dark"
          loading={busy}
          style={{ flex: 1 }}
          onPress={async () => {
            setBusy(true);
            try {
              await Promise.all([mockStore.reset(), workforceStore.reset()]);
              haptic.success();
            } finally {
              setBusy(false);
              onDone();
            }
          }}
        />
      </View>
    </View>
  );
}

const soft =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 1px 3px rgba(10, 28, 62, 0.02), 0 4px 12px rgba(10, 28, 62, 0.035)' } as object)
    : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 8, elevation: 1 };
const hairline = { borderWidth: 1, borderColor: '#E5E1D8' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  barInner: { paddingHorizontal: PAGE, maxWidth: 560, width: '100%', alignSelf: 'center' },
  page: { paddingHorizontal: PAGE, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },

  profile: { backgroundColor: '#FFFFFF', borderRadius: RADIUS, padding: space.lg, ...soft, ...hairline },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatarRing: {
    padding: 3,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 4px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }),
  },
  avatarBadge: { position: 'absolute', right: -1, bottom: -1, width: 24, height: 24, borderRadius: 12, backgroundColor: '#0A1C3E', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  idText: { flex: 1, alignItems: 'flex-start', minWidth: 0 },
  hello: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 18, color: '#4B5563' },
  name: { fontFamily: fonts.extrabold, fontSize: 21, lineHeight: 26, letterSpacing: -0.6, color: '#0A1C3E', marginTop: 1 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    maxWidth: '100%',
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    marginTop: 8,
  },
  roleDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#12AD2B' },
  roleText: { fontFamily: fonts.bold, fontSize: 12.5, color: '#0A1C3E', flexShrink: 1 },
  idRule: { height: 1, backgroundColor: '#EFECE6', marginTop: space.lg, marginBottom: space.md },
  actions: { flexDirection: 'row', alignSelf: 'stretch' },
  quick: { flex: 1, alignItems: 'center', gap: 6 },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F6F1',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.05)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 }),
  },
  quickLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#0A1C3E' },

  row: { flexDirection: 'row', gap: space.md },
  tileFill: { flex: 1, minWidth: 0 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cardKicker: { fontFamily: fonts.bold, fontSize: 13, color: '#0A1C3E', letterSpacing: 0.2 },
  arrowDark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0A1C3E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.25)' } as object) : null),
  },
  arrowLight: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlass: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  payCard: {
    minHeight: 176,
    borderRadius: RADIUS,
    backgroundColor: YELLOW,
    padding: space.lg,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.12)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(230, 140, 20, 0.08)' } as object)
      : { shadowColor: '#E68C14', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 1 }),
  },
  payLabel: { fontFamily: fonts.semibold, fontSize: 13, color: '#0A1C3E' },
  payAmount: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: '#0A1C3E', fontVariant: ['tabular-nums'] },
  payChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(10, 28, 62, 0.12)',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 1px 4px rgba(10, 28, 62, 0.04)' } as object) : null),
  },
  payChipText: { fontFamily: fonts.bold, fontSize: 12, color: '#0A1C3E' },

  statsCard: { minHeight: 176, borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, justifyContent: 'space-between', ...soft, ...hairline },
  statsTotal: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: '#0A1C3E' },
  statsOf: { fontFamily: fonts.bold, fontSize: 18, color: '#4B5563', letterSpacing: -0.4 },
  statLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDot: { width: 7, height: 7, borderRadius: 3.5 },
  statLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: '#1F2937' },
  statValue: { fontFamily: fonts.bold, fontSize: 13, color: '#0A1C3E' },

  leaveCard: { minHeight: 176, borderRadius: RADIUS, backgroundColor: '#FFFFFF', padding: space.lg, justifyContent: 'space-between', ...soft, ...hairline },
  leaveLabel: { fontFamily: fonts.semibold, fontSize: 13, color: '#1F2937' },
  leaveHero: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: '#0A1C3E', marginTop: 2 },
  leavePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 26,
    maxWidth: '100%',
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: '#F4F2EE',
    borderWidth: 1,
    borderColor: '#E5E1D8',
    justifyContent: 'center',
  },
  leavePillText: { fontFamily: fonts.bold, fontSize: 12, color: '#0A1C3E' },

  noticeCard: {
    minHeight: 176,
    borderRadius: RADIUS,
    backgroundColor: brand.navy,
    padding: space.lg,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 10px rgba(1, 62, 134, 0.10)' } as object)
      : { shadowColor: brand.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 1 }),
  },
  noticeLabel: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  noticeHero: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: '#FFFFFF', marginTop: 2 },
  noticePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 26,
    maxWidth: '100%',
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    justifyContent: 'center',
  },
  noticePillText: { fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' },

  barBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E1D8', alignItems: 'center', justifyContent: 'center' },
  menuCard: { borderRadius: RADIUS, backgroundColor: '#FFFFFF', paddingVertical: space.xs, paddingHorizontal: space.sm, ...soft, ...hairline },

  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  box: { padding: space.lg, borderRadius: 20, backgroundColor: BEIGE },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  listAmount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  rule: { borderTopWidth: 1, borderTopColor: '#EFECE6' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: space.sm, alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.navy },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },

  call: { width: 40, height: 40, borderRadius: 20, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' },
  track: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', ...soft },
  label: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkSoft, marginTop: space.sm },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.md },

  // Salary sheet mirroring customer WalletScreen
  paySheetRoot: { gap: space.md },
  paySheetTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  paySheetTitle: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5, color: colors.ink },
  paySheetSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  payVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#EEF8F0',
    borderWidth: 1,
    borderColor: '#CDEBD3',
  },
  payVerifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0F8A26' },
  payVerifiedText: { fontFamily: fonts.semibold, fontSize: 11.5, color: '#0F8A26' },

  walletCardsWrap: { marginTop: 4, position: 'relative' },
  walletBackCard: {
    height: 60,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#0A1C3E',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 2px 6px rgba(10, 28, 62, 0.04)' } as object)
      : { shadowColor: '#0A1C3E', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }),
  },
  walletBackLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  walletBackIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  walletBackTitle: { fontFamily: fonts.semibold, fontSize: 12.5, color: '#FFFFFF' },
  walletBackCycle: { fontFamily: fonts.medium, fontSize: 11.5, color: 'rgba(255, 255, 255, 0.65)' },

  walletFrontCard: {
    minHeight: 180,
    marginTop: -22,
    borderRadius: 24,
    backgroundColor: YELLOW,
    padding: space.lg,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 4px 12px rgba(255, 167, 38, 0.09)' } as object)
      : { shadowColor: YELLOW, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 1 }),
  },
  walletFrontTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletFrontIconDisc: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.6)', alignItems: 'center', justifyContent: 'center' },
  walletFrontAccWrap: { height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.45)', justifyContent: 'center' },
  walletFrontAcc: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink, letterSpacing: 0.5 },

  walletFrontMid: { marginVertical: 6 },
  walletFrontLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(10, 28, 62, 0.72)' },
  walletFrontAmount: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'] },
  walletFrontChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  walletFrontChipDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#0D7A21' },
  walletFrontChipText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink },

  walletFrontBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 },
  walletFrontEmpLabel: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(10, 28, 62, 0.6)' },
  walletFrontName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },

  walletNotchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#0A1C3E',
  },
  walletNotchBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: '#FFFFFF' },

  salaryTxnCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: space.md,
    overflow: 'hidden',
    ...soft,
    ...hairline,
  },
  salaryTxnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE7',
    marginBottom: 4,
  },
  salaryTxnTitle: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.4, color: colors.ink },
  salaryTxnCount: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
    minWidth: 26,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F1EFEA',
    overflow: 'hidden',
  },

  salaryTxnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    paddingHorizontal: space.xs,
    borderRadius: 14,
  },
  salaryTxnDivider: { borderTopWidth: 1, borderTopColor: '#F2EFEB' },
  salaryTxnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  salaryTxnIconWarn: { backgroundColor: '#FFF5E6' },
  salaryTxnInfo: { flex: 1, minWidth: 0 },
  salaryTxnLabel: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.ink },
  salaryTxnWhen: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  salaryTxnRight: { alignItems: 'flex-end', gap: 3 },
  salaryTxnAmount: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0D7A21',
    fontVariant: ['tabular-nums'],
  },
  salaryStatusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EEF8F0',
  },
  salaryStatusPillWarn: { backgroundColor: '#FFF5E6' },
  salaryStatusText: { fontFamily: fonts.semibold, fontSize: 10.5, color: '#0D7A21' },
  salaryStatusTextWarn: { color: '#C96B00' },

  structGrossBox: {
    padding: space.md,
    borderRadius: 16,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    marginVertical: space.sm,
  },
  structGrossLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  structGrossAmount: { fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.5, color: colors.ink, marginTop: 2 },
  structLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: space.xs },
  structLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  structValue: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  structEffective: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted, marginTop: space.sm, textAlign: 'center' },

  payFootBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: BEIGE,
  },
  payFootIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  payFootText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.inkSoft },

  // Statement detailed payslip
  statementRoot: { gap: space.sm },
  statementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  statementSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  statementCard: {
    padding: space.lg,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    gap: 10,
    ...soft,
    ...hairline,
  },
  statementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statementLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft },
  statementVal: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  statementTotalLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  statementTotalVal: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  statementDivider: { height: 1, backgroundColor: '#F0EDE7', marginVertical: 4 },
  statementNetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    borderRadius: 16,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#E8E4DA',
    marginTop: 6,
  },
  statementNetLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  statementNetSub: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkSoft, marginTop: 1 },
  statementNetVal: { fontFamily: fonts.extrabold, fontSize: 20, color: '#0D7A21', fontVariant: ['tabular-nums'] },

  statementRefCard: {
    padding: space.md,
    borderRadius: 16,
    backgroundColor: '#FAF9F6',
    borderWidth: 1,
    borderColor: '#ECEAE4',
    gap: 8,
  },
  statementRefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statementRefLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  statementRefVal: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft },

  // SupportScreen-style clean accordion for workplace policies
  policySheet: { gap: space.sm },
  policySectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs },
  policySectionSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  policyCount: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkSoft,
    minWidth: 26,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F1EFEA',
    overflow: 'hidden',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1EDE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyCleanList: {
    marginTop: space.xs,
  },
  policyItem: {
    paddingHorizontal: space.xs,
  },
  policyRule: {
    borderTopWidth: 1,
    borderTopColor: '#F0EDE7',
  },
  policyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 15,
  },
  policyIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BEIGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyIconBadgeOpen: {
    backgroundColor: '#FFF1E0',
  },
  policyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  policyTitleOpen: {
    color: brand.navy,
  },
  policyBodyWrap: {
    paddingLeft: 54,
    paddingRight: space.xs,
    paddingBottom: space.md,
    paddingTop: 2,
  },
  policyBody: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapse: {
    overflow: 'hidden',
  },
  collapseInner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
