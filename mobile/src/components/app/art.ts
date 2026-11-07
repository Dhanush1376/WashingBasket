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
