# E2B Base Template for ElizaOS AutoCoder Agents
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    build-essential \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create agent user
RUN useradd -m -s /bin/bash agent && \
    mkdir -p /home/agent/.ssh && \
    mkdir -p /home/agent/.eliza && \
    mkdir -p /home/agent/workspace

# Copy and build Eliza
WORKDIR /home/agent
COPY --chown=agent:agent . ./eliza

# Install dependencies and build
WORKDIR /home/agent/eliza
RUN npm install && \
    npm run build

# Copy agent startup script
COPY --chown=agent:agent start-agent.sh /home/agent/start-agent.sh
RUN chmod +x /home/agent/start-agent.sh

# Switch to agent user
USER agent
WORKDIR /home/agent

# Expose ports
EXPOSE 8080 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8081/health || exit 1

# Start command
CMD ["/home/agent/start-agent.sh"] 