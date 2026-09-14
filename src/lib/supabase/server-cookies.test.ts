import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const { RequestCookies, ResponseCookies } = require("next/dist/server/web/spec-extension/cookies");
const { RequestCookiesAdapter } = require("next/dist/server/web/spec-extension/adapters/request-cookies");
const source = fs.readFileSync(new URL("./server.ts", import.meta.url), "utf8");
async function client(store: any, env: Record<string, string> = {}) {
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {
    exports, Error, process: {env: {NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY:"fixture-anon", ...env}},
    require: (id: string) => {
      if(id === "next/headers") return {cookies: async () => store};
      if(id === "@supabase/ssr") return {createServerClient: (_url: string, _key: string, options: any) => options};
      throw Error("Unexpected dependency: " + id);
    },
  });
  return exports.createClient();
}
const updates = [{name:"sb-fixture.0",value:"new-session",options:{httpOnly:true,sameSite:"lax",path:"/"}},
  {name:"sb-fixture.1",value:"",options:{maxAge:0,path:"/"}}];
test("actual Next read-only RSC cookies reject writes without an escaping exception", async () => {
  const store = RequestCookiesAdapter.seal(new RequestCookies(new Headers({cookie:"sb-fixture.0=old-session"})));
  assert.throws(() => store.set("probe","value"), /Cookies can only be modified/);
  const c = await client(store);
  assert.doesNotThrow(() => c.cookies.setAll(updates));
  assert.equal(c.cookies.getAll()[0].value,"old-session");
});
test("writable Action/Route Handler cookies retain all values/options and chunk deletion", async () => {
  const headers = new Headers(), store = new ResponseCookies(headers);
  const c = await client(store); c.cookies.setAll(updates);
  assert.equal(store.get("sb-fixture.0").value,"new-session");
  assert.equal(store.get("sb-fixture.0").httpOnly,true);
  assert.equal(store.get("sb-fixture.1").maxAge,0);
  assert.match(headers.get("set-cookie")!,/HttpOnly/);
});
test("unrelated cookie failures and non-Error throws are never suppressed", async () => {
  for(const failure of [new Error("storage failure"), new TypeError("invalid cookie"), "unknown failure"]){
    const c = await client({getAll:()=>[],set:()=>{throw failure;}});
    assert.throws(()=>c.cookies.setAll(updates),(actual:unknown)=>actual===failure);
  }
});
test("missing configuration remains fail-closed", async () => {
  await assert.rejects(client({},{NEXT_PUBLIC_SUPABASE_URL:""}), /not configured/);
});
test("Preview Secure/None and local default cookie policies remain unchanged", async () => {
  assert.equal((await client({})).cookieOptions,undefined);
  const c = await client({}, {VERCEL_ENV:"preview"});
  assert.equal(c.cookieOptions.sameSite,"none"); assert.equal(c.cookieOptions.secure,true);
});
