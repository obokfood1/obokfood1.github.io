const $ = s => document.querySelector(s);

const state = {
  ingredients: [],
  aiRecipes: []
};

const PRODUCT_IMAGES = {
  "오복 양조간장": "../assets/soy.webp",
  "오복 국간장": "../assets/soy.webp",
  "오복 고추장": "../assets/gochujang.webp",
  "오복 된장": "../assets/gochujang.webp",
  "오복 쌈장": "../assets/gochujang.webp",
  "오복 참기름": "../assets/soy.webp"
};

const FALLBACK_RECIPE = {
  name: "오복 간장 계란 덮밥",
  emoji: "🍳",
  time: "7분",
  level: "초간단",
  reason: "냉장고가 비어 있어도 밥과 계란만 준비하면 만들 수 있어요.",
  ingredients: ["밥 1공기", "계란 2개", "오복 양조간장 1~1.5큰술", "오복 참기름 1작은술"],
  steps: [
    "따뜻한 밥 1공기를 그릇에 담아요.",
    "팬에 기름을 조금 두르고 계란후라이 2개를 만들어요.",
    "밥 위에 계란후라이를 올려요.",
    "오복 양조간장 1~1.5큰술을 골고루 둘러요.",
    "오복 참기름 1작은술을 넣고, 있으면 김가루나 깨를 살짝 올려요.",
    "노른자를 톡 터뜨려 밥과 잘 비비면 완성!"
  ],
  products: ["오복 양조간장", "오복 참기름"]
};

function show(id) {
  const el = $(id);
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[m]));
}

function apiConfigured() {
  return window.OBOK_AI_API &&
    !window.OBOK_AI_API.includes("YOUR-WORKER-URL");
}

function setPhotoStatus(text, type = "") {
  const el = $("#photoName");
  el.textContent = text;
  el.dataset.type = type;
}

