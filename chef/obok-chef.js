let language='ko';
try{language=localStorage.getItem('obok-chef-language')==='en'?'en':'ko';}catch{}
const L=(ko,en)=>language==='en'?en:ko;
function localizedError(data){
 if(!data.error)return '';
 if(language!=='en')return data.error;
 const messages={RATE_LIMITED:'Too many requests. Please wait a minute and try again.',AI_TIMEOUT:'The AI response timed out. Please try again shortly.',AI_UPSTREAM_RATE_LIMIT:'The AI service is busy. Please try again shortly.',AI_BUSY:'The AI service is temporarily unavailable. Please try again shortly.'};
 return messages[data.code] || (/[가-힣]/.test(data.error)?'The request failed. Please try again shortly.':data.error);
}
const PRODUCT_EN={
 '황가 오복양조':'OBOK Hwangga Brewed Soy Sauce','오복 양조간장':'OBOK Brewed Soy Sauce',
 '우리콩 국간장':'OBOK Soybean Soup Soy Sauce','우리콩 된장':'OBOK Soybean Doenjang',
 '우리밀 고추장':'OBOK Wheat Gochujang','황실고추장':'OBOK Hwangsil Gochujang',
 '오복 양념쌈장':'OBOK Seasoned Ssamjang','오복 춘장':'OBOK Chunjang'
};
function displayProduct(name){return language==='en'?(PRODUCT_EN[name]||name):name;}
function displayDay(day){return language==='en'?({월요일:'Monday',화요일:'Tuesday',수요일:'Wednesday',목요일:'Thursday',금요일:'Friday'}[day]||day):day;}
let activeRequests=0;
function setBusy(busy){activeRequests=Math.max(0,activeRequests+(busy?1:-1));document.querySelectorAll('[data-language]').forEach(b=>b.disabled=activeRequests>0);}
function applyLanguage(){
 document.documentElement.lang=language;
 document.querySelector('meta[name="description"]').content=L('냉장고 사진이나 재료를 알려주면 오복이가 만들 수 있는 요리를 추천해드립니다.','Discover recipes from fridge photos or ingredients with OBOK AI Chef.');
 document.title=L('오복 AI 셰프 | 오복식품','OBOK AI Chef | OBOK Foods');
 document.querySelectorAll('[data-ko][data-en]').forEach(el=>el.textContent=el.dataset[language]);
 document.querySelectorAll('[data-en-placeholder]').forEach(el=>el.placeholder=el.getAttribute('data-'+language+'-placeholder'));
 document.querySelectorAll('[data-en-alt]').forEach(el=>el.alt=el.getAttribute('data-'+language+'-alt'));
 document.querySelectorAll('[data-language]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.language===language)));
}
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
    el.innerHTML=`${escapeHtml(x)}<button aria-label="${L('삭제','Remove')}">×</button>`;
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
    setPhotoStatus(L("⚠️ AI 서버 주소가 연결되지 않았어요. 아래에서 재료를 직접 입력해 주세요.","⚠️ The AI server is not connected. Enter ingredients below."),'error');
    e.target.value=''; return;
  }

  const remaining=Math.max(0,3-state.photosAnalyzed);
  const files=selected.slice(0,remaining);
  if(!files.length){
    setPhotoStatus(L("📷 사진은 최대 3장까지 분석할 수 있어요.","📷 You can analyze up to 3 photos."),'success');
    e.target.value=''; return;
  }

  setBusy(true);
  try{
    for(const file of files){
      const photoNo=state.photosAnalyzed+1;
      setPhotoStatus(`${L(`🔍 ${photoNo}/3번째 사진을 AI가 살펴보고 있어요…`,`🔍 AI is checking photo ${photoNo}/3…`)}`,'loading');
      const imageDataUrl=await resizeImageToDataURL(file);
      const resp=await fetch(`${window.OBOK_AI_API.replace(/\/$/,'')}/analyze-fridge`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl,language})
      });
      const data=await resp.json().catch(()=>({}));
      if(!resp.ok)throw new Error(localizedError(data)||`${L(`서버 오류 (${resp.status})`,`Server error (${resp.status})`)}`);
      const found=Array.isArray(data.ingredients)?data.ingredients.filter(Boolean):[];
      state.ingredients=[...new Set([...state.ingredients,...found])].slice(0,30);
      state.photosAnalyzed++; renderChips();
    }
    const left=3-state.photosAnalyzed;
    setPhotoStatus(
      state.ingredients.length
        ? `${L(`✅ 사진 ${state.photosAnalyzed}장 분석 완료 · ${state.ingredients.length}가지 재료를 찾았어요.`,`✅ ${state.photosAnalyzed} photos analyzed · ${state.ingredients.length} ingredients found.`)}${left?`${L(` 다른 구역 사진을 ${left}장 더 추가할 수 있어요.`,` You can add ${left} more photos.`)}`:L(" 맞는지 확인해 주세요."," Please check the ingredients.")}`
        : `${L(`😊 뚜렷한 재료를 찾지 못했어요.`,`😊 No clear ingredients were found.`)}${left?`${L(` 다른 구역 사진을 ${left}장 더 추가해 보세요.`,` Try ${left} more photos of another area.`)}`:''}`,
      'success'
    );
  }catch(err){
    console.error(err);
    setPhotoStatus(`${L(`⚠️ 사진 분석에 실패했어요. (${err.message})`,`⚠️ Photo analysis failed. (${err.message})`)}`,'error');
  }finally{e.target.value='';setBusy(false);}
});

