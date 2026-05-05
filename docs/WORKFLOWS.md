# End-to-end workflows

Each section below traces one full user journey — from the click in the browser through middleware, API, domain layer, and database — using sequence diagrams plus the exact files involved.

> Read [ARCHITECTURE.md](ARCHITECTURE.md) first if you want the layer model these flows are built on.

---

## Workflow 1 — Login & session establishment

**Triggered by:** clicking "Sign in" on `/`.

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Mw as middleware.ts
    participant Page as app/page.tsx
    participant API as /api/auth/login<br/>route.ts
    participant Auth as src/lib/auth.ts
    participant DB as data/idm-ticket-master.db

    Browser->>Mw: GET /
    Mw->>Mw: no cookie → public route
    Mw->>Page: render LoginForm
    Page-->>Browser: HTML

    Browser->>API: POST /api/auth/login<br/>{email, password}
    API->>Auth: seedIfEmpty()
    Auth->>DB: COUNT(*) FROM users
    alt empty
        Auth->>DB: INSERT projects, users, tickets
    end
    API->>Auth: authenticate(email, password)
    Auth->>DB: SELECT * FROM users WHERE email = ?
    DB-->>Auth: {id, role, password_hash}
    Auth->>Auth: bcrypt.compareSync(password, hash)
    alt invalid
        API-->>Browser: 401 Invalid credentials
    end
    API->>Auth: createSession({userId, role, ...})
    Auth->>Auth: SignJWT.sign(AUTH_SECRET) → JWT
    API->>Browser: 200 + Set-Cookie: idm_session=...

    Browser->>Mw: GET /dashboard (cookie attached)
    Mw->>Mw: jwtVerify(cookie) ✓
    Mw->>Browser: serve /dashboard
```

**Files touched:**
- [src/app/page.tsx](../src/app/page.tsx) — login screen with demo-account quick-fill
- [src/components/login-form.tsx](../src/components/login-form.tsx) — POSTs to the API
- [src/app/api/auth/login/route.ts](../src/app/api/auth/login/route.ts) — orchestrator
- [src/lib/auth.ts](../src/lib/auth.ts) — `authenticate`, `createSession`, `setSessionCookie`
- [src/lib/seed.ts](../src/lib/seed.ts) — runs on first-ever login if users table empty
- [src/middleware.ts](../src/middleware.ts) — gates every subsequent request

**Notable:**
- Database is **lazy-seeded** on the first login attempt — there's no separate seed step required.
- The cookie is **HttpOnly** (no JS access), **SameSite=Lax**, 12-hour expiry.
- Middleware uses the `jose` library, which is Edge-runtime compatible — meaning auth checks happen at the very edge before any Server Component renders.

---

## Workflow 2 — User creates a ticket

**Triggered by:** non-admin clicks "+ Create ticket" → fills form → "Save".

```mermaid
sequenceDiagram
    autonumber
    participant U as User Browser
    participant Page as /dashboard/tickets/new
    participant API as POST /api/tickets
    participant Tick as src/lib/tickets.ts<br/>createTicket
    participant TN as src/lib/ticket-number.ts
    participant Pri as src/lib/priority.ts
    participant DB as SQLite
    participant Em as src/lib/email.ts

    U->>Page: GET (RSC)
    Page->>Page: getSession() + listProjectsForUser()
    Page-->>U: form pre-filled with name, email, date

    U->>API: POST /api/tickets<br/>{projectId, encounteredIn, issue, goLive, production, mockLifecycle}
    API->>API: getSession() → role=user
    API->>API: drop adminFields (severity/status/assignedToId)
    API->>Tick: createTicket(args)
    Tick->>DB: SELECT 1 FROM user_projects WHERE user_id=? AND project_id=?
    alt not member
        Tick-->>API: throw FORBIDDEN_PROJECT (→ 403)
    end
    Tick->>TN: nextTicketNumber()
    TN->>DB: COUNT(*) FROM tickets
    TN-->>Tick: "IDM-202605-0004"
    Tick->>Pri: derivePriority({severity:Low, goLive, production, ...})
    Pri-->>Tick: "Low" (no flags)
    Tick->>DB: INSERT INTO tickets (status='New', severity='Low', assigned_to_id=NULL, ...)
    Tick->>DB: INSERT INTO activities ('system', 'Ticket created')
    Tick-->>API: TicketRow
    API->>Em: sendTicketNotification('created', ticket)
    Em->>Em: SMTP_HOST unset → console.log('[email:mock]...')
    API-->>U: 200 { ticket }
    U->>U: router.push(`/dashboard/tickets/${id}`)
