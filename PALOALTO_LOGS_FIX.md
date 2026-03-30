# Sửa Vấn Đề Nhận Logs từ Palo Alto Firewall

## Vấn Đề Tìm Thấy

Logs từ Palo Alto firewall **ĐANG ĐƯỢC NHẬN** bởi Logstash nhưng **KHÔNG THỂ GHI VÀO ELASTICSEARCH**.

### Lỗi Cụ Thể
```
[2026-03-30T03:20:59,202][ERROR] Retrying failed action {:status=>403, 
:action=>["index", {:_index=>"paloalto-logs-2026.03.30"}], 
:error=>{"type":"security_exception","reason":"action [indices:admin/auto_create] 
is unauthorized for user [logstash_internal] with effective roles [logstash_writer]"}}
```

### Nguyên Nhân
User `logstash_internal` có role `logstash_writer`, nhưng role này **chỉ có quyền** ghi vào các index:
- `logs-generic-default`
- `logstash-*`
- `ecs-logstash-*`

Tuy nhiên, Palo Alto logs được gửi đến index: `paloalto-logs-{DATE}`

## Giải Pháp Áp Dụng

### 1. Cập Nhật File Cấu Hình Role
File: `docker-elk/setup/roles/logstash_writer.json`

**Trước:**
```json
"names": [
  "logs-generic-default",
  "logstash-*",
  "ecs-logstash-*"
]
```

**Sau:**
```json
"names": [
  "logs-generic-default",
  "logstash-*",
  "ecs-logstash-*",
  "paloalto-*"
]
```

### 2. Cập Nhật Role trong Elasticsearch (đã thực hiện)
```bash
curl -X PUT http://localhost:9200/_security/role/logstash_writer \
  -H "Content-Type: application/json" \
  -u elastic:changeme \
  -d '{
    "cluster": ["manage_index_templates", "monitor", "manage_ilm"],
    "indices": [
      {
        "names": ["logs-generic-default", "logstash-*", "ecs-logstash-*", "paloalto-*"],
        "privileges": ["write", "create", "create_index", "manage", "manage_ilm"]
      },
      {
        "names": ["logstash", "ecs-logstash"],
        "privileges": ["write", "manage"]
      }
    ]
  }'
```

### 3. Khởi Động Lại Logstash Container (đã thực hiện)
```bash
docker restart docker-elk-logstash-1
```

## Xác Nhận Sửa Chữa

### Kiểm Tra 1: Xem Logs Từ Logstash
```bash
docker logs docker-elk-logstash-1 | grep -i "paloalto\|sent\|succeeded"
```

Nên thấy: `Pipeline started` và không còn lỗi `403 Forbidden`

### Kiểm Tra 2: Xem Indices Được Tạo
```bash
curl -X GET http://localhost:9200/_cat/indices -u elastic:changeme | grep paloalto
```

Sẽ thấy: `paloalto-logs-2026.03.30` hoặc index với pattern `paloalto-logs-{DATE}`

### Kiểm Tra 3: Xem Dữ Liệu Logs
Trên Kibana (http://localhost:5601):
1. Vào **Stack Management** → **Index Management**
2. Tìm index bắt đầu với `paloalto-logs-`
3. Hoặc tạo Data View cho pattern `paloalto-logs-*` để xem dữ liệu

## Cấu Hình Logstash

Logstash đã cấu hình chính xác để nhận Palo Alto logs:

**File: `docker-elk/logstash/pipeline/logstash.conf`**

Input:
- UDP port 5514 (tagged: "paloalto", "syslog")
- TCP port 5514 (tagged: "paloalto", "syslog")

Filter:
- Parse syslog header
- Parse CSV format Palo Alto
- Ánh xạ các trường sang Elastic Common Schema (ECS)

Output:
- Index: `paloalto-logs-%{+YYYY.MM.dd}`

## Cấu Hình Palo Alto Firewall

Đảm bảo firewall được cấu hình như sau:

**Device** → **Log Settings** → **Syslog**
```
Server: <server-ip>
Port: 5514
Protocol: UDP hoặc TCP
Facility: LOG_USER (Default)
Log Format: CSV
```

## Notes
- Logs đang được nhận thành công từ Palo Alto (Serial: 025201006789)
- Volume hiện tại: ~2 logs/giây (TRAFFIC start/end events)
- Index được tạo hàng ngày: `paloalto-logs-YYYY.MM.dd`
- Chính sách retention có thể được cấu hình thông qua ILM (Index Lifecycle Management)
