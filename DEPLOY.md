# Deploying washingbasket.in

| Address | What it serves | Folder |
|---|---|---|
| `washingbasket.in` (and `www.`) | The website | `website/` |
| `admin.washingbasket.in` | The admin portal | `admin/` |
| `washingbasket.in/admin` | Forwards to `admin.washingbasket.in` | (redirect in `website/vercel.json`) |

The two apps are deployed as **two separate projects** from this one repository. Each folder has a
`vercel.json` with its build settings, so Vercel needs only the root directory.

## 1. Put the code on GitHub

`website/` must be committed and pushed (Vercel builds from the repository).

## 2. Create the two projects on Vercel

In Vercel → **Add New → Project** → import this repository, twice:

| Project | Root Directory | Notes |
|---|---|---|
| `washingbasket-website` | `website` | Add the `VITE_*` variables from `website/.env.example` if you have store links |
| `washingbasket-admin` | `admin` | Keep **Include files outside the root directory** on: the portal imports shared code from `mobile/` |

Everything else (framework, install and build commands, output folder) comes from each folder's `vercel.json`.

## 3. Attach the domains

- Website project → **Settings → Domains**: add `washingbasket.in` and `www.washingbasket.in`
  (set `www` to redirect to `washingbasket.in`).
- Admin project → **Settings → Domains**: add `admin.washingbasket.in`.

## 4. DNS records (at the registrar where washingbasket.in was bought)

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |
| CNAME | `admin` | `cname.vercel-dns.com` |

Vercel shows the exact values on the Domains page; use those if they differ. HTTPS certificates are issued
automatically once DNS resolves (minutes to a few hours).

## Using a different host

The same layout works anywhere: two static sites (each folder's `npm run build` → `dist/`), the admin one
with every path falling back to `index.html` (it uses client-side routing), and DNS pointing the apex at the
website and `admin` at the portal. Only the redirect and header rules in `vercel.json` would need rewriting
in that host's format.

## Before opening the admin portal to the internet

The portal currently runs on sample data with demo sign-in (`admin/src/lib/demoAuth.ts`). Anyone who finds
`admin.washingbasket.in` can open it. It is marked `noindex` so search engines skip it, but that is not
protection. Put real authentication (or the host's password protection) in front of it before it holds real
data.
