#!/bin/bash
# Cypress Test Runner Script
# Runs backend, frontend, and Cypress tests in sequence

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
TEST_EMAIL=${TEST_EMAIL:-test@example.com}
TEST_PASSWORD=${TEST_PASSWORD:-testpassword}
CYPRESS_SPEC=${CYPRESS_SPEC:-"cypress/e2e/exit-survey-new-features.cy.ts,cypress/e2e/moderation-scenario-new-features.cy.ts"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cypress Test Runner${NC}"
echo -e "${GREEN}========================================${NC}"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ] || [ "$NODE_VERSION" -gt 22 ]; then
    echo -e "${RED}Error: Node.js version must be >=18 and <=22${NC}"
    echo -e "${YELLOW}Current: $(node --version)${NC}"
    echo -e "${YELLOW}Install nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash${NC}"
    echo -e "${YELLOW}Then: nvm install 20 && nvm use 20${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node --version)${NC}"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
if [[ "$PYTHON_VERSION" != "3.11" && "$PYTHON_VERSION" != "3.12" ]]; then
    echo -e "${YELLOW}Warning: Python 3.11 or 3.12 recommended. Found: $(python3 --version)${NC}"
fi
echo -e "${GREEN}✓ Python version: $(python3 --version)${NC}"

# Check xvfb
if ! command -v xvfb-run &> /dev/null; then
    echo -e "${YELLOW}Warning: xvfb-run not found. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y xvfb || echo -e "${RED}Could not install xvfb. Tests may fail in headless mode.${NC}"
fi

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing frontend dependencies...${NC}"
    npm install --legacy-peer-deps
fi
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Setup backend virtual environment if needed
if [ ! -d "backend/.venv" ]; then
    echo -e "${GREEN}Setting up backend virtual environment...${NC}"
    cd backend
    python3.11 -m venv .venv 2>/dev/null || python3.12 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    cd ..
fi
echo -e "${GREEN}✓ Backend virtual environment ready${NC}"

# Create data directory
mkdir -p backend/data
echo -e "${GREEN}✓ Data directory ready${NC}"

# Start backend
echo -e "${GREEN}Starting backend server on port $BACKEND_PORT...${NC}"
cd backend
source .venv/bin/activate
export DATABASE_URL="sqlite:///$(pwd)/data/webui.db"
export CORS_ALLOW_ORIGIN="http://localhost:$FRONTEND_PORT;http://localhost:$((FRONTEND_PORT+1));http://localhost:$BACKEND_PORT"
export ENABLE_WEBSOCKET_SUPPORT=false
export PORT=$BACKEND_PORT
uvicorn open_webui.main:app --port $BACKEND_PORT --host 127.0.0.1 --forwarded-allow-ips '*' > /tmp/cypress-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 5

# Verify backend is running
if ! curl -s http://localhost:$BACKEND_PORT/api/v1/auths/ > /dev/null 2>&1; then
    echo -e "${RED}Error: Backend failed to start${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/cypress-backend.log${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Backend running on port $BACKEND_PORT${NC}"

# Create test user
echo -e "${GREEN}Creating test user...${NC}"
curl -s -X POST "http://localhost:$BACKEND_PORT/api/v1/auths/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"name\":\"Test User\"}" \
  > /dev/null 2>&1 || echo -e "${YELLOW}User may already exist (this is okay)${NC}"

# Start frontend
echo -e "${GREEN}Starting frontend dev server on port $FRONTEND_PORT...${NC}"
npm run dev -- --port $FRONTEND_PORT --host > /tmp/cypress-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 10

# Verify frontend is running
if ! curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
    echo -e "${RED}Error: Frontend failed to start${NC}"
    echo -e "${YELLOW}Check logs: tail -f /tmp/cypress-frontend.log${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 1
fi
echo -e "${GREEN}✓ Frontend running on port $FRONTEND_PORT${NC}"

# Run Cypress tests
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Running Cypress tests...${NC}"
echo -e "${GREEN}========================================${NC}"

export CYPRESS_baseUrl=http://localhost:$FRONTEND_PORT
export TEST_EMAIL=$TEST_EMAIL
export TEST_PASSWORD=$TEST_PASSWORD

# Run tests
xvfb-run -a npx cypress run --spec "$CYPRESS_SPEC" --headless
TEST_EXIT_CODE=$?

# Cleanup
echo -e "${GREEN}Cleaning up...${NC}"
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true

# Exit with test exit code
exit $TEST_EXIT_CODE
