#!/usr/bin/env bash
set -euo pipefail

# Simple backup script for HearSay MongoDB on Linux/macOS
# Usage: ./backup.sh [OUTDIR]
# If MONGO_PASS is set in the environment it will be used, otherwise you will be prompted.

DB="HearSay"
USER="admin"
AUTHDB="admin"
HOST="localhost"
PORT=27017

OUTDIR="${1:-/tmp/hearsay-backup-$(date +%Y%m%d%H%M%S)}"
mkdir -p "$OUTDIR"

if [ -z "${MONGO_PASS:-}" ]; then
  read -s -p "MongoDB password: " MONGO_PASS; echo
fi

echo "Backing up DB '$DB' to $OUTDIR"
mongodump --db "$DB" --username "$USER" --password "$MONGO_PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --archive="$OUTDIR/hearsay.archive.gz" --gzip

echo "Backup complete: $OUTDIR/hearsay.archive.gz"
chmod 600 "$OUTDIR/hearsay.archive.gz"