$('#manualBtn').onclick=()=>{
  state.ingredients=[]; state.photosAnalyzed=0; state.excludeNames=[];
  setPhotoStatus(L("가지고 있는 재료를 하나씩 추가해 주세요.","Add the ingredients you have."));
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
    name:String(r.name||L("오늘의 오복 요리","Today’s OBOK recipe")),
    emoji:String(r.emoji||'🍲'),
    time:String(r.time||$('#time').value||L("20분","20 min")),
    level:String(r.level||L("쉬움","Easy")),
    product:String(r.product||products[0]||'오복 양조간장'),
    desc:String(r.desc||r.reason||L("냉장고 재료를 활용한 오복 AI 셰프 추천 메뉴입니다.","An OBOK AI recipe using your fridge ingredients.")),
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
 if(!n?.values)return `<section class="nutrition-info"><h3>${L('예상 영양정보','Estimated nutrition')}</h3><p>${L('계산할 수 있는 영양자료가 없습니다.','No nutrition data available.')}</p></section>`;
 const v=n.values;
 const title=n.complete?L('1인분 예상 영양정보','Estimated nutrition per serving'):L('확인된 재료만 합산 · 1인분 예상값','Known ingredients only · estimate per serving');
 const rows=[[L('열량','Energy'),v.energy_kcal,'kcal'],[L('탄수화물','Carbohydrate'),v.carbohydrate_g,'g'],[L('단백질','Protein'),v.protein_g,'g'],[L('지방','Fat'),v.fat_g,'g'],[L('나트륨','Sodium'),v.sodium_mg,'mg']];
 return `<section class="nutrition-info"><h3>${title}</h3><table class="nutrition-table"><tbody>${rows.map(([name,value,unit])=>`<tr><th scope="row">${name}</th><td>${escapeHtml(value)} ${unit}</td></tr>`).join('')}</tbody></table><p>${n.complete?L('등록된 재료 모두 계산','All listed ingredients included'):L('전체 요리의 영양값이 아닙니다. 계산 제외: ','Not the nutrition of the whole dish. Excluded: ')+escapeHtml((n.missing||[]).join(', '))} · ${escapeHtml(n.matched_count)}/${escapeHtml(n.total_count)} ${L('개 재료 반영','ingredients included')}</p><small>${L(n.note||'','Estimate based on total ingredient quantities divided by servings. Cooking losses, leftover sauces and actual portions are not included. General ingredients use USDA reference values; products vary.')}<br>${L('출처:','Sources:')} ${escapeHtml((n.sources||[]).map(x=>language==='en'?x.replace('오복식품 제공 제품사양 원본 데이터','Original OBOK product specifications'):x).join(' / '))}</small></section>`;
}
function productSizeText(options,name){
 const item=options.find(x=>x.name===name);
 return item?.sizes?.length ? L('확인된 포장규격: ','Confirmed package size: ')+item.sizes.join(' / ') : L('포장규격은 영업팀에 확인해 주세요.','Ask our sales team for package sizes.');
}
function renderRecommendations(list,more=false){
  state.recommendations=list.map(normalizeRecipe);
  const grid=$('#recipeGrid'); grid.innerHTML='';

  // 기존에 생성된 '다른 요리 3개 더 추천' 버튼이 있으면 먼저 제거
  // (추천을 다시 받을 때 버튼이 계속 누적되는 현상 방지)
  document.querySelectorAll('#moreRecipesBtn').forEach(el=>el.remove());

  const head=$('#recommendations .section-head');
  head.innerHTML=`<span class="eyebrow">${L(`STEP 2 · AI 추천`,`STEP 2 · AI suggestions`)}</span><h2>${more?L("다른 요리도 준비했어요!","Here are some more recipes!"):L("오늘은 이 요리 어때요?","How about these recipes?")}</h2><p>${L(`냉장고 재료와 선택한 인원·조리시간을 바탕으로 AI가 지금 만든 레시피예요.`,`AI recipes based on your ingredients, servings and cooking time.`)}</p>`;
  state.recommendations.forEach((r,i)=>{
    const el=document.createElement('article'); el.className='recipe';
    el.innerHTML=`<div class="emoji">${escapeHtml(r.emoji)}</div><h3>${escapeHtml(r.name)}</h3><div class="meta">⏱ ${escapeHtml(r.time)} · 👨‍🍳 ${escapeHtml(r.level)}</div><p>${escapeHtml(r.desc)}</p><span class="product-badge">${escapeHtml(displayProduct(r.product))} ${L("사용","used")}</span>`;
    el.onclick=()=>detail(i); grid.appendChild(el);
  });
  const moreBtn=document.createElement('button');
  moreBtn.className='primary wide'; moreBtn.id='moreRecipesBtn';
  moreBtn.textContent=L("✨ 다른 요리 3개 더 추천","✨ Suggest 3 more recipes");
  moreBtn.onclick=()=>requestAIRecipes(true);
  grid.after(moreBtn);
  show('#recommendations');
}
async function requestAIRecipes(more=false){
  // 입력창에 적어 둔 재료도 자동 등록
  commitPendingIngredients();
  if(!state.ingredients.length){alert(L("재료를 한 가지 이상 입력해 주세요.","Please enter at least one ingredient."));return;}

  if(!apiConfigured()){
    alert(L("AI 서버가 연결되지 않았습니다.","The AI server is not connected."));
    return;
  }

  const btn = more ? $('#moreRecipesBtn') : $('#recommendBtn');
  const old = btn ? btn.textContent : '';

  if(btn){
    btn.disabled = true;
    btn.textContent = more
      ? L("👨‍🍳 새로운 요리 3개를 만들고 있어요...","👨‍🍳 Creating 3 more recipes...")
      : L("👨‍🍳 오복이가 메뉴를 고민하고 있어요...","👨‍🍳 OBOK is thinking of recipes...");
  }

  setBusy(true);
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
          language,
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
      throw new Error(localizedError(data) || `${L(`서버 오류 (${resp.status})`,`Server error (${resp.status})`)}`);
    }

    const list = Array.isArray(data.recipes) ? data.recipes : [];

    if(!list.length){
      throw new Error(L("추천 레시피를 받지 못했습니다.","No recipes were returned."));
    }

    // 새로 받은 요리 3개 표시
    renderRecommendations(list.slice(0,3), more);

  } catch(err) {

    console.error(err);

    alert(
      `${L(`AI 레시피 추천에 실패했어요.\n잠시 후 다시 시도해 주세요.\n\n${err.message}`,`Recipe generation failed.\nPlease try again shortly.\n\n${err.message}`)}`
    );

  } finally {
    setBusy(false);

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
  const steps=r.steps.length?r.steps:[L("재료를 준비해 주세요.","Prepare the ingredients."),L("재료를 먹기 좋은 크기로 손질해 주세요.","Cut the ingredients into bite-size pieces."),L("팬이나 냄비에서 재료를 익혀 주세요.","Cook the ingredients in a pan or pot."),L("추천된 오복 양념으로 간을 맞춰 주세요.","Season with the recommended OBOK products."),L("재료가 충분히 익도록 마무리해 주세요.","Finish cooking the ingredients thoroughly."),L("접시에 담아 맛있게 즐겨 주세요.","Serve and enjoy.")];
  let products=r.products;
  if(!products.length&&r.product)products=[r.product];
  $('#detailContent').innerHTML=`
    <span class="eyebrow">${L(`STEP 3 · 오복 AI 셰프와 요리하기`,`STEP 3 · Cook with OBOK AI Chef`)}</span>
    <h2 class="recipe-title">${escapeHtml(r.emoji)} ${escapeHtml(r.name)}</h2>
    <p class="lead">${escapeHtml(r.desc)}<br><b>${L(`${escapeHtml(r.servings)} 기준 · ${escapeHtml(r.season)}`,`${escapeHtml(r.servings)} · ${escapeHtml(r.season)}`)}</b><br><b>${L(`사용 재료:`,`Ingredients:`)}</b> ${ing.map(escapeHtml).join(', ')||L("기본 식재료","Basic ingredients")}</p>
    <div class="steps">${steps.map((s,j)=>`<div class="step"><b>${j+1}. ${L(`조리 단계`,`Cooking step`)}</b>${escapeHtml(s)}</div>`).join('')}</div>
    ${products.length?`<div class="shop"><h3>${L(`🛒 이 요리에 어울리는 오복제품`,`🛒 OBOK products for this recipe`)}</h3><p class="lead">${L(`AI가 레시피에 자연스럽게 어울리는 오복 제품을 함께 제안했어요.`,`OBOK products suggested for this recipe.`)}</p>${products.map(p=>{const name=Array.isArray(p)?p[0]:p;return `<div class="product"><img src="${productImage(name)}" alt="${escapeHtml(displayProduct(name))}"><div class="product-copy"><b>${escapeHtml(displayProduct(name))}</b><p>${escapeHtml(productSizeText(r.product_options,name))}</p></div></div>`}).join('')}</div>`:''}`;
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
 if(!apiConfigured()){alert(L("AI 서버가 연결되지 않았습니다.","The AI server is not connected."));return;}
 setBusy(true);
 const btn=$('#schoolRecommendBtn'),old=btn.textContent; btn.disabled=true;btn.textContent=L("👨‍🍳 월~금 급식과 식재료를 구성하고 있어요...","👨‍🍳 Planning Monday–Friday meals and ingredients...");
 try{
  const people=Math.max(1,Math.min(5000,Math.floor(Number($('#schoolPeople').value)||500)));
  const resp=await fetch(`${window.OBOK_AI_API.replace(/\/$/,'')}/recommend-school-menu`,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({language,schoolLevel:$('#schoolLevel').value,season:$('#schoolSeason').value,people,budget:Number($('#schoolBudget').value)||0,exclude:$('#schoolExclude').value||'',requiredMenus:$('#schoolRequiredMenus').value||'',excludedMenus:$('#schoolExcludedMenus').value||'',extraRequest:$('#schoolRequest').value||''})
  });
  const data=await resp.json().catch(()=>({})); if(!resp.ok)throw new Error(localizedError(data)||`${L(`서버 오류 (${resp.status})`,`Server error (${resp.status})`)}`);
  const days=Array.isArray(data.days)?data.days:[]; if(days.length!==5)throw new Error(L("월~금 5일 식단을 모두 받지 못했습니다.","A complete 5-day menu was not returned."));
  const grid=$('#schoolMenuGrid');grid.innerHTML='';
  days.forEach(d=>{
   const menu=(Array.isArray(d.menu)?d.menu:[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('');
   const ing=(Array.isArray(d.ingredients)?d.ingredients:[]).map(x=>`<li><span>${escapeHtml(x.name||'')}</span><b>${escapeHtml(x.quantity||'')}</b></li>`).join('');
   const products=(Array.isArray(d.obok_products)?d.obok_products:[]).map(x=>`<span class="school-product">${escapeHtml(displayProduct(x))} · ${escapeHtml(productSizeText(d.product_options||[],x))}</span>`).join('');
   const el=document.createElement('article');el.className='school-day';
   el.innerHTML=`<h3>${escapeHtml(displayDay(d.day||''))}</h3><ul class="school-menu-list">${menu}</ul><p class="balance-note">${escapeHtml(d.balance_note||'')}</p><h4>${L(`주요 식재료 · `,`Ingredients · `)}${L(`${people.toLocaleString()}명 기준`,`${people.toLocaleString()} students`)}</h4><ul class="school-ingredients">${ing}</ul>${products?`<div class="school-products">${products}</div>`:''}`;
   el.insertAdjacentHTML('beforeend',`<h4>${L(`주찬 조리과정`,`Main dish cooking steps`)}</h4><ol>${(d.cooking_steps||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||`<li>${L('서버 코드 업데이트 후 제공됩니다.','Available after the server update.')}</li>`}</ol>${nutritionHtml(d.nutrition)}`);
   grid.appendChild(el);
  });
  const oldSummary=document.querySelector('#schoolResults .school-summary'); if(oldSummary)oldSummary.remove();
  const summary=document.createElement('div');summary.className='card school-summary';
  const shopping=(Array.isArray(data.weekly_shopping)?data.weekly_shopping:[]).map(x=>`<li><span>${escapeHtml(x.name||'')}</span><b>${escapeHtml(x.quantity||'')}</b></li>`).join('');
  summary.innerHTML=`<div class="section-head"><span class="eyebrow">WEEKLY SHOPPING</span><h2>${L(`한 주 주요 식재료 취합`,`Weekly ingredient shopping list`)}</h2><p>${L(`${people.toLocaleString()}명 급식 기준 AI 예상 구매량입니다.`,`AI estimated shopping quantities for ${people.toLocaleString()} students.`)}</p></div><ul class="weekly-shopping">${shopping}</ul><p class="review-note">※ ${escapeHtml(data.review_note||L("실제 제공 전 학교 영양사가 최종 검토해 주세요.","Have a qualified school nutritionist review the plan before serving."))}</p>`;
  $('#schoolResults').appendChild(summary); show('#schoolResults'); $('#schoolResults').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(err){console.error(err);alert(`${L(`학교급식 식단 생성에 실패했어요.\n잠시 후 다시 시도해 주세요.\n\n${err.message}`,`School meal generation failed.\nPlease try again shortly.\n\n${err.message}`)}`)}
 finally{btn.disabled=false;btn.textContent=old;setBusy(false);}
};

applyLanguage();
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{
 if(activeRequests||language===button.dataset.language)return;
 language=button.dataset.language;
 try{localStorage.setItem('obok-chef-language',language);}catch{}
 state.recommendations=[];state.excludeNames=[];
 ['#recommendations','#detail','#schoolResults'].forEach(id=>$(id).classList.add('hidden'));
 $('#recipeGrid').innerHTML='';$('#detailContent').innerHTML='';$('#schoolMenuGrid').innerHTML='';
 document.querySelectorAll('#moreRecipesBtn,.school-summary').forEach(el=>el.remove());
 applyLanguage();renderChips();
 if(!$('#ingredients').classList.contains('hidden'))setPhotoStatus(L('재료를 확인하고 새 언어로 추천받아 주세요.','Check your ingredients and request recipes in the selected language.'));
}));
