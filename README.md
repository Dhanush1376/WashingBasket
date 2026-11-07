# Washing Basket

A complete, modern digital laundry platform designed for university campuses (LPU, NIT Jalandhar) and door-to-door residential pickup. Built with Expo/React Native for mobile (customer and staff) and Vite/React for the operations management portal.

---

## Architecture Overview

```
WashingBasket/
├── .github/workflows/      # Automated CI/CD pipeline (typecheck, lint, test, build)
├── admin/                  # Web operations & admin portal (React 19 + Vite 8)
├── mobile/                 # Customer & laundry staff mobile app (React Native 0.88 + Expo SDK 58)
├── brand-film/             # Brand animation generator scripts
├── hero-loop/              # 15s seamless looping hero animation renderer
└── package.json            # Monorepo root scripts & workspace orchestration
```

### Subsystems

1. **Mobile App (`mobile/`)**
   - **Customer Experience**: Location-based services (campus drop-off vs. door-to-door home pickup), interactive booking, wallet top-up, digital receipts, order tracking with real-time progress timelines, scratch cards & offers.
   - **Staff Operations**: Role-based access via location PIN, QR code scanner (camera and numeric input), item count verification, lifecycle transitions, and issue resolution.
   - **Design**: Fully tokenized typography (Plus Jakarta Sans, Inter, Nunito), smooth spring micro-interactions (GSAP, Reanimated), dark/light adaptive aesthetics.

2. **Admin Portal (`admin/`)**
   - **Operations Management**: Live order dashboards, pickup scheduling, location management (enable/pause intake), staff allocation, customer support helpdesk, and audit logs.
   - **Mock Relay Engine**: Dev-only live snapshot relay syncing state across browser tabs, emulator sessions, and mobile devices in real time.

3. **Media & Creative Assets (`hero-loop/`, `brand-film/`)**
   - Python-powered deterministic artwork cutting, keyframing, and video rendering for seamless 60/30fps brand films and hero loop videos.

---

## CI/CD & Development Commands

### Root Monorepo Commands

You can run the entire test, lint, and build suite across all projects directly from the repository root:

| Command | Description |
| :--- | :--- |
| `npm run ci` | **Full CI Suite**: runs typechecking (admin + mobile), mobile linting, test scenarios, and admin build |
| `npm run typecheck` | Type-checks both `admin` and `mobile` workspaces |
| `npm run typecheck:mobile` | Type-checks only the mobile project (`tsc --noEmit`) |
| `npm run typecheck:admin` | Type-checks only the admin portal (`tsc --noEmit`) |
| `npm run lint` | Runs Expo / ESLint checks across mobile |
| `npm run test` | Executes laundry domain test scenarios (17 tests passing) |
| `npm run build:admin` | Production build of the Vite admin portal (`dist/`) |

### Mobile Commands (`cd mobile`)

```bash
cd mobile
npm install          # Install dependencies
npm run start        # Start Expo development server
npm run web          # Run Expo in web mode
npm run android      # Launch Android emulator / connected device
npm run ios          # Launch iOS simulator (macOS required)
npm run lint         # Run ESLint
npm run typecheck    # TypeScript compiler check
npm run test         # Run end-to-end laundry scenario tests
```

### Admin Portal Commands (`cd admin`)

```bash
cd admin
npm install          # Install dependencies
npm run dev          # Start local Vite development server (http://localhost:5180)
npm run build        # Typecheck & build production bundle into dist/
npm run preview      # Preview production build locally
```

---

## Continuous Integration (GitHub Actions)

A GitHub Actions workflow is configured under `.github/workflows/ci.yml`. On every `push` and `pull_request` to `main` or `master`:
- **Mobile CI**: Installs cached dependencies, validates TypeScript types, runs ESLint, and executes test suites.
- **Admin CI**: Installs cached dependencies, validates TypeScript types, and compiles a production bundle.
- **Concurrency**: Automatically cancels outdated in-progress runs when new commits are pushed.

---

## Environment Configuration

The mobile app includes a documented environment template:
- Copy `mobile/.env.example` to `mobile/.env` or `mobile/.env.local` to customize backend URLs or mock relays.

---

## License

Private / Proprietary. All rights reserved.

