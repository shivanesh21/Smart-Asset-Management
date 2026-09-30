# Day 1 — Environment and accounts

## Tooling installed

| Tool     | Version | Status |
| -------- | ------- | ------ |
| Node.js  | v24.18.0 (LTS "Krypton") | installed |
| npm      | 11.16.0 | installed |
| Git      | 2.53.0  | installed |
| VS Code  | 1.139.0 | installed |
| Postman  | 12.30.3 | installed via winget |

## Accounts to create

### MongoDB Atlas
1. Sign up at https://www.mongodb.com/atlas/register
2. Create a free **M0** cluster per database (or one cluster holding both).
3. Under **Database Access**, create a user with *Read and write to any database*.
4. Under **Network Access**, add your own IP to the allowlist.
5. Copy the SRV string and put it in each service's `.env`:

```
asset-service/.env        MONGODB_URI=... /asset_db
operations-service/.env   MONGODB_URI=... /operations_db
```

Databases are created automatically on first write, or explicitly:

```js
await mongoose.connection.useDb('asset_db').createCollection('assets');
```

### Render
1. Sign up at https://render.com (GitHub sign-in)
2. Used later to host `asset-service` and `operations-service` as Web Services
3. Set `MONGODB_URI` / `MONGODB_DB_NAME` as environment variables per service

### Vercel
1. Sign up at https://vercel.com (GitHub sign-in)
2. Import the repo, set root directory to `frontend/`
3. Set the public env var for the frontend API base URL

## Local ports

- `asset-service` → 3001
- `operations-service` → 3002

## Next steps

- [x] Install Node.js LTS, Git, VS Code, Postman
- [x] Create repo with folder structure
- [x] Create MongoDB Atlas, Render, Vercel accounts
- [x] Create `asset_db` and `operations_db`
