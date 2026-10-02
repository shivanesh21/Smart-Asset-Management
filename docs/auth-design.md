# Auth Design — Smart Asset Management

**Decision**: User model and authentication live in **`asset-service`** (backed by `asset_db.Users`). Both services (`asset-service` and `operations-service`) share the same `JWT_SECRET` to verify access tokens.

## Implementation status

Implemented on Day 6. Endpoints, middleware, and the seed script are live; see
[api-contract.md](./api-contract.md) for request/response bodies. `operations-service`
has not been scaffolded yet, so the shared-secret verification is documented but not
exercised end-to-end.

Roles are `admin`, `staff`, `technician`.

| Capability | admin | staff | technician |
| --- | --- | --- | --- |
| Read assets | Y | Y | Y |
| Create/update/delete assets | Y | Y | 403 |
| Change asset status | Y | Y | 403 |
| List/create users | Y | 403 | 403 |
| Read own profile | Y | Y | Y |

## 1. User Model (Asset Service)

**Collection**: `asset_db.Users`  
**Model**: see `docs/data-model.md` (fields include `passwordHash`, `role`, `isActive`, `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`, `mustChangePassword`).

Security notes:

- `passwordHash` is stored with a strong hash (bcrypt, cost 10+). Never returned in API responses (`toJSON` strips it).
- Emails are unique, lowercase, and normalized.
- Account lockout: track `failedLoginAttempts` and `lockedUntil` (e.g. 5 failed attempts → lock for 15 minutes). Unlock on successful login or admin action.
- Roles: `admin`, `staff`, `technician`. Use role-based access control (RBAC) at route/middleware level.
- Optional: `employeeCode` unique sparse, `manager` (self-referencing), `department`, `site`.

## 2. Auth Endpoint

**Host**: `asset-service`  
**Endpoint**: `POST /api/auth/login`  
**Authentication**: none (public)

### Request body

```json
{
  "email": "alice.johnson@example.com",
  "password": "YourPassword123!"
}
```

Validation: email format, non-empty password.

### Success response — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "64f0a1234b567890a1b2c3d4",
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "role": "staff",
    "department": "IT",
    "site": "HQ",
    "isActive": true,
    "employeeCode": "EMP-001",
    "mustChangePassword": false
  }
}
```

Notes:
- `expiresIn` seconds (default 1h for MVP; can be configurable via `JWT_EXPIRES_IN`).
- Return minimal user fields (no PII beyond what's needed).
- On success: reset `failedLoginAttempts` to 0, set `lastLoginAt`, clear `lockedUntil` if expired.

### Error responses

| Status | Code | Message (example) | Reason |
| --- | --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `email and password are required` | missing fields/format |
| 401 | `INVALID_CREDENTIALS` | `Invalid email or password` | user not found or password mismatch |
| 401 | `ACCOUNT_LOCKED` | `Account is temporarily locked. Try again later.` | `lockedUntil` > now |
| 403 | `ACCOUNT_INACTIVE` | `Your account is inactive. Contact admin.` | `isActive` is false |
| 429 | `TOO_MANY_ATTEMPTS` | `Too many login attempts. Account locked.` | optional: lock after threshold |

Generic "Invalid email or password" for not-found/mismatch to avoid user enumeration.

## 3. JWT Details

**Algorithm**: `HS256` (symmetric) for MVP. Can move to RS256 later if services split further.

**Claims (payload)**:

```json
{
  "sub": "64f0a1234b567890a1b2c3d4",  // userId
  "email": "alice.johnson@example.com",
  "role": "staff",
  "site": "HQ",
  "iat": 1735689600,
  "exp": 1735693200,
  "iss": "asset-service",
  "aud": ["asset-service", "operations-service"]
}
```

Notes:
- Keep claims minimal. `role` and `site` useful for coarse RBAC/tenancy filters.
- `iss`/`aud` aid validation across services (optional but recommended).

**Secrets & config**:

| Env var | Service | Notes |
| --- | --- | --- |
| `JWT_SECRET` | asset-service, operations-service | **must be identical**. Strong random string (32+ chars). Never commit. |
| `JWT_EXPIRES_IN` | asset-service | e.g. `1h`, `8h`, `7d`. Default `1h`. |
| `JWT_ISSUER` | both (optional) | e.g. `asset-service` |
| `JWT_AUDIENCE` | both (optional) | comma-separated or array |

## 4. Token Verification (Shared)

Both services must verify tokens the same way:

1. Extract `Authorization: Bearer <accessToken>`.
2. Verify signature with shared `JWT_SECRET`, check `exp`, and optionally `iss`/`aud`.
3. Attach decoded user context to `req.user` = `{ id, email, role, site }` (or full claims).
4. Reject with `401 Unauthorized` if invalid/expired/missing. `403 Forbidden` if role insufficient.

**Middleware** (shared logic conceptually): `requireAuth`, `requireRole(['admin','staff'])`, `requireActiveUser`.

## 5. Registration & Passwords (MVP stance)

MVP: users created by **admin** via `POST /api/users` in `asset-service` (not public registration). Admin sets initial password and can force `mustChangePassword=true`.  
Password policy (suggested): min 8-12 chars, mixed case, number/symbol. Hash with bcrypt (salt rounds >=10).

## 6. Token Refresh / Logout (MVP)

Not implemented in MVP. Access tokens short-lived (1h). Logout is client-side (discard token). If refresh needed later, add httpOnly refresh cookies; for now out of scope.

## 7. Cross-service calls

When `operations-service` needs to act on behalf of a user (e.g. create maintenance reported by User), it trusts the JWT. If it needs to resolve full user details (name/email), it can call `asset-service` internal endpoint (e.g. `GET /api/internal/users/:id`) or cache; MVP can pass userId/email from token or denormalize minimal fields where needed (e.g. Maintenance stores `reportedBy` ObjectId; UI can fetch user from asset-service).

## 8. Example middleware sketch (pseudocode)

```js
// auth.middleware.js (both services, same secret)
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({error:'UNAUTHORIZED',message:'Token required'});
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || 'asset-service',
      audience: process.env.JWT_AUDIENCE ? process.env.JWT_AUDIENCE.split(',') : ['asset-service','operations-service'],
    });
    req.user = { id: payload.sub, email: payload.email, role: payload.role, site: payload.site };
    next();
  } catch (e) {
    return res.status(401).json({error:'UNAUTHORIZED',message:'Invalid or expired token'});
  }
}
```

## 9. Security checklist (MVP)

- [ ] `JWT_SECRET` identical across both services, random, not in repo.
- [ ] Hash passwords with bcrypt (>=10 rounds).
- [ ] Generic error messages on login.
- [ ] Account lockout on brute force.
- [ ] Mark `passwordHash` `select: false` and never serialize.
- [ ] Use HTTPS in production (Render/Vercel provide TLS).
- [ ] Validate inputs (email, password length) on login.
- [ ] Role checks on protected routes.
- [ ] `isActive` enforced at login and on protected access.
- [ ] CORS restricted appropriately in production.

**Rationale**: Centralizing auth in `asset-service` keeps Users in one source of truth (`asset_db`) while allowing both services to authorize requests via shared JWT secret. This is simple, avoids cross-service auth duplication for MVP, and fits the two-database split cleanly.
