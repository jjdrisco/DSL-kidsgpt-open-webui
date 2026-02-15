# GitHub Workflow Debugging Guide

## Monitoring GitHub Workflows

### How to View Workflow Runs

1. **GitHub Actions Dashboard**:
   - Navigate to: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/actions
   - Filter by workflow: "Frontend Build" or "Format & Build Frontend"
   - Click on a failed run to see detailed logs

2. **Direct Workflow URL**:
   - Format & Build Frontend: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/actions/workflows/format-build-frontend.yaml
   - Format Backend: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/actions/workflows/format-backend.yaml

3. **Viewing Logs**:
   - Click on a failed workflow run
   - Expand the failed job (e.g., "Format & Build Frontend")
   - Expand individual steps to see error messages
   - Look for red X marks indicating failed steps

### Common Failure Points in "Format & Build Frontend"

The workflow (`.github/workflows/format-build-frontend.yaml`) runs these steps:

1. **Checkout Repository** - Usually succeeds
2. **Setup Node.js** - Usually succeeds
3. **Install Dependencies** (`npm install --force`) - May fail if:
   - `package-lock.json` is missing or corrupted
   - Network issues
   - Dependency conflicts
4. **Format Frontend** (`npm run format`) - May fail if:
   - Prettier configuration issues
   - Syntax errors in files
   - Missing prettier plugins
5. **Run i18next** (`npm run i18n:parse`) - May fail if:
   - i18next parser configuration issues
   - Missing translation files
6. **Check for Changes After Format** (`git diff --exit-code`) - **MOST COMMON FAILURE**:
   - Fails if formatting changed any files
   - Means code wasn't formatted before commit
   - Solution: Run `npm run format` locally and commit changes
7. **Build Frontend** (`npm run build`) - May fail if:
   - TypeScript errors
   - Missing dependencies
   - Build configuration issues
   - Memory issues (though workflow sets NODE_OPTIONS)

## Debugging the Current Failure

### Step 1: Check Workflow Logs

1. Go to: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/actions
2. Find the most recent failed run for "Format & Build Frontend"
3. Click on it and expand the failed step
4. Look for the error message

### Step 2: Reproduce Locally

Run the same commands locally:

```bash
# Checkout the dev branch
git checkout dev
git pull origin dev

# Install dependencies
npm install --force

# Format code
npm run format

# Check for uncommitted changes
git diff --exit-code
# If this fails, you have uncommitted formatting changes

# Run i18n parse
npm run i18n:parse

# Try building
npm run build
```

### Step 3: Common Issues and Fixes

#### Issue 1: Uncommitted Formatting Changes

**Symptom**: `git diff --exit-code` fails in CI

**Cause**: Code wasn't formatted before committing

**Fix**:
```bash
# Format all files
npm run format

# Commit the changes
git add -A
git commit -m "Apply frontend formatting"
git push origin dev
```

#### Issue 2: Prettier Configuration Warnings

**Symptom**: Warnings about `pluginSearchDirs` in prettier output

**Cause**: Prettier version mismatch or config issue

**Fix**: Update `.prettierrc` to remove deprecated options or update prettier version

#### Issue 3: Build Failures

**Symptom**: `npm run build` fails

**Common causes**:
- TypeScript errors (check `npm run check`)
- Missing dependencies (run `npm install --force`)
- Memory issues (workflow already sets NODE_OPTIONS)

**Fix**:
```bash
# Check for TypeScript errors
npm run check

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --force

# Try build again
npm run build
```

#### Issue 4: i18n Parse Failures

**Symptom**: `npm run i18n:parse` fails

**Fix**: Check `i18next-parser.config.ts` configuration

## Quick Fix Checklist

Before pushing to `dev` or `main`:

- [ ] Run `npm run format` locally
- [ ] Run `npm run i18n:parse` locally
- [ ] Run `git diff --exit-code` to verify no uncommitted changes
- [ ] Run `npm run build` to verify build succeeds
- [ ] Run `npm run check` to verify no TypeScript errors
- [ ] Commit all formatting changes
- [ ] Push to branch

## Monitoring Workflow Status

### GitHub CLI (if installed)

```bash
# List recent workflow runs
gh run list --workflow=format-build-frontend.yaml

# View a specific run
gh run view <run-id>

# Watch a running workflow
gh run watch <run-id>
```

### GitHub API

```bash
# Get latest workflow run status
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/jjdrisco/DSL-kidsgpt-open-webui/actions/workflows/format-build-frontend.yaml/runs?per_page=1
```

## Related Documentation

- [Deployment Workflow](./docs/DEPLOYMENT_WORKFLOW.md) - Overall deployment strategy
- [Project Continuation Guide](./docs/PROJECT_CONTINUATION_GUIDE.md) - CI/CD information
- [Pull Request Workflow](./docs/PULL_REQUEST_WORKFLOW.md) - PR and token setup
