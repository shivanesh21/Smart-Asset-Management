# Postman

- `asset-service.collection.json` — the complete `asset-service` API (Days 4-7), 5 folders:
  - `01 Authentication` — login as admin/staff/technician, public register. Captures the token variables.
  - `02 Users (admin only)`
  - `03 Assets - success cases` — create, list, filter, read, replace, patch, status, delete.
  - `04 Assets - error cases` — 401, 403, 400, 404, 409, each also asserting the standard error envelope.
  - `05 Health`

## Running it

1. `cd asset-service && npm run seed` — creates the three demo accounts.
2. `npm start` — serves on port 3001.
3. Import the collection and run the folders **top to bottom**; `01 Authentication` fills in
   `adminToken` / `staffToken` / `technicianToken`, which the later folders reuse.

| Account | Email | Password |
| --- | --- | --- |
| admin | `admin@example.com` | `Admin@12345` |
| staff | `staff@example.com` | `Staff@12345` |
| technician | `technician@example.com` | `Tech@12345` |

## Notes

- Asset **writes are admin-only** (Day 7). `staff` and `technician` get `403 FORBIDDEN` on
  `POST`/`PUT`/`PATCH`/`DELETE` but can read.
- Every error response uses `{ "error": { "code", "message", "details", "requestId" } }`.
  The `413 PAYLOAD_TOO_LARGE` case is not in the collection because it needs a >1MB body;
  it is covered by `asset-service/test/errors.test.js`.
- The collection is verified end-to-end with Newman (74 assertions) in the Day 7 notes.