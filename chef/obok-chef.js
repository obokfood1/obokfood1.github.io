const $=s=>document.querySelector(s);
const state={ingredients:['돼지고기','양파','계란','대파']};
const recipes=[
 {name:'오복 간장 계란 덮밥',emoji:'🍳',time:'7분',level:'초간단',product:'오복 양조간장',desc:'냉장고가 비어 있어도 밥과 계란만 준비하면 금방 만들 수 있는 오복이의 기본 한 끼',fallback:true,steps:['따뜻한 밥 1공기와 계란 2개를 준비해요.','팬에 기름을 조금 두르고 계란후라이 2개를 만들어요.','밥 위에 계란후라이를 올려요.','오복 양조간장 1~1.5큰술을 골고루 둘러요.','오복 참기름 1작은술을 넣고, 있으면 김가루나 깨를 살짝 올려요.','노른자를 톡 터뜨려 밥과 잘 비비면 7분 만에 완성!'],products:[['오복 양조간장','../assets/soy.webp'],['오복 참기름','../assets/soy.webp']]},
 {name:'간장 돼지불고기 덮밥',emoji:'🍚',time:'15분',level:'아주 쉬움',product:'오복 양조간장',desc:'달콤짭짤한 간장 양념으로 누구나 쉽게 만드는 한 그릇 요리',steps:['돼지고기와 양파를 먹기 좋은 크기로 준비해요.','팬을 달군 뒤 돼지고기를 먼저 볶아요.','오복 양조간장 3큰술과 설탕 1큰술을 넣어요.','양파와 대파를 넣고 함께 볶아요.','중불에서 5~7분, 양념이 잘 배도록 볶아요.','밥 위에 올리고 계란후라이를 곁들이면 완성!'],products:[['오복 양조간장','../assets/soy.webp'],['오복 참기름','../assets/soy.webp']]},
 {name:'매콤 제육볶음',emoji:'🌶️',time:'20분',level:'쉬움',product:'오복 고추장',desc:'밥과 가장 잘 어울리는 매콤달콤한 집밥 메뉴',steps:['돼지고기와 양파, 대파를 준비해요.','돼지고기를 팬에서 가볍게 익혀요.','오복 고추장 1큰술과 간장, 설탕을 넣어요.','양파와 대파를 넣고 센 불에서 볶아요.','양념이 고기에 고르게 배면 불을 줄여요.','통깨를 뿌리고 밥과 함께 맛있게 드세요!'],products:[['오복 고추장','../assets/gochujang.webp'],['오복 양조간장','../assets/soy.webp']]},
 {name:'계란 간장볶음밥',emoji:'🍳',time:'10분',level:'아주 쉬움',product:'오복 양조간장',desc:'재료가 적을 때도 10분이면 완성되는 초간단 메뉴',steps:['계란 2개와 대파를 준비해요.','팬에 계란을 넣고 빠르게 저어 익혀요.','밥을 넣고 계란과 잘 섞어 볶아요.','오복 양조간장 1큰술을 팬 가장자리에 둘러요.','대파를 넣고 1~2분 더 볶아요.','참기름을 살짝 넣으면 완성!'],products:[['오복 양조간장','../assets/soy.webp']]}
];
function show(id){$(id).classList.remove('hidden');$(id).scrollIntoView({behavior:'smooth',block:'start'});}
function renderChips(){const c=$('#chips');c.innerHTML='';state.ingredients.forEach((x,i)=>{const el=document.createElement('span');el.className='chip';el.innerHTML=`${x}<button aria-label="삭제">×</button>`;el.querySelector('button').onclick=()=>{state.ingredients.splice(i,1);renderChips()};c.appendChild(el)});}
$('#photo').addEventListener('change',e=>{if(!e.target.files[0])return;state.ingredients=['돼지고기','양파','계란','대파'];$('#photoName').textContent=`📷 ${e.target.files[0].name} · 시제품에서는 샘플 재료를 표시합니다.`;renderChips();show('#ingredients')});
$('#manualBtn').onclick=()=>{state.ingredients=[];$('#photoName').textContent='가지고 있는 재료를 하나씩 추가해 주세요.';renderChips();show('#ingredients')};
function add(){const v=$('#ingredientInput').value.trim();if(v&&!state.ingredients.includes(v)){state.ingredients.push(v);renderChips()}$('#ingredientInput').value=''}
$('#addBtn').onclick=add;$('#ingredientInput').addEventListener('keydown',e=>{if(e.key==='Enter')add()});
$('#recommendBtn').onclick=()=>{
 const grid=$('#recipeGrid');grid.innerHTML='';
 const empty=state.ingredients.length===0;
 const list=empty ? [recipes[0]] : recipes.filter(r=>!r.fallback);
 const head=$('#recommendations .section-head');
 if(empty){
   head.innerHTML=`<span class="eyebrow">STEP 2</span><h2>냉장고가 비어 있어도 괜찮아요 😊</h2><p>오복이가 가장 간단한 한 끼를 준비했어요. <b>밥과 계란 2개</b>만 준비해 주세요!</p>`;
 }else{
   head.innerHTML=`<span class="eyebrow">STEP 2</span><h2>오늘은 이 요리 어때요?</h2><p>냉장고 재료를 최대한 활용한 쉬운 메뉴예요.</p>`;
 }
 list.forEach(r=>{
   const i=recipes.indexOf(r);
   const el=document.createElement('article');el.className='recipe';
   el.innerHTML=`<div class="emoji">${r.emoji}</div><h3>${r.name}</h3><div class="meta">⏱ ${r.time} · 👨‍🍳 ${r.level}</div><p>${r.desc}</p><span class="product-badge">${r.product} 사용</span>`;
   el.onclick=()=>detail(i);grid.appendChild(el)
 });
 show('#recommendations')
};
function detail(i){const r=recipes[i];$('#detailContent').innerHTML=`<span class="eyebrow">STEP 3 · 오복이와 요리하기</span><h2 class="recipe-title">${r.emoji} ${r.name}</h2><p class="lead">${r.desc}<br><b>냉장고 재료:</b> ${state.ingredients.join(', ')||'냉장고가 비어 있어 기본 레시피를 추천했어요'}</p><div class="steps">${r.steps.map((s,j)=>`<div class="step"><b>${j+1}. ${['재료 준비','먼저 익히기','오복 양념 넣기','함께 볶기','맛있게 마무리','완성!'][j]}</b>${s}</div>`).join('')}</div><div class="shop"><h3>🛒 이 요리에 사용한 오복제품</h3><p class="lead">요리를 먼저 완성한 뒤, 필요한 제품을 여기서 바로 확인할 수 있어요.</p>${r.products.map(p=>`<div class="product"><img src="${p[1]}" alt="${p[0]}"><div class="product-copy"><b>${p[0]}</b><p>오복이 레시피에 사용된 제품입니다.</p></div><a class="buy disabled" href="#" title="실제 판매 URL 연결 예정">구매 링크 등록 예정</a></div>`).join('')}</div>`;show('#detail')}
$('#backBtn').onclick=()=>show('#recommendations');
renderChips();
