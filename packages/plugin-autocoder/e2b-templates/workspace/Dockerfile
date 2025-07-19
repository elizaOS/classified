# E2B Development Environment for ElizaOS
FROM node:20-slim

# Install system dependencies and development tools
RUN apt-get update && apt-get install -y \
    # Version control
    git \
    openssh-client \
    # Build essentials
    build-essential \
    gcc \
    g++ \
    make \
    # Python for various tools
    python3 \
    python3-pip \
    python3-venv \
    # Network tools
    curl \
    wget \
    # Process management
    supervisor \
    # Editor
    vim \
    nano \
    # Database clients
    postgresql-client \
    mysql-client \
    sqlite3 \
    redis-tools \
    # Other utilities
    jq \
    tree \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install PostgreSQL
RUN apt-get update && apt-get install -y postgresql postgresql-contrib && \
    rm -rf /var/lib/apt/lists/*

# Install Redis
RUN apt-get update && apt-get install -y redis-server && \
    rm -rf /var/lib/apt/lists/*

# Install global Node.js development tools
RUN npm install -g \
    # Package managers
    yarn@latest \
    pnpm@latest \
    # TypeScript
    typescript@latest \
    ts-node@latest \
    # Linting and formatting
    eslint@latest \
    prettier@latest \
    # Build tools
    vite@latest \
    webpack@latest \
    webpack-cli@latest \
    # Testing
    jest@latest \
    # Process management
    pm2@latest \
    # API development
    @nestjs/cli@latest \
    express-generator@latest \
    # Utilities
    nodemon@latest \
    concurrently@latest

# Install VS Code Server (code-server)
RUN curl -fsSL https://code-server.dev/install.sh | sh

# Set up VS Code Server extensions
RUN code-server --install-extension dbaeumer.vscode-eslint && \
    code-server --install-extension esbenp.prettier-vscode && \
    code-server --install-extension ms-vscode.vscode-typescript-next && \
    code-server --install-extension bradlc.vscode-tailwindcss && \
    code-server --install-extension prisma.prisma && \
    code-server --install-extension mikestead.dotenv

# Create workspace directory
RUN mkdir -p /workspace && \
    mkdir -p /workspace/.vscode && \
    mkdir -p /var/lib/postgresql/data && \
    mkdir -p /data/redis && \
    mkdir -p /var/log/supervisor

# Copy supervisord configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set up PostgreSQL
RUN chown -R postgres:postgres /var/lib/postgresql/data

# Initialize PostgreSQL database
USER postgres
RUN /usr/lib/postgresql/*/bin/initdb -D /var/lib/postgresql/data

# Switch back to root
USER root

# Create a default database setup script
RUN echo "#!/bin/bash\n\
su - postgres -c '/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data -l /var/log/postgresql.log start'\n\
sleep 5\n\
su - postgres -c 'createdb development'\n\
su - postgres -c 'createuser -s developer'" > /usr/local/bin/init-db.sh && \
    chmod +x /usr/local/bin/init-db.sh

# Set up workspace permissions
RUN chmod -R 777 /workspace

# Set up Git configuration
RUN git config --global init.defaultBranch main && \
    git config --global pull.rebase false && \
    git config --global user.name "Eliza Agent" && \
    git config --global user.email "agent@eliza.os"

# Expose ports
EXPOSE 3000 3001 5173 8080 5432 6379 8443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD pg_isready -U postgres || exit 1

# Start command using supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 