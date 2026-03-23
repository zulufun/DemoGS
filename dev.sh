#!/bin/bash

# Demo Project Dev Environment Management Script
# Usage: ./dev.sh start|stop|restart|logs|reset|migrate|ps|exec

set -e

COMPOSE_FILE="docker-compose.dev.yml"
COMPOSE_CMD="docker compose -f $COMPOSE_FILE"

command=${1:-start}

case $command in
  start)
    echo "🚀 Starting development environment..."
    $COMPOSE_CMD up -d
    sleep 3
    echo "✅ Dev environment started!"
    echo ""
    echo "📱 Frontend:  http://localhost:5173"
    echo "🔌 Backend:   http://localhost:8000"
    echo "📊 Docs:      http://localhost:8000/docs"
    echo ""
    echo "🗄️  Database:  postgres://postgres:postgres@localhost:5432/demo"
    echo "👤 Admin:     admin / admin"
    echo ""
    echo "💡 Commands:"
    echo "   ./dev.sh logs         - Show all container logs"
    echo "   ./dev.sh logs backend - Show backend logs only"
    echo "   ./dev.sh stop         - Stop all containers"
    echo "   ./dev.sh reset        - Reset database (fresh start)"
    ;;

  stop)
    echo "⏹️  Stopping development environment..."
    $COMPOSE_CMD down
    echo "✅ Stopped!"
    ;;

  restart)
    echo "🔄 Restarting development environment..."
    $COMPOSE_CMD restart
    sleep 2
    echo "✅ Restarted!"
    ;;

  logs)
    if [ -n "$2" ]; then
      echo "📋 Showing logs for: $2"
      $COMPOSE_CMD logs -f "$2"
    else
      echo "📋 Showing all logs (Ctrl+C to exit)..."
      $COMPOSE_CMD logs -f
    fi
    ;;

  reset)
    echo "⚠️  Resetting database and volumes..."
    echo "This will delete all data!"
    read -p "Type 'yes' to confirm: " confirm
    
    if [ "$confirm" = "yes" ]; then
      echo "🗑️  Removing containers and volumes..."
      $COMPOSE_CMD down -v
      echo "🔨 Rebuilding and starting fresh..."
      $COMPOSE_CMD up -d
      sleep 5
      echo "✅ Database reset complete!"
      echo "🧑‍⚡ Run: ./dev.sh logs backend"
    else
      echo "❌ Cancelled"
    fi
    ;;

  migrate)
    echo "🔄 Running database migrations..."
    echo ""
    echo "Method 1: Complete Reset (Recommended for dev)"
    echo "  ./dev.sh reset"
    echo ""
    echo "Method 2: Inside Running Container"
    echo "  docker exec demo-backend-dev python bootstrap_admin.py"
    echo ""
    echo "Method 3: Recreate Backend Only"
    echo "  docker compose -f $COMPOSE_FILE up -d --force-recreate backend"
    echo ""
    echo "📝 Note: Backend automatically creates tables on startup!"
    echo "   If schema changes, use Method 1 or 3 above"
    ;;

  ps)
    echo "📦 Running containers:"
    $COMPOSE_CMD ps
    ;;

  exec)
    if [ -z "$2" ]; then
      echo "❌ Usage: ./dev.sh exec <python-script-or-command>"
      echo "Example: ./dev.sh exec bootstrap_admin.py"
      exit 1
    fi
    echo "🔧 Executing command in backend container..."
    $COMPOSE_CMD exec backend python "$2"
    ;;

  *)
    echo "❌ Unknown command: $command"
    echo ""
    echo "Usage: ./dev.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start              Start development environment"
    echo "  stop               Stop all containers"
    echo "  restart            Restart development environment"
    echo "  logs [service]     Show logs (optionally for specific service)"
    echo "  reset              Reset database and start fresh"
    echo "  migrate            Show database migration options"
    echo "  ps                 List running containers"
    echo "  exec <script>      Execute Python script in backend"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh start"
    echo "  ./dev.sh logs backend"
    echo "  ./dev.sh reset"
    echo "  ./dev.sh exec bootstrap_admin.py"
    exit 1
    ;;
esac
