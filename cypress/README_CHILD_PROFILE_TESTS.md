# Child Profile Cypress Tests

This document provides specific information about the child-profile Cypress E2E tests.

## Overview

The child-profile tests verify the functionality of the child profile management features in the Open WebUI application. These tests are separate from the standard Cypress tests because they:

1. Use existing user accounts (they don't create admin users)
2. Require specific environment variables to skip the default `registerAdmin()` behavior
3. Test user-facing child profile creation and management workflows

## Test Files

### `kids-profile.cy.ts`

Tests the `/kids/profile` route for creating and managing child profiles from the child/interviewee perspective.

**Test Coverage:**
- Navigation to kids profile page
- Empty state display when no profiles exist
- Creating a new child profile with all required fields
- Displaying existing child profiles
- Editing an existing child profile
- Form validation for required fields

**Credentials:**
- Uses `INTERVIEWEE_EMAIL` / `INTERVIEWEE_PASSWORD` or `TEST_EMAIL` / `TEST_PASSWORD`
- Default: `jjdrisco@ucsd.edu` / `0000`

### `parent-child-profile.cy.ts`

Tests the `/parent` route for viewing and managing child profiles from the parent perspective.

**Test Coverage:**
- Navigation to parent page
- Displaying child profile management interface
- Viewing child profiles
- Navigation between parent page sections

**Credentials:**
- Uses `PARENT_EMAIL` / `PARENT_PASSWORD` or `TEST_EMAIL` / `TEST_PASSWORD`
- Default: `jjdrisco@ucsd.edu` / `0000`

## Prerequisites

### 1. Environment Variables

**Required:**
```bash
export RUN_CHILD_PROFILE_TESTS=1  # Must be set to skip registerAdmin()
export CYPRESS_baseUrl=http://localhost:5173  # Frontend URL (adjust port as needed)
```

**Optional (for custom credentials):**
```bash
export INTERVIEWEE_EMAIL=your-email@example.com
export INTERVIEWEE_PASSWORD=your-password
export PARENT_EMAIL=your-email@example.com
export PARENT_PASSWORD=your-password
export TEST_EMAIL=your-email@example.com  # Override for both
export TEST_PASSWORD=your-password
```

### 2. Running Services

**Backend:**
- Must be running on `localhost:8080` (or set `BACKEND_PORT`)
- Test user account must exist (see below)

**Frontend:**
- Must be running on the port specified in `CYPRESS_baseUrl`
- Usually `http://localhost:5173` (or 5174, etc.)

### 3. Test User Account

The test user account must exist before running these tests. Create it using:

```bash
curl -X POST "http://localhost:8080/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"jjdrisco@ucsd.edu","password":"0000","name":"Test User"}'
```

Or use your own credentials and set the environment variables accordingly.

## Running the Tests

### Run Both Child-Profile Tests

```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173

# On Linux (headless):
xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"

# On Mac/Windows (with display):
npx cypress run --spec "cypress/e2e/kids-profile.cy.ts,cypress/e2e/parent-child-profile.cy.ts"
```

### Run Individual Tests

**Kids Profile:**
```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173
xvfb-run -a npx cypress run --spec "cypress/e2e/kids-profile.cy.ts"
```

**Parent-Child Profile:**
```bash
export RUN_CHILD_PROFILE_TESTS=1
export CYPRESS_baseUrl=http://localhost:5173
xvfb-run -a npx cypress run --spec "cypress/e2e/parent-child-profile.cy.ts"
```

## Why `RUN_CHILD_PROFILE_TESTS=1`?

The standard Cypress tests use a global `before()` hook that calls `registerAdmin()` to create an admin user. However, the child-profile tests:

1. Use existing user accounts (they don't need to create users)
2. May fail if `registerAdmin()` runs and tries to create a user that already exists
3. Test specific user workflows that require a pre-existing account

Setting `RUN_CHILD_PROFILE_TESTS=1` tells `cypress/support/e2e.ts` to skip the `registerAdmin()` call in the global `before()` hook.

## Test Structure

### Before Each Test

Each test:
1. Clears cookies and localStorage
2. Logs in with the test account credentials
3. Navigates to the appropriate route

### Test Isolation

- Tests are designed to work with existing data
- Child profiles created in one test may appear in another
- Tests handle both empty and populated states gracefully

## Troubleshooting

### Error: "expected 500 to be one of [ 200, 400 ]" in before (signup)

**Cause:** `registerAdmin()` ran when it shouldn't have.

**Solution:**
```bash
export RUN_CHILD_PROFILE_TESTS=1
```

### Error: "Expected to find element: #chat-search"

**Cause:** User was redirected to `/kids/profile` instead of home page.

**Solution:** Already fixed in `cypress/support/e2e.ts` - the login function now handles multiple redirect paths.

### Error: Cypress cannot connect to baseUrl

**Cause:** Wrong `CYPRESS_baseUrl` or frontend on different port.

**Solution:**
1. Check what port Vite is using (look at `npm run dev` output)
2. Set `CYPRESS_baseUrl` to match:
   ```bash
   export CYPRESS_baseUrl=http://localhost:5173  # or 5174, etc.
   ```

### Tests fail because user doesn't exist

**Solution:** Create the test user account first (see Prerequisites section above).

## Related Documentation

- **Main Setup Guide:** `docs/CYPRESS_TEST_SETUP.md`
- **Cloud Development Guide:** `docs/CLOUD_DEVELOPMENT_AND_TESTING.md`
- **Cypress Configuration:** `cypress.config.ts`
- **Cypress Support:** `cypress/support/e2e.ts`

## Test Results

Current test status:
- `kids-profile.cy.ts`: 6 tests passing
- `parent-child-profile.cy.ts`: 4 tests passing
- **Total: 10/10 tests passing**

---

**Last Updated:** Based on implementation with Cypress 13.15.0
