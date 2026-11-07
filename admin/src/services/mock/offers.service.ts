import type { AdminOffer, OfferStatus, ServiceId } from '@/types';
import { db, nextId, respond } from './db';

/** An offer's status follows its dates, so it can never say "Active" after it has ended. */
export function statusFromDates(validFrom: string, validUntil: string, today = new Date().toISOString().slice(0, 10)): OfferStatus {
  if (today < validFrom) return 'upcoming';
  if (today > validUntil) return 'expired';
  return 'active';
}

const byPosition = (a: AdminOffer, b: AdminOffer) => a.position - b.position;

function renumber() {
  db.offers.sort(byPosition).forEach((o, i) => (o.position = i + 1));
}

export function listOffers(): Promise<AdminOffer[]> {
  db.offers.forEach((o) => (o.status = statusFromDates(o.validFrom, o.validUntil)));
  return respond([...db.offers].sort(byPosition), 'offers');
}

export type OfferInput = {
  title: string;
  description: string;
  code: string;
  discountBadge: string;
  badgeLabel: string;
  validFrom: string;
  validUntil: string;
  eligibility: string;
  serviceIds: ServiceId[] | 'all';
  visible: boolean;
};

function fromInput(input: OfferInput) {
  const badge = input.discountBadge.trim().toUpperCase();
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    code: input.code.trim().toUpperCase(),
    discountBadge: badge,
    badgeLabel: input.badgeLabel.trim(),
    discountValue: badge,
    status: statusFromDates(input.validFrom, input.validUntil),
  };
}

export function isCodeTaken(code: string, exceptId?: string) {
  const c = code.trim().toUpperCase();
  return db.offers.some((o) => o.id !== exceptId && (o.code ?? '').toUpperCase() === c);
}

/** SIMULATED: adds the offer to the sample data, at the end of the list. */
export function createOffer(input: OfferInput): Promise<AdminOffer> {
  const offer: AdminOffer = { id: nextId(db.offers.map((o) => o.id), 'of-'), position: db.offers.length + 1, ...fromInput(input) };
  db.offers.push(offer);
  return respond(offer, '', 500);
}

/** SIMULATED */
export function updateOffer(id: string, input: OfferInput): Promise<AdminOffer> {
  const o = db.offers.find((x) => x.id === id);
  if (!o) return Promise.reject(new Error('Offer not found'));
  Object.assign(o, fromInput(input));
  return respond(o, '', 450);
}

/** SIMULATED */
export function setOfferVisible(id: string, visible: boolean): Promise<AdminOffer> {
  const o = db.offers.find((x) => x.id === id);
  if (!o) return Promise.reject(new Error('Offer not found'));
  o.visible = visible;
  return respond(o, '', 300);
}

/** SIMULATED: swaps the offer with its neighbour. */
export function moveOffer(id: string, direction: -1 | 1): Promise<AdminOffer[]> {
  renumber();
  const list = [...db.offers].sort(byPosition);
  const i = list.findIndex((o) => o.id === id);
  const j = i + direction;
  if (i >= 0 && j >= 0 && j < list.length) {
    const p = list[i].position;
    list[i].position = list[j].position;
    list[j].position = p;
  }
  return respond([...db.offers].sort(byPosition), '', 250);
}

/** SIMULATED: removes the offer. If Home's promo card pointed at it, the promo moves to the first offer. */
export function deleteOffer(id: string): Promise<void> {
  db.offers = db.offers.filter((o) => o.id !== id);
  renumber();
  if (db.homepage.promo.offerId === id && db.offers[0]) db.homepage.promo.offerId = db.offers[0].id;
  return respond(undefined, '', 400);
}
