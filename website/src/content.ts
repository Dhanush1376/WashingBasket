/**
 * Everything the page says and shows. Every fact comes from the app itself: its screens, and its own
 * data (mobile/src/mock-data: services.json, price-menu.json, faq.json, pickup-slots.json, offers.json,
 * support.json). No invented history, numbers, awards, testimonials or social accounts.
 */
import artCollect from './assets/art-collect.webp';
import artDeliver from './assets/art-deliver.webp';
import artDry from './assets/art-dry.webp';
import artIron from './assets/art-iron.webp';
import artWash from './assets/art-wash.webp';
import campusLpu from './assets/campus-lpu.webp';
import campusNitj from './assets/campus-nitj.webp';
import illDelivered from './assets/ill-delivered.webp';
import illWorried from './assets/ill-worried.webp';
import screenCheckout from './assets/screen-checkout.webp';
import screenHome from './assets/screen-home.webp';
import screenItems from './assets/screen-items.webp';
import screenOffers from './assets/screen-offers.webp';
import screenOrders from './assets/screen-orders.webp';
import screenProfile from './assets/screen-profile.webp';
import screenQr from './assets/screen-qr.webp';
import screenTrack from './assets/screen-track.webp';
import screenWallet from './assets/screen-wallet.webp';

export const SCREEN = {
  home: screenHome,
  items: screenItems,
  checkout: screenCheckout,
  qr: screenQr,
  track: screenTrack,
  wallet: screenWallet,
  offers: screenOffers,
  orders: screenOrders,
  profile: screenProfile,
};
export const CAMPUS = { lpu: campusLpu, nitj: campusNitj };

export const NAV = [
  { id: 'top', label: 'Home' },
  { id: 'story', label: 'Story' },
  { id: 'app', label: 'The app' },
  { id: 'how', label: 'How it works' },
] as const;

export const HERO = {
  title: ['Clean clothes,', 'without the', 'laundry day.'],
  body: 'Washing Basket collects your laundry at your door or a campus counter, washes, dries and irons it with care, and brings it back. Booked and followed in one app.',
  /** The hero's three scenes: the card's plate and colour. */
  slides: [
    { word: 'Collect', color: '#fc4c13' },
    { word: 'Care', color: '#fe6900' },
    { word: 'Return', color: '#fdce03' },
  ],
  quick: ['Only Wash', 'Wash & Iron', 'Dry Clean', 'Shoes & Bags', 'Blankets'],
};

export const STORY = {
  label: 'Why Washing Basket exists',
  text: "Campus life is full. Lectures, labs, deadlines, plans, practice, and somewhere in between, the laundry that should never have been yours to worry about.",
  title: ['Campus life is full.', 'Laundry should be simple.'],
  words: ['Lectures.', 'Labs.', 'Deadlines.', 'Plans.'],
  aside: 'Laundry care built around campus life: book in a minute, hand over your basket, and get on with your week.',
  img: illWorried,
};

/** The brand moment after the story: three words of what the service does, then the name. */
export const BRAND = {
  bands: ['Collected.', 'Cleaned.', 'Returned.'],
  name: 'Washing Basket',
  body: [
    '- Laundry collected, cared for and brought back,',
    'at LPU, NIT Jalandhar and Model Town.',
  ],
};

/** The services, their real lead prices and turnarounds (services.json, price-menu.json). */
export const SERVICES = {
  label: 'Services',
  title: ['Seven services,', 'one basket.'],
  body: 'From everyday wash and fold to blankets and occasion wear. Prices start from the amounts below and are shown in full in the app before you book.',
  items: [
    { name: 'Only Wash', note: 'Normal, Ezee or whites-only wash, dried and folded.', time: '48 hours', price: '₹45', unit: 'kg' },
    { name: 'Wash & Iron', note: 'Washed, dried and pressed, priced by weight.', time: '48 hours', price: '₹55', unit: 'kg' },
    { name: 'Dry Clean', note: 'Basic or premium, for suits, silks and occasion wear.', time: '72 hours', price: '₹100', unit: 'piece' },
    { name: 'Blanket', note: 'Single and double, washed or dry cleaned.', time: '72 hours', price: '₹150', unit: 'piece' },
    { name: 'Shoes, Bags & Soft Toys', note: 'By machine, by hand, or a deep clean.', time: '72 hours', price: '₹70', unit: 'pair' },
    { name: 'Stain Treatment', note: 'Targeted care for whites and colours.', time: '72 hours', price: '₹70', unit: 'piece' },
    { name: 'Colour Dye', note: 'Basic or premium, to bring faded clothes back.', time: '5 days', price: '₹150', unit: 'piece' },
  ],
};

/** The care journey, told with the brand's illustration plates. */
export const CARE = {
  label: 'How your laundry is cared for',
  title: ['Five careful steps,', 'every single order.'],
  promise: { label: 'Our quality promise', body: 'Hygiene, fabric care and professional handling.' },
  steps: [
    { word: 'Collect', body: 'Your basket is taken in at a campus counter or at your door, and every piece is counted.', img: artCollect, alt: 'A customer hands a laundry bag to a Washing Basket partner' },
    { word: 'Wash', body: 'Washed the way you chose: a normal wash, Ezee, or whites only.', img: artWash, alt: 'A team member washing clothes in a tub of suds' },
    { word: 'Dry', body: 'Dried right through, never rushed, so every piece comes back fresh.', img: artDry, alt: 'Fresh laundry hung up to dry on a line' },
    { word: 'Iron', body: 'Steam pressed, neatly folded and packed for the trip back.', img: artIron, alt: 'A shirt being steam ironed beside folded clothes' },
    { word: 'Return', body: 'Handed back at the counter or brought to your door, checked piece by piece.', img: artDeliver, alt: 'A partner hands a stack of folded clothes back to a customer' },
  ],
};

