import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { when } from '../../lib/format';
import { statusTimes } from '../../mock/engine/selectors';
import type { LaundryOrder, MockState } from '../../mock/types';
import { app, colors, fonts, space } from '../../theme';
import { Icon, type IconName } from '../app/Icon';

export type TimelineRow = {
  key: string;
  title: string;
  detail?: string;
  time?: string;
  state: 'done' | 'now' | 'next' | 'stop';
  icon: IconName;
};

export type ProgressJourneyResult = {
  stepIndex: number;
  totalSteps: number;
  label: string;
  steps: TimelineRow[];
};

/**
 * Derives the clean 5-step customer journey:
 *  1. Drop-off & Collection (Collected after QR scan)
 *  2. Washing & Drying
 *  3. Ironing & Packing
 *  4. Out for Delivery (home) / Ready for Collection (campus counter)
 *  5. Delivered
 */
export function get5StepJourney(order: LaundryOrder, state?: MockState | null): ProgressJourneyResult {
  const isHome = order.serviceMode === 'HOME_PICKUP';
  const times = state ? statusTimes(state, order.id) : {};
  const isStopped = order.status === 'REJECTED' || order.status === 'CANCELLED';
  const isDelivered = order.status === 'DELIVERED';

  // Determine active step (1 to 5)
  let currentStep = 1;
  if (isDelivered) {
    currentStep = 5;
  } else if (order.status === 'READY_FOR_DELIVERY' || order.status === 'AWAITING_CUSTOMER_VERIFICATION') {
    currentStep = 4;
  } else if (order.status === 'PROCESSING') {
    currentStep = 3;
  } else if (order.status === 'ACCEPTED' || order.status === 'PICKUP_CONFIRMED') {
    currentStep = 2;
  } else {
    // REQUEST_SUBMITTED, PAYMENT_PENDING, PAYMENT_COMPLETED, AWAITING_STAFF_ACCEPTANCE
    currentStep = 1;
  }

  const getStepState = (stepNum: number): 'done' | 'now' | 'next' => {
    if (isStopped) {
      return stepNum < currentStep ? 'done' : 'next';
    }
    if (isDelivered) return 'done';
    if (stepNum < currentStep) return 'done';
    if (stepNum === currentStep) return 'now';
    return 'next';
  };

  const step1State = getStepState(1);
  const step2State = getStepState(2);
  const step3State = getStepState(3);
  const step4State = getStepState(4);
  const step5State = getStepState(5);

  const step1Time =
    step1State === 'done'
      ? order.acceptedAt ?? times.ACCEPTED ?? times.PICKUP_CONFIRMED ?? times.AWAITING_STAFF_ACCEPTANCE ?? order.createdAt
      : undefined;
  const step2Time = step2State === 'done' ? times.PROCESSING ?? times.ACCEPTED ?? order.acceptedAt : undefined;
  const step3Time = step3State === 'done' ? times.READY_FOR_DELIVERY ?? times.PROCESSING : undefined;
  const step4Time = step4State === 'done' ? times.AWAITING_CUSTOMER_VERIFICATION ?? times.READY_FOR_DELIVERY : undefined;
  const step5Time = isDelivered ? order.deliveredAt ?? times.DELIVERED ?? order.updatedAt : undefined;

  const step1Title =
    step1State === 'done'
      ? 'Collected'
      : order.status === 'PAYMENT_PENDING'
        ? 'Payment & Drop-off'
        : isHome
          ? 'Pickup & Collection'
          : 'Drop-off & Collection';

  const step1Detail =
    step1State === 'done'
      ? isHome
        ? 'Collected by pickup partner'
        : 'QR scanned & clothes received'
      : order.status === 'PAYMENT_PENDING'
        ? 'Pay to unlock Drop-off QR code'
        : isHome
          ? 'Show QR to pickup partner at door'
          : 'Show Drop-off QR at counter to hand over clothes';

  const steps: TimelineRow[] = [
    {
      key: 'COLLECTED',
      title: step1Title,
      icon: 'bag',
      state: step1State,
      time: step1Time,
      detail: step1Detail,
    },
    {
      key: 'WASHING_DRYING',
      title: 'Washing & Drying',
      icon: 'droplet',
      state: step2State,
      time: step2Time,
      detail:
        step2State === 'done'
          ? 'Washed and gentle tumble dried'
          : step2State === 'now'
            ? 'In wash cycle & gentle tumble drying'
            : 'Deep fabric wash and gentle tumble drying',
    },
    {
      key: 'IRONING_PACKING',
      title: 'Ironing & Packing',
      icon: 'shirt',
      state: step3State,
      time: step3Time,
      detail:
        step3State === 'done'
          ? 'Steam pressed, folded and packed'
          : step3State === 'now'
            ? 'Steam ironing & garment packaging'
            : 'Steam press & protective packaging',
    },
    {
      key: 'OUT_FOR_DELIVERY',
      title: isHome ? 'Out for Delivery' : 'Ready for Collection',
      icon: 'package',
      state: step4State,
      time: step4Time,
      detail:
        step4State === 'done'
          ? isHome
            ? 'Delivered to your address'
            : 'Picked up at counter'
          : step4State === 'now'
            ? isHome
              ? 'Delivery partner on the way to your door'
              : 'Ready at campus counter · Show delivery QR'
            : isHome
              ? 'Dispatched for doorstep delivery'
              : 'Ready for collection at counter',
    },
    {
      key: 'DELIVERED',
      title: 'Delivered',
      icon: 'truck',
      state: step5State,
      time: step5Time,
      detail:
        step5State === 'done'
          ? 'Handed over · All pieces verified'
          : step5State === 'now'
            ? 'Handover in progress · Verify clothes'
            : 'Final handover & piece confirmation',
    },
  ];

  if (isStopped) {
    steps.push({
      key: order.status,
      title: order.status === 'REJECTED' ? 'Not accepted' : 'Cancelled',
      detail: order.status === 'REJECTED' ? order.rejectionReason : order.cancelReason,
      time: times[order.status] ?? order.rejectedAt ?? order.cancelledAt,
      state: 'stop',
      icon: 'x',
    });
  }

  const label = isStopped ? 'Stopped' : isDelivered ? 'Step 5 of 5' : `Step ${currentStep} of 5`;

  return {
    stepIndex: currentStep,
    totalSteps: 5,
    label,
    steps,
  };
}

