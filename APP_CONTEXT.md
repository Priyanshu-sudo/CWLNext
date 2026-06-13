# MYCWLNext App Context

## Overview

MYCWLNext is a credit watchlist workflow application for tracking borrowers
under heightened credit monitoring. It supports division-based ownership,
independent approvals, monthly reviews, and watchlist lifecycle transitions.

This is currently a working internal/demo-style application with seeded users
and seeded data. It is suitable as a practice codebase for later refactoring,
specification work, and extension.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Lucide React icons
- Custom CSS

Frontend source lives in `frontend/src`.

### Backend

- FastAPI
- Uvicorn
- SQLAlchemy 2
- Pydantic Settings
- Alembic
- Psycopg 3

Backend source lives in `backend/app`.

### Database

- PostgreSQL 16

Current local connection:

```text
Host: 127.0.0.1
Port: 5432
Database: mycwlnext
User: mycwl
```

## Runtime Ports

- Frontend app: `http://localhost:5173`
- Backend API: `http://localhost:8001`
- Swagger docs: `http://localhost:8001/docs`
- Health endpoint: `http://localhost:8001/health`

Frontend default API target:

```text
http://localhost:8001/api
```

## Main Functional Areas

### Authentication model

There is no real login yet.

The app currently uses seeded demo personas and sends the selected persona ID
in the `x-user-id` request header. Backend authorization is based on that user.

### Roles

There are 9 seeded roles:

- PNC Case Owner
- PNC Approver
- GWMA Case Owner
- GWMA Approver
- GWMSI Case Owner
- GWMSI Approver
- IB Case Owner
- IB Approver
- Administrator

The frontend has a persona switcher so users can simulate each role.

### Divisions

- PNC
- GWMA
- GWMSI
- IB

### Watchlist case workflows

Implemented case statuses:

- `DRAFT`
- `PENDING_APPROVAL`
- `ACTIVE`
- `RETURNED`
- `REMOVAL_PENDING`
- `CLOSED`

Implemented case transitions:

- `submit`
- `approve`
- `return`
- `request_removal`
- `approve_removal`
- `decline_removal`

### Monthly review workflows

Implemented review statuses:

- `DUE`
- `DRAFT`
- `PENDING_APPROVAL`
- `APPROVED`
- `RETURNED`

Implemented review actions:

- `start`
- `submit`
- `approve`
- `return`

### Frontend pages

Current routes include:

- `/dashboard`
- `/cases`
- `/cases/:caseId`
- `/reviews`
- `/approvals`
- `/portfolio`
- `/admin`

### Frontend capabilities

- Role/persona switching
- Dashboard metrics and work queue
- Case list view
- Case detail view
- Create case modal
- Approval queue
- Monthly reviews view
- Admin view for seeded personas

### Backend API capabilities

Current endpoints include:

- `GET /health`
- `GET /api/users`
- `GET /api/dashboard`
- `GET /api/cases`
- `GET /api/cases/{case_id}`
- `POST /api/cases`
- `POST /api/cases/{case_id}/transition`
- `GET /api/reviews`
- `PATCH /api/reviews/{review_id}`
- `POST /api/reviews/{review_id}/transition`

## Authorization Rules

Current business enforcement on the backend:

- Case owners can create cases only in their own division.
- Case owners can submit their own cases.
- Approvers can approve or return only within their own division.
- Maker-checker separation is enforced for approval actions.
- Admins can view cross-division data.
- Case access is division-scoped for non-admin users.
- Review editing is restricted to the assigned case owner.

## Data Model

### Core tables

- `users`
- `watchlist_cases`
- `monthly_reviews`
- `audit_events`

### Core entities

`users`

- name
- email
- role
- division
- active flag

`watchlist_cases`

- reference
- borrower
- division
- sector
- exposure
- risk rating
- previous rating
- status
- summary
- triggers
- owner
- approver
- next review date
- timestamps

`monthly_reviews`

- case
- period
- due date
- status
- recommendation
- commentary
- submitted timestamp
- decision timestamp

`audit_events`

- case
- actor
- event type
- previous status
- next status
- note
- timestamp

## Seeded Data

The backend seeds:

- 9 users
- 5 initial watchlist cases
- 6 monthly reviews

Known seeded borrowers include:

- Aperture Retail Group
- Northstar Renewables
- Morrow Health Systems
- Canopy Hospitality Partners
- BluePeak Components

Additional cases created through the UI are persisted in PostgreSQL.

## Configuration

### Backend env

Expected `backend/.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://mycwl:mycwl@127.0.0.1:5432/mycwlnext
CORS_ORIGINS=http://localhost:5173
```

### Frontend env

Optional `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8001/api
```

## Migrations

Alembic is configured in:

- `backend/alembic.ini`
- `backend/migrations/`

Current initial migration:

- `20260613_01_initial_schema`

Bootstrap command:

```text
python -m app.bootstrap
```

This applies migrations and seeds initial data if the database is empty.

## Tests

Backend tests currently cover:

- workflow transitions
- API case creation
- review submission and approval
- PostgreSQL integration

Current backend test files:

- `backend/tests/test_workflow.py`
- `backend/tests/test_api.py`
- `backend/tests/test_postgres_integration.py`

## Current Local Development Flow

### Backend

```text
cd backend
.venv\Scripts\activate.bat
python -m app.bootstrap
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

### Frontend

```text
cd frontend
npm run dev
```

## Important Current Notes

- The frontend is now explicitly configured to use backend port `8001`.
- The stale backend previously running on `8000` was removed during cleanup.
- `frontend/.env` exists and points to `http://localhost:8001/api`.
- PostgreSQL is the intended persistent database for the running app.
- The backend still seeds demo identities and demo records at startup if the
  database is empty.
- The UI includes some display-oriented placeholder metrics and visuals that are
  not fully normalized to backend-driven domain objects yet.
- There is no real authentication provider yet.
- There is no background scheduling for automatic monthly review generation yet.

## Good Candidate Next Enhancements

- Real authentication and session management
- Automatic monthly review generation
- Better action/remediation data model instead of static UI placeholders
- Event/audit history UI
- Richer admin controls
- Frontend integration tests
- OpenAPI-generated client types
- Cleanup of remaining display/demo assumptions in the frontend
