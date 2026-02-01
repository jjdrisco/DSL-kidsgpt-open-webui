# Project Continuation Guide

**Last Updated**: 2026-01-31  
**Project**: DSL KidsGPT Open WebUI  
**Repository**: https://github.com/jjdrisco/DSL-kidsgpt-open-webui

This document provides all necessary information to continue development on this project, including features in development, token requirements, workflows, and documentation locations.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features in Development](#features-in-development)
3. [GitHub Token Requirements](#github-token-requirements)
4. [Cypress Testing Workflow](#cypress-testing-workflow)
5. [Development Setup](#development-setup)
6. [Project Structure](#project-structure)
7. [Documentation Index](#documentation-index)
8. [Recent Changes & Context](#recent-changes--context)
9. [CI/CD Information](#cicd-information)
10. [Troubleshooting Quick Reference](#troubleshooting-quick-reference)

---

## Project Overview

This is a fork of Open WebUI customized for a research study involving children and AI interactions. The project includes:

- **Moderation workflow** for parents to review AI responses
- **Child profile system** with personality-based scenario generation
- **Survey system** for data collection (initial survey, exit survey)
- **Workflow management** for tracking study progress
- **Cypress E2E testing** for critical user flows

**Base Framework**: Open WebUI (SvelteKit + FastAPI)  
**Version**: 0.7.2  
**Node.js**: v20.x (required for Cypress)  
**Python**: 3.12+

---

## Features in Development

### 1. Separate Quiz Workflow (Completed - PR #10)

**Status**: ✅ **COMPLETE** - Merged to main (2026-01-30)  
**Branch**: `feature/separate-quiz-workflow` - **INACTIVE** (merged, can be deleted)

**Key Changes**:

- Separated quiz/survey workflow from main chat interface
- Added "Survey View" and "Chat View" navigation buttons
- Improved sidebar visibility logic for survey pages
- Fixed navigation issues with "Open WebUI" and "New Chat" buttons

**Related Files**:

- `src/lib/components/layout/Sidebar/UserMenu.svelte` - Survey/Chat View buttons
- `src/lib/components/admin/Settings/General.svelte` - Open WebUI button
- `src/lib/components/layout/Sidebar.svelte` - New Chat navigation
- `src/routes/(app)/+layout.svelte` - Sidebar visibility logic
- `src/routes/(app)/+page.svelte` - Root route handling

**Note**: This feature is complete and merged. The branch `feature/separate-quiz-workflow` is inactive and can be safely deleted.

### 2. Moderation & Survey System

**Status**: Active Development

**Components**:

- **Moderation Scenario Flow**: Parents review AI responses to child prompts
- **Initial Survey**: Collects child profile and personality data
- **Exit Survey**: Post-study data collection
- **Personality-Based Scenarios**: Generates scenarios from child profile characteristics

**Key Routes**:

- `/moderation-scenario` - Main moderation interface
- `/initial-survey` - Child profile creation
- `/exit-survey` - Post-study survey
- `/kids/profile` - Child profile management
- `/parent` - Parent dashboard

**Documentation**: See `docs/MODERATION_SURVEY_FLOW.md` and `docs/SCENARIO_SYSTEM.md`

### 3. Workflow Management

**Status**: Active Development

**Endpoints**:

- `GET /workflow/state` - Current workflow state
- `GET /workflow/current-attempt` - Attempt tracking
- `GET /workflow/session-info` - Session information
- `GET /workflow/completed-scenarios` - Completed scenarios
- `GET /workflow/study-status` - Study completion status
- `POST /workflow/reset` - Reset workflow
- `POST /workflow/reset-moderation` - Reset moderation only
- `POST /workflow/moderation/finalize` - Finalize moderation

**Testing**: See `cypress/e2e/workflow.cy.ts`

### 4. Child Profile Features

**Status**: Active Development

**Features**:

- Child profile creation with personality traits
- Parent-child profile management
- Profile-based scenario generation
- Attention check integration

**Testing**: See `cypress/e2e/kids-profile.cy.ts` and `cypress/e2e/parent-child-profile.cy.ts`

---

## GitHub Token Requirements

### For Pull Request Operations

**Token Type**: Classic Personal Access Token (PAT)  
**Token Format**: Starts with `ghp_`  
**Required Scopes**:

- ✅ **`repo`** - Full control of private repositories (includes PR operations)
- ✅ **`read:org`** (optional but recommended) - For org-related queries

### Creating a Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: "PR Management Token" (or similar)
4. Expiration: 90 days (or custom)
5. Select scopes: **`repo`** (all sub-scopes)
6. Generate and **copy immediately** (starts with `ghp_`)

### Using the Token

```bash
# Set as environment variable
export GITHUB_TOKEN=ghp_your_token_here

# Or use with GitHub CLI
gh auth login --with-token <<< "ghp_your_token_here"

# Or configure git remote
git remote set-url origin https://ghp_your_token_here@github.com/username/repo.git
```

### Common Issues

- **"Resource not accessible by integration" (HTTP 403)**: Token lacks `repo` scope or is wrong type (must be `ghp_`, not `ghs_`)
- **"Bad credentials" (HTTP 401)**: Token expired or invalid
- **Token works locally but not in CI/CD**: Add as GitHub Secret and reference in workflow

**Full Documentation**: See `docs/PULL_REQUEST_WORKFLOW.md`

---

## Cypress Testing Workflow

### Prerequisites

1. **Node.js v20.x** (required - Cypress has compatibility issues with v22)
2. **Python 3.12+** for backend
3. **System dependencies** (Linux):
   ```bash
   sudo apt-get update
   sudo apt-get install -y xvfb libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1
   ```

### Installation

```bash
# Install frontend dependencies (use --legacy-peer-deps for Node v20 compatibility)
npm install --legacy-peer-deps

# Install backend dependencies
cd backend
pip3 install -r requirements.txt
```

### Complete Testing Setup Process

#### Step 1: Prepare Database

**Critical**: The database must exist and be migrated before running tests.

```bash
# Create data directory
mkdir -p data
chmod 777 data

# Database will be created on first backend startup
# But you can verify it exists:
ls -la data/webui.db
```

#### Step 2: Start Backend (Required First)

**Backend must be running before starting frontend or tests.**

```bash
cd backend

# Set all required environment variables
export WEBUI_SECRET_KEY="mdiQCC4718rQbe3G"
export WHISPER_MODEL_AUTO_UPDATE="false"
export WHISPER_MODEL=""
export DATABASE_URL="sqlite:///$(pwd)/../data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1

# Set Python path
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Start backend
python3 -m uvicorn open_webui.main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips '*'
```

**Verify backend is running**:
```bash
# In another terminal
curl http://localhost:8080/health
# Should return: {"status":"ok"} or similar JSON

# Check if database was created
ls -la data/webui.db
```

**Common Backend Startup Issues**:
- If you see "unable to open database file": Create `data/` directory and ensure it's writable
- If you see "no such table: config": Database migrations haven't run. Backend should auto-run migrations on startup
- If you see "Multiple heads": See [Database Migration Issues](#database-migration-issues) above

#### Step 3: Start Frontend

**In a separate terminal**:

```bash
# From project root
npm run dev
# Note the port (usually 5173 or 5174)
```

**Verify frontend is running**:
```bash
curl http://localhost:5173
# Should return HTML
```

#### Step 4: Run Tests

**Important**: Both backend and frontend must be running before tests.

**Set test environment variables**:
```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173  # Use actual frontend port
```

**Workflow API Tests**:
```bash
xvfb-run -a npx cypress run --headless --spec cypress/e2e/workflow.cy.ts
```

**Child Profile Tests**:
```bash
RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 \
  npx cypress run --headless --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

**Survey Sidebar Tests**:
```bash
CYPRESS_baseUrl=http://localhost:5173 \
  npx cypress run --headless --spec cypress/e2e/survey-sidebar.cy.ts
```

**All Tests**:
```bash
RUN_CHILD_PROFILE_TESTS=1 CYPRESS_baseUrl=http://localhost:5173 \
  xvfb-run -a npx cypress run --headless
```

**Interactive Mode** (requires display):
```bash
npx cypress open
```

### Test Execution Order

**Recommended order**:
1. ✅ Backend started and healthy (`curl http://localhost:8080/health`)
2. ✅ Frontend started and accessible (`curl http://localhost:5173`)
3. ✅ Database exists and migrated (`ls -la data/webui.db`)
4. ✅ Run tests

### Common Cypress Test Issues

**Problem**: `Cannot find module 'cypress'`
- **Solution**: Run `npm install --legacy-peer-deps` to install Cypress

**Problem**: `AssertionError: expected 500 to be one of [ 200, 400, 403 ]`
- **Cause**: Backend error during signup/login
- **Solution**: 
  1. Check backend logs for errors
  2. Verify database is initialized and migrated
  3. Check `WEBUI_SECRET_KEY` is set
  4. Verify backend is accessible: `curl http://localhost:8080/health`

**Problem**: `Error: Email input not found on auth page`
- **Cause**: Frontend not loaded or redirect occurred
- **Solution**: 
  1. Verify frontend is running on correct port
  2. Check `CYPRESS_baseUrl` matches actual frontend port
  3. Add `cy.wait(1000)` before interacting with UI elements

**Problem**: `CypressError: cy.click() failed because this element is being covered`
- **Cause**: Modal or overlay covering element
- **Solution**: 
  1. Use `{ force: true }` option: `cy.get('button').click({ force: true })`
  2. Wait for overlays to disappear: `cy.wait(1000)`
  3. Close modals before interaction

**Problem**: `Timed out retrying: Expected to find element: #survey-sidebar-nav`
- **Cause**: Sidebar not visible (hidden by default on some pages)
- **Solution**: 
  1. Check if sidebar toggle button exists
  2. Click toggle to show sidebar: `cy.get('button[aria-label*="Sidebar"]').click()`
  3. Wait for sidebar to appear: `cy.wait(500)`

**Problem**: Tests pass locally but fail in CI
- **Solution**: 
  1. Ensure all environment variables are set in CI
  2. Verify database is initialized in CI
  3. Check backend startup logs in CI
  4. Ensure `CYPRESS_baseUrl` is set correctly in CI

### Test Accounts & Credentials

**Default Test Credentials**:

- **Admin/Test User**:
  - Email: `jjdrisco@ucsd.edu`
  - Password: `0000`

**Override with Environment Variables**:

- `INTERVIEWEE_EMAIL` / `INTERVIEWEE_PASSWORD` (kids spec)
- `PARENT_EMAIL` / `PARENT_PASSWORD` (parent spec)
- `TEST_EMAIL` / `TEST_PASSWORD` (both)

**Creating Test Accounts**:

Test accounts are created automatically by Cypress during test execution via the `cy.loginAdmin()` command in `cypress/support/e2e.ts`. The command:
1. Attempts to register a new admin user via API
2. If user exists (400 response), proceeds to login
3. If registration succeeds (200), user is created and logged in

**Manual Account Creation** (if needed):

```bash
# Via API (if backend is running)
curl -X POST http://localhost:8080/api/v1/auths/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "admin"
  }'
```

**Note**: Ensure backend is running and database is initialized before creating accounts.

### Available Test Suites

| Test File                    | Description                                 |
| ---------------------------- | ------------------------------------------- |
| `workflow.cy.ts`             | Workflow API endpoints and state management |
| `kids-profile.cy.ts`         | Child profile creation and management       |
| `parent-child-profile.cy.ts` | Parent-child profile interactions           |
| `navigation.cy.ts`           | Navigation and routing tests                |
| `chat.cy.ts`                 | Chat interface tests                        |
| `registration.cy.ts`         | User registration flow                      |
| `settings.cy.ts`             | Settings page tests                         |
| `documents.cy.ts`            | Document management tests                   |

### Debugging Test Failures

**Step-by-step debugging**:

1. **Verify services are running**:
   ```bash
   # Backend health check
   curl http://localhost:8080/health
   
   # Frontend accessibility
   curl http://localhost:5173
   
   # Database exists
   ls -la data/webui.db
   ```

2. **Check backend logs** for errors:
   - Look for database errors
   - Check for missing tables/columns
   - Verify migration status

3. **Check Cypress logs**:
   - Run with `--headed` flag to see browser
   - Check console for JavaScript errors
   - Verify network requests in Cypress UI

4. **Verify test account**:
   - Check if account exists in database
   - Verify credentials match test expectations
   - Check if account has correct role/permissions

5. **Common failure patterns**:
   - **500 errors**: Usually backend/database issues
   - **404 errors**: Frontend routing or API endpoint issues
   - **Timeout errors**: Services not running or slow response
   - **Element not found**: UI changes or timing issues

**Full Documentation**: See `docs/CYPRESS_TEST_SETUP.md` and `cypress/README_CHILD_PROFILE_TESTS.md`

---

## Development Setup

### Backend Setup & Credentials

#### Required Environment Variables

The backend requires specific environment variables to run. Create a `.env` file or export them before starting:

```bash
# Required for backend startup
export WEBUI_SECRET_KEY="mdiQCC4718rQbe3G"  # Or generate your own secret key
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"  # SQLite database path
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"

# Optional but recommended
export WHISPER_MODEL_AUTO_UPDATE="false"
export WHISPER_MODEL=""
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1

# For production/remote deployments
export FORWARDED_ALLOW_IPS='*'
```

**Important Notes**:
- `WEBUI_SECRET_KEY`: Must be set for session management. Use a secure random string.
- `DATABASE_URL`: Points to SQLite database. Ensure `data/` directory exists and is writable.
- `CORS_ALLOW_ORIGIN`: Must include all frontend ports you'll use (5173, 5174, etc.).

#### Database Setup

**1. Create data directory**:
```bash
mkdir -p data
chmod 777 data  # Ensure writable
```

**2. Database will be auto-created** on first backend startup if it doesn't exist.

**3. Database migrations**:
- Migrations run automatically on backend startup via `backend/open_webui/config.py`
- If you encounter "multiple heads" migration errors, see [Database Migration Issues](#database-migration-issues)

#### Backend Startup Command

**Full command with all required variables**:
```bash
cd backend
export WEBUI_SECRET_KEY="mdiQCC4718rQbe3G"
export WHISPER_MODEL_AUTO_UPDATE="false"
export WHISPER_MODEL=""
export DATABASE_URL="sqlite:///$(pwd)/../data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1

# Set Python path (required if running from backend directory)
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Start backend
python3 -m uvicorn open_webui.main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips '*'
```

**Or use the startup script** (if available):
```bash
cd backend
./start.sh
```

**Verify backend is running**:
```bash
curl http://localhost:8080/health
# Should return: {"status":"ok"} or similar
```

#### Common Backend Issues

**Problem**: `python: command not found`
- **Solution**: Use `python3` instead of `python`
- **Check**: `which python3` and `python3 --version` (need 3.12+)

**Problem**: `ModuleNotFoundError: No module named 'uvicorn'`
- **Solution**: Install dependencies: `pip3 install -r requirements.txt`
- **Or**: `pip3 install uvicorn fastapi`

**Problem**: `ModuleNotFoundError: No module named 'open_webui'`
- **Solution**: Set `PYTHONPATH`:
  ```bash
  export PYTHONPATH="$(pwd):$PYTHONPATH"  # From backend directory
  # Or run from project root
  ```

**Problem**: `sqlalchemy.exc.OperationalError: unable to open database file`
- **Solution**: 
  1. Create `data` directory: `mkdir -p data && chmod 777 data`
  2. Verify `DATABASE_URL` path is correct
  3. Check write permissions on `data/` directory

**Problem**: `sqlalchemy.exc.OperationalError: no such table: config`
- **Solution**: Database migrations haven't run. See [Database Migration Issues](#database-migration-issues)

#### Database Migration Issues

**Problem**: Multiple migration heads detected
- **Error**: `alembic.util.exc.CommandError: Multiple heads are present`
- **Solution**: 
  1. Check current heads: `cd backend && alembic heads`
  2. If multiple heads exist, create a merge migration:
     ```bash
     cd backend
     alembic merge -m "merge_all_heads" <head1> <head2> <head3>
     ```
  3. Update database: `alembic upgrade head`
  4. Verify single head: `alembic heads` (should show one)

**Problem**: Missing tables or columns after migration
- **Solution**: 
  1. Check migration status: `alembic current`
  2. Verify all migrations applied: `alembic upgrade head`
  3. If issues persist, may need to manually create missing tables (see `backend/open_webui/models/`)

**Note**: The project includes a merge migration (`df887c71f080_merge_all_heads.py`) that combines multiple heads. If you see migration errors, ensure this migration is applied.

### Frontend Setup

#### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Backend API URL (usually localhost:8080)
VITE_API_BASE_URL=http://localhost:8080

# Analytics (optional)
SCARF_NO_ANALYTICS=true
DO_NOT_TRACK=true
ANONYMIZED_TELEMETRY=false
```

#### Frontend Startup

```bash
# Install dependencies (use --legacy-peer-deps for Node v20 compatibility)
npm install --legacy-peer-deps

# Start development server
npm run dev
# Note the port (usually 5173 or 5174)
```

**Verify frontend is running**:
```bash
curl http://localhost:5173
# Should return HTML
```

### Development Commands

```bash
# Frontend development
npm run dev              # Start dev server (port 5173/5174)
npm run build           # Production build
npm run format          # Format frontend code (prettier)
npm run i18n:parse      # Parse i18n translations

# Backend development
cd backend
./start.sh              # Start backend (port 8080)
python -m black .       # Format Python code

# Testing
npm run cy:open         # Open Cypress UI
npm run test:frontend   # Run frontend unit tests
```

### Code Formatting

**Frontend**:

```bash
npm run format          # Prettier (JS/TS/Svelte/CSS/MD/HTML/JSON)
npm run i18n:parse      # Parse and format i18n files
```

**Backend**:

```bash
python -m black . --exclude ".venv/|/venv/"
```

**CI Requirements**:

- Black version: 26.1.0 (check `pyproject.toml`)
- Prettier: Latest (from `package.json`)
- All files must pass formatting checks before PR merge

---

## Project Structure

```
/workspace/
├── backend/                    # FastAPI backend
│   ├── open_webui/            # Main application
│   │   ├── routers/           # API routes
│   │   ├── models/            # Database models
│   │   ├── internal/          # Internal utilities
│   │   └── migrations/        # Database migrations
│   ├── requirements.txt       # Python dependencies
│   └── start.sh              # Backend startup script
│
├── src/                       # SvelteKit frontend
│   ├── lib/
│   │   ├── components/       # Reusable components
│   │   │   ├── layout/      # Layout components (Sidebar, etc.)
│   │   │   ├── admin/       # Admin components
│   │   │   └── chat/        # Chat components
│   │   ├── routes/          # Page routes
│   │   │   └── (app)/       # Authenticated routes
│   │   │       ├── moderation-scenario/
│   │   │       ├── exit-survey/
│   │   │       ├── initial-survey/
│   │   │       ├── kids/profile/
│   │   │       └── parent/
│   │   └── i18n/            # Internationalization
│   └── routes/               # Route definitions
│
├── cypress/                  # E2E tests
│   ├── e2e/                 # Test files
│   │   ├── workflow.cy.ts
│   │   ├── kids-profile.cy.ts
│   │   ├── parent-child-profile.cy.ts
│   │   └── ...
│   └── support/             # Test utilities
│
├── docs/                     # Documentation
│   ├── CONTRIBUTING.md
│   ├── PULL_REQUEST_WORKFLOW.md
│   ├── CYPRESS_TEST_SETUP.md
│   ├── MODERATION_SURVEY_FLOW.md
│   ├── SCENARIO_SYSTEM.md
│   └── ...
│
├── .github/                  # GitHub config
│   ├── workflows/           # CI/CD workflows
│   └── pull_request_template.md
│
├── package.json             # Frontend dependencies
├── pyproject.toml          # Python project config
└── README.md               # Main project README
```

---

## Documentation Index

### Core Documentation

| Document                       | Location                                | Description                                    |
| ------------------------------ | --------------------------------------- | ---------------------------------------------- |
| **Project Continuation Guide** | `docs/PROJECT_CONTINUATION_GUIDE.md`    | This document - comprehensive project overview |
| **Contributing Guidelines**    | `docs/CONTRIBUTING.md`                  | General contribution guidelines                |
| **PR Workflow & Tokens**       | `docs/PULL_REQUEST_WORKFLOW.md`         | Pull request process and GitHub token setup    |
| **Cypress Test Setup**         | `docs/CYPRESS_TEST_SETUP.md`            | Cypress testing setup and configuration        |
| **Child Profile Tests**        | `cypress/README_CHILD_PROFILE_TESTS.md` | Child profile test details                     |

### Feature Documentation

| Document                   | Location                                | Description                           |
| -------------------------- | --------------------------------------- | ------------------------------------- |
| **Moderation Survey Flow** | `docs/MODERATION_SURVEY_FLOW.md`        | Moderation workflow and decision tree |
| **Scenario System**        | `docs/SCENARIO_SYSTEM.md`               | Scenario generation and management    |
| **Moderation Tool**        | `docs/MODERATION_TOOL_DOCUMENTATION.md` | Moderation tool features              |
| **Survey Implementation**  | `docs/SURVEY_IMPLEMENTATION.md`         | Survey system details                 |

### Infrastructure Documentation

| Document                 | Location                      | Description                      |
| ------------------------ | ----------------------------- | -------------------------------- |
| **Heroku Backup Setup**  | `docs/HEROKU_BACKUP_SETUP.md` | Heroku deployment and backup     |
| **Apache Configuration** | `docs/apache.md`              | Apache server setup              |
| **Security Guidelines**  | `docs/SECURITY.md`            | Security practices and reporting |

### Additional Resources

- **Main README**: `README.md` - Project overview and installation
- **Database README**: `backend/README_DATABASE.md` - Database setup
- **Docs Index**: `docs/README.md` - Documentation overview

---

## Recent Changes & Context

### Recently Merged (2026-01-30)

**PR #10: Feature: Separate Quiz Workflow** ✅ **COMPLETE**

- Separated survey/quiz workflow from main chat interface
- Added navigation buttons for "Survey View" and "Chat View"
- Fixed sidebar visibility on survey pages
- Improved "Open WebUI" and "New Chat" button navigation
- **Branch**: `feature/separate-quiz-workflow` - **INACTIVE** (merged, can be deleted)

**Key Files Changed**:

- `src/lib/components/layout/Sidebar/UserMenu.svelte`
- `src/lib/components/admin/Settings/General.svelte`
- `src/lib/components/layout/Sidebar.svelte`
- `src/routes/(app)/+layout.svelte`
- `src/routes/(app)/+page.svelte`

### Inactive/Completed Branches

The following branches have been merged and are inactive:

- **`feature/separate-quiz-workflow`** - Merged via PR #10 (2026-01-30)
  - Status: Complete and merged to main
  - Can be safely deleted from remote repository

### Active Development Areas

1. **Moderation System**: Ongoing improvements to scenario selection and moderation workflow
2. **Child Profile System**: Personality-based scenario generation
3. **Survey System**: Initial and exit survey flows
4. **Workflow Management**: State tracking and progress management
5. **Cypress Testing**: Expanding test coverage for critical flows

### Important Context

- **User Types**: The system supports multiple user types (parent, child, admin, interviewee) with different workflows
- **Prolific Integration**: Special handling for Prolific study participants
- **Personality-Based Scenarios**: Scenarios are generated from child profile characteristics, not hardcoded
- **Attention Checks**: Randomly injected into moderation scenarios for data quality
- **Session Management**: Uses localStorage for scenario package persistence

---

## CI/CD Information

### GitHub Workflows

Located in `.github/workflows/`:

- **`format-backend.yaml`**: Python code formatting with Black (3.11.x and 3.12.x)
- **`format-build-frontend.yaml`**: Frontend formatting (Prettier), i18n parsing, and build
- **`build-release.yml`**: Release builds
- **`deploy-to-hf-spaces.yml`**: HuggingFace Spaces deployment
- **`docker-build.yaml`**: Docker image builds

### CI Requirements

**Backend Formatting**:

- Black version: 26.1.0 (see `pyproject.toml`)
- Must format all Python files before PR merge
- Command: `python -m black . --exclude ".venv/|/venv/"`

**Frontend Formatting**:

- Prettier for JS/TS/Svelte/CSS/MD/HTML/JSON
- i18n parsing required
- Command: `npm run format && npm run i18n:parse`

**Frontend Build**:

- Requires `package-lock.json` (must be committed)
- Uses `npm ci` (not `npm install`)
- Node.js v20.x recommended

### Common CI Failures

1. **Formatting Mismatches**: Local formatter version differs from CI
   - **Fix**: Upgrade local Black to 26.1.0, run formatters locally

2. **Missing package-lock.json**: Required for `npm ci`
   - **Fix**: Run `npm install --package-lock-only` and commit

3. **Syntax Errors**: Prettier/Black can't parse files
   - **Fix**: Fix syntax errors, then format

4. **Line Ending Issues**: CRLF vs LF conflicts
   - **Fix**: Use `git config core.autocrlf false` or normalize line endings

---

## Troubleshooting Quick Reference

### Git Issues

**Problem**: Can't pull changes, "local changes would be overwritten"

```bash
# Check what's modified
git status

# Stash changes
git stash

# Pull
git pull origin main

# Restore stashed changes
git stash pop
```

**Problem**: Line ending conflicts (CRLF vs LF)

```bash
# Force sync with remote
git fetch origin main
git reset --hard origin/main
```

### Development Issues

**Problem**: Frontend won't start

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Problem**: Backend won't start

```bash
# Check Python version (need 3.12+)
python3 --version  # Use python3, not python

# Install dependencies
cd backend
pip3 install -r requirements.txt

# Check port availability
lsof -i :8080

# Verify environment variables are set
echo $WEBUI_SECRET_KEY
echo $DATABASE_URL
echo $CORS_ALLOW_ORIGIN

# Check database directory exists
ls -la data/

# Set Python path if running from backend directory
export PYTHONPATH="$(pwd):$PYTHONPATH"
```

**Problem**: Cypress tests fail

```bash
# Verify Node.js version (need v20.x)
node --version

# Verify services running
curl http://localhost:8080/health
curl http://localhost:5173

# Check database exists and is accessible
ls -la data/webui.db

# Verify backend can access database
# Check backend logs for database errors

# Check test account exists (may need to create manually)
# Verify credentials match environment variables

# Check Cypress can find modules
npm list cypress

# Reinstall if needed
npm install --legacy-peer-deps
```

**Problem**: Database migration errors

```bash
# Check current migration status
cd backend
alembic current

# Check for multiple heads
alembic heads

# If multiple heads, create merge migration
alembic merge -m "merge_heads" <head1> <head2>

# Upgrade to head
alembic upgrade head

# Verify single head
alembic heads
```

### PR Issues

**Problem**: Can't create PR via API

- Verify token has `repo` scope
- Token must start with `ghp_` (Classic PAT)
- Check token hasn't expired

**Problem**: CI formatting failures

- Run formatters locally: `npm run format` and `python -m black .`
- Commit formatted files
- Ensure Black version matches CI (26.1.0)

---

## Quick Start Checklist

When starting work on this project:

- [ ] **Environment Setup**
  - [ ] Node.js v20.x installed
  - [ ] Python 3.12+ installed
  - [ ] Dependencies installed (`npm install --legacy-peer-deps`, `pip install -r requirements.txt`)
  - [ ] `.env` file configured

- [ ] **GitHub Access**
  - [ ] GitHub token created (Classic PAT with `repo` scope)
  - [ ] Token configured (`export GITHUB_TOKEN=ghp_...`)

- [ ] **Documentation Review**
  - [ ] Read `docs/CONTRIBUTING.md`
  - [ ] Read `docs/PULL_REQUEST_WORKFLOW.md`
  - [ ] Read `docs/CYPRESS_TEST_SETUP.md` (if working on tests)
  - [ ] Read relevant feature docs (`MODERATION_SURVEY_FLOW.md`, etc.)

- [ ] **Development Workflow**
  - [ ] Create feature branch from `main`
  - [ ] Make changes and test locally
  - [ ] Run formatters (`npm run format`, `python -m black .`)
  - [ ] Run tests if applicable
  - [ ] Commit with clear messages
  - [ ] Push and create PR targeting `main` or `dev` (check project guidelines)

---

## Contact & Support

- **Repository**: https://github.com/jjdrisco/DSL-kidsgpt-open-webui
- **Documentation**: See `docs/` directory
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions

---

**Last Updated**: 2026-01-31  
**Maintained By**: Project Contributors

---

## Quick Reference: Getting the Webapp Running

### Complete Startup Sequence

**Terminal 1 - Backend**:
```bash
cd backend
export WEBUI_SECRET_KEY="mdiQCC4718rQbe3G"
export DATABASE_URL="sqlite:///$(pwd)/../data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export PYTHONPATH="$(pwd):$PYTHONPATH"
python3 -m uvicorn open_webui.main:app --host 0.0.0.0 --port 8080 --forwarded-allow-ips '*'
```

**Terminal 2 - Frontend**:
```bash
npm run dev
# Note the port (usually 5173)
```

**Terminal 3 - Tests** (optional):
```bash
export CYPRESS_baseUrl=http://localhost:5173
npx cypress run --headless
```

### Verification Checklist

- [ ] `data/` directory exists and is writable
- [ ] Backend responds: `curl http://localhost:8080/health`
- [ ] Frontend accessible: `curl http://localhost:5173`
- [ ] Database file exists: `ls -la data/webui.db`
- [ ] No migration errors in backend logs
- [ ] Environment variables set correctly
