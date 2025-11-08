#!/usr/bin/env bash
set -euo pipefail

# Simple restore script for HearSay MongoDB on Linux/macOS
# Usage: ./restore.sh <archive-path>
# If MONGO_PASS is set in the environment it will be used, otherwise you will be prompted.

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <archive-path>"
  exit 2
fi

ARCHIVE_PATH="$1"

if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "Archive not found: $ARCHIVE_PATH"
  exit 3
fi

DB="HearSay"
USER="admin"
AUTHDB="admin"
HOST="localhost"
PORT=27017

if [ -z "${MONGO_PASS:-}" ]; then
  read -s -p "MongoDB password: " MONGO_PASS; echo
fi

echo "Restoring archive $ARCHIVE_PATH into DB '$DB' (dropping existing collections)"
mongorestore --archive="$ARCHIVE_PATH" --gzip --username "$USER" --password "$MONGO_PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --drop

echo "Restore complete"
