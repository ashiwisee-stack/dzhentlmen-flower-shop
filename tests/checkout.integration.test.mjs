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
test('checkout, auth, bonuses and payment callbacks preserve their invariants', async () => {
  const sqlite=new DatabaseSync(':memory:');
  for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(await readFile('drizzle/'+file,'utf8'));
  sqlite.exec('PRAGMA foreign_keys=ON');
  class Statement {
    constructor(sql,args=[]){this.sql=sql;this.args=args;}
    bind(...args){assert.ok(args.length<=100, `D1 bound parameter limit exceeded: ${args.length}`);return new Statement(this.sql,args);}
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
    for(const [name,path] of Object.entries({paymentApi:'app/api/payment/route.ts',editor:'lib/product-editor.ts',phone:'lib/phone.ts',recent:'lib/recent-orders.ts',uploads:'app/api/uploads/route.ts',bonuses:'lib/bonuses.ts',fiscal:'lib/fiscal.ts',refund:'app/api/payment/refund/route.ts',rules:'lib/shop-rules.ts',payments:'lib/payments.ts',store:'app/api/store/route.ts',auth:'app/api/auth/route.ts',orders:'app/api/orders/route.ts',delivery:'app/api/delivery/route.ts',admin:'app/api/admin/session/route.ts',settings:'app/api/admin/data/route.ts',products:'app/api/products/route.ts',result:'app/api/payment/result/route.ts',tgAuth:'app/api/auth/telegram/route.ts',tgWebhook:'app/api/telegram/webhook/route.ts',telegram:'lib/telegram.ts',deliveryLib:'lib/delivery.ts'})) {
      const out=join(dir,name+'.mjs');
      await build({entryPoints:[resolve(path)],outfile:out,bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'test-runtime',setup(b){
        b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));
        b.onResolve({filter:/^next\/headers$/},()=>({path:'headers',namespace:'mock'}));
        b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));
        b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='env'?'export const env=globalThis.__shopTestEnv;':args.path==='headers'?'export async function headers(){return globalThis.__shopTestHeaders;}':'export function redirect(){throw new Error("redirect");}'}));
      }}]});
      api[name]=await import(pathToFileURL(out));
    }
    const schedule={leadTimeHours:2,deliveryOpen:'08:00',deliveryClose:'00:00'};
    const now=Date.parse('2026-09-05T10:00:00+05:00');
    assert.throws(()=>api.rules.validateSlot('2026-09-05','11:59','delivery',schedule,now));
    assert.doesNotThrow(()=>api.rules.validateSlot('2026-09-05','12:00','delivery',schedule,now));
    assert.throws(()=>api.rules.validateSlot('2026-09-06','07:59','delivery',schedule,now));
    assert.throws(()=>api.rules.validateSlot('2026-09-31','12:00','delivery',schedule,now));
    assert.doesNotThrow(()=>api.rules.validateSlot('2026-09-06','02:00','pickup',schedule,now));
    const receipt=api.payments.receiptItems([{productName:'Букет',variantName:'S',price:2990,quantity:3},{productName:'Роза',variantName:'',price:350,quantity:2}],2899,330,'none','full_prepayment');
    assert.equal(receipt.reduce((sum,item)=>sum+Math.round(item.sum*100),0),(2990*3+350*2-2899+330)*100);
    assert.equal(api.payments.refundReceiptItems(receipt).reduce((s,i)=>s+Math.round(i.Cost*100)*i.Quantity,0),(2990*3+350*2-2899+330)*100);
    assert.equal(api.payments.paymentReady(),false);
    const request=(path,body)=>new Request('http://localhost'+path,{method:'POST',headers:{'content-type':'application/json','origin':'http://localhost'},body:JSON.stringify(body)});
    const decode=async response=>({status:response.status,body:await response.json(),response});
    const store=await decode(await api.store.GET());assert.equal(store.body.storageUnavailable,undefined);
    const product=store.body.products.find(p=>p.available);
    const variant=product.variants.find(v=>v.available);
    const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    const payload={requestKey:crypto.randomUUID(),accessToken:crypto.randomUUID(),customerName:'Анна',phone:'+79991234567',fulfillment:'pickup',branchId:'kraulya',address:'Остаток адреса доставки',apartment:'12',entrance:'3',floor:'5',intercom:'99',deliveryToken:'stale-token',deliveryDate:date,deliveryTime:'02:00',consent:true,offerAccepted:true,bonusSpend:0,expectedTotal:variant.price,items:[{productId:product.id,variantId:variant.id,quantity:1,extras:[]}]};
    const unavailable=await decode(await api.orders.POST(request('/api/orders',{...payload,paymentMethod:'online'})));
    assert.equal(unavailable.status,400,'unconfigured online payment must not silently switch to receipt');
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,0);
    let r=await decode(await api.orders.POST(request('/api/orders',payload)));assert.equal(r.status,201,JSON.stringify(r.body));
    const firstId=r.body.id;
    const pickupRow=sqlite.prepare('SELECT address,delivery_price,delivery_details FROM orders WHERE id=?').get(firstId);
    assert.equal(pickupRow.address,'');assert.equal(pickupRow.delivery_price,0);
    const pickupDetails=JSON.parse(pickupRow.delivery_details);
    assert.equal(pickupDetails.paymentTest,false,'offline order is never a test Robokassa order');
    for(const key of ['apartment','entrance','floor','intercom']) assert.equal(pickupDetails[key],'','pickup drops stale delivery instructions');
    r=await decode(await api.orders.POST(request('/api/orders',payload)));assert.equal(r.body.id,firstId);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
    r=await decode(await api.orders.POST(request('/api/orders',{...payload,expectedTotal:1})));assert.equal(r.status,409);
    r=await decode(await api.orders.POST(request('/api/orders',{...payload,requestKey:crypto.randomUUID(),expectedTotal:1})));assert.equal(r.status,400);
    const code=await decode(await api.auth.POST(request('/api/auth',{action:'request-code',phone:payload.phone,name:'Анна'})));assert.equal(code.status,200,JSON.stringify(code.body));assert.match(code.body.devCode,/^\d{6}$/);
    const login=await decode(await api.auth.POST(request('/api/auth',{action:'verify-code',phone:payload.phone,code:code.body.devCode})));assert.equal(login.status,200,JSON.stringify(login.body));
    const customerId=login.body.customer.id,customerCookie=login.response.headers.get('set-cookie').split(';')[0];
    r=await decode(await api.auth.POST(request('/api/auth',{action:'verify-code',phone:payload.phone,code:code.body.devCode})));assert.equal(r.status,400,'one-time code must not replay');
    globalThis.__shopTestHeaders=new Headers({cookie:customerCookie});
    sqlite.prepare('UPDATE customers SET bonus_balance=1000 WHERE id=?').run(customerId);
    const bonusPayload={...payload,requestKey:crypto.randomUUID(),bonusSpend:500,expectedTotal:variant.price-500};
    beforeBatch=()=>sqlite.prepare('UPDATE customers SET bonus_balance=100 WHERE id=?').run(customerId);
    const raced=await decode(await api.orders.POST(request('/api/orders',{...bonusPayload,requestKey:crypto.randomUUID()})));
    assert.equal(raced.status,400,'spend rechecks balance inside the atomic batch');
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,100);
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,1);
    sqlite.prepare('UPDATE customers SET bonus_balance=1000 WHERE id=?').run(customerId);
    const order=await decode(await api.orders.POST(request('/api/orders',bonusPayload)));assert.equal(order.status,201,JSON.stringify(order.body));
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,500);
    const admin=await decode(await api.admin.POST(request('/api/admin/session',{password:globalThis.__shopTestEnv.ADMIN_PASSWORD})));assert.equal(admin.status,200);
    globalThis.__shopTestHeaders=new Headers({cookie:admin.response.headers.get('set-cookie').split(';')[0]});
    const patch=async(status,version)=>decode(await api.orders.PATCH(request('/api/orders',{id:order.body.id,status,version})));
    assert.equal((await patch('cancelled',0)).status,200);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,1000);
    assert.equal((await patch('confirmed',1)).status,400,'cancelled orders cannot reopen');
    assert.equal((await patch('cancelled',1)).status,200);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,1000,'no double refund');
    globalThis.__shopTestHeaders=new Headers({cookie:customerCookie});
    const earnedOrder=await decode(await api.orders.POST(request('/api/orders',{...bonusPayload,requestKey:crypto.randomUUID()})));
    assert.equal(earnedOrder.status,201);
    globalThis.__shopTestHeaders=new Headers({cookie:admin.response.headers.get('set-cookie').split(';')[0]});
    for(const [version,status] of ['confirmed','assembling','ready','completed'].entries()) {
      const changed=await decode(await api.orders.PATCH(request('/api/orders',{id:earnedOrder.body.id,status,version})));
      assert.equal(changed.status,200,JSON.stringify(changed.body));
    }
    const earned=Math.floor((variant.price-500)*.05);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,500+earned);
    assert.equal((await decode(await api.orders.PATCH(request('/api/orders',{id:earnedOrder.body.id,status:'completed',version:4})))).status,200);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,500+earned);
    assert.equal((await decode(await api.orders.PATCH(request('/api/orders',{id:earnedOrder.body.id,status:'completed',version:0})))).status,409);
    const hidden=await decode(await api.products.PATCH(request('/api/products',{...product,hidden:true})));assert.equal(hidden.status,200,JSON.stringify(hidden.body));
    globalThis.__shopTestHeaders=new Headers();
    assert.equal((await decode(await api.orders.POST(request('/api/orders',{...payload,requestKey:crypto.randomUUID()})))).status,400,'hidden product rejected');
    const quote=await decode(await api.delivery.POST(request('/api/delivery',{address:'ул. Токарей, 33',coordinates:[56.829384,60.562656]})));assert.equal(quote.status,200,JSON.stringify(quote.body));
    assert.equal(quote.body.method,'estimate');assert.ok(quote.body.token);
    assert.equal((await decode(await api.delivery.POST(request('/api/delivery',{address:'Другой город',coordinates:[55.75,37.61]})))).status,400);
    // A failed item insert rolls the order and atomically debited bonus back together.
    const balanceBefore=sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b;
    await assert.rejects(DB.batch([...api.bonuses.spendBonuses(customerId,"rollback",500,"rollback"),DB.prepare("INSERT INTO orders(id,order_number,customer_id,customer_name,phone,fulfillment,delivery_date,total,bonus_spent) VALUES('rollback','rollback',?,'А','+79991234567','pickup','2027-01-01',3000,500)").bind(customerId),DB.prepare("INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES('rollback',1,NULL,100,1)")]));
    assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM orders WHERE id='rollback'").get().n,0);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,balanceBefore);
    // The map tariff is computed on the server, including its free radius.
    const freeQuote=await api.deliveryLib.quoteDelivery('Крауля, 105/3',[56.831251,60.523849]);
    assert.equal(freeQuote.price,0);
    assert.equal(freeQuote.distanceKm,0,'same point must not acquire an artificial one-kilometre distance');
    assert.equal(freeQuote.branch.id,'kraulya');
    assert.equal((await api.deliveryLib.verifyQuote(freeQuote.token,freeQuote.address)).price,0);
    await assert.rejects(api.deliveryLib.verifyQuote(freeQuote.token,'Другой адрес'));
    await assert.rejects(api.deliveryLib.verifyQuote(freeQuote.token+'tampered',freeQuote.address));
    sqlite.prepare("INSERT INTO store_settings(key,value) VALUES('deliveryBase','100') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
    await assert.rejects(api.deliveryLib.verifyQuote(freeQuote.token,freeQuote.address),/Тариф доставки изменился/);
    sqlite.prepare("DELETE FROM store_settings WHERE key='deliveryBase'").run();
    const farQuote=await api.deliveryLib.quoteDelivery('Тестовая улица, 1',[56.87,60.65]);
    assert.equal(farQuote.price,Math.round(Math.max(0,farQuote.distanceKm-2)*50));
    assert.equal(store.body.settings.bonusMaxSpendPercent,50);
    // A delivery persists the selected address, quote and optional access details together.
    sqlite.prepare('UPDATE products SET hidden=0 WHERE id=?').run(product.id);
    const delivered=await decode(await api.orders.POST(request('/api/orders',{...payload,requestKey:crypto.randomUUID(),fulfillment:'delivery',address:farQuote.address,deliveryToken:farQuote.token,deliveryTime:'12:00',expectedTotal:variant.price+farQuote.price})));
    assert.equal(delivered.status,201,JSON.stringify(delivered.body));
    const deliveryRow=sqlite.prepare('SELECT address,branch_id,delivery_price,delivery_details FROM orders WHERE id=?').get(delivered.body.id);
    assert.equal(deliveryRow.address,farQuote.address);assert.equal(deliveryRow.delivery_price,farQuote.price);assert.equal(deliveryRow.branch_id,farQuote.branch.id);
    assert.equal(JSON.parse(deliveryRow.delivery_details).apartment,'12');assert.equal(JSON.parse(deliveryRow.delivery_details).distanceKm,farQuote.distanceKm);
    globalThis.__shopTestHeaders=new Headers({cookie:admin.response.headers.get('set-cookie').split(';')[0]});
    const roadSettings=await decode(await api.settings.PATCH(request('/api/admin/data',{entity:'settings',values:{deliveryMode:'road'}})));
    assert.equal(roadSettings.status,400,'admin cannot enable road pricing without a router');
    const diagnostics=await decode(await api.settings.GET(new Request('http://localhost/api/admin/data')));
    assert.equal(diagnostics.status,200);assert.ok(diagnostics.body.paymentSetup.missing.includes('ROBOKASSA_PASSWORD1'));
    assert.equal(JSON.stringify(diagnostics.body.paymentSetup).includes('test-admin-password'),false);
    globalThis.__shopTestHeaders=new Headers();
    // Road prices use a single directional matrix, not a straight-line fallback.
    sqlite.prepare("INSERT INTO store_settings(key,value) VALUES('deliveryMode','\"road\"') ON CONFLICT(key) DO UPDATE SET value=excluded.value").run();
    globalThis.__shopTestEnv.ROUTER_URL='https://router.example.test/';
    const routeFetch=globalThis.fetch;let routeCalls=0;
    globalThis.fetch=async(input)=>{
      routeCalls++;const url=new URL(input);
      assert.match(url.pathname,/table\/v1\/driving/);
      assert.equal(url.searchParams.get('sources'),'0;1');assert.equal(url.searchParams.get('destinations'),'2');
      assert.equal(url.searchParams.get('annotations'),'distance');
      return Response.json({code:'Ok',distances:[[6748.9],[3863.4]]});
    };
    try {
      const road=await api.deliveryLib.quoteDelivery('Публичная точка',[56.8368,60.6122]);
      assert.equal(routeCalls,1);assert.equal(road.method,'road');assert.equal(road.branch.id,'tokarey');assert.equal(road.distanceKm,3.9);assert.equal(road.price,95);
      globalThis.fetch=async()=>Response.json({code:'Ok',distances:[[null],[2100]]});
      assert.equal((await api.deliveryLib.quoteDelivery('Публичная точка',[56.8368,60.6122])).price,5);
      globalThis.fetch=async()=>Response.json({code:'Ok',distances:[[null],[null]]});
      await assert.rejects(api.deliveryLib.quoteDelivery('Публичная точка',[56.8368,60.6122]),/маршрут/);
      globalThis.fetch=async()=>{throw new Error('timeout')};
      await assert.rejects(api.deliveryLib.quoteDelivery('Публичная точка',[56.8368,60.6122]),/маршрут/);
      globalThis.__shopTestEnv.ROUTER_URL='https://routing.openstreetmap.de/routed-car/';
      globalThis.fetch=async()=>Response.json({code:'Ok',distances:[[6748.9],[3863.4]]});
      await api.deliveryLib.quoteDelivery('Публичная точка',[56.8368,60.6122]);
      await assert.rejects(api.deliveryLib.quoteDelivery('Другая точка',[56.837,60.613]),/пару секунд/);
    } finally {globalThis.fetch=routeFetch;delete globalThis.__shopTestEnv.ROUTER_URL;sqlite.prepare("UPDATE store_settings SET value='\"estimate\"' WHERE key='deliveryMode'").run();}
    // Telegram: own contact, browser binding, expiry and one-time consumption.
    Object.assign(globalThis.__shopTestEnv,{TELEGRAM_BOT_TOKEN:'fake-token',TELEGRAM_BOT_USERNAME:'test_bot',PUBLIC_ORIGIN:'https://shop.example.test'});
    const previousFetch=globalThis.fetch;
    globalThis.fetch=async()=>Response.json({ok:true,result:{username:'test_bot'}});
    try {
      const start=await decode(await api.tgAuth.POST(request('/api/auth/telegram',{action:'start',consent:true})));
      assert.equal(start.status,200,JSON.stringify(start.body));
      const tgCookie=start.response.headers.get('set-cookie').split(';')[0];
      const startToken=new URL(start.body.url).searchParams.get('start');
      const webhook=async(message,secret=null)=>api.tgWebhook.POST(new Request('http://localhost/api/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':secret??await api.telegram.webhookSecret()},body:JSON.stringify({message})}));
      const message={chat:{id:10001,type:'private'},from:{id:10001,first_name:'Анна'}};
      assert.equal((await webhook({...message,text:'/start '+startToken},'wrong')).status,403);
      assert.equal((await webhook({...message,text:'/start '+startToken})).status,200);
      const check=()=>api.tgAuth.POST(new Request('http://localhost/api/auth/telegram',{method:'POST',headers:{origin:'http://localhost',cookie:tgCookie,'content-type':'application/json'},body:JSON.stringify({action:'check'})}));
      assert.equal((await decode(await check())).body.pending,true);
      await webhook({...message,contact:{phone_number:payload.phone,user_id:999}});
      assert.equal((await decode(await check())).body.pending,true,'someone else’s contact must not sign in');
      await webhook({...message,forward_origin:{type:'user'},contact:{phone_number:payload.phone,user_id:10001}});
      assert.equal((await decode(await check())).body.pending,true,'forwarded contact must not sign in');
      await webhook({...message,contact:{phone_number:payload.phone,user_id:10001}});
      assert.equal((await decode(await api.tgAuth.POST(request('/api/auth/telegram',{action:'check'})))).status,400,'another browser cannot consume the login');
      const loggedIn=await decode(await check());assert.equal(loggedIn.status,200,JSON.stringify(loggedIn.body));
      assert.match(loggedIn.response.headers.get('set-cookie'),/dm_customer=/);
      assert.equal((await decode(await check())).status,400,'consumed challenge cannot replay');
      assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM customers WHERE phone=?').get(payload.phone).n,1,'existing phone retains the same account');
      assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM consent_events WHERE purpose='telegram-login'").get().n,1);
      assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM telegram_subscribers').get().n,0,'login never grants staff subscriptions');
      const expired=await decode(await api.tgAuth.POST(request('/api/auth/telegram',{action:'start',consent:true})));
      sqlite.prepare('UPDATE telegram_auth SET expires=0').run();
      await webhook({...message,text:'/start '+new URL(expired.body.url).searchParams.get('start')});
      assert.equal(sqlite.prepare('SELECT customer_id FROM telegram_auth').get().customer_id,null);
    } finally {globalThis.fetch=previousFetch;delete globalThis.__shopTestEnv.TELEGRAM_BOT_TOKEN;}
    Object.assign(globalThis.__shopTestEnv,{ROBOKASSA_ENABLED:'1',ROBOKASSA_TEST:'1',ROBOKASSA_LOGIN:'test-shop',ROBOKASSA_PASSWORD1:'test-password-one',ROBOKASSA_PASSWORD2:'test-result-password',ROBOKASSA_HASH_ALGORITHM:'MD5'});
    assert.equal(api.payments.paymentReady(),true,'test payment does not need invented fiscal settings');
    assert.equal(await api.payments.paymentHash('abc'),'900150983cd24fb0d6963f7d28e17f72');
    const payLink=new URL(await api.payments.paymentUrl({total:2990,robokassaInvoiceId:'101',orderNumber:'TEST-101'},{}));
    assert.equal(payLink.searchParams.get('IsTest'),'1');assert.equal(payLink.searchParams.has('Receipt'),false);
    assert.equal(payLink.searchParams.get('SignatureValue'),await api.payments.paymentHash('test-shop:2990.00:101:test-password-one'));
    const md5=await api.payments.paymentHash(variant.price+'.00:101:test-result-password');
    sqlite.prepare("UPDATE orders SET robokassa_invoice_id='101',payment_status='pending',delivery_details=json_set(delivery_details,'$.paymentTest',json('true')) WHERE id=?").run(firstId);
    assert.equal((await api.result.POST(new Request('http://localhost/api/payment/result',{method:'POST',body:new URLSearchParams({OutSum:variant.price+'.00',InvId:'101',SignatureValue:md5})}))).status,200);
    delete globalThis.__shopTestEnv.ROBOKASSA_HASH_ALGORITHM;
    globalThis.__shopTestEnv.ROBOKASSA_PASSWORD2='test-result-password';
    sqlite.prepare("UPDATE orders SET robokassa_invoice_id='12345',payment_status='pending' WHERE id=?").run(firstId);
    const amount=String(variant.price)+'.000000';
    const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(amount+':12345:test-result-password'))).toString('hex');
    const callback=(sum,sig)=>new Request('http://localhost/api/payment/result',{method:'POST',body:new URLSearchParams({OutSum:sum,InvId:'12345',SignatureValue:sig})});
    assert.equal((await api.result.POST(callback(amount,'bad'))).status,403);
    assert.equal((await api.result.POST(callback(amount,digest))).status,200);
    assert.equal((await api.result.POST(callback(amount,digest))).status,200,'repeated signed callbacks are safe');
    assert.equal(sqlite.prepare('SELECT payment_status s FROM orders WHERE id=?').get(firstId).s,'paid');

    Object.assign(globalThis.__shopTestEnv,{ROBOKASSA_ENABLED:'1',ROBOKASSA_TEST:'0',ROBOKASSA_LOGIN:'test-shop',ROBOKASSA_PASSWORD1:'test-password-one',ROBOKASSA_PASSWORD3:'test-password-three',ROBOKASSA_TAX:'none',ROBOKASSA_SNO:'usn_income',ROBOKASSA_PAYMENT_METHOD:'full_prepayment',PUBLIC_ORIGIN:'https://shop.example.test'});
    sqlite.prepare("UPDATE orders SET status='completed',delivery_details=? WHERE id=?").run(JSON.stringify({fiscal:{tax:'none',sno:'usn_income',method:'full_prepayment'}}),firstId);
    const originalFetch=globalThis.fetch;
    let attaches=0,refundCreates=0;
    globalThis.fetch=async(input,options)=>{
      const url=String(input);
      if(url.includes('/RoboFiscal/Receipt/')) {
        const [body,sig]=String(options.body).split('.');
        const expected=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body+globalThis.__shopTestEnv.ROBOKASSA_PASSWORD1))).toString('hex');
        assert.equal(Buffer.from(sig,'base64').toString(),expected);
        const data=JSON.parse(Buffer.from(body,'base64').toString());
        assert.notEqual(data.id,'12345');
        if(url.endsWith('/Attach')){attaches++;assert.equal(data.total,variant.price);assert.equal(data.items[0].payment_method,'full_payment');return Response.json({ResultCode:'0'});}
        return Response.json({Code:'0',Statuses:[{Code:'Done'}]});
      }
      if(url.includes('OpStateExt'))return new Response('<OperationStateResponse><Result><Code>0</Code></Result><State><Code>100</Code></State><Info><OpKey>test-operation</OpKey></Info></OperationStateResponse>');
      if(url.endsWith('/Refund/Create')){refundCreates++;const payload=JSON.parse(Buffer.from(String(options.body).split('.')[1],'base64url').toString());assert.equal(payload.OpKey,'test-operation');assert.equal(payload.RefundSum,undefined);assert.equal(payload.InvoiceItems.reduce((s,i)=>s+i.Quantity*i.Cost,0),variant.price);return Response.json({success:true,requestId:'test-refund'});}
      if(url.includes('/Refund/GetState'))return Response.json({requestId:'test-refund',amount:variant.price,label:'finished'});
      throw new Error('Unexpected external request '+url);
    };
    try {
      await api.fiscal.processReceipts();
      sqlite.prepare('UPDATE fiscal_jobs SET lease_until=0').run();
      await api.fiscal.processReceipts();
      assert.equal(attaches,1,'second receipt attached only once');
      assert.equal(sqlite.prepare('SELECT status FROM fiscal_jobs WHERE order_id=?').get(firstId).status,'done');
      globalThis.__shopTestHeaders=new Headers({cookie:admin.response.headers.get('set-cookie').split(';')[0]});
      const refund=await decode(await api.refund.POST(request('/api/payment/refund',{id:firstId})));assert.equal(refund.status,200,JSON.stringify(refund.body));
      assert.equal((await decode(await api.refund.POST(request('/api/payment/refund',{id:firstId})))).status,400);
      assert.equal(refundCreates,1);
      assert.equal((await decode(await api.refund.POST(request('/api/payment/refund',{id:firstId,action:'check'})))).status,200);
      assert.equal(sqlite.prepare('SELECT payment_status FROM orders WHERE id=?').get(firstId).payment_status,'refunded');
    } finally {globalThis.fetch=originalFetch;}
    await DB.batch([DB.prepare("UPDATE orders SET status='cancelled' WHERE id=?").bind(earnedOrder.body.id),...api.bonuses.orderBonuses(earnedOrder.body.id,customerId,'cancelled')]);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,1000,'return spent points and revoke earned points together');
    await DB.batch(api.bonuses.orderBonuses(earnedOrder.body.id,customerId,'cancelled'));
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,1000);
    const correction=await decode(await api.settings.PATCH(request('/api/admin/data',{entity:'customer',id:customerId,bonusBalance:321})));
    assert.equal(correction.status,200);
    assert.equal(sqlite.prepare('SELECT bonus_balance b FROM customers WHERE id=?').get(customerId).b,321);

    // September 11 owner corrections: one source of truth for flowers and prices.
    const refreshedStore=await decode(await api.store.GET());
    const singleFlowers=refreshedStore.body.products.filter(p=>p.singleFlower);
    assert.equal(singleFlowers.length,3,'legacy flower extras become real catalog products');
    assert.ok(refreshedStore.body.categories.some(c=>c.slug==='single-flowers'));
    await api.store.GET();
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM products WHERE single_flower=1').get().n,3,'import only once');
    const single=await decode(await api.products.POST(request('/api/products',{
      name:'Одиночная эустома',category:'Одиночные цветы',singleFlower:true,pricingMode:'single',price:275,
      image:'/products/rose-stem.webp',images:['/products/rose-stem.webp'],variants:[],available:true,
    })));
    assert.equal(single.status,201,JSON.stringify(single.body));
    assert.equal(single.body.product.variants[0].id,'one');
    assert.equal(single.body.product.variants[0].price,275);
    assert.equal(single.body.product.acceptsFlowers,false);
    let fresh=await decode(await api.store.GET());
    let extra=fresh.body.settings.extras.find(e=>e.id==='product:'+single.body.product.id);
    assert.equal(extra.price,275);
    assert.equal(fresh.body.settings.extras.filter(e=>e.kind==='flower').length,4);
    const updateSingle=async(values)=>decode(await api.products.PATCH(request('/api/products',{...single.body.product,pricingMode:'single',...values})));
    assert.equal((await updateSingle({price:325})).status,200);
    fresh=await decode(await api.store.GET());
    assert.equal(fresh.body.settings.extras.find(e=>e.id===extra.id).price,325,'catalog change updates bouquet extras');
    assert.equal((await updateSingle({price:275,available:false})).status,200);
    fresh=await decode(await api.store.GET());
    assert.equal(fresh.body.products.find(p=>p.id===single.body.product.id).available,false);
    assert.equal(fresh.body.settings.extras.find(e=>e.id===extra.id).available,false);
    assert.equal((await updateSingle({available:true})).body.product.available,true,'single price stock does not depend on old variant stock');
    assert.equal((await updateSingle({hidden:true})).status,200);
    fresh=await decode(await api.store.GET());
    assert.equal(fresh.body.settings.extras.some(e=>e.id===extra.id),false,'hidden flowers are absent from extras too');
    await updateSingle({hidden:false});
    const off={...product,available:false,variants:product.variants.map(v=>({...v,available:false}))};
    const enabled=api.editor.setProductAvailability(off,true);
    assert.ok(enabled.variants.every(v=>v.available));
    const savedEnabled=await decode(await api.products.PATCH(request('/api/products',enabled)));
    assert.equal(savedEnabled.body.product.available,true,'general availability switch restores fully unavailable product');
    const mixed={...product,variants:product.variants.map((v,i)=>({...v,available:i===0}))};
    assert.equal(api.editor.setProductAvailability(mixed,true).variants[1].available,false,'preserve intentionally unavailable sizes');
    for(const phone of ['+7 (999) 123-45-67','89991234567','9991234567'])assert.equal(api.phone.normalizePhone(phone),'+79991234567');
    for(const phone of ['text','+7999123456','+799912345678','abc9991234567'])assert.equal(api.phone.normalizePhone(phone),'');
    assert.equal(api.phone.phoneDigits('+7 (999) 123-45-67'),'9991234567');
    assert.equal(api.phone.phoneDigits('letters'),'');
    // Rectangular images retain their bytes; no aspect-ratio restrictions on uploads.
    let uploadedBytes=0;
    globalThis.__shopTestEnv.BUCKET={async put(key,stream){uploadedBytes=(await new Response(stream).arrayBuffer()).byteLength;}};
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
    const form=new FormData();form.append('file',new File([png],'wide.png',{type:'image/png'}));
    const upload=await decode(await api.uploads.POST(new Request('http://localhost/api/uploads',{method:'POST',headers:{origin:'http://localhost'},body:form})));
    assert.equal(upload.status,201,JSON.stringify(upload.body));assert.equal(uploadedBytes,png.length);
    delete globalThis.__shopTestEnv.BUCKET;
    // Guest order can be retrieved and paid only with its own token.
    globalThis.__shopTestHeaders=new Headers();
    const guestPayload={...payload,requestKey:crypto.randomUUID(),accessToken:crypto.randomUUID(),expectedTotal:2750,items:[{productId:single.body.product.id,variantId:'one',quantity:10,extras:[]}]};
    const guest=await decode(await api.orders.POST(request('/api/orders',guestPayload)));
    assert.equal(guest.status,201,JSON.stringify(guest.body));
    const refs=[{id:guest.body.id,accessToken:guestPayload.accessToken}];
    const list=await decode(await api.paymentApi.POST(request('/api/payment',{action:'list',orders:refs})));
    assert.equal(list.body.orders[0].id,guest.body.id);assert.equal(list.body.orders[0].total,2750);
    assert.equal(list.body.orders[0].accessHash,undefined);assert.equal(list.body.orders[0].phone,undefined);
    const wrong=await decode(await api.paymentApi.POST(request('/api/payment',{action:'list',orders:[{id:guest.body.id,accessToken:crypto.randomUUID()}]})));
    assert.deepEqual(wrong.body.orders,[]);
    assert.equal((await decode(await api.paymentApi.POST(request('/api/payment',{id:guest.body.id})))).status,404);
    assert.equal((await decode(await api.paymentApi.POST(request('/api/payment',refs[0])))).status,200);
    const receiptChoice=await decode(await api.orders.POST(request('/api/orders',{...guestPayload,requestKey:crypto.randomUUID(),paymentMethod:'on_receipt'})));
    assert.equal(receiptChoice.status,201,JSON.stringify(receiptChoice.body));
    assert.equal(receiptChoice.body.paymentRequired,false,'receipt choice remains receipt even with Robokassa enabled');
    const receiptRow=sqlite.prepare('SELECT payment_status,robokassa_invoice_id,delivery_details FROM orders WHERE id=?').get(receiptChoice.body.id);
    assert.equal(receiptRow.robokassa_invoice_id,null);
    assert.equal(JSON.parse(receiptRow.delivery_details).paymentMethod,'on_receipt');
    const onlineChoice=await decode(await api.orders.POST(request('/api/orders',{...guestPayload,requestKey:crypto.randomUUID(),paymentMethod:'online'})));
    assert.equal(onlineChoice.status,201,JSON.stringify(onlineChoice.body));
    assert.equal(onlineChoice.body.paymentRequired,true);
    // Both geocoders return selectable addresses in the configured delivery polygon.
    const externalFetch=globalThis.fetch;
    globalThis.fetch=async(input)=>{
      const u=new URL(String(input));
      if(u.hostname==='photon.komoot.io') {
        assert.equal(u.searchParams.get('limit'),'12');assert.ok(u.searchParams.get('bbox'));
        assert.equal(u.pathname,'/structured');assert.equal(u.searchParams.get('housenumber'),'51');
        return Response.json({features:[{geometry:{coordinates:[60.60,56.83]},properties:{city:'Екатеринбург',street:'улица Малышева',housenumber:'51'}},{geometry:{coordinates:[37.6,55.7]},properties:{city:'Москва',street:'улица',housenumber:'1'}}]});
      }
      assert.equal(u.hostname,'geocoder.example.test');
      return Response.json([{display_name:'Екатеринбург, Малышева, 51',lat:'56.83',lon:'60.60'}]);
    };
    try {
      delete globalThis.__shopTestEnv.GEOCODER_URL;
      let addresses=await api.deliveryLib.findAddresses('Малышева 51');
      assert.equal(addresses.length,1);assert.match(addresses[0].label,/51/);assert.deepEqual(addresses[0].coordinates,[56.83,60.60]);
      globalThis.__shopTestEnv.GEOCODER_URL='https://geocoder.example.test/';
      addresses=await api.deliveryLib.findAddresses('Малышева 51');assert.equal(addresses.length,1);
    } finally {globalThis.fetch=externalFetch;delete globalThis.__shopTestEnv.GEOCODER_URL;}
    // Closing/reloading a tab's page preserves multiple order references.
    const storage=new Map();globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
    globalThis.window={dispatchEvent:()=>true};
    try {
      api.recent.rememberOrder({...refs[0],orderNumber:guest.body.orderNumber,total:2750});
      api.recent.rememberOrder({id:'another',accessToken:'second'});
      assert.equal(api.recent.recentOrders().length,2);
      api.recent.rememberOrder({id:guest.body.id});
      assert.equal(api.recent.recentOrders()[0].accessToken,guestPayload.accessToken,'keep guest access when selecting the same order');
      const latest=JSON.parse(storage.get('dm_payment'));assert.equal(latest.id,guest.body.id);
    } finally {delete globalThis.sessionStorage;delete globalThis.window;}

    assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {sqlite.close();await rm(dir,{recursive:true,force:true});delete globalThis.__shopTestEnv;delete globalThis.__shopTestHeaders;}
});
