import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildManifest,
  verifyAggregateManifestHash,
  REQUIRED_FORMAL_MIGRATION_COUNT,
  REQUIRED_STAGED_MIGRATION_COUNT,
  PROTECTED_LINE_MIGRATION_PATH,
  PROTECTED_LINE_MIGRATION_MODE,
  PROTECTED_LINE_MIGRATION_BLOB,
  MONTHLY_INVOICE_MIGRATION_PATH,
  MONTHLY_INVOICE_MIGRATION_MODE,
  MONTHLY_INVOICE_MIGRATION_BLOB,
  EXPECTED_AGGREGATE_MANIFEST_SHA256,
} from './manifest-core.mjs';

function fakeBlob(seed) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex');
}

function fakeSha256(seed) {
  return crypto.createHash('sha256').update(String(seed)).digest('hex');
}

function ordinaryEntry(seed, overrides = {}) {
  const path = `supabase/migrations/${String(20260000000000 + seed).padStart(14, '0')}_ordinary_${seed}.sql`;
  return {
    path,
    mode: '100644',
    blob: fakeBlob(seed),
    sha256: fakeSha256(seed),
    ...overrides,
  };
}

function validCanonicalManifest(entries) {
  return entries.map((entry) => ({ ...entry }));
}

function validHashAggregate() {
  return EXPECTED_AGGREGATE_MANIFEST_SHA256;
}

function sortedByPath(entries) {
  return [...entries].sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}

function buildValidRawEntries() {
  const entries = [];
  for (let i = 1; i <= 111; i += 1) {
    entries.push(ordinaryEntry(i));
  }
  entries.push({
    path: PROTECTED_LINE_MIGRATION_PATH,
    mode: PROTECTED_LINE_MIGRATION_MODE,
    blob: PROTECTED_LINE_MIGRATION_BLOB,
    sha256: null,
  });
  entries.push({
    path: MONTHLY_INVOICE_MIGRATION_PATH,
    mode: MONTHLY_INVOICE_MIGRATION_MODE,
    blob: MONTHLY_INVOICE_MIGRATION_BLOB,
    sha256: null,
  });
  assert.equal(entries.length, REQUIRED_FORMAL_MIGRATION_COUNT);
  return entries;
}

test('R2-01: exactly 113 formal migration paths are discovered and accepted', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.formalCount, REQUIRED_FORMAL_MIGRATION_COUNT);
});

test('R2-01: a manifest with fewer than 113 entries is rejected', () => {
  const entries = buildValidRawEntries().slice(0, 112);
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /exactly 113/);
});

test('R2-01: a manifest with more than 113 entries is rejected', () => {
  const entries = [...buildValidRawEntries(), ordinaryEntry(999)];
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /exactly 113/);
});

test('R2-02: exactly 112 paths are staged in byte order after excluding LINE', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.stagedCount, REQUIRED_STAGED_MIGRATION_COUNT);
  const paths = result.staged.map((entry) => entry.path);
  const sortedCopy = [...paths].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  assert.deepEqual(paths, sortedCopy);
  assert.equal(paths.includes(PROTECTED_LINE_MIGRATION_PATH), false);
});

test('R2-03: exactly the LINE migration is excluded, with the correct reason and no content field', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].path, PROTECTED_LINE_MIGRATION_PATH);
  assert.equal(result.excluded[0].reason, 'protected_line_migration');
  assert.equal(Object.prototype.hasOwnProperty.call(result.excluded[0], 'sha256'), false);
});

test('R2-03: a LINE migration with drifted metadata fails closed', () => {
  const entries = buildValidRawEntries().map((entry) =>
    entry.path === PROTECTED_LINE_MIGRATION_PATH ? { ...entry, blob: fakeBlob('tampered') } : entry,
  );
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected LINE migration metadata/);
});

test('R2-04: a nested draft path fails', () => {
  const entries = buildValidRawEntries();
  entries[0] = {
    ...entries[0],
    path: 'supabase/migrations/DRAFT_DO_NOT_APPLY/20260000000001_ordinary_1.sql',
  };
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /top-level file, not nested|basename grammar/);
});

