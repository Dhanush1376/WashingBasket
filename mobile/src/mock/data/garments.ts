/**
 * The garment catalogue: every kind of clothing a customer can list in an order, grouped the way people sort
 * their laundry, plus which garments each service takes.
 *
 * MOCK DATA, but real and structured: plain TypeScript with no React Native imports, so the admin portal and a
 * future backend can read the same list. Prices stay on the price list (priceList.json); a garment never has a
 * price of its own. For a per-kg service the garments only give an estimated weight (`weightKg`, a typical dry
 * weight) that staff replace with the real weight at the counter. For a per-piece or per-pair service each
 * garment counts as one piece or pair.
 */
import type { GarmentIcon } from '../types.ts';

export type GarmentGroupId =
  | 'topwear'
  | 'bottomwear'
  | 'ethnic'
  | 'winter'
  | 'innerwear'
  | 'linen'
  | 'footwear'
  | 'bags'
  | 'toys'
  | 'bedding';

export type GarmentGroup = { id: GarmentGroupId; name: string; icon: GarmentIcon };

export type Garment = {
  id: string;
  name: string;
  icon: GarmentIcon;
  group: GarmentGroupId;
  /** Typical dry weight of one piece, in kg. Only used to estimate per-kg orders. */
  weightKg: number;
};

/** In the order the tabs appear. */
export const GARMENT_GROUPS: GarmentGroup[] = [
  { id: 'topwear', name: 'Topwear', icon: 'shirt' },
  { id: 'bottomwear', name: 'Bottomwear', icon: 'trousers' },
  { id: 'ethnic', name: 'Ethnic', icon: 'kurta' },
  { id: 'winter', name: 'Winter', icon: 'sweater' },
  { id: 'linen', name: 'Home linen', icon: 'bedsheet' },
  { id: 'bedding', name: 'Bedding', icon: 'blanket' },
  { id: 'footwear', name: 'Footwear', icon: 'shoe' },
  { id: 'bags', name: 'Bags', icon: 'bag' },
  { id: 'toys', name: 'Soft toys', icon: 'toy' },
];