```

**Defaults applied at creation (per the requirements):**
- `status = 'New'`
- `severity = 'Low'`
- `assigned_to_id = NULL`
- `acknowledged_at = NULL` (SLA hasn't started)

**What an admin can override at creation time:** severity, status, assigned-to. The API route only adds those to the body if `session.role === 'admin'`. Even if a user crafts a request with these fields, the route silently drops them.

**Files touched:**
- [src/app/dashboard/tickets/new/page.tsx](../src/app/dashboard/tickets/new/page.tsx)
- [src/components/ticket-create-form.tsx](../src/components/ticket-create-form.tsx)
- [src/app/api/tickets/route.ts](../src/app/api/tickets/route.ts)
- [src/lib/tickets.ts](../src/lib/tickets.ts) → `createTicket`

---

## Workflow 3 — Admin acknowledges a New ticket (the moment SLA starts)

**Triggered by:** admin opens a `New` ticket and changes Status to `Open` (or assigns themselves).

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin Browser
    participant API as PATCH /api/tickets/[id]
    participant U as updateTicket
    participant SLA as src/lib/sla.ts
    participant Pri as src/lib/priority.ts
    participant DB as SQLite
    participant Em as email.ts

    A->>API: PATCH /api/tickets/1<br/>{status: 'Open', assignedToId: 1}
    API->>U: updateTicket
    U->>DB: SELECT * FROM tickets WHERE id=1
    DB-->>U: row {status:'New', acknowledged_at:NULL}
    U->>U: detect first acknowledgement<br/>(was 'New', will be 'Open', no ack timestamp)
    U->>U: acknowledged_at = now
    U->>SLA: calculateExpiry(now, severity='Low', pausedMs=0)
    SLA-->>U: now + 2 days
    U->>U: was/will paused? both false → no pause math
    U->>Pri: derivePriority(updated)
    Pri-->>U: 'Low'
    U->>DB: UPDATE tickets SET status='Open',<br/>assigned_to_id=1, acknowledged_at=now,<br/>sla_expires_at=now+2d
    U->>DB: INSERT activities ('system', 'Status: New → Open')
    U->>DB: INSERT activities ('system', 'Assigned to: Alex Admin')
    U-->>API: TicketRow (updated)
    API->>Em: sendTicketNotification('status_changed')
    API->>Em: sendTicketNotification('assigned')
    API-->>A: 200 { ticket }
```

**Why two activity entries:** the audit trail records each *kind* of change separately so a future hand-over reader can see "what happened, in which order, by whom".

**Why two emails:** two distinct events occurred (status changed AND assignment changed). The route loops the `events` array and fires one per event.

**SLA math at this point:**
```
acknowledged_at  = 2026-05-06T10:00:00Z
severity         = Low → window = 2 days = 172,800,000 ms
paused_ms        = 0
sla_expires_at   = 2026-05-06T10:00:00Z + 172,800,000 ms
                 = 2026-05-08T10:00:00Z
```

---

## Workflow 4 — SLA pause / resume (Pending or On-Hold)

