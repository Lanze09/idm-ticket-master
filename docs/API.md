# API reference

All HTTP endpoints under `/api/*`. Every endpoint requires a valid session cookie except `/api/auth/login`.

> Implementation lives in [`src/app/api/**/route.ts`](../src/app/api/). Domain rules in [`src/lib/`](../src/lib/).

---

## Authentication model

- **Header:** `Cookie: idm_session=<JWT>`
- **JWT payload:** `{ userId, email, name, role }`
- **TTL:** 12 hours
- **Set by:** `POST /api/auth/login` (`Set-Cookie: idm_session=...; HttpOnly; SameSite=Lax`)
- **Cleared by:** `POST /api/auth/logout`

If a request lacks a valid cookie:
- **API requests** → `401 { "error": "UNAUTHORIZED" }`
- **Page requests** → `302` redirect to `/`

---

## Endpoint summary

| Method | Path | Auth | Role | What it does |
|---|---|---|---|---|
| POST | `/api/auth/login` | None | — | Sign in, set cookie |
| POST | `/api/auth/logout` | None | — | Clear cookie |
| GET | `/api/auth/me` | Cookie | Any | Current user + their projects |
| GET | `/api/projects` | Cookie | Any | Project list (admin: all; user: their own) |
| GET | `/api/admins` | Cookie | **Admin** | Admin user list (for assignment dropdown) |
| GET | `/api/tickets` | Cookie | Any | List tickets (filtered by role + project) |
| POST | `/api/tickets` | Cookie | Any | Create ticket (admin gets extra fields) |
| GET | `/api/tickets/:id` | Cookie | Any | Single ticket (404 if not in project) |
| PATCH | `/api/tickets/:id` | Cookie | Any | Update (admin-only fields silently dropped for users) |
| GET | `/api/tickets/:id/activities` | Cookie | Any | Audit trail |
| POST | `/api/tickets/:id/activities` | Cookie | Any | Add a comment |

---

## `POST /api/auth/login`

Authenticate and set the session cookie.

**Request**
```json
{
  "email": "admin@idm.com",
  "password": "admin123"
}
```

**Response — 200**
```json
{
  "ok": true,
  "user": {
    "userId": 1,
    "email": "admin@idm.com",
    "name": "Alex Admin",
    "role": "admin"
  }
}
```
+ `Set-Cookie: idm_session=eyJ...; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`

**Errors**
- `400` — missing email or password
- `401` — `{ "error": "Invalid credentials" }`

**Side effect:** if the database has zero users, `seedIfEmpty()` runs first to populate demo data.

---

## `POST /api/auth/logout`

**Response — 200**
```json
{ "ok": true }
```
Cookie is cleared via `Set-Cookie: idm_session=; Max-Age=0`.

---

## `GET /api/auth/me`

Returns the current user with their project memberships.

**Response — 200**
```json
{
  "user": {
    "id": 4,
    "email": "multi.user@idm.com",
    "name": "Mira Multi",
    "role": "user",
    "projects": [
      { "id": 1, "code": "NORTHWIND", "name": "Northwind Trading Co." },
      { "id": 3, "code": "FABRIKAM", "name": "Fabrikam Logistics" }
    ]
  }
}
```

**Errors:** `401` if no cookie.

---

## `GET /api/projects`

Lists projects the caller can see.

| Role | What's returned |
|---|---|
| Admin | All projects in the system |
| User | Only projects in `user_projects` for their userId |

**Response — 200**
```json
{
  "projects": [
    { "id": 1, "code": "NORTHWIND", "name": "Northwind Trading Co." },
    { "id": 2, "code": "CONTOSO", "name": "Contoso Manufacturing" }
  ]
}
```

---

## `GET /api/admins`

Returns the list of admins — used to populate the "Assign To" dropdown.

**Response — 200**
```json
{
  "admins": [
    { "id": 1, "email": "admin@idm.com", "name": "Alex Admin", "role": "admin" },
    { "id": 5, "email": "backup.admin@idm.com", "name": "Bea Backup", "role": "admin" }
  ]
}
```

**Errors:** `403 { "error": "FORBIDDEN" }` if caller is not an admin.

---

