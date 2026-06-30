# DealerOS — Master Specification

## Single Source of Truth

**`docs/master_specification/` is the Single Source of Truth (SSOT) for the DealerOS project.**
Every requirement, architecture decision, business rule, and feature behavior is governed by the documents in this directory. See `INDEX.md` for the full document map.

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
