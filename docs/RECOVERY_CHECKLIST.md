# Recovery Checklist — DealerOS / GYEON Detailer Agent

Use this checklist during and after any incident. Check each box as you complete it.
Keep a copy of the completed checklist for post-incident review.

---

## Incident Information

```
Date/Time (JST):
Incident type:  [ ] Total outage  [ ] Data loss  [ ] Auth broken  [ ] Storage  [ ] Degraded
Affected scope: [ ] All dealers  [ ] Single dealer  [ ] Single feature
Detected by:
Recovery lead:
```

---

## Phase 1 — Detection & Assessment (0–15 min)

```
□ Check /admin → SystemHealthCard (note which are red/amber)
□ Check Supabase Dashboard → Reports for DB errors
□ Check Vercel Dashboard → Deployments for failed builds
□ Check Vercel → Functions → Logs for runtime errors
□ Check Supabase → Auth → Logs for auth failures
□ Check Supabase Status: https://status.supabase.com
□ Determine approximate incident start time
□ Determine scope: all dealers affected or specific ones?
□ Assign severity: P1 / P2 / P3 / P4 / P5
```

---

## Phase 2 — Containment (15–30 min)

```
□ If data corruption risk: set Vercel deployment to maintenance mode
□ Notify internal team of incident and severity
□ If downtime > 30 min: draft dealer notification message
□ Identify the last known-good deployment in Vercel
□ Identify the most recent clean backup timestamp
```

---

## Phase 3 — Recovery

### For P1 (Total Outage)

```
□ Verify Supabase project is online (dashboard shows green)
□ If Supabase project down: follow docs/DISASTER_RECOVERY.md section 4
□ If Vercel deployment broken: rollback to previous deployment
□ Redeploy if env vars changed
□ Confirm app loads at production URL
```

### For P2 (Data Loss)

```
□ Identify which tables / records are affected
□ Download backup from Supabase Dashboard → Backups
   Backup selected: _____________________
□ Restore to staging first (docs/BACKUP_DATABASE.md section 4)
□ Verify data integrity on staging
□ Restore to production (follow docs/BACKUP_DATABASE.md section 4)
□ Verify row counts match expected values
```

### For P3 (Storage Loss)

```
□ Identify missing files (compare document_files table vs Storage)
□ Download backup (docs/BACKUP_STORAGE.md section 2 or 3)
□ Re-upload files to documents bucket (docs/BACKUP_STORAGE.md section 5)
□ Test signed URL generation for a sample file
```

### For P4 (Auth Broken)

```
□ Check auth.users table in Supabase → Table Editor
□ If single user locked out: use Admin → Users → パスワードリセット
□ If all users locked out: check Supabase Auth service status
□ If admin_users entry missing: follow docs/DISASTER_RECOVERY.md section 7
```

### For P5 (Degraded / Health Warning)

```
□ Note which component is amber/red in SystemHealthCard
□ Supabase DB warning: run supabase db push to apply pending migrations
□ Storage warning: verify documents bucket exists, create if missing
□ LINE warning: check LINE env vars in Vercel, add missing ones
□ Env var warning: add missing vars to Vercel, redeploy
```

---

## Phase 4 — Verification (after each recovery step)

```
□ /admin → SystemHealthCard → all green
□ /login → can log in with dealer account
□ /customers → customer list loads
□ /work-orders → work order list loads with correct data
□ Create a test work order → verify RSV-/WO- numbering correct
□ Generate a PDF → verify file appears in Storage
□ /admin/audit → audit log shows recent entries
□ Notification bell → no unexpected error notifications
□ Check browser console for JavaScript errors
□ Check Vercel Functions logs for server errors
```

---

## Phase 5 — Post-Incident

```
□ Record total downtime: _____ minutes
□ Record data loss (if any): _____________________
□ Root cause identified: _____________________
□ Send dealer notification if applicable (note: sent at _____)
□ Create post-mortem document
□ Update runbook if procedures were unclear or missing
□ Schedule follow-up: verify system stable after 24h
□ Consider: should backup frequency / retention be increased?
□ Consider: should monitoring/alerting be added?
```

---

## Emergency Contacts

| Role | Contact | Notes |
|---|---|---|
| Supabase Support | [supabase.com/support](https://supabase.com/support) | For DB/Auth/Storage issues |
| Vercel Support | [vercel.com/support](https://vercel.com/support) | For deployment/edge issues |
| LINE Developers | [developers.line.biz](https://developers.line.biz) | For LINE API issues |

---

## Quick Reference

| Task | Command / Location |
|---|---|
| View Supabase backups | Dashboard → Database → Backups |
| Download DB backup | `pg_dump "$DB_URL" -Fc -f backup.dump` |
| Apply migrations | `supabase db push` |
| Roll back Vercel deploy | Dashboard → Deployments → ... → Promote to Production |
| Reset user password | `/admin/users` → パスワードリセット |
| Check system health | `/admin` → SystemHealthCard |

---

## See Also

- `docs/DISASTER_RECOVERY.md` — detailed recovery procedures
- `docs/BACKUP_DATABASE.md` — database backup and restore
- `docs/BACKUP_STORAGE.md` — storage backup and restore
- `docs/STAGING_SETUP.md` — staging environment for DR testing
