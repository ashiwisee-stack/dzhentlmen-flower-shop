import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('cookie-free transport binds challenges, omits cookies and rejects cross-origin requests',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'auth-transport-'));
 const originalFetch=globalThis.fetch;
 try {
  const modules={};
  for(const [name,path] of Object.entries({server:'lib/auth-transport.ts',client:'lib/customer-session-client.ts'})){
   const out=join(dir,name+'.mjs');
   await build({entryPoints:[resolve(path)],outfile:out,bundle:true,platform:'node',format:'esm'});
   modules[name]=await import(pathToFileURL(out));
  }
  const token=crypto.randomUUID()+crypto.randomUUID(),challenge=crypto.randomUUID()+crypto.randomUUID();
  const headers=new Headers({'x-auth-mode':'token',cookie:'dm_customer='+token});
  assert.equal(modules.server.sessionToken(headers),'');
  headers.set('authorization','Bearer '+token);
  assert.equal(modules.server.sessionToken(headers),token);
  headers.delete('authorization');headers.set('authorization','Bearer invalid');
  assert.equal(modules.server.sessionToken(headers),'');
  const req=new Request('https://shop.test/api/auth/call',{headers:{'x-auth-mode':'token','x-auth-challenge':challenge,cookie:'dm_call_challenge=other'}});
  assert.equal(modules.server.challengeToken(req,'dm_call_challenge'),challenge);
  const storage=new Map();
  globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  globalThis.window={location:{origin:'https://shop.test'}};
  const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json(calls.length===1?{challengeToken:challenge}:calls.length===2?{authToken:token,clearChallenge:true}:{});};
  await modules.client.customerFetch('/api/auth/call',{method:'POST'});
  await modules.client.customerFetch('/api/auth/call',{method:'POST'});
  await modules.client.customerFetch('/api/auth');
  assert.ok(calls.every(c=>c.init.credentials==='omit'));
  assert.equal(calls[1].init.headers.get('x-auth-challenge'),challenge);
  assert.equal(calls[2].init.headers.get('authorization'),'Bearer '+token);
  assert.equal(storage.has('dm_challenge_call'),false);
  await assert.rejects(modules.client.customerFetch('https://other.test/api/auth'));
  assert.equal(calls.length,3);
  await modules.client.customerFetch('/api/auth',{method:'DELETE'});
  assert.equal(storage.has('dm_session_token'),false);
  modules.client.setAuthMode('cookie');
  await modules.client.customerFetch('/api/auth');
  assert.equal(calls.at(-1).init.credentials,'same-origin');
  assert.equal(calls.at(-1).init.headers.get('authorization'),null);
 } finally {globalThis.fetch=originalFetch;delete globalThis.window;delete globalThis.sessionStorage;await rm(dir,{recursive:true,force:true});}
});
