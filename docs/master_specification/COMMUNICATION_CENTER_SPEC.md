# GYEON Business Hub — Communication Center Specification

**Module**: `src/lib/communication/`  
**Version**: 1.0.0 — Sprint 11X  
**Status**: Active — Foundation implemented  
**Last Updated**: 2026-06-26

---

## 1. Purpose

The Communication Center is a platform-level shared service that provides a unified communication abstraction across all GYEON Business Hub applications.

| Layer | Responsibility |
|-------|---------------|
| Communication Center | Channel registry, provider metadata, consent model, policies, AI declarations |
| Application layer (e.g., `src/lib/line/`) | Channel-specific runtime implementation per application |
| Platform Core | Exposes Communication Center to all applications via bridge |

Applications may not import from each other's communication implementations. All communication services are consumed through the Communication Center via Platform Core.

---

## 2. Supported Channels

| # | Channel | Display Name | Type | Status | Japan Reach |
|---|---------|-------------|------|--------|-------------|
| 1 | `line` | LINE | messaging | **active** | 95M users |
| 2 | `whatsapp` | WhatsApp | messaging | planned | ~10M users |
| 3 | `instagram` | Instagram | social | planned | 33M users |
| 4 | `facebook_messenger` | Facebook Messenger | social | planned | 13M users |
| 5 | `x` | X | social | planned | 67M users |
| 6 | `email` | Email | direct | planned | Universal |
| 7 | `sms` | SMS | direct | planned | Universal |

### Channel Capabilities

| Capability | LINE | WhatsApp | Instagram | FB Messenger | X | Email | SMS |
|------------|------|----------|-----------|--------------|---|-------|-----|
| Send message | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Receive message | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Send media | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| Send template | ✓ | ✓ | — | ✓ | — | ✓ | ✓ |
| Automation | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Rich content | ✓ | ✓ | — | ✓ | — | ✓ | — |
| Read receipts | ✓ | ✓ | ✓ | ✓ | — | — | — |
| AI replies | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

### Application × Channel Availability

| Application | Available Channels |
|-------------|-------------------|
| GYEON Dealer Agent | LINE, Instagram, Facebook Messenger, X, Email, SMS |
| GYEON Distribution | LINE, WhatsApp, Email, SMS |
| GYEON Warehouse | Email |
| GYEON Accounting | Email |
| GYEON CRM | WhatsApp, Instagram, Facebook Messenger, Email |
| GYEON AI Center | Email |

---

## 3. Customer Communication Model

### Consent Flags

| Flag | Default | Required For |
|------|---------|-------------|
| `marketing_consent` | false | Promotional messages, campaigns |
| `review_request_consent` | false | Review request messages |
| `ai_communication_permission` | false | Any AI-generated customer message |

### Notification Preferences

| Preference | Default | Description |
|-----------|---------|-------------|
| `job_updates` | **true** | Work order status, completion notices |
| `maintenance_reminders` | false | Coating/maintenance cycle reminders |
| `promotional` | false | Marketing campaigns and offers |
| `system_notices` | **true** | Booking confirmations, account notices |

### Channel Resolution Order

1. Check `enabled_channels` — must include the target channel
2. Use `preferred_channel` if set and available for the message type
3. Fall back to first available enabled channel
4. If no enabled channel matches → no message sent

---

## 4. Communication Governance Policy

| Rule | Title | Enforcement |
|------|-------|-------------|
| COMM-001 | Customer Opt-In Required Before Outbound Messaging | strict |
| COMM-002 | Marketing Messages Require Explicit Marketing Consent | strict |
| COMM-003 | AI-Generated Messages Require ai_communication_permission | strict |
| COMM-004 | Channel Credentials Stored Server-Side Only | strict |
| COMM-005 | Communication Data Isolated Per Tenant | strict |
| COMM-006 | Opt-Out Requests Processed Immediately | strict |
| COMM-007 | Review Requests Must Not Incentivise or Selectively Target | strict |
| COMM-008 | Prefer Customer's Preferred Channel | advisory |
| COMM-009 | AI Messages Should Be Reviewed Before Automated Send | advisory |
| COMM-010 | SMS Character Encoding and Length Validated Before Send | advisory |

---

## 5. Unified Inbox (Future Architecture)

**Status**: planned — Sprint 12+

### Features

| Feature | Status |
|---------|--------|
| Conversation Threads | planned |
| Message History | planned |
| Attachments | planned |
| AI Assistant | planned |
| Read Status | planned |
| Staff Assignment | planned |
| Search | planned |
| Labels and Tags | planned |
| Bulk Actions | planned |
| Mobile App | future |

### Schema Types Declared

| Type | Description |
|------|-------------|
| `ConversationThread` | Thread between business and customer on one channel |
| `InboxMessage` | Single message within a thread |
| `MessageAttachment` | File attachment on a message |
| `ThreadAssignmentEvent` | Log of staff assignment changes |

---

## 6. AI Communication Capabilities

All AI communication capabilities require:
- AI Gateway (`src/lib/ai/`) to be active
- `ai_communication_permission = true` on customer preferences (where noted)

| Feature | Channels | Consent Required | Staff Review |
|---------|----------|-----------------|--------------|
| AI Reply Generation | LINE, WhatsApp, Instagram, FB Messenger, X, Email | yes | yes |
| AI Translation | all | no (internal) | no |
| AI Tone Adjustment | LINE, WhatsApp, Email | no (internal) | yes |
| AI Follow-up Sequence | LINE, Email, SMS | yes | yes |
| AI Maintenance Reminder | LINE, Email, SMS | yes | no (automated) |
| AI Review Request | LINE, Email, SMS | yes | no (automated) |

---

## 7. Module Structure

```
src/lib/communication/
├── index.ts                    — package barrel (public API)
├── communication-types.ts      — all domain types
├── channel-registry.ts         — 7 channel descriptors + lookup helpers
├── communication-provider.ts   — 7 provider entries + 10 capabilities
├── customer-communication.ts   — consent model, defaults, validation helpers
├── unified-inbox.ts            — future inbox architecture + schema types
├── ai-communication.ts         — 6 AI capabilities + lookup helpers
├── communication-policy.ts     — COMM-001 through COMM-010
└── platform-core-bridge.ts     — Platform Core-compatible adapters + descriptor
```

**Dependency direction:**
```
communication/ → platform-core/ (one-way)
```
`platform-core/` does not import from `communication/`.  
Existing `src/lib/line/` is a Dealer Agent-specific implementation; the Communication Center sits above it as a platform-level abstraction.

---

## 8. Registry Summary

| Item | Count |
|------|-------|
| Registered channels | 7 |
| Active channels | 1 (LINE) |
| Planned channels | 6 |
| Registered providers | 7 |
| Communication capabilities | 10 |
| AI communication capabilities | 6 |
| Governance policies | 10 |
| Strict policies | 7 |
| Advisory policies | 3 |

---

## 9. Next Steps

| Sprint | Focus |
|--------|-------|
| Sprint 11Y | Next platform foundation sprint (TBD) |
| Sprint 12+ | Email transactional provider integration |
| Sprint 12+ | Unified Inbox implementation begins |
| Sprint 12+ | AI communication capabilities wired to AI Gateway |
| Sprint 12+ | WhatsApp Business API integration for GYEON Distribution |
