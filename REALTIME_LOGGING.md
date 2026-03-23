# Real-time Log Streaming Architecture

## Overview

This document describes the Redis + Kafka real-time log streaming system that prevents frontend overload while maintaining low-latency log synchronization from Elasticsearch.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ Elasticsearch (Windows Event Logs)                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │ Polls every 5 seconds
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Backend Service (FastAPI)                                         │
│ - Elasticsearch Sync Service (elasticsearch_service.py)           │
│   - Fetches new logs batch (max 100)                             │
│   - Publishes to Kafka topic: 'audit-logs'                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │ Batch publish
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ Kafka (apache/kafka)                                              │
│ Topic: audit-logs                                                 │
│ - Message per log entry                                           │
│ - Ordered delivery (per partition)                                │
│ - Persistent storage (3x replication)                             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ Redis     │  │ WebSocket │  │ Consumer  │
│ Cache     │  │ Broadcast │  │ Group 1   │
│           │  │           │  │           │
│ - Logs    │  │ - Manager │  │ - Archive │
│ - Cursors │  │ - Rate    │  │ - Metrics │
│ - Counters│  │   Limit   │  │           │
└───────────┘  └───────────┘  └───────────┘
                    │
                    │ Max 100 msg/sec per client
                    ▼
            ┌──────────────────┐
            │ WebSocket Client │
            │ (Browser/Frontend)│
            │                  │
            │ Message Queue    │
            │ - Batch buffer   │
            │ - Rate limiting  │
            │ - UI update      │
            └──────────────────┘
```

## Components

### 1. Elasticsearch Service (`backend/elasticsearch_service.py`)

**Responsibility**: Poll Elasticsearch and sync new logs to Kafka

**Features**:
- Batch fetching (configurable batch size)
- Timestamp-based delta sync (only new logs)
- Pagination support for endpoints
- Redis caching for query results
- Error handling with exponential backoff

```python
# Example: Sync new logs every 5 seconds
await es_service.sync_new_logs_to_kafka()

# Example: Get paginated logs with caching
result = await es_service.get_logs_paginated(
    page=0, 
    page_size=50,
    severity_filter="Error"
)
```

### 2. Kafka Service (`backend/kafka_service.py`)

**Responsibility**: Produce and consume log messages

**Features**:
- Asynchronous producer with error callbacks
- Batch log publishing
- Consumer group management
- Automatic partitioning (by user_id)
- Message ordering guarantee

```python
# Publish logs to Kafka
await publish_batch_logs(logs)

# Consume logs async
consumer = KafkaLogConsumer(
    on_message_callback=process_log,
    group_id="websocket-consumers"
)
await consumer.start()
```

### 3. Redis Service (`backend/redis_service.py`)

**Responsibility**: Cache, rate limiting, session storage

**Features**:
- Key-value caching with TTL
- Atomic counters for rate limiting
- Pattern-based key deletion
- Automatic JSON serialization

```python
# Cache query results (2 minutes)
await set_cache("logs:page:0:size:50", result, ttl=120)

# Track rate limits
count = incr_counter(f"ws:{client_id}:rate_limit")
```

### 4. WebSocket Service (`backend/routes/ws_logs.py`)

**Responsibility**: Real-time log delivery with rate limiting

**Features**:
- Connection management (per-client tracking)
- Rate limit enforcement (100 msg/sec typical)
- Kafka consumer integration
- Ping/pong for connection keep-alive
- Severity filtering support

```typescript
// Frontend: Connect and receive real-time updates
const ws = new WebSocket('ws://localhost:8000/api/ws/logs?token=...')

ws.send(JSON.stringify({
  type: 'subscribe',
  severity_filter: 'Error'
}))

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data)
  if (type === 'log_update') {
    processLog(data)
  }
}
```

## Configuration

### Environment Variables (`.env`)

```env
# Kafka configuration
KAFKA_BOOTSTRAP_SERVERS=kafka:29092
KAFKA_LOG_TOPIC=audit-logs
KAFKA_BATCH_SIZE=100                    # Logs per sync
KAFKA_BATCH_TIMEOUT_MS=5000             # Sync interval

# Redis configuration
REDIS_URL=redis://redis:6379/0

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme
```

### Docker Compose Services

```yaml
# Zookeeper (Kafka coordination)
zookeeper:
  image: confluentinc/cp-zookeeper:7.5.0
  ports:
    - "2181:2181"