export const GARMENTS: Garment[] = [
  // topwear
  { id: 'shirt', name: 'Shirt', icon: 'shirt', group: 'topwear', weightKg: 0.25 },
  { id: 'formal-shirt', name: 'Formal shirt', icon: 'shirt', group: 'topwear', weightKg: 0.25 },
  { id: 'tshirt', name: 'T-shirt', icon: 'tshirt', group: 'topwear', weightKg: 0.2 },
  { id: 'polo', name: 'Polo T-shirt', icon: 'tshirt', group: 'topwear', weightKg: 0.25 },
  { id: 'top', name: 'Top', icon: 'tshirt', group: 'topwear', weightKg: 0.2 },
  { id: 'dress', name: 'Dress', icon: 'dress', group: 'topwear', weightKg: 0.4 },
  // bottomwear
  { id: 'trousers', name: 'Pant / trousers', icon: 'trousers', group: 'bottomwear', weightKg: 0.45 },
  { id: 'jeans', name: 'Jeans', icon: 'jeans', group: 'bottomwear', weightKg: 0.65 },
  { id: 'shorts', name: 'Shorts', icon: 'shorts', group: 'bottomwear', weightKg: 0.25 },
  { id: 'track-pants', name: 'Track pants', icon: 'trousers', group: 'bottomwear', weightKg: 0.35 },
  { id: 'pyjama', name: 'Pyjama', icon: 'trousers', group: 'bottomwear', weightKg: 0.3 },
  { id: 'skirt', name: 'Skirt', icon: 'dress', group: 'bottomwear', weightKg: 0.3 },
  { id: 'leggings', name: 'Leggings', icon: 'trousers', group: 'bottomwear', weightKg: 0.2 },
  // ethnic
  { id: 'kurta', name: 'Kurta', icon: 'kurta', group: 'ethnic', weightKg: 0.35 },
  { id: 'kurti', name: 'Kurti', icon: 'kurta', group: 'ethnic', weightKg: 0.3 },
  { id: 'saree', name: 'Saree', icon: 'saree', group: 'ethnic', weightKg: 0.7 },
  { id: 'silk-saree', name: 'Silk saree', icon: 'saree', group: 'ethnic', weightKg: 0.8 },
  { id: 'salwar', name: 'Salwar / churidar', icon: 'trousers', group: 'ethnic', weightKg: 0.35 },
  { id: 'dupatta', name: 'Dupatta', icon: 'saree', group: 'ethnic', weightKg: 0.2 },
  { id: 'dhoti', name: 'Dhoti / lungi', icon: 'saree', group: 'ethnic', weightKg: 0.4 },
  { id: 'lehenga', name: 'Lehenga', icon: 'dress', group: 'ethnic', weightKg: 1.5 },
  { id: 'sherwani', name: 'Sherwani', icon: 'kurta', group: 'ethnic', weightKg: 1.2 },
  // winter and outerwear
  { id: 'sweater', name: 'Sweater', icon: 'sweater', group: 'winter', weightKg: 0.6 },
  { id: 'hoodie', name: 'Hoodie / sweatshirt', icon: 'sweater', group: 'winter', weightKg: 0.7 },
  { id: 'jacket', name: 'Jacket', icon: 'jacket', group: 'winter', weightKg: 1.0 },
  { id: 'blazer', name: 'Blazer', icon: 'jacket', group: 'winter', weightKg: 0.9 },
  { id: 'suit', name: 'Suit (2-piece)', icon: 'jacket', group: 'winter', weightKg: 1.4 },
  { id: 'coat', name: 'Overcoat', icon: 'jacket', group: 'winter', weightKg: 1.4 },
  { id: 'shawl', name: 'Shawl / stole', icon: 'saree', group: 'winter', weightKg: 0.4 },
  { id: 'thermals', name: 'Thermals', icon: 'tshirt', group: 'winter', weightKg: 0.25 },
  // home linen
  { id: 'bedsheet-single', name: 'Bedsheet · Single', icon: 'bedsheet', group: 'linen', weightKg: 0.6 },
  { id: 'bedsheet-double', name: 'Bedsheet · Double', icon: 'bedsheet', group: 'linen', weightKg: 0.9 },
  { id: 'pillow-cover', name: 'Pillow cover', icon: 'pillow', group: 'linen', weightKg: 0.15 },
  { id: 'cushion-cover', name: 'Cushion cover', icon: 'pillow', group: 'linen', weightKg: 0.15 },
  { id: 'bath-towel', name: 'Bath towel', icon: 'towel', group: 'linen', weightKg: 0.5 },
  { id: 'hand-towel', name: 'Hand towel', icon: 'towel', group: 'linen', weightKg: 0.15 },
  { id: 'curtain', name: 'Curtain', icon: 'curtain', group: 'linen', weightKg: 1.0 },
  { id: 'table-cloth', name: 'Table cloth', icon: 'bedsheet', group: 'linen', weightKg: 0.4 },
  // bedding (the blanket service)
  { id: 'blanket', name: 'Blanket', icon: 'blanket', group: 'bedding', weightKg: 2.0 },
  { id: 'quilt', name: 'Quilt / razai', icon: 'blanket', group: 'bedding', weightKg: 2.5 },
  { id: 'comforter', name: 'Comforter', icon: 'blanket', group: 'bedding', weightKg: 2.0 },
  { id: 'duvet', name: 'Duvet', icon: 'blanket', group: 'bedding', weightKg: 1.8 },
  { id: 'bedspread', name: 'Bedspread', icon: 'bedsheet', group: 'bedding', weightKg: 1.2 },
  // footwear
  { id: 'sneakers', name: 'Sneakers', icon: 'shoe', group: 'footwear', weightKg: 0.8 },
  { id: 'formal-shoes', name: 'Formal shoes', icon: 'shoe', group: 'footwear', weightKg: 0.9 },
  { id: 'sandals', name: 'Sandals / slippers', icon: 'shoe', group: 'footwear', weightKg: 0.5 },
  { id: 'boots', name: 'Boots', icon: 'shoe', group: 'footwear', weightKg: 1.4 },
  { id: 'kids-shoes', name: 'Kids’ shoes', icon: 'shoe', group: 'footwear', weightKg: 0.4 },
  // bags
  { id: 'backpack', name: 'Backpack', icon: 'bag', group: 'bags', weightKg: 0.8 },
  { id: 'handbag', name: 'Handbag', icon: 'bag', group: 'bags', weightKg: 0.6 },
  { id: 'laptop-bag', name: 'Laptop bag', icon: 'bag', group: 'bags', weightKg: 0.9 },
  { id: 'travel-bag', name: 'Travel / duffel bag', icon: 'bag', group: 'bags', weightKg: 1.2 },
  // soft toys
  { id: 'toy-small', name: 'Soft toy · Small', icon: 'toy', group: 'toys', weightKg: 0.3 },
  { id: 'toy-large', name: 'Soft toy · Large', icon: 'toy', group: 'toys', weightKg: 1.0 },
];

