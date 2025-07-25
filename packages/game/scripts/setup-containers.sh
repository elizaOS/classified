#!/bin/bash

# Simple cross-platform container setup for ELIZA (macOS/Linux)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ELIZA Container Setup${NC}"
echo -e "${CYAN}Platform: $(uname -s)${NC}"

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Run command with error handling
run_cmd() {
    echo -e "${BLUE}Running: $1${NC}"
    if eval "$1"; then
        return 0
    else
        if [ "$2" != "allow_failure" ]; then
            echo -e "${RED}❌ Command failed: $1${NC}"
            exit 1
        fi
        return 1
    fi
}

# Setup container runtime
setup_container_runtime() {
    echo -e "\n${YELLOW}📦 Setting up container runtime...${NC}"
    
    # Check for Podman
    if command_exists podman; then
        echo -e "${GREEN}✅ Podman found${NC}"
        
        # Test podman connectivity
        if podman ps >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Podman is working${NC}"
            echo "podman"
            return
        else
            echo -e "${YELLOW}⚠️ Podman found but not working, trying to start...${NC}"
            
            # macOS specific - try to start podman machine
            if [[ "$OSTYPE" == "darwin"* ]]; then
                if podman machine start >/dev/null 2>&1; then
                    if podman ps >/dev/null 2>&1; then
                        echo -e "${GREEN}✅ Podman machine started${NC}"
                        echo "podman"
                        return
                    fi
                fi
                echo -e "${RED}❌ Podman machine failed to start${NC}"
            fi
        fi
    fi
    
    # Check for Docker
    if command_exists docker; then
        echo -e "${GREEN}✅ Docker found${NC}"
        if docker ps >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Docker is working${NC}"
            echo "docker"
            return
        else
            echo -e "${RED}❌ Docker found but not working${NC}"
        fi
    fi
    
    # Installation suggestions
    echo -e "\n${RED}❌ No working container runtime found!${NC}"
    echo -e "\n${YELLOW}📋 Installation instructions:${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${CYAN}macOS:${NC}"
        echo "1. Install Podman: brew install podman"
        echo "2. Initialize: podman machine init && podman machine start"
        echo "3. Or install Docker Desktop: https://docker.com/products/docker-desktop"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "${CYAN}Linux:${NC}"
        echo "1. Install Podman: sudo apt install podman (Ubuntu/Debian)"
        echo "2. Or: sudo dnf install podman (Fedora/RHEL)"
        echo "3. Or install Docker: sudo apt install docker.io"
    fi
    
    exit 1
}

# Create container environment
create_container_env() {
    echo -e "\n${YELLOW}⚙️ Creating container environment...${NC}"
    
    local env_file="$(dirname "$0")/../src-backend/sandbox/.env"
    
    cat > "$env_file" << 'EOF'
# ELIZA Container Environment
POSTGRES_PASSWORD=eliza_secure_password_2024
POSTGRES_USER=eliza
POSTGRES_DB=eliza
OLLAMA_HOST=http://localhost:11434
REDIS_PASSWORD=eliza_redis_password_2024
PGADMIN_DEFAULT_EMAIL=admin@eliza.local
PGADMIN_DEFAULT_PASSWORD=eliza_admin_2024
EOF

    echo -e "${GREEN}✅ Container environment created${NC}"
}

# Start containers
start_containers() {
    local engine="$1"
    echo -e "\n${YELLOW}🐳 Starting containers with $engine...${NC}"
    
    local sandbox_dir="$(dirname "$0")/../src-backend/sandbox"
    local compose_file="$sandbox_dir/steam-container-bundle.yaml"
    
    if [ ! -f "$compose_file" ]; then
        echo -e "${RED}❌ Container bundle not found${NC}"
        echo "Run the container orchestration setup first"
        exit 1
    fi
    
    # Use appropriate compose command
    local compose_cmd
    if [ "$engine" = "podman" ]; then
        compose_cmd="podman-compose"
    else
        compose_cmd="docker-compose"
    fi
    
    # Check if compose tool exists
    if ! command_exists "$compose_cmd"; then
        echo "Installing $compose_cmd..."
        if [ "$engine" = "podman" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                run_cmd "brew install podman-compose"
            elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
                run_cmd "pip3 install podman-compose"
            fi
        fi
    fi
    
    # Start the containers
    cd "$sandbox_dir"
    run_cmd "$compose_cmd -f steam-container-bundle.yaml up -d"
    
    echo -e "${GREEN}✅ Containers started${NC}"
    
    # Wait for startup
    echo -e "${YELLOW}⏳ Waiting for services to initialize...${NC}"
    sleep 10
    
    check_container_health
}

# Check container health
check_container_health() {
    echo -e "\n${YELLOW}🔍 Checking container health...${NC}"
    
    local services=(
        "PostgreSQL:7771"
        "Ollama:11434"
        "Redis:6379"
        "pgAdmin:5050"
    )
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        if lsof -i ":$port" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $name (port $port)${NC}"
        else
            echo -e "${RED}❌ $name (port $port) - not responding${NC}"
        fi
    done
    
    echo -e "\n${GREEN}🎉 Container setup complete!${NC}"
    echo -e "\n${YELLOW}📋 Next steps:${NC}"
    echo -e "${CYAN}1. Run: npm run dev:backend${NC}"
    echo -e "${CYAN}2. Run: npm run dev:frontend${NC}"
    echo -e "${CYAN}3. Open: http://localhost:1420${NC}"
    
    echo -e "\n${YELLOW}🔗 Container Services:${NC}"
    echo -e "${CYAN}- ELIZA API: http://localhost:7777${NC}"
    echo -e "${CYAN}- pgAdmin: http://localhost:5050${NC}"
    echo -e "${CYAN}- Ollama: http://localhost:11434${NC}"
}

# Main execution
main() {
    echo -e "\nStarting simple container setup...\n"
    
    # 1. Setup container runtime
    local engine
    engine=$(setup_container_runtime)
    
    # 2. Create environment
    create_container_env
    
    # 3. Start containers
    start_containers "$engine"
}

# Run if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi