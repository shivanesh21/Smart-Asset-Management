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

## Documentation

| Document | Contents |
| --- | --- |
| [docs/day1-setup.md](./docs/day1-setup.md) | Toolchain, accounts, Atlas setup |
| [docs/architecture.md](./docs/architecture.md) | Service split, data flow, deployment mapping |
| [docs/data-model.md](./docs/data-model.md) | The five schemas, fields, indexes, relationships |
| [docs/api-contract.md](./docs/api-contract.md) | Every endpoint with request/response bodies and status codes |
| [docs/auth-design.md](./docs/auth-design.md) | User model, `/api/auth/login`, shared `JWT_SECRET` |
| [docs/diagrams/architecture.drawio](./docs/diagrams/architecture.drawio) | draw.io source: system architecture |
| [docs/diagrams/asset-lifecycle.drawio](./docs/diagrams/asset-lifecycle.drawio) | draw.io source: asset lifecycle state machine |

Open the `.drawio` files in [draw.io](https://app.diagrams.net) or the VS Code
draw.io extension.
