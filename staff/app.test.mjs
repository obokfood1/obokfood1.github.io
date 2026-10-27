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