## `GET /api/tickets`

Lists tickets visible to the caller.

**Query parameters**

| Param | Values | Default | Notes |
|---|---|---|---|
| `status` | `open` \| `closed` \| `all` | `all` | `open` excludes Closed; `closed` is exactly Closed |
| `projectId` | integer | (any project the caller can see) | Filter by one project |
| `search` | string | — | Matches ticket_number, issue, encountered_in (LIKE) |
| `expiry` | `expired` \| `expiring` \| `all` | `all` | **Admin only.** Computed from `slaIndicators`. |

**Response — 200**
```json
{
  "tickets": [
    {
      "id": 3,
      "ticketNumber": "IDM-202605-0003",
      "projectId": 3,
      "createdById": 4,
      "encounteredIn": "Production cutover",
      "issue": "During PROD cutover, IDM job hangs at ...",
      "goLive": 1,
      "production": 1,
      "mockLifecycle": "PROD",
      "status": "Open",
      "severity": "High",
      "priority": "High",
      "assignedToId": 1,
      "escalated": 0,
      "acknowledgedAt": "2026-05-06T03:35:00.000Z",
      "slaPausedAt": null,
      "slaAccumulatedPausedMs": 0,
      "slaExpiresAt": "2026-05-11T03:35:00.000Z",
      "closedAt": null,
      "createdAt": "2026-05-06T03:35:00.000Z",
      "updatedAt": "2026-05-06T03:35:00.000Z",
      "projectCode": "FABRIKAM",
      "projectName": "Fabrikam Logistics",
      "createdByName": "Mira Multi",
      "createdByEmail": "multi.user@idm.com",
      "assignedToName": "Alex Admin",
      "assignedToEmail": "admin@idm.com"
    }
  ]
}
```

**Side effect:** `runAutoExpiry()` runs first — any New/Open tickets older than 15 days (and not protected) flip to Closed.

**Privacy:** for non-admins, the SQL `WHERE` clause is auto-augmented with `t.project_id IN (...)`. They see only their projects' tickets.

---

## `POST /api/tickets`

Create a new ticket.

**Request — user role**
```json
{
  "projectId": 1,
  "encounteredIn": "Mock4 run",
  "issue": "Date format mismatch in customer extract",
  "goLive": true,
  "production": false,
  "mockLifecycle": "Mock4"
}
```

**Request — admin role (admin can override defaults)**
```json
{
  "projectId": 1,
  "encounteredIn": "Mock4 run",
  "issue": "...",
  "goLive": true,
  "production": false,
  "mockLifecycle": "Mock4",
  "severity": "Medium",
  "status": "Open",
  "assignedToId": 5
}
```

**Required fields:** `projectId`, `encounteredIn`, `issue`.

**Defaults applied (when not admin or admin omits):** `status='New'`, `severity='Low'`, `assignedToId=null`.

**Response — 200** (same shape as the list endpoint, single ticket)

**Errors**
- `400` — missing required fields, or domain-validation rejection
- `403` — `FORBIDDEN_PROJECT` (user trying to create on a project they're not in)

**Side effects**
- A `system` activity entry: `"Ticket created"`.
- `sendTicketNotification('created', ticket)` — email or console fallback.

---

## `GET /api/tickets/:id`

Single ticket. Project privacy applies — non-admins get `404` for tickets in projects they're not assigned to.

**Errors**
- `400` — non-numeric id (`BAD_ID`)
- `404` — ticket doesn't exist OR caller can't see it

---

## `PATCH /api/tickets/:id`

Update a ticket. **Admin-only fields are silently dropped from non-admin requests.**

**User-allowed fields**
```json
{
  "encounteredIn": "...",
  "issue": "...",
  "goLive": true,
  "production": false,
  "mockLifecycle": "PRE-SIT"
}
```

**Admin-only additional fields**
```json
{
  "severity": "High",
  "status": "Open",
  "assignedToId": 5,
  "escalated": true
}
```

**Side effects (per change)**

| What changed | Activity entry | Email event |
|---|---|---|
| `status` | `Status changed: <old> → <new>` | `status_changed` |
| `severity` | `Severity changed: <old> → <new>` | `severity_changed` |
| `assignedToId` | `Assigned to: <name>` (or `unassigned`) | `assigned` |
| `escalated` true→false or false→true | `Ticket escalated` / `Escalation cleared` | `escalated` |
| Any user-detail field | `Ticket details updated` | `updated` |
| No effective change | — | `updated` (the requirement: "every Save sends a notification") |

**SLA side effects**

| Trigger | Effect |
|---|---|
| First admin acknowledgement (status: New→Open OR first assignment) | `acknowledged_at = now`; `sla_expires_at = now + window(severity)` |
| Status enters Pending or On-Hold | `sla_paused_at = now` |
| Status leaves Pending/On-Hold | `sla_accumulated_paused_ms += now - sla_paused_at`; expiry recalculated |
| Severity changes (after acknowledgement) | `sla_expires_at` recalculated for the new window |
| Status becomes Closed | `closed_at = now`; SLA stops |

**Errors**
- `400` — `BAD_ID`, malformed body
- `403` —
  - `FORBIDDEN` — user editing a ticket they don't own / not in project
  - `FORBIDDEN_FIELDS` — user tried to edit severity/status/assignedToId/escalated explicitly (the API drops these silently, but the domain layer also rejects them as defense-in-depth)
  - `TICKET_CLOSED` — user editing a Closed ticket
- `404` — `NOT_FOUND`

---

## `GET /api/tickets/:id/activities`

Returns the chronological audit trail for a ticket.

**Response — 200**
```json
{
  "activities": [
    {
      "id": 1, "ticketId": 3, "userId": 4, "userName": "Mira Multi",
      "type": "system", "message": "Ticket created",
      "createdAt": "2026-05-06T03:35:00.000Z"
    },
    {
      "id": 2, "ticketId": 3, "userId": 1, "userName": "Alex Admin",
      "type": "system", "message": "Status changed: New → Open",
      "createdAt": "2026-05-06T03:36:00.000Z"
    },
    {
      "id": 3, "ticketId": 3, "userId": 1, "userName": "Alex Admin",
      "type": "comment", "message": "Investigating the transform step.",
      "createdAt": "2026-05-06T03:40:00.000Z"
    }
  ]
}
```

**Errors:** `404` if ticket isn't visible to caller.

---

## `POST /api/tickets/:id/activities`

Add a human comment to the audit trail.

**Request**
```json
{ "message": "Re-tested with the latest patch — same error reproduces." }
```

**Response — 200**
```json
{
  "activity": {
    "id": 7, "ticketId": 3, "userId": 4, "userName": "Mira Multi",
    "type": "comment", "message": "Re-tested with the latest patch...",
    "createdAt": "2026-05-06T04:10:00.000Z"
  }
}
```

**Errors**
- `400` — empty `message`
- `404` — ticket not visible to caller

> **Note:** posting comments does NOT trigger an email notification (per the requirements — "Save" triggers, but free-form comments are intentionally chatty and would spam the distribution lists).

---

## Common error shape

All errors return a JSON body with an `error` field:

```json
{ "error": "FORBIDDEN_PROJECT" }
```

| Code | Meaning |
|---|---|
| `400` | Bad request — validation, malformed body, bad path param |
| `401` | No session cookie or expired |
| `403` | Authenticated but not authorized |
| `404` | Resource doesn't exist OR caller can't see it (privacy-preserving) |

---

## Try it from the command line

```bash
# Sign in
curl -c c.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@idm.com","password":"admin123"}'

# List open tickets
curl -b c.txt 'http://localhost:3000/api/tickets?status=open' | jq

# Create a ticket
curl -b c.txt -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"projectId":1,"encounteredIn":"Mock5","issue":"Bad data","goLive":false,"production":false,"mockLifecycle":"Mock5"}'

# Acknowledge a New ticket
curl -b c.txt -X PATCH http://localhost:3000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"Open","severity":"Medium","assignedToId":1}'

# Add a comment
curl -b c.txt -X POST http://localhost:3000/api/tickets/1/activities \
  -H "Content-Type: application/json" \
  -d '{"message":"Investigating now."}'

# Sign out
curl -b c.txt -X POST http://localhost:3000/api/auth/logout
```
