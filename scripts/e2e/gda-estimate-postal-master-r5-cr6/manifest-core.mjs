// Pure, offline manifest contract for the GDA Estimate Wizard Postal Master
// R5 CR6 hosted-replay harness. No file, Git, or network I/O occurs here;
// every input is injected data and every hash is computed by an injected
// pure function.

export const REQUIRED_FORMAL_MIGRATION_COUNT = 113;
export const REQUIRED_STAGED_MIGRATION_COUNT = 112;
export const REQUIRED_ENTRY_MODE = '100644';
export const MIGRATIONS_DIR_PREFIX = 'supabase/migrations/';
export const MIGRATION_BASENAME_PATTERN = /^[0-9]{14}_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*\.sql$/;

export const PROTECTED_LINE_MIGRATION_PATH =
  'supabase/migrations/20260801110110_line_link_tokens.sql';
export const PROTECTED_LINE_MIGRATION_MODE = '100644';
export const PROTECTED_LINE_MIGRATION_BLOB = 'accd22345054cc44f89156fd78eaba6dfe4242a4';
export const EXCLUDED_REASON_PROTECTED_LINE = 'protected_line_migration';

export const MONTHLY_INVOICE_MIGRATION_PATH =
  'supabase/migrations/20260807135006_monthly_invoice_pdf_artifact.sql';
export const MONTHLY_INVOICE_MIGRATION_MODE = '100644';
export const MONTHLY_INVOICE_MIGRATION_BLOB = '32fda49583ae1217bc13711784ad8fa31744726c';

