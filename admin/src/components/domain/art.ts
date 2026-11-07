/** The customer app's own illustrations (mobile/assets), by the same keys services.json and the home page use. */
import collecting from '@customer-assets/scenes/collecting.jpg';
import delivery from '@customer-assets/scenes/delivery.jpg';
import drying from '@customer-assets/scenes/drying.jpg';
import ironing from '@customer-assets/scenes/ironing.jpg';
import packing from '@customer-assets/scenes/packing.jpg';
import washing from '@customer-assets/scenes/washing.jpg';
import steam from '@customer-assets/illustrations/pincode-ironing.png';
import emptyWash from '@customer-assets/illustrations/otp-washing.png';
import detailsDrying from '@customer-assets/illustrations/details-drying.png';

export const ART: Record<string, string> = { collecting, delivery, drying, ironing, packing, washing, steam, emptyWash, detailsDrying };

/** Background behind each illustration (from mobile/src/components/app/art.ts), so a card can bleed into its picture. */
export const ART_TINT: Record<string, string> = {
  collecting: '#FC4C15',
  washing: '#FD6801',
  drying: '#FDAA04',
  ironing: '#FDC403',
  packing: '#013888',
  delivery: '#FDCE04',
  steam: '#FFFFFF',
  emptyWash: '#FFFFFF',
  detailsDrying: '#FFFFFF',
};

export const ART_CHOICES: { key: string; label: string }[] = [
  { key: 'steam', label: 'Ironing (white)' },
  { key: 'emptyWash', label: 'Washing (white)' },
  { key: 'detailsDrying', label: 'Drying (white)' },
  { key: 'collecting', label: 'Collecting' },
  { key: 'washing', label: 'Washing' },
  { key: 'drying', label: 'Drying' },
  { key: 'ironing', label: 'Ironing' },
  { key: 'packing', label: 'Packing' },
  { key: 'delivery', label: 'Delivery' },
];
