// INV001 D6 deterministic concurrency proof (races C1-C5, characterization C6).
//
// Every racing actor is a separate `docker exec ... psql` OS process with its
// own backend and application_name. An independent observer connection polls
// pg_stat_activity / pg_blocking_pids and releases the holder only after the
// waiting backend is proven blocked on the holder. All child output flows
// through the orchestrator's memory-only secret channel (ctx.session / ctx.sql).

const RACE_TIMEOUT_MS = 15_000;
const POLL_MS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const LOCATION = "wh-a";
const VERSION = 1;

function lit(value) {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("NON_SAFE_INTEGER_LITERAL");
    return String(value);
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9_.:-]*$/u.test(value)) {
    throw new Error("UNSAFE_SQL_LITERAL");
  }
  return `'${value}'`;
}

function claimPrefix(uid) {
  if (!UUID_RE.test(uid)) throw new Error("UNSAFE_CLAIM_UID");
  return [
    "set role authenticated;",
    `select set_config('request.jwt.claim.sub', '${uid}', false);`,
    `select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false);`,
    "",
  ].join("\n");
}

function rpcCall(name, args) {
  return `select 'R:' || public.office_az_inventory_mobile_${name}(${args.map(lit).join(", ")})::text;\n`;
}

function parseRpcOutcome(lines) {
  const tagged = lines.filter((line) => line.startsWith("R:"));
  if (tagged.length !== 1) return "NO_RESULT";
  let parsed;
  try {
    parsed = JSON.parse(tagged[0].slice(2));
  } catch {
    return "UNPARSEABLE_RESULT";
  }
  if (
    parsed === null
    || typeof parsed !== "object"
    || Object.keys(parsed).length !== 2
    || typeof parsed.ok !== "boolean"
    || !["accepted", "invalid_or_stale", "failed"].includes(parsed.status)
    || parsed.ok !== (parsed.status === "accepted")
  ) {
    return "RESULT_SHAPE_MISMATCH";
  }
  return parsed.status;
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export async function runRaces(ctx) {
  const { uid } = ctx;
  if (!UUID_RE.test(uid)) throw ctx.stop("RACE_FIXTURE_UID_INVALID");

  async function activity(appName) {
    const out = await ctx.sql(`
      select coalesce((
        select concat_ws('|', a.pid, coalesce(a.state, ''), coalesce(a.wait_event_type, ''),
          coalesce(array_to_string(pg_blocking_pids(a.pid), ' '), ''),
          (a.backend_xid is not null)::text,
          (select count(*) from pg_locks l where l.pid = a.pid and l.locktype = 'advisory' and l.granted))
        from pg_stat_activity a where a.application_name = ${lit(appName)}
        order by a.backend_start desc limit 1
      ), 'none');
    `, "race_observer");
    if (out === "none") return null;
    const [pid, state, waitEventType, blocking, hasXid, advisory] = out.split("|");
    return {
      pid: Number(pid),
      state,
      waitEventType,
      blockingPids: blocking === "" ? [] : blocking.split(" ").map(Number),
      holdsWrite: hasXid === "true",
      advisoryGranted: Number(advisory),
    };
  }

  const holding = (s) => s.state === "idle in transaction" && s.holdsWrite;

  async function waitFor(appName, predicate, deadline, code) {
    for (;;) {
      const observed = await activity(appName);
      if (observed !== null && predicate(observed)) return observed;
      if (Date.now() > deadline) throw ctx.stop(code);
      await sleep(POLL_MS);
    }
  }

  async function finish(sessions, deadline) {
    const remaining = Math.max(1, deadline - Date.now());
    let timer;
    const timeout = new Promise((resolvePromise) => {
      timer = setTimeout(() => resolvePromise("TIMEOUT"), remaining);
    });
    const all = Promise.all(sessions.map((session) => session.done));
    const result = await Promise.race([all, timeout]);
    clearTimeout(timer);
    if (result === "TIMEOUT") {
      for (const session of sessions) session.kill();
      await Promise.allSettled(sessions.map((session) => session.done));
      throw ctx.stop("RACE_TIMEOUT");
    }
    for (const session of result) {
      if (session.exitCode !== 0) throw ctx.stop("RACE_SESSION_FAILED");
    }
    return result;
  }

  async function withRace(id, body) {
    const sessions = [];
    const deadline = Date.now() + RACE_TIMEOUT_MS;
    const open = (appSuffix) => {
      const session = ctx.session({ step: `race_${id.toLowerCase()}_${appSuffix}`, appName: `inv001-d6-${id.toLowerCase()}-${appSuffix}` });
      sessions.push(session);
      return session;
    };
    try {
      return await body({ open, deadline, finish: (list) => finish(list, deadline) });
    } catch (error) {
      for (const session of sessions) session.kill();
      await Promise.allSettled(sessions.map((session) => session.done));
      throw error;
    }
  }

  const isolation = await ctx.sql("select current_setting('default_transaction_isolation');", "race_isolation");
  if (isolation !== "read committed") throw ctx.stop("RACE_ISOLATION_NOT_READ_COMMITTED");

  const fixtures = {};
  for (const id of ["C1", "C2", "C3", "C4", "C5", "C6"]) {
    const key = id.toLowerCase();
    fixtures[id] = {
      assignment: ctx.uuid(),
      actor: `actor-race-${key}`,
      operator: `operator-race-${key}`,
      device: ctx.rawHash(),
    };
  }
  const assignmentRows = Object.entries(fixtures).map(([id, f]) => `(
    ${lit(f.assignment)}, 'human', ${lit(uid)}, ${lit(f.actor)}, ${lit(f.operator)},
    ${id === "C6" ? "'office_az_warehouse_operator'" : "'office_az_inventory_super_admin'"},
    'active', now() - interval '1 hour', null, ${VERSION})`).join(",\n");
  const grantRows = Object.entries(fixtures).flatMap(([id, f]) => (id === "C6"
    ? [`(${lit(f.assignment)}, 'inventory.quantity.read')`]
    : ["inventory.device.register", "inventory.session.issue", "inventory.session.revoke"]
      .map((capability) => `(${lit(f.assignment)}, ${lit(capability)})`))).join(",\n");
  const locationRows = Object.values(fixtures).map((f) => `(${lit(f.assignment)}, ${lit(LOCATION)})`).join(",\n");
  const deviceRows = ["C1", "C2", "C3", "C5"].map((id) => {
    const f = fixtures[id];
    return `(${lit(f.device)}, ${lit(f.actor)}, ${lit(f.operator)}, ${lit(uid)}, ${lit(LOCATION)}, ${VERSION}, 'active')`;
  }).join(",\n");
  const c4 = fixtures.C4;
  c4.session = ctx.rawHash();
  c4.refresh1 = ctx.rawHash();
  await ctx.sql(`
    begin;
    insert into office_az_inventory_authority_private.assignments(
      assignment_id, principal_kind, authenticated_user_id, actor_id, operator_id,
      role, status, valid_from, valid_until, authority_version
    ) values ${assignmentRows};
    insert into office_az_inventory_authority_private.capability_grants(assignment_id, capability) values ${grantRows};
    insert into office_az_inventory_authority_private.location_grants(assignment_id, location_id) values ${locationRows};
    insert into office_az_inventory_mobile_private.managed_devices(
      device_id_hash, actor_id, operator_id, authenticated_user_id, location_id, authority_version, status
    ) values ${deviceRows},
      (${lit(c4.device)}, ${lit(c4.actor)}, ${lit(c4.operator)}, ${lit(uid)}, ${lit(LOCATION)}, ${VERSION}, 'active');
    insert into office_az_inventory_mobile_private.sessions(
      session_id_hash, device_id_hash, actor_id, operator_id, authenticated_user_id,
      location_id, authority_version, refresh_hash, refresh_version,
      issued_at, access_expires_at, absolute_expires_at
    )
    select ${lit(c4.session)}, ${lit(c4.device)}, ${lit(c4.actor)}, ${lit(c4.operator)}, ${lit(uid)},
      ${lit(LOCATION)}, ${VERSION}, ${lit(c4.refresh1)}, 1,
      issued, issued + interval '1 hour', issued + interval '12 hours'
    from (select now() as issued) as t;
    commit;
  `, "race_fixtures");

  const shared = (f) => [f.actor, f.operator, LOCATION, VERSION];
  const count = async (sql, step) => Number(await ctx.sql(sql, step));
  const races = [];

  // C1 revoke-before-issue: the assignment revoke holds the row; issue blocks, then fails closed.
  races.push(await withRace("C1", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C1;
    const session = ctx.rawHash();
    const holder = open("a");
    holder.write(`begin;\nupdate office_az_inventory_authority_private.assignments set status = 'revoked' where assignment_id = ${lit(f.assignment)};\n`);
    const held = await waitFor("inv001-d6-c1-a", holding, deadline, "RACE_HOLDER_NOT_READY");
    const waiter = open("b");
    waiter.write(`${claimPrefix(uid)}${rpcCall("issue", [...shared(f), f.device, session, ctx.rawHash()])}`);
    waiter.end();
    const blocked = await waitFor("inv001-d6-c1-b", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(held.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    holder.write("commit;\n");
    holder.end();
    const [, waiterResult] = await done([holder, waiter]);
    const outcome = parseRpcOutcome(waiterResult.lines);
    const sessions = await count(`select count(*) from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(session)};`, "race_c1_verify");
    const audits = await count(`select count(*) from office_az_inventory_mobile_private.audit_events where actor_id = ${lit(f.actor)};`, "race_c1_verify");
    return {
      id: "C1",
      pids: [held.pid, blocked.pid],
      observer_confirmed: true,
      outcome,
      cardinality: { sessions_added: sessions, audit_rows_added: audits },
      pass: outcome === "invalid_or_stale" && sessions === 0 && audits === 0,
    };
  }));

  // C2 issue-before-revoke: the open issue holds the assignment; revoke waits, then later issue/refresh fail.
  races.push(await withRace("C2", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C2;
    const session = ctx.rawHash();
    const refresh1 = ctx.rawHash();
    const issuer = open("b");
    issuer.write(`${claimPrefix(uid)}begin;\n${rpcCall("issue", [...shared(f), f.device, session, refresh1])}`);
    const held = await waitFor("inv001-d6-c2-b", holding, deadline, "RACE_HOLDER_NOT_READY");
    const revoker = open("a");
    revoker.write(`update office_az_inventory_authority_private.assignments set status = 'revoked' where assignment_id = ${lit(f.assignment)};\n`);
    revoker.end();
    const blocked = await waitFor("inv001-d6-c2-a", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(held.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    issuer.write("commit;\n");
    issuer.end();
    const [issuerResult] = await done([issuer, revoker]);
    const outcome = parseRpcOutcome(issuerResult.lines);
    const sessions = await count(`select count(*) from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(session)};`, "race_c2_verify");
    const audits = await count(`select count(*) from office_az_inventory_mobile_private.audit_events where actor_id = ${lit(f.actor)} and operation = 'issue';`, "race_c2_verify");
    const status = await ctx.sql(`select status from office_az_inventory_authority_private.assignments where assignment_id = ${lit(f.assignment)};`, "race_c2_verify");
    const follow = ctx.session({ step: "race_c2_follow", appName: "inv001-d6-c2-follow" });
    follow.write(`${claimPrefix(uid)}${rpcCall("refresh", [...shared(f), session, refresh1, 1, ctx.rawHash()])}${rpcCall("issue", [...shared(f), f.device, ctx.rawHash(), ctx.rawHash()])}`);
    follow.end();
    const followResult = await follow.done;
    const followOutcomes = followResult.lines.filter((line) => line.startsWith("R:")).map((line) => parseRpcOutcome([line]));
    return {
      id: "C2",
      pids: [held.pid, blocked.pid],
      observer_confirmed: true,
      outcome,
      cardinality: { sessions: sessions, issue_audit_rows: audits, follow_up: followOutcomes },
      pass: outcome === "accepted" && sessions === 1 && audits === 1 && status === "revoked"
        && followResult.exitCode === 0
        && followOutcomes.length === 2 && followOutcomes.every((value) => value === "invalid_or_stale"),
    };
  }));

  // C3 grant-delete vs issue: the issue capability grant row is deleted under an open transaction.
  races.push(await withRace("C3", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C3;
    const session = ctx.rawHash();
    const holder = open("a");
    holder.write(`begin;\ndelete from office_az_inventory_authority_private.capability_grants where assignment_id = ${lit(f.assignment)} and capability = 'inventory.session.issue';\n`);
    const held = await waitFor("inv001-d6-c3-a", holding, deadline, "RACE_HOLDER_NOT_READY");
    const waiter = open("b");
    waiter.write(`${claimPrefix(uid)}${rpcCall("issue", [...shared(f), f.device, session, ctx.rawHash()])}`);
    waiter.end();
    const blocked = await waitFor("inv001-d6-c3-b", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(held.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    holder.write("commit;\n");
    holder.end();
    const [, waiterResult] = await done([holder, waiter]);
    const outcome = parseRpcOutcome(waiterResult.lines);
    const sessions = await count(`select count(*) from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(session)};`, "race_c3_verify");
    return {
      id: "C3",
      pids: [held.pid, blocked.pid],
      observer_confirmed: true,
      outcome,
      cardinality: { sessions_added: sessions },
      pass: outcome === "invalid_or_stale" && sessions === 0,
    };
  }));

  // C4 refresh double-spend: two refreshes of the same (hash, version) released together by an advisory barrier.
  races.push(await withRace("C4", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C4;
    const barrier = 460_001;
    const gate = open("h");
    gate.write(`select pg_advisory_lock(${barrier});\n`);
    const gateState = await waitFor("inv001-d6-c4-h", (s) => s.state === "idle" && s.advisoryGranted === 1, deadline, "RACE_BARRIER_NOT_HELD");
    const first = open("b1");
    const second = open("b2");
    first.write(`select pg_advisory_lock_shared(${barrier});\n${claimPrefix(uid)}${rpcCall("refresh", [...shared(f), f.session, f.refresh1, 1, ctx.rawHash()])}`);
    second.write(`select pg_advisory_lock_shared(${barrier});\n${claimPrefix(uid)}${rpcCall("refresh", [...shared(f), f.session, f.refresh1, 1, ctx.rawHash()])}`);
    first.end();
    second.end();
    const firstBlocked = await waitFor("inv001-d6-c4-b1", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(gateState.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    const secondBlocked = await waitFor("inv001-d6-c4-b2", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(gateState.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    gate.write(`select pg_advisory_unlock(${barrier});\n`);
    gate.end();
    const [, firstResult, secondResult] = await done([gate, first, second]);
    const outcomes = [parseRpcOutcome(firstResult.lines), parseRpcOutcome(secondResult.lines)].sort();
    const version = await count(`select refresh_version from office_az_inventory_mobile_private.sessions where session_id_hash = ${lit(f.session)};`, "race_c4_verify");
    const audits = await count(`select count(*) from office_az_inventory_mobile_private.audit_events where session_id_hash = ${lit(f.session)} and operation = 'refresh';`, "race_c4_verify");
    return {
      id: "C4",
      pids: [firstBlocked.pid, secondBlocked.pid],
      observer_confirmed: true,
      outcome: outcomes.join("+"),
      cardinality: { refresh_version: version, refresh_audit_rows: audits },
      pass: outcomes[0] === "accepted" && outcomes[1] === "invalid_or_stale" && version === 2 && audits === 1
        && firstBlocked.pid !== secondBlocked.pid,
    };
  }));

  // C5 revoke_device vs issue on the same device and assignment.
  races.push(await withRace("C5", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C5;
    const session = ctx.rawHash();
    const revoker = open("a");
    revoker.write(`${claimPrefix(uid)}begin;\n${rpcCall("revoke_device", [...shared(f), f.device])}`);
    const held = await waitFor("inv001-d6-c5-a", holding, deadline, "RACE_HOLDER_NOT_READY");
    const issuer = open("b");
    issuer.write(`${claimPrefix(uid)}${rpcCall("issue", [...shared(f), f.device, session, ctx.rawHash()])}`);
    issuer.end();
    const blocked = await waitFor("inv001-d6-c5-b", (s) => s.waitEventType === "Lock" && s.blockingPids.includes(held.pid), deadline, "RACE_WAITER_NOT_BLOCKED");
    revoker.write("commit;\n");
    revoker.end();
    const [revokerResult, issuerResult] = await done([revoker, issuer]);
    const revokeOutcome = parseRpcOutcome(revokerResult.lines);
    const issueOutcome = parseRpcOutcome(issuerResult.lines);
    const deviceStatus = await ctx.sql(`select status from office_az_inventory_mobile_private.managed_devices where device_id_hash = ${lit(f.device)};`, "race_c5_verify");
    const activeSessions = await count(`select count(*) from office_az_inventory_mobile_private.sessions where device_id_hash = ${lit(f.device)} and revoked_at is null;`, "race_c5_verify");
    return {
      id: "C5",
      pids: [held.pid, blocked.pid],
      observer_confirmed: true,
      outcome: `${revokeOutcome}+${issueOutcome}`,
      cardinality: { device_revoked: deviceStatus === "revoked", active_sessions_on_device: activeSessions },
      pass: revokeOutcome === "accepted" && issueOutcome === "invalid_or_stale"
        && deviceStatus === "revoked" && activeSessions === 0,
    };
  }));

  // C6 characterization: the cookie-path resolver is a lock-free stable snapshot read.
  const c6 = await withRace("C6", async ({ open, deadline, finish: done }) => {
    const f = fixtures.C6;
    const resolverSql = `${claimPrefix(uid)}select 'S:' || coalesce(public.resolve_office_az_inventory_authority(${lit(f.actor)}, ${lit(f.operator)})->'candidates'->0->>'status', 'none');\n`;
    const holder = open("a");
    holder.write(`begin;\nupdate office_az_inventory_authority_private.assignments set status = 'revoked' where assignment_id = ${lit(f.assignment)};\n`);
    await waitFor("inv001-d6-c6-a", holding, deadline, "RACE_HOLDER_NOT_READY");
    const during = open("r1");
    during.write(resolverSql);
    during.end();
    const [duringResult] = await done([during]);
    holder.write("commit;\n");
    holder.end();
    await done([holder]);
    const after = ctx.session({ step: "race_c6_r2", appName: "inv001-d6-c6-r2" });
    after.write(resolverSql);
    after.end();
    const afterResult = await after.done;
    const statusOf = (result) => {
      const line = result.lines.find((value) => value.startsWith("S:"));
      const value = line === undefined ? "none" : line.slice(2);
      return ["active", "suspended", "revoked", "none"].includes(value) ? value : "unexpected";
    };
    return {
      resolver_blocked_by_open_revoke: false,
      status_during_open_revoke: statusOf(duringResult),
      status_after_commit: statusOf(afterResult),
      note: "D4_AUTHORITY_IS_SNAPSHOT_AT_READ_FUTURE_WRITE_PATHS_MUST_RECHECK_AT_WRITE",
    };
  });

  return { races, c6 };
}