test('R2-04: a seed-shaped filename without a timestamp prefix fails', () => {
  const entries = buildValidRawEntries();
  entries[0] = { ...entries[0], path: 'supabase/migrations/seed.sql' };
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /basename grammar/);
});

test('R3H: the fixed legacy three-digit migration basename form is accepted', () => {
  const entries = buildValidRawEntries();
  entries[0] = {
    ...entries[0],
    path: 'supabase/migrations/000_shared_functions.sql',
  };
  const ordered = sortedByPath(entries);
  const result = buildManifest(ordered, {
    canonicalManifest: validCanonicalManifest(ordered),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.formalCount, REQUIRED_FORMAL_MIGRATION_COUNT);
});

for (const invalidPrefix of ['0', '00', '0000', '0000000000000', '000000000000000']) {
  test(`R3H: an unsupported ${invalidPrefix.length}-digit migration prefix fails closed`, () => {
    const entries = buildValidRawEntries();
    entries[0] = {
      ...entries[0],
      path: `supabase/migrations/${invalidPrefix}_unsupported.sql`,
    };
    const result = buildManifest(entries);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' '), /basename grammar/);
  });
}

test('R2-04: a duplicate path fails', () => {
  const entries = buildValidRawEntries();
  entries[1] = { ...entries[0] };
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /duplicate migration path/);
});

test('R2-04: a missing required entry fails via canonical comparison', () => {
  const entries = buildValidRawEntries();
  const canonical = entries.map((entry) => ({ ...entry }));
  entries[0] = ordinaryEntry(500);
  const result = buildManifest(sortedByPath(entries), { canonicalManifest: canonical });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unexpected migration path|missing from supplied entries/);
});

test('R2-04: an unexpected extra path fails via canonical comparison', () => {
  const entries = buildValidRawEntries();
  const canonical = entries.map((entry) => ({ ...entry }));
  entries[2] = ordinaryEntry(9001);
  const result = buildManifest(sortedByPath(entries), { canonicalManifest: canonical });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unexpected migration path/);
});

test('R2-05: monthly-invoice migration is validated by fixed blob identity only, never a content sha256', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  const monthly = result.staged.find((entry) => entry.path === MONTHLY_INVOICE_MIGRATION_PATH);
  assert.equal(monthly.sha256, null);
});

test('R2-05: a monthly-invoice entry that carries a computed content sha256 fails closed', () => {
  const entries = buildValidRawEntries().map((entry) =>
    entry.path === MONTHLY_INVOICE_MIGRATION_PATH ? { ...entry, sha256: fakeSha256('should-not-exist') } : entry,
  );
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must never carry a content sha256/);
});

test('R2-05: a monthly-invoice entry with drifted blob metadata fails closed', () => {
  const entries = buildValidRawEntries().map((entry) =>
    entry.path === MONTHLY_INVOICE_MIGRATION_PATH ? { ...entry, blob: fakeBlob('tampered-monthly') } : entry,
  );
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /monthly-invoice migration metadata/);
});

test('canonical comparison skips content-hash checks for protected paths without a canonical sha256', () => {
  const entries = buildValidRawEntries();
  const canonical = entries.map((entry) => ({ ...entry }));
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, true);
});

test('canonical comparison rejects drifted mode/blob metadata on an ordinary entry', () => {
  const entries = buildValidRawEntries();
  const canonical = entries.map((entry) => ({ ...entry }));
  entries[3] = { ...entries[3], blob: fakeBlob('drift') };
  const result = buildManifest(entries, { canonicalManifest: canonical });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /metadata drift/);
});

test('canonical comparison rejects drifted content sha256 on an ordinary entry', () => {
  const entries = buildValidRawEntries();
  const canonical = entries.map((entry) => ({ ...entry }));
  entries[4] = { ...entries[4], sha256: fakeSha256('drift') };
  const result = buildManifest(entries, { canonicalManifest: canonical });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /content sha256 drift/);
});

