/**
 * FRESH-ACCOUNT FIXTURE (capture session only — no app file is changed).
 *
 * The app has no backend yet. Its demo layer pre-fills every new sign-in with sample data so testers
 * can click around: legacy sample orders and pickup requests on Home, ₹1,500 "Welcome credit (demo,
 * no real money)", and ~14 sample wallet transactions injected when a wallet has 2 or fewer entries.
 * A real new customer in production has none of that, and the film must show a real new customer.
 *
 * So while capturing, the dev bundle served to the headless browser is patched in memory to switch
 * those demo fill-ins off. Everything else (screens, components, prices, the 5% top-up bonus rule,
 * coupon maths, order lifecycle, QR unlock) is the app's own code, untouched.
 * Each patch must match exactly once, or the capture stops.
 */
function emptyJsonModule(src, file) {
  const marker = `,[],"src/mock-data/${file}");`;
  const end = src.indexOf(marker);
  if (end < 0 || src.indexOf(marker, end + 1) >= 0) throw new Error('fixture: json module not unique: ' + file);
  const start = src.lastIndexOf('__d(function', end);
  const head = src.slice(start, src.indexOf('{', start) + 1);
  const close = src.lastIndexOf('}', end); // the "}" right before ",<id>,[]"
  return src.slice(0, start) + head + '\n  module.exports = [];\n' + src.slice(close);
}

function replaceOnce(src, from, to, label) {
  const i = src.indexOf(from);
  if (i < 0 || src.indexOf(from, i + 1) >= 0) throw new Error('fixture: pattern not unique: ' + label);
  return src.slice(0, i) + to + src.slice(i + from.length);
}

// Replace text only inside one JSON module (so e.g. the staff list keeps its own phone numbers).
function editJsonModule(src, file, pairs) {
  const marker = `,[],"src/mock-data/${file}");`;
  const end = src.indexOf(marker);
  if (end < 0) throw new Error('fixture: json module missing: ' + file);
  const start = src.lastIndexOf('__d(function', end);
  let mod = src.slice(start, end);
  for (const [from, to] of pairs) {
    if (!mod.includes(from)) throw new Error(`fixture: "${from}" not in ${file}`);
    mod = mod.split(from).join(to);
  }
  return src.slice(0, start) + mod + src.slice(end);
}

// The film's demo customer (fictional). The sample profile JSON belongs to a developer test account,
// so it is aligned with the customer who signs up on camera.
const CUSTOMER = { name: 'Aarav Mehta', email: 'aarav@example.com', phone: '+91 98123 45670', since: '2026-11-10', code: 'WBAARV24' };

module.exports = function freshAccount(src) {
  const who = [['Dhanush Atmakuri', CUSTOMER.name], ['dhanush@example.com', CUSTOMER.email], ['+91 98765 43210', CUSTOMER.phone], ['2026-09-12', CUSTOMER.since]];
  src = editJsonModule(src, 'user.json', [...who, ['WBDHAN24', CUSTOMER.code]]);
  src = editJsonModule(src, 'profile/customer.json', who);
  src = editJsonModule(src, 'profile/membership.json', [['2026-09-12', CUSTOMER.since], ['WBDHAN24', CUSTOMER.code], ['"friendsJoined": 2', '"friendsJoined": 0'], ['"rewardsEarned": 200', '"rewardsEarned": 0'], ['"rewardsPending": 200', '"rewardsPending": 0']]);
  src = emptyJsonModule(src, 'orders.json'); // Home's sample order history
  src = emptyJsonModule(src, 'requests.json'); // Home's sample pickup requests
  src = emptyJsonModule(src, 'notifications.json'); // sample notification inbox
  src = replaceOnce(
    src,
    "    addTxn(s, ctx, {\n      customerId: id,\n      type: 'credit',\n      source: 'bonus',\n      amount: WELCOME_CREDIT,",
    "    if (false) addTxn(s, ctx, {\n      customerId: id,\n      type: 'credit',\n      source: 'bonus',\n      amount: WELCOME_CREDIT,",
    'welcome credit',
  );
  src = replaceOnce(src, 'if (existing.length <= 2) {', 'if (false) {', 'sample wallet history');
  // HOME-PICKUP MODE. NewOrderScreen fixes pickedMode to 'OFFICE_DROP_OFF' with no setter, so its built-in
  // pickup step (day picker + two-hour slots, Model Town's homePickup config) is not reachable from the UI yet.
  // The film shows that real step by starting the screen in HOME_PICKUP (a mode Model Town lists in serviceModes).
  src = replaceOnce(src, "const [pickedMode] = (0, _react.useState)('OFFICE_DROP_OFF');", "const [pickedMode] = (0, _react.useState)('HOME_PICKUP');", 'home pickup mode');
  return src;
};
