#!/bin/bash
# Verification Script - Kiểm Tra Vấn Đề Logs Palo Alto

echo "=========================================="
echo "KIỂM TRA LOGS PALO ALTO FIREWALL"
echo "=========================================="
echo ""

# Check 1: Xem container logstash có chạy không
echo "[1] Kiểm tra container Logstash..."
docker ps --filter "name=logstash" --format "{{.Names}} - {{.Status}}"
echo ""

# Check 2: Xem port 5514 có mở không
echo "[2] Kiểm tra port 5514 (UDP/TCP)..."
netstat -an | grep 5514
echo ""

# Check 3: Xem lỗi trong logs
echo "[3] Kiểm tra lỗi xác thực trong logs..."
docker logs docker-elk-logstash-1 2>&1 | grep -i "403\|401\|security_exception" | tail -5
echo ""

# Check 4: Xem các paloalto indices
echo "[4] Kiểm tra indices Palo Alto..."
curl -s -X GET http://localhost:9200/_cat/indices -u elastic:changeme | grep paloalto
echo ""

# Check 5: Xem số lượng documents trong paloalto indices
echo "[5] Kiểm tra số lượng logs Palo Alto..."
curl -s -X GET "http://localhost:9200/paloalto-logs-*/_count" -u elastic:changeme | python3 -m json.tool 2>/dev/null || echo "No paloalto indices found yet"
echo ""

# Check 6: Xem quyền của role logstash_writer
echo "[6] Kiểm tra quyền role logstash_writer..."
curl -s -X GET "http://localhost:9200/_security/role/logstash_writer" -u elastic:changeme | python3 -m json.tool 2>/dev/null | grep -A 20 "indices"
echo ""

# Check 7: Xem firewall serial numbers
echo "[7] Kiểm tra firewalls gửi logs..."
curl -s -X GET "http://localhost:9200/paloalto-logs-*/_search?size=1&_source=observer.serial_number" -u elastic:changeme | python3 -m json.tool 2>/dev/null || echo "No data yet"
echo ""

echo "=========================================="
echo "KIỂM TRA HOÀN TẤT"
echo "=========================================="