function renderChips() {
  const c = $("#chips");
  c.innerHTML = "";

  state.ingredients.forEach((ingredient, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(ingredient)}<button type="button" aria-label="삭제">×</button>`;
    chip.querySelector("button").onclick = () => {
      state.ingredients.splice(i, 1);
      renderChips();
    };
    c.appendChild(chip);
  });
}

async function resizeImageToDataURL(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const maxSide = 1600;
  let w = img.width;
  let h = img.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", 0.82);
}

async function callApi(path, body) {
  const base = window.OBOK_AI_API.replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `서버 오류 (${response.status})`);
  }
  return data;
}

// ----------------------------
// Photo recognition
// ----------------------------
$("#photo").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  state.ingredients = [];
  state.aiRecipes = [];
  renderChips();
  show("#ingredients");

  if (!apiConfigured()) {
    setPhotoStatus("⚠️ AI 서버가 아직 연결되지 않았어요. 재료를 직접 입력해 주세요.", "error");
    return;
  }

  try {
    setPhotoStatus("🔍 오복이가 냉장고 사진을 살펴보고 있어요…", "loading");
    const imageDataUrl = await resizeImageToDataURL(file);
    const data = await callApi("/analyze-fridge", { imageDataUrl });

    state.ingredients = Array.isArray(data.ingredients)
      ? data.ingredients.filter(Boolean).slice(0, 15)
      : [];

    renderChips();

    if (state.ingredients.length) {
      setPhotoStatus(
        `✅ ${state.ingredients.length}가지 재료를 찾았어요. 틀린 재료는 지우고, 빠진 재료는 추가해 주세요.`,
        "success"
      );
    } else {
      setPhotoStatus(
        "😊 눈에 띄는 재료를 찾지 못했어요. 그대로 추천받기를 누르면 오복이의 초간단 기본 메뉴를 알려드릴게요.",
        "success"
      );
    }
  } catch (err) {
    console.error(err);
    setPhotoStatus(
      `⚠️ 사진 분석에 실패했어요. 재료를 직접 입력해도 됩니다. (${err.message})`,
      "error"
    );
  }
});

$("#manualBtn").onclick = () => {
  state.ingredients = [];
  state.aiRecipes = [];
  setPhotoStatus("가지고 있는 재료를 하나씩 추가해 주세요.");
  renderChips();
  show("#ingredients");
};

function addIngredient() {
  const input = $("#ingredientInput");
  const value = input.value.trim();

  if (value && !state.ingredients.includes(value)) {
    state.ingredients.push(value);
    renderChips();
  }

  input.value = "";
  input.focus();
}

$("#addBtn").onclick = addIngredient;
$("#ingredientInput").addEventListener("keydown", e => {
  if (e.key === "Enter") addIngredient();
});

// ----------------------------
// Recipe generation
// ----------------------------
function renderRecipeCards(recipes) {
  const grid = $("#recipeGrid");
  grid.innerHTML = "";

  recipes.forEach((r, index) => {
    const card = document.createElement("article");
    card.className = "recipe";
    const products = Array.isArray(r.products) ? r.products : [];

    card.innerHTML = `
      <div class="emoji">${escapeHtml(r.emoji || "🍽️")}</div>
      <h3>${escapeHtml(r.name)}</h3>
      <div class="meta">⏱ ${escapeHtml(r.time || "20분")} · 👨‍🍳 ${escapeHtml(r.level || "쉬움")}</div>
      <p>${escapeHtml(r.reason || "")}</p>
      <span class="product-badge">${products.length ? escapeHtml(products.join(" + ")) : "오복 제품 활용"}</span>
    `;

    card.onclick = () => renderDetail(r);
    grid.appendChild(card);
  });
}

$("#recommendBtn").onclick = async () => {
  const section = $("#recommendations");
  const head = section.querySelector(".section-head");
  const grid = $("#recipeGrid");
  show("#recommendations");

  if (state.ingredients.length === 0) {
    head.innerHTML = `
      <span class="eyebrow">STEP 2</span>
      <h2>냉장고가 비어 있어도 괜찮아요 😊</h2>
      <p>오복이가 가장 간단한 한 끼를 준비했어요. <b>밥과 계란 2개</b>만 준비해 주세요!</p>
    `;
    state.aiRecipes = [FALLBACK_RECIPE];
    renderRecipeCards(state.aiRecipes);
    return;
  }

  head.innerHTML = `
    <span class="eyebrow">STEP 2</span>
    <h2>오복이가 메뉴를 생각하고 있어요… 👨‍🍳</h2>
    <p>냉장고 재료와 조리시간을 보고 가장 쉬운 메뉴를 골라볼게요.</p>
  `;
  grid.innerHTML = `<div class="ai-loading">🍳 잠시만 기다려 주세요. 오복이가 레시피 3가지를 만들고 있어요…</div>`;

  if (!apiConfigured()) {
    grid.innerHTML = `<div class="ai-error">AI 서버 연결을 확인해 주세요.</div>`;
    return;
  }

  try {
    const data = await callApi("/recommend-recipes", {
      ingredients: state.ingredients,
      people: $("#people").value,
      time: $("#time").value
    });

    state.aiRecipes = Array.isArray(data.recipes) ? data.recipes.slice(0, 3) : [];

    if (!state.aiRecipes.length) {
      throw new Error("추천 레시피를 받지 못했습니다.");
    }

    head.innerHTML = `
      <span class="eyebrow">STEP 2</span>
      <h2>오늘은 이 요리 어때요?</h2>
      <p><b>${state.ingredients.map(escapeHtml).join(", ")}</b>을 활용한 쉬운 메뉴 3가지를 준비했어요.</p>
    `;

    renderRecipeCards(state.aiRecipes);
  } catch (err) {
    console.error(err);
    head.innerHTML = `
      <span class="eyebrow">STEP 2</span>
      <h2>추천을 잠시 불러오지 못했어요</h2>
      <p>재료를 다시 확인하고 한 번 더 시도해 주세요.</p>
    `;
    grid.innerHTML = `<div class="ai-error">⚠️ ${escapeHtml(err.message)}</div>`;
  }
};

function renderDetail(r) {
  const recipeIngredients = Array.isArray(r.ingredients) ? r.ingredients : [];
  const steps = Array.isArray(r.steps) ? r.steps.slice(0, 6) : [];
  const products = Array.isArray(r.products) ? r.products : [];

  const stepTitles = [
    "재료 준비", "먼저 시작하기", "오복 양념 넣기",
    "함께 조리하기", "맛있게 마무리", "완성!"
  ];

  $("#detailContent").innerHTML = `
    <span class="eyebrow">STEP 3 · 오복이와 요리하기</span>
    <h2 class="recipe-title">${escapeHtml(r.emoji || "🍽️")} ${escapeHtml(r.name)}</h2>
    <p class="lead">
      ${escapeHtml(r.reason || "")}<br>
      <b>⏱ ${escapeHtml(r.time || "")}</b> ·
      <b>난이도 ${escapeHtml(r.level || "")}</b>
    </p>

    ${recipeIngredients.length ? `
      <div class="ingredient-box">
        <h3>🥕 필요한 재료</h3>
        <div class="ingredient-list">
          ${recipeIngredients.map(x => `<span>${escapeHtml(x)}</span>`).join("")}
        </div>
      </div>
    ` : ""}

    <div class="steps">
      ${steps.map((step, i) => `
        <div class="step">
          <b>${i + 1}. ${stepTitles[i] || "조리하기"}</b>
          ${escapeHtml(step)}
        </div>
      `).join("")}
    </div>

    <div class="shop">
      <h3>🛒 이 요리에 사용한 오복제품</h3>
      <p class="lead">레시피를 먼저 완성하고, 필요한 오복제품은 아래에서 확인할 수 있어요.</p>

      ${products.map(product => `
        <div class="product">
          <img src="${PRODUCT_IMAGES[product] || "../assets/soy.webp"}" alt="${escapeHtml(product)}">
          <div class="product-copy">
            <b>${escapeHtml(product)}</b>
            <p>오복이 레시피에 사용된 제품입니다.</p>
          </div>
          <a class="buy disabled" href="#" title="실제 판매 URL 연결 예정">구매 링크 등록 예정</a>
        </div>
      `).join("")}
    </div>
  `;

  show("#detail");
}

$("#backBtn").onclick = () => show("#recommendations");

renderChips();
