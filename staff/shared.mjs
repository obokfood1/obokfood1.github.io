export const BRANDS=['샘표','몽고','오복','기타','판독 불가'];
export function cleanItems(items){
 if(!Array.isArray(items)||items.length>400)throw new Error('제품 목록을 확인해 주세요.');
 return items.map(x=>{const n=Number(x.facings);if(!Number.isInteger(n)||n<0||n>1000||!BRANDS.includes(x.brand))throw new Error('브랜드와 면수를 확인해 주세요.');return {brand:x.brand,facings:n,image_index:Number(x.image_index)||0,x:Math.max(0,Math.min(1,Number(x.x)||0)),y:Math.max(0,Math.min(1,Number(x.y)||0)),w:Math.max(0,Math.min(1,Number(x.w)||0)),h:Math.max(0,Math.min(1,Number(x.h)||0)),note:String(x.note||'').slice(0,250)};});
}
export function summarize(items){const counts=Object.fromEntries(BRANDS.map(b=>[b,0]));for(const x of cleanItems(items))counts[x.brand]+=x.facings;const total=Object.values(counts).reduce((a,b)=>a+b,0);return {total,brands:BRANDS.map(brand=>({brand,facings:counts[brand],share:total?counts[brand]/total:null}))};}