# Kafka Broker
kafka:
  image: confluentinc/cp-kafka:7.5.0
  ports:
    - "9092:9092"
  depends_on:
    - zookeeper

# Redis Cache
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

## Data Flow

### 1. Polling Phase (Every 5 seconds)

```
Backend → Elasticsearch
  ├─ Query: "@timestamp > last_sync_time"
  ├─ Limit: 100 logs per batch
  └─ Sort: Descending timestamp

Result: [
  {
    id: "log-id-1",
    timestamp: "2026-03-23T10:30:00Z",
    level: "Error",
    message: "...",
    computer: "SERVER-01",
    ...
  },
  ...
]
```

### 2. Publishing Phase

```
Backend → Kafka
  ├─ Topic: audit-logs
  ├─ Partition Key: user_id (for ordering)
  ├─ Message Count: 0-100 per batch
  └─ Acknowledgment: Wait for all replicas (acks=all)

Status Tracking:
  ├─ last_sync_time → Redis (TTL: 1 hour)
  └─ event_counter → Redis (for metrics)
```

### 3. WebSocket Broadcast Phase

```
Kafka → Consumer → WebSocket Broadcast
  ├─ Consumer reads in batch (max 50 per poll)
  ├─ Rate limit CHECK per connection
  │  └─ Max 100 messages/second
  ├─ Broadcast to all connected clients
  └─ Handle disconnects
```

### 4. Frontend Processing Phase

```
Frontend → Message Queue → Rate Limiter → UI
  ├─ Receive from WebSocket
  ├─ Buffer in state queue
  │  └─ Main thread processes every ~16ms (60fps)
  ├─ Filter by severity if configured
  ├─ Keep last 1000 logs in memory
  └─ Auto-scroll with user override
```

## Rate Limiting Strategy

### Backend Rate Limiting (per connection)

```python
# In ws_logs.py
client_key = f"ws:{id(connection)}:rate_limit"
count = incr_counter(client_key)  # Atomic increment
if count <= 100:  # Max 100/second
    await connection.send_json(message)
```

### Frontend Rate Limiting (client-side)

```typescript
// In useWebSocketLogs.ts
const now = Date.now()
if (now - lastProcessTime < 1000/maxMessagesPerSecond) {
  messageQueue.push(message)
} else {
  processMessage(message)
  lastProcessTime = now
}
```

## Performance Characteristics

### Throughput

| Component | Throughput | Notes |
|-----------|-----------|-------|
| **Elasticsearch → Kafka** | 100 logs/sync, every 5s = 20 logs/sec | Batch-based |
| **Kafka → WebSocket** | Up to 10,000 logs/sec per Kafka cluster | Partition-based |
| **WebSocket → Client** | 100 msgs/sec per connection | Rate-limited |
| **Frontend Processing** | 60 FPS (16ms per frame) | UI-thread aware |

### Latency

| Path | Latency | Notes |
|------|---------|-------|
| **Elasticsearch → UI** | 5-10 seconds | Poll interval + processing |
| **New event in Elasticsearch → WebSocket broadcast** | <1 second | Kafka near real-time |
| **WebSocket message → UI display** | <100ms at 60 FPS | Smooth rendering |

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| **Redis** | ~100MB | Caching + counters |
| **Kafka** | ~500MB | 3x replication (tunable) |
| **Zookeeper** | ~50MB | Minimal |
| **Frontend logs array** | ~5MB | Last 1000 logs in memory |

## Handling Frontend Overload

### Scenario: Too many logs arriving

**Symptoms**: Frontend frame drops, UI becomes unresponsive

**Solution**: The system has multiple safeguards:

1. **Kafka Partitioning**: Distributes load across partitions
2. **Rate Limiting**: WebSocket broadcasts capped at 100 msg/s per client
3. **Message Queueing**: Frontend queues excess messages
4. **Batch Processing**: Frontend processes batches every 16ms
5. **Memory Limit**: Frontend keeps only last 1000 logs
6. **Severity Filtering**: Subscribe only to relevant events

### Configuration Example for High-Load Scenario

```env
# Reduce batch size during peak hours
KAFKA_BATCH_SIZE=50
KAFKA_BATCH_TIMEOUT_MS=2000

# Increase WebSocket rate limit
# (configure in frontend hook options)
maxMessagesPerSecond=30  # Conservative
```

