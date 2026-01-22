# Cypress E2E Test Setup Guide

Complete guide for setting up and running Cypress end-to-end tests for the Open WebUI project, including child-profile tests.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [One-Time Setup](#2-one-time-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [Starting Services](#4-starting-services)
5. [Running Tests](#5-running-tests)
6. [Test Files Overview](#6-test-files-overview)
7. [Troubleshooting](#7-troubleshooting)
8. [Quick Reference](#8-quick-reference)

---

## 1. System Requirements

| Component | Requirement | Notes |
|-----------|-------------|-------|
| **Node.js** | `>=18.13.0` and `<=22.x.x` | Check with `node --version`. If using Node 22.x, may need `--force` flag for npm install. |
| **npm** | `>=6.0.0` | Check with `npm --version` |
| **Python** | `3.11` (preferred) or `3.12` | Check with `python3 --version`. `.python-version` specifies 3.11. |
| **Network** | Outbound HTTPS | Required for npm, pip, Pyodide fetch, and Cypress binary download (first run) |
| **Display** | Xvfb (for headless) | Required for running Cypress in headless mode on Linux |

### Linux Dependencies (for headless Cypress)

On Debian/Ubuntu systems, install:

```bash
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-0 \
  libgbm1 \
  libxss1 \
  libasound2t64 \
  xvfb \
  python3.12-venv  # or python3.11-venv depending on your Python version
```

---

## 2. One-Time Setup

### 2.1 Frontend Setup

From the project root:

```bash
# Install dependencies
npm install --legacy-peer-deps --force

# Note: If you get engine compatibility errors with Node 22.x, the --force flag bypasses this.
# The project works with Node 22.x despite package.json specifying Node 20.x.
```

**First Run Notes:**
- `npm run dev` and `build` automatically run `pyodide:fetch` (downloads Pyodide into `static/pyodide/`)
- First run can take a few minutes and requires network access
- Pyodide download happens automatically on first dev/build

### 2.2 Backend Setup

From the project root:

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
# On Linux/Mac:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Return to project root
cd ..
```

**Common Issues:**

If you get `ModuleNotFoundError` for packages like `mimeparse` or `langchain-classic`:

```bash
pip install mimeparse langchain-classic
```

If `python3 -m venv` fails with "ensurepip is not available":

```bash
# On Debian/Ubuntu:
sudo apt-get install python3.12-venv  # or python3.11-venv
```

---

## 3. Environment Configuration

### 3.1 Backend Environment Variables

Set these before starting the backend:

```bash
export DATABASE_URL="sqlite:///$(pwd)/backend/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false  # Set to false to avoid WebSocket deps if not needed
export PORT=8080
```

**Variable Descriptions:**

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///{DATA_DIR}/webui.db` | Use absolute path in cloud environments |
| `CORS_ALLOW_ORIGIN` | `*` | Semicolon-separated list of allowed origins |
| `ENABLE_WEBSOCKET_SUPPORT` | `true` | Set `false` to avoid WebSocket dependencies |
| `PORT` | `8080` | Backend port (must match `BACKEND_PORT` for Vite proxy) |
| `ENABLE_SIGNUP` | `true` (config) | Must allow signup for first user or create test user via API |

### 3.2 Frontend Environment Variables

Optional (defaults usually work):

```bash
export BACKEND_PORT=8080  # Backend port for proxy
export BACKEND_HOST=localhost  # Backend host
```

### 3.3 Cypress Environment Variables

For child-profile tests:

```bash
export RUN_CHILD_PROFILE_TESTS=1  # Required: skips registerAdmin in before() hook
export CYPRESS_baseUrl=http://localhost:5173  # Frontend URL (must match Vite port)

# Optional: Override default test credentials
export INTERVIEWEE_EMAIL=jjdrisco@ucsd.edu  # For kids-profile.cy.ts
export INTERVIEWEE_PASSWORD=0000
export PARENT_EMAIL=jjdrisco@ucsd.edu  # For parent-child-profile.cy.ts
export PARENT_PASSWORD=0000
export TEST_EMAIL=jjdrisco@ucsd.edu  # Override for both
export TEST_PASSWORD=0000
```

**Default Credentials:**
- Email: `jjdrisco@ucsd.edu`
- Password: `0000`

---

## 4. Starting Services

### 4.1 Start Backend Server

**Terminal 1 - Backend:**

```bash
# From project root
cd backend

# Set environment variables
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080

# Activate virtual environment (if not already active)
source .venv/bin/activate

# Start backend server
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*'
```

**Verify Backend is Running:**

```bash
curl http://localhost:8080/api/v1/configs
# Should return JSON (even if 404, means server is up)
```

### 4.2 Create Test User Account

**One-time setup** - Create the test user if it doesn't exist:

```bash
curl -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"jjdrisco@ucsd.edu","password":"0000","name":"Test User"}'
```

**Expected Response:**
```json
{
  "id": "...",
  "email": "jjdrisco@ucsd.edu",
  "name": "Test User",
  "role": "admin",
  "token": "..."
}
```

**Note:** If user already exists, you'll get a 400 error - this is fine, the user is ready to use.

### 4.3 Start Frontend Dev Server

**Terminal 2 - Frontend:**

```bash
# From project root
npm run dev
```

**Or with fixed port (recommended for cloud/CI):**

```bash
npm run dev -- --port 5173 --host
```

**Verify Frontend is Running:**

- Check terminal output for the port (usually `http://localhost:5173`)
- Visit the URL in a browser or:
  ```bash
  curl http://localhost:5173
  # Should return HTML
  ```

**Important:** Note the actual port Vite uses - you'll need it for `CYPRESS_baseUrl`.

---

## 5. Running Tests

### 5.1 Standard Tests (Registration, Chat, Settings)

```bash
# From project root
npx cypress run --spec "cypress/e2e/registration.cy.ts"
npx cypress run --spec "cypress/e2e/chat.cy.ts"
npx cypress run --spec "cypress/e2e/settings.cy.ts"
```

### 5.2 Child-Profile Tests

**Prerequisites:**
- Backend running on `localhost:8080`
- Frontend running (note the port, e.g., `5173`)
- Test user account exists (`jjdrisco@ucsd.edu` / `0000`)
- `RUN_CHILD_PROFILE_TESTS=1` environment variable set

**Run Kids Profile Test:**

```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173  # Use actual Vite port

# On Linux (headless):
xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts"

# On Mac/Windows (with display):
npx cypress run --spec "cypress/e2e/kids-profile.cy.ts"
```

**Run Parent-Child Profile Test:**

```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173

# On Linux (headless):
xvfb-run -a npx cypress run --spec "cypress/e2e/parent-child-profile.cy.ts"

# On Mac/Windows (with display):
npx cypress run --spec "cypress/e2e/parent-child-profile.cy.ts"
```

**Run Both Child-Profile Tests:**

```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173

xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

### 5.3 Run All Tests

```bash
# Standard tests (will run registerAdmin)
npx cypress run

# Child-profile tests only
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173
xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

### 5.4 Interactive Mode (with GUI)

```bash
# Open Cypress GUI
npx cypress open

# Then select tests to run in the GUI
```

**Note:** Interactive mode requires a display. For headless environments, use `cypress run`.

---

## 6. Test Files Overview

### 6.1 Standard Test Files

| File | Description | Requires `RUN_CHILD_PROFILE_TESTS`? |
|------|-------------|--------------------------------------|
| `registration.cy.ts` | Tests user registration and login | No |
| `chat.cy.ts` | Tests chat functionality | No |
| `settings.cy.ts` | Tests settings pages | No |
| `documents.cy.ts` | Tests document management | No |

### 6.2 Child-Profile Test Files

| File | Description | Credentials |
|------|-------------|-------------|
| `kids-profile.cy.ts` | Tests `/kids/profile` route for creating/editing child profiles | `INTERVIEWEE_EMAIL`/`INTERVIEWEE_PASSWORD` or `TEST_EMAIL`/`TEST_PASSWORD` |
| `parent-child-profile.cy.ts` | Tests `/parent` route for parent view of child profiles | `PARENT_EMAIL`/`PARENT_PASSWORD` or `TEST_EMAIL`/`TEST_PASSWORD` |

**Important:** Child-profile tests require:
- `RUN_CHILD_PROFILE_TESTS=1` to skip `registerAdmin()` in the global `before()` hook
- Existing test user account (they don't create users)
- Frontend accessible at `CYPRESS_baseUrl`

---

## 7. Troubleshooting

### 7.1 Common Issues

#### Issue: `npm install` fails with peer dependency conflicts

**Solution:**
```bash
npm install --legacy-peer-deps --force
```

#### Issue: `npm install` fails with engine compatibility error

**Error:**
```
npm error engine Unsupported engine
npm error engine Not compatible with your version of node/npm: open-webui@0.6.32
npm error notsup Required: {"node":"20.x","npm":">=6.0.0"}
npm error notsup Actual:   {"npm":"10.9.4","node":"v22.21.1"}
```

**Solution:**
```bash
npm install --legacy-peer-deps --force
```
The project works with Node 22.x despite the package.json requirement.

#### Issue: `python3 -m venv` fails - "ensurepip is not available"

**Solution:**
```bash
# On Debian/Ubuntu:
sudo apt-get install python3.12-venv  # or python3.11-venv
```

#### Issue: Backend fails to start - "unable to open database file"

**Solution:**
```bash
# Create the data directory
mkdir -p backend/data
```

#### Issue: Cypress fails - "Missing X server or $DISPLAY"

**Error:**
```
ERROR:ozone_platform_x11.cc(240)] Missing X server or $DISPLAY
```

**Solution:**
```bash
# Install Xvfb and required libraries
sudo apt-get install -y libgtk-3-0 libgbm1 libxss1 libasound2t64 xvfb

# Run Cypress with xvfb-run
xvfb-run -a npx cypress run --spec "cypress/e2e/..."
```

#### Issue: Login test fails - "Expected to find element: #chat-search"

**Cause:** User is redirected to `/kids/profile` or another page instead of home.

**Solution:** Already fixed in `cypress/support/e2e.ts` - the login function now handles multiple redirect paths.

#### Issue: Test fails - "expected 500 to be one of [ 200, 400 ]" in before (signup)

**Cause:** `registerAdmin()` ran when it shouldn't have.

**Solution:**
```bash
export RUN_CHILD_PROFILE_TESTS=1
```

#### Issue: Cypress cannot connect to baseUrl

**Cause:** Wrong `CYPRESS_baseUrl` or frontend on different port.

**Solution:**
1. Check what port Vite is actually using:
   ```bash
   # Look at npm run dev output
   # Usually shows: "Local: http://localhost:5173"
   ```
2. Set `CYPRESS_baseUrl` to match:
   ```bash
   export CYPRESS_baseUrl=http://localhost:5173  # or 5174, etc.
   ```

#### Issue: ModuleNotFoundError (e.g. `mimeparse`, `langchain_classic`)

**Solution:**
```bash
cd backend
source .venv/bin/activate
pip install mimeparse langchain-classic
```

#### Issue: Alembic "Multiple head revisions" or missing revision

**Note:** This is usually caught and the app may still start. For a clean DB:

```bash
# Use a new database path
export DATABASE_URL="sqlite:///$(pwd)/backend/data/webui-test.db"
```

### 7.2 Debugging Tips

**Check if services are running:**

```bash
# Backend
curl http://localhost:8080/api/v1/configs

# Frontend
curl http://localhost:5173

# Check processes
ps aux | grep -E "(uvicorn|vite|node.*dev)"
```

**View Cypress logs:**

```bash
# Run with more verbose output
DEBUG=cypress:* npx cypress run --spec "cypress/e2e/..."
```

**Check backend logs:**

```bash
# If running in background, check log file
tail -f /tmp/backend.log
```

**Check frontend logs:**

```bash
# If running in background, check log file
tail -f /tmp/frontend.log
```

---

## 8. Quick Reference

### 8.1 Complete Setup Script (One-Time)

```bash
#!/bin/bash
# Save as setup-cypress-tests.sh

# 1. Frontend
npm install --legacy-peer-deps --force

# 2. Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# 3. Create data directory
mkdir -p backend/data

# 4. Install Linux dependencies (if needed)
# sudo apt-get install -y libgtk-3-0 libgbm1 libxss1 libasound2t64 xvfb python3.12-venv

echo "Setup complete!"
```

### 8.2 Quick Start Commands

**Start Backend:**
```bash
cd backend && \
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db" && \
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080" && \
export ENABLE_WEBSOCKET_SUPPORT=false && \
source .venv/bin/activate && \
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*' &
```

**Create Test User:**
```bash
sleep 5 && \
curl -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"jjdrisco@ucsd.edu","password":"0000","name":"Test User"}'
```

**Start Frontend:**
```bash
npm run dev -- --port 5173 --host &
```

**Run Child-Profile Tests:**
```bash
export RUN_CHILD_PROFILE_TESTS=1 && \
export CYPRESS_baseUrl=http://localhost:5173 && \
xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

### 8.3 Environment Variables Cheat Sheet

```bash
# Backend
export DATABASE_URL="sqlite:///$(pwd)/backend/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080

# Frontend (optional)
export BACKEND_PORT=8080
export BACKEND_HOST=localhost

# Cypress (for child-profile tests)
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173
export TEST_EMAIL=jjdrisco@ucsd.edu  # Optional override
export TEST_PASSWORD=0000  # Optional override
```

---

## Additional Resources

- **Main Documentation:** `docs/CLOUD_DEVELOPMENT_AND_TESTING.md`
- **Cypress Configuration:** `cypress.config.ts`
- **Cypress Support:** `cypress/support/e2e.ts`
- **Test Files:** `cypress/e2e/`

---

## Notes

- **First Cypress Run:** May download Cypress binary (~500MB) - requires network and disk space
- **Headless Mode:** Use `xvfb-run -a` on Linux for headless execution
- **Port Conflicts:** If port 5173 is taken, Vite will use 5174, 5175, etc. - update `CYPRESS_baseUrl` accordingly
- **Database:** Each test run uses the same database - child profiles created in one test may appear in another
- **Session Management:** Cypress uses `cy.session()` to cache login sessions - clear cookies/localStorage if needed

---

**Last Updated:** Based on execution experience with Node 22.21.1, Python 3.12.3, Cypress 13.15.0
