# DealerOS — Master Specification

## Single Source of Truth

**`docs/master_specification/` is the Single Source of Truth (SSOT) for the DealerOS project.**
Every requirement, architecture decision, business rule, and feature behavior is governed by the documents in this directory. See `INDEX.md` for the full document map.

### Canonical existing documents

The following pre-existing documents are **canonical** and are preserved unchanged — they must not be renamed, archived, overwritten, or replaced with placeholder skeletons:

- `01_PROJECT_OVERVIEW.md` — canonical Project Overview (document 01).
- `02_SYSTEM_ARCHITECTURE.md` — canonical System Architecture (document 02).

Documents 03–12 were added as skeletons to complete the canonical structure; their content is authored later under the approved workflow. See `INDEX.md` for how all documents map together.

## Rules

- **All implementation must follow these specifications.** Code must conform to the canonical documents here; where code and specification disagree, the specification is authoritative until formally amended.
- **Architecture changes require architect approval.** No structural or architectural change may be implemented without explicit approval from the architect.
- **Claude must read the relevant specification before implementation.** Before writing or modifying code for a feature, the corresponding specification document(s) in this directory must be read and followed.
- **Existing specification content is preserved.** No existing specification document may be renamed, archived, overwritten, or replaced with a placeholder skeleton.

## Approved Workflow

All work follows this sequence:

```
Requirement Analysis
→ Architecture Proposal
→ ChatGPT Review
→ Final Specification Approval
→ Claude Implementation
→ Review
→ Typecheck
→ Build
→ Commit
→ Push
```

No step may be skipped. Implementation (Claude Implementation) begins only after Final Specification Approval, and every change is verified (Review → Typecheck → Build) before Commit and Push.
