# Workflow Migration Steps

**Status**: Documentation committed, workflow update pending

## What Was Done

✅ Created comprehensive deployment workflow guide (`docs/DEPLOYMENT_WORKFLOW.md`)  
✅ Committed and pushed documentation

## What Needs to Be Done

### Step 1: Update Heroku Deploy Workflow

The workflow file `.github/workflows/heroku-container-deploy.yml` needs to be updated to trigger on `main` branch. However, this requires a GitHub token with `workflow` scope.

**Option A: Manual Update via GitHub UI**

1. Go to: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/blob/cursor/heroku-build-memory-e9e1/.github/workflows/heroku-container-deploy.yml
2. Click "Edit" (pencil icon)
3. Change:
   ```yaml
   on:
     push:
       branches:
         - cursor/heroku-build-memory-e9e1
   ```
   To:
   ```yaml
   on:
     push:
       branches:
         - main # Production deployments
         # - dev       # Uncomment for staging deployments
         - cursor/heroku-build-memory-e9e1 # Legacy: remove after merging to main
   ```
4. Commit directly to the branch

**Option B: Use Token with Workflow Scope**

1. Create a new GitHub Personal Access Token with `workflow` scope
2. Update git remote:
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/jjdrisco/DSL-kidsgpt-open-webui.git
   ```
3. Then push the workflow changes

### Step 2: Merge to Main

Once the workflow is updated and tested on the feature branch:

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Merge the feature branch
git merge cursor/heroku-build-memory-e9e1

# Push to trigger deployment
git push origin main
```

### Step 3: Verify Deployment

After merging to main:

1. Check GitHub Actions: https://github.com/jjdrisco/DSL-kidsgpt-open-webui/actions
2. Verify "Deploy to Heroku Container Registry" workflow runs
3. Check Heroku: `heroku releases -a dsl-kidsgpt-pilot-alt`
4. Verify app is running: `curl https://dsl-kidsgpt-pilot-alt-c8da0fb33a58.herokuapp.com/health`

---

## Recommended Branch Strategy Summary

**Development Flow**:

```
feature/* → dev → main
```

**Deployment Triggers**:

- Push to `main` → Auto-deploy to production
- Optional: Push to `dev` → Auto-deploy to staging (if separate app configured)

**Current State**:

- All fixes on `cursor/heroku-build-memory-e9e1`
- Workflow triggers on feature branch
- Need to merge to main and update workflow

**Target State**:

- Workflow triggers on `main` branch
- Feature branches merge to `dev` or directly to `main`
- Automatic deployments on merge to main

---

See `docs/DEPLOYMENT_WORKFLOW.md` for complete details.
