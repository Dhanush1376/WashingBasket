import type { ImageSourcePropType } from 'react-native';

import type { OrderStatus } from '../../types/models';

/** The brand illustrations, by key (services.json refers to these keys). */
export const ART: Record<string, ImageSourcePropType> = {
  collecting: require('../../../assets/scenes/collecting.jpg'),
  washing: require('../../../assets/scenes/washing.jpg'),
  drying: require('../../../assets/scenes/drying.jpg'),
  ironing: require('../../../assets/scenes/ironing.jpg'),
  packing: require('../../../assets/scenes/packing.jpg'),
  delivery: require('../../../assets/scenes/delivery.jpg'),
  steam: require('../../../assets/illustrations/pincode-ironing.png'),
  unavailable: require('../../../assets/illustrations/unavailable-map-pin.png'),
  emptyWash: require('../../../assets/illustrations/otp-washing.png'),

  // Dedicated service illustrations
  blanket: require('../../../assets/services/blanket.png'),
  colorDye: require('../../../assets/services/color dye.png'),
  dye: require('../../../assets/services/color dye.png'),
  dryClean: require('../../../assets/services/dry clean.png'),
  'dry-clean': require('../../../assets/services/dry clean.png'),
  shoesBags: require('../../../assets/services/shoes, bags and soft toys.png'),
  'shoes-bags': require('../../../assets/services/shoes, bags and soft toys.png'),
  stainTreatment: require('../../../assets/services/stain treatment.png'),
  stain: require('../../../assets/services/stain treatment.png'),
};

/** Background behind each illustration, so a card can bleed into its picture. */
export const ART_TINT: Record<string, string> = {
  collecting: '#FC4C15',
  washing: '#FD6801',
  drying: '#FDAA04',
  ironing: '#FDC403',
  packing: '#013888',
  delivery: '#FDCE04',
  steam: '#FFFFFF',

  // Service tints matching artwork backgrounds
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

/** The illustration that best shows each stage of the journey. */
export const STAGE_ART: Record<OrderStatus, string> = {
  collected: 'collecting',
  washing_drying: 'washing',
  ironing_packing: 'ironing',
  out_for_delivery: 'delivery',
  delivered: 'delivery',
  pickup_scheduled: 'collecting',
  washing: 'washing',
  drying: 'drying',
  ironing: 'ironing',
  packing: 'packing',
  cancelled: 'collecting',
};
