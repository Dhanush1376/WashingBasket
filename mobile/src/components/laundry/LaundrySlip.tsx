import React, { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

import { money } from '../../lib/format';
import type { LaundryOrder, OrderLine } from '../../mock/types';
import { fonts } from '../../theme';
import { Icon } from '../app/Icon';
import { QrCode } from './QrCode';

/* Paper and print. Flat colours only. */
const PAPER = '#F4ECD8'; // warm receipt cream, clearly darker than the white drawer
const PAPER_EDGE = 'rgba(92, 70, 30, 0.30)'; // fine cut line along the sides and teeth
const TOOTH_SHADOW = 'rgba(40, 28, 8, 0.16)';
const EDGE_PAD = 3;
const PRINT = '#26231F'; // thermal-printer black, a touch warm
const PRINT_SOFT = '#6B655B';
const RULE = '#D9E1EC'; // pale blue ruling
const MARGIN = '#EBB3BB'; // the faint red margin line of a ruled pad

const TOOTH_W = 14;
const TOOTH_H = 9;

/** Small, stable pseudo-random numbers from a string, so a slip looks the same every time it's drawn. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** A zig-zag edge, as if torn off a roll along its perforation. `flip` points the teeth down (the bottom edge). */
function TornEdge({ width, flip }: { width: number; flip?: boolean }) {
  // whole teeth only, so the edge ends cleanly at both sides: \/\/\/\/
  const n = Math.max(1, Math.round(width / TOOTH_W));
  const tw = width / n;
  const H = TOOTH_H + EDGE_PAD; // svg height: teeth plus room for their shadow
  const base = flip ? 0 : H; // the side that joins the paper
  const tip = flip ? TOOTH_H : EDGE_PAD;
  const zig: string[] = [];
  for (let i = 0; i <= n; i++) {
    zig.push(`${(i * tw).toFixed(2)},${base}`);
    if (i < n) zig.push(`${(i * tw + tw / 2).toFixed(2)},${tip}`);
  }
  const body = `${zig.join(' ')}`;
  return (
    <Svg width={width} height={H} style={flip ? styles.edgeBottom : styles.edgeTop}>
      {/* the teeth's shadow, the paper, then a fine cut line along the teeth */}
      <Polygon points={body} fill={TOOTH_SHADOW} transform={flip ? 'translate(0, 2.5)' : 'translate(0, -2)'} />
      <Polygon points={body} fill={PAPER} />
      <Polyline points={body} fill="none" stroke={PAPER_EDGE} strokeWidth={1} strokeLinejoin="miter" />
    </Svg>
  );
}

/** Specks and fibres, very faint, so the slip reads as paper rather than a white card. */
const PaperGrain = memo(function PaperGrain({ width, height, seed }: { width: number; height: number; seed: string }) {
  const marks = useMemo(() => {
    const r = seeded(seed);
    const specks = Array.from({ length: Math.round((width * height) / 1400) }, () => ({
      x: r() * width,
      y: r() * height,
      s: 0.35 + r() * 0.75,
      o: 0.04 + r() * 0.09,
    }));
    const fibres = Array.from({ length: Math.round(height / 22) }, () => {
      const x = r() * width;
      const y = r() * height;
      const len = 6 + r() * 16;
      const a = (r() - 0.5) * 0.9;
      return { x1: x, y1: y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, o: 0.04 + r() * 0.05 };
    });
    return { specks, fibres };
  }, [width, height, seed]);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {marks.fibres.map((f, i) => (
        <Line key={`f${i}`} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke="#8A7550" strokeOpacity={f.o} strokeWidth={0.6} />
      ))}
      {marks.specks.map((p, i) => (
        <Circle key={`s${i}`} cx={p.x} cy={p.y} r={p.s} fill="#5C4A2A" fillOpacity={p.o} />
      ))}
    </Svg>
  );
});

const QR_SIZE = 84;

/** The order's QR, small, beside the foot of the slip. Before payment a faded decoy sits under a lock, never the real code. */
function SmallQr({ qr, orderId }: { qr: SlipQr; orderId: string }) {
  const decoy = `WASHING-BASKET-LOCKED-${orderId}`;
  return (
    <View style={styles.qrBox} accessible accessibilityLabel={qr.locked ? 'QR code, locked until payment' : `QR code for order ${orderId}`}>
      <View style={qr.locked ? styles.qrFaded : null}>
        <QrCode value={qr.locked ? decoy : qr.payload} size={QR_SIZE} color={PRINT} bg="#FFFFFF" />
      </View>
      {qr.locked ? (
        <View style={styles.qrLock}>
          <Icon name="lock" size={16} color="#FFFFFF" strokeWidth={2.3} />
        </View>
      ) : null}
    </View>
  );
}

/** A printed quantity, right-aligned in the QTY column. */
const Qty = ({ n }: { n: number }) => <Text style={styles.qty}>{n}</Text>;

export type SlipQr = { payload: string; code: string; locked: boolean };

