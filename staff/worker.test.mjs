import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from './worker.mjs';
import {summarize} from './shared.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const enc=new TextEncoder();
const secret='a-test-secret-not-for-deployment-123456789';
const salt='1234567890abcdef1234567890abcdef';
const password='test-password-only';
const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
const hash=Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:Buffer.from(salt,'hex')},k,256)).toString('hex');
const env={STAFF_SESSION_SECRET:secret,STAFF_USERS_JSON:JSON.stringify([{username:'alice',name:'Alice',salt,hash},{username:'bob',name:'Bob',salt,hash},{username:'admin',role:'admin',salt,hash}]),LOGIN_LIMITER:{limit:async()=>({success:true})},ANALYSIS_LIMITER:{limit:async()=>({success:true})},OPENAI_MODEL:'test-model',OPENAI_API_KEY:'fake-test-key'};
async function req(path,body,token,e=env,method){const r=await worker.fetch(new Request('https://test.invalid'+path,{method:method||(body?'POST':'GET'),headers:{Origin:'https://obokfoods.com',...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),e);return {status:r.status,data:await r.json()};}
async function login(username='alice'){const r=await req('/login',{username,password});assert.equal(r.status,200);return r.data.token;}
const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,0,1,2,3]).toString('base64');
const meta={store:'테스트마트',branch:'감천점',category:'간장',date:'2026-10-27',layout:'continuous'};
const items=[{brand:'오복',facings:2,image_index:0,x:0,y:0,w:.2,h:.2,note:'시험'},{brand:'판독 불가',facings:1,image_index:0,x:.2,y:0,w:.2,h:.2,note:''}];
test('unknown facings stay in denominator; zero has no percentage',()=>{assert.equal(summarize(items).brands[2].share,2/3);assert.equal(summarize([]).brands[2].share,null);assert.throws(()=>summarize([{brand:'오복',facings:-1}]));assert.throws(()=>summarize([{brand:'오복',facings:1.2}]));});
test('all private endpoints reject unauthenticated requests',async()=>{for(const p of ['/analyze','/records','/photos/00000000-0000-0000-0000-000000000000/0'])assert.equal((await req(p)).status,401);});
test('wrong login, tampered token, removed user and missing limiter are denied',async()=>{assert.equal((await req('/login',{username:'alice',password:'wrong'})).status,401);assert.equal((await req('/login',{username:'alice',password},null,{...env,LOGIN_LIMITER:null})).status,503);const token=await login();assert.equal((await req('/records',null,token+'bad')).status,401);assert.equal((await req('/records',null,token,{...env,STAFF_USERS_JSON:'[]'})).status,401);assert.equal((await req('/login',{username:'alice',password},null,{...env,LOGIN_LIMITER:{limit:async()=>({success:false})}})).status,429);});
test('cross-origin login blocked',async()=>{const r=await worker.fetch(new Request('https://test.invalid/login',{method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'}),env);assert.equal(r.status,403);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);});
test('end-to-end mocked AI: signed original preserved, tampering rejected, record and photo ownership checked',async()=>{
 const token=await login();const bob=await login('bob');const admin=await login('admin');
 const rows=new Map(),objects=new Map();
 const e={...env,DB:{prepare(sql){return {bind(...args){return {async run(){rows.set(args[0],Object.fromEntries(['id','username','user_name','store','branch','category','date','layout','items','analysis','photo_keys','memo','total','obok_share','created_at'].map((k,i)=>[k,args[i]])));},async first(){return rows.get(args[0])||null;},async all(){return {results:[...rows.values()].filter(r=>r.username===args[0])};}};},async all(){return {results:[...rows.values()]};}};}},PHOTOS:{async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;},async delete(keys){keys.forEach(k=>objects.delete(k));}}};
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({items,warnings:['写真の範囲']})}));
 try{
 const analyzed=await req('/analyze',{...meta,images:[photo]},token,e);assert.equal(analyzed.status,200);assert.equal(analyzed.data.items[0].facings,2);
 const body={...meta,images:[photo],items:[{...items[0],facings:3},items[1]],analysis:analyzed.data,confirmed:true,memo:'직원 수정'};
 assert.equal((await req('/records',{...body,store:'다른마트'},token,e)).status,400);
 assert.equal((await req('/records',{...body,images:[photo.replace(/Aw==$/,'BA==')]},token,e)).status,400);
 assert.equal((await req('/records',{...body,confirmed:false},token,e)).status,400);
 const saved=await req('/records',body,token,e);assert.equal(saved.status,201);const id=saved.data.id;
 assert.equal(JSON.parse(rows.get(id).analysis).items[0].facings,2);assert.equal(JSON.parse(rows.get(id).items)[0].facings,3);
 assert.equal((await req('/records/'+id,null,bob,e)).status,404);assert.equal((await req('/records/'+id,null,token,e)).status,200);assert.equal((await req('/records/'+id,null,admin,e)).status,200);
 const p=await worker.fetch(new Request('https://test.invalid/photos/'+id+'/0',{headers:{Authorization:'Bearer '+bob}}),e);assert.equal(p.status,404);
 const own=await worker.fetch(new Request('https://test.invalid/photos/'+id+'/0',{headers:{Authorization:'Bearer '+token}}),e);assert.equal(own.status,200);
 }finally{globalThis.fetch=oldFetch;}
});
