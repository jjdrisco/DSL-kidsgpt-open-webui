# Cloud Development and Cypress E2E Testing

Complete reference for running the project and child-profile Cypress tests in a cloud environment (Cursor Cloud, GitHub Codespaces, Gitpod, etc.) or locally.

---

## 1. System requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | `>=18.13.0` and `<=22.x.x` (`package.json` engines) |
| **npm** | `>=6.0.0` |
| **Python** | `3.11` (`.python-version`) |
| **Network** | Outbound HTTPS for npm, pip, Pyodide fetch, and Cypress binary (first run) |

---

## 2. One-time setup

### 2.1 Frontend (project root)

```bash
npm install
# If peer dependency conflicts: npm install --legacy-peer-deps
```

`npm run dev` and `build` run `pyodide:fetch` first (downloads Pyodide into `static/pyodide/`). First run can take a few minutes and needs network.

### 2.2 Backend (project root)

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

Use `backend/requirements.txt`. If migrations or imports fail for missing deps (e.g. `mimeparse`, `langchain-classic`):

```bash
pip install mimeparse langchain-classic
```

---

## 3. Environment variables

### 3.1 Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///{DATA_DIR}/webui.db` | Use an absolute path in cloud, e.g. `sqlite:///$(pwd)/backend/data/webui.db`. |
| `DATA_DIR` | `backend/data` | Base dir; `DATABASE_URL` defaults to `{DATA_DIR}/webui.db`. |
| `PORT` | `8080` | Must match `BACKEND_PORT` for the Vite proxy. |
| `CORS_ALLOW_ORIGIN` | `*` | Semicolon-separated. For dev: `http://localhost:5173;http://localhost:5174;http://localhost:8080`. |
| `ENABLE_WEBSOCKET_SUPPORT` | `true` | Set `false` to avoid WebSocket deps if not needed. |
| `WEBUI_SECRET_KEY` | from `.webui_secret_key` or generated | Required; `backend/start.sh` can generate it. |
| `ENABLE_SIGNUP` | `true` (config) | Must allow signup for the first user, or create the test user another way. |

### 3.2 Frontend (Vite)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `8080` | Backend port for `/api`, `/ollama`, `/openai`, `/ws` proxy. |
| `BACKEND_HOST` | `localhost` | Backend host. |

### 3.3 Cypress (child-profile specs)

| Variable | Purpose |
|----------|---------|
| `RUN_CHILD_PROFILE_TESTS` or `CYPRESS_RUN_CHILD_PROFILE_TESTS` | Set to `1` so the global `before()` skips `registerAdmin`. Required for these specs. |
| `CYPRESS_baseUrl` | Frontend URL, e.g. `http://localhost:5173` or `http://localhost:5174`. Must match Vite. |
| `INTERVIEWEE_EMAIL`, `INTERVIEWEE_PASSWORD` | Login for `kids-profile.cy.ts`. |
| `PARENT_EMAIL`, `PARENT_PASSWORD` | Login for `parent-child-profile.cy.ts`. |
| `TEST_EMAIL`, `TEST_PASSWORD` | Override for both. |
| **Defaults** | If unset: `jjdrisco@ucsd.edu` / `0000`. |

`cypress.config.ts` forwards `RUN_CHILD_PROFILE_TESTS` and the email/password vars from `process.env` when `CYPRESS_*` is not set.

---

## 4. Running the backend

From project root:

```bash
cd backend
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080
# activate venv if needed: source .venv/bin/activate
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*'
```

**Cloud**: `127.0.0.1` when Cypress and backend are on the same machine; `0.0.0.0` only if frontend/Cypress are on another host.

**Database**: Peewee (and Alembic if enabled) run on startup. For a clean DB, point `DATABASE_URL` at a new SQLite path. Alembic errors (e.g. "Multiple head revisions") are caught; the app may still start.

---

## 5. Running the frontend

From project root:

```bash
npm run dev
```

Vite usually uses `http://localhost:5173` (or `5174`, etc.). Use that port in `CYPRESS_baseUrl`.

**Fixed port in cloud:**

```bash
npm run dev:5050
# or
npx vite dev --port 5173 --host
```

**Proxy target**: `BACKEND_HOST:BACKEND_PORT` (default `localhost:8080`). Set `BACKEND_PORT` if the backend uses another port.

---

## 6. Test account (required for child-profile Cypress)

Specs sign in with an existing user; they do not run `registerAdmin`.

**Default**: `jjdrisco@ucsd.edu` / `0000`

### Creating the user

**A) Signup (first user)**

