// Pure, offline secret redaction/detection contract for the CR6 harness. No
// I/O occurs here; every function operates only on its string argument.

export const REDACTION_PLACEHOLDER = '[REDACTED]';

const SECRET_PATTERNS = [
  { name: 'jwt_shaped_value', regex: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?/g },
  { name: 'supabase_secret_key', regex: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { name: 'supabase_publishable_key', regex: /sb_publishable_[A-Za-z0-9_-]{10,}/g },
  { name: 'stripe_live_secret_key', regex: /sk_live_[A-Za-z0-9]{10,}/g },
  { name: 'access_token_assignment', regex: /access[_-]?token["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi },
  { name: 'authorization_header', regex: /authorization\s*:\s*bearer\s+[A-Za-z0-9._-]{8,}/gi },
  { name: 'postgres_connection_string', regex: /postgres(?:ql)?:\/\/[^\s'"]+/gi },
  { name: 'password_argument', regex: /(?:--password|(?:^|\s)-p)\s+\S+/g },
  { name: 'password_assignment', regex: /password["']?\s*[:=]\s*["']?\S+["']?/gi },
  { name: 'password_query_parameter', regex: /[?&]password=[^&\s'"]+/gi },
  { name: 'service_role_or_anon_key_assignment', regex: /(?:service[_-]?role|anon|publishable|secret)[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{8,}["']?/gi },
  { name: 'private_key_block', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
];

export const SECRET_PATTERN_NAMES = SECRET_PATTERNS.map((pattern) => pattern.name);

function withFreshGlobalFlag(pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

/** Redact every configured secret-pattern match. Fails closed for non-string input. */
export function redactSecrets(input, extraPatterns = []) {
  if (typeof input !== 'string') {
    return { ok: false, errors: ['input must be a string'] };
  }
  if (!Array.isArray(extraPatterns)) {
    return { ok: false, errors: ['extraPatterns must be an array'] };
  }
  let text = input;
  for (const pattern of [...SECRET_PATTERNS, ...extraPatterns]) {
    text = text.replace(withFreshGlobalFlag(pattern.regex), REDACTION_PLACEHOLDER);
  }
  return { ok: true, text };
}

/**
 * Detect any configured secret pattern. Non-string or otherwise unscannable
 * input fails closed with clean:false rather than reporting a false clean
 * result.
 */
export function scanForSecrets(input, extraPatterns = []) {
  if (typeof input !== 'string') {
    return { ok: false, clean: false, errors: ['input must be a string; unscannable input fails closed'] };
  }
  if (!Array.isArray(extraPatterns)) {
    return { ok: false, clean: false, errors: ['extraPatterns must be an array'] };
  }
  const matches = [];
  for (const pattern of [...SECRET_PATTERNS, ...extraPatterns]) {
    if (withFreshGlobalFlag(pattern.regex).test(input)) {
      matches.push(pattern.name);
    }
  }
  return { ok: true, clean: matches.length === 0, matches };
}
