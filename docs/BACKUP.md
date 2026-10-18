# Backup & Recovery

Two things must be backed up:
1. **MongoDB** — the source of truth (products, stock, invoices, payments, customers, suppliers).
2. **Object storage** — the invoice **PDFs**.

> PDFs can also be **regenerated** from invoice data (`POST /api/invoices/:id/pdf/regenerate`),
> so the database is the critical backup. Still, back up both.

---

## MongoDB

### Scheduled dump (self-hosted)
```bash
# Daily dump, keep 14 days
STAMP=$(date +%F)
mongodump --uri "$MONGODB_URI" --gzip --archive="/backups/mnm-$STAMP.gz"
find /backups -name 'mnm-*.gz' -mtime +14 -delete
```
Add to cron:
```cron
0 2 * * *  /usr/local/bin/mnm-backup.sh >> /var/log/mnm-backup.log 2>&1
```

### Restore
```bash
# Restore an archive (use --drop to replace existing collections)
mongorestore --uri "$MONGODB_URI" --gzip --archive="/backups/mnm-2026-01-15.gz" --drop
```

### MongoDB Atlas
Enable **Cloud Backups** (continuous + daily snapshots) in the Atlas UI — point-in-time restore is
available without running `mongodump` yourself. Still test a restore periodically.

---

## Object storage (invoice PDFs)

### Amazon S3 / compatible
- Enable **Versioning** on the bucket (protects against accidental deletes/overwrites).
- Optionally add a **lifecycle rule** to transition old PDFs to cheaper storage.
- Cross-region replication for DR if required.

### Manual sync backup
```bash
aws s3 sync s3://mnm-fashion-invoices /backups/invoices --exact-timestamps
```

### Local driver (dev)
The `local` driver writes to `backend/.storage/`. Back up that folder with the DB dump if you ever
run `local` beyond development (not recommended for production).

---

## Recovery drill (do this before you need it)
1. Spin up a scratch MongoDB and `mongorestore` the latest dump.
2. Point a staging backend at it; log in; open a recent invoice.
3. If a PDF is missing, call `POST /api/invoices/:id/pdf/regenerate` (recreates it in storage).
4. Verify a `/bill/<token>` link opens and stock numbers look correct.

## RPO / RTO guidance
- **RPO** (max data loss): daily dumps → up to 24h. Use Atlas continuous backup / more frequent dumps to reduce.
- **RTO** (time to restore): typically minutes for `mongorestore`; keep this runbook with your backups.
