import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const next = require("next/server");
const source = fs.readFileSync(new URL("./middleware.ts",import.meta.url),"utf8");
const noCache = {"Cache-Control":"private, no-cache, no-store, must-revalidate, max-age=0",Expires:"0",Pragma:"no-cache"};
const batch = [{name:"sb-fixture.0",value:"refreshed",options:{path:"/",httpOnly:true,secure:true,sameSite:"none"}},
  {name:"sb-fixture.1",value:"",options:{path:"/",maxAge:0}}];
async function run(url: string, options: {user?:boolean;refresh?:boolean;secondBatch?:boolean;fail?:boolean;env?:Record<string,string>} = {}) {
  const request = new next.NextRequest(url,{headers:{cookie:"sb-fixture.0=stale; sb-fixture.1=stale-chunk; preference=dark","x-pathname":"/spoofed","x-other":"preserve"}});
  const exports: any = {}; let calls=0, seen: any;
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
    exports, Headers, URL, Error, process:{env:{NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:"https://fixture.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"fixture-anon",...options.env}},
    require:(id:string)=>{
      if(id==="next/server")return next;
      if(id==="@supabase/ssr")return {createServerClient:(_url:string,_key:string,c:any)=>{
        seen=c; return {auth:{getUser:async()=>{
          calls++; if(options.fail)throw Error("auth unavailable");
          if(options.refresh){c.cookies.setAll(batch,noCache);if(options.secondBatch)c.cookies.setAll([{name:"second-cookie",value:"second",options:{path:"/"}}],{});}
          return {data:{user:options.user===false?null:{id:"fixture-user"}}};
        }}};
      }};
      throw Error("Unexpected dependency: "+id);
    },
  });
  const response=await exports.middleware(request);
  return {request,response,calls,seen};
}
test("refresh reaches same-request render and browser, retaining path/header/options",async()=>{
  const {request,response,calls,seen}=await run("https://app.test/estimates/new?step=2",{refresh:true});
  assert.equal(calls,1); assert.equal(request.cookies.get("sb-fixture.0").value,"refreshed");
  assert.equal(seen.cookies.getAll().find((c:any)=>c.name==="sb-fixture.0").value,"refreshed");
  assert.match(response.headers.get("x-middleware-request-cookie"),/sb-fixture.0=refreshed/);
  assert.doesNotMatch(response.headers.get("x-middleware-request-cookie"),/stale/);
  assert.match(response.headers.get("x-middleware-request-cookie"),/preference=dark/);
  assert.equal(response.headers.get("x-middleware-request-x-pathname"),"/estimates/new?step=2");
  assert.equal(response.headers.get("x-middleware-request-x-other"),"preserve");
  assert.equal(response.cookies.get("sb-fixture.0").httpOnly,true);
  assert.equal(response.cookies.get("sb-fixture.0").secure,true);
  assert.equal(response.cookies.get("sb-fixture.0").sameSite,"none");
  assert.equal(response.cookies.get("sb-fixture.1").maxAge,0);
  for(const [key,value] of Object.entries(noCache))assert.equal(response.headers.get(key),value);
});
test("multiple refresh batches preserve earlier cookies and no-cache headers",async()=>{
  const {response}=await run("https://app.test/estimates",{refresh:true,secondBatch:true});
  assert.equal(response.cookies.get("sb-fixture.0").value,"refreshed");
  assert.equal(response.cookies.get("sb-fixture.1").maxAge,0);
  assert.equal(response.cookies.get("second-cookie").value,"second");
  for(const [key,value] of Object.entries(noCache))assert.equal(response.headers.get(key),value);
});
test("unauthenticated redirect retains cookie cleanup but no internal request overrides",async()=>{
  const {response}=await run("https://app.test/estimates/new?step=2",{user:false,refresh:true});
  const location=new URL(response.headers.get("location"));
  assert.equal(response.status,307); assert.equal(location.pathname,"/login");
  assert.equal(location.searchParams.get("next"),"/estimates/new?step=2");
  assert.equal(response.cookies.get("sb-fixture.1").maxAge,0);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal(response.headers.get("pragma"),"no-cache");
  assert.equal(response.headers.get("x-middleware-request-cookie"),null);
});
test("public routes retain bypass and similarly named private routes remain protected",async()=>{
  for(const path of ["/login","/auth/confirm","/api/example","/s/e/example"]){
    const result=await run("https://app.test"+path,{user:false}); assert.equal(result.calls,0);assert.equal(result.response.status,200);
  }
  const result=await run("https://app.test/login-private",{user:false});assert.equal(result.calls,1);assert.equal(result.response.status,307);
});
test("no refresh keeps existing cookies and genuine getUser failure never passes",async()=>{
  const {response,calls}=await run("https://app.test/estimates");assert.equal(calls,1);
  assert.equal(response.cookies.getAll().length,0);assert.match(response.headers.get("x-middleware-request-cookie"),/stale/);
  await assert.rejects(run("https://app.test/estimates",{fail:true}),/auth unavailable/);
});
test("Preview policy and missing-config production redirect are retained",async()=>{
  const preview=await run("https://app.test/estimates",{env:{VERCEL_ENV:"preview"}});
  assert.equal(preview.seen.cookieOptions.sameSite,"none");assert.equal(preview.seen.cookieOptions.secure,true);
  const local=await run("https://app.test/estimates");assert.equal(local.seen.cookieOptions,undefined);
  const missing=await run("https://app.test/estimates",{env:{NEXT_PUBLIC_SUPABASE_URL:""}});
  assert.equal(missing.calls,0);assert.equal(missing.response.status,307);
});
