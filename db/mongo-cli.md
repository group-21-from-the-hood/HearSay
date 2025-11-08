## MongoDB CLI quick guide (HearSay)

Purpose
- Simple copy/paste commands for exporting/importing and backing up the HearSay `HearSay` database using MongoDB Database Tools.

Prerequisites
- MongoDB Database Tools installed (mongodump, mongorestore, mongoexport, mongoimport). See: https://www.mongodb.com/docs/database-tools/
- Host, port, username, password, and authentication database for your instance.

Platform: Linux / macOS (bash)

Safe variables (bash)
```bash
DB='HearSay'
USER='admin'
# Avoid hardcoding passwords in scripts for production
PASS='password'
AUTHDB='admin'
HOST='localhost'
PORT=27017
OUTDIR="/var/backups/hearsay-$(date +%Y%m%d%H%M%S)"
mkdir -p "$OUTDIR"
```

Full database backup (directory)
```bash
mongodump --db "$DB" --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --out "$OUTDIR"
```

Full database backup (single compressed archive)
```bash
mongodump --db "$DB" --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --archive="$OUTDIR/hearsay.archive.gz" --gzip
```

Restore from directory
```bash
# This will drop collections in the target DB before restoring
mongorestore --nsInclude "$DB.*" --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --drop --dir "$OUTDIR/$DB"
```

Restore from archive
```bash
mongorestore --archive="$OUTDIR/hearsay.archive.gz" --gzip --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --drop
```

Export a single collection to JSON (jsonArray, all docs)
```bash
mongoexport --db "$DB" --collection Reviews --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --out "$OUTDIR/reviews.json" --jsonArray
```

Export to CSV (specify fields)
```bash
mongoexport --db "$DB" --collection Songs --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --type=csv --fields "songId,title,artist,album" --out "$OUTDIR/songs.csv"
```

Import JSON (jsonArray)
```bash
mongoimport --db "$DB" --collection Reviews --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --file "$OUTDIR/reviews.json" --jsonArray --drop
```

Import CSV (headerline)
```bash
mongoimport --db "$DB" --collection Songs --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --type=csv --headerline --file "$OUTDIR/songs.csv" --drop
```

Secure password prompt (bash)
```bash
read -s -p "MongoDB password: " PASS; echo
# now use $PASS in the commands above; it won't be stored in shell history
```

Use connection URI (recommended for TLS/Atlas)
```bash
URI="mongodb://$USER:$PASS@$HOST:$PORT/$AUTHDB"
mongodump --uri "$URI" --archive="$OUTDIR/hearsay.archive.gz" --gzip
```

