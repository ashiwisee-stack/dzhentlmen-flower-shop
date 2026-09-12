import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// The actual API modules run against SQLite with D1's atomic batch semantics.
// No HTTP listener, external provider or browser is started.
test('SMS.RU call login requires provider confirmation, browser binding and one-time consumption', async () => {
  const sqlite=new DatabaseSync(':memory:');
  for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(await readFile('drizzle/'+file,'utf8'));
  sqlite.exec('PRAGMA foreign_keys=ON');
  class Statement {
    constructor(sql,args=[]){this.sql=sql;this.args=args;}
    bind(...args){return new Statement(this.sql,args);}
    values(){const s=sqlite.prepare(this.sql);return s.all(...this.args);}
    async first(column){const row=this.values()[0];return column?row?.[column]??null:row??null;}
    async all(){const results=this.values();return {results,success:true,meta:{changes:sqlite.prepare('SELECT changes() AS n').get().n}};}
    async raw(){const s=sqlite.prepare(this.sql);s.setReturnArrays(true);return s.all(...this.args);}
    async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {results:[],success:true,meta:{changes:Number(r.changes)}};}
  }
  let beforeBatch=null;
  const DB={prepare(sql){return new Statement(sql);},async batch(statements){if(beforeBatch){const action=beforeBatch;beforeBatch=null;action();}sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
  globalThis.__shopTestEnv={DB,ADMIN_PASSWORD:'test-admin-password-123456',ADMIN_SESSION_SECRET:'test-admin-session-secret-1234567890123456789',CUSTOMER_AUTH_SECRET:'test-customer-secret-1234567890123456789012',SMS_DEV_MODE:'1'};
  globalThis.__shopTestHeaders=new Headers();
  const dir=await mkdtemp(join(tmpdir(),'flower-api-tests-'));
  const api={};
  try {
    for(const [name,path] of Object.entries({call:'app/api/auth/call/route.ts',sms:'lib/sms.ts'})) {
      const out=join(dir,name+'.mjs');
      await build({entryPoints:[resolve(path)],outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'test-runtime',setup(b){
        b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
        b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'mock'}));
        b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));
        b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='env'?'export const env=globalThis.__shopTestEnv;':args.path==='headers'?'export async function headers(){return globalThis.__shopTestHeaders;}':'export function redirect(){throw new Error("redirect");}'}));
      }}]});
      api[name]=await import(pathToFileURL(out));
    }

    const env=globalThis.__shopTestEnv;
    const request=(body,cookie='',origin='http://localhost')=>new Request('http://localhost/api/auth/call',{method:'POST',headers:{'content-type':'application/json',origin,cookie},body:JSON.stringify(body)});
    const post=async(body,cookie='',origin)=>{const response=await api.call.POST(request(body,cookie,origin));return {response,body:await response.json(),status:response.status};};
    const originalFetch=globalThis.fetch;
    let adds=0,checks=0,providerStatus=400,providerError=false,networkError=false,malformed=false;
    globalThis.fetch=async(url,options)=>{
      assert.equal(options.method,'POST');
      assert.equal(options.body.get('api_id'),'test-call-key');
      assert.ok(!String(url).includes('test-call-key'));
      if(String(url).endsWith('/add')) {
        adds++;assert.match(options.body.get('phone'),/^7\d{10}$/);
        if(networkError)throw new Error('private-provider-error');
        if(providerError)return Response.json({status:'ERROR',status_code:201,status_text:'private-provider-error'});
        return Response.json({status:'OK',status_code:100,check_id:'test-'+adds,call_phone:malformed?'javascript:alert(1)':'78005008275'});
      }
      assert.equal(String(url),'https://sms.ru/callcheck/status');checks++;
      return Response.json({status:'OK',status_code:100,check_status:String(providerStatus)});
    };
    const start={action:'start',name:'Анна',phone:'+79991234567',consent:true};
    const unlock=()=>sqlite.exec('UPDATE call_auth SET next_check_at=0');
    const clear=()=>sqlite.exec('DELETE FROM call_auth; DELETE FROM rate_limits;');
    const browser=r=>r.response.headers.get('set-cookie').split(';')[0];
    try {
      assert.equal((await post({action:'current'})).body.ready,false);
      assert.equal((await post(start)).status,400);assert.equal(adds,0);
      env.SMS_RU_API_ID='test-call-key';env.SMS_RU_CALLCHECK_ENABLED='1';
      assert.equal(api.sms.smsReady(),false,'call key alone must not enable paid SMS');
      await assert.rejects(api.sms.sendCode('+79991234567','123456')); 
      env.SMS_RU_CALLCHECK_ALLOWED_PHONES='79991234567';
      assert.equal((await post({...start,consent:false})).status,400);
      assert.equal((await post({...start,phone:'+7999123456'})).status,400);
      assert.equal((await post({...start,phone:'+79991234568'})).status,400);
      assert.equal((await post(start,'','https://other.example')).status,400);assert.equal(adds,0);
      const first=await post(start);assert.equal(first.status,200,JSON.stringify(first.body));
      const cookie=browser(first);
      assert.match(first.response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
      assert.equal(first.response.headers.get('cache-control'),'no-store');
      assert.equal(first.body.challenge.callPhone,'+78005008275');
      assert.equal(first.body.check_id,undefined);assert.equal(adds,1);
      assert.equal((await post(start,cookie)).status,200);assert.equal(adds,1,'retry in same browser reuses challenge');
      assert.equal((await post(start)).status,400);assert.equal(adds,1,'another browser cannot replace attempt');
      assert.equal((await post({action:'current'},cookie)).body.challenge.phone,start.phone);
      assert.equal((await post({action:'current'})).body.challenge,null);
      assert.equal((await post({action:'check',check_id:'test-1',check_status:401})).status,400);
      let r=await post({action:'check',check_status:401},cookie);
      assert.equal(r.body.pending,true);assert.equal(checks,1);
      await post({action:'check'},cookie);assert.equal(checks,1,'provider polling is throttled in database');
      assert.equal(sqlite.prepare('SELECT count(*) n FROM customer_sessions').get().n,0);
      providerStatus=999;unlock();r=await post({action:'check'},cookie);assert.equal(r.status,400);
      assert.equal(sqlite.prepare('SELECT count(*) n FROM customer_sessions').get().n,0);
      providerStatus=401;unlock();r=await post({action:'check'},cookie);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.ok,true);
      const sessionCount=()=>sqlite.prepare('SELECT count(*) n FROM customer_sessions').get().n;
      assert.equal(sessionCount(),1);
      assert.equal(sqlite.prepare('SELECT phone FROM customers').get().phone,start.phone);
      assert.equal(sqlite.prepare("SELECT count(*) n FROM consent_events WHERE purpose='call-login'").get().n,1);
      assert.ok(r.response.headers.getSetCookie().some(s=>s.startsWith('dm_customer=')));
      assert.equal((await post({action:'check'},cookie)).status,400);assert.equal(sessionCount(),1,'confirmation cannot replay');
      clear();const second=await post(start);const secondCookie=browser(second);
      unlock();assert.equal((await post({action:'check'},secondCookie)).status,200);
      assert.equal(sqlite.prepare('SELECT count(*) n FROM customers').get().n,1,'same phone reuses existing account');
      clear();const expired=await post(start);providerStatus=402;
      r=await post({action:'check'},browser(expired));assert.equal(r.body.expired,true);assert.equal(sessionCount(),2);
      clear();const locallyExpired=await post(start);sqlite.exec('UPDATE call_auth SET expires=0');
      const prevChecks=checks;providerStatus=401;
      assert.equal((await post({action:'check'},browser(locallyExpired))).body.expired,true);assert.equal(checks,prevChecks);
      clear();const cancel=await post(start);await post({action:'cancel'},browser(cancel));
      assert.equal((await post({action:'check'},browser(cancel))).status,400);
      clear();const race=await post(start);beforeBatch=()=>sqlite.exec('DELETE FROM call_auth');
      assert.equal((await post({action:'check'},browser(race))).status,400);assert.equal(sessionCount(),2,'cancel during provider request cannot create session');
      clear();providerError=true;const failure=await post(start);assert.equal(failure.status,400);assert.ok(!JSON.stringify(failure.body).includes('private-provider-error'));
      let previousAdds=adds;await post(start,browser(failure));assert.equal(adds,previousAdds,'uncertain or failed attempts are not automatically recreated');providerError=false;
      clear();networkError=true;r=await post(start);assert.equal(r.status,400);assert.ok(!JSON.stringify(r.body).includes('private-provider-error'));networkError=false;
      clear();malformed=true;r=await post(start);assert.equal(r.status,400);assert.ok(!JSON.stringify(r.body).includes('javascript:'));malformed=false;
      clear();env.SMS_RU_CALLCHECK_ALLOWED_PHONES='';env.SMS_RU_CALLCHECK_DAILY_LIMIT='1';
      assert.equal((await post(start)).status,200);previousAdds=adds;
      assert.equal((await post({...start,phone:'+79991234568'})).status,400);assert.equal(adds,previousAdds,'global daily cap prevents provider creation');
      assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
    } finally {globalThis.fetch=originalFetch;}
  } finally {sqlite.close();await rm(dir,{recursive:true,force:true});delete globalThis.__shopTestEnv;delete globalThis.__shopTestHeaders;}
});
