# IDM Ticket Master

Centralized ticketing system for IDM (Intelligent Data Migration) — built for Conversion Teams to raise issues and IDM Support to triage, assign, and resolve them with full SLA / audit-trail support.

> **First time running this?** Read **[SETUP.md](./SETUP.md)** — a step-by-step walkthrough written for non-technical users.
> **Want the deep dive?** Read **[`docs/`](./docs/)** — architecture, data model, workflows, and API reference (with Mermaid diagrams).

> Built per the requirements in `Ticketing System References/IDM_TicketSupport_Requirements_v5.xlsx` and `IDM-TICKET SUPPORT 1.pptx`.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Frontend / SSR | Next.js 14 (App Router) + React 18 | Single full-stack codebase, server components for fast auth-aware rendering |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`) | Catches role/field mistakes at compile time |
| Styling | Tailwind CSS + custom shadcn-style components | Fast iteration, Accenture-branded palette |
| Database | SQLite via `better-sqlite3` | Zero-config, single file, swap to Postgres later |
| Auth | Signed JWT cookies via `jose` + `bcryptjs` | Stateless, role + project resolution at login |
| Email | `nodemailer` (console fallback) | Works out-of-the-box for dev; SMTP via env |
| UI | `lucide-react` icons, `react-hot-toast` | Modern, lightweight |

---

## Quick start

```bash
cd Idm-ticket-master
pnpm install            # or npm install / yarn install
pnpm dev                # http://localhost:3000
```

The database is auto-created on first run and seeded with demo accounts and a few tickets.

### Demo accounts

| Email | Password | Role | Projects |
|---|---|---|---|
| `admin@idm.com` | `admin123` | Admin | All |
| `backup.admin@idm.com` | `admin123` | Admin | All |
| `northwind.user@idm.com` | `user123` | User | Northwind |
| `contoso.user@idm.com` | `user123` | User | Contoso |
| `multi.user@idm.com` | `user123` | User | Northwind + Fabrikam |

> Role and project list are resolved at login from the `users` and `user_projects` tables — there is no UI toggle.

---

## Features mapped to requirements

### Roles & access
- Two roles only: **Admin** (IDM Support) and **User** (Conversion Team) — resolved from credentials.
- Project-level data privacy enforced server-side in `listTicketsForSession` / `getTicketByIdForSession`.
- Non-admins cannot see SLA expiry, expiring-soon, or escalation columns/filters anywhere.
- Severity is always read-only for users; the API rejects severity edits from non-admins (`FORBIDDEN_FIELDS`).

### Ticket creation
- Auto-populated, read-only: **Ticket Number** (`IDM-YYYYMM-NNNN`), **Created By**, **Date Created**, **Project**.
- User fills: **Encountered In**, **Issue / Description**, **Go-Live? Yes/No**, **Production? Yes/No**, **MOCK Lifecycle**.
- Defaults on creation: `Status=New`, `Severity=Low`, `Assigned To=blank`.
- Admin sees additional fields on creation: Severity, Status, Assign To.

### Severity vs Priority
- **Severity** = technical complexity, admin-only.
- **Priority** is *derived* (`src/lib/priority.ts`) from: production flag → severity Critical → go-live → severity High → SLA proximity. Production / Critical bumps Priority to High; SLA expiring soon bumps it up one notch.
- Priority is shown on dashboards but never editable.

### MOCK Lifecycle
- Dropdown with: Mock0–Mock9, PRE-SIT, SIT, UAT, RECON, PROD.

### Status lifecycle
`New → Open → Pending / On-Hold → Open → Closed` is enforced via the admin Status dropdown plus state transitions in `updateTicket`. Auto-close after 15 days inactivity is implemented in `runAutoExpiry()` and runs on every list/read.

### SLA / expiry / escalation
- SLA window per severity is defined in `src/lib/sla.ts`.
- SLA starts on first admin acknowledgement (status moves out of `New` or first assignment).
- `Pending` and `On-Hold` pause the SLA; resuming recalculates the expiry from accumulated paused time.
- Severity changes recalculate expiry.
- Escalated, Production, or Priority=High tickets are excluded from auto-expiry (`isAutoExpiryAllowed`).
- Admin dashboard surfaces `Expired`, `Expiring soon`, and `On track` indicators.

### Dashboard
- Tabs: **Open Tickets** / **Closed Tickets** with live counts.
- User-visible columns: Ticket #, Encountered In, Issue, Status, Date Created, Severity, Priority, Created By, Assigned To, Mock, Prod / Go-Live.
- Admin-only columns: Project, SLA Expiry, Risk indicator (Expired / Expiring soon / On track / Escalated).
- Search across ticket number, issue, encountered-in.
- Filters: Project, Status, plus admin-only **Expiry** filter.

### Ticket details page
- Two tabs: **Ticket Details** and **Activities** (full audit trail).
- All admin actions (status / severity / assignment / escalation) auto-log a system entry to the Activities tab.
- Users can post activity comments; non-admins cannot edit closed tickets.

### Notifications
- Sent on: ticket creation, status change, severity change, assignment, escalation, and any "Save".
- Recipients: comma-separated lists in `EMAIL_IDM_DISTRIBUTION` and `EMAIL_CONVERSION_DISTRIBUTION`.
- If no SMTP host is configured the email body is logged to the dev console (with subject + To list) so you can verify the flow without an external service.

---

## Project structure

```
Idm-ticket-master/
├── README.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.example
├── data/                       # SQLite db lives here (gitignored)
└── src/
    ├── middleware.ts           # Auth gate
    ├── lib/
    │   ├── db.ts               # better-sqlite3 connection + schema
    │   ├── auth.ts             # JWT cookies, bcrypt, project resolution
    │   ├── tickets.ts          # CRUD + SLA + audit trail
    │   ├── projects.ts
    │   ├── users.ts
    │   ├── sla.ts              # Severity windows + indicators + auto-expiry rules
    │   ├── priority.ts         # Derived priority + badge styles
    │   ├── ticket-number.ts
    │   ├── email.ts            # Nodemailer + console fallback
    │   ├── seed.ts             # Demo data (idempotent)
    │   ├── types.ts
    │   └── utils.ts
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx            # /  → login
    │   ├── api/
    │   │   ├── auth/{login,logout,me}/route.ts
    │   │   ├── tickets/route.ts
    │   │   ├── tickets/[id]/route.ts
    │   │   ├── tickets/[id]/activities/route.ts
    │   │   ├── projects/route.ts
    │   │   └── admins/route.ts
    │   └── dashboard/
    │       ├── layout.tsx
    │       ├── page.tsx        # Dashboard with tabs + filters
    │       └── tickets/
    │           ├── new/page.tsx
    │           └── [id]/page.tsx
    └── components/
        ├── topbar.tsx
        ├── login-form.tsx
        ├── dashboard.tsx
        ├── ticket-table.tsx
        ├── ticket-create-form.tsx
        └── ticket-details.tsx
