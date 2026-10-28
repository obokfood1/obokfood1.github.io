import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {BRANDS,cleanItems,summarize} from './shared.mjs';

test('saved survey remains readable when its photos have expired',async()=>{
  const elements=new Map();
  const element=()=>({value:'',textContent:'',style:{},children:[],classList:{add(){},remove(){}},append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},setAttribute(){},scrollIntoView(){},querySelectorAll(){return [];}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const record={store:'시험마트',branch:'본점',category:'간장',date:'2026-10-01',layout:'continuous',memo:'보관된 조사',photos:['record/0.jpg'],items:[{brand:'오복',facings:3,image_index:0,x:0,y:0,w:0,h:0,note:''},{brand:'샘표',facings:7,image_index:0,x:0,y:0,w:0,h:0,note:''}]};
  const context=vm.createContext({BRANDS,cleanItems,summarize,Intl,Date,window:{OBOK_STAFF_API:'https://example.test'},document:{getElementById:get,createElement:element},fetch:async url=>url.includes('/photos/')?{status:404,ok:false}:{ok:true,json:async()=>record}});
  const source=(await readFile(new URL('./app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
  await vm.runInContext(source+"\ntoken='test';openRecord('record');",context);
  assert.equal(get('result').hidden,false);
  assert.equal(get('total').textContent,10);
  assert.equal(get('obok-share').textContent,'30.0%');
  assert.equal(get('memo').value,'보관된 조사');
  assert.match(get('warnings').textContent,/10일/);
  assert.equal(get('notice').textContent,'');
  assert.match(get('marked').children[0].children[1].textContent,/삭제/);
});

async function saveFixture(fetch){
  const elements=new Map();
  const element=()=>({value:'',textContent:'',style:{},classList:{add(){},remove(){}},append(){},replaceChildren(){},setAttribute(){},scrollIntoView(){},querySelectorAll(){return [];}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const context=vm.createContext({BRANDS,cleanItems,summarize,Intl,Date,window:{OBOK_STAFF_API:'https://example.test'},document:{getElementById:get,createElement:element},fetch});
  const source=(await readFile(new URL('./app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
  vm.runInContext(source+"\ntoken='test';raw={ticket:'test'};surveyMeta=meta();items=[{brand:'오복',facings:3}];$('confirmed').checked=true;",context);
  return {get,run:code=>vm.runInContext(code,context)};
}

test('save displays completion after response and blocks repeat requests',async()=>{
  let calls=0,resolve;
  const response=new Promise(r=>resolve=r);
  const f=await saveFixture(async()=>{calls++;return response;});
  const pending=f.run("$('save').onclick()");
  assert.equal(f.get('save').textContent,'저장 중…');
  await f.run("$('save').onclick()");
  assert.equal(calls,1);
  resolve({ok:true,json:async()=>({id:'saved'})});
  await pending;
  assert.equal(f.get('save').textContent,'✓ 저장 완료');
  assert.equal(f.get('save').disabled,true);
  assert.match(f.get('save-status').textContent,/저장 완료/);
  assert.equal(f.get('save-status').className,'save-status success');
  f.run('edited()');
  await f.run("$('save').onclick()");
  assert.equal(calls,1);
  assert.equal(f.get('save').disabled,true);
  assert.match(f.get('save-status').textContent,/수정한 내용은 저장되지 않습니다/);
  f.run('resetSave()');
  assert.equal(f.get('save-status').textContent,'');
  assert.equal(f.get('save').textContent,'확인한 조사 저장');
});

test('failed save has no success state and permits retry',async()=>{
  let calls=0;
  const f=await saveFixture(async()=>{calls++;return {ok:false,status:503,json:async()=>({error:'저장소 연결 실패'})};});
  await f.run("$('save').onclick()");
  assert.equal(f.get('save').disabled,false);
  assert.equal(f.get('save').textContent,'다시 저장');
  assert.match(f.get('save-status').textContent,/저장하지 못했습니다/);
  assert.equal(f.get('save-status').className,'save-status error');
  await f.run("$('save').onclick()");
  assert.equal(calls,2);
});
