const $=s=>document.querySelector(s);
const state={ingredients:[],recommendations:[],excludeNames:[],photosAnalyzed:0};

function show(id){
  $(id).classList.remove('hidden');
  $(id).scrollIntoView({behavior:'smooth',block:'start'});
}
function renderChips(){
  const c=$('#chips'); c.innerHTML='';
  state.ingredients.forEach((x,i)=>{
    const el=document.createElement('span');
    el.className='chip';
    el.innerHTML=`${escapeHtml(x)}<button aria-label="삭제">×</button>`;
    el.querySelector('button').onclick=()=>{state.ingredients.splice(i,1);renderChips()};
    c.appendChild(el);
  });
}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
function setPhotoStatus(text,type=''){
  const el=$('#photoName'); el.textContent=text; el.dataset.type=type;
}
function apiConfigured(){
  return window.OBOK_AI_API && !window.OBOK_AI_API.includes('YOUR-WORKER-URL');
}
async function resizeImageToDataURL(file){
  const dataUrl=await new Promise((resolve,reject)=>{
    const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);
  });
  const img=await new Promise((resolve,reject)=>{
    const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=dataUrl;
  });
  const maxSide=1600;
  let w=img.width,h=img.height;
  const scale=Math.min(1,maxSide/Math.max(w,h));
  w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  canvas.getContext('2d').drawImage(img,0,0,w,h);
  return canvas.toDataURL('image/jpeg',0.82);
}

$('#photo').addEventListener('change',async e=>{
  const selected=Array.from(e.target.files||[]);
  if(!selected.length)return;
  show('#ingredients');

  if(!apiConfigured()){
    setPhotoStatus('⚠️ AI 서버 주소가 연결되지 않았어요. 아래에서 재료를 직접 입력해 주세요.','error');
    e.target.value=''; return;
  }

  const remaining=Math.max(0,3-state.photosAnalyzed);
  const files=selected.slice(0,remaining);
  if(!files.length){
    setPhotoStatus('📷 사진은 최대 3장까지 분석할 수 있어요.','success');
    e.target.value=''; return;
  }

  try{
    for(const file of files){
      const photoNo=state.photosAnalyzed+1;
      setPhotoStatus(`🔍 ${photoNo}/3번째 사진을 AI가 살펴보고 있어요…`,'loading');
      const imageDataUrl=await resizeImageToDataURL(file);
      const resp=await fetch(`${window.OBOK_AI_API.replace(/\/$/,'')}/analyze-fridge`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl})
      });
      const data=await resp.json().catch(()=>({}));
      if(!resp.ok)throw new Error(data.error||`서버 오류 (${resp.status})`);
      const found=Array.isArray(data.ingredients)?data.ingredients.filter(Boolean):[];
      state.ingredients=[...new Set([...state.ingredients,...found])].slice(0,30);
      state.photosAnalyzed++; renderChips();
    }
    const left=3-state.photosAnalyzed;
    setPhotoStatus(
      state.ingredients.length
        ? `✅ 사진 ${state.photosAnalyzed}장 분석 완료 · ${state.ingredients.length}가지 재료를 찾았어요.${left?` 다른 구역 사진을 ${left}장 더 추가할 수 있어요.`:' 맞는지 확인해 주세요.'}`
        : `😊 뚜렷한 재료를 찾지 못했어요.${left?` 다른 구역 사진을 ${left}장 더 추가해 보세요.`:''}`,
      'success'
    );
  }catch(err){
    console.error(err);
    setPhotoStatus(`⚠️ 사진 분석에 실패했어요. (${err.message})`,'error');
  }finally{e.target.value='';}
});

$('#manualBtn').onclick=()=>{
  state.ingredients=[]; state.photosAnalyzed=0; state.excludeNames=[];
  setPhotoStatus('가지고 있는 재료를 하나씩 추가해 주세요.');
  renderChips(); show('#ingredients');
};
function add(){
  const raw=$('#ingredientInput').value.trim();
  const items=raw
    .split(/[,，、;\n]+/)
    .map(v=>v.trim())
    .filter(Boolean);
  if(items.length){
    state.ingredients=[...new Set([...state.ingredients,...items])].slice(0,30);
    renderChips();
  }
  $('#ingredientInput').value='';
}

function commitPendingIngredients(){
  const raw=$('#ingredientInput').value.trim();
  if(!raw)return;
  const items=raw
    .split(/[,，、;\n]+/)
    .map(v=>v.trim())
    .filter(Boolean);
  state.ingredients=[...new Set([...state.ingredients,...items])].slice(0,30);
  $('#ingredientInput').value='';
  renderChips();
}
$('#addBtn').onclick=add;
$('#ingredientInput').addEventListener('keydown',e=>{if(e.key==='Enter')add();});

function normalizeRecipe(r){
  const products=Array.isArray(r.products)?r.products:[];
  return {
    name:String(r.name||'오늘의 오복 요리'),
    emoji:String(r.emoji||'🍲'),
    time:String(r.time||$('#time').value||'20분'),
    level:String(r.level||'쉬움'),
    product:String(r.product||products[0]||'오복 양조간장'),
    desc:String(r.desc||r.reason||'냉장고 재료를 활용한 오복 AI 셰프 추천 메뉴입니다.'),
    reason:String(r.reason||''),
    ingredients:Array.isArray(r.ingredients)?r.ingredients:[],
    steps:Array.isArray(r.steps)?r.steps:[],
    servings:String(r.servings||$('#people').value),
    season:String(r.season||''),
    product_options:Array.isArray(r.product_options)?r.product_options:[],
    nutrition:r.nutrition||null,
    products
  };
}
function productImage(name){
  const n=String(name||'');
  if(n.includes('국간장'))return '../assets/soybean_soup_soy.jpg';
  if(n.includes('된장'))return '../assets/doenjang_500.jpg';
  if(n.includes('쌈장'))return '../assets/ssamjang_500.jpg';
  if(n.includes('춘장'))return '../assets/chunjang_500.jpg';
  if(n.includes('황실'))return '../assets/gochujang_14kg.jpg';
  if(n.includes('고추장'))return '../assets/gochujang_3kg.jpg';
  return '../assets/royal_soy.jpg';
}
function nutritionHtml(n){
 if(!n?.values)return '<section class="nutrition-info"><h3>예상 영양정보</h3><p>계산할 수 있는 영양자료가 없습니다. 서버 업데이트와 재료 자료를 확인해 주세요.</p></section>';
 const v=n.values;
 const title=n.complete?'1인분 예상 영양정보':'확인된 재료만 합산 · 1인분 예상값';
 const rows=[['열량',v.energy_kcal,'kcal'],['탄수화물',v.carbohydrate_g,'g'],['단백질',v.protein_g,'g'],['지방',v.fat_g,'g'],['나트륨',v.sodium_mg,'mg']];
 return `<section class="nutrition-info"><h3>${title}</h3><table class="nutrition-table"><tbody>${rows.map(([name,value,unit])=>`<tr><th scope="row">${name}</th><td>${escapeHtml(value)} ${unit}</td></tr>`).join('')}</tbody></table><p>${n.complete?'등록된 재료 모두 계산':'전체 요리의 영양값이 아닙니다. 계산 제외: '+escapeHtml((n.missing||[]).join(', '))} · ${escapeHtml(n.matched_count)}/${escapeHtml(n.total_count)}개 재료 반영</p><small>${escapeHtml(n.note||'')}<br>출처: ${escapeHtml((n.sources||[]).join(' / '))}</small></section>`;
}
function productSizeText(options,name){
 const item=options.find(x=>x.name===name);
 return item?.sizes?.length ? '확인된 포장규격: '+item.sizes.join(' / ') : '포장규격은 영업팀에 확인해 주세요.';
}
function renderRecommendations(list,more=false){
  state.recommendations=list.map(normalizeRecipe);
  const grid=$('#recipeGrid'); grid.innerHTML='';

  // 기존에 생성된 '다른 요리 3개 더 추천' 버튼이 있으면 먼저 제거
  // (추천을 다시 받을 때 버튼이 계속 누적되는 현상 방지)
  document.querySelectorAll('#moreRecipesBtn').forEach(el=>el.remove());

  const head=$('#recommendations .section-head');
  head.innerHTML=`<span class="eyebrow">STEP 2 · AI 추천</span><h2>${more?'다른 요리도 준비했어요!':'오늘은 이 요리 어때요?'}</h2><p>냉장고 재료와 선택한 인원·조리시간을 바탕으로 AI가 지금 만든 레시피예요.</p>`;
  state.recommendations.forEach((r,i)=>{
    const el=document.createElement('article'); el.className='recipe';
    el.innerHTML=`<div class="emoji">${escapeHtml(r.emoji)}</div><h3>${escapeHtml(r.name)}</h3><div class="meta">⏱ ${escapeHtml(r.time)} · 👨‍🍳 ${escapeHtml(r.level)}</div><p>${escapeHtml(r.desc)}</p><span class="product-badge">${escapeHtml(r.product)} 사용</span>`;
    el.onclick=()=>detail(i); grid.appendChild(el);
  });
  const moreBtn=document.createElement('button');
  moreBtn.className='primary wide'; moreBtn.id='moreRecipesBtn';
  moreBtn.textContent='✨ 다른 요리 3개 더 추천';
  moreBtn.onclick=()=>requestAIRecipes(true);
  grid.after(moreBtn);
  show('#recommendations');
}
async function requestAIRecipes(more=false){
  // 입력창에 적어 둔 재료도 자동 등록
  commitPendingIngredients();
  if(!state.ingredients.length){alert('재료를 한 가지 이상 입력해 주세요.');return;}

  if(!apiConfigured()){
    alert('AI 서버가 연결되지 않았습니다.');
    return;
  }

  const btn = more ? $('#moreRecipesBtn') : $('#recommendBtn');
  const old = btn ? btn.textContent : '';

  if(btn){
    btn.disabled = true;
    btn.textContent = more
      ? '👨‍🍳 새로운 요리 3개를 만들고 있어요...'
      : '👨‍🍳 오복이가 메뉴를 고민하고 있어요...';
  }

  try {

    // "다른 요리 3개 더 추천"일 경우
    // 지금까지 추천된 요리명을 제외 목록에 추가
    if(more){
      const currentNames = state.recommendations
        .map(r => r && r.name ? String(r.name).trim() : '')
        .filter(Boolean);

      state.excludeNames = [
        ...new Set([
          ...(state.excludeNames || []),
          ...currentNames
        ])
      ].slice(-20);
    } else {
      state.excludeNames = [];
    }

    const resp = await fetch(
      `${window.OBOK_AI_API.replace(/\/$/,'')}/recommend-recipes`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          ingredients: state.ingredients,
          season: $('#season').value,
          people: $('#people').value,
          time: $('#time').value,
          preference:
            '사용자가 입력한 핵심 식재료를 요리의 중심으로 우선 활용해 주세요. ' +
            '특히 닭고기, 돼지고기, 소고기, 생선, 두부, 계란 같은 주재료가 있으면 이를 무시하고 단순한 대체 요리를 추천하지 마세요. ' +
            '냉장고 재료를 최대한 활용하고 가정에서 쉽게 만들 수 있는 요리를 추천해 주세요.',
          excludeNames: state.excludeNames
        })
      }
    );

    const data = await resp.json().catch(()=>({}));

    if(!resp.ok){
      throw new Error(data.error || `서버 오류 (${resp.status})`);
    }

    const list = Array.isArray(data.recipes) ? data.recipes : [];

    if(!list.length){
      throw new Error('추천 레시피를 받지 못했습니다.');
    }

    // 새로 받은 요리 3개 표시
    renderRecommendations(list.slice(0,3), more);

  } catch(err) {

    console.error(err);

    alert(
      `AI 레시피 추천에 실패했어요.\n잠시 후 다시 시도해 주세요.\n\n${err.message}`
    );

  } finally {

    // 기존 버튼이 아직 화면에 존재할 때만 원상복구
    if(btn && document.body.contains(btn)){
      btn.disabled = false;
      btn.textContent = old;
    }
  }
}
$('#recommendBtn').onclick=()=>requestAIRecipes(false);

