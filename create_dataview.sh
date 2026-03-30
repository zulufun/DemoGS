#!/bin/bash

# Create Palo Alto Data View in Kibana
curl -u "elastic:changeme" -X POST "http://localhost:5601/api/saved_objects/index-pattern" \
  -H "Content-Type: application/json" \
  -H "kbn-xsrf: true" \
  -d '{
    "attributes": {
      "title": "paloalto-logs-*",
      "timeFieldName": "@timestamp"
    }
  }'
