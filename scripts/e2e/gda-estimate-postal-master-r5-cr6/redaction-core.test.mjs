import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, scanForSecrets, REDACTION_PLACEHOLDER, SECRET_PATTERN_NAMES } from './redaction-core.mjs';

const FAKE_SAMPLES = {
  jwt_shaped_value: 'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.fakefakefakefakefakefakefakefake',
  supabase_secret_key: 'key: sb_secret_fake0123456789ABCDEFghijklmnop',
  supabase_publishable_key: 'key: sb_publishable_fake0123456789ABCDEFghij',
  stripe_live_secret_key: 'sk_live_FAKE0123456789abcdefFAKE',
  access_token_assignment: 'access_token: "fake-access-token-value-123456"',
  authorization_header: 'Authorization: Bearer fake-bearer-token-abcdef123456',
  postgres_connection_string: 'postgresql://user:pass@127.0.0.1:5432/fakedb',
  password_argument: '--password fakeSecretValue123',
  password_assignment: 'password: "fakeSecretValue123"',
  password_query_parameter: 'https://example.invalid/reset?token=abc&password=fakeSecretValue123',
  service_role_or_anon_key_assignment: 'SERVICE_ROLE_KEY="fake-service-role-value-123456"',
  private_key_block: '-----BEGIN PRIVATE KEY-----\nFAKEFAKEFAKEFAKE\n-----END PRIVATE KEY-----',
};

test('every configured fake-secret class is redacted from its sample text', () => {
  for (const name of SECRET_PATTERN_NAMES) {
    const sample = FAKE_SAMPLES[name];
    assert.ok(sample, `missing fake sample for pattern class ${name}`);
    const redaction = redactSecrets(sample);
    assert.equal(redaction.ok, true, `redactSecrets failed for ${name}`);
    assert.ok(redaction.text.includes(REDACTION_PLACEHOLDER), `no placeholder inserted for ${name}`);

    const scanOriginal = scanForSecrets(sample);
    assert.equal(scanOriginal.ok, true);
    assert.equal(scanOriginal.clean, false, `original sample for ${name} was reported clean`);
    assert.ok(scanOriginal.matches.includes(name), `scan did not report pattern class ${name}: ${scanOriginal.matches}`);

    const scanRedacted = scanForSecrets(redaction.text);
    assert.equal(scanRedacted.ok, true);
    assert.equal(scanRedacted.clean, true, `redacted text for ${name} still matched a secret pattern: ${scanRedacted.matches}`);
  }
});

test('every declared SECRET_PATTERN_NAMES entry has a fake sample exercised above', () => {
  assert.deepEqual(new Set(SECRET_PATTERN_NAMES), new Set(Object.keys(FAKE_SAMPLES)));
});

test('a clean string with no secret-shaped content scans clean and is unmodified by redaction', () => {
  const clean = 'migration list completed with 112 staged entries and zero errors';
  const scan = scanForSecrets(clean);
  assert.equal(scan.ok, true);
  assert.equal(scan.clean, true);
  assert.deepEqual(scan.matches, []);
  const redaction = redactSecrets(clean);
  assert.equal(redaction.ok, true);
  assert.equal(redaction.text, clean);
});

test('a surviving secret-pattern match after redaction fails closed (clean:false) rather than being ignored', () => {
  const combined = `${FAKE_SAMPLES.jwt_shaped_value} and ${FAKE_SAMPLES.postgres_connection_string}`;
  const partiallyRedacted = combined.replace(FAKE_SAMPLES.postgres_connection_string, '[REDACTED]');
  const scan = scanForSecrets(partiallyRedacted);
  assert.equal(scan.ok, true);
  assert.equal(scan.clean, false);
  assert.ok(scan.matches.includes('jwt_shaped_value'));
});

test('redactSecrets fails closed on non-string input', () => {
  assert.equal(redactSecrets(null).ok, false);
  assert.equal(redactSecrets(undefined).ok, false);
  assert.equal(redactSecrets(12345).ok, false);
  assert.equal(redactSecrets({ text: 'x' }).ok, false);
  assert.equal(redactSecrets(['array']).ok, false);
});

test('scanForSecrets fails closed on non-string input and never reports a false clean result', () => {
  const nullResult = scanForSecrets(null);
  assert.equal(nullResult.ok, false);
  assert.equal(nullResult.clean, false);

  const numberResult = scanForSecrets(42);
  assert.equal(numberResult.ok, false);
  assert.equal(numberResult.clean, false);

  const objectResult = scanForSecrets({ not: 'a string' });
  assert.equal(objectResult.ok, false);
  assert.equal(objectResult.clean, false);
});

test('redactSecrets and scanForSecrets reject a non-array extraPatterns argument', () => {
  assert.equal(redactSecrets('text', 'not-an-array').ok, false);
  assert.equal(scanForSecrets('text', 'not-an-array').ok, false);
});

test('an injected extra pattern is honored by both redactSecrets and scanForSecrets', () => {
  const extra = [{ name: 'fake_internal_token', regex: /INTERNAL_[A-Z0-9]{6,}/g }];
  const sample = 'value=INTERNAL_ABC123XYZ';
  const scan = scanForSecrets(sample, extra);
  assert.equal(scan.clean, false);
  assert.ok(scan.matches.includes('fake_internal_token'));
  const redaction = redactSecrets(sample, extra);
  assert.ok(!redaction.text.includes('INTERNAL_ABC123XYZ'));
});

test('repeated calls do not leak global-regex lastIndex state across invocations', () => {
  const sample = FAKE_SAMPLES.jwt_shaped_value;
  const first = scanForSecrets(sample);
  const second = scanForSecrets(sample);
  assert.equal(first.clean, second.clean);
  assert.deepEqual(first.matches, second.matches);
});

test('redaction-core performs no I/O and only operates on its string argument', async () => {
  const moduleUrl = new URL('./redaction-core.mjs', import.meta.url);
  const source = await (await import('node:fs/promises')).readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /child_process|from ['"]node:fs|from ['"]fs['"]/);
});