test('aggregate manifest hash is enforced against the fixed accepted literal via an injected hash function', () => {
  const entries = buildValidRawEntries();
  let receivedStaged = null;
  const hashAggregate = (staged) => {
    receivedStaged = staged;
    return EXPECTED_AGGREGATE_MANIFEST_SHA256;
  };
  const result = buildManifest(entries, { canonicalManifest: validCanonicalManifest(entries), hashAggregate });
  assert.equal(result.ok, true);
  assert.equal(result.aggregateSha256, EXPECTED_AGGREGATE_MANIFEST_SHA256);
  assert.equal(receivedStaged.length, REQUIRED_STAGED_MIGRATION_COUNT);
});

test('aggregate manifest hash mismatch fails closed', () => {
  const entries = buildValidRawEntries();
  const hashAggregate = () => 'deadbeef'.repeat(8);
  const result = buildManifest(entries, { canonicalManifest: validCanonicalManifest(entries), hashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /aggregate manifest hash mismatch/);
});

test('verifyAggregateManifestHash is a pure, independently callable verifier', () => {
  const staged = buildValidRawEntries().filter((entry) => entry.path !== PROTECTED_LINE_MIGRATION_PATH);
  const passing = verifyAggregateManifestHash(staged, () => EXPECTED_AGGREGATE_MANIFEST_SHA256);
  assert.equal(passing.ok, true);
  const failing = verifyAggregateManifestHash(staged, () => 'wrong-hash', EXPECTED_AGGREGATE_MANIFEST_SHA256);
  assert.equal(failing.ok, false);
});

test('non-array rawEntries input fails closed without throwing', () => {
  const result = buildManifest('not-an-array');
  assert.equal(result.ok, false);
});

test('an entry missing required shape fields fails closed with a structural error', () => {
  const entries = buildValidRawEntries();
  entries[0] = { path: entries[0].path, mode: '100644' };
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /blob must be a 40-character hex/);
});

test('R2B-01: buildManifest fails closed when canonicalManifest is omitted entirely', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, { hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.canonicalManifest is required/);
});

test('R2B-01: buildManifest fails closed when canonicalManifest is malformed (not an array)', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, { canonicalManifest: 'not-an-array', hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.canonicalManifest is required/);
});

test('R2B-01: buildManifest fails closed when canonicalManifest is not an exact 113-entry accepted table', () => {
  const entries = buildValidRawEntries();
  const shortCanonical = validCanonicalManifest(entries).slice(0, 112);
  const result = buildManifest(entries, { canonicalManifest: shortCanonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonical manifest length/);
});

test('R2B-01: buildManifest fails closed when the injected aggregate hash authority is omitted', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, { canonicalManifest: validCanonicalManifest(entries) });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.hashAggregate is required/);
});

test('R2B-01: buildManifest fails closed when the injected aggregate hash authority is not a function', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, { canonicalManifest: validCanonicalManifest(entries), hashAggregate: 'not-a-function' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.hashAggregate is required/);
});

test('R2B-01: an attacker-configured expectedAggregateSha256 that differs from the fixed literal is rejected, not silently substituted', () => {
  const entries = buildValidRawEntries();
  const attackerHash = 'a'.repeat(64);
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: () => attackerHash,
    expectedAggregateSha256: attackerHash,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /options.expectedAggregateSha256 must equal the fixed accepted aggregate manifest hash literal/);
});

test('R2B-01: a configured expectedAggregateSha256 equal to the fixed literal is accepted', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
    expectedAggregateSha256: EXPECTED_AGGREGATE_MANIFEST_SHA256,
  });
  assert.equal(result.ok, true);
});

test('R2B-02: a reversed rawEntries input fails closed instead of being silently sorted into acceptance', () => {
  const entries = buildValidRawEntries();
  const reversed = [...entries].reverse();
  const result = buildManifest(reversed, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonical byte-sorted/);
});