**Triggered by:** admin sets status to `Pending` (waiting on requester) or `On-Hold` (waiting on third party), then later returns it to `Open`.

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant U as updateTicket
    participant DB as SQLite

    Note over A,DB: Ticket in Open. acknowledged_at=T0, expires=T0+window

    A->>U: PATCH {status: 'Pending'}
    U->>DB: read ticket
    U->>U: wasPaused=false, willBePaused=true
    U->>U: sla_paused_at = now (call it Tp)
    U->>DB: UPDATE tickets ...

    Note over A,DB: ⏸ SLA timer is now paused (Tp)

    A->>U: PATCH {status: 'Open'} (some hours later, call it Tr)
    U->>DB: read ticket
    U->>U: wasPaused=true, willBePaused=false
    U->>U: paused_ms = Tr - Tp (this pause's duration)
    U->>U: sla_accumulated_paused_ms += paused_ms
    U->>U: sla_paused_at = NULL
    U->>U: sla_expires_at = T0 + window(severity) + accumulated_paused_ms
    U->>DB: UPDATE tickets ...
```

**Result:** the expiry is pushed forward by exactly the time the ticket sat in Pending/On-Hold. Multiple pause-resume cycles accumulate correctly because we store `sla_accumulated_paused_ms`, not just the latest pause.

---

## Workflow 5 — User adds a comment

**Triggered by:** any user (or admin) types in the Activities tab and clicks "Post".

```mermaid
sequenceDiagram
    autonumber
    participant U as Browser
    participant API as POST /api/tickets/[id]/activities
    participant DB as SQLite

    U->>API: POST { message: "Re-tested..." }
    API->>API: getSession()
    API->>DB: getTicketByIdForSession()<br/>(enforces project membership)
    alt user not in project
        API-->>U: 404 NOT_FOUND
    end
    API->>DB: INSERT INTO activities (type='comment', message=..., user_id=...)
    API->>DB: SELECT activity JOIN user
    API-->>U: 200 { activity }
    U->>U: append to local list, clear textarea
```

**Why it's safe:** the comment endpoint goes through `getTicketByIdForSession`, which enforces project membership. A user can never post a comment on a ticket from a project they're not in — the lookup returns `null`, which becomes a 404.

---

## Workflow 6 — Admin changes severity (and the SLA recalc that follows)

**Triggered by:** admin edits severity on an already-acknowledged ticket.

```mermaid
sequenceDiagram
    autonumber
    participant A as Admin
    participant U as updateTicket
    participant SLA as sla.ts
    participant Pri as priority.ts
    participant DB as SQLite

    A->>U: PATCH {severity: 'High'}
    U->>DB: read ticket {acknowledged_at:T0, severity:'Low', paused_ms:Pms}
    U->>U: severity changed AND already acknowledged
    U->>SLA: calculateExpiry(T0, 'High', Pms)
    SLA-->>U: T0 + 5 days + Pms
    U->>Pri: derivePriority(updated)
    Pri-->>U: severity High → priority Medium (unless production/etc)
    U->>DB: UPDATE tickets SET severity='High', priority='Medium', sla_expires_at=...
    U->>DB: INSERT activities ('system', 'Severity changed: Low → High')
```

**If the ticket is still `New` (not yet acknowledged):** severity is updated, but `sla_expires_at` stays NULL. The recalc only runs `if (acknowledged_at)`.

---

## Workflow 7 — Auto-close after 15 days inactivity

**Triggered by:** any user listing or reading tickets. The check piggybacks on every read so we don't need a cron job for the demo.

```mermaid
sequenceDiagram
    autonumber
    participant Any as Any user
    participant List as listTicketsForSession
    participant Auto as runAutoExpiry
    participant DB as SQLite
    participant SLA as sla.ts

    Any->>List: GET /api/tickets
    List->>Auto: runAutoExpiry(now)
    Auto->>DB: SELECT id FROM tickets<br/>WHERE status IN ('New','Open')<br/>AND updated_at < (now - 15 days)
    DB-->>Auto: candidate IDs
    loop each candidate
        Auto->>DB: SELECT * FROM tickets WHERE id=?
        DB-->>Auto: ticket row
        Auto->>SLA: isAutoExpiryAllowed(ticket)
        alt escalated OR production OR priority='High'
            SLA-->>Auto: false → skip
        else
            SLA-->>Auto: true
            Auto->>DB: UPDATE tickets SET status='Closed', closed_at=now
            Auto->>DB: INSERT activities ('system', 'Auto-closed after 15 days...')
        end
    end
    Auto-->>List: done
    List->>DB: SELECT tickets ... (the actual list query)
    List-->>Any: tickets[]
```

**For production:** move `runAutoExpiry` to a scheduled job (cron, Vercel Cron, GitHub Actions on a schedule) so it doesn't pay the cost on every list call. The current piggyback approach is fine for the demo.

---

## Workflow 8 — Project-level data privacy enforcement

This isn't really a workflow — it's a *rule* applied to every list/read. But it's worth showing because it's the single most important security property of the app.

```mermaid
flowchart TD
    Req["Request from user X<br/>for ticket #N"]
    Sess["getSession() → {userId, role}"]
    Q{role === 'admin'?}
    AdminPath["No project filter applied"]
    UserPath["JOIN user_projects on (user_id=X)<br/>WHERE t.project_id IN (...)"]
    Read["SELECT ticket"]
    Found{row returned?}
    Hide["404 NOT_FOUND<br/>(also blocks read on activities)"]
    Show["200 ticket"]

    Req --> Sess --> Q
    Q -- yes --> AdminPath --> Read
    Q -- no --> UserPath --> Read
    Read --> Found
    Found -- yes --> Show
    Found -- no --> Hide
```

**Important property:** when a user requests a ticket from a project they're not in, the response is **404, not 403**. This means a user cannot enumerate or distinguish "ticket exists but I can't see it" from "ticket doesn't exist". The data simply doesn't exist from their perspective.

This rule is enforced in [`getTicketByIdForSession`](../src/lib/tickets.ts) and [`listTicketsForSession`](../src/lib/tickets.ts).

---

## Workflow 9 — Email notification flow

```mermaid
flowchart TD
    Event["Ticket event<br/>(created / status_changed / severity_changed / assigned / escalated / updated)"]
    Send["sendTicketNotification(event, ticket)"]
    GetTx["getTransporter()<br/>= SMTP_HOST set?"]
    Recipients["EMAIL_IDM_DISTRIBUTION + EMAIL_CONVERSION_DISTRIBUTION"]
    Subject["subjectMap[event] →<br/>'[IDM] Status updated — IDM-202605-0001'"]
    Body["Ticket #, Issue, Status, Severity, Priority, Assignee, Project"]
    Real["nodemailer.sendMail()"]
    Console["console.log('[email:mock]...')"]

    Event --> Send
    Send --> GetTx
    GetTx -- "SMTP set" --> Real
    GetTx -- "SMTP empty" --> Console
    Recipients --> Real
    Recipients --> Console
    Subject --> Real
    Subject --> Console
    Body --> Real
    Body --> Console
```

**Files:** [src/lib/email.ts](../src/lib/email.ts).

**Console fallback:** lets the developer see exactly what *would* have been sent — useful for verifying your event-to-recipient mapping without an SMTP service.

---

## Cross-workflow connections (the "everything is connected" map)

```mermaid
flowchart TD
    subgraph Auth
        Login --> Cookie
    end
    subgraph Privacy["Project-level privacy"]
        Cookie --> Session
        Session --> ProjectFilter
    end
    subgraph Lifecycle["Status & SLA"]
        Create --> Status[New]
        Status --> Ack[Open: SLA starts]
        Ack --> Pause[Pending/On-Hold: SLA paused]
        Pause --> Ack
        Ack --> Resolve[Closed]
        Status --> AutoClose[Closed by 15-day rule]
        Ack --> AutoClose
    end
    subgraph Derived
        Severity --> Priority
        ProductionFlag --> Priority
        GoLiveFlag --> Priority
        SLAProximity --> Priority
        Severity --> SLAWindow
        SLAWindow --> SLAExpiry
        Ack --> SLAExpiry
        Pause --> SLAExpiry
    end
    subgraph Audit["Audit trail"]
        Lifecycle --> Activities[(activities)]
        Severity --> Activities
        Comments --> Activities
        Assignment --> Activities
    end
    subgraph Notify["Notifications"]
        Lifecycle --> Email
        Severity --> Email
        Assignment --> Email
        Create --> Email
    end

    ProjectFilter --> Lifecycle
    ProjectFilter --> Audit
```

This is the whole system. Every change to a ticket touches:
1. **Project privacy** — was the actor allowed?
2. **Lifecycle** — what status/SLA transition is implied?
3. **Derived state** — re-derive priority + recalc SLA expiry
4. **Audit trail** — append a system entry
5. **Notification** — fire one or more emails

If you ever add a new field, follow that same five-step ritual.

---

## Where to go next

- [DATA_MODEL.md](DATA_MODEL.md) — the schema each workflow touches
- [API.md](API.md) — the request/response shapes for each endpoint used above
- [ARCHITECTURE.md](ARCHITECTURE.md) — the layer model these flows live within