/** A printed dashed rule (drawn, not typed, so it never wraps or ellipsizes). */
const Dash = () => (
  <View style={styles.dash}>
    {Array.from({ length: 60 }, (_, i) => (
      <View key={i} style={styles.dashSeg} />
    ))}
  </View>
);
const DoubleRule = () => <View style={styles.doubleRule} />;

function Field({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldKey}>{k}</Text>
      <Text style={styles.fieldVal} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');
function printedDate(iso: string) {
  const d = new Date(iso);
  const mon = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
  return `${pad2(d.getDate())} ${mon} ${d.getFullYear()}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const unitShort = (u: OrderLine['unit']) => (u === 'kg' ? 'KG' : u === 'pair' ? 'PAIR' : 'PC');

/**
 * The laundry slip for an order, drawn like a real torn-off printed paper slip, with the order's QR at the foot.
 * Staff count the clothes against it, so it stays plain and legible.
 */
export function LaundrySlip({
  order,
  placeName,
  customerName,
  modeLabel,
  chargeLabel,
  qr,
}: {
  order: LaundryOrder;
  /** The order's drop-off / pickup QR, printed at the foot. Blurred and locked until the order is paid. */
  qr?: SlipQr;
  placeName?: string;
  customerName?: string;
  modeLabel?: string;
  chargeLabel?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };
  const pieces = order.lines.reduce((n, l) => n + (l.garments ? l.garments.reduce((s, g) => s + g.qty, 0) : l.unit === 'kg' ? 0 : l.qty), 0);

  return (
    <View style={styles.wrap} accessibilityLabel={`Laundry slip for order ${order.id}`}>
      <View style={styles.paper} onLayout={onLayout}>
        {size.w > 0 ? <PaperGrain width={size.w} height={size.h} seed={order.id} /> : null}

        {/* printed header */}
        <Text style={styles.brand}>WASHING BASKET</Text>
        <Text style={styles.tagline}>LAUNDRY · DRY CLEAN · CARE</Text>
        {placeName ? <Text style={styles.place}>{placeName}</Text> : null}
        <Dash />
        <Field k="ORDER" v={order.id} />
        <Field k="DATE" v={printedDate(order.createdAt)} />
        {modeLabel ? <Field k="MODE" v={modeLabel.toUpperCase()} /> : null}
        {customerName ? <Field k="NAME" v={customerName.toUpperCase()} /> : null}
        <DoubleRule />

        <View style={styles.colHead}>
          <Text style={styles.colHeadText}>ITEM</Text>
          <Text style={styles.colHeadText}>QTY</Text>
        </View>

        {/* ruled item table with the pad's red margin line */}
        <View style={styles.table}>
          <View style={styles.margin} />
          {order.lines.map((l) => (
            <View key={l.itemId} style={styles.service}>
              <View style={styles.serviceHead}>
                <Text style={styles.serviceName}>
                  {l.categoryName.toUpperCase()} · {l.name.toUpperCase()}
                </Text>
                <Text style={styles.serviceRate}>
                  {money(l.unitPrice)}/{unitShort(l.unit)}
                </Text>
              </View>
              {l.garments?.length ? (
                l.garments.map((g) => (
                  <View key={g.garmentId} style={styles.ruled}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {g.name}
                    </Text>
                    <View style={styles.qtyCell}>
                      <Qty n={g.qty} />
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.ruled}>
                  <Text style={styles.itemName}>{l.name}</Text>
                  <View style={styles.qtyCell}>
                    <Qty n={l.qty} />
                  </View>
                </View>
              )}
              <View style={styles.lineFoot}>
                <Text style={styles.lineFootText}>
                  {l.unit === 'kg' ? `EST. ${l.qty} KG × ${money(l.unitPrice)}` : `${l.qty} × ${money(l.unitPrice)}`}
                </Text>
                <Text style={styles.lineAmount}>{money(l.amount)}</Text>
              </View>
            </View>
          ))}
        </View>

        <DoubleRule />
        <View style={[styles.totalRow, styles.piecesRow]}>
          <Text style={styles.totalKey}>TOTAL PIECES</Text>
          <Text style={styles.piecesVal}>{pieces}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalKey}>SUBTOTAL</Text>
          <Text style={styles.totalVal}>{money(order.subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalKey}>{(order.serviceMode === 'HOME_PICKUP' && chargeLabel ? chargeLabel : 'Service charge').toUpperCase()}</Text>
          <Text style={styles.totalVal}>{order.serviceCharge ? money(order.serviceCharge) : 'FREE'}</Text>
        </View>
        {order.discount ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>DISCOUNT</Text>
            <Text style={styles.totalVal}>−{money(order.discount)}</Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandKey}>TOTAL</Text>
          <Text style={styles.grandVal}>{money(order.total)}</Text>
        </View>
        {order.lines.some((l) => l.unit === 'kg') ? <Text style={styles.note}>* PER-KG SERVICES ARE WEIGHED AT THE COUNTER.</Text> : null}
        <Dash />
        <View style={styles.footRow}>
          <View style={styles.flex}>
            {qr ? <Text style={styles.qrTitle}>{order.serviceMode === 'HOME_PICKUP' ? 'PICKUP QR' : 'DROP-OFF QR'}</Text> : null}
            {qr ? <Text style={styles.qrCode}>{qr.locked ? 'LOCKED UNTIL PAID' : qr.code}</Text> : null}
            <Text style={styles.barcodeText}>{order.id}</Text>
            <Text style={styles.thanks}>SHOW THIS SLIP AT THE COUNTER. THANK YOU!</Text>
          </View>
          {qr ? <SmallQr qr={qr} orderId={order.id} /> : null}
        </View>
      </View>
      {size.w > 0 ? <TornEdge width={size.w} flip /> : null}
    </View>
  );
}

const MONO = fonts.mono;
const MONO_B = fonts.monoBold;

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  edgeTop: { marginBottom: -1 },
  edgeBottom: { marginTop: -1 },
  paper: {
    backgroundColor: PAPER,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PAPER_EDGE,
  },

  brand: { fontFamily: MONO_B, fontSize: 16, letterSpacing: 2.5, color: PRINT, textAlign: 'center' },
  tagline: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.2, color: PRINT_SOFT, textAlign: 'center', marginTop: 2 },
  place: { fontFamily: MONO, fontSize: 11, color: PRINT, textAlign: 'center', marginTop: 4 },
  dash: { flexDirection: 'row', gap: 4, overflow: 'hidden', marginVertical: 8 },
  dashSeg: { width: 5, height: 1, backgroundColor: PRINT_SOFT, flexShrink: 0 },
  doubleRule: { height: 4, borderTopWidth: 1, borderBottomWidth: 1, borderColor: PRINT, marginVertical: 7, opacity: 0.85 },

  field: { flexDirection: 'row', paddingVertical: 1 },
  fieldKey: { fontFamily: MONO, fontSize: 11.5, color: PRINT_SOFT, width: 52 },
  fieldVal: { fontFamily: MONO_B, fontSize: 11.5, color: PRINT, flex: 1 },

  colHead: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 14, paddingBottom: 3 },
  colHeadText: { fontFamily: MONO_B, fontSize: 10.5, letterSpacing: 1.2, color: PRINT_SOFT },

  table: { position: 'relative', borderTopWidth: 1, borderTopColor: RULE },
  margin: { position: 'absolute', left: 6, top: 0, bottom: 0, width: 1, backgroundColor: MARGIN },
  service: { paddingLeft: 14 },
  serviceHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, paddingTop: 7, paddingBottom: 2 },
  serviceName: { fontFamily: MONO_B, fontSize: 11, color: PRINT, flex: 1 },
  serviceRate: { fontFamily: MONO, fontSize: 10.5, color: PRINT_SOFT },
  ruled: { flexDirection: 'row', alignItems: 'center', minHeight: 30, borderBottomWidth: 1, borderBottomColor: RULE },
  itemName: { fontFamily: MONO, fontSize: 12.5, color: PRINT, flex: 1, paddingRight: 8 },
  qtyCell: { width: 40, alignItems: 'flex-end', justifyContent: 'center' },
  qty: { fontFamily: MONO_B, fontSize: 13.5, color: PRINT, textAlign: 'right', alignSelf: 'stretch', textAlignVertical: 'center', lineHeight: 30 },
  piecesVal: { fontFamily: MONO_B, fontSize: 13.5, color: PRINT },
  lineFoot: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: RULE },
  lineFootText: { fontFamily: MONO, fontSize: 10.5, color: PRINT_SOFT },
  lineAmount: { fontFamily: MONO_B, fontSize: 11.5, color: PRINT },

  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 1 },
  piecesRow: { minHeight: 24 },
  totalKey: { fontFamily: MONO, fontSize: 11.5, color: PRINT_SOFT, flexShrink: 1 },
  totalVal: { fontFamily: MONO_B, fontSize: 11.5, color: PRINT },
  grandRow: { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: PRINT },
  grandKey: { fontFamily: MONO_B, fontSize: 14, letterSpacing: 1.5, color: PRINT },
  grandVal: { fontFamily: MONO_B, fontSize: 15, color: PRINT },
  note: { fontFamily: MONO, fontSize: 9.5, color: PRINT_SOFT, marginTop: 5 },

  flex: { flex: 1 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qrTitle: { fontFamily: MONO_B, fontSize: 10.5, letterSpacing: 1.5, color: PRINT_SOFT },
  qrCode: { fontFamily: MONO_B, fontSize: 13, letterSpacing: 1, color: PRINT, marginTop: 2 },
  barcodeText: { fontFamily: MONO, fontSize: 11, color: PRINT, marginTop: 4, letterSpacing: 1 },
  thanks: { fontFamily: MONO, fontSize: 9.5, lineHeight: 13, color: PRINT_SOFT, marginTop: 4 },
  qrBox: { width: QR_SIZE + 10, height: QR_SIZE + 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: RULE, alignItems: 'center', justifyContent: 'center' },
  qrFaded: { opacity: 0.18 },
  qrLock: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: PRINT, alignItems: 'center', justifyContent: 'center' },
});
