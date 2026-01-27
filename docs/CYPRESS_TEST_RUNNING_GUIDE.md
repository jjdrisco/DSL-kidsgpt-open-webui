# Cypress Test Running Guide

Complete instructions for running Cypress E2E tests in cloud environments (Cursor Cloud, GitHub Codespaces) or locally.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Package Versions](#package-versions)
3. [One-Time Setup](#one-time-setup)
4. [Running Tests](#running-tests)
5. [Troubleshooting](#troubleshooting)
6. [Test Files](#test-files)

---

## Prerequisites

### System Requirements

| Component | Required Version | How to Check |
|-----------|-----------------|--------------|
| **Node.js** | `>=18.13.0` and `<=22.x.x` | `node --version` |
| **npm** | `>=6.0.0` | `npm --version` |
| **Python** | `3.11` or `3.12` | `python3 --version` |
| **xvfb** | Latest (for headless) | `xvfb-run --version` |

### Node.js Version Management

If your system has the wrong Node.js version, use `nvm`:

```bash
# Install nvm (if not installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc

# Install and use Node.js 20.x (required by package.json)
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show v20.x.x
npm --version   # Should show >=6.0.0
```

---

## Package Versions

### Frontend Dependencies

Key packages from `package.json`:

```json
{
  "devDependencies": {
    "cypress": "^13.15.0",
    "vite": "^5.4.14",
    "svelte": "^4.2.18",
    "@sveltejs/kit": "^2.5.20"
  },
  "dependencies": {
    "jspdf": "^4.0.0"  // Updated from ^3.0.0 for security
  }
}
```

**Important:** Some TipTap packages may have peer dependency conflicts. Use `--legacy-peer-deps` when installing.

### Backend Dependencies

Key packages from `backend/requirements.txt`:

- `langchain-core>=0.3.72,<1.0.0` (required for moderation features)
- `fastapi`
- `uvicorn`
- `sqlalchemy`

---

## One-Time Setup

### Step 1: Install Frontend Dependencies

From project root:

```bash
# Install with legacy peer deps to handle TipTap conflicts
npm install --legacy-peer-deps

# Verify installation
npm list cypress  # Should show cypress@13.15.0 or similar
```

**If you get peer dependency warnings:**
- This is expected for TipTap packages
- The `--legacy-peer-deps` flag handles these conflicts
- The tests will still run correctly

**If you get engine errors (Node.js version):**
- Use `nvm` to switch to Node.js 20.x (see Prerequisites)
- Or use `npm install --force` (not recommended for production)

### Step 2: Install Backend Dependencies

From project root:

```bash
cd backend

# Create virtual environment (Python 3.11 or 3.12)
python3.11 -m venv .venv
# OR
python3.12 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
# OR
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Verify critical packages
pip list | grep langchain-core  # Should show version >=0.3.72,<1.0.0

cd ..
```

**If you get `ensurepip is not available`:**
```bash
# Ubuntu/Debian
sudo apt-get install python3.11-venv
# OR
sudo apt-get install python3.12-venv
```

**If you get `ModuleNotFoundError: No module named 'langchain_core.memory'`:**
```bash
# Reinstall langchain-core with version constraint
pip install "langchain-core>=0.3.72,<1.0.0" --force-reinstall
```

### Step 3: Create Backend Data Directory

```bash
mkdir -p backend/data
```

This directory stores the SQLite database (`webui.db`).

---

## Running Tests

### Prerequisites Before Running Tests

1. **Backend server must be running** (port 8080)
2. **Frontend dev server must be running** (port 5173 or 5174)
3. **Test user account must exist** in the database

### Step 1: Start Backend Server

**Terminal 1:**

```bash
cd backend

# Activate virtual environment (if not already active)
source .venv/bin/activate  # Linux/Mac
# OR
.venv\Scripts\activate     # Windows

# Set environment variables
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080

# Start backend
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*'
```

**Verify backend is running:**
```bash
curl http://localhost:8080/api/v1/auths/
# Should return: {"detail":"Not authenticated"} (this is expected)
```

### Step 2: Start Frontend Dev Server

**Terminal 2:**

```bash
# From project root
npm run dev
```

**Note the port** that Vite uses (usually `5173` or `5174`). You'll need this for `CYPRESS_baseUrl`.

**Verify frontend is running:**
```bash
curl http://localhost:5173
# Should return HTML content
```

### Step 3: Create Test User Account

The tests require an existing user account. Create one via API:

```bash
# Replace with actual backend URL
curl -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword",
    "name": "Test User"
  }'
```

**Default test credentials** (if using existing account):
- Email: `admin@example.com` (or `jjdrisco@ucsd.edu`)
- Password: `password` (or `0000`)

### Step 4: Run Cypress Tests

**Terminal 3 (or same as Terminal 2 if backend/frontend are in background):**

#### For Exit Survey Tests:

```bash
# From project root
export CYPRESS_baseUrl=http://localhost:5173  # Use actual Vite port
xvfb-run -a npx cypress run --spec "cypress/e2e/exit-survey-new-features.cy.ts" --headless
```

#### For Moderation Scenario Tests:

```bash
# From project root
export CYPRESS_baseUrl=http://localhost:5173  # Use actual Vite port
xvfb-run -a npx cypress run --spec "cypress/e2e/moderation-scenario-new-features.cy.ts" --headless
```

#### Run All New Feature Tests:

```bash
export CYPRESS_baseUrl=http://localhost:5173
xvfb-run -a npx cypress run --spec "cypress/e2e/exit-survey-new-features.cy.ts,cypress/e2e/moderation-scenario-new-features.cy.ts" --headless
```

**Note:** `xvfb-run -a` is required for headless execution in cloud environments (provides virtual X server).

---

## Environment Variables

### For Cypress Tests

| Variable | Purpose | Default |
|----------|---------|---------|
| `CYPRESS_baseUrl` | Frontend URL | `http://localhost:8080` |
| `TEST_EMAIL` | Test user email | `admin@example.com` |
| `TEST_PASSWORD` | Test user password | `password` |
| `RUN_CHILD_PROFILE_TESTS` | Skip admin registration | Not set |

**Example:**
```bash
export CYPRESS_baseUrl=http://localhost:5173
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword
```

### For Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///backend/data/webui.db` | SQLite database path |
| `PORT` | `8080` | Backend port |
| `CORS_ALLOW_ORIGIN` | `*` | Allowed origins (semicolon-separated) |
| `ENABLE_WEBSOCKET_SUPPORT` | `true` | WebSocket support (set `false` for tests) |

---

## Complete Test Run Script

Here's a complete script to run everything:

```bash
#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Cypress test environment...${NC}"

# 1. Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ] || [ "$NODE_VERSION" -gt 22 ]; then
    echo -e "${RED}Error: Node.js version must be >=18 and <=22. Current: $(node --version)${NC}"
    echo "Install nvm and switch to Node.js 20: nvm install 20 && nvm use 20"
    exit 1
fi

# 2. Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing frontend dependencies...${NC}"
    npm install --legacy-peer-deps
fi

# 3. Setup backend virtual environment if needed
if [ ! -d "backend/.venv" ]; then
    echo -e "${GREEN}Setting up backend virtual environment...${NC}"
    cd backend
    python3.11 -m venv .venv || python3.12 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cd ..
fi

# 4. Create data directory
mkdir -p backend/data

# 5. Start backend in background
echo -e "${GREEN}Starting backend server...${NC}"
cd backend
source .venv/bin/activate
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*' > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 5

# 6. Create test user (if needed)
echo -e "${GREEN}Creating test user...${NC}"
curl -s -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword","name":"Test User"}' \
  > /dev/null 2>&1 || echo "User may already exist (this is okay)"

# 7. Start frontend in background
echo -e "${GREEN}Starting frontend dev server...${NC}"
npm run dev -- --port 5173 --host > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 10

# 8. Run Cypress tests
echo -e "${GREEN}Running Cypress tests...${NC}"
export CYPRESS_baseUrl=http://localhost:5173
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword

# Run exit survey tests
echo -e "${GREEN}Running exit survey tests...${NC}"
xvfb-run -a npx cypress run --spec "cypress/e2e/exit-survey-new-features.cy.ts" --headless

# Run moderation scenario tests
echo -e "${GREEN}Running moderation scenario tests...${NC}"
xvfb-run -a npx cypress run --spec "cypress/e2e/moderation-scenario-new-features.cy.ts" --headless

# 9. Cleanup
echo -e "${GREEN}Cleaning up...${NC}"
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true

echo -e "${GREEN}Tests completed!${NC}"
```

Save this as `run-cypress-tests.sh`, make it executable (`chmod +x run-cypress-tests.sh`), and run it.

---

## Troubleshooting

### Issue: `npm install` fails with peer dependency errors

**Solution:**
```bash
npm install --legacy-peer-deps
```

**Why:** TipTap packages have peer dependency conflicts that `--legacy-peer-deps` resolves.

---

### Issue: `npm install` fails with engine error (Node.js version)

**Error:**
```
npm error code EBADENGINE
npm error Unsupported engine: wanted: {"node":">=18.13.0 <=22.x.x"}
```

**Solution:**
```bash
# Install nvm (see Prerequisites)
nvm install 20
nvm use 20
npm install --legacy-peer-deps
```

---

### Issue: `vite: command not found` when running `npm run dev`

**Solution:**
```bash
# Reinstall dependencies
npm install --legacy-peer-deps

# Clear npm cache
npm cache clean --force

# Try again
npm run dev
```

---

### Issue: Backend fails with `ModuleNotFoundError: No module named 'langchain_core.memory'`

**Solution:**
```bash
cd backend
source .venv/bin/activate
pip install "langchain-core>=0.3.72,<1.0.0" --force-reinstall
# OR reinstall all requirements
pip install -r requirements.txt --force-reinstall
```

---

### Issue: `npm run dev` fails with `@azure/msal-browser` resolution error

**Error:**
```
Error: Failed to resolve entry for package "@azure/msal-browser"
```

**Solution:**
```bash
# Clear Vite cache
rm -rf node_modules/.vite

# The vite.config.ts already excludes this package, but if issue persists:
# Check that vite.config.ts has:
#   optimizeDeps: { exclude: ['@azure/msal-browser'] }
```

---

### Issue: Cypress fails with "Missing X server or $DISPLAY"

**Error:**
```
Missing X server or $DISPLAY
```

**Solution:**
```bash
# Always use xvfb-run for headless execution
xvfb-run -a npx cypress run --headless

# Verify xvfb is installed
xvfb-run --version
# If not installed (Ubuntu/Debian):
sudo apt-get update
sudo apt-get install xvfb
```

---

### Issue: Tests fail because scenarios don't load

**Symptoms:**
- "Step 1: Highlight the content that concerns you" never appears
- Tests timeout waiting for scenarios

**Possible Causes:**
1. **No scenarios in database** - Backend needs scenarios seeded
2. **Child profile not selected** - Ensure child profile is created and selected
3. **Assignment step not set** - Ensure `assignmentStep=2` in localStorage

**Solutions:**

**A. Verify child profile is selected:**
```bash
# Check via API
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/v1/child-profiles
```

**B. Check if scenarios exist:**
```bash
# Check backend logs for scenario assignment errors
tail -f /tmp/backend.log | grep -i scenario
```

**C. Ensure workflow steps are completed:**
- Child profile must be created (`/kids/profile`)
- Child profile must be selected (sets `assignmentStep=2`)
- Then visit `/moderation-scenario`

---

### Issue: Frontend and backend on different ports

**Solution:**
```bash
# Set CYPRESS_baseUrl to match actual Vite port
export CYPRESS_baseUrl=http://localhost:5174  # Use actual port from npm run dev output

# Or use fixed port
npm run dev -- --port 5173 --host
export CYPRESS_baseUrl=http://localhost:5173
```

---

### Issue: Tests pass locally but fail in CI

**Common CI Issues:**

1. **Different Node.js version in CI:**
   - Check CI configuration for Node.js version
   - Ensure CI uses Node.js 20.x

2. **Database not initialized:**
   - CI may need database setup
   - Check if CI runs migrations

3. **Services not started:**
   - CI may need explicit service startup
   - Check CI workflow files

---

## Test Files

### Exit Survey Tests

**File:** `cypress/e2e/exit-survey-new-features.cy.ts`

**Tests:**
- Child information modal
- Personality traits selection
- Additional characteristics (10 char minimum)
- "Is child only child" question
- "Has child used ChatGPT" question
- "Have you monitored" question
- Attention check duplicate questions
- Form validation and submission

**Status:** ✅ All 13 tests passing

### Moderation Scenario Tests

**File:** `cypress/e2e/moderation-scenario-new-features.cy.ts`

**Tests:**
- Loading screen while scenarios populate
- Two-section highlighting (prompt and response)
- "View All Highlights" buttons
- Highlighted concerns modal
- Likert scale for level of concern in Step 2
- Step 2 validation
- Step 1 continue button validation

**Status:** ⚠️ 3/8 passing (5 tests require scenarios in database)

---

## Quick Reference

### Start Services

```bash
# Terminal 1: Backend
cd backend && source .venv/bin/activate
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1

# Terminal 2: Frontend
npm run dev
# Note the port (e.g., 5173)

# Terminal 3: Tests
export CYPRESS_baseUrl=http://localhost:5173  # Use port from Terminal 2
xvfb-run -a npx cypress run --spec "cypress/e2e/exit-survey-new-features.cy.ts" --headless
```

### Verify Setup

```bash
# Check Node.js version
node --version  # Should be 18.x, 20.x, 21.x, or 22.x

# Check npm
npm --version   # Should be >=6.0.0

# Check Python
python3 --version  # Should be 3.11 or 3.12

# Check Cypress
npx cypress --version  # Should be 13.15.0 or similar

# Check backend
curl http://localhost:8080/api/v1/auths/  # Should return JSON

# Check frontend
curl http://localhost:5173  # Should return HTML
```

---

## Package Lock Files

**Important:** `package-lock.json` must be in sync with `package.json`.

If you modify `package.json`:
```bash
npm install --legacy-peer-deps
# This regenerates package-lock.json
```

**Never manually edit `package-lock.json`** - it's auto-generated.

---

## Additional Resources

- **Cypress Documentation:** https://docs.cypress.io
- **Vite Documentation:** https://vitejs.dev
- **FastAPI/Uvicorn:** https://fastapi.tiangolo.com
- **Project README:** `README.md`

---

## Support

If tests fail:
1. Check backend logs: `tail -f /tmp/backend.log`
2. Check frontend logs: `tail -f /tmp/frontend.log`
3. Check Cypress screenshots: `cypress/screenshots/`
4. Check Cypress videos: `cypress/videos/`

For scenario-related failures, ensure:
- Backend has scenarios in database
- Child profile is created and selected
- Assignment step is set to 2