test('R2B-02: a single out-of-order swap in rawEntries fails closed instead of being silently normalized', () => {
  const entries = buildValidRawEntries();
  const swapped = [...entries];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const result = buildManifest(swapped, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonical byte-sorted/);
});

test('R2B-03: a protected LINE migration carrying a content sha256 fails closed', () => {
  const entries = buildValidRawEntries().map((entry) =>
    entry.path === PROTECTED_LINE_MIGRATION_PATH ? { ...entry, sha256: fakeSha256('should-not-exist') } : entry,
  );
  const result = buildManifest(entries);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected LINE migration must never carry a content sha256/);
});

test('R2C-01: a reversed canonicalManifest fails closed instead of being silently normalized', () => {
  const entries = buildValidRawEntries();
  const canonical = [...validCanonicalManifest(entries)].reverse();
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonicalManifest must already be supplied in exact canonical byte-sorted path order/);
});

test('R2C-01: a single out-of-order swap in canonicalManifest fails closed instead of being silently normalized', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  [canonical[0], canonical[1]] = [canonical[1], canonical[0]];
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /canonicalManifest must already be supplied in exact canonical byte-sorted path order/);
});

test('R2C-02: a canonical ordinary entry missing sha256 fails closed before comparison', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  const index = canonical.findIndex((entry) => entry.path === entries[0].path);
  delete canonical[index].sha256;
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must have exactly the own keys path, mode, blob, sha256/);
});

test('R2C-02: a canonical entry with an extra attacker field fails closed before comparison', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  canonical[0].attackerField = 'malicious';
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must have exactly the own keys path, mode, blob, sha256/);
});

test('R2C-02: a canonical entry that is an array instead of a plain object fails closed', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  canonical[0] = [canonical[0].path, canonical[0].mode, canonical[0].blob, canonical[0].sha256];
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be a plain object with no accessor prototype chain/);
});

test('R2C-02: a canonical entry with an accessor sha256 getter fails closed', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  const index = canonical.findIndex((entry) => entry.path === entries[0].path);
  const source = canonical[index];
  const hostile = { path: source.path, mode: source.mode, blob: source.blob };
  Object.defineProperty(hostile, 'sha256', { enumerable: true, get: () => source.sha256 });
  canonical[index] = hostile;
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be an own data property, not an accessor/);
});

test('R2C-03: a canonical ordinary entry with a malformed sha256 fails closed', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  const index = canonical.findIndex((entry) => entry.path === entries[0].path);
  canonical[index].sha256 = 'F'.repeat(64);
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /must be null or a 64-character lowercase hex sha256/);
});

test('R2C-03: a canonical protected entry carrying a non-null sha256 fails closed', () => {
  const entries = buildValidRawEntries();
  const canonical = validCanonicalManifest(entries);
  const index = canonical.findIndex((entry) => entry.path === PROTECTED_LINE_MIGRATION_PATH);
  canonical[index].sha256 = fakeSha256('attacker-supplied-line-hash');
  const result = buildManifest(entries, { canonicalManifest: canonical, hashAggregate: validHashAggregate });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /protected canonical entry must carry sha256 === null/);
});

test('R2C: a valid exact canonical table with correct own-key schema and byte order still succeeds', () => {
  const entries = buildValidRawEntries();
  const result = buildManifest(entries, {
    canonicalManifest: validCanonicalManifest(entries),
    hashAggregate: validHashAggregate,
  });
  assert.equal(result.ok, true);
  assert.equal(result.formalCount, REQUIRED_FORMAL_MIGRATION_COUNT);
  assert.equal(result.stagedCount, REQUIRED_STAGED_MIGRATION_COUNT);
});

test('manifest-core performs no I/O: buildManifest never touches process.env, fs, or child_process', async () => {
  const moduleUrl = new URL('./manifest-core.mjs', import.meta.url);
  const source = await (await import('node:fs/promises')).readFile(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /require\(|from ['"]node:fs|from ['"]node:child_process|from ['"]fs['"]|from ['"]child_process['"]/);
});
