#!/bin/bash
# Lify Dev Reset Script
# Kills zombie processes and frees dev ports

set -e

echo "🧹 Lify Dev Reset"
echo "================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

killed_any=false

# Function to kill processes matching a pattern
kill_pattern() {
    local pattern="$1"
    local name="$2"
    local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Killing $name...${NC}"
        echo "$pids" | xargs ps -p 2>/dev/null | tail -n +2 || true
        echo "$pids" | xargs kill -9 2>/dev/null || true
        killed_any=true
    fi
}

# Kill tsx watch processes
kill_pattern "tsx watch" "tsx watch"

# Kill expo processes
kill_pattern "expo start" "expo start"

# Kill metro bundler
kill_pattern "metro" "metro bundler"

# Kill node processes running the API
kill_pattern "node.*apps/api" "node api"

# Free port 3000 (API)
port_3000=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$port_3000" ]; then
    echo -e "${YELLOW}Freeing port 3000...${NC}"
    echo "$port_3000" | xargs kill -9 2>/dev/null || true
    killed_any=true
fi

# Free port 8081 (Metro)
port_8081=$(lsof -ti :8081 2>/dev/null || true)
if [ -n "$port_8081" ]; then
    echo -e "${YELLOW}Freeing port 8081...${NC}"
    echo "$port_8081" | xargs kill -9 2>/dev/null || true
    killed_any=true
fi

# Reset watchman if available
if command -v watchman &> /dev/null; then
    echo -e "${YELLOW}Resetting watchman...${NC}"
    watchman watch-del-all 2>/dev/null || true
fi

# Summary
echo ""
if [ "$killed_any" = true ]; then
    echo -e "${GREEN}✅ Cleanup complete${NC}"
else
    echo -e "${GREEN}✅ No zombie processes found${NC}"
fi

# Verify ports are free
echo ""
echo "Port status:"
if lsof -i :3000 &>/dev/null; then
    echo -e "  ${RED}⚠️  Port 3000 still in use${NC}"
else
    echo -e "  ${GREEN}✓ Port 3000 free${NC}"
fi

if lsof -i :8081 &>/dev/null; then
    echo -e "  ${RED}⚠️  Port 8081 still in use${NC}"
else
    echo -e "  ${GREEN}✓ Port 8081 free${NC}"
fi

echo ""
echo "Ready to start dev environment:"
echo "  1. npm run dev:infra"
echo "  2. npm run dev:api   (Terminal A)"
echo "  3. npm run dev:mobile (Terminal B)"
