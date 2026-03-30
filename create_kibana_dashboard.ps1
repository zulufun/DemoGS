$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:changeme"))

$body = @"
{
  "attributes": {
    "title": "Palo Alto Events Dashboard",
    "description": "Real-time dashboard for Palo Alto firewall events",
    "panels": [],
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

Write-Host "Creating Kibana dashboard..."

try {
  $response = Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/dashboard" `
    -Method POST `
    -Headers @{
      "Authorization" = "Basic $auth"
      "Content-Type" = "application/json"
      "kbn-xsrf" = "true"
    } `
    -Body $body `
    -UseBasicParsing 2>&1

  $result = $response.Content | ConvertFrom-Json
  $dashId = $result.id
  
  Write-Host "Dashboard created successfully!"
  Write-Host ("Dashboard ID: {0}" -f $dashId)
  Write-Host ""
  Write-Host "Access the dashboard at:"
  Write-Host ("http://localhost:5601/app/kibana#/dashboard/{0}" -f $dashId)
  Write-Host ""
  Write-Host "Update your .env file with:"
  Write-Host ("VITE_KIBANA_DASHBOARD_ID={0}" -f $dashId)

} catch {
  Write-Host "Error: $_"
}
