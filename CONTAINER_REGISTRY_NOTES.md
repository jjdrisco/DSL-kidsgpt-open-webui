# Container Registry vs Buildpack: File Exclusion

## Important Answer

**No, `.slugignore` does NOT apply to Container Registry builds.**

Container Registry uses:
- **`.dockerignore`** - determines what gets sent to Docker build context
- **Dockerfile COPY commands** - determines what actually gets included in the image

## What I've Done

I've updated `.dockerignore` to exclude the same large files that were in `.slugignore`:

✅ **Now excluded in both:**
- `.svelte-kit/` (323MB build artifacts)
- `static/video/` (95MB demo videos)
- `data-exports/` (data files)
- `stat_analysis/` (analysis files)
- `*.ipynb` (notebooks)
- `*.dump`, `*.sql`, `*.db` (database files)
- Test directories and scripts
- Documentation files (except essential ones)

## How Dockerfile Works

The Dockerfile uses multi-stage builds:

1. **Build stage** (Node.js):
   - `COPY package.json package-lock.json ./` - only package files
   - `COPY . .` - copies everything (respects `.dockerignore`)
   - `RUN npm run build` - creates `build/` directory

2. **Runtime stage** (Python):
   - `COPY --from=build /app/build /app/build` - copies built frontend
   - `COPY ./backend .` - copies backend directory (respects `.dockerignore`)

## Result

With the updated `.dockerignore`, Container Registry builds will:
- ✅ Exclude the same large files as buildpack deployments
- ✅ Not include `static/video/` (95MB saved)
- ✅ Not include `.svelte-kit/` (323MB saved)
- ✅ Not include data exports, notebooks, etc.

The Docker image will still be large due to Python dependencies, but unnecessary files are excluded.

## Next Steps

To switch to Container Registry:
```bash
heroku stack:set container -a dsl-kidsgpt-pilot
git push heroku cursor/heroku-build-memory-e9e1:main
```

The build will use `.dockerignore` (not `.slugignore`) and exclude the same files.
