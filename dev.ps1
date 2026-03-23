# Demo Project Dev Environment Management Script
# Usage: .\dev.ps1 start|stop|restart|logs|reset|migrate

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('start', 'stop', 'restart', 'logs', 'reset', 'migrate', 'ps', 'exec')]
    [string]$Command,
    
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$docker_compose = "docker compose -f docker-compose.dev.yml"

switch ($Command) {
    'start' {
        Write-Host "🚀 Starting development environment..." -ForegroundColor Cyan
        Invoke-Expression "$docker_compose up -d"
        Start-Sleep -Seconds 3
        Write-Host "✅ Dev environment started!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📱 Frontend:  http://localhost:5173" -ForegroundColor Yellow
        Write-Host "🔌 Backend:   http://localhost:8000" -ForegroundColor Yellow
        Write-Host "📊 Docs:      http://localhost:8000/docs" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "🗄️  Database:  postgres://postgres:postgres@localhost:5432/demo" -ForegroundColor Yellow
        Write-Host "👤 Admin:     admin / admin" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "💡 Commands:" -ForegroundColor Cyan
        Write-Host "   .\dev.ps1 logs         - Show all container logs" -ForegroundColor Gray
        Write-Host "   .\dev.ps1 logs backend - Show backend logs only" -ForegroundColor Gray
        Write-Host "   .\dev.ps1 stop         - Stop all containers" -ForegroundColor Gray
        Write-Host "   .\dev.ps1 reset        - Reset database (fresh start)" -ForegroundColor Gray
    }
    
    'stop' {
        Write-Host "⏹️  Stopping development environment..." -ForegroundColor Cyan
        Invoke-Expression "$docker_compose down"
        Write-Host "✅ Stopped!" -ForegroundColor Green
    }
    
    'restart' {
        Write-Host "🔄 Restarting development environment..." -ForegroundColor Cyan
        Invoke-Expression "$docker_compose restart"
        Start-Sleep -Seconds 2
        Write-Host "✅ Restarted!" -ForegroundColor Green
    }
    
    'logs' {
        if ($Args.Count -gt 0) {
            Write-Host "📋 Showing logs for: $($Args -join ' ')" -ForegroundColor Cyan
            Invoke-Expression "$docker_compose logs -f $($Args -join ' ')"
        } else {
            Write-Host "📋 Showing all logs (Ctrl+C to exit)..." -ForegroundColor Cyan
            Invoke-Expression "$docker_compose logs -f"
        }
    }
    
    'reset' {
        Write-Host "⚠️  Resetting database and volumes..." -ForegroundColor Yellow
        Write-Host "This will delete all data!" -ForegroundColor Red
        $confirm = Read-Host "Type 'yes' to confirm"
        
        if ($confirm -eq 'yes') {
            Write-Host "🗑️  Removing containers and volumes..." -ForegroundColor Cyan
            Invoke-Expression "$docker_compose down -v"
            Write-Host "🔨 Rebuilding and starting fresh..." -ForegroundColor Cyan
            Invoke-Expression "$docker_compose up -d"
            Start-Sleep -Seconds 5
            Write-Host "✅ Database reset complete!" -ForegroundColor Green
            Write-Host "🧑‍⚡ Run: .\dev.ps1 logs backend" -ForegroundColor Cyan
        } else {
            Write-Host "❌ Cancelled" -ForegroundColor Red
        }
    }
    
    'migrate' {
        Write-Host "🔄 Running database migrations..." -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Method 1: Complete Reset (Recommended for dev)" -ForegroundColor Yellow
        Write-Host "  .\dev.ps1 reset" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Method 2: Inside Running Container" -ForegroundColor Yellow
        Write-Host "  docker exec demo-backend-dev python bootstrap_admin.py" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Method 3: Recreate Backend Only" -ForegroundColor Yellow
        Write-Host "  docker compose -f docker-compose.dev.yml up -d --force-recreate backend" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📝 Note: Backend automatically creates tables on startup!" -ForegroundColor Cyan
        Write-Host "   If schema changes, use Method 1 or 3 above" -ForegroundColor Cyan
    }
    
    'ps' {
        Write-Host "📦 Running containers:" -ForegroundColor Cyan
        Invoke-Expression "$docker_compose ps"
    }
    
    'exec' {
        Write-Host "🔧 Executing command in backend container..." -ForegroundColor Cyan
        Invoke-Expression "$docker_compose exec backend python $($Args -join ' ')"
    }
}
