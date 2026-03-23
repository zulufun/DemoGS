# Real-time Logging Quick Start Guide

## Prerequisites
- Docker & Docker Compose installed
- Python 3.11+ (for load testing script)
- Node.js 18+ (for frontend)

## Starting the System

### 1. Boot up all services
```powershell
# Windows PowerShell
.\dev.ps1 start
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Zookeeper (port 2181)
- Kafka (port 9092)
- Backend API (port 8000)
- Frontend (port 5173)

**Expected output**:
```
✔ All services started successfully
- Database:  http://localhost:5432 (postgres:postgres)
- Backend:   http://localhost:8000
- Frontend:  http://localhost:5173
- Redis:     localhost:6379
- Kafka:     localhost:9092
```

### 2. Verify services are running

```bash
# Check container status
docker compose -f docker-compose.dev.yml ps

# Expected: all containers with status "Up"
SERVICE                    STATUS
demo-postgres-dev          Up
demo-backend-dev           Up
demo-frontend-dev          Up
demo-redis-dev             Up
demo-kafka-dev             Up
demo-zookeeper-dev         Up
```

### 3. Monitor logs

```bash
# View backend logs (includes sync errors)
.\dev.ps1 logs backend

# View specific service
docker logs demo-backend-dev --follow
```

## Testing Real-time Logs

### Option 1: Manual Testing via Frontend

1. Open browser: http://localhost:5173
2. Login with `admin` / `admin`
3. Navigate to Dashboard
4. You should see the Real-time Logs panel with WebSocket status

### Option 2: Command-line Testing

**Check sync status**:
```bash
# Get token first
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}' \
  | jq '.access_token'

# Check if logs are syncing
TOKEN="your-token-here"
curl "http://localhost:8000/api/logs/sync-check?token=$TOKEN"

# Response:
{
  "synced": true,
  "last_sync": "2026-03-23T10:30:00.123456",
  "websocket_available": true,
  "timestamp": "2026-03-23T10:30:05.654321"
}
```

**Monitor Kafka topic**:
```bash
# List topics
docker exec demo-kafka-dev kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092

# Monitor audit-logs topic
docker exec demo-kafka-dev kafka-console-consumer.sh \
  --topic audit-logs \
  --bootstrap-server localhost:9092 \
  --from-beginning
```

**Check Redis cache**:
```bash
# Connect to Redis
docker exec -it demo-redis-dev redis-cli

# View cached logs
KEYS elasticsearch:logs*           # List cached queries
GET "elasticsearch:logs:page:0:size:50"

# View sync tracking
GET elasticsearch:last_sync_time   # Last sync timestamp
```

### Option 3: Load Testing

**Install dependencies**:
```bash
pip install websockets aiohttp
```

**Run load test**:
```bash
# Test with 10 clients for 60 seconds
python scripts/load_test_ws.py --clients 10 --duration 60

# Expected output:
"""
🚀 Starting load test
   Clients: 10
   Duration: 60s

📝 Authenticating...
✓ Token obtained

🔌 Creating 10 WebSocket clients...
  ✓ Client 0: Connected (filter=None)
  ✓ Client 1: Connected (filter=Error)
  ...

📡 Receiving messages for 60s...

======================================
📊 LOAD TEST RESULTS
======================================
Clients:              10
Total messages:       523
Avg / client:         52
Total errors:         0

Per-client breakdown:
Client   Messages     Errors   Filter  
0        52           0        None    
1        48           0        Error   
...
"""
```

## Troubleshooting

### Issue: "Connection refused" when starting

**Check if ports are in use**:
```bash
# Windows: Check if port 8000 is in use
netstat -ano | findstr :8000

# Linux: Check what's using the port
lsof -i :8000
```

**Solution**:
```bash
# Kill existing process on port 8000
taskkill /PID <PID> /F

# Or use different port
.\dev.ps1 stop  # Stop all
.\dev.ps1 start
```

### Issue: "Elasticsearch connection failed"

**Check if Elasticsearch is running**:
```bash
curl http://localhost:9200/_cluster/health
```

**If not running, start docker-elk stack**:
```bash
cd docker-elk
docker compose up -d
```

### Issue: WebSocket not receiving messages

**Step 1**: Check backend logs
```bash
.\dev.ps1 logs backend | grep -i "kafka\|websocket\|elasticsearch"
```

**Step 2**: Verify Kafka is running
```bash
docker exec demo-kafka-dev kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092
```

**Step 3**: Check if Kafka has messages
```bash
docker exec demo-kafka-dev kafka-console-consumer.sh \
  --topic audit-logs \
  --bootstrap-server localhost:9092 \
  --max-messages 1
```

**Step 4**: Monitor frontend console
- Open browser DevTools (F12)
- Check Console for WebSocket errors
- Check Network tab for WebSocket status

### Issue: High CPU/Memory usage

**Check Redis memory**:
```bash
docker exec demo-redis-dev redis-cli INFO memory
```

**Reduce Kafka batch size** in `.env`:
```env
KAFKA_BATCH_SIZE=50     # From 100
KAFKA_BATCH_TIMEOUT_MS=2000  # From 5000
```

**Reduce WebSocket rate limit** in frontend:
```typescript
const { logs } = useWebSocketLogs(token, {
  maxMessagesPerSecond: 30  // From 60
})
```

## Configuration Tuning

### For Low-Latency Real-time (Many logs)

```env
KAFKA_BATCH_SIZE=50
KAFKA_BATCH_TIMEOUT_MS=1000
```

### For High-Throughput (Few logs)

```env
KAFKA_BATCH_SIZE=200
KAFKA_BATCH_TIMEOUT_MS=5000
```

### For Limited Bandwidth

```env
KAFKA_BATCH_SIZE=20
KAFKA_BATCH_TIMEOUT_MS=5000
```

Frontend:
```typescript
const { logs } = useWebSocketLogs(token, {
  maxMessagesPerSecond: 30  // Reduce messages
})
```

## Monitoring Dashboard

Create monitoring queries:

```bash
# Total logs synced (last hour)
docker exec demo-redis-dev redis-cli 
INFO stats

# Kafka consumer lag
docker exec demo-kafka-dev kafka-consumer-groups.sh \
  --group websocket-consumers \
  --describe \
  --bootstrap-server localhost:9092

# Active WebSocket connections
curl http://localhost:8000/api/logs/sync-check?token=TOKEN
```

## Stopping Services

```bash
# Stop all services
.\dev.ps1 stop

# Clear all data and restart fresh
.\dev.ps1 reset
.\dev.ps1 start
```

## Production Deployment

### Before going to production:

1. **Security**
   - Change all default passwords in `.env`
   - Use proper SSL/TLS for WebSocket (wss://)
   - Implement rate limiting middleware
   - Add request signing

2. **Performance**
   - Scale Kafka to 3+ brokers
   - Use Redis Sentinel for high availability
   - Implement log compression
   - Add monitoring/alerting

3. **Reliability**
   - Set up automated backups
   - Configure log retention policies
   - Test failover scenarios
   - Document runbooks

4. **Compliance**
   - Review data retention requirements
   - Implement audit logging
   - Ensure proper access controls
   - Meet regulatory requirements

## Support & Documentation

- Real-time Architecture: [REALTIME_LOGGING.md](./REALTIME_LOGGING.md)
- Backend API: [backend/README.md](./backend/README.md)
- Frontend Setup: [frontend/README.md](./frontend/README.md)

## Next Steps

1. ✅ System is running with real-time logs
2. 📊 Monitor performance metrics
3. 🔧 Tune configuration based on load
4. 📈 Set up production monitoring
5. 🚀 Deploy to production environment
