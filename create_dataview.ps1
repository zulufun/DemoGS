$body = @"
{
  "attributes": {
    "title": "paloalto-logs-*",
    "timeFieldName": "@timestamp"
  }
}
"@

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:changeme"))

Invoke-WebRequest -Uri "http://localhost:5601/api/saved_objects/index-pattern" `
  -Method POST `
  -Headers @{
    "Authorization" = "Basic $auth"
    "Content-Type" = "application/json"
    "kbn-xsrf" = "true"
  } `
  -Body $body 2>&1 | Select-Object -ExpandProperty Content | ConvertFrom-Json
