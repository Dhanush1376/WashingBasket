# Deploying Washing Basket

One Vercel project serves both apps:

| Address | What it serves |
|---|---|
| `washingbasket.vercel.app` (later `washingbasket.in`) | The website (`website/`) |
| `washingbasket.vercel.app/admin` (later `washingbasket.in/admin`) | The admin portal (`admin/`) |

## How it works

The Vercel project's **Root Directory** is `website`. `website/vercel.json` does the rest:

1. **Install:** the website's packages, then the admin portal's (`../admin`).
2. **Build:** the website, then the admin portal with `ADMIN_BASE=/admin/` (so its links, assets and routes
   live under `/admin`), then `website/scripts/add-admin.mjs` copies `admin/dist` into `website/dist/admin`.
3. **Routing:** any `/admin/...` address that isn't a file is answered with `/admin/index.html`, so links such
   as `/admin/orders` open directly. `/admin` is marked `noindex` so search engines skip it.

Keep **Include files outside the root directory** on in the project settings (Vercel's default), since the
build reaches into `../admin` and `../mobile`.

To try the combined build locally (in Git Bash, set `MSYS_NO_PATHCONV=1` first so `/admin/` isn't turned
into a Windows path):

```bash
cd website && npm run build && ADMIN_BASE=/admin/ npm --prefix ../admin run build && node scripts/add-admin.mjs
```

## Adding washingbasket.in later

Once the domain is bought: Vercel project → **Settings → Domains** → add `washingbasket.in` and
`www.washingbasket.in`, then add the DNS records Vercel shows at the registrar (usually an `A` record for `@`
to `76.76.21.21` and a `CNAME` for `www` to `cname.vercel-dns.com`). The admin portal then lives at
`washingbasket.in/admin` with no further changes.

A separate `admin.washingbasket.in` is also possible later: create a second project with Root Directory
`admin` (it has its own `admin/vercel.json`) and add that subdomain to it. Nested names under `vercel.app`
(such as `admin.washingbasket.vercel.app`) are not possible on Vercel.

## Before the admin portal holds real data

It currently runs on sample data with demo sign-in (`admin/src/lib/demoAuth.ts`), so anyone who finds `/admin`
can open it. Put real authentication in front of it before it holds real data.
