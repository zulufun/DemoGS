#!/usr/bin/env powershell
<#
.DESCRIPTION
Pre-deployment verification script for Redis + Kafka real-time logging system
Checks all requirements before attempting docker-compose up
#>

param(
    [switch]$Verbose = $false
)

$errors = @()
$warnings = @()
$success = @()

function Write-Header {
    param([string]$Text)
    Write-Host "`n$('='*60)" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "$('='*60)" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
    $global:success += $Text
}

function Write-Error {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
    $global:errors += $Text
}

function Write-Warn {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
    $global:warnings += $Text
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ $Text" -ForegroundColor Blue
}

# Check Docker
Write-Header "Checking Docker Installation"
try {
    $dockerVersion = docker --version
    Write-Success "Docker installed: $dockerVersion"
} catch {
    Write-Error "Docker not found or not in PATH"
    Write-Info "Install Docker Desktop from https://www.docker.com/products/docker-desktop"
}

try {
    $dockerCompose = docker compose version
    Write-Success "Docker Compose installed: $dockerCompose"
} catch {
    Write-Error "Docker Compose not found"
    Write-Info "Update Docker Desktop to get Docker Compose"
}

# Check Docker daemon
Write-Header "Checking Docker Daemon"
try {
    $null = docker ps
    Write-Success "Docker daemon is running"
} catch {
    Write-Error "Docker daemon not running"
    Write-Info "Start Docker Desktop and try again"
}

# Check Python
Write-Header "Checking Python Installation"
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "3\.1[1-9]") {
        Write-Success "Python installed: $pythonVersion"
    } else {
        Write-Warn "Python installed but version may be incompatible: $pythonVersion (requires 3.11+)"
    }
} catch {
    Write-Error "Python not found (needed for load testing script)"
    Write-Info "Install Python from https://www.python.org"
}

# Check Node.js
Write-Header "Checking Node.js Installation"
try {
    $nodeVersion = node --version
    Write-Success "Node.js installed: $nodeVersion"
} catch {
    Write-Warn "Node.js not found (optional, needed if rebuilding frontend)"
}

# Check files
Write-Header "Checking Required Files"

$requiredFiles = @(
    "docker-compose.dev.yml",
    ".env",
    "backend/requirements.txt",
    "backend/config.py",
    "backend/main.py",
    "backend/redis_service.py",
    "backend/kafka_service.py",
    "backend/elasticsearch_service.py",
    "backend/routes/ws_logs.py",
    "frontend/src/hooks/useWebSocketLogs.ts",
    "frontend/src/components/dashboard/RealtimeLogsDisplay.tsx",
    "REALTIME_LOGGING.md",
    "QUICKSTART_REALTIME.md"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Success "Found: $file"
    } else {
        Write-Error "Missing: $file"
    }
}

# Check dependencies in requirements.txt
Write-Header "Checking Backend Dependencies"

$requiredPackages = @(
    "redis==5.0.1",
    "kafka-python==2.0.2",
    "aioredis==2.0.1",
    "websockets==12.0",
    "aiohttp==3.9.1"
)

$reqContent = Get-Content "backend/requirements.txt" -ErrorAction SilentlyContinue
foreach ($pkg in $requiredPackages) {
    if ($reqContent -contains $pkg) {
        Write-Success "Dependency listed: $pkg"
    } else {
        Write-Warn "Dependency may be missing or different: $pkg"
    }
}

# Check environment variables
Write-Header "Checking Environment Variables (.env)"

$envVars = @(
    "REDIS_URL",
    "KAFKA_BOOTSTRAP_SERVERS",
    "KAFKA_LOG_TOPIC",
    "KAFKA_BATCH_SIZE",
    "KAFKA_BATCH_TIMEOUT_MS"
)

$envContent = Get-Content ".env" -ErrorAction SilentlyContinue
foreach ($var in $envVars) {
    if ($envContent | Select-String -Pattern "^$var=" -Quiet) {
        Write-Success "Environment variable configured: $var"
    } else {
        Write-Warn "Environment variable may be missing: $var"
    }
}

# Check Docker image availability
Write-Header "Checking Docker Images"

$images = @(
    "postgres:15-alpine",
    "node:18-alpine",
    "redis:7-alpine",
    "confluentinc/cp-zookeeper:7.5.0",
    "confluentinc/cp-kafka:7.5.0"
)

foreach ($image in $images) {
    try {
        $null = docker inspect $image -f "{{.RepoTags}}" 2>$null
        Write-Info "Image available locally: $image"
    } catch {
        Write-Info "Image not cached: $image (will be pulled on first run)"
    }
}

# Check disk space
Write-Header "Checking System Resources"

$diskSpace = (Get-PSDrive C).Free / 1GB
if ($diskSpace -gt 10) {
    Write-Success "Free disk space: ${diskSpace}GB (sufficient)"
} else {
    Write-Warn "Low disk space: ${diskSpace}GB (requires at least 10GB)"
}

# Check ports availability
Write-Header "Checking Port Availability"

$ports = @(
    5432, # PostgreSQL
    6379, # Redis
    2181, # Zookeeper
    9092, # Kafka
    8000, # Backend API
    5173  # Frontend
)

foreach ($port in $ports) {
    try {
        $connection = [System.Net.Sockets.TcpClient]::new()
        $connection.Connect("127.0.0.1", $port)
        Write-Warn "Port $port is already in use"
        $connection.Close()
    } catch {
        Write-Success "Port $port is available"
    }
}

# Python dependencies for load test
Write-Header "Checking Load Test Dependencies"

if (Get-Command python -ErrorAction SilentlyContinue) {
    try {
        $null = python -c "import websockets"
        Write-Success "websockets module available"
    } catch {
        Write-Warn "websockets not installed (run: pip install websockets)"
    }
    
    try {
        $null = python -c "import aiohttp"
        Write-Success "aiohttp module available"
    } catch {
        Write-Warn "aiohttp not installed (run: pip install aiohttp)"
    }
}

# Summary
Write-Header "Verification Summary"

Write-Host "`nResults:" -ForegroundColor Cyan
Write-Host "  ✓ Passed: $($success.Count)"
Write-Host "  ✗ Failed: $($errors.Count)"
Write-Host "  ⚠ Warnings: $($warnings.Count)`n"

if ($errors.Count -eq 0) {
    Write-Host "✅ All critical checks passed! Ready to start services." -ForegroundColor Green
    Write-Host "`nNext steps:"
    Write-Host "  1. docker compose -f docker-compose.dev.yml up -d"
    Write-Host "  2. Wait 30 seconds for services to initialize"
    Write-Host "  3. Open http://localhost:5173"
    Write-Host "  4. Login with: admin / admin`n"
} else {
    Write-Host "❌ Some critical checks failed. Please fix issues above." -ForegroundColor Red
    Write-Host "`nTo get help:"
    Write-Host "  - Windows: Look for 'Docker' in Settings → Apps"
    Write-Host "  - macOS: brew install docker docker-compose"
    Write-Host "  - Linux: sudo apt-get install docker.io docker-compose"
    Write-Host ""
    exit 1
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  Please review warnings above" -ForegroundColor Yellow
}

exit 0
