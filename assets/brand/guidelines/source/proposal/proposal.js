// Washing Basket — Project Proposal (A4 portrait, brand theme). node proposal/proposal.js [out.pdf]
// Pricing appears only in the final "Commercial proposal" section; the cover carries none.
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { logo, lockup } = require('../lib');

const DIR = __dirname;
const OUT = process.argv[2] || path.join(DIR, 'Washing-Basket-Project-Proposal.pdf');
const DOC = { title: 'Project Proposal', client: 'Washing Basket', draft: 'Commercial discussion draft', date: 'November 2026' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

const pages = [];
const TOTAL = () => pages.length;
const head = () => `<header class="hd">${lockup(12)}<span>Project proposal · Confidential</span></header>`;
const foot = (n) => `<footer class="ft"><span>${DOC.client} · ${DOC.draft} · ${DOC.date}</span><span class="ft__n">${String(n).padStart(2, '0')} / {{TOTAL}}</span></footer><div class="bands"><i></i><i></i><i></i></div>`;
const sec = (num, kicker, title, lead) => `<div class="sec"><div class="sec__n">${num}</div><div><div class="kick">${esc(kicker)}</div><h2>${esc(title)}</h2>${lead ? `<p class="lead">${md(lead)}</p>` : ''}</div></div>`;
const page = (body, cls = '') => { const n = pages.length + 1; pages.push(`<section class="page in ${cls}">${head()}<main>${body}</main>${foot(n)}</section>`); };
const note = (label, text, kind = '') => `<div class="note ${kind}"><b>${esc(label)}</b><p>${md(text)}</p></div>`;
const h3 = (t) => `<h3>${esc(t)}</h3>`;

// ---------- cover (no pricing) ----------
pages.push(`<section class="page cover">
  <div class="cv__top">${lockup(19)}<span class="cv__conf">Confidential</span></div>
  <div class="cv__main">
    <div class="kick">Project proposal</div>
    <h1>Washing Basket<br>digital service platform</h1>
    <p class="cv__sub">Customer app for Android and iOS, operations portal and backend services: scope, delivery approach and engagement terms.</p>
  </div>
  <div class="cv__bottom">
    <dl class="cv__meta">
      <div><dt>Prepared for</dt><dd>${DOC.client}</dd></div>
      <div><dt>Document</dt><dd>${DOC.draft}</dd></div>
      <div><dt>Date</dt><dd>${DOC.date}</dd></div>
      <div><dt>Classification</dt><dd>Confidential</dd></div>
    </dl>
    <div class="cv__art"><img src="cover.jpg" alt=""></div>
  </div>
  <div class="bands bands--cv"><i></i><i></i><i></i></div>
</section>`);

// ---------- contents ----------
const TOC = [['01', 'Executive overview', 3], ['02', 'Scope and delivery workstreams', 4], ['03', 'Client inputs, ownership and warranty', 5], ['04', 'Acceptance and next steps', 6], ['05', 'Commercial proposal', 7]];
page(`${sec('', 'Contents', 'In this proposal')}
  <ol class="toc">${TOC.map(([n, t, p]) => `<li><span class="toc__n">${n}</span><span class="toc__t">${t}</span><i></i><span class="toc__p">${String(p).padStart(2, '0')}</span></li>`).join('')}</ol>
  <div class="about">
    <div>${h3('About this document')}<p>This proposal sets out what will be built for Washing Basket, how the work is phased, what is needed from the client team and how the engagement is accepted. All commercial terms, including the monthly Managed Care &amp; Maintenance plan, are collected in the final section.</p></div>
    <div>${h3('Status')}<p>${DOC.draft}. Final scope, taxes, IP transfer, privacy responsibilities, support levels and exclusions are confirmed in a mutually signed agreement.</p></div>
  </div>`);

// ---------- 01 overview ----------
const SCOPE = [
  ['Customer app', 'React Native + Expo for Android and iOS: phone-number/OTP sign-in, profile, service discovery, booking and order views.'],
  ['Service journey', 'Collect → Wash → Dry → Iron → Handover, with clear, understandable status updates at every step.'],
  ['Live payments and wallet', 'Wallet top-up and checkout through a live payment gateway, configured bonus logic, coupons at the payment stage, and QR access after wallet payment.'],
  ['Order operations', 'Backend order lifecycle with customer-facing status visibility, built for real customers from day one.'],
  ['Admin interface', 'Web portal for the agreed customer, booking/order, payment and status-management tasks, run by the client’s own team.'],
  ['Technical foundation', 'Node.js/Express APIs, MongoDB, validation, authentication, access controls, security hardening, testing and production deployment.'],
];
page(`${sec('01', 'Executive overview', 'A connected service platform, not a brochure app', 'Washing Basket is being developed as a connected digital service platform for real customers and real payments: Android and iOS apps, backend services, an operations portal, a live payment gateway, testing, store release and a codebase the client owns.')}
  <p>The goal is to make the customer journey straightforward while giving the business a dependable foundation to manage bookings, payments, service progress, customer information and future growth. The platform should reduce manual coordination, prevent avoidable operational errors and keep the service experience consistent.</p>
  ${h3('Proposed scope baseline')}
  <div class="grid2">${SCOPE.map(([t, d], i) => `<div class="card"><span class="card__n">${String(i + 1).padStart(2, '0')}</span><b>${t}</b><p>${esc(d)}</p></div>`).join('')}</div>
  ${note('Two phases', '**Phase 1: clickable prototype.** The full flow with sample data, so Washing Basket can see the experience before committing. **Phase 2: full build.** On approval, the prototype becomes the real product with live payments and real users.')}`);

// ---------- 02 workstreams (no prices) ----------
const WS = [
  ['Clickable prototype', 'Phase 1: the end-to-end customer flow and key admin screens with sample data, for review and approval.'],
  ['Discovery & planning', 'Requirements, user journeys, architecture, workflow definitions and scope control.'],
  ['UX/UI design system', 'Screen structure, reusable components, responsive behaviour and visual consistency.'],
  ['Backend, APIs & database', 'Authentication, customer/order data, business rules, validation and access control.'],
  ['Customer mobile app', 'Android + iOS implementation, booking, profile, wallet/checkout and API integration.'],
  ['Admin / operations portal', 'Operational screens and controls for the agreed customer, booking, payment and order workflows.'],
  ['Workflow integrations', 'Wallet rules, bonus display, coupon validation, QR gating and order workflow.'],
  ['Live payments & go-live', 'Payment gateway, webhooks, failed/pending payments, refunds, settlement reconciliation, security hardening, production servers and store submission.'],
  ['QA, release & handover', 'Functional/regression testing, UAT, release, admin training and handover.'],
];
page(`${sec('02', 'Scope and delivery', 'Specialist workstreams, one product', 'The engagement is delivered as a prototype followed by eight build workstreams, engineered to operate together reliably.')}
  <table class="tbl tbl--ws"><thead><tr><th style="width:9mm">#</th><th style="width:50mm">Workstream</th><th>What it delivers</th></tr></thead><tbody>
  ${WS.map(([w, d], i) => `<tr><td class="num">${String(i + 1).padStart(2, '0')}</td><td><b>${w}</b></td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
  ${h3('Why this is more than app design')}
  <div class="grid3">
    <div class="card card--t"><b>Two platforms</b><p>Android and iOS need their own implementation, device testing, release configuration and platform-specific checks.</p></div>
    <div class="card card--t"><b>Real money, real users</b><p>Payments, refunds and settlements must be correct every time, across the app, backend, gateway and admin portal.</p></div>
    <div class="card card--t"><b>Data and security</b><p>Customer records, authentication, permissions, validation, backups and controlled access need deliberate engineering.</p></div>
  </div>`);

// ---------- 03 inputs, ownership & warranty ----------
const INPUTS = [
  'One authorised point of contact for consolidated feedback and approvals.',
  'Final service catalogue, service areas, pricing, taxes/fees and booking constraints.',
  'Confirmed order lifecycle, cancellation/refund rules, wallet bonus, coupon conditions and QR unlock criteria.',
  'Approved brand assets, images, content, privacy policy and legal text.',
  'Business accounts in Washing Basket’s name: Google Play, Apple Developer, payment gateway (KYC), SMS/DLT and domain.',
  'Timely feedback, ideally within 2–3 working days for each review milestone.',
];
page(`${sec('03', 'Client inputs, ownership and warranty', 'What we need, and what you own', 'Delivery dates depend on the following inputs being available when each stage needs them.')}
  <ul class="checks">${INPUTS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <div class="grid2 grid2--top">
    <div class="box">${h3('60-day warranty')}<p>Every reproducible defect in the delivered scope is fixed <b>free of charge for 60 days after go-live</b>. Warranty fixes never use maintenance plan hours.</p><p>It excludes new requirements, third-party outages, client configuration changes and issues caused by unauthorised code changes.</p></div>
    <div class="box">${h3('You own the product')}<p>The source code lives in a <b>GitHub account owned by Washing Basket</b>, with full code and IP ownership transferring on final payment.</p><p>Handover includes <b>two admin training sessions</b> and an admin user guide for the team that will run the portal.</p></div>
  </div>`, 'roomy');

// ---------- 04 acceptance, next steps, DPDP ----------
const STEPS = [['Approve Phase 1', 'Start the clickable prototype.'], ['Review the prototype', 'Walk through the full flow and give feedback.'], ['Approve Phase 2', 'Freeze the scope and acceptance criteria.'], ['Delivery calendar', 'Confirm dates for every review milestone.'], ['Client-side owners', 'Name the owner for each input and approval.'], ['Go-live and care', 'Launch, then Managed Care & Maintenance begins.']];
page(`${sec('04', 'Acceptance and next steps', 'From approval to launch', 'Phase 1 starts on approval of this proposal. Phase 2 starts once the prototype is approved and the first build milestone is paid.')}
  <ol class="steps">${STEPS.map(([t, d], i) => `<li><span>${i + 1}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}</ol>
  <div class="box box--dpdp">${h3('Data protection: DPDP reference notes')}
    <p>Summary based on the Digital Personal Data Protection Act, 2023; the DPDP Rules, 2025 notified by MeitY; and the phased commencement notification dated 13 November 2025. The core provisions are scheduled 18 months after notification, on <b>13 May 2027</b>. Confirm applicability and current requirements with qualified Indian legal/privacy counsel.</p>
    <div class="src"><b>Official sources</b>
      <p>MeitY: DPDP Rules 2025 and commencement documents<br><a href="https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa">meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa</a></p>
      <p>PIB, 14 November 2025<br><a href="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&amp;lang=2&amp;reg=3">pib.gov.in/PressReleasePage.aspx?PRID=2190014&amp;lang=2&amp;reg=3</a></p>
    </div>
  </div>`, 'roomy');

// ---------- 05 commercial (pricing lives only here) ----------
const inr = (v) => '₹' + v.toLocaleString('en-IN');
const ALLOC = [
  ['Discovery & planning', 'Requirements, journeys, architecture', 35000],
  ['UX/UI design system', 'Screens, components, consistency', 55000],
  ['Backend, APIs & database', 'Auth, data, business rules, access', 100000],
  ['Customer mobile app', 'Android + iOS, booking, wallet', 145000],
  ['Admin / operations portal', 'Customers, orders, payments, status', 75000],
  ['Workflow integrations', 'Wallet, bonus, coupons, QR gating', 40000],
  ['Live payments & go-live', 'Gateway, refunds, security, production', 100000],
  ['QA, release & handover', 'Testing, UAT, stores, training', 50000],
];
const TOTALFEE = ALLOC.reduce((a, r) => a + r[2], 0);
const MAXA = Math.max(...ALLOC.map((r) => r[2]));
page(`${sec('05', 'Commercial proposal', 'Project investment', 'The fee covers the complete connected system described in this proposal: two apps, backend, admin portal, live payments, testing, store launch, a 60-day warranty and full code ownership. It is a fixed price for the agreed scope.')}
  ${h3('Investment breakdown')}
  <table class="tbl tbl--money"><thead><tr><th>Workstream</th><th>Covers</th><th class="r" style="width:26mm">Amount</th><th style="width:34mm">Share</th></tr></thead><tbody>
  ${ALLOC.map(([w, c, v]) => `<tr><td><b>${w}</b></td><td>${c}</td><td class="r">${inr(v)}</td><td><div class="bar"><i style="width:${(v / MAXA) * 22}mm"></i><span>${Math.round((v / TOTALFEE) * 100)}%</span></div></td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">Total fixed project fee</td><td class="r">${inr(TOTALFEE)}</td><td><span class="tot">100%</span></td></tr></tfoot></table>`);

const MS = [['Phase 1', 'Prototype · 50% at start', 25000], ['Phase 1', 'Prototype · 50% on delivery', 25000], ['M1 · 30%', 'Prototype approved, scope frozen, build kickoff', 150000], ['M2 · 30%', 'UX/UI approval and core backend demonstration', 165000], ['M3 · 30%', 'Feature-complete app, admin and payments demo, before UAT sign-off', 165000], ['M4 · 10%', 'Go-live on both stores and final handover', 70000]];
page(`${sec('', 'Commercial proposal', 'Payment schedule')}
  <p class="lead" style="margin-top:-2mm">Pay as you see progress: each milestone is due only after that stage is demonstrated and approved. The ₹50,000 prototype fee counts towards the project fee, so it is deducted from M1.</p>
  <table class="tbl tbl--money"><thead><tr><th style="width:26mm">Stage</th><th>Payment trigger</th><th class="r" style="width:30mm">Amount</th></tr></thead><tbody>
  ${MS.map(([m, t, v]) => `<tr><td><span class="pill">${m}</span></td><td>${esc(t)}</td><td class="r"><b>${inr(v)}</b></td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">Total project fee</td><td class="r">${inr(MS.reduce((a, r) => a + r[2], 0))}</td></tr></tfoot></table>
  ${h3('One-time account fees (paid directly by Washing Basket)')}
  <table class="tbl tbl--plain"><tbody>
    <tr><td><b>Google Play developer account</b></td><td>One time, for life</td><td class="r">≈ ₹2,200</td></tr>
    <tr><td><b>Apple Developer Program</b></td><td>Yearly, renewed by Washing Basket</td><td class="r">≈ ₹9,000</td></tr>
    <tr><td><b>SMS DLT registration</b></td><td>One time, required in India to send OTP SMS</td><td class="r">≈ ₹6,000</td></tr>
  </tbody></table>
  <p class="small">These accounts are opened in Washing Basket’s business name because they need company KYC. Amounts are indicative and set by each provider.</p>`);

const CARE = [
  ['Cloud hosting & server management', 2500],
  ['Database & backup management', 2000],
  ['Storage, SSL & delivery', 500],
  ['OTP allowance (up to 2,000)', 600],
  ['Security & dependency maintenance', 2000],
  ['Monitoring & alert management', 1000],
  ['Bug fixes (up to 10 hours)', 6000],
  ['Monthly reporting & technical support', 1400],
];
const CAREVAL = CARE.reduce((a, r) => a + r[1], 0);
page(`${sec('', 'Recommended plan · ' + inr(CAREVAL) + '/month', 'Washing Basket – Managed Care & Maintenance', 'One accountable technical partner for the entire platform.')}
  <table class="tbl tbl--money tbl--care"><thead><tr><th style="width:9mm">#</th><th>Included service</th><th class="r" style="width:40mm">Monthly allocation</th></tr></thead><tbody>
  ${CARE.map(([t, v], i) => `<tr><td class="num">${String(i + 1).padStart(2, '0')}</td><td><b>${esc(t)}</b></td><td class="r">${inr(v)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td></td><td>Total</td><td class="r">${inr(CAREVAL)}</td></tr></tfoot></table>
  <p class="small" style="margin-top:0">Billed monthly from go-live. Taxes extra.</p>
`, 'roomy');

page(`${sec('', 'Commercial proposal', 'Additional work and exclusions')}
  <div class="grid2">
    <div>${h3('Additional work')}<table class="tbl tbl--plain tbl--mt"><tbody>
      <tr><td><b>Extra developer hours</b><span class="sub">Beyond the 10 bug-fix hours in the plan</span></td><td class="r">₹1,000 / hour</td></tr>
      <tr><td><b>New features</b><span class="sub">Fixed quote, approved before work starts</span></td><td class="r">Quoted</td></tr>
      <tr><td><b>Additional admin training</b><span class="sub">Beyond the two handover sessions</span></td><td class="r">₹2,500 / session</td></tr>
      <tr><td><b>OTP SMS above 2,000 / month</b><span class="sub">Billed at actual provider cost</span></td><td class="r">At cost</td></tr>
      <tr><td><b>Higher hosting tier</b><span class="sub">Only if usage outgrows the launch tier, with 30 days’ notice</span></td><td class="r">Reviewed</td></tr>
    </tbody></table></div>
    <div>${h3('Not included in the plan')}<ul class="xlist">
      <li><b>Apple Developer Program renewal</b> (about ₹9,000 a year)</li>
      <li><b>Domain renewal</b> (about ₹700–1,200 a year)</li>
      <li><b>Trademark registration</b> for the name and logo</li>
      <li><b>Privacy policy and legal drafting</b> by a lawyer</li>
      <li><b>Payment gateway transaction fees</b>, deducted by the gateway from each payment</li>
      <li><b>Taxes</b> as applicable</li>
    </ul></div>
  </div>
  ${h3('Response times')}
  <div class="sla"><div><b>4 working hours</b><span>Response when the app is down or payments are failing</span></div><div><b>1 working day</b><span>Response for all other issues and change requests</span></div><div><b>60 days</b><span>Defect fixes after go-live are under warranty and never use plan hours</span></div></div>
  <p class="legal"><b>Important.</b> This is a commercial planning proposal, not a tax invoice, legal opinion, security certification or guarantee of regulatory compliance. Final scope, taxes, IP transfer, privacy responsibilities, support service levels and exclusions must be recorded in a mutually signed agreement. Third-party prices are indicative and set by each provider.</p>`);

const css = `
@font-face{font-family:Inter;font-weight:400;src:url(../fonts/Inter_400Regular.ttf)}
@font-face{font-family:Inter;font-weight:500;src:url(../fonts/Inter_500Medium.ttf)}
@font-face{font-family:Inter;font-weight:600;src:url(../fonts/Inter_600SemiBold.ttf)}
@font-face{font-family:Inter;font-weight:700;src:url(../fonts/Inter_700Bold.ttf)}
:root{--ink:#0A1C3E;--soft:#4A5468;--mute:#667085;--line:#E3E6EB;--paper:#F3F5F8;--navy:#013E86;--deep:#012A5C;--lor:#FE8701;--or:#FFA742;--red:#D30D24}
@page{size:210mm 297mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#d9d9d9}
body{font-family:Inter;color:var(--ink);font-size:9.4pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:'tnum' 0}
.page{width:210mm;height:297mm;background:#fff;position:relative;overflow:hidden;margin:0 auto 6mm;break-after:page}
@media print{html,body{background:#fff}.page{margin:0}}
.bands{position:absolute;left:0;right:0;bottom:0;height:2.2mm;display:flex}.bands i{flex:1}.bands i:nth-child(1){background:var(--lor)}.bands i:nth-child(2){background:var(--red)}.bands i:nth-child(3){background:var(--navy)}
.lockup{display:inline-flex;align-items:center;line-height:0}.lockup svg{display:block;flex:none}
.kick{font-size:7.2pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--lor)}
/* cover */
.cover{padding:20mm 20mm 0;display:flex;flex-direction:column}
.cv__top{display:flex;justify-content:space-between;align-items:center}
.cv__conf{font-size:7pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--navy);border:.3mm solid var(--navy);border-radius:5mm;padding:1.2mm 3.2mm}
.cv__main{margin-top:34mm}
.cover h1{font-size:34pt;line-height:1.08;letter-spacing:-.025em;font-weight:700;margin-top:5mm}
.cv__sub{font-size:11.5pt;line-height:1.5;color:var(--soft);margin-top:6mm;max-width:132mm}
.cv__bottom{margin-top:auto;display:grid;grid-template-columns:1fr 84mm;gap:10mm;align-items:end;padding-bottom:16mm}
.cv__meta{display:grid;gap:4.2mm;border-top:.4mm solid var(--ink);padding-top:5mm}
.cv__meta dt{font-size:6.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.cv__meta dd{font-size:10.5pt;font-weight:600;margin-top:.6mm}
.cv__art{height:126mm;border-radius:4mm;overflow:hidden;background:#FD4E0E}
.cv__art img{width:100%;height:100%;object-fit:cover;object-position:center bottom;display:block}
/* inner */
.in{padding:16mm 20mm 0}
.hd{display:flex;justify-content:space-between;align-items:center;padding-bottom:4mm;border-bottom:.25mm solid var(--line)}
.hd>span:last-child{font-size:6.8pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--mute)}
main{position:absolute;left:20mm;right:20mm;top:34mm;bottom:22mm;display:flex;flex-direction:column;gap:5.5mm}
.ft{position:absolute;left:20mm;right:20mm;bottom:9mm;display:flex;justify-content:space-between;font-size:6.8pt;color:var(--mute)}
.ft__n{font-weight:700;color:var(--ink)}
.sec{display:grid;grid-template-columns:auto 1fr;gap:6mm;align-items:start;margin-bottom:1mm}
.sec__n{font-size:40pt;font-weight:700;line-height:.9;letter-spacing:-.04em;color:var(--lor)}
.sec__n:empty{display:none}
.sec h2{font-size:21pt;line-height:1.15;letter-spacing:-.02em;font-weight:700;margin-top:1.8mm}
.lead{font-size:10.5pt;line-height:1.55;color:var(--soft);margin-top:3mm}
p{color:var(--soft)}p b{color:var(--ink);font-weight:600}
h3{font-size:10.5pt;font-weight:700;letter-spacing:-.005em;color:var(--ink);margin-bottom:-1.5mm}
.box h3,.card h3{margin-bottom:2mm}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.card{background:var(--paper);border-radius:3mm;padding:4.5mm 5mm;position:relative}
.card b{display:block;font-size:9.6pt;font-weight:700;margin-bottom:1.2mm}
.card p{font-size:8.6pt;line-height:1.5}
.card__n{position:absolute;right:5mm;top:4.5mm;font-size:7pt;font-weight:700;color:var(--lor);letter-spacing:.06em}
.card--t{border-top:1mm solid var(--lor);border-radius:0 0 3mm 3mm}
.card--t:nth-child(2){border-top-color:var(--red)}.card--t:nth-child(3){border-top-color:var(--navy)}
.note{display:grid;grid-template-columns:30mm 1fr;gap:4mm;border-left:1mm solid var(--lor);background:#FFF6EC;padding:4mm 5mm;border-radius:0 3mm 3mm 0}
.note b{font-size:7.2pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#C26300;padding-top:.6mm}
.note p{font-size:8.8pt}
.flow{display:flex;align-items:center;gap:2mm;background:var(--deep);border-radius:3mm;padding:4.5mm 6mm}
.flow__s{flex:1;display:flex;flex-direction:column;gap:.6mm}.flow__s span{font-size:6.6pt;font-weight:700;color:var(--or);letter-spacing:.1em}.flow__s b{font-size:10pt;color:#fff;font-weight:600}
.flow__a{width:6mm;height:.3mm;background:rgba(255,255,255,.35);position:relative;flex:none}.flow__a:after{content:'';position:absolute;right:0;top:-1mm;border:1.1mm solid transparent;border-left-color:rgba(255,255,255,.55);border-right:0}
.tbl{width:100%;border-collapse:collapse;font-size:8.8pt}
.tbl th{text-align:left;font-size:6.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#fff;background:var(--ink);padding:2.6mm 3.5mm}
.tbl th:first-child{border-radius:2mm 0 0 0}.tbl th:last-child{border-radius:0 2mm 0 0}
.tbl td{padding:3.7mm 3.5mm;border-bottom:.25mm solid var(--line);color:var(--soft);vertical-align:middle}
.tbl td b{color:var(--ink);font-weight:600}
.tbl tbody tr:nth-child(even) td{background:#FAFBFC}
.tbl .num{font-weight:700;color:var(--lor);font-size:7.6pt}
.tbl .r{text-align:right;font-variant-numeric:tabular-nums}
.tbl tfoot td{font-weight:700;color:var(--ink);border-bottom:0;border-top:.5mm solid var(--ink);padding-top:3.2mm;font-size:9.6pt}
.bar{display:flex;align-items:center;gap:2.5mm}.bar i{display:block;height:2.2mm;border-radius:1.2mm;background:var(--lor);max-width:36mm;flex:none}.bar span{font-size:8pt;font-weight:600;color:var(--ink)}
.bar{width:100%}.bar i{width:auto}
.tot{font-size:8pt}
.pill{display:inline-block;font-size:6.6pt;font-weight:700;color:var(--navy);background:#EAF0F9;border-radius:3mm;padding:.5mm 1.8mm;margin-right:1mm;letter-spacing:.06em}
.checks{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:3mm 6mm}
.checks li{position:relative;padding:3.6mm 4mm 3.6mm 11mm;background:var(--paper);border-radius:3mm;font-size:8.8pt;color:var(--soft);line-height:1.45}
.checks li:before{content:'';position:absolute;left:4mm;top:3.9mm;width:4mm;height:4mm;border-radius:50%;background:var(--lor)}
.checks li:after{content:'';position:absolute;left:5.25mm;top:4.85mm;width:1.4mm;height:.8mm;border-left:.45mm solid #fff;border-bottom:.45mm solid #fff;transform:rotate(-45deg)}
.box{border:.3mm solid var(--line);border-radius:3mm;padding:5mm}
.box p+p{margin-top:2mm}.box p{font-size:8.8pt}
.grid2--top{align-items:stretch}
.steps{list-style:none;display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
.steps li{display:flex;gap:3mm;background:var(--paper);border-radius:3mm;padding:4mm}
.steps li>span{flex:none;width:7mm;height:7mm;border-radius:50%;background:var(--ink);color:#fff;font-size:8pt;font-weight:700;display:flex;align-items:center;justify-content:center}
.steps b{font-size:9.2pt;font-weight:700;display:block}.steps p{font-size:8.2pt;line-height:1.45;margin-top:.6mm}
.box--dpdp{background:#fff}
.src{margin-top:3.5mm;padding-top:3.5mm;border-top:.25mm solid var(--line);display:grid;gap:2mm}
.src>b{font-size:6.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.src p{font-size:8pt}.src a{color:var(--navy);text-decoration:none;word-break:break-all}
.toc{list-style:none;margin-top:2mm;border-top:.4mm solid var(--ink)}
.toc li{display:flex;align-items:baseline;gap:4mm;padding:5mm 0;border-bottom:.25mm solid var(--line)}
.toc__n{font-size:11pt;font-weight:700;color:var(--lor);width:10mm}.toc__t{font-size:13pt;font-weight:600}
.toc i{flex:1}.toc__p{font-size:10pt;font-weight:600;color:var(--mute);font-variant-numeric:tabular-nums}
.about{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:auto;background:var(--paper);border-radius:3mm;padding:6mm}
.about h3{margin-bottom:2mm}.about p{font-size:8.8pt}
.hero{display:grid;grid-template-columns:1.35fr 1fr;gap:4mm}
.hero>div{border-radius:3mm;padding:6mm;display:flex;flex-direction:column;gap:1mm}
.hero__main{background:var(--deep);color:#fff}.hero__side{background:var(--paper)}
.hero span{font-size:7pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--or)}
.hero__side span{color:var(--lor)}
.hero b{font-size:28pt;font-weight:700;letter-spacing:-.02em;line-height:1.1;margin-top:1.5mm}
.hero__side b{font-size:20pt;color:var(--ink);margin-top:auto}.hero b small{font-size:10pt;font-weight:600;color:var(--mute)}
.hero em{font-style:normal;font-size:8pt;color:rgba(255,255,255,.72)}.hero__side em{color:var(--mute)}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:8mm}
.sign__b{border:.3mm solid var(--line);border-radius:3mm;padding:5mm 5mm 3mm}
.sign__f{display:flex;align-items:flex-end;gap:3mm;height:11mm}
.sign__f span{font-size:7.6pt;font-weight:600;color:var(--mute);width:17mm}
.sign__f i{flex:1;border-bottom:.3mm solid #9AA3B2;height:0;margin-bottom:1mm}
.legal{font-size:7.6pt;line-height:1.5;color:var(--mute);margin-top:auto;padding-top:3mm;border-top:.25mm solid var(--line)}
.legal b{color:var(--ink)}
/* r2: fuller type scale on lighter pages */
.about{padding:8mm}.about p{font-size:9.6pt}
.toc li{padding:6.5mm 0}.toc__t{font-size:14pt}
.cover h1{font-size:38pt}.cv__sub{font-size:12.5pt}.cv__main{margin-top:40mm}
.roomy main{gap:7.5mm}
.roomy .lead{font-size:11.4pt}.roomy .sec h2{font-size:23pt}.roomy h3{font-size:11.8pt}
.roomy .grid2{gap:5mm}
.roomy .checks{gap:4.5mm 6mm}.roomy .checks li{font-size:9.8pt;padding:5.5mm 5mm 5.5mm 12.5mm;line-height:1.5}
.roomy .checks li:before{left:5mm;top:5.9mm;width:4.4mm;height:4.4mm}.roomy .checks li:after{left:6.35mm;top:6.95mm}
.roomy .box{padding:6.5mm}.roomy .box p{font-size:9.6pt}.roomy .box h3{font-size:11.4pt}
.roomy .steps{gap:5mm;grid-template-columns:1fr 1fr}.roomy .steps li{padding:6mm 5mm;gap:4mm}.roomy .steps li>span{width:8mm;height:8mm;font-size:9pt}.roomy .steps b{font-size:10.4pt}.roomy .steps p{font-size:9.2pt}
.roomy .src p{font-size:8.8pt}
.roomy .tbl{font-size:9.8pt}.roomy .tbl td{padding:4.4mm 4mm}.roomy .tbl th{padding:3.2mm 4mm;font-size:7.2pt}.roomy .tbl tfoot td{font-size:10.4pt;padding-top:4mm}
.roomy .hero>div{padding:8mm 7mm}.roomy .hero b{font-size:32pt}.roomy .hero__side b{font-size:22pt}
/* r3: commercial pages */
.tbl .sub{display:block;font-size:.86em;color:var(--mute);font-weight:400;margin-top:.4mm}
.tbl .sub--in{display:inline;margin-left:2mm;color:var(--lor);font-weight:700}
.tbl--plain td{padding:3mm 3.5mm}.tbl--plain tr:first-child td{border-top:.4mm solid var(--ink)}
.tbl--care td{padding:1.9mm 3.5mm}.tbl--care .sub{margin-top:.2mm}
.roomy .tbl--care td{padding:2.7mm 4mm}
.small{font-size:8pt;color:var(--mute);margin-top:-3mm}
.care{display:grid;grid-template-columns:1fr 1.25fr;gap:4mm}
.care__price{background:var(--deep);color:#fff;border-radius:3mm;padding:7mm;display:flex;flex-direction:column;gap:1mm}
.care__price span{font-size:7pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--or)}
.care__price b{font-size:28pt;font-weight:700;letter-spacing:-.02em;line-height:1.1;margin-top:1.5mm}.care__price small{font-size:10pt;font-weight:600;color:rgba(255,255,255,.7)}
.care__price em{font-style:normal;font-size:8pt;color:rgba(255,255,255,.72)}
.care__val{background:var(--paper);border-radius:3mm;padding:5mm 6mm;display:grid;gap:2.6mm;align-content:center}
.care__val div{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;border-bottom:.25mm solid var(--line);padding-bottom:2.2mm}.care__val div:last-child{border:0;padding:0}
.care__val span{font-size:8.4pt;color:var(--mute)}.care__val b{font-size:10pt;font-weight:700}
.care__val div:nth-child(2) b{color:#0D7A21}
.sla{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.sla div{border-top:1mm solid var(--lor);background:var(--paper);border-radius:0 0 3mm 3mm;padding:3.6mm 4mm}
.sla div:nth-child(2){border-top-color:var(--navy)}.sla div:nth-child(3){border-top-color:var(--red)}
.sla b{display:block;font-size:11pt;font-weight:700}.sla span{font-size:8.2pt;color:var(--soft);line-height:1.4;display:block;margin-top:.6mm}
.xlist{list-style:none;margin-top:3.5mm;border-top:.4mm solid var(--ink)}
.xlist li{padding:3mm 0 3mm 6mm;border-bottom:.25mm solid var(--line);position:relative;font-size:9pt;color:var(--soft)}
.xlist li:before{content:'';position:absolute;left:0;top:4.9mm;width:3mm;height:.5mm;background:var(--red)}
.xlist b{color:var(--ink);font-weight:600}
.tbl--mt{margin-top:3.5mm}
.tbl--ws td{padding:2.7mm 3.5mm}
.card{padding:4mm 5mm}
`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Washing Basket — Project Proposal</title><style>${css}</style></head><body>${pages.join('\n').replace(/\{\{TOTAL\}\}/g, String(TOTAL()).padStart(2, '0'))}</body></html>`;
fs.writeFileSync(path.join(DIR, 'proposal.html'), html);

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file:///' + path.join(DIR, 'proposal.html').split(path.sep).join('/'), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const issues = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('main').forEach((m, i) => { const last = [...m.children].pop(); const over = last.getBoundingClientRect().bottom - m.getBoundingClientRect().bottom; if (over > 0.5) out.push(`page ${i + 2} overflows ${(over / 3.78).toFixed(1)}mm`); });
    document.querySelectorAll('*').forEach((e) => { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' && e.closest('main') && !['svg', 'path'].includes(e.tagName.toLowerCase())) { /* horizontal spill */ } });
    return out;
  });
  console.log(issues.length ? issues.join('\n') : 'no overflow');
  const fams = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight));
  console.log('fonts', fams.join(' '));
  await p.pdf({ path: OUT, width: '210mm', height: '297mm', printBackground: true, preferCSSPageSize: true, tagged: true });
  console.log('pdf', OUT, pages.length, 'pages');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
