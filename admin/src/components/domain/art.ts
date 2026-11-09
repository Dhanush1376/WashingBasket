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
import blanket from '@customer-assets/services/blanket.png';
import colorDye from '@customer-assets/services/color dye.png';
import dryClean from '@customer-assets/services/dry clean.png';
import shoesBags from '@customer-assets/services/shoes, bags and soft toys.png';
import stainTreatment from '@customer-assets/services/stain treatment.png';

export const ART: Record<string, string> = {
  collecting,
  delivery,
  drying,
  ironing,
  packing,
  washing,
  steam,
  emptyWash,
  detailsDrying,
  blanket,
  colorDye,
  dye: colorDye,
  dryClean,
  'dry-clean': dryClean,
  shoesBags,
  'shoes-bags': shoesBags,
  stainTreatment,
  stain: stainTreatment,
};

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
  blanket: '#FDC506',
  colorDye: '#FDFDFD',
  dye: '#FDFDFD',
  dryClean: '#052E6E',
  'dry-clean': '#052E6E',
  shoesBags: '#F64309',
  'shoes-bags': '#F64309',
  stainTreatment: '#FDC209',
  stain: '#FDC209',
};

export const ART_CHOICES: { key: string; label: string }[] = [
  { key: 'blanket', label: 'Blanket' },
  { key: 'colorDye', label: 'Colour Dye' },
  { key: 'dryClean', label: 'Dry Clean' },
  { key: 'shoesBags', label: 'Shoes, Bags & Soft Toys' },
  { key: 'stainTreatment', label: 'Stain Treatment' },
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
