# Local Frontend Development Setup

## Quick Start

### 1. Prerequisites
- **Node.js**: `>=18.13.0` and `<=22.x.x` (check with `node --version`)
- **npm**: `>=6.0.0` (check with `npm --version`)
- **Python**: `3.11` or `3.12` (for backend)

### 2. Install Frontend Dependencies
```bash
npm install
# If you get peer dependency warnings:
npm install --legacy-peer-deps
```

### 3. Start Development Servers

**Terminal 1: Backend**
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:5173;http://localhost:5174;http://localhost:8080"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=8080

# Start backend
uvicorn open_webui.main:app --port 8080 --host 127.0.0.1 --forwarded-allow-ips '*'
```

**Terminal 2: Frontend**
```bash
# From project root
npm run dev
# Frontend will be available at http://localhost:5173 (or 5174, etc.)
```

### 4. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080

## Git Workflow

### Current Branch
- **Working branch**: `frontend-dev` (created from `main`)
- **Base branch**: `main`

### Making Changes
1. Make your frontend changes
2. Test locally with `npm run dev`
3. Format code: `npm run format`
4. Commit changes:
   ```bash
   git add src/
   git commit -m "feat: your frontend change description"
   ```

### Pushing Changes
```bash
# Push your branch
git push -u origin frontend-dev

# Create PR when ready
gh pr create --base main --head frontend-dev --title "Your PR Title"
```

## Useful Commands

```bash
# Format frontend code
npm run format

# Run frontend tests
npm run test:frontend

# Build for production
npm run build

# Check for linting issues
npm run lint:frontend

# Type checking
npm run check
```

## Troubleshooting

### Port Already in Use
```bash
# Use a specific port
npm run dev:5050  # Uses port 5050
# Or
npx vite dev --port 5173 --host
```

### Backend Connection Issues
- Ensure backend is running on port 8080
- Check `CORS_ALLOW_ORIGIN` includes your frontend port
- Verify `BACKEND_PORT=8080` in frontend environment

### Dependency Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## Notes

- The `cursor/cloud-development-cypress-testing-067d` branch contains formatting/CI fixes but no frontend features
- Work on `frontend-dev` branch for your changes
- Keep commits focused on frontend work
- Format code before committing to avoid CI issues
