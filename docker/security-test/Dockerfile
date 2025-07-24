FROM node:20-alpine

# Install security testing tools
RUN apk add --no-cache \
    git \
    python3 \
    py3-pip \
    docker-cli \
    curl \
    bash \
    jq

# Install Node.js security tools
RUN npm install -g \
    eslint \
    eslint-plugin-security \
    retire \
    snyk \
    @owasp/dependency-check

# Install Python security tools
RUN pip3 install --no-cache-dir \
    bandit \
    safety \
    semgrep

# Install Go for backend security testing
RUN apk add --no-cache go

# Install Go security tools
RUN go install github.com/securego/gosec/v2/cmd/gosec@latest && \
    go install honnef.co/go/tools/cmd/staticcheck@latest && \
    go install github.com/sonatype-nexus-community/nancy@latest

# Set working directory
WORKDIR /app

# Copy test scripts
COPY tests/security/security-test-runner.js /scripts/
COPY tests/security/package.json /scripts/

# Install test runner dependencies
WORKDIR /scripts
RUN npm install

# Set PATH to include Go binaries
ENV PATH="/root/go/bin:${PATH}"

WORKDIR /app

# Default command
CMD ["node", "/scripts/security-test-runner.js"]