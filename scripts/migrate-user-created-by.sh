#!/bin/bash

# Migration script wrapper: Add created_by column to users table
# This script loads environment variables from .env or .env.local and runs the migration

# Load environment variables
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
  echo "Loaded environment from .env.local"
elif [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "Loaded environment from .env"
else
  echo "Warning: No .env.local or .env file found. Using existing environment variables."
fi

# Check if required env vars are set
if [ -z "$TURSO_DATABASE_URL" ] || [ -z "$TURSO_AUTH_TOKEN" ]; then
  echo "Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set"
  echo "Please set them in your .env or .env.local file, or export them before running this script"
  exit 1
fi

# Run the migration
npx tsx scripts/migrate-user-created-by.ts
