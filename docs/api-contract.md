# API Contract — Smart Asset Management

Version: `1.0` (MVP). This document is the source of truth for the HTTP interface of both services. It is designed to be imported into Postman later (Day: Postman collection).

## Conventions

### Base URLs

| Service | Local | Production (Render) |
| --- | --- | --- |
| `asset-service` | `http://localhost:3001` | `https://<asset-service>.onrender.com` |
| `operations-service` | `http://localhost:3002` | `https://<operations-service>.onrender.com` |

All routes below are prefixed by their service base URL. No API version prefix is used in the MVP.

### Authentication

Protected routes require a JWT issued by `POST /api/auth/login` on `asset-service`:

```
Authorization: Bearer <accessToken>
```

`operations-service` verifies with the same `JWT_SECRET`. See [auth-design.md](./auth-design.md).

### Response envelope

Single resource success:

```json
{ "data": { "id": "64f0a1...", "assetTag": "AST-2026-0001" } }
```

Collection success:

```json
{
  "data": [ /* items */ ],
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}
```

Error (all failures use this shape):

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset 64f0a1 not found",
    "details": [],
    "requestId": "b7c1f0e2-1a2b-4c3d-9e8f-0a1b2c3d4e5f"
  }
}
```

`details` is an array of `{ field, message }` for validation errors.

### Query parameters for collections

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int ≥1 | 1 | |
| `limit` | int 1–100 | 20 | |
| `sort` | string | varies | e.g. `-createdAt,name` (prefix `-` for desc) |
| `q` | string | — | text search on indexed fields |
| `fields` | string | — | comma-separated projection, e.g. `assetTag,name,status` |

### Standard status codes

| Code | Meaning | Where used |
| --- | --- | --- |
| 200 | OK | read, update, state transition |
| 201 | Created | resource created |
| 204 | No Content | delete / successful return with no body |
| 400 | Bad Request | malformed JSON, invalid ObjectId format |
| 401 | Unauthorized | missing/invalid/expired token, bad credentials |
| 403 | Forbidden | authenticated but role not permitted, inactive account |
| 404 | Not Found | resource missing or soft-deleted |
| 409 | Conflict | duplicate key, invalid state transition, asset already allocated |
| 422 | Unprocessable Entity | syntactically valid but semantically invalid (rare, prefer 400/409) |
| 429 | Too Many Requests | rate limit / lockout |
| 500 | Internal Server Error | unhandled error |
| 502 / 504 | Bad Gateway / Timeout | upstream service failure (asset-service → operations-service) |

### Error envelope

Every non-2xx response from `asset-service` uses exactly this shape. There are no exceptions —
validation failures, auth failures, 404s, and unhandled exceptions all go through the same
central handler in `middleware/error.js`.

```json
{
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset AST-9999 not found",
    "details": [],
    "requestId": "0f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f"
  }
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | Stable machine-readable code. Branch on this, never on `message`. |
| `message` | string | Human-readable summary. Not guaranteed stable. |
| `details` | array | `{ field, message }` entries for validation failures; `[]` otherwise. |
| `requestId` | string | Correlation id, also returned in the `x-request-id` response header. |

Send your own `x-request-id` request header and it is reused verbatim, so traces join up across
services. Stack traces are never included. For `5xx` in production the `message` is replaced with
`Internal server error` so internals never leak.

`404` uses `ROUTE_NOT_FOUND` for an unmatched path and a resource-specific code such as
`ASSET_NOT_FOUND` for a missing record.

### Role matrix (RBAC)

Implemented in `asset-service` as of Day 7. `operations-service` columns are the intended design.

| Capability | admin | staff | technician |
| --- | --- | --- | --- |
| Read assets | Y | Y | Y |
| Create/update/delete assets | Y | 403 | 403 |
| Change asset status | Y | 403 | 403 |
| Create allocations | Y | 403 | request own |
| Return assets | Y | 403 | Y (own) |
| Create/update maintenance | Y | 403 | report only |
| Manage technicians | Y | 403 | none |
| Manage users | Y | 403 | 403 |
| View all reports | Y | own jobs | own assets |

---

# asset-service (`:3001`)

## Auth

`asset-service` also hosts the user directory. Roles are `admin`, `staff`, `technician`.
Passwords are bcrypt-hashed (10 rounds) and never leave the service.

| Endpoint | Auth required | Roles |
| --- | --- | --- |
| `POST /api/auth/register` | none | public |
| `POST /api/auth/login` | none | public |
| `GET /api/auth/me` | bearer | any |
| `GET /api/users` | bearer | `admin` |
| `POST /api/users` | bearer | `admin` |

### `POST /api/auth/register`

Public self-registration. **The requested `role` is ignored and always set to `staff`**, so this
endpoint can never be used to mint an admin or technician account. Admin/technician accounts are
created through `POST /api/users` or `npm run seed`.

**Request**

```json
{ "name": "Alice Johnson", "email": "alice.johnson@example.com", "password": "Str0ngPass!",
  "department": "IT", "employeeCode": "EMP-214" }
```

Password must be 8-128 chars with a lowercase letter, an uppercase letter, and a number.

**201 Created** — the user object. No token; log in afterwards.
**Errors**: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`.

### `POST /api/auth/login`

**Request**

```json
{ "email": "alice.johnson@example.com", "password": "Str0ngPass!" }
```

**200 OK**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "64f0a1...", "name": "Alice Johnson", "email": "alice.johnson@example.com", "role": "staff", "isActive": true }
}
```

**Errors**: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS` (identical message for an unknown
email and a wrong password, so the endpoint cannot be used to enumerate accounts),
`403 ACCOUNT_INACTIVE`, `429 ACCOUNT_LOCKED` after 5 consecutive failures (15-minute lockout).

### `POST /api/users` (admin only)

Like `register` but `role` is **required** and honoured, and `mustChangePassword` is set to `true`.

**Request**

```json
{ "name": "Priya Nair", "email": "priya.nair@example.com", "password": "Priya@12345", "role": "technician" }
```

**201 Created**. **Errors**: `400`, `401`, `403 FORBIDDEN`, `409 EMAIL_ALREADY_EXISTS`.

## Users

Admin only, except `GET /api/users/:id` which is also readable by the user themselves.

### `GET /api/users`

Query: `role`, `isActive`, `site`, `department`, `q`, plus pagination.

**200 OK** — paginated list of users (no `passwordHash`).

### `POST /api/users`

**Request**

```json
{
  "name": "Ravi Kumar",
  "email": "ravi.kumar@example.com",
  "password": "Temp@12345",
  "role": "staff",
  "department": "Finance",
  "employeeCode": "EMP-214",
  "jobTitle": "Accounts Executive",
  "site": "HQ",
  "phone": "+919812345678"
}
```

**201 Created** — user object; `mustChangePassword` is set to `true` and the admin is expected to share the temporary password out of band.

**Errors**: `400 VALIDATION_ERROR` / weak password, `401`, `403`, `409 EMAIL_ALREADY_EXISTS`, `409 EMPLOYEE_CODE_EXISTS`.

### `GET /api/users/:id`

**200 OK** — user object. **401**, `403`, `404 USER_NOT_FOUND`.

### `PATCH /api/users/:id`

Partial update. Used for role changes, activation/deactivation, reassigning `manager`.

**200 OK** — updated user. **401**, `403`, `404`, `409`.

### `DELETE /api/users/:id`

Soft deactivation: sets `isActive=false`. Any assets currently allocated to the user must be returned first.

**204 No Content**. **409 USER_HAS_ACTIVE_ALLOCATIONS** if allocations are outstanding.

## Assets

Implemented as of Day 5: `POST /api/assets`, `GET /api/assets`, `GET /api/assets/:id`,
`GET /api/assets/summary`, `PUT /api/assets/:id`, `PATCH /api/assets/:id`,
`PATCH /api/assets/:id/status`, `DELETE /api/assets/:id`.

**All asset routes require a bearer token** (Day 6). Reads allow any authenticated role
(`admin`, `staff`, `technician`); writes and deletes are `admin`-only.

Notes that apply to every asset route:

- `assetId` is **server-generated** as `AST-1001`, `AST-1002`, … from an atomic counter. Sending
  `assetId` in a body is ignored, so tags cannot be forged or reused.
- `:id` accepts either the 24-character Mongo ObjectId or the tag (`AST-1001`).
- `status` cannot be changed through `PUT`/`PATCH` on the asset body. Use
  `PATCH /api/assets/:id/status` so the transition table is enforced.
- `DELETE` is a soft delete (`deletedAt` timestamp). Deleted assets return `404` and are excluded
  from `GET /api/assets`.
- `createdBy` and `updatedBy` are taken from the bearer token, never from the body.

### `GET /api/assets`

Query: `category`, `status`, `department`, `condition`, `serialNumber`,
`search` (alias `q`), `page`, `limit` (max 100), `sort` (allow-listed fields, `-` prefix for descending).

`search` is a case-insensitive regex over `name`, `assetId`, `serialNumber`, and `notes`, with
metacharacters escaped so a literal `(Parens)` cannot break the query.

**200 OK**

```json
{
  "data": [
    {
      "id": "64f0a1234b567890a1b2c3d5",
      "assetId": "AST-1001",
      "name": "Dell Latitude 5440",
      "description": "Standard issue developer laptop",
      "category": "laptop",
      "status": "assigned",
      "condition": "good",
      "serialNumber": "DL5440X99",
      "manufacturer": "Dell",
      "model": "Latitude 5440",
      "purchaseDate": "2026-01-15T00:00:00.000Z",
      "purchaseCost": 78000,
      "currency": "INR",
      "warrantyEndDate": "2029-01-15T00:00:00.000Z",
      "location": { "label": "HQ-3F-312", "type": "office", "site": "HQ", "building": "A", "floor": "3", "room": "312" },
      "tags": ["laptop", "developer"],
      "assignedTo": "64f0a1234b567890a1b2c3d4",
      "currentAllocation": "64f0a1234b567890a1b2c3d9",
      "imageUrl": null,
      "customFields": { "gpu": "RTX 4050" },
      "createdBy": "64f0a1234b567890a1b2c3d0",
      "createdAt": "2026-02-01T09:12:00.000Z",
      "updatedAt": "2026-03-04T11:02:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 }
}
```

### `POST /api/assets`

Roles: `admin`, `staff`. Do **not** send `assetId`; it is generated.

**Request**

```json
{
  "name": "HP LaserJet Pro M404",
  "description": "Shared floor printer",
  "category": "printer",
  "condition": "new",
  "serialNumber": "HP40477123",
  "department": "Facilities",
  "purchaseDate": "2026-02-10",
  "purchaseCost": 32000,
  "currency": "INR",
  "manufacturer": "HP",
  "model": "LaserJet Pro M404dn",
  "vendor": "CDW India",
  "warrantyEndDate": "2028-02-10",
  "location": { "type": "office", "site": "HQ", "building": "A", "floor": "3", "room": "310" }
}
```

**201 Created** — the created asset, `status` defaults to `draft`.
**Errors**: `400 VALIDATION_ERROR` (bad category/condition/date), `409 SERIAL_NUMBER_EXISTS` (duplicate serial).

### `GET /api/assets/:id`

**200 OK** — single asset. **400 VALIDATION_ERROR** (malformed id), **404 ASSET_NOT_FOUND**.

### `PUT /api/assets/:id`

Full replace of the mutable fields. `name` and `category` are **required**; anything omitted is
reset to its default. `assetId` and `status` are ignored if present.

**200 OK** — updated asset. **400**, **404**, **409 SERIAL_NUMBER_EXISTS**.

### `PATCH /api/assets/:id`

Partial update. Only the supplied fields change; `name` and `category` are optional here.

**200 OK** — updated asset. **400**, **404**, **409 SERIAL_NUMBER_EXISTS**.

### `POST /api/assets/:id/status` → implemented as `PATCH /api/assets/:id/status`

The only way to move an asset between lifecycle states.

**Request**

```json
{ "status": "in_stock", "reason": "Received from vendor, PO-4471" }
```

**200 OK** — updated asset. Setting the current status again is a no-op and returns 200.

**Errors**: `400 VALIDATION_ERROR` (unknown status), `404`, `409 INVALID_TRANSITION` with
`details[0].message` listing the allowed next states.

### `DELETE /api/assets/:id`

Soft delete. **Rule 2**: an allocated asset cannot be deleted.

**204 No Content** (empty body). A follow-up `GET` returns `404`, and the asset disappears from lists.

**Errors**: `409 ASSET_HAS_ACTIVE_ALLOCATION` when `status` is `assigned` or `assignedTo` is set,
`409 ASSET_IN_MAINTENANCE` when `status` is `in_maintenance`, `404` on a second delete.

### `GET /api/assets/:id/allocations`

Allocation history for one asset, newest first.

**200 OK** — paginated list of allocations.

### `GET /api/assets/:id/maintenance`

Cross-service read. `asset-service` proxies to `operations-service`.

**200 OK**

```json
{
  "data": [ { "id": "64f0b...", "maintenanceId": "MNT-2026-0007", "title": "Battery replacement", "status": "in_progress", "priority": "medium", "type": "corrective" } ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**Errors**: `404 ASSET_NOT_FOUND`, `502 OPERATIONS_SERVICE_UNAVAILABLE`, `504 OPERATIONS_SERVICE_TIMEOUT`.

### `GET /api/assets/summary`

Dashboard roll-up.

**200 OK**

```json
{
  "data": {
    "byStatus": { "draft": 4, "in_stock": 31, "assigned": 62, "in_maintenance": 7, "returned": 3, "lost": 1, "retired": 5, "disposed": 9 },
    "byCategory": { "laptop": 44, "monitor": 38, "printer": 12 },
    "totalValue": { "amount": 4820000, "currency": "INR" },
    "warrantyExpiringWithin90Days": 6
  }
}
```

## Allocations

### `GET /api/allocations`

Roles: any (scoped). Query: `status`, `user`, `asset`, `overdue=true`, `site`, pagination.

**200 OK**

```json
{
  "data": [
    {
      "id": "64f0a1234b567890a1b2c3d9",
      "asset": "64f0a1234b567890a1b2c3d5",
      "user": "64f0a1234b567890a1b2c3d4",
      "allocatedBy": "64f0a1234b567890a1b2c3d0",
      "status": "active",
      "allocatedAt": "2026-03-01T10:00:00.000Z",
      "expectedReturnDate": "2026-09-30T00:00:00.000Z",
      "returnedAt": null,
      "conditionOnHandover": "good",
      "conditionOnReturn": null,
      "purpose": "New joiner onboarding"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 62, "totalPages": 4 }
}
```

### `POST /api/allocations`

Roles: `admin`, `staff`. Creates the allocation and flips the asset to `assigned` in one logical operation. If either write fails, both are rolled back.

**Request**

```json
{
  "assetId": "64f0a1234b567890a1b2c3d5",
  "userId": "64f0a1234b567890a1b2c3d4",
  "conditionOnHandover": "good",
  "expectedReturnDate": "2026-12-31",
  "purpose": "New joiner onboarding",
  "handoverNotes": "Charger and dock included",
  "handoverSignatureUrl": "https://..."
}
```

**201 Created**

```json
{
  "data": {
    "id": "64f0a1234b567890a1b2c3d9",
    "asset": "64f0a1234b567890a1b2c3d5",
    "user": "64f0a1234b567890a1b2c3d4",
    "status": "active",
    "allocatedAt": "2026-03-04T11:05:00.000Z",
    "conditionOnHandover": "good"
  }
}
```

**Errors**: `400 VALIDATION_ERROR`, `401`, `403`, `404 ASSET_NOT_FOUND` / `USER_NOT_FOUND`, `409 ASSET_ALREADY_ALLOCATED`, `409 ASSET_NOT_AVAILABLE` (asset not `in_stock`), `409 USER_INACTIVE`.

### `GET /api/allocations/:id`

**200 OK** — allocation, with populated `asset` (tag, name) and `user` (name, email) sub-documents. **401**, `403`, `404 ALLOCATION_NOT_FOUND`.

### `PATCH /api/allocations/:id`

Extend the expected return date or edit notes. Status is not settable here.

**Request** — `{ "expectedReturnDate": "2026-12-31", "notes": "Extension approved by manager" }`

**200 OK** — updated allocation. **400**, `401`, `403`, `404`, `409 ALLOCATION_NOT_ACTIVE`.

### `POST /api/allocations/:id/return`

Roles: any, but a non-privileged user may only return their own allocation. Closes the allocation, clears `Asset.assignedTo` and `currentAllocation`, and moves the asset to `returned` (or directly to `in_maintenance` if `sendToMaintenance` is true).

**Request**

```json
{
  "conditionOnReturn": "fair",
  "returnConditionNotes": "Screen has a scratch near the hinge",
  "sendToMaintenance": false
}
```

**200 OK**

```json
{
  "data": {
    "id": "64f0a1234b567890a1b2c3d9",
    "status": "returned",
    "returnedAt": "2026-06-10T16:20:00.000Z",
    "conditionOnReturn": "fair"
  }
}
```

**Errors**: `401`, `403` (not your allocation), `404`, `409 ALLOCATION_NOT_ACTIVE`, `409 ASSET_IN_MAINTENANCE`.

### `POST /api/allocations/:id/cancel`

Admin/staff only. Cancels an allocation and releases the asset without a return inspection.

**Request** — `{ "reason": "Duplicate allocation created in error" }`

**200 OK** — allocation with `status: "cancelled"`. **401**, `403`, `404`, `409`.

### `GET /api/allocations/overdue`

Convenience list for dashboards: active allocations past `expectedReturnDate`.

**200 OK** — paginated list.

## Health

### `GET /health`

Liveness. No auth, no database call.

**200 OK** — `{ "status": "ok", "service": "asset-service", "uptimeSeconds": 1234 }`

### `GET /health/ready`

Readiness. Pings MongoDB.

**200 OK** — `{ "status": "ready", "database": "connected", "dbName": "asset_db" }`
**503** — `{ "status": "degraded", "database": "disconnected" }`

---

# operations-service (`:3002`)

All routes except `/health*` require the same JWT issued by `asset-service`.

## Technicians

### `GET /api/technicians`

Query: `status`, `skill`, `team`, `site`, `availableForScheduling=true`, `q`, pagination.

**200 OK**

```json
{
  "data": [
    {
      "id": "64f0c1234b567890a1b2c3e1",
      "employeeCode": "TECH-007",
      "name": "Suresh Iyer",
      "email": "suresh.iyer@example.com",
      "phone": "+919845612378",
      "status": "available",
      "skills": ["electrical", "hvac", "general"],
      "certifications": [ { "name": "Electrical Safety L3", "issuedBy": "NFSI", "issuedOn": "2025-04-01T00:00:00.000Z", "expiresOn": "2027-04-01T00:00:00.000Z" } ],
      "team": "Facilities",
      "site": "HQ",
      "shift": "morning",
      "maxConcurrentJobs": 5,
      "activeJobCount": 2,
      "hourlyRate": 450,
      "currency": "INR",
      "linkedUser": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
}
```

### `POST /api/technicians`

Roles: `admin`, `staff`.

**Request**

```json
{
  "employeeCode": "TECH-009",
  "name": "Meera Nair",
  "email": "meera.nair@example.com",
  "phone": "+919845600111",
  "status": "available",
  "skills": ["networking", "printer", "software"],
  "team": "IT Support",
  "site": "HQ",
  "shift": "flexible",
  "maxConcurrentJobs": 4,
  "hourlyRate": 500,
  "linkedUser": "64f0a1234b567890a1b2c3d4"
}
```

**201 Created**. `maintenanceId`-style codes are server-generated for maintenance records, but `employeeCode` here is client-supplied and must be unique.

**Errors**: `400`, `401`, `403`, `409 EMPLOYEE_CODE_EXISTS`, `409 EMAIL_EXISTS`.

### `GET /api/technicians/:id`

**200 OK** — technician. **401**, `403`, `404 TECHNICIAN_NOT_FOUND`.

### `PATCH /api/technicians/:id`

Partial update including `status`, `skills`, `activeJobCount`.

**200 OK**. **400**, `401`, `403`, `404`.

### `DELETE /api/technicians/:id`

Soft deactivation (`status: "inactive"`). Blocked while jobs are assigned.

**204 No Content**. `409 TECHNICIAN_HAS_ACTIVE_JOBS`.

### `GET /api/technicians/:id/workload`

Job counts by status plus utilization against `maxConcurrentJobs`.

**200 OK**

```json
{
  "data": {
    "technicianId": "64f0c1234b567890a1b2c3e1",
    "activeJobCount": 2,
    "maxConcurrentJobs": 5,
    "utilizationPercent": 40,
    "byStatus": { "requested": 1, "scheduled": 3, "in_progress": 2, "on_hold": 0, "completed": 41, "cancelled": 2 }
  }
}
```

## Maintenance

### `GET /api/maintenance`

Roles: any (scoped: technicians see jobs assigned to them, staff see jobs they reported). Admin/staff see everything.

Query: `status`, `type`, `priority`, `assetId`, `assetTag`, `assignedTechnician`, `scheduledFrom`, `scheduledTo`, `overdue`, `q`, pagination.

**200 OK**

```json
{
  "data": [
    {
      "id": "64f0b1234b567890a1b2c3e5",
      "maintenanceId": "MNT-2026-0007",
      "assetId": "64f0a1234b567890a1b2c3d5",
      "assetTag": "AST-2026-0001",
      "title": "Battery replacement",
      "description": "Battery drains within 40 minutes of use",
      "type": "corrective",
      "priority": "medium",
      "status": "in_progress",
      "reportedBy": "64f0a1234b567890a1b2c3d4",
      "assignedTechnician": "64f0c1234b567890a1b2c3e1",
      "scheduledFor": "2026-06-12T05:30:00.000Z",
      "startedAt": "2026-06-12T06:02:00.000Z",
      "completedAt": null,
      "partsUsed": [ { "name": "Battery 4S1XL", "partNumber": "BAT-4S1XL", "quantity": 1, "unitCost": 4200, "supplier": "CDW India" } ],
      "laborHours": 0.75,
      "cost": { "laborCost": 337.5, "partsCost": 4200, "totalCost": 4537.5, "currency": "INR" },
      "downtimeHours": 0,
      "recurring": { "enabled": false, "intervalDays": null, "nextDueDate": null }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 18, "totalPages": 1 }
}
```

### `POST /api/maintenance`

Roles: any authenticated role (everyone may report a fault).

`maintenanceId` is **server-generated** (`MNT-<year>-<seq>`). `reportedBy` comes from the token. The service also calls `asset-service` internally to flip the asset to `in_maintenance` (best effort; the ticket is still created if the asset service is unreachable, and status sync is retried).

**Request**

```json
{
  "assetId": "64f0a1234b567890a1b2c3d5",
  "title": "Battery replacement",
  "description": "Battery drains within 40 minutes of use",
  "type": "corrective",
  "priority": "medium",
  "scheduledFor": "2026-06-12T05:30:00.000Z",
  "recurring": { "enabled": false, "intervalDays": 90 },
  "attachments": [ { "name": "battery-warning.png", "url": "https://...", "mimeType": "image/png", "sizeBytes": 204800 } ]
}
```

**201 Created** — the created maintenance record including `maintenanceId`.

**Errors**: `400 VALIDATION_ERROR`, `401`, `404 ASSET_NOT_FOUND` (asset-service could not resolve the asset), `409 ASSET_IN_MAINTENANCE`, `409`, `502 ASSET_SERVICE_UNAVAILABLE`.

### `GET /api/maintenance/:id`

**200 OK** — maintenance record, `assignedTechnician` populated, plus the asset summary resolved via `asset-service`.

**Errors**: `401`, `403`, `404 MAINTENANCE_NOT_FOUND`, `502`.

### `PATCH /api/maintenance/:id`

Partial update of descriptive fields, `priority`, `recurring`, `partsUsed`. Use the workflow endpoints for status changes.

**200 OK**. `400`, `401`, `403`, `404`, `409`.

### `POST /api/maintenance/:id/assign`

Roles: `admin`, `staff`, `technician` (self-assign only).

**Request**

```json
{ "technicianId": "64f0c1234b567890a1b2c3e1", "scheduledFor": "2026-06-12T05:30:00.000Z", "note": "Suresh has the spare battery in stock" }
```

**200 OK** — maintenance with `assignedTechnician` set, `status` moved to `scheduled`, and an `auditTrail` entry.

**Errors**: `400`, `401`, `403`, `404 MAINTENANCE_NOT_FOUND` / `TECHNICIAN_NOT_FOUND`, `409 TECHNICIAN_AT_CAPACITY` (activeJobCount >= maxConcurrentJobs), `409 INVALID_TRANSITION`.

### `POST /api/maintenance/:id/start`

Roles: `admin`, `staff`, or the assigned technician. Moves `scheduled` → `in_progress` and sets `startedAt`.

**Request** — `{}`

**200 OK** — updated maintenance. `401`, `403` (not assigned to you), `404`, `409 INVALID_TRANSITION`.

### `POST /api/maintenance/:id/hold`

Roles: `admin`, `staff`, assigned technician.

**Request** — `{ "reason": "Awaiting replacement part from vendor" }`

**200 OK** — status `on_hold`. `400` if `reason` missing, `401`, `403`, `404`, `409`.

### `POST /api/maintenance/:id/resume`

Roles: `admin`, `staff`, assigned technician. `on_hold` → `in_progress`.

**200 OK**. `401`, `403`, `404`, `409`.

### `POST /api/maintenance/:id/complete`

Roles: `admin`, `staff`, assigned technician. `in_progress` → `completed`, sets `completedAt`, and recomputes `cost.totalCost`. On completion the service attempts to return the asset to `in_stock` (or `retired` if `resolutionNotes` says irreparable) via `asset-service`.

**Request**

```json
{
  "resolutionNotes": "Replaced battery, charge now holds for 6 hours",
  "laborHours": 0.75,
  "partsUsed": [ { "name": "Battery 4S1XL", "partNumber": "BAT-4S1XL", "quantity": 1, "unitCost": 4200 } ],
  "downtimeHours": 1.5,
  "assetOutcome": "in_stock"
}
```

`assetOutcome` is one of `in_stock` or `retired`. Default `in_stock`.

**200 OK**

```json
{
  "data": {
    "id": "64f0b1234b567890a1b2c3e5",
    "status": "completed",
    "completedAt": "2026-06-12T07:10:00.000Z",
    "cost": { "laborCost": 337.5, "partsCost": 4200, "totalCost": 4537.5, "currency": "INR" }
  }
}
```

**Errors**: `400 VALIDATION_ERROR`, `401`, `403`, `404`, `409 INVALID_TRANSITION`, `502 ASSET_SERVICE_UNAVAILABLE`.

### `POST /api/maintenance/:id/cancel`

Roles: `admin`, `staff`.

**Request** — `{ "reason": "Duplicate of MNT-2026-0006" }`

**200 OK** — status `cancelled`. `400` if `reason` missing, `401`, `403`, `404`, `409 INVALID_TRANSITION`.

### `GET /api/assets/:assetId/maintenance`

History for one asset.

**200 OK** — paginated list. `400 INVALID_OBJECT_ID`, `404` (no jobs found returns an empty list, not 404).

### `GET /api/maintenance/summary`

Dashboard roll-up.

**200 OK**

```json
{
  "data": {
    "byStatus": { "requested": 3, "scheduled": 5, "in_progress": 2, "on_hold": 1, "completed": 141, "cancelled": 6 },
    "byPriority": { "low": 8, "medium": 21, "high": 6, "critical": 2 },
    "openJobs": 11,
    "overdueJobs": 3,
    "avgResolutionHours": 31.4,
    "totalCost": { "amount": 412500, "currency": "INR" },
    "recurringDueSoon": 4
  }
}
```

## Health

### `GET /health`

**200 OK** — `{ "status": "ok", "service": "operations-service", "uptimeSeconds": 987 }`

### `GET /health/ready`

**200 OK** — `{ "status": "ready", "database": "connected", "dbName": "operations_db" }`
**503** — `{ "status": "degraded", "database": "disconnected" }`

---

## Cross-service calls

| Caller | Target | Endpoint | Purpose |
| --- | --- | --- | --- |
| frontend | asset-service | `/api/auth/login` | obtain token |
| frontend | asset-service | `/api/assets`, `/api/allocations`, `/api/users` | core asset work |
| frontend | operations-service | `/api/maintenance`, `/api/technicians` | maintenance work |
| asset-service | operations-service | `GET /api/assets/:id/maintenance` | proxy read |
| operations-service | asset-service | `GET /api/internal/assets/:id` | resolve asset, verify existence |
| operations-service | asset-service | `PATCH /api/internal/assets/:id/status` | flip asset to `in_maintenance` / `in_stock` / `retired` |

Internal endpoints are prefixed `/api/internal` and are reachable only from the other service over a shared service token (or by being unexposed publicly). They are implemented on Day 4+; listed here so the contract is complete.

## Error code reference

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | body/query failed validation, or a malformed `:id` |
| `INVALID_ID` | 400 | `:id` failed an ObjectId cast |
| `MALFORMED_JSON` | 400 | request body is not parseable JSON |
| `INVALID_VALUE` | 400 | a field failed a cast |
| `PAYLOAD_TOO_LARGE` | 413 | body exceeded the 1MB limit |
| `ROUTE_NOT_FOUND` | 404 | no route matched the path |
| `DUPLICATE_KEY` | 409 | Mongo unique index violation (fallback when no specific code applies) |
| `AUTH_UNAVAILABLE` | 503 | could not verify the token's user (database unreachable) |
| `INTERNAL_ERROR` | 500 | unhandled error; message masked in production |
| `UNAUTHORIZED` | 401 | token missing, invalid, or expired |
| `INVALID_CREDENTIALS` | 401 | login email/password mismatch |
| `ACCOUNT_INACTIVE` | 403 | user `isActive` is false |
| `ACCOUNT_LOCKED` | 429 | 5 consecutive failed logins; locked 15 minutes |
| `FORBIDDEN` | 403 | role not permitted |
| `ROUTE_NOT_FOUND` | 404 | unmatched path (see above) |
| `ASSET_NOT_FOUND` | 404 | |
| `USER_NOT_FOUND` | 404 | |
| `ALLOCATION_NOT_FOUND` | 404 | |
| `TECHNICIAN_NOT_FOUND` | 404 | |
| `MAINTENANCE_NOT_FOUND` | 404 | |
| `SERIAL_NUMBER_EXISTS` | 409 | duplicate `serialNumber` (unique sparse index) |
| `EMAIL_ALREADY_EXISTS` | 409 | duplicate `email` |
| `EMPLOYEE_CODE_EXISTS` | 409 | duplicate `employeeCode` |
| `ASSET_ALREADY_ALLOCATED` | 409 | active allocation exists |
| `ASSET_NOT_AVAILABLE` | 409 | asset not in `in_stock` |
| `ASSET_IN_MAINTENANCE` | 409 | asset already under maintenance |
| `INVALID_TRANSITION` | 409 | state machine violation |
| `ASSET_HAS_ACTIVE_ALLOCATION` | 409 | delete blocked |
| `USER_HAS_ACTIVE_ALLOCATIONS` | 409 | deactivation blocked |
| `TECHNICIAN_AT_CAPACITY` | 409 | `activeJobCount` >= `maxConcurrentJobs` |
| `TECHNICIAN_HAS_ACTIVE_JOBS` | 409 | deactivation blocked |
| `ASSET_SERVICE_UNAVAILABLE` | 502 | asset-service call failed |
| `OPERATIONS_SERVICE_UNAVAILABLE` | 502 | operations-service call failed |
| `INTERNAL_ERROR` | 500 | unhandled exception (log `requestId`) |
