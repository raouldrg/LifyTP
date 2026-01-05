# Lify Development Workflow

## Quick Start (3 Terminals)

```bash
# Terminal 0: Reset (if needed)
npm run dev:reset

# Terminal 1: Infrastructure
npm run dev:infra

# Terminal 2: API
npm run dev:api

# Terminal 3: Mobile
npm run dev:mobile
```

## Verify API is Running

```bash
# Quick test (should respond < 100ms)
curl http://localhost:3000/health

# Test from mobile's perspective (use your machine's LAN IP)
curl http://192.168.1.89:3000/health
```

## Troubleshooting

### API Timeout / Port 3000 in Use
```bash
npm run dev:reset
```

### Find What's Using Port 3000
```bash
lsof -i :3000
```

### Check Running Dev Processes
```bash
ps aux | egrep "tsx|node|expo|metro" | head -n 20
```

### Mobile Can't Reach API
1. Ensure API binds on `0.0.0.0` (check `apps/api/src/index.ts`)
2. Verify your machine's IP matches `apps/mobile/src/config/api.ts`
3. Check firewall isn't blocking port 3000

## API Request Logging

The API logs all requests with timing:
```
[REQ→] GET /health from 192.168.1.119
[RES←] ✓ GET /health 200 2ms
```

Use these logs to diagnose slow requests or timeouts.