```typescript
// Frontend: Conservative rate limiting
const { logs, isConnected } = useWebSocketLogs(token, {
  maxMessagesPerSecond: 30,  // Instead of default 60
  severityFilter: 'Error'     // Focus on important logs only
})
```

## Testing

### Unit Tests

```bash
# Test Kafka producer/consumer
pytest -xvs tests/test_kafka_service.py

# Test Redis cache
pytest -xvs tests/test_redis_service.py

# Test Elasticsearch sync
pytest -xvs tests/test_elasticsearch_service.py
```

### Load Test

```bash
# Simulate 100 concurrent WebSocket clients
./scripts/load_test_ws.py --clients 100 --duration 60

# Monitor metrics
TELEGRAF monitoring
Kafka metrics (JMX)
Redis memory usage
```

### Integration TestStarting the stack

```bash
# Terminal 1: Start services
.\dev.ps1 start

# Terminal 2: Check Kafka topic
docker exec -it demo-kafka-dev \
  kafka-topics.sh --list --bootstrap-server localhost:9092

# Terminal 3: Monitor logs in real-time
docker exec -it demo-kafka-dev \
  kafka-console-consumer.sh \
  --topic audit-logs \
  --bootstrap-server localhost:9092 \
  --from-beginning

# Terminal 4: Client simulation
curl http://localhost:8000/api/logs/sync-check
```

## Monitoring & Observability

### Key Metrics

```python
# Redis counters to monitor
- elasticsearch:sync_count        # Successful syncs
- elasticsearch:sync_errors       # Failed syncs
- ws:{client_id}:rate_limit       # Per-client message count
- ws:broadcast_errors             # WebSocket send failures
- kafka:messages_published        # Total messages
```

### Dashboards

1. **Real-time Monitor** (`/api/logs/sync-check`)
   - Last sync time
   - Connected clients count
   - Queued messages

2. **Kafka Metrics** (JMX port 9101)
   - Producer metrics (throughput, errors)
   - Consumer lag
   - Partition distribution

3. **Redis Info**
   ```bash
   redis-cli INFO stats
   redis-cli INFO clients
   ```

## Troubleshooting

### Issue: WebSocket connection not receiving messages

**Diagnosis**:
```bash
# Check Kafka topic has messages
docker exec demo-kafka-dev kafka-console-consumer.sh \
  --topic audit-logs --bootstrap-server localhost:9092 \
  --max-messages 1

# Check Redis sync time
redis-cli GET elasticsearch:last_sync_time

# Check WebSocket connected clients
curl http://localhost:8000/api/logs/sync-check
```

**Solution**:
1. Verify Elasticsearch has new logs: `GET winlogbeat-*/_search?size=1`
2. Check Kafka broker is running: `docker exec demo-kafka-dev kafka-broker-api-versions.sh --bootstrap-server localhost:9092`
3. Verify Redis connection: `redis-cli PING`
4. Check backend logs: `.\dev.ps1 logs backend`

### Issue: High latency (>10 seconds to UI)

**Causes**:
- Elasticsearch query slow (large index)
- Kafka processing bottleneck
- WebSocket broadcast congested

**Solutions**:
```env
# Reduce batch size for faster throughput
KAFKA_BATCH_SIZE=50

# Increase polling frequency
# (modify sync interval in elasticsearch_service.py)
await asyncio.sleep(2)  # Instead of 5

# Reduce message queue on frontend
const { logs } = useWebSocketLogs(token, {
  maxMessagesPerSecond: 20  # Lower rate
})
```

### Issue: Frontend memory growing unbounded

**Solution**: Already built-in - frontend keeps only 1000 logs
```typescript
const updated = [log, ...prev].slice(0, 1000)
```

## Future Enhancements

1. **Partitioned Scaling**
   - Multiple Kafka partitions for parallelism
   - Consumer groups for load balancing

2. **Compression**
   - Kafka message compression (snappy/lz4)
   - Frontend log history compression

3. **Persistence**
   - Archive old logs to S3/blob storage
   - Time-based retention policies

4. **Advanced Filtering**
   - Server-side filtering in Kafka
   - Full-text search in logs

5. **Metrics & Alerts**
   - Prometheus metrics export
   - Alert rules (error spike detection)
   - Dashboard integration (Grafana)

## References

- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [Redis Commands](https://redis.io/commands/)
- [FastAPI WebSocket](https://fastapi.tiangolo.com/advanced/websockets/)
- [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