export const HANDOVER = {
  label: 'Collection and return',
  title: ['Two ways to hand', 'your laundry over.'],
  img: illDelivered,
  ways: [
    { name: 'Doorstep pickup', body: 'A partner collects your basket at your door during your two-hour slot and returns it clean.' },
    { name: 'Campus counters', body: 'Drop off at the campus counter anytime it is open. Counted in front of you with a single QR.' },
  ],
  campuses: [
    { name: 'Lovely Professional University', short: 'LPU', img: campusLpu },
    { name: 'NIT Jalandhar', short: 'NITJ', img: campusNitj },
  ],
};

/** The app, screen by screen. */
export const APP = {
  label: 'The app',
  title: ['The whole service,', 'in your pocket.'],
  body: 'Booking, paying, and tracking, all in one calm app.',
  screens: [
    { src: screenWallet, name: 'Wallet', note: 'Top up once and pay in a tap.' },
    { src: screenOffers, name: 'Offers', note: 'Live codes, applied at checkout.' },
    { src: screenHome, name: 'Home', note: 'Your active order and next pickup.' },
    { src: screenOrders, name: 'Orders', note: 'Every order and its progress.' },
    { src: screenProfile, name: 'Profile', note: 'Addresses, referrals and support.' },
  ],
};

/** The booking journey, start to finish (every fact from the app: services, slots, QR handover, tracking, payment). */
export const BOOKING = {
  label: 'The Washing Basket experience',
  title: ['From your doorstep', 'to freshly cleaned.'],
  body: 'Five simple steps. One effortless laundry experience. Book your pickup and leave the rest to us.',
  steps: [
    { title: 'Choose your services', body: 'Washing, ironing, dry cleaning or specialty care.', screen: screenItems },
    { title: 'Schedule a pickup', body: 'Pick a date, a time slot and your address.', screen: screenCheckout },
    { title: 'Hand over your basket', body: 'At your door, or at the campus counter.', screen: screenQr },
    { title: 'Track your laundry', body: 'Every stage, live in the app.', screen: screenTrack },
    { title: 'Pay & receive', body: 'UPI, wallet or card. Back to you, fresh.', screen: screenWallet },
  ],
};

/** The real offers from the app (offers.json), in the app's ticket colours. */
export type Offer = {
  code: string;
  big: string;
  small: string;
  badge: string;
  title: string;
  body: string;
  validity: string;
  status: 'active' | 'upcoming' | 'expired';
  paper: string;
  stub: string;
  ink?: string;
};

export const OFFERS: { label: string; title: string[]; body: string; items: Offer[] } = {
  label: 'Offers',
  title: ['A little extra,', 'every season.'],
  body: 'Live in the app. Copy a code, apply it at checkout, and the saving shows on your bill.',
  items: [
    { code: 'FIRSTWASH', big: '20%', small: 'OFF', badge: 'Limited offer', title: 'Flat 20% off', body: 'On your first 3 laundry pickups.', validity: 'Till 31 Dec', status: 'active', paper: '#FF6F3C', stub: '#E05322', ink: '#FFFFFF' },
    { code: 'FREEDEL', big: 'FREE', small: 'DELIVERY', badge: 'Best value', title: 'Free doorstep delivery', body: 'No delivery fee on any order of ₹499 or more.', validity: 'Till 31 Dec', status: 'active', paper: '#013E86', stub: '#002A5C', ink: '#FFFFFF' },
    { code: 'CLEAN15', big: '15%', small: 'OFF', badge: 'Popular deal', title: '15% off dry cleaning', body: 'Valid on dry cleaning orders this month.', validity: 'Till 30 Nov', status: 'active', paper: '#FEC837', stub: '#EFB21C', ink: '#0A1C3E' },
    { code: 'WINTER10', big: '10%', small: 'OFF', badge: 'Coming soon', title: 'Winter bedding care', body: '10% off blankets, quilts and woollens.', validity: 'From 1 Dec', status: 'upcoming', paper: '#D30D24', stub: '#A80A1C', ink: '#FFFFFF' },
    { code: 'MONSOON', big: 'EXTRA', small: 'CARE', badge: 'Past offer', title: 'Monsoon fresh', body: 'Extra drying care during the monsoon.', validity: 'Ended 31 Aug', status: 'expired', paper: '#FEDB7D', stub: '#F7C35D', ink: '#012A5C' },
  ],
};

export const DOWNLOAD = {
  label: 'Get the app',
  title: ['Your next laundry day', 'starts with a tap.'],
  body: 'Washing Basket is on its way to Google Play and the App Store.',
};

/** From the app's Support screen (support.json). */
export const CONTACT = {
  phone: '+91 80 4718 2020',
  email: 'care@washingbasket.example',
  hours: '8 AM – 9 PM, every day',
};
