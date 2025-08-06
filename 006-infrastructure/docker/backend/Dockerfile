FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache \
    postgresql-client \
    netcat-openbsd

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose application port
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]