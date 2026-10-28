// Employee credentials live only in D1. The existing secret-based administrator stays valid.
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const enc=new TextEncoder();
export const ACCOUNT_SCHEMA=`CREATE TABLE IF NOT EXISTS staff_accounts (
 username TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
 disabled INTEGER NOT NULL DEFAULT 0, must_change INTEGER NOT NULL DEFAULT 1,
 auth_version INTEGER NOT NULL DEFAULT 1, temporary_expires TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
)`;
const ready=new WeakMap();
async function accountDB(env){
 if(!env.DB)throw fail('직원 계정 저장소 연결이 필요합니다. 관리자에게 문의해 주세요.',503);
 if(!ready.has(env.DB))ready.set(env.DB,env.DB.prepare(ACCOUNT_SCHEMA).run().catch(e=>{ready.delete(env.DB);throw e;}));
 await ready.get(env.DB);return env.DB;
}
function legacy(env){try{const list=JSON.parse(env.STAFF_USERS_JSON||'[]');if(!Array.isArray(list))throw 0;return list;}catch{throw fail('직원 계정 설정을 확인해 주세요.',503);}}
export async function accountLookup(env,username){
 const original=legacy(env).find(x=>x.username===username);
 if(original){if(original.disabled||!/^[a-f0-9]{32,64}$/.test(original.salt)||!/^[a-f0-9]{64}$/.test(original.hash))return null;return {...original,managed:false,auth_version:0,must_change:0};}
 if(!env.DB)return null;
 const row=await (await accountDB(env)).prepare('SELECT * FROM staff_accounts WHERE username=?').bind(username).first();
 return row?{...row,managed:true,role:'staff'}:null;
}
function accountHex(bytes){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
async function digest(password,salt){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return accountHex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:Uint8Array.from(salt.match(/../g),x=>parseInt(x,16))},k,256));}
async function credentials(password){const salt=accountHex(crypto.getRandomValues(new Uint8Array(16)));return {salt,hash:await digest(password,salt)};}
function constantEqual(a,b){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function temporaryPassword(){return accountHex(crypto.getRandomValues(new Uint8Array(12)));}
function publicAccount(u){return {username:u.username,name:u.name||u.username,role:u.role==='admin'?'admin':'staff',disabled:!!u.disabled,mustChangePassword:!!u.must_change,canManage:!!u.managed,createdAt:u.created_at||null};}
export function sessionData(u){return {username:u.username,name:String(u.name||u.username),role:u.role==='admin'?'admin':'staff',mustChangePassword:!!u.must_change,authVersion:u.auth_version||0,managed:!!u.managed};}
export async function listAccounts(env){const db=await accountDB(env);const result=await db.prepare('SELECT username,name,disabled,must_change,created_at FROM staff_accounts ORDER BY created_at DESC,username').all();return {users:[...legacy(env).map(u=>publicAccount({...u,managed:false})),...result.results.map(u=>publicAccount({...u,managed:true}))]};}
export async function createAccount(env,b){
 const username=String(b.username||'').trim(),name=String(b.name||'').trim();
 if(!/^[a-z][a-z0-9._-]{2,39}$/.test(username))throw fail('아이디는 영문 소문자로 시작하는 3~40자의 영문 소문자·숫자·점·밑줄·하이픈으로 입력하세요.');
 if(!name||name.length>80)throw fail('직원 이름은 1~80자로 입력하세요.');
 if(b.role&&b.role!=='staff')throw fail('이 화면에서는 직원 계정만 발급할 수 있습니다.',403);
 if(legacy(env).some(u=>String(u.username).toLowerCase()===username))throw fail('이미 사용 중인 아이디입니다.',409);
 const db=await accountDB(env),password=temporaryPassword(),c=await credentials(password),now=new Date().toISOString(),expires=new Date(Date.now()+72*3600000).toISOString();
 try{await db.prepare('INSERT INTO staff_accounts (username,name,salt,hash,disabled,must_change,auth_version,temporary_expires,created_at,updated_at) VALUES (?,?,?,?,0,1,1,?,?,?)').bind(username,name,c.salt,c.hash,expires,now,now).run();}catch(e){if(/unique|constraint/i.test(e.message))throw fail('이미 사용 중인 아이디입니다.',409);throw e;}
 return {username,name,temporaryPassword:password,expiresAt:expires};
}
export async function manageAccount(env,username,action,b){
 const db=await accountDB(env);const u=await db.prepare('SELECT * FROM staff_accounts WHERE username=?').bind(username).first();
 if(!u)throw fail('관리 가능한 직원 계정을 찾을 수 없습니다.',404);
 const now=new Date().toISOString();let result;
 if(action==='reset-password'){
  if(u.disabled)throw fail('이용 중지된 계정입니다. 먼저 이용을 재개하세요.');
  const password=temporaryPassword(),c=await credentials(password),expires=new Date(Date.now()+72*3600000).toISOString();
  result=await db.prepare('UPDATE staff_accounts SET salt=?,hash=?,must_change=1,temporary_expires=?,auth_version=auth_version+1,updated_at=? WHERE username=? AND auth_version=?').bind(c.salt,c.hash,expires,now,username,u.auth_version).run();
  if(result.meta?.changes!==1)throw fail('계정이 변경됐습니다. 새로고침 후 다시 시도해 주세요.',409);
  return {username,name:u.name,temporaryPassword:password,expiresAt:expires};
 }
 if(action==='status'){
  if(typeof b.disabled!=='boolean')throw fail('이용 상태를 확인해 주세요.');
  result=await db.prepare('UPDATE staff_accounts SET disabled=?,auth_version=auth_version+1,updated_at=? WHERE username=? AND auth_version=?').bind(b.disabled?1:0,now,username,u.auth_version).run();
  if(result.meta?.changes!==1)throw fail('계정이 변경됐습니다. 새로고침 후 다시 시도해 주세요.',409);
  return {username,disabled:b.disabled};
 }
 throw fail('요청한 계정 기능을 찾을 수 없습니다.',404);
}
export async function changePassword(env,u,b){
 if(!u.managed)throw fail('기존 관리자 계정의 비밀번호는 서버 계정 설정에서 관리합니다.',403);
 const password=String(b.newPassword||''),current=String(b.currentPassword||'');
 if(password.length<12||password.length>128||password.trim().length<12)throw fail('새 비밀번호는 공백을 제외하고 12자 이상, 전체 128자 이하로 입력하세요.');
 if(current.length>256)throw fail('현재 비밀번호를 확인해 주세요.',400);
 const db=await accountDB(env),row=await db.prepare('SELECT * FROM staff_accounts WHERE username=?').bind(u.username).first();
 if(!row||row.disabled||row.auth_version!==u.authVersion)throw fail('계정이 변경됐습니다. 다시 로그인해 주세요.',401);
 if(row.must_change&&Date.parse(row.temporary_expires)<=Date.now())throw fail('임시 비밀번호가 만료됐습니다. 관리자에게 재발급을 요청하세요.',403);
 if(!constantEqual(await digest(current,row.salt),row.hash))throw fail('현재 비밀번호를 확인해 주세요.');
 if(constantEqual(await digest(password,row.salt),row.hash))throw fail('현재 비밀번호와 다른 새 비밀번호를 입력하세요.');
 const c=await credentials(password);
 const result=await db.prepare('UPDATE staff_accounts SET salt=?,hash=?,must_change=0,temporary_expires=NULL,auth_version=auth_version+1,updated_at=? WHERE username=? AND auth_version=? AND disabled=0').bind(c.salt,c.hash,new Date().toISOString(),u.username,u.authVersion).run();
 if(result.meta?.changes!==1)throw fail('계정이 변경됐습니다. 다시 로그인해 주세요.',401);
 return {...u,mustChangePassword:false,authVersion:u.authVersion+1};
}