function detail(i){
  const r=state.recommendations[i]; if(!r)return;
  const ing=r.ingredients.length?r.ingredients:state.ingredients;
  const steps=r.steps.length?r.steps:['재료를 준비해 주세요.','재료를 먹기 좋은 크기로 손질해 주세요.','팬이나 냄비에서 재료를 익혀 주세요.','추천된 오복 양념으로 간을 맞춰 주세요.','재료가 충분히 익도록 마무리해 주세요.','접시에 담아 맛있게 즐겨 주세요.'];
  let products=r.products;
  if(!products.length&&r.product)products=[r.product];
  $('#detailContent').innerHTML=`
    <span class="eyebrow">STEP 3 · 오복 AI 셰프와 요리하기</span>
    <h2 class="recipe-title">${escapeHtml(r.emoji)} ${escapeHtml(r.name)}</h2>
    <p class="lead">${escapeHtml(r.desc)}<br><b>${escapeHtml(r.servings)} 기준 · ${escapeHtml(r.season)}</b><br><b>사용 재료:</b> ${ing.map(escapeHtml).join(', ')||'기본 식재료'}</p>
    <div class="steps">${steps.map((s,j)=>`<div class="step"><b>${j+1}. 조리 단계</b>${escapeHtml(s)}</div>`).join('')}</div>
    ${products.length?`<div class="shop"><h3>🛒 이 요리에 어울리는 오복제품</h3><p class="lead">AI가 레시피에 자연스럽게 어울리는 오복 제품을 함께 제안했어요.</p>${products.map(p=>{const name=Array.isArray(p)?p[0]:p;return `<div class="product"><img src="${productImage(name)}" alt="${escapeHtml(name)}"><div class="product-copy"><b>${escapeHtml(name)}</b><p>${escapeHtml(productSizeText(r.product_options,name))}</p></div></div>`}).join('')}</div>`:''}`;
  $('#detailContent').insertAdjacentHTML('beforeend',nutritionHtml(r.nutrition));
  show('#detail');
}
$('#backBtn').onclick=()=>show('#recommendations');
renderChips();

