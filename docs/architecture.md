# Architecture — Smart Asset Management

Diagram source: [diagrams/architecture.drawio](./diagrams/architecture.drawio) (open in draw.io / diagrams.net).

## Shape of the system

Three deployable units, two databases.

```
Browser (React SPA on Vercel)
   │  Bearer JWT
   ├──────────────► asset-service      (Render, :3001)  ──► asset_db       (Users, Assets, Allocations)
   │                                    ▲
   └──────────────► operations-service (Render, :3002)  ──► operations_db (Maintenance, Technicians)
                                        │
                                        └─ internal HTTP ─► asset-service (asset status sync + asset lookup)
```

## Services

### `asset-service` — the system of record for identity and assets

- `POST /api/auth/login` plus the `User` model live here. It is the only service that writes to `Users`.
- Owns `Assets` and `Allocations`, including the one-active-allocation-per-asset invariant.
- Enforces the asset lifecycle state machine (`POST /api/assets/:id/status`).
- Exposes `/api/internal/*` endpoints that `operations-service` uses to resolve assets and to move them between lifecycle states.

### `operations-service` — maintenance execution

- Owns `Maintenance` and `Technicians`.
- Drives the maintenance workflow: `requested → scheduled → in_progress → (on_hold) → completed | cancelled`.
- Never authenticates users itself. It verifies tokens minted by `asset-service` using the shared `JWT_SECRET`.
- Calls back into `asset-service` when a ticket moves an asset to `in_maintenance`, and when completion returns it to `in_stock` or `retired`.

### `frontend` — thin client

- React SPA deployed on Vercel, root directory `frontend/`.
- Holds no secrets. Talks to both services directly from the browser with the bearer token.
- Environment variable `VITE_ASSET_API_URL` and `VITE_OPERATIONS_API_URL` (or a single `VITE_API_BASE`) point at the deployed services. CORS on the services must allow the Vercel origin.

## Why this split

| Reason | Consequence |
| --- | --- |
| Two Atlas databases as per Day 1 | the service boundary is a database boundary, so there are no cross-database joins |
| Auth has to be somewhere | putting it in `asset-service` gives one source of truth for `Users` and one login endpoint |
| Both services need auth | a shared `JWT_SECRET` lets `operations-service` verify without a network call |
| No foreign keys across databases | `Maintenance.assetId` and `Technician.linkedUser` are advisory; the service layer checks existence and the audit trail records what happened |

## Data flow: reporting a fault

1. Employee opens the asset in the SPA and submits a fault report.
2. SPA calls `POST /api/maintenance` on `operations-service` with the bearer token.
3. `operations-service` verifies the token, resolves the asset via `GET /api/internal/assets/:id` on `asset-service`, generates `MNT-2026-0001`, and writes the ticket.
4. `operations-service` calls `PATCH /api/internal/assets/:id/status` with `in_maintenance`. The asset leaves the pool of allocatable assets.
5. A staff member assigns a technician; the technician starts, holds, or completes the job.
6. On completion, cost and downtime are recorded and the asset returns to `in_stock` (or `retired`).

Failure handling: if step 4 fails, the ticket is still created and the asset status is left unchanged, so the asset may show as assignable while a ticket is open. Reconcile with a periodic sync job, or treat asset `in_maintenance` as best-effort. The contract exposes `502 ASSET_SERVICE_UNAVAILABLE` where the dependency is not optional, such as creating a ticket for a non-existent asset.

## Deployment mapping

| Unit | Host | Root directory | Start command | Health check |
| --- | --- | --- | --- | --- |
| `asset-service` | Render Web Service | `asset-service` | `npm start` | `/health/ready` |
| `operations-service` | Render Web Service | `operations-service` | `npm start` | `/health/ready` |
| `frontend` | Vercel | `frontend` | `npm run build` | — |

Environment variables are set per service, never committed. `JWT_SECRET` must be byte-identical in both Render services.

## Ports

| Service | Port |
| --- | --- |
| asset-service | 3001 |
| operations-service | 3002 |
| frontend (Vite dev) | 5173 |
