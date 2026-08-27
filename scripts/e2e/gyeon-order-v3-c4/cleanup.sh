#!/usr/bin/env bash
set -euo pipefail

CONFIRM_LITERAL="I_UNDERSTAND_GYEON_ORDER_V3_C4_IS_DISPOSABLE"
RUNTIME_PARENT="${GYEON_ORDER_V3_C4_RUNTIME_PARENT:-/Users/atsushinishikawa/Documents/Codex/runtime}"
RUNTIME_DIR="${GYEON_ORDER_V3_C4_RUNTIME_DIR:-}"

fail() {
  printf 'C4_CLEANUP_ERROR: %s\n' "$1" >&2
  exit 1
}

[[ "${GYEON_ORDER_V3_C4_DISPOSABLE_CONFIRM:-}" == "$CONFIRM_LITERAL" ]] || fail "explicit disposable confirmation is missing"
[[ -n "$RUNTIME_DIR" ]] || fail "GYEON_ORDER_V3_C4_RUNTIME_DIR is required"
[[ "$RUNTIME_DIR" =~ ^${RUNTIME_PARENT//\//\\/}/gyeon-order-v3-c4\.[0-9]{8}T[0-9]{6}Z-[a-z0-9]{6}$ ]] || fail "runtime path does not match the dedicated disposable pattern"
[[ -d "$RUNTIME_DIR" ]] || fail "runtime directory does not exist"
[[ -f "$RUNTIME_DIR/evidence/project-id.txt" ]] || fail "runtime identity evidence is missing"

env SUPABASE_TELEMETRY_DISABLED=1 supabase stop --workdir "$RUNTIME_DIR" --no-backup

# Only the exact validated C4 runtime is removable. No wildcard is used.
rm -rf -- "$RUNTIME_DIR"
printf 'C4_RUNTIME_REMOVED=%s\n' "$RUNTIME_DIR"
