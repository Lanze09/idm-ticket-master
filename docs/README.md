# IDM Ticket Master — Technical Documentation

This folder contains the technical guides for understanding, maintaining, and extending the IDM Ticket Master codebase.

## 📚 Read in this order

| # | Doc | When to read it |
|---|---|---|
| 1 | [ARCHITECTURE.md](ARCHITECTURE.md) | First. Stack choices, the five layers, request lifecycle, project structure annotated. |
| 2 | [DATA_MODEL.md](DATA_MODEL.md) | Schema, ER diagram, status state machine, SLA accounting, priority derivation, permission matrix. |
| 3 | [WORKFLOWS.md](WORKFLOWS.md) | End-to-end user journeys with sequence diagrams (login, create, acknowledge, SLA pause/resume, comments, auto-close, project privacy). |
| 4 | [API.md](API.md) | HTTP endpoint reference with request/response shapes, role gates, side effects. |

## 🧭 Where things live

| Question | Answer |
|---|---|
| How do I run the app? | [`../SETUP.md`](../SETUP.md) (non-technical) or [`../README.md`](../README.md) |
| What design decisions were made and why? | [`../README.md`](../README.md) → "Open questions / clarifications" |
| Where's the database schema? | [DATA_MODEL.md](DATA_MODEL.md) §2, or [`../src/lib/db.ts`](../src/lib/db.ts) `initSchema()` |
| Where's a specific business rule? | [ARCHITECTURE.md](ARCHITECTURE.md) §6 — "Where each business rule lives" |
| What HTTP endpoint does X? | [API.md](API.md) endpoint summary |
| How do I trace request → DB → response? | [WORKFLOWS.md](WORKFLOWS.md) — diagrams for each major flow |
| How do I swap SQLite for Postgres? | [ARCHITECTURE.md](ARCHITECTURE.md) §9 + rewrite [`../src/lib/db.ts`](../src/lib/db.ts) |
| Where do I add a new field to tickets? | [ARCHITECTURE.md](ARCHITECTURE.md) §8 — "Where to add things" |

## 🧠 The mental model in one paragraph

A user's browser hits a Next.js page. **Middleware** verifies the JWT cookie. The page (a **Server Component**) calls into the **domain layer** (`src/lib/`) which reads the **SQLite database** through a thin wrapper. The domain layer also enforces project-level privacy — non-admin queries are auto-scoped via the `user_projects` table — so role gating cannot be bypassed by client-side trickery. State transitions (status, severity, assignment, escalation) all funnel through one function (`updateTicket`) that recalculates derived state (priority, SLA expiry), writes audit-trail entries, and triggers email notifications. Every request that lists or reads tickets piggybacks an auto-expiry pass that closes inactive tickets older than 15 days, except those flagged escalated/production/high-priority.

## 🗂️ Quick file map

```
src/
├── middleware.ts          # JWT cookie gate
├── app/
│   ├── api/**/route.ts    # HTTP endpoints
│   └── dashboard/**/page.tsx  # Server Components
├── components/            # React UI
└── lib/                   # Business logic & data access
    ├── db.ts              # Persistence
    ├── auth.ts            # AuthN + AuthZ helpers
    ├── tickets.ts         # CRUD + state transitions + audit
    ├── sla.ts             # Severity windows, expiry math, auto-expiry rules
    ├── priority.ts        # Derived priority
    ├── email.ts           # Notifications (with console fallback)
    ├── seed.ts            # Demo data
    └── types.ts           # Shared TS types
```
