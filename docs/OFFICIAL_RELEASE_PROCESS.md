# Official Release Process — GYEON Detailer Agent

**Version:** 1.0.0-RC1  
**Owner:** Office AZ  
**Date:** 2026-06-21

---

## Overview

This document defines the official release process for GYEON Detailer Agent. It covers Release Candidate (RC) creation, final validation, production approval, dealer onboarding, and version update policy.

**RULE: No direct production deployment. Staging first. Manual SQL only. No automatic migration.**

---

## Release Stages

```
Development → Feature Complete → RC1 → RC Validation → Production Approval → Production Deploy → GA
```

| Stage | Description | Owner |
|-------|-------------|-------|
| Development | Active feature work | Engineer |
| Feature Complete | All planned features implemented | Engineer + Product |
| RC1 | First release candidate built, docs finalized | Engineer |
| RC Validation | Full staging test + UAT exit criteria | Admin + UAT dealers |
| Production Approval | Sign-off from Owner + GYEON | Owner + GYEON Rep |
| Production Deploy | Migration applied, code deployed | Engineer |
| GA | General Availability — dealers onboarded | Admin |

---

## 1. Release Candidate (RC) Phase

### Entry Criteria
- All phase implementations complete (PHASE35–PHASE65 for v1.0.0)
- `npm run build` passes with zero errors
- `npx tsc --noEmit` passes
- VERSION.md, CHANGELOG.md, RELEASE_NOTES updated
- RC status page shows score ≥ 70

### RC Activities
1. Run full staging verification (Admin Console → Staging Verification)
2. Confirm all 63 checklist items pass
3. Check migration status panel (all 27+ migrations probed green)
4. Check Release Readiness panel (no BLOCKED)
5. Check RC Status panel (score, checks)
6. Review KNOWN_LIMITATIONS.md — confirm all listed
7. Tag RC commit in git: `git tag v1.0.0-rc1`

### RC Checklist
See `RELEASE_CHECKLIST.md` — all 11 sections must pass.

---

## 2. Final Validation

### Staging Smoke Test
Follow `docs/STAGING_SMOKE_TEST_CHECKLIST.md`:
- [ ] Login works
- [ ] Dealer onboarding completes
- [ ] Customer creation works
- [ ] Vehicle addition works
- [ ] Estimate creation + PDF works
- [ ] Work order creation works
- [ ] Invoice creation + PDF works
- [ ] Payment record works
- [ ] LINE webhook receives
- [ ] Reservation creation works
- [ ] Maintenance reminder scheduled

### UAT Exit Criteria
Confirm `docs/UAT_EXIT_CRITERIA.md` is fully met:
- [ ] Minimum 2 dealers completed UAT sessions
- [ ] No CRITICAL or HIGH unresolved issues
- [ ] Average feedback rating ≥ 3.5
- [ ] All 18 test cases executed

### Performance Check
- [ ] Admin console loads within 3 seconds
- [ ] Dealer dashboard loads within 2 seconds
- [ ] PDF generation completes within 5 seconds
- [ ] No Vercel function timeouts observed

---

## 3. Production Approval

### Required Sign-Offs

| Approver | Criteria |
|----------|----------|
| Lead Engineer | All technical checks pass, build clean |
| Office AZ Owner | Business requirements met, RELEASE_CHECKLIST signed |
| GYEON Representative | Brand compliance, feature alignment with GYEON Japan requirements |

### Approval Document
Complete the signature table in `RELEASE_CHECKLIST.md` before proceeding to production deploy.

### Go / No-Go Decision
| Condition | Decision |
|-----------|----------|
| All 11 checklist sections PASS + all sign-offs obtained | GO |
| Any BLOCKED check unresolved | NO-GO |
| CRITICAL or HIGH UAT issue open | NO-GO |
| RC score < 70 | NO-GO |
| Any sign-off missing | NO-GO |

---

## 4. Production Deploy

**CRITICAL: Never deploy directly without completing steps 1–3.**

### Pre-Deploy (Day of Release)
1. Take manual database backup (Supabase Dashboard → Backups)
2. Notify all internal users of maintenance window
3. Confirm Vercel deployment is paused (do not auto-deploy from git push)

### Migration Apply
1. Open Supabase SQL Editor (production project)
2. Apply each migration in order: 035, 036, ..., 065
3. Verify each migration with probe queries (see `docs/STAGING_SQL_VERIFICATION_PACK.md`)
4. Document completion time for each migration

### Code Deploy
1. `git tag v1.0.0` on the release commit
2. Push tag: `git push origin v1.0.0`
3. Deploy to Vercel: trigger production deployment from Vercel dashboard
4. Verify deployment succeeds (no build errors)

### Post-Deploy Verification (within 1 hour)
- [ ] Production URL loads
- [ ] Admin console accessible and functional
- [ ] Test dealer login works
- [ ] PDF generation works
- [ ] LINE webhook receives test message
- [ ] No errors in Vercel function logs

---

## 5. Dealer Release (GA Onboarding)

### Batch Onboarding
1. Admin creates billing record per dealer (plan: pro, status: trial → active)
2. Admin creates initial invoice if paid subscription
3. Admin sends dealer login credentials
4. Dealer completes onboarding wizard
5. Admin confirms onboarding_completed = true in database

### Communication
- Welcome email (manual, drafted from template)
- LINE message to dealer contact (if LINE-linked)
- Billing invoice delivered by email

### First-Week Support
- Admin monitors audit logs for errors
- Admin monitors LINE webhook for failures
- Scheduled check-in with each new dealer at day 3 and day 7

---

## 6. Version Update Policy

### When to Increment Version

| Change Type | Version Increment | Example |
|-------------|-------------------|---------|
| Bug fix only | PATCH (1.0.0 → 1.0.1) | Fix PDF font rendering |
| New feature, no breaking change | MINOR (1.0.x → 1.1.0) | Add inventory management |
| Breaking schema/API change | MAJOR (1.x.x → 2.0.0) | Multi-currency support |
| Pre-release | LABEL (1.0.0-RC2) | Second release candidate |

### Release Candidate Naming
- `1.0.0-RC1` — first RC
- `1.0.0-RC2` — if RC1 fails validation and significant changes made
- `1.0.0` — final GA after RC passes

### Files to Update on Each Release
1. `VERSION.md` — update Version and Release History table
2. `CHANGELOG.md` — add new section at top
3. `RELEASE_NOTES_v{MAJOR}.md` — update or create new file
4. Git tag: `git tag v{VERSION}`

---

## Emergency Rollback

If a critical issue is found after production deployment:

1. **Immediately** notify all affected dealers
2. Revert Vercel deployment to previous version (Vercel Dashboard → Deployments → Promote previous)
3. Assess whether database rollback is needed (Supabase PITR)
4. If schema rollback needed: restore from pre-release backup
5. Document incident in `docs/INCIDENT_LOG.md`
6. Fix issue, re-validate, create RC2

---

*GYEON Detailer Agent | Office AZ | Powered by GYEON Japan*
