#!/bin/sh

# Wait for database to be ready
echo "Waiting for PostgreSQL..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Wait for Redis to be ready
echo "Waiting for Redis..."
while ! nc -z redis 6379; do
  sleep 1
done
echo "Redis is ready!"

# Run database migrations if they exist
if [ -f "migrations.js" ]; then
    echo "Running database migrations..."
    npm run migrate
fi

# Start the application
echo "Starting ${SERVICE_NAME} service..."
npm start