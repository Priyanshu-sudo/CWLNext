# MYCWLNext

## First-time setup

Install these first:

- Node.js and `npm`
- Python 3.12+
- PostgreSQL 16

Create a PostgreSQL database and user for the app:

```text
Database: mycwlnext
User:     mycwl
Password: mycwl
```

Backend setup:

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
```

Create `backend/.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://mycwl:mycwl@127.0.0.1:5432/mycwlnext
CORS_ORIGINS=http://localhost:5173
```

Run bootstrap once to create tables, apply migrations, and seed demo data:

```bat
python -m app.bootstrap
```

Frontend setup:

```bat
cd ..\frontend
npm install
```

Optional `frontend/.env`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8001/api
```

If you create or change `frontend/.env`, restart the frontend dev server before
testing in the browser.

## Running the backend

```bat
cd backend
.venv\Scripts\activate.bat
python -m app.bootstrap
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Backend URLs:

- API: `http://localhost:8001`
- Swagger: `http://localhost:8001/docs`
- Health: `http://localhost:8001/health`

## Running the frontend

```bat
cd frontend
npm run dev
```

Frontend URL:

- App: `http://localhost:5173`

Both commands run as foreground processes in their own terminals. Press
`Ctrl+C` once in the backend terminal and once in the frontend terminal to stop
them. This project has no VS Code task, launch configuration, or startup script
that automatically starts either server.

The frontend dev server is configured to run on `127.0.0.1:5173`.

## Running tests

Backend tests:

```bat
cd backend
.venv\Scripts\activate.bat
pytest tests -q
```

Frontend build:

```bat
cd frontend
npm run build
```

This now runs ESLint first and then the Next.js production build. You should
see the lint pass first, followed by the normal Next build phases such as
optimized production compilation, TypeScript validation, page data collection,
static page generation, and build traces. Build output is written to
`frontend/.next`.

To run the production frontend locally after building:

```bat
cd frontend
npm run start
```

Production preview URL:

- App: `http://localhost:4173`

## Docker

If you want to run everything with Docker instead:

```bat
docker compose up --build
```
