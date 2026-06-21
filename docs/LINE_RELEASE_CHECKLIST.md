# LINE Integration Release Checklist — DealerOS / GYEON Detailer Agent

## Purpose

Verify LINE Messaging API integration is correctly configured before production deployment.
LINE integration is only available on Pro Plus plan.

---

## 1. Environment Variables

```
□ LINE_CHANNEL_ID — set in Vercel production environment
□ LINE_CHANNEL_SECRET — set in Vercel production environment
□ LINE_CHANNEL_ACCESS_TOKEN — set (long-lived token, not short-lived)
□ NEXT_PUBLIC_LIFF_ID — set (if LIFF customer link is enabled)
```

If LINE integration is intentionally disabled, confirm:
```
□ LINE env vars intentionally absent
□ LINE feature gate blocks access for all plans
□ No LINE-related errors in Vercel function logs
```

---

## 2. LINE Developers Console Setup

1. Go to LINE Developers Console → your Messaging API channel
2. Verify:

```
□ Channel status is "Published" (not Draft)
□ Webhook URL is set to: https://{your-domain}/api/line/webhook
□ "Use webhook" is enabled
□ Webhook verification succeeds (LINE console "Verify" button)
□ Auto-reply messages are DISABLED (to avoid double-responses)
□ Greeting messages configured (or disabled)
```

---

## 3. Webhook Security

```
□ Signature verification enabled in webhook handler
□ X-Line-Signature header validated against channel secret
□ Invalid signatures return 400 (not 200)
□ Webhook endpoint rejects requests without valid signature
```

Verify in source:
```typescript
// src/app/api/line/webhook/route.ts
// Confirm validateLineSignature() is called before processing
```

---

## 4. Plan-Based Access Gate

LINE integration must be restricted to Pro Plus plan only:

```
□ /line page shows FeatureLocked for Basic plan dealers
□ /line page shows FeatureLocked for Pro plan dealers
□ /line page is accessible for Pro Plus plan dealers
□ LINE API endpoints (/api/line/*) reject requests from non-Pro Plus dealers
□ Feature gate check uses server-side plan verification (not client-side)
```

---

## 5. LINE Customer Link/Unlink

```
□ Customer link flow works: LIFF → LINE user ID saved to line_customers
□ Customer unlink removes LINE user ID association
□ Linked customer shows LINE badge in customer list
□ Unlinked customer does not receive LINE messages
```

---

## 6. Message Sending

```
□ Test message send succeeds via LINE Messaging API
□ Successful sends are logged in line_message_logs (status = 'sent')
□ Failed sends are logged in line_message_logs (status = 'failed', error_message set)
□ Rate limiting handled (LINE API allows 500 messages/month on free plan)
```

---

## 7. Maintenance Reminders via LINE

```
□ Reminder sending triggers LINE message to linked customers
□ Reminder log updated after LINE send attempt
□ Reminder fails gracefully if customer not linked to LINE
□ Reminder send respects monthly_line_messages limit for the plan
```

---

## 8. Post-Deploy LINE Test

```
□ Send a test message from /line page
□ Confirm message received in LINE app
□ Check line_message_logs for the sent record
□ Verify no errors in Vercel function logs
□ Check webhook receives and processes test event from LINE console
```

---

## See Also

- `docs/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/ENVIRONMENT_RELEASE_CHECKLIST.md`
- `supabase/migrations/043_create_line_customers.sql`
- `supabase/migrations/044_create_line_message_logs.sql`