```

---

## Open questions / clarifications I made on your behalf

These are best-guesses worth your sign-off:

1. **SLA windows by severity** — set to Low=2d, Medium=3d, High=5d, Critical=7d (matching the slide that says "Missing functionality / Major Error within 3-5 days" etc.). Tweak in `src/lib/sla.ts`.
2. **Auto-close inactivity window** — 15 days, per the lifecycle diagram. Inactive `New` and `Open` tickets are auto-closed unless they're escalated, production, or priority=High.
3. **Severity values** — I went with **Low / Medium / High / Critical** (matching the test sheet's "at minimum the following options"). Adjust the `Severity` type if you prefer a different set.
4. **Authentication** — local email/password auth with seeded users. Accenture SSO referenced in the test sheet is mocked (the SSO button is omitted; demo accounts are visible on the login screen for quick testing).
5. **Ticket number format** — `IDM-YYYYMM-NNNN` (year-month plus a 4-digit global sequence).
6. **Single-app, role-based UI** — confirmed. There are no separate "admin pages" / "user pages"; all role gating is field-level inside shared screens.
7. **Email** — when `SMTP_HOST` is unset the system logs the email to the console so you can see exactly what *would* have been sent. Set the SMTP env vars to send for real.

If any of these don't match your intended design, change the constants/types and the rest of the system will follow.