export const STEP_PALETTES: Record<
  string,
  {
    base: string;
    dark: string;
    light: string;
    border: string;
    line: string;
  }
> = {
  COLLECTED: {
    base: '#F97316', // Sunset Orange / Amber
    dark: '#C2410C',
    light: '#FFF7ED',
    border: '#FED7AA',
    line: '#F97316',
  },
  WASHING_DRYING: {
    base: '#0284C7', // Fresh Ocean Blue
    dark: '#0369A1',
    light: '#F0F9FF',
    border: '#BAE6FD',
    line: '#0284C7',
  },
  IRONING_PACKING: {
    base: '#8B5CF6', // Steam Violet / Royal Purple
    dark: '#6D28D9',
    light: '#F5F3FF',
    border: '#DDD6FE',
    line: '#8B5CF6',
  },
  OUT_FOR_DELIVERY: {
    base: '#E5A100', // Golden Sun Yellow / Transit Amber
    dark: '#9A6700',
    light: '#FFFBEA',
    border: '#FDE68A',
    line: '#E5A100',
  },
  DELIVERED: {
    base: '#10B981', // Emerald Success Green
    dark: '#047857',
    light: '#ECFDF5',
    border: '#A7F3D0',
    line: '#10B981',
  },
};

const DEFAULT_PALETTE = {
  base: colors.navy,
  dark: '#0A1C3E',
  light: '#F4F2EE',
  border: '#E8E4DA',
  line: colors.navy,
};

