import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import worker from './worker.mjs';
import {ACCOUNT_SCHEMA} from './accounts.mjs';

function fixture(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(ACCOUNT_SCHEMA);
 const DB={prepare(sql){return statement(sql,[]);}};
 function statement(sql,args){return {bind(...values){return statement(sql,values);},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};}};}
 const password='Administrator-Local-QA-123',salt='a'.repeat(32),hash=pbkdf2Sync(password,Buffer.from(salt,'hex'),100000,32,'sha256').toString('hex');
 const env={DB,STAFF_SESSION_SECRET:'test-session-secret-at-least-thirty-two-characters',STAFF_USERS_JSON:JSON.stringify([{username:'obokadmin',name:'관리자',role:'admin',salt,hash}]),LOGIN_LIMITER:{limit:async()=>({success:true})}};
 async function call(path,body,token){const r=await worker.fetch(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{Origin:'https://obokfoods.com',...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:r.status,data:await r.json()};}
 const admin=async()=>{const r=await call('/login',{username:'obokadmin',password});assert.equal(r.status,200);return r.data.token;};
 return {sqlite,env,call,admin};
}

test('administrator issues staff credentials; no hashes or passwords appear in list',async()=>{
 const f=fixture(),token=await f.admin();
 const created=await f.call('/admin/users',{username:'sales01',name:'영업 직원'},token);
 assert.equal(created.status,201);assert.equal(created.data.temporaryPassword.length,24);
 const row=f.sqlite.prepare('SELECT * FROM staff_accounts WHERE username=?').get('sales01');
 assert.notEqual(row.hash,created.data.temporaryPassword);assert.equal(row.must_change,1);
 assert.equal(pbkdf2Sync(created.data.temporaryPassword,Buffer.from(row.salt,'hex'),100000,32,'sha256').toString('hex'),row.hash);
 const list=await f.call('/admin/users',null,token);
 assert.equal(list.status,200);assert.equal(list.data.users.find(x=>x.username==='sales01').mustChangePassword,true);
 assert.ok(!JSON.stringify(list.data).includes(row.hash));assert.ok(!JSON.stringify(list.data).includes(created.data.temporaryPassword));
 for(const body of [{username:'sales01',name:'중복'},{username:'obokadmin',name:'중복'}])assert.equal((await f.call('/admin/users',body,token)).status,409);
 assert.equal((await f.call('/admin/users',{username:'newadmin',name:'승격',role:'admin'},token)).status,403);
 assert.equal((await f.call('/admin/users',{username:'BAD ID',name:'잘못됨'},token)).status,400);
});

test('first login restricts all other API calls until password change, then rotates sessions',async()=>{
 const f=fixture(),admin=await f.admin(),created=await f.call('/admin/users',{username:'sales01',name:'직원'},admin);
 const logged=await f.call('/login',{username:'sales01',password:created.data.temporaryPassword});
 assert.equal(logged.status,200);assert.equal(logged.data.user.mustChangePassword,true);
 for(const path of ['/records','/analyze','/admin/users'])assert.equal((await f.call(path,null,logged.data.token)).status,403);
 assert.equal((await f.call('/account/password',{currentPassword:'wrong',newPassword:'New-Employee-Password-123'},logged.data.token)).status,400);
 assert.equal((await f.call('/account/password',{currentPassword:created.data.temporaryPassword,newPassword:'short'},logged.data.token)).status,400);
 assert.equal((await f.call('/account/password',{currentPassword:created.data.temporaryPassword,newPassword:created.data.temporaryPassword},logged.data.token)).status,400);
 const changed=await f.call('/account/password',{currentPassword:created.data.temporaryPassword,newPassword:'New-Employee-Password-123'},logged.data.token);
 assert.equal(changed.status,200);assert.equal(changed.data.user.mustChangePassword,false);
 assert.equal((await f.call('/admin/users',null,logged.data.token)).status,401);
 assert.equal((await f.call('/admin/users',null,changed.data.token)).status,403);
 assert.equal((await f.call('/login',{username:'sales01',password:created.data.temporaryPassword})).status,401);
 assert.equal((await f.call('/login',{username:'sales01',password:'New-Employee-Password-123'})).status,200);
});

test('password reset and disabling invalidate existing employee sessions, preserve account and records',async()=>{
 const f=fixture(),admin=await f.admin(),created=await f.call('/admin/users',{username:'sales01',name:'직원'},admin);
 const logged=await f.call('/login',{username:'sales01',password:created.data.temporaryPassword});
 const changed=await f.call('/account/password',{currentPassword:created.data.temporaryPassword,newPassword:'New-Employee-Password-123'},logged.data.token);
 const reset=await f.call('/admin/users/sales01/reset-password',{},admin);assert.equal(reset.status,200);
 assert.equal((await f.call('/admin/users',null,changed.data.token)).status,401);
 assert.equal((await f.call('/login',{username:'sales01',password:'New-Employee-Password-123'})).status,401);
 const again=await f.call('/login',{username:'sales01',password:reset.data.temporaryPassword});assert.equal(again.data.user.mustChangePassword,true);
 assert.equal((await f.call('/admin/users/sales01/status',{disabled:true},admin)).status,200);
 assert.equal((await f.call('/account/password',{currentPassword:reset.data.temporaryPassword,newPassword:'Second-New-Password-123'},again.data.token)).status,401);
 assert.equal((await f.call('/login',{username:'sales01',password:reset.data.temporaryPassword})).status,401);
 assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM staff_accounts').get().n,1);
 assert.equal((await f.call('/admin/users/sales01/reset-password',{},admin)).status,400);
 assert.equal((await f.call('/admin/users/sales01/status',{disabled:false},admin)).status,200);
 assert.equal((await f.call('/login',{username:'sales01',password:reset.data.temporaryPassword})).status,200);
 assert.equal((await f.call('/admin/users/obokadmin/status',{disabled:true},admin)).status,404);
});

test('temporary passwords expire and staff cannot list, issue, reset or disable accounts',async()=>{
 const f=fixture(),admin=await f.admin(),created=await f.call('/admin/users',{username:'sales01',name:'직원'},admin);
 const logged=await f.call('/login',{username:'sales01',password:created.data.temporaryPassword});
 const changed=await f.call('/account/password',{currentPassword:created.data.temporaryPassword,newPassword:'New-Employee-Password-123'},logged.data.token);
 for(const [path,body] of [['/admin/users',null],['/admin/users',{username:'sales02',name:'동료'}],['/admin/users/sales01/reset-password',{}],['/admin/users/sales01/status',{disabled:true}]])assert.equal((await f.call(path,body,changed.data.token)).status,403);
 const reset=await f.call('/admin/users/sales01/reset-password',{},admin);
 f.sqlite.prepare('UPDATE staff_accounts SET temporary_expires=? WHERE username=?').run('2020-01-01T00:00:00Z','sales01');
 assert.equal((await f.call('/login',{username:'sales01',password:reset.data.temporaryPassword})).status,403);
});

test('standalone dashboard bundle supports existing administrator login',async()=>{
 const f=fixture();
 const source=await readFile(new URL('./worker-dashboard.js',import.meta.url),'utf8');
 const bundle=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
 const r=await bundle.fetch(new Request('https://test.invalid/health'),f.env);
 assert.equal((await r.json()).accountManagement,true);
});
