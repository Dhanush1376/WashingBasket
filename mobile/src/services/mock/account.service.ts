/** Profile, addresses, wallet, offers and referrals. */
import type { Address, AddressLabel, AppliedReferral, Offer, ReferralCodeRules, ReferralProgram, User, WalletConfig, WalletTxn } from '../../types/models';
import { getActiveCustomer } from '../../laundry/activeCustomer';
import * as laundryWallet from '../../mock/services/walletService';
import { db, newest, nextId, respond } from './db';

export function getUser(): Promise<User> {
  return respond(db.user);
}

/** SIMULATED: updates the in-memory mock only. */
export function updateUser(patch: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
  Object.assign(db.user, patch);
  return respond(db.user, 500);
}

export function getAddresses(): Promise<Address[]> {
  return respond(db.addresses);
}

export type AddressInput = { label: AddressLabel; line1: string; line2: string; city: string; pincode: string };

/** SIMULATED: updates the in-memory mock only. */
export function addAddress(input: AddressInput): Promise<Address> {
  const address: Address = { id: nextId(db.addresses.map((a) => a.id), 'a-'), isDefault: db.addresses.length === 0, ...input };
  db.addresses.push(address);
  return respond(address, 400);
}

/** SIMULATED: updates the in-memory mock only. */
export function setDefaultAddress(id: string): Promise<Address[]> {
  db.addresses.forEach((a) => (a.isDefault = a.id === id));
  return respond(db.addresses);
}

export type WalletSummary = { balance: number; pending: number; transactions: WalletTxn[]; config: WalletConfig };

/**
 * Balance is derived from completed transactions, so it can never disagree with the history.
 * A signed-in customer's wallet is their account in the laundry mock data (src/mock), the same transactions that
 * pay for orders and that the admin portal shows; guests see the sample wallet.
 */
export async function getWallet(): Promise<WalletSummary> {
  const customerId = getActiveCustomer();
  if (customerId) {
    const w = await laundryWallet.getWallet(customerId);
    return respond({ balance: w.balance, pending: w.pending, transactions: w.transactions, config: db.walletConfig });
  }
  const sign = (t: WalletTxn) => (t.type === 'debit' ? -t.amount : t.amount);
  const balance = db.wallet.filter((t) => t.status === 'completed').reduce((s, t) => s + sign(t), 0);
  const pending = db.wallet.filter((t) => t.status === 'pending').reduce((s, t) => s + sign(t), 0);
  const transactions = [...db.wallet].sort((a, b) => newest(a.date, b.date));
  return respond({ balance, pending, transactions, config: db.walletConfig });
}

/** Bonus credit a top-up of this amount earns under the wallet's bonus rule. */
export function topUpBonusFor(amount: number, config: WalletConfig): number {
  const { percent, minAmount } = config.topUpBonus;
  return amount >= minAmount ? Math.round((amount * percent) / 100) : 0;
}

/**
 * DEMO ONLY: no payment gateway is connected, so nothing is charged. This credits the mock wallet
 * so the flow can be tried end to end, and the entries are labelled as demo top-ups.
 */
export async function demoTopUp(amount: number): Promise<WalletSummary> {
  const now = new Date().toISOString();
  const bonus = topUpBonusFor(amount, db.walletConfig);
  const customerId = getActiveCustomer();
  if (customerId) {
    await laundryWallet.topUp(customerId, amount, bonus, db.walletConfig.topUpBonus.percent);
    return getWallet();
  }
  db.wallet.unshift({ id: nextId(db.wallet.map((t) => t.id), 'tx-'), type: 'credit', source: 'topup', amount, title: 'Top-up (demo, no charge)', date: now, status: 'completed' });
  if (bonus) {
    db.wallet.unshift({ id: nextId(db.wallet.map((t) => t.id), 'tx-'), type: 'credit', source: 'bonus', amount: bonus, title: `${db.walletConfig.topUpBonus.percent}% top-up bonus`, date: now, status: 'completed' });
  }
  return getWallet();
}

export function listOffers(): Promise<Offer[]> {
  const rank = { active: 0, upcoming: 1, expired: 2 } as const;
  return respond([...db.offers].sort((a, b) => rank[a.status] - rank[b.status]));
}

export type ReferralSummary = ReferralProgram & { code: string; earned: number; pending: number; rules: ReferralCodeRules };

export function getReferrals(): Promise<ReferralSummary> {
  const { history } = db.referrals;
  return respond({
    ...db.referrals,
    code: db.user.referralCode,
    rules: db.referralCodes.rules,
    earned: history.filter((r) => r.status === 'rewarded').reduce((s, r) => s + r.reward, 0),
    pending: history.filter((r) => r.status === 'joined').reduce((s, r) => s + r.reward, 0),
  });
}

/* ───────────── Using a friend's referral code ───────────── */

export type ReferralCodeProblem = 'format' | 'own' | 'already' | 'not_found';
export class ReferralCodeError extends Error {
  constructor(public problem: ReferralCodeProblem) {
    super(problem);
  }
}

/** Codes are compared without spaces and case, the way people type them from a message. */
export const normaliseReferralCode = (raw: string) => raw.replace(/\s+/g, '').toUpperCase();

function checkCode(raw: string): { code: string; owner: string } {
  const code = normaliseReferralCode(raw);
  const { minLength, maxLength } = db.referralCodes.rules;
  if (db.referrals.applied) throw new ReferralCodeError('already');
  if (code.length < minLength || code.length > maxLength || !/^[A-Z0-9]+$/.test(code)) throw new ReferralCodeError('format');
  if (code === db.user.referralCode) throw new ReferralCodeError('own');
  const match = db.referralCodes.codes.find((c) => c.code === code);
  if (!match) throw new ReferralCodeError('not_found');
  return match;
}

/** Looks a code up before it's used, so the customer can see whose code it is. Changes nothing. */
export async function lookupReferralCode(raw: string): Promise<{ code: string; owner: string }> {
  await respond(null, 450);
  return checkCode(raw);
}

/** SIMULATED: links the friend's code to this account in the in-memory mock only. No money moves now. */
export async function applyReferralCode(raw: string): Promise<AppliedReferral> {
  await respond(null, 700);
  const match = checkCode(raw);
  const applied: AppliedReferral = { code: match.code, owner: match.owner, appliedAt: new Date().toISOString() };
  db.referrals.applied = applied;
  return { ...applied };
}