const CLOTHES_DAILY = ['shirt', 'formal-shirt', 'tshirt', 'polo', 'top', 'dress', 'trousers', 'jeans', 'shorts', 'track-pants', 'pyjama', 'skirt', 'leggings'];
const ETHNIC_DAILY = ['kurta', 'kurti', 'saree', 'salwar', 'dupatta', 'dhoti'];
const LINEN = ['bedsheet-single', 'bedsheet-double', 'pillow-cover', 'cushion-cover', 'bath-towel', 'hand-towel', 'curtain', 'table-cloth'];

/**
 * Which garments each service takes, by price-list category id (priceList.json). Every service item inside a
 * category (e.g. "Only wash · Normal wash" and "Only wash · Whites wash") shares its category's list.
 */
export const SERVICE_GARMENTS: Record<string, string[]> = {
  'only-wash': [
    ...CLOTHES_DAILY,
    ...ETHNIC_DAILY,
    'sweater', 'hoodie', 'thermals', 'shawl',
    ...LINEN,
  ],
  'wash-iron': [
    ...CLOTHES_DAILY,
    ...ETHNIC_DAILY,
    'hoodie', 'shawl',
    'bedsheet-single', 'bedsheet-double', 'pillow-cover', 'cushion-cover', 'curtain', 'table-cloth',
  ],
  stain: [...CLOTHES_DAILY, ...ETHNIC_DAILY, 'silk-saree', 'lehenga', 'sherwani', 'sweater', 'hoodie', 'jacket', 'blazer', 'suit', 'coat', ...LINEN],
  dye: ['shirt', 'tshirt', 'polo', 'top', 'dress', 'trousers', 'jeans', 'shorts', 'skirt', 'kurta', 'kurti', 'saree', 'salwar', 'dupatta', 'hoodie', 'jacket'],
  'dry-clean': [
    'shirt', 'formal-shirt', 'dress', 'trousers', 'skirt',
    'kurta', 'kurti', 'saree', 'silk-saree', 'lehenga', 'sherwani', 'dupatta',
    'sweater', 'jacket', 'blazer', 'suit', 'coat', 'shawl',
    'curtain',
  ],
  'shoes-bags': ['sneakers', 'formal-shoes', 'sandals', 'boots', 'kids-shoes', 'backpack', 'handbag', 'laptop-bag', 'travel-bag', 'toy-small', 'toy-large'],
  blanket: ['blanket', 'quilt', 'comforter', 'duvet', 'bedspread'],
};
