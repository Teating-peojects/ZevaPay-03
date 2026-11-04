# ZevaPay — Frontend

The ZevaPay web application: the public marketing site, the merchant
dashboard, and the platform admin console.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript in strict mode
- Tailwind CSS v4
- Lucide React icons
- React Hook Form + Zod
- Recharts

## Getting started

The front end needs the API and the database running. From the repository
root:

```bash
npm run setup   # Postgres + migrations + seed
npm run dev     # API and front end together
```

Or just the front end:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

| Variable              | Default                 | Notes                                  |
| --------------------- | ----------------------- | -------------------------------------- |
| `API_URL`             | `http://localhost:4000` | Where the API is. Server-side only      |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Fallback for `API_URL`                 |

Both are optional in development. Copy `.env.example` to `.env.local` to
change them.

## How it talks to the API

Browser code calls `/api/v1/...` on the app's **own origin**. A route
handler at `src/app/api/v1/[...path]/route.ts` proxies those calls to the API
service.

This is deliberate. The session cookie is `httpOnly` and `SameSite=Lax`, so a
cross-origin `fetch` with credentials would need an exact CORS allow-list
*and* would still have the cookie blocked. Keeping every request same-origin
avoids the problem entirely, and it lets the Server-Sent Events stream pipe
through without a buffering proxy in between.

Server components cannot set cookies, so they take a different path:
`src/lib/server-api.ts` forwards the caller's cookies to the API directly and
treats a 401 as "signed out".

## Sessions

`src/proxy.ts` runs on every `/dashboard/*`, `/admin/*` and `/api/v1/*`
request. The access token lasts 15 minutes; when it is close to expiring, the
proxy exchanges the refresh token for a new pair, rewrites the request
headers so the triggering request is not itself rejected, and writes the new
cookies onto the response.

## Routes

### Public

| Route              | Description              |
| ------------------ | ------------------------ |
| `/`                | Home — includes the Features (`#features`) and How It Works (`#how-it-works`) sections |
| `/contact`         | Contact                  |
| `/about`           | About                    |
| `/terms`           | Terms of service         |
| `/privacy`         | Privacy policy           |
| `/login`           | Sign in                  |
| `/register`        | Create an account        |
| `/forgot-password` | Request a reset link     |

### Merchant dashboard

| Route                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| `/dashboard`              | Overview: stats, activity, devices, accounts |
| `/dashboard/accounts`     | Payment accounts                             |
| `/dashboard/devices`      | Paired Android devices                       |
| `/dashboard/transactions` | Transaction history and the review queue     |
| `/dashboard/settings`     | Profile, security, sessions, API keys        |

### Admin console

| Route                 | Description                         |
| --------------------- | ----------------------------------- |
| `/admin`              | Platform-wide overview              |
| `/admin/users`        | Merchants registered on the platform |
| `/admin/transactions` | Transactions across all merchants   |
| `/admin/devices`      | Every device on the platform        |
| `/admin/settings`     | Administrator profile and counts    |

The two dashboards are fully independent — separate layouts, separate
navigation, separate data sets. A platform admin who opens `/dashboard` is
redirected to `/admin`, and a merchant who opens `/admin` is redirected back.

## Project structure

```
src/
  app/                    # Routes (public, dashboard, admin)
  app/api/v1/[...path]/   # Same-origin proxy to the API
  components/
    ui/                   # Design-system primitives
    shared/               # Domain components (data table, badges, modals)
    dashboard/            # Dashboard shell: sidebar, top nav
    marketing/            # Public site header and footer
    auth/                 # Shared auth layout
    brand/                # Logo
    layout/               # Page header
  hooks/
    use-server-table.ts   # Server-driven pagination, search and filters
    use-live-events.ts    # Subscribes to the Server-Sent Events feed
  lib/
    api-client.ts         # Typed fetch wrapper
    server-api.ts         # Server-side fetch with the session cookie
    live-events.ts        # The SSE client
    date-range.ts         # Date-range presets and their bounds
    schemas.ts            # Shared Zod schemas
    format.ts             # Currency, date, and number formatting
    nav-config.ts         # Sidebar navigation
    utils.ts              # `cn` class-name helper
  proxy.ts                # Session refresh
  types/api.ts            # Types mirroring the API contract
```

## Data fetching

Two patterns, chosen per page:

**Server components** read directly through `serverFetch()` and render the
result. Used for the two overview pages, which are the first thing a user
sees.

**Client components** use `useServerTable()` for anything with a list. The
hook owns the search term, the filters, the date range and the page number,
debounces the search term by 300 ms, and re-queries the API. `DataTable` then
renders whichever page came back. The same table component serves both
server-filtered and client-filtered pages.

Live updates arrive over Server-Sent Events. `useLiveEvents()` opens the
connection and reports the status, so a list can refresh itself when a
notification arrives on a counter phone.

## Design system

Tokens live in `src/app/globals.css` under `@theme`. The palette is a deep
navy brand ramp on cool light neutrals, with semantic `success`, `warning`,
`danger`, and `info` colours.

Primitives in `src/components/ui/` follow a consistent API: `Button`, `Card`,
`Badge`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`, `Table`, `Modal`,
`Tabs`, `Dropdown`, `Pagination`, `Alert`, `Avatar`, and the state components
(`EmptyState`, `Skeleton`, `StatCardSkeleton`, `TableSkeleton`).

Status badges are centralised in `src/components/shared/status-badge.tsx` and
use four transaction states — Success, Pending, Review, and Failed.

## Notes

- Public pages are statically prerendered. The dashboards are rendered per
  request because they read the session cookie; both dashboard layouts export
  `instant = false` for that reason.
- No token is ever read, written or stored by client-side JavaScript.
- There is no mock data. Every number on screen comes from the API, and the
  API returns what is actually in the database.
