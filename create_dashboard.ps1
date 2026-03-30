$dataViewId = "c43e87a6-cd59-45bf-b31a-103157c50ffb"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:changeme"))

# Create 4 visualizations and 1 dashboard

# 1. Visualization: Events by Server Name (Location)
$vis1 = @"
{
  "type": "visualization",
  "attributes": {
    "title": "Events by Server/Location",
    "visStateJSON": "{\"title\":\"Events by Server/Location\",\"type\":\"pie\",\"params\":{\"addTooltip\":true,\"isDonut\":true},\"aggs\":[{\"id\":\"1\",\"enabled\":true,\"type\":\"count\",\"schema\":\"metric\",\"params\":{}},{\"id\":\"2\",\"enabled\":true,\"type\":\"terms\",\"schema\":\"segment\",\"params\":{\"field\":\"server_name.keyword\",\"size\":10,\"order\":\"desc\",\"orderBy\":\"1\",\"customLabel\":\"Server Name\"}}]}",
    "uiStateJSON": "{}",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"index\":\"$dataViewId\",\"query\":{\"match_all\":{}},\"filter\":[]}"
    }
  }
}
"@

# 2. Visualization: Events by Action
$vis2 = @"
{
  "type": "visualization",
  "attributes": {
    "title": "Events by Action",
    "visStateJSON": "{\"title\":\"Events by Action\",\"type\":\"pie\",\"params\":{\"addTooltip\":true,\"isDonut\":false},\"aggs\":[{\"id\":\"1\",\"enabled\":true,\"type\":\"count\",\"schema\":\"metric\",\"params\":{}},{\"id\":\"2\",\"enabled\":true,\"type\":\"terms\",\"schema\":\"segment\",\"params\":{\"field\":\"action.keyword\",\"size\":10,\"order\":\"desc\",\"orderBy\":\"1\"}}]}",
    "uiStateJSON": "{}",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"index\":\"$dataViewId\",\"query\":{\"match_all\":{}},\"filter\":[]}"
    }
  }
}
"@

# 3. Visualization: Top Source IPs
$vis3 = @"
{
  "type": "visualization",
  "attributes": {
    "title": "Top Source IPs",
    "visStateJSON": "{\"title\":\"Top Source IPs\",\"type\":\"table\",\"params\":{\"perPage\":10,\"showPartialRows\":false,\"showMeticsAtAllLevels\":false,\"showTotal\":false,\"totalFunc\":\"sum\",\"percentageCol\":\"\"},\"aggs\":[{\"id\":\"1\",\"enabled\":true,\"type\":\"count\",\"schema\":\"metric\",\"params\":{}},{\"id\":\"2\",\"enabled\":true,\"type\":\"terms\",\"schema\":\"bucket\",\"params\":{\"field\":\"src_ip.keyword\",\"size\":20,\"order\":\"desc\",\"orderBy\":\"1\",\"customLabel\":\"Source IP\"}}]}",
    "uiStateJSON": "{}",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"index\":\"$dataViewId\",\"query\":{\"match_all\":{}},\"filter\":[]}"
    }
  }
}
"@

# 4. Visualization: Events Over Time
$vis4 = @"
{
  "type": "visualization",
  "attributes": {
    "title": "Events Over Time",
    "visStateJSON": "{\"title\":\"Events Over Time\",\"type\":\"line\",\"params\":{\"addTooltip\":true,\"addLegend\":true},\"aggs\":[{\"id\":\"1\",\"enabled\":true,\"type\":\"count\",\"schema\":\"metric\",\"params\":{}},{\"id\":\"2\",\"enabled\":true,\"type\":\"date_histogram\",\"schema\":\"segment\",\"params\":{\"field\":\"@timestamp\",\"interval\":\"auto\",\"customLabel\":\"Time\"}}]}",
    "uiStateJSON": "{}",
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"index\":\"$dataViewId\",\"query\":{\"match_all\":{}},\"filter\":[]}"
    }
  }
}
"@

Write-Host "Creating visualizations..."

# Create Vis 1
$resp1 = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/visualization" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $vis1 -UseBasicParsing 2>&1
$vis1Id = ($resp1.Content | ConvertFrom-Json).id
Write-Host "✓ Visualization 1 (Server/Location): $vis1Id"

# Create Vis 2
$resp2 = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/visualization" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $vis2 -UseBasicParsing 2>&1
$vis2Id = ($resp2.Content | ConvertFrom-Json).id
Write-Host "✓ Visualization 2 (Action): $vis2Id"

# Create Vis 3
$resp3 = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/visualization" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $vis3 -UseBasicParsing 2>&1
$vis3Id = ($resp3.Content | ConvertFrom-Json).id
Write-Host "✓ Visualization 3 (Source IPs): $vis3Id"

# Create Vis 4
$resp4 = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/visualization" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $vis4 -UseBasicParsing 2>&1
$vis4Id = ($resp4.Content | ConvertFrom-Json).id
Write-Host "✓ Visualization 4 (Timeline): $vis4Id"

# Create Dashboard
$dashboard = @"
{
  "type": "dashboard",
  "attributes": {
    "title": "Palo Alto Events Dashboard",
    "panels": [
      {
        "visualization": {
          "id": "$vis1Id"
        },
        "x": 0,
        "y": 0,
        "w": 24,
        "h": 15
      },
      {
        "visualization": {
          "id": "$vis2Id"
        },
        "x": 24,
        "y": 0,
        "w": 24,
        "h": 15
      },
      {
        "visualization": {
          "id": "$vis4Id"
        },
        "x": 0,
        "y": 15,
        "w": 48,
        "h": 20
      },
      {
        "visualization": {
          "id": "$vis3Id"
        },
        "x": 0,
        "y": 35,
        "w": 48,
        "h": 15
      }
    ],
    "timeRestore": true,
    "timeFrom": "now-24h",
    "timeTo": "now",
    "refreshInterval": {
      "pause": false,
      "value": 10000
    }
  }
}
"@

Write-Host "Creating dashboard..."
$respDash = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/dashboard" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $dashboard -UseBasicParsing 2>&1
$dashId = ($respDash.Content | ConvertFrom-Json).id
Write-Host "✓ Dashboard created: $dashId"

Write-Host ""
Write-Host "=========================================="
Write-Host "Dashboard URL:"
Write-Host "http://localhost:5601/app/kibana#/dashboard/$dashId"
Write-Host "=========================================="
