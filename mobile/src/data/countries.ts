export type Country = {
  iso: string;
  name: string;
  dialCode: string;
  /** Allowed national-number lengths. */
  lengths: number[];
  /** Digit groups used for display formatting, e.g. [5, 5] → 98765 43210. */
  groups: number[];
  pattern?: RegExp;
};

export const COUNTRIES: Country[] = [
  { iso: 'IN', name: 'India', dialCode: '+91', lengths: [10], groups: [5, 5], pattern: /^[1-9]/ },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971', lengths: [9], groups: [2, 3, 4], pattern: /^5/ },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '+966', lengths: [9], groups: [2, 3, 4], pattern: /^5/ },
  { iso: 'SG', name: 'Singapore', dialCode: '+65', lengths: [8], groups: [4, 4], pattern: /^[89]/ },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44', lengths: [10], groups: [4, 6], pattern: /^7/ },
  { iso: 'US', name: 'United States', dialCode: '+1', lengths: [10], groups: [3, 3, 4] },
  { iso: 'AU', name: 'Australia', dialCode: '+61', lengths: [9], groups: [3, 3, 3], pattern: /^4/ },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function formatNational(digits: string, country: Country): string {
  const clean = digits.replace(/^0+/, '');
  const parts: string[] = [];
  let i = 0;
  for (const g of country.groups) {
    if (i >= clean.length) break;
    parts.push(clean.slice(i, i + g));
    i += g;
  }
  if (i < clean.length) parts.push(clean.slice(i));
  return parts.join(' ');
}

export function maxDigits(country: Country) {
  return Math.max(...country.lengths);
}

/** Returns an error message, or null when the number is valid. */
export function validateNational(digits: string, country: Country): string | null {
  const clean = digits.replace(/^0+/, '');
  if (!clean) return 'Enter your mobile number to continue.';
  if (!country.lengths.includes(clean.length)) {
    return `Enter a ${country.lengths[0]}-digit mobile number.`;
  }
  if (country.pattern && !country.pattern.test(clean)) return "That doesn't look like a mobile number.";
  return null;
}

/**
 * The national digits after the user edits the formatted number field (`text` is what the field now shows, `prev`
 * the digits before the edit). Handles the cases a plain "keep the digits" filter gets wrong:
 * - Backspace over a group space ("98765 |43210"). That removes no digit, so the field would snap straight back
 *   and look stuck. Instead it deletes the digit before the space.
 * - A pasted or autofilled number with the country code ("+91 98765 43210", "0091…", "919876543210"). Without this,
 *   the code would be read as the first digits and the real number cut off.
 */
export function readNational(text: string, prev: string, country: Country): string {
  const max = maxDigits(country);
  const shown = formatNational(prev, country);
  let digits = text.replace(/\D/g, '');

  if (digits === prev && text.length < shown.length) {
    // a separator was deleted: find where, and drop the digit just before it
    let i = 0;
    while (i < text.length && text[i] === shown[i]) i++;
    const before = shown.slice(0, i).replace(/\D/g, '').length;
    return before > 0 ? prev.slice(0, before - 1) + prev.slice(before) : prev;
  }

  const code = country.dialCode.replace(/\D/g, '');
  if (digits.startsWith('00' + code) && digits.length > max) digits = digits.slice(2);
  if ((text.trim().startsWith('+') || digits.length > max) && digits.startsWith(code) && digits.length - code.length <= max) {
    digits = digits.slice(code.length);
  }
  return digits.replace(/^0+/, '').slice(0, max);
}
