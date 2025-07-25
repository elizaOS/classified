#!/bin/bash

# ELIZA Game Container Setup Script
# Handles container building, running, and management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$GAME_DIR")")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "All requirements met"
}

# Create necessary directories and files
setup_environment() {
    log_info "Setting up environment..."
    
    # Create data directories
    mkdir -p "$HOME/.eliza/data/postgres"
    mkdir -p "$HOME/.eliza/data/agent"
    mkdir -p "$HOME/.eliza/data/pgadmin"
    
    # Create .env file if it doesn't exist
    if [ ! -f "$GAME_DIR/.env" ]; then
        log_info "Creating .env file from template..."
        cp "$GAME_DIR/.env.container" "$GAME_DIR/.env"
        log_warning "Please edit .env file with your API keys and configuration"
    fi
    
    # Create knowledge directory if it doesn't exist
    if [ ! -d "$GAME_DIR/knowledge" ]; then
        mkdir -p "$GAME_DIR/knowledge"
        echo "# Welcome to ELIZA!" > "$GAME_DIR/knowledge/welcome.md"
        echo "" >> "$GAME_DIR/knowledge/welcome.md"
        echo "This is your agent's knowledge base. Add documents here for the agent to learn from." >> "$GAME_DIR/knowledge/welcome.md"
    fi
    
    log_success "Environment setup complete"
}

# Build the container
build_container() {
    log_info "Building ELIZA container..."
    
    cd "$GAME_DIR"
    
    # Build backend first
    log_info "Building backend with Bun..."
    npm run build:backend:bun
    
    # Build container
    log_info "Building Docker container..."
    docker build -t eliza-game:latest .
    
    log_success "Container built successfully"
}

# Start the services
start_services() {
    log_info "Starting ELIZA services..."
    
    cd "$GAME_DIR"
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Run 'setup' command first."
        exit 1
    fi
    
    # Start with docker-compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi
    
    log_success "Services started"
    log_info "Agent API: http://localhost:7777"
    log_info "pgAdmin: http://localhost:8080 (if enabled)"
    log_info ""
    log_info "View logs with: docker logs -f eliza-agent"
    log_info "Stop services with: $0 stop"
}

# Stop the services
stop_services() {
    log_info "Stopping ELIZA services..."
    
    cd "$GAME_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        docker compose down
    fi
    
    log_success "Services stopped"
}

# Restart the services
restart_services() {
    log_info "Restarting ELIZA services..."
    stop_services
    start_services
}

# Show service status
show_status() {
    log_info "ELIZA Service Status:"
    echo ""
    
    cd "$GAME_DIR"
    
    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        docker compose ps
    fi
}

# Show logs
show_logs() {
    local service=${1:-agent}
    
    log_info "Showing logs for $service..."
    docker logs -f "eliza-$service"
}

# Clean up everything (careful!)
cleanup() {
    log_warning "This will remove all containers, images, and data. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Cleaning up..."
        
        cd "$GAME_DIR"
        
        # Stop and remove containers
        if command -v docker-compose &> /dev/null; then
            docker-compose down -v
        else
            docker compose down -v
        fi
        
        # Remove images
        docker rmi eliza-game:latest 2>/dev/null || true
        
        # Remove data directories
        rm -rf "$HOME/.eliza"
        
        log_success "Cleanup complete"
    else
        log_info "Cleanup cancelled"
    fi
}

# Show help
show_help() {
    echo "ELIZA Game Container Management"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup      - Set up environment and create necessary files"
    echo "  build      - Build the ELIZA container"
    echo "  start      - Start ELIZA services"
    echo "  stop       - Stop ELIZA services"
    echo "  restart    - Restart ELIZA services"
    echo "  status     - Show service status"
    echo "  logs       - Show agent logs (or 'logs postgres', 'logs pgadmin')"
    echo "  cleanup    - Remove all containers, images, and data (DESTRUCTIVE)"
    echo "  help       - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup && $0 build && $0 start"
    echo "  $0 logs agent"
    echo "  $0 restart"
}

# Main command handling
case "${1:-help}" in
    "setup")
        check_requirements
        setup_environment
        ;;
    "build")
        check_requirements
        build_container
        ;;
    "start")
        check_requirements
        start_services
        ;;
    "stop")
        stop_services
        ;;
    "restart")
        restart_services
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs "${2:-agent}"
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|*)
        show_help
        ;;
esac