`ENABLE_SIGNUP` must be `true`.

**UI**: `/auth` → Sign up, or **API**:

```bash
curl -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"jjdrisco@ucsd.edu","password":"0000","name":"Test User"}'
```

**B) Existing DB**

Use a DB that already has `jjdrisco@ucsd.edu` / `0000` and set `DATABASE_URL` accordingly.

**C) Cypress overrides**

Set `INTERVIEWEE_EMAIL`/`INTERVIEWEE_PASSWORD` or `PARENT_EMAIL`/`PARENT_PASSWORD` or `TEST_EMAIL`/`TEST_PASSWORD` to an existing account.

---

## 7. Running the child-profile Cypress tests

**Need:**

- Frontend on e.g. `http://localhost:5173` (or `5174`).
- Backend on `localhost:8080` (or `BACKEND_PORT`).
- Test account (e.g. `jjdrisco@ucsd.edu` / `0000`).

From project root:

```bash
RUN_CHILD_PROFILE_TESTS=1 \
CYPRESS_baseUrl=http://localhost:5173 \
npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

Use the real Vite port in `CYPRESS_baseUrl` (e.g. `5174` or `5050`).

Cypress runs headless (Electron); no display is required.

### Cloud-specific Cypress

- Use a fixed Vite port (e.g. `--port 5173`) so `CYPRESS_baseUrl` is stable.
- Same-machine backend: `BACKEND_HOST=localhost`, `BACKEND_PORT=8080`.
- First `npx cypress run` may download the Cypress binary; network and disk are required.
- If the image is minimal and Chromium/Electron fail to launch, install typical libs (e.g. `libgtk-3-0`, `libgbm1` on Debian).

---

## 8. Minimal "run everything" (cloud)

Example one-shot flow (Node 20, Python 3.11, network; adjust paths/ports to your workspace):

```bash
# 1) Frontend
npm install

# 2) Backend
cd backend && python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3) Backend (background) – absolute SQLite path for cloud
export DATABASE_URL="sqlite:///$(pwd)/backend/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
cd backend && uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*' &
cd ..

# 4) Create test user (once, empty DB)
sleep 5
curl -s -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"jjdrisco@ucsd.edu","password":"0000","name":"Test User"}'

# 5) Frontend (background) – fixed port
npm run dev -- --port 5173 --host &
sleep 10

# 6) Cypress
RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 \
  npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

---

## 9. Troubleshooting

| Symptom | Cause | Action |
|---------|-------|--------|
| `Expected to find element: input#email, input[autocomplete="email"]` | Frontend not at `CYPRESS_baseUrl` or backend down | Run `npm run dev`, match `CYPRESS_baseUrl` to Vite port, ensure backend is up. |
| `expected 500 to be one of [ 200, 400 ]` in `before` (signup) | `registerAdmin` ran | Use `RUN_CHILD_PROFILE_TESTS=1`. |
| `Cannot read properties of null (reading 'default_locale')` | Layout when `getBackendConfig()` fails | Fixed with `backendConfig?.default_locale` in `+layout.svelte`. |
| Cypress cannot connect to `baseUrl` | Wrong `CYPRESS_baseUrl` or frontend on another port | Set `CYPRESS_baseUrl` to Vite's URL; consider `--port 5173`. |
| Alembic "Multiple head revisions" or missing revision | Migration history in this worktree | App may still start; use new DB or fix revision graph if needed. |
| `ModuleNotFoundError` (e.g. `mimeparse`, `langchain_classic`) | Missing pip deps | `pip install mimeparse langchain-classic` (or the given package). |
| Pyodide fetch fails | Network/proxy | Set `https_proxy`/`http_proxy` if needed; allow outbound HTTPS. |

See also: `cypress/README_CHILD_PROFILE_TESTS.md`.

---

## 10. References

| Topic | Location |
|-------|----------|
| Child-profile Cypress | `cypress/e2e/kids-profile.cy.ts`, `cypress/e2e/parent-child-profile.cy.ts` |
| Cypress support / `RUN_CHILD_PROFILE_TESTS` | `cypress/support/e2e.ts`, `cypress.config.ts` |
| Cypress child-profile readme | `cypress/README_CHILD_PROFILE_TESTS.md` |
| Database / `DATABASE_URL` | `backend/README_DATABASE.md`, `backend/open_webui/env.py` |
| Vite proxy | `vite.config.ts` (`BACKEND_HOST`, `BACKEND_PORT`) |
| Backend scripts | `backend/dev.sh`, `backend/start.sh` |
