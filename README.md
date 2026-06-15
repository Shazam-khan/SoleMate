# SoleMate

A full-stack ecommerce application for footwear.

- **Frontend:** React 18 + Vite + TailwindCSS
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL
- **Payments:** Stripe
- **Image storage:** Supabase Storage (S3 in the cloud design)

---

## Architecture

```
┌────────────┐      HTTPS       ┌─────────────────────┐      SQL      ┌──────────────┐
│  React SPA │ ───────────────▶ │  Express REST API   │ ────────────▶ │  PostgreSQL  │
│  (Vite)    │ ◀─────────────── │  (Node.js)          │ ◀──────────── │              │
└────────────┘   JSON + cookie  └─────────────────────┘               └──────────────┘
                                       │      │
                              Stripe ──┘      └── Supabase / S3 (product images)
```

The backend is layered: **routes → middleware → controllers → DB pool**, with
centralized config, logging, and error handling.

### Deployment & DevOps

- **Design document + diagrams:** [`docs/DESIGN.md`](docs/DESIGN.md)
- **Infrastructure as Code (CloudFormation):** [`infra/`](infra/README.md) — ECS Fargate + Lambda + RDS + S3 + CloudFront
- **CI/CD:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint/test/build) and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (deploy to AWS)

---

## Prerequisites

- Node.js 20+ (`.nvmrc` provided)
- Docker + Docker Compose (for the local database, optional but recommended)

---

## Quick start (Docker)

The fastest way to get a working stack (Postgres + API, migrated and seeded):

```bash
cp .env.example .env          # then set JWT_SECRET (e.g. `openssl rand -hex 32`)
docker compose up --build
```

The API starts on http://localhost:5000. A default admin is seeded:

- email: `admin@solemate.test`
- password: `Admin12345`  *(change after first login)*

Then run the frontend separately:

```bash
cd Frontend
npm install
npm run dev                   # http://localhost:5173
```

---

## Quick start (local, no Docker)

1. **Backend**

   ```bash
   cp .env.example .env        # fill in DB_* and JWT_SECRET (point DB_* at a Postgres you run)
   npm install
   npm run db:migrate          # create tables
   npm run db:seed             # admin user + sample products
   npm run dev                 # http://localhost:5000
   ```

2. **Frontend**

   ```bash
   cd Frontend
   npm install
   npm run dev                 # http://localhost:5173 (uses .env.development)
   ```

---

## Scripts (backend, run from repo root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the API with nodemon |
| `npm start` | Start the API |
| `npm test` | Run the Jest test suite |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm run db:migrate` | Apply `backend/DB/schema.sql` |
| `npm run db:seed` | Seed admin user + sample products |

---

## Configuration

All configuration is environment-driven and validated at startup
(`backend/config/env.js`). See [`.env.example`](.env.example) for the full list.
Key variables:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | **Required.** Secret for signing auth tokens |
| `DATABASE_URL` *or* `DB_*` | Database connection |
| `CLIENT_URL` | Allowed CORS origin(s), comma-separated |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe |
| `SUPABASE_URL` / `API_KEY` | Object storage for product images |

The frontend reads `VITE_API_URL` (see `Frontend/.env.example`).

---

## Database

The schema is defined in [`backend/DB/schema.sql`](backend/DB/schema.sql) and can
be applied with `npm run db:migrate`. Tables: `Users`, `product`, `category`,
`P_Images`, `P_Size`, `Order`, `order_details`, `payment`.

---

## Security notes

- Passwords are hashed with bcrypt — never stored or compared in plaintext.
- JWTs are signed with a secret from the environment and delivered as httpOnly
  cookies.
- `helmet` sets security headers; auth endpoints are rate-limited.
- Admin-only routes are protected by an admin guard; product writes require admin.

---

## Testing

```bash
npm test
```

The suite uses Jest + supertest with a mocked database (no live DB required).

---

## Health checks

- `GET /health` — liveness (always 200 if the process is up)
- `GET /ready` — readiness (200 only when the database is reachable)

These back the container/load-balancer probes used in deployment.