export const EXPECTED_AGGREGATE_MANIFEST_SHA256 =
  '0d5414ac1257a287938e141d5c398f3607c3bf2650d38255f520956f15ddb5bb';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStrictPlainObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const CANONICAL_ENTRY_KEYS = ['path', 'mode', 'blob', 'sha256'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isSha256Hex(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isGitBlobHex(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function byteCompare(a, b) {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

function validateEntryShape(entry, index) {
  const errors = [];
  if (!isPlainObject(entry)) {
    errors.push(`entry[${index}] must be a plain object`);
    return errors;
  }
  if (!isNonEmptyString(entry.path)) {
    errors.push(`entry[${index}].path must be a non-empty string`);
    return errors;
  }
  if (!entry.path.startsWith(MIGRATIONS_DIR_PREFIX)) {
    errors.push(`entry[${index}].path must be under ${MIGRATIONS_DIR_PREFIX}: ${entry.path}`);
  } else {
    const basename = entry.path.slice(MIGRATIONS_DIR_PREFIX.length);
    if (basename.includes('/')) {
      errors.push(`entry[${index}].path must be a top-level file, not nested: ${entry.path}`);
    } else if (!MIGRATION_BASENAME_PATTERN.test(basename)) {
      errors.push(`entry[${index}].path does not match the required migration basename grammar: ${entry.path}`);
    }
  }
  if (entry.mode !== REQUIRED_ENTRY_MODE) {
    errors.push(`entry[${index}].mode must be exactly ${REQUIRED_ENTRY_MODE}: ${entry.path || 'unknown'}`);
  }
  if (!isGitBlobHex(entry.blob)) {
    errors.push(`entry[${index}].blob must be a 40-character hex git blob id: ${entry.path || 'unknown'}`);
  }
  if (entry.sha256 !== null && !isSha256Hex(entry.sha256)) {
    errors.push(`entry[${index}].sha256 must be null or a 64-character hex sha256: ${entry.path || 'unknown'}`);
  }
  return errors;
}

function validateCanonicalEntryShape(entry, index) {
  const errors = [];
  if (!isStrictPlainObject(entry)) {
    errors.push(`canonicalManifest[${index}] must be a plain object with no accessor prototype chain`);
    return errors;
  }
  const ownKeys = Reflect.ownKeys(entry);
  const missing = CANONICAL_ENTRY_KEYS.filter((key) => !ownKeys.includes(key));
  const extra = ownKeys.filter((key) => !CANONICAL_ENTRY_KEYS.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    errors.push(
      `canonicalManifest[${index}] must have exactly the own keys path, mode, blob, sha256 (missing: ${missing.join(', ') || 'none'}, extra: ${extra.map(String).join(', ') || 'none'})`,
    );
    return errors;
  }
  for (const key of CANONICAL_ENTRY_KEYS) {
    const descriptor = Object.getOwnPropertyDescriptor(entry, key);
    if (!descriptor || typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
      errors.push(`canonicalManifest[${index}].${key} must be an own data property, not an accessor`);
    }
  }
  if (errors.length > 0) return errors;
  if (!isNonEmptyString(entry.path)) {
    errors.push(`canonicalManifest[${index}].path must be a non-empty string`);
  }
  if (entry.mode !== REQUIRED_ENTRY_MODE) {
    errors.push(`canonicalManifest[${index}].mode must be exactly ${REQUIRED_ENTRY_MODE}: ${entry.path || 'unknown'}`);
  }
  if (!isGitBlobHex(entry.blob)) {
    errors.push(`canonicalManifest[${index}].blob must be a 40-character hex git blob id: ${entry.path || 'unknown'}`);
  }
  if (entry.sha256 !== null && !isSha256Hex(entry.sha256)) {
    errors.push(`canonicalManifest[${index}].sha256 must be null or a 64-character lowercase hex sha256: ${entry.path || 'unknown'}`);
  }
  return errors;
}

function compareAgainstCanonical(sorted, canonical) {
  const errors = [];
  const canonicalByPath = new Map(canonical.map((entry) => [entry.path, entry]));
  const actualByPath = new Map(sorted.map((entry) => [entry.path, entry]));

  for (const entry of sorted) {
    const expected = canonicalByPath.get(entry.path);
    if (!expected) {
      errors.push(`unexpected migration path not present in canonical manifest: ${entry.path}`);
      continue;
    }
    if (expected.mode !== entry.mode || expected.blob !== entry.blob) {
      errors.push(`entry metadata drift from canonical manifest: ${entry.path}`);
      continue;
    }
    const isProtectedPath =
      entry.path === PROTECTED_LINE_MIGRATION_PATH || entry.path === MONTHLY_INVOICE_MIGRATION_PATH;
    if (isProtectedPath) {
      if (expected.sha256 !== null) {
        errors.push(`protected canonical entry must carry sha256 === null: ${entry.path}`);
      }
    } else if (!isSha256Hex(expected.sha256)) {
      errors.push(`ordinary canonical entry must carry a valid 64-character lowercase sha256: ${entry.path}`);
    } else if (expected.sha256 !== entry.sha256) {
      errors.push(`entry content sha256 drift from canonical manifest: ${entry.path}`);
    }
  }
  for (const expected of canonical) {
    if (!actualByPath.has(expected.path)) {
      errors.push(`canonical migration path missing from supplied entries: ${expected.path}`);
    }
  }
  return errors;
}

/**
 * Construct and validate the exact 113-to-112 manifest contract.
 * rawEntries: array of { path, mode, blob, sha256 | null }.
 * options.canonicalManifest: required array of the same shape; the exact
 * accepted 113-entry table. Absent, malformed, or wrong-length input fails
 * closed.
 * options.hashAggregate: required injected pure aggregate hash function.
 * options.expectedAggregateSha256: optional; if supplied it must equal the
 * fixed accepted literal or the call fails closed. It is never used to
 * override the fixed literal used for comparison.
 */
export function buildManifest(rawEntries, options = {}) {
  if (!Array.isArray(rawEntries)) {
    return { ok: false, errors: ['rawEntries must be an array'] };
  }

  const shapeErrors = [];
  rawEntries.forEach((entry, index) => shapeErrors.push(...validateEntryShape(entry, index)));
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };

  if (rawEntries.length !== REQUIRED_FORMAL_MIGRATION_COUNT) {
    return {
      ok: false,
      errors: [
        `expected exactly ${REQUIRED_FORMAL_MIGRATION_COUNT} formal migration entries, received ${rawEntries.length}`,
      ],
    };
  }

  const pathCounts = new Map();
  for (const entry of rawEntries) {
    pathCounts.set(entry.path, (pathCounts.get(entry.path) || 0) + 1);
  }
  const duplicates = [...pathCounts.entries()].filter(([, count]) => count > 1).map(([path]) => path);
  if (duplicates.length > 0) {
    return { ok: false, errors: [`duplicate migration path(s): ${duplicates.join(', ')}`] };
  }

  const sorted = [...rawEntries].sort((a, b) => byteCompare(a.path, b.path));

  // R2B-02: rawEntries must already arrive in exact canonical byte order.
  // Silently sorting a reversed/shuffled input would normalize a reordered
  // or substituted-by-position submission into acceptance.
  const isCanonicalByteOrder = rawEntries.every((entry, index) => entry.path === sorted[index].path);
  if (!isCanonicalByteOrder) {
    return { ok: false, errors: ['rawEntries must already be supplied in exact canonical byte-sorted path order'] };
  }

  const lineEntry = sorted.find((entry) => entry.path === PROTECTED_LINE_MIGRATION_PATH);
  if (!lineEntry) {
    return { ok: false, errors: [`required protected LINE migration path is missing: ${PROTECTED_LINE_MIGRATION_PATH}`] };
  }
  if (lineEntry.mode !== PROTECTED_LINE_MIGRATION_MODE || lineEntry.blob !== PROTECTED_LINE_MIGRATION_BLOB) {
    return { ok: false, errors: ['protected LINE migration metadata does not match the fixed accepted identity'] };
  }
  // R2B-03: the protected LINE migration must never carry a content sha256.
  if (lineEntry.sha256 !== null) {
    return {
      ok: false,
      errors: ['protected LINE migration must never carry a content sha256; it is handled by fixed Git blob identity only'],
    };
  }

  const monthlyEntry = sorted.find((entry) => entry.path === MONTHLY_INVOICE_MIGRATION_PATH);
  if (!monthlyEntry) {
    return { ok: false, errors: [`required monthly-invoice migration path is missing: ${MONTHLY_INVOICE_MIGRATION_PATH}`] };
  }
  if (monthlyEntry.mode !== MONTHLY_INVOICE_MIGRATION_MODE || monthlyEntry.blob !== MONTHLY_INVOICE_MIGRATION_BLOB) {
    return { ok: false, errors: ['monthly-invoice migration metadata does not match the fixed accepted identity'] };
  }
  if (monthlyEntry.sha256 !== null) {
    return {
      ok: false,
      errors: ['monthly-invoice migration must never carry a content sha256; it is handled by fixed Git blob identity only'],
    };
  }

  for (const entry of sorted) {
    if (entry.path === PROTECTED_LINE_MIGRATION_PATH || entry.path === MONTHLY_INVOICE_MIGRATION_PATH) continue;
    if (entry.sha256 === null) {
      return { ok: false, errors: [`entry must carry a content sha256: ${entry.path}`] };
    }
  }

  const staged = sorted.filter((entry) => entry.path !== PROTECTED_LINE_MIGRATION_PATH);
  if (staged.length !== REQUIRED_STAGED_MIGRATION_COUNT) {
    return {
      ok: false,
      errors: [
        `expected exactly ${REQUIRED_STAGED_MIGRATION_COUNT} staged migrations after excluding the protected LINE migration, computed ${staged.length}`,
      ],
    };
  }

  // R2B-01: the injected canonical accepted manifest table is mandatory.
  // Omitting it must never silently skip drift/substitution detection.
  if (!Array.isArray(options.canonicalManifest)) {
    return {
      ok: false,
      errors: ['options.canonicalManifest is required and must be an array containing the exact accepted manifest table'],
    };
  }
  if (options.canonicalManifest.length !== sorted.length) {
    return {
      ok: false,
      errors: [
        `canonical manifest length ${options.canonicalManifest.length} does not equal computed length ${sorted.length}`,
      ],
    };
  }
  // R2C-02: every canonical entry must have the exact allowed own-key schema
  // before any comparison is attempted. Missing/extra fields, accessors, and
  // non-plain objects fail closed here rather than being silently coerced.
  const canonicalShapeErrors = [];
  options.canonicalManifest.forEach((entry, index) => canonicalShapeErrors.push(...validateCanonicalEntryShape(entry, index)));
  if (canonicalShapeErrors.length > 0) return { ok: false, errors: canonicalShapeErrors };

  // R2C-01: the injected canonicalManifest must already arrive in exact
  // canonical byte-sorted path order. A reversed or shuffled canonical table
  // must never be silently normalized before comparison.
  const canonicalSorted = [...options.canonicalManifest].sort((a, b) => byteCompare(a.path, b.path));
  const isCanonicalManifestByteOrder = options.canonicalManifest.every(
    (entry, index) => entry.path === canonicalSorted[index].path,
  );
  if (!isCanonicalManifestByteOrder) {
    return {
      ok: false,
      errors: ['options.canonicalManifest must already be supplied in exact canonical byte-sorted path order'],
    };
  }

  const canonicalErrors = compareAgainstCanonical(sorted, options.canonicalManifest);
  if (canonicalErrors.length > 0) return { ok: false, errors: canonicalErrors };

  // R2B-01: a configured expected aggregate must equal the fixed accepted
  // literal. An attacker-controlled configured value is never silently
  // substituted for the fixed literal.
  if (
    options.expectedAggregateSha256 !== undefined &&
    options.expectedAggregateSha256 !== EXPECTED_AGGREGATE_MANIFEST_SHA256
  ) {
    return {
      ok: false,
      errors: ['options.expectedAggregateSha256 must equal the fixed accepted aggregate manifest hash literal'],
    };
  }

  // R2B-01: the injected aggregate hash authority is mandatory.
  if (typeof options.hashAggregate !== 'function') {
    return {
      ok: false,
      errors: ['options.hashAggregate is required and must be the injected aggregate hash authority function'],
    };
  }
  const aggregateSha256 = options.hashAggregate(staged);
  if (aggregateSha256 !== EXPECTED_AGGREGATE_MANIFEST_SHA256) {
    return {
      ok: false,
      errors: [
        `aggregate manifest hash mismatch: expected ${EXPECTED_AGGREGATE_MANIFEST_SHA256}, computed ${aggregateSha256}`,
      ],
    };
  }

  return {
    ok: true,
    formalCount: sorted.length,
    stagedCount: staged.length,
    excluded: [{ path: lineEntry.path, mode: lineEntry.mode, blob: lineEntry.blob, reason: EXCLUDED_REASON_PROTECTED_LINE }],
    staged,
    aggregateSha256,
  };
}

/**
 * Verify a staged manifest against the fixed aggregate identity using an
 * injected pure hash function. Never performs I/O itself.
 */
export function verifyAggregateManifestHash(staged, hashFn, expected = EXPECTED_AGGREGATE_MANIFEST_SHA256) {
  if (!Array.isArray(staged)) {
    return { ok: false, errors: ['staged must be an array'] };
  }
  if (typeof hashFn !== 'function') {
    return { ok: false, errors: ['hashFn must be a function'] };
  }
  const computed = hashFn(staged);
  if (computed !== expected) {
    return { ok: false, errors: [`aggregate manifest hash mismatch: expected ${expected}, computed ${computed}`] };
  }
  return { ok: true, aggregateSha256: computed };
}
