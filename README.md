# Smart Asset Management

Two-service backend plus a frontend for smart asset management.

| Path                 | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `frontend/`          | Web client (to be scaffolded)            |
| `asset-service/`     | Node service backed by `asset_db`        |
| `operations-service/`| Node service backed by `operations_db`   |
| `postman/`           | Postman collections and environments     |
| `docs/`              | Setup notes and API documentation        |

## Databases

- `asset_db` — assets, categories, assignments
- `operations_db` — maintenance, work orders, audit trail

Both are hosted on MongoDB Atlas. Connection strings are never committed;
see `.env.example` in each service folder.
