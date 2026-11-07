import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetSuccess } from '../auth/SignInSteps';
import { Icon } from '../app/Icon';
import { Rise } from '../app/motion';
import { Avatar, Button } from '../app/primitives';
import { FORM, formStyles, PillField } from '../ui/SheetForm';
import { haptic } from '../../lib/haptics';
import { money } from '../../lib/format';
import {
  applyReferralCode,
  lookupReferralCode,
  normaliseReferralCode,
  ReferralCodeError,
  type ReferralCodeProblem,
} from '../../services/mock/account.service';
import { colors, fonts, space, text } from '../../theme';
import type { ReferralCodeRules } from '../../types/models';

const GREEN = '#0F8A26';
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

type Check = { state: 'idle' } | { state: 'checking' } | { state: 'found'; owner: string } | { state: 'problem'; problem: ReferralCodeProblem };

/**
 * Entering a friend's referral code, in the same drawer style as top-up and edit profile:
 * type or paste the code, see whose it is before committing, see exactly what each of you gets, then apply.
 */
export function ReferralCodeDrawer({
  rules,
  friendReward,
  onApplied,
}: {
  rules: ReferralCodeRules;
  /** What the friend who shared the code gets. */
  friendReward: number;
  onApplied: () => void;
}) {
  const [value, setValue] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const [formH, setFormH] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(''); // only the newest lookup may update the screen

  useEffect(() => () => clearTimeout(timer.current), []);

  const problemText = (p: ReferralCodeProblem) =>
    p === 'format'
      ? `Codes are ${rules.minLength}–${rules.maxLength} letters or numbers.`
      : p === 'own'
        ? 'That’s your own code. Share it with friends instead.'
        : p === 'already'
          ? 'You’ve already used a referral code on this account.'
          : 'We couldn’t find that code. Check it with your friend and try again.';

  // look the code up as soon as it's long enough, a moment after typing stops
  const onChange = (raw: string) => {
    const code = normaliseReferralCode(raw).slice(0, rules.maxLength);
    setValue(code);
    setFailed(false);
    clearTimeout(timer.current);
    latest.current = code;
    if (code.length < rules.minLength) {
      setCheck({ state: 'idle' });
      return;
    }
    setCheck({ state: 'checking' });
    timer.current = setTimeout(async () => {
      try {
        const found = await lookupReferralCode(code);
        if (latest.current === code) setCheck({ state: 'found', owner: found.owner });
      } catch (e) {
        if (latest.current === code) setCheck({ state: 'problem', problem: e instanceof ReferralCodeError ? e.problem : 'not_found' });
      }
    }, 350);
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) onChange(text);
  };

  const apply = async () => {
    if (check.state !== 'found' || applying) return;
    setApplying(true);
    setFailed(false);
    try {
      await applyReferralCode(value);
      haptic.success();
      setDone(true);
      setTimeout(onApplied, 1800);
    } catch (e) {
      setApplying(false);
      if (e instanceof ReferralCodeError) setCheck({ state: 'problem', problem: e.problem });
      else setFailed(true);
    }
  };

  // the green tick takes the form's place at the same height, so the drawer doesn't jump
  if (done) {
    return (
      <View style={{ minHeight: formH, justifyContent: 'center' }}>
        <SheetSuccess
          title="Code applied"
          message={`You’ll get ${money(rules.welcomeReward)} in your wallet when your next order is delivered.`}
        />
      </View>
    );
  }

  const found = check.state === 'found';
  const problem = check.state === 'problem' ? check.problem : null;
  const trailing =
    check.state === 'checking' ? (
      <View style={styles.trail}>
        <ActivityIndicator size="small" color={colors.inkSoft} />
      </View>
    ) : found ? (
      <View style={[styles.trailDot, { backgroundColor: GREEN }]}>
        <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />
      </View>
    ) : problem ? (
      <View style={[styles.trailDot, { backgroundColor: colors.danger }]}>
        <Icon name="x" size={12} color="#FFFFFF" strokeWidth={3} />
      </View>
    ) : !value ? (
      <Pressable onPress={paste} accessibilityRole="button" accessibilityLabel="Paste code" hitSlop={8} style={({ pressed }) => [styles.paste, webCursor, pressed && { opacity: 0.6 }]}>
        <Icon name="copy" size={14} color={colors.ink} />
        <Text style={styles.pasteText}>Paste</Text>
      </Pressable>
    ) : undefined;

  return (
    <View onLayout={(e) => setFormH(Math.round(e.nativeEvent.layout.height))}>
      <Text style={text.h1}>Have a referral code?</Text>
      <Text style={[text.body, { marginTop: 2 }]} numberOfLines={1}>Got a code from a friend? Add it here.</Text>

      <Rise delay={90} style={styles.gap}>
        <PillField
          icon="tag"
          trailing={trailing}
          value={value}
          onChangeText={onChange}
          placeholder="Enter referral code"
          invalid={!!problem}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={rules.maxLength + 4}
          inputStyle={value ? styles.codeInput : undefined}
          returnKeyType="done"
          onSubmitEditing={apply}
          accessibilityLabel="Referral code"
        />
        <Text style={[formStyles.helper, (problem || failed) && { color: colors.danger }, found && { color: GREEN }]} accessibilityLiveRegion="polite">
          {failed
            ? 'Something went wrong. Please try again.'
            : problem
              ? problemText(problem)
              : check.state === 'checking'
                ? 'Checking code…'
                : found
                  ? 'Code found. Check the name, then apply it.'
                  : `Codes are ${rules.minLength}–${rules.maxLength} letters or numbers.`}
        </Text>
      </Rise>

      {/* whose code it is, before anything is committed */}
      <Rise delay={150} style={styles.gap}>
        <View style={[styles.owner, found && styles.ownerFound]}>
          {found ? (
            <Avatar name={check.owner} size={40} />
          ) : (
            <View style={styles.ownerBlank}>
              <Icon name="user" size={18} color={colors.inkMuted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.ownerKicker}>Referred by</Text>
            <Text style={[styles.ownerName, !found && styles.ownerNameEmpty]} numberOfLines={1}>
              {found ? check.owner : 'Shows up once the code checks out'}
            </Text>
          </View>
        </View>
      </Rise>

      {/* exactly what each of you gets, and when */}
      <Rise delay={210} style={styles.gap}>
        <View style={styles.rewards}>
          <RewardRow icon="wallet" who="You" what={`${money(rules.welcomeReward)} in your wallet`} />
          <View style={styles.rule} />
          <RewardRow icon="gift" who="Your friend" what={`${money(friendReward)} in their wallet`} />
        </View>
        <Text style={formStyles.helper}>Both are added when your next order is delivered.</Text>
      </Rise>

      <Rise delay={270} style={{ marginTop: space.lg }}>
        <Button label="Apply code" variant="dark" icon="check" disabled={!found} loading={applying} onPress={apply} />
      </Rise>
    </View>
  );
}

function RewardRow({ icon, who, what }: { icon: 'wallet' | 'gift'; who: string; what: string }) {
  return (
    <View style={styles.reward}>
      <View style={styles.rewardIcon}>
        <Icon name={icon} size={16} color={colors.navy} />
      </View>
      <Text style={styles.rewardWho}>{who}</Text>
      <Text style={styles.rewardWhat}>{what}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: space.md },
  codeInput: { fontFamily: fonts.bold, letterSpacing: 2 },
  trail: { width: 28, alignItems: 'center' },
  trailDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  paste: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: FORM.edge },
  pasteText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.ink },

  owner: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 68, paddingHorizontal: space.lg, borderRadius: 20, backgroundColor: FORM.field, borderWidth: 1, borderColor: FORM.edge },
  ownerFound: { backgroundColor: '#FFFFFF', borderColor: colors.ink },
  ownerBlank: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: FORM.edge, alignItems: 'center', justifyContent: 'center' },
  ownerKicker: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  ownerName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 1 },
  ownerNameEmpty: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.inkMuted, fontStyle: 'italic' },

  rewards: { borderRadius: 20, backgroundColor: FORM.field, borderWidth: 1, borderColor: FORM.edge, paddingHorizontal: space.lg },
  reward: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 54 },
  rewardIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF3FB', alignItems: 'center', justifyContent: 'center' },
  rewardWho: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  rewardWhat: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  rule: { height: 1, backgroundColor: FORM.edge },
});