Tips and notes (Linux/macOS)
- Replace plain passwords with secure methods in production: read from environment variables, a secure store, or stdin. Avoid hardcoding credentials in scripts.
- Use file permissions to protect backups: chmod 600 "$OUTDIR"/*
- Use `--drop` on restore/import to replace existing data. Omit to merge.
- Use `--gzip` and `--archive` for a single compressed file that's easy to transfer.
- For SRV/Atlas URIs use `--uri "mongodb+srv://..."` and add `--tls`/`--ssl` flags if required.

Troubleshooting
- "command not found": install MongoDB Database Tools (https://www.mongodb.com/docs/database-tools/installation/).
- Authentication errors: confirm the user exists in the `$AUTHDB` and has correct roles (read for export, readWrite for import/restore).
- Permission errors when writing files: ensure the target backup directory is writable or use `sudo` where appropriate.

References
- mongoexport docs: https://www.mongodb.com/docs/database-tools/mongoexport
- mongoimport docs: https://www.mongodb.com/docs/database-tools/mongoimport
- mongodump/mongorestore docs: https://www.mongodb.com/docs/database-tools/mongodump

Quick example (one-liner archive dump + restore)
```bash
# Dump
mongodump --db "$DB" --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --archive="$OUTDIR/hearsay.archive.gz" --gzip
# Restore
mongorestore --archive="$OUTDIR/hearsay.archive.gz" --gzip --username "$USER" --password "$PASS" --authenticationDatabase "$AUTHDB" --host "$HOST" --port $PORT --drop
```

---
Small, copyable commands above should cover typical export/import and backup/restore workflows for the HearSay project on Linux/macOS (bash). A Windows PowerShell section remains below as an alternative for Windows users.

Platform: Windows (PowerShell) — alternative

Safe variables (PowerShell)
```powershell
$DB = 'HearSay'
$USER = 'admin'
$PASS = 'password'   # avoid hardcoding in production
$AUTHDB = 'admin'
$HOST = 'localhost'
$PORT = 27017
$OUTDIR = "C:\backups\hearsay-$(Get-Date -Format yyyyMMddHHmmss)"
New-Item -ItemType Directory -Path $OUTDIR -Force | Out-Null
```

Full database backup (directory)
```powershell
mongodump --db $DB --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --out $OUTDIR
```

Full database backup (single compressed archive)
```powershell
mongodump --db $DB --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --archive="$OUTDIR\hearsay.archive.gz" --gzip
```

Restore from directory
```powershell
# This will drop collections in the target DB before restoring
mongorestore --nsInclude "$DB.*" --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --drop --dir "$OUTDIR\$DB"
```

Restore from archive
```powershell
mongorestore --archive="$OUTDIR\hearsay.archive.gz" --gzip --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --drop
```

Export a single collection to JSON (jsonArray, all docs)
```powershell
mongoexport --db $DB --collection Reviews --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --out "$OUTDIR\reviews.json" --jsonArray
```

Export to CSV (specify fields)
```powershell
mongoexport --db $DB --collection Songs --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --type=csv --fields "songId,title,artist,album" --out "$OUTDIR\songs.csv"
```

Import JSON (jsonArray)
```powershell
mongoimport --db $DB --collection Reviews --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --file "$OUTDIR\reviews.json" --jsonArray --drop
```

Import CSV (headerline)
```powershell
mongoimport --db $DB --collection Songs --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --type=csv --headerline --file "$OUTDIR\songs.csv" --drop
```

Tips and notes
- Replace plain passwords with secure methods in production. Example (interactive) to avoid leaving password in the command history:
  ```powershell
  $secure = Read-Host -Prompt 'MongoDB password' -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $passPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  # use $passPlain in the commands above; then clear it from memory
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Variable passPlain
  ```

- You can combine connection parameters into a single URI (recommended when using TLS/Atlas):
  ```powershell
  $uri = "mongodb://$USER:$PASS@$HOST:$PORT/$AUTHDB"
  mongodump --uri "$uri" --archive="$OUTDIR\hearsay.archive.gz" --gzip
  ```

- For Atlas or SRV URIs use `--uri "mongodb+srv://..."` and add `--ssl` / `--tls` flags if required.
- `--drop` on restore/import removes existing documents/collections before writing. Omit if you want to merge.
- `--jsonArray` is required if your JSON file contains an array of documents. Otherwise use newline-delimited JSON.
- Use `--gzip` and `--archive` to produce a single compressed file suitable for transfer.

Troubleshooting
- "command not found": install MongoDB Database Tools (https://www.mongodb.com/docs/database-tools/installation/).
- Authentication errors: confirm the user exists in the `$AUTHDB` and has correct roles (read for export, readWrite for import/restore).
- Permission errors when writing files: run PowerShell as Administrator or choose a writeable directory.

Quick example (one-liner archive dump + restore)
```powershell
# Dump
mongodump --db $DB --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --archive="$OUTDIR\hearsay.archive.gz" --gzip
# Restore
mongorestore --archive="$OUTDIR\hearsay.archive.gz" --gzip --username $USER --password $PASS --authenticationDatabase $AUTHDB --host $HOST --port $PORT --drop
```