const STOP_PALETTE = {
  base: colors.danger,
  dark: '#B91C1C',
  light: '#FEF2F2',
  border: '#FECACA',
  line: colors.danger,
};

export function OrderTimeline({ order, state }: { order: LaundryOrder; state?: MockState | null }) {
  const { steps } = get5StepJourney(order, state);

  return (
    <View accessibilityRole="list">
      {steps.map((r, i) => {
        const last = i === steps.length - 1;
        const isLineDone = r.state === 'done' && steps[i + 1]?.state !== 'next';
        const pal = r.state === 'stop' ? STOP_PALETTE : (STEP_PALETTES[r.key] ?? DEFAULT_PALETTE);

        return (
          <View
            key={r.key}
            style={styles.row}
            accessible
            accessibilityLabel={`${r.title}${
              r.state === 'done'
                ? ', done'
                : r.state === 'now'
                  ? ', current step'
                  : r.state === 'stop'
                    ? ''
                    : ', upcoming'
            }${r.time ? `, ${when(r.time)}` : ''}`}
          >
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  r.state === 'done' && {
                    backgroundColor: pal.base,
                    ...(Platform.OS === 'web'
                      ? ({ boxShadow: `0 3px 8px ${pal.base}36` } as object)
                      : { shadowColor: pal.base, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 2 }),
                  },
                  r.state === 'now' && {
                    backgroundColor: pal.base,
                    borderWidth: 3.5,
                    borderColor: pal.light,
                    width: DOT + 4,
                    height: DOT + 4,
                    borderRadius: (DOT + 4) / 2,
                    marginHorizontal: -2,
                    ...(Platform.OS === 'web'
                      ? ({ boxShadow: `0 4px 12px ${pal.base}50` } as object)
                      : { shadowColor: pal.base, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 3 }),
                  },
                  r.state === 'next' && {
                    backgroundColor: pal.light,
                    borderWidth: 1.5,
                    borderColor: pal.border,
                  },
                  r.state === 'stop' && styles.dotStop,
                ]}
              >
                <Icon
                  name={r.state === 'done' ? 'check' : r.icon}
                  size={r.state === 'done' ? 13 : 13}
                  color={r.state === 'next' ? pal.base : '#FFFFFF'}
                  strokeWidth={r.state === 'done' ? 2.8 : 2.4}
                />
              </View>
              {!last ? (
                <View
                  style={[
                    styles.line,
                    isLineDone && { backgroundColor: pal.line },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <View style={styles.titleWrap}>
                  <Text
                    style={[
                      styles.title,
                      r.state === 'next' && styles.titleNext,
                      r.state === 'now' && [styles.titleNow, { color: pal.dark }],
                      r.state === 'stop' && { color: colors.danger },
                    ]}
                  >
                    {r.title}
                  </Text>


                </View>
                {r.time ? <Text style={styles.time}>{when(r.time)}</Text> : null}
              </View>
              {r.state === 'stop' && r.detail ? (
                <Text style={[styles.detail, { color: colors.danger }]}>
                  {r.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT = 28;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: DOT },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotStop: {
    backgroundColor: colors.danger,
  },
  line: {
    width: 2.5,
    flex: 1,
    minHeight: 22,
    backgroundColor: '#EAE6DF',
    marginVertical: 4,
    borderRadius: 1.25,
  },
  body: {
    flex: 1,
    paddingBottom: 22,
    paddingTop: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
    alignItems: 'center',
    minHeight: 24,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: '#0A1C3E',
  },
  titleNow: {
    fontFamily: fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  titleNext: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.3,
    color: '#4B5565',
  },
  time: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    color: '#64748B',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  detail: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
    marginTop: 3,
  },
  detailNext: {
    fontFamily: fonts.medium,
    color: '#64748B',
  },
  nowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  nowChipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  nowChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  doneChip: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