// v6.0 mode selector + school meal prototype
const homeChefMode=$('#homeChefMode'),schoolChefMode=$('#schoolChefMode'),homeChefPanel=$('#homeChefPanel'),schoolChefPanel=$('#schoolChefPanel');
function selectChefMode(mode){
 const school=mode==='school';
 homeChefPanel.classList.toggle('hidden',school); schoolChefPanel.classList.toggle('hidden',!school);
 homeChefMode.classList.toggle('active',!school); schoolChefMode.classList.toggle('active',school);
}
homeChefMode.onclick=()=>selectChefMode('home'); schoolChefMode.onclick=()=>selectChefMode('school');

$('#schoolRecommendBtn').onclick=async()=>{
 if(!apiConfigured()){alert('AI 서버가 연결되지 않았습니다.');return;}
 const btn=$('#schoolRecommendBtn'),old=btn.textContent; btn.disabled=true;btn.textContent='👨‍🍳 월~금 급식과 식재료를 구성하고 있어요...';
 try{
  const people=Math.max(1,Math.min(5000,Math.floor(Number($('#schoolPeople').value)||500)));
  const resp=await fetch(`${window.OBOK_AI_API.replace(/\/$/,'')}/recommend-school-menu`,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({schoolLevel:$('#schoolLevel').value,season:$('#schoolSeason').value,people,budget:Number($('#schoolBudget').value)||0,exclude:$('#schoolExclude').value||'',requiredMenus:$('#schoolRequiredMenus').value||'',excludedMenus:$('#schoolExcludedMenus').value||'',extraRequest:$('#schoolRequest').value||''})
  });
  const data=await resp.json().catch(()=>({})); if(!resp.ok)throw new Error(data.error||`서버 오류 (${resp.status})`);
  const days=Array.isArray(data.days)?data.days:[]; if(days.length!==5)throw new Error('월~금 5일 식단을 모두 받지 못했습니다.');
  const grid=$('#schoolMenuGrid');grid.innerHTML='';
  days.forEach(d=>{
   const menu=(Array.isArray(d.menu)?d.menu:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('');
   const ing=(Array.isArray(d.ingredients)?d.ingredients:[]).map(x=>`<li><span>${escapeHtml(x.name||'')}</span><b>${escapeHtml(x.quantity||'')}</b></li>`).join('');
   const products=(Array.isArray(d.obok_products)?d.obok_products:[]).map(x=>`<span class="school-product">${escapeHtml(x)} · ${escapeHtml(productSizeText(d.product_options||[],x))}</span>`).join('');
   const el=document.createElement('article');el.className='school-day';
   el.innerHTML=`<h3>${escapeHtml(d.day||'')}</h3><ul class="school-menu-list">${menu}</ul><p class="balance-note">${escapeHtml(d.balance_note||'')}</p><h4>주요 식재료 · ${people.toLocaleString()}명 기준</h4><ul class="school-ingredients">${ing}</ul>${products?`<div class="school-products">${products}</div>`:''}`;
   el.insertAdjacentHTML('beforeend',`<h4>주찬 조리과정</h4><ol>${(d.cooking_steps||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>서버 코드 업데이트 후 제공됩니다.</li>'}</ol>${nutritionHtml(d.nutrition)}`);
   grid.appendChild(el);
  });
  const oldSummary=document.querySelector('#schoolResults .school-summary'); if(oldSummary)oldSummary.remove();
  const summary=document.createElement('div');summary.className='card school-summary';
  const shopping=(Array.isArray(data.weekly_shopping)?data.weekly_shopping:[]).map(x=>`<li><span>${escapeHtml(x.name||'')}</span><b>${escapeHtml(x.quantity||'')}</b></li>`).join('');
  summary.innerHTML=`<div class="section-head"><span class="eyebrow">WEEKLY SHOPPING</span><h2>한 주 주요 식재료 취합</h2><p>${people.toLocaleString()}명 급식 기준 AI 예상 구매량입니다.</p></div><ul class="weekly-shopping">${shopping}</ul><p class="review-note">※ ${escapeHtml(data.review_note||'실제 제공 전 학교 영양사가 최종 검토해 주세요.')}</p>`;
  $('#schoolResults').appendChild(summary); show('#schoolResults'); $('#schoolResults').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){console.error(err);alert(`학교급식 식단 생성에 실패했어요.\n잠시 후 다시 시도해 주세요.\n\n${err.message}`)}
 finally{btn.disabled=false;btn.textContent=old;}
};
