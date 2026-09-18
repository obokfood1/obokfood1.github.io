const OPENAI_API = "https://api.openai.com/v1/responses";

const ALLOWED_PRODUCTS = [
  "오복 양조간장",
  "오복 국간장",
  "오복 고추장",
  "오복 된장",
  "오복 쌈장",
  "오복 참기름"
];

const OPENAI_TIMEOUT_MS = 25000;
const RECIPE_CACHE_SECONDS = 60 * 60 * 6;
const IMAGE_CACHE_SECONDS = 60 * 30;
const SCHOOL_MENU_CACHE_SECONDS = 60 * 60 * 6;

function corsHeaders(origin, env) {
  const configured = (
    env.ALLOWED_ORIGINS ||
    "https://obokfoods.com,https://www.obokfoods.com,https://obokfood1.github.io"
  )
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);

  const allowed = configured.includes(origin) ? origin : configured[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin, env)
    }
  });
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
}

function parseJsonObject(text) {
  const clean = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(clean);
  } catch {}

  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");

  if (first < 0 || last <= first) {
    throw new Error("No JSON object found.");
  }

  return JSON.parse(clean.slice(first, last + 1));
}

function isBusyError(e) {
  const m = String(e?.message || "");
  return m === "OPENAI_TIMEOUT" || m.startsWith("OPENAI_BUSY:");
}

function normalizeForCache(value) {
  if (Array.isArray(value)) return value.map(normalizeForCache);

  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((o, k) => {
      o[k] = normalizeForCache(value[k]);
      return o;
    }, {});
  }

  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function makeCacheRequest(kind, payload) {
  const normalized = JSON.stringify(normalizeForCache(payload));
  const hash = await sha256Hex(normalized);

  return new Request(`https://obok-ai-chef-cache.internal/${kind}/${hash}`, {
    method: "GET"
  });
}

async function cacheGet(cacheRequest) {
  try {
    const hit = await caches.default.match(cacheRequest);
    return hit ? await hit.json() : null;
  } catch {
    return null;
  }
}

async function cachePut(cacheRequest, data, seconds) {
  try {
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${seconds}`
      }
    });

    await caches.default.put(cacheRequest, response);
  } catch (e) {
    console.warn("Cache put failed", e);
  }
}

function retryAfterJson(origin, env) {
  const response = json({
    error: "AI chef is temporarily busy. Please try again shortly.",
    code: "AI_BUSY"
  }, 503, origin, env);

  response.headers.set("Retry-After", "5");
  return response;
}

async function callOpenAI(env, content, maxOutputTokens = 1500, outputFormat = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const model = env.OPENAI_MODEL || "gpt-5.6-luna";
  const startedAt = Date.now();

  const requestBody = {
    model,
    input: [{
      role: "user",
      content
    }],
    max_output_tokens: maxOutputTokens
  };

  if (outputFormat) {
    requestBody.text = {
      format: outputFormat
    };
  }

  let response;

  try {
    response = await fetch(OPENAI_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("OPENAI_TIMEOUT");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const elapsedMs = Date.now() - startedAt;
  const raw = await response.text();

  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw_response: raw.slice(0, 2000) };
  }

  if (!response.ok) {
    const apiMessage =
      data?.error?.message ||
      data?.message ||
      data?.raw_response ||
      "Unknown OpenAI API error";

    console.error("OpenAI HTTP error", {
      status: response.status,
      model,
      elapsed_ms: elapsedMs,
      request_id: response.headers.get("x-request-id") || "",
      error_message: apiMessage
    });

    if (response.status === 429 || response.status >= 500) {
      throw new Error(`OPENAI_BUSY:${response.status}:${apiMessage}`);
    }

    throw new Error(`OPENAI_HTTP_${response.status}:${apiMessage}`);
  }

  const output = extractOutputText(data);

  if (!output) {
    console.error("OpenAI returned no output text", {
      status: data?.status || "",
      incomplete_details: data?.incomplete_details || null
    });
    throw new Error("OPENAI_EMPTY_OUTPUT");
  }

  return output;
}

async function analyzeFridge(request, env, origin) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return json({ error: "Invalid JSON body." }, 400, origin, env);
  }

  const imageDataUrl = body.imageDataUrl;

  if (
    typeof imageDataUrl !== "string" ||
    !imageDataUrl.startsWith("data:image/")
  ) {
    return json({ error: "imageDataUrl is required." }, 400, origin, env);
  }

  if (imageDataUrl.length > 8000000) {
    return json({ error: "Image is too large." }, 413, origin, env);
  }

  const imageCacheRequest = await makeCacheRequest("fridge", {
    imageHash: await sha256Hex(imageDataUrl)
  });

  const cachedImage = await cacheGet(imageCacheRequest);

  if (cachedImage && Array.isArray(cachedImage.ingredients)) {
    return json({ ...cachedImage, cached: true }, 200, origin, env);
  }

  const prompt = `
You are the vision engine for O'Bok Foods' Korean AI cooking assistant.

Carefully scan the ENTIRE refrigerator or food photo and identify as many visible edible ingredients as possible.

Rules:
- Use short Korean ingredient names.
- Scan the entire image, not just one area.
- Include vegetables, fruit, meat, seafood, eggs, tofu, dairy, kimchi, side dishes, sauces, seasonings and beverages when clearly visible.
- Convert brand products to common food names.
- Do not guess completely hidden ingredients.
- Ignore cookware and non-food objects.
- Merge duplicates.
- Maximum 30 ingredients.
`.trim();

  const format = {
    type: "json_schema",
    name: "fridge_ingredients",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ingredients: {
          type: "array",
          maxItems: 30,
          items: { type: "string" }
        }
      },
      required: ["ingredients"]
    }
  };

  let text;

  try {
    text = await callOpenAI(env, [
      { type: "input_text", text: prompt },
      { type: "input_image", image_url: imageDataUrl, detail: "high" }
    ], 500, format);
  } catch (e) {
    console.error("Image AI failed", e);
    if (isBusyError(e)) return retryAfterJson(origin, env);
    return json({ error: "AI image analysis failed." }, 502, origin, env);
  }

  let parsed;

  try {
    parsed = parseJsonObject(text);
  } catch {
    return json({ error: "AI returned an invalid format." }, 502, origin, env);
  }

  const ingredients = Array.isArray(parsed.ingredients)
    ? [...new Set(
        parsed.ingredients
          .map(x => String(x).trim())
          .filter(Boolean)
      )].slice(0, 30)
    : [];

  const result = { ingredients };

  await cachePut(imageCacheRequest, result, IMAGE_CACHE_SECONDS);
  return json(result, 200, origin, env);
}

async function recommendRecipes(request, env, origin) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return json({ error: "Invalid JSON body." }, 400, origin, env);
  }

  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients
        .map(x => String(x).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const people = String(body.people || "2명").slice(0, 20);
  const time = String(body.time || "20분 이내").slice(0, 30);
  const preference = String(body.preference || "").trim().slice(0, 120);

  const excludeNames = Array.isArray(body.excludeNames)
    ? body.excludeNames.map(x => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];

  if (!ingredients.length) {
    return json({
      recipes: [{
        name: "오복 간장 계란 덮밥",
        emoji: "🍳",
        time: "7분",
        level: "초간단",
        reason: "냉장고가 비어 있어도 밥과 계란만 준비하면 만들 수 있는 오복이의 기본 한 끼예요.",
        ingredients: [
          "밥 1공기",
          "계란 2개",
          "오복 양조간장 1~1.5큰술",
          "오복 참기름 1작은술"
        ],
        steps: [
          "따뜻한 밥 1공기를 그릇에 담아요.",
          "팬에 기름을 조금 두르고 계란후라이 2개를 만들어요.",
          "밥 위에 계란후라이를 올려요.",
          "오복 양조간장 1~1.5큰술을 골고루 둘러요.",
          "오복 참기름 1작은술을 넣고 김가루나 깨가 있으면 올려요.",
          "노른자를 터뜨려 밥과 잘 비비면 완성입니다."
        ],
        products: ["오복 양조간장", "오복 참기름"]
      }]
    }, 200, origin, env);
  }

  const recipeCacheRequest = await makeCacheRequest("recipes", {
    ingredients: [...ingredients].sort(),
    people,
    time,
    preference,
    excludeNames
  });

  const cachedRecipe = await cacheGet(recipeCacheRequest);

  if (cachedRecipe && Array.isArray(cachedRecipe.recipes)) {
    return json({ ...cachedRecipe, cached: true }, 200, origin, env);
  }

  const prompt = `
You are "오복이", the friendly AI chef for O'Bok Foods.

Available ingredients: ${ingredients.join(", ")}
People: ${people}
Preferred cooking time: ${time}
Extra request: ${preference || "없음"}
Already shown recipes to avoid: ${excludeNames.length ? excludeNames.join(", ") : "없음"}

Create exactly 3 practical Korean home-cooking recipes for a beginner.

Rules:
1. Use the available ingredients as much as possible.
2. Common pantry staples may be assumed.
3. Each recipe must naturally use at least one allowed O'Bok product.
4. Allowed O'Bok products only: ${ALLOWED_PRODUCTS.join(", ")}.
5. Give exactly 6 short cooking steps.
6. Use Korean.
7. Avoid previously shown recipe names whenever reasonable.
8. Keep the 3 recipes meaningfully different.
9. Do not make medical or health claims.
`.trim();

  const recipeFormat = {
    type: "json_schema",
    name: "obok_recipes",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        recipes: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              emoji: { type: "string" },
              time: { type: "string" },
              level: { type: "string" },
              reason: { type: "string" },
              ingredients: {
                type: "array",
                items: { type: "string" }
              },
              steps: {
                type: "array",
                minItems: 6,
                maxItems: 6,
                items: { type: "string" }
              },
              products: {
                type: "array",
                items: {
                  type: "string",
                  enum: ALLOWED_PRODUCTS
                }
              }
            },
            required: [
              "name", "emoji", "time", "level", "reason",
              "ingredients", "steps", "products"
            ]
          }
        }
      },
      required: ["recipes"]
    }
  };

  let text;

  try {
    text = await callOpenAI(
      env,
      [{ type: "input_text", text: prompt }],
      3000,
      recipeFormat
    );
  } catch (e) {
    console.error("Recipe AI failed", e);
    if (isBusyError(e)) return retryAfterJson(origin, env);
    return json({ error: "AI recipe generation failed." }, 502, origin, env);
  }

  let parsed;

  try {
    parsed = parseJsonObject(text);
  } catch {
    return json({ error: "AI returned an invalid recipe format." }, 502, origin, env);
  }

  const recipes = Array.isArray(parsed.recipes)
    ? parsed.recipes.slice(0, 3).map(r => ({
        name: String(r.name || "오복 추천 요리").slice(0, 60),
        emoji: String(r.emoji || "🍽️").slice(0, 8),
        time: String(r.time || "20분").slice(0, 20),
        level: String(r.level || "쉬움").slice(0, 20),
        reason: String(r.reason || "").slice(0, 200),
        ingredients: Array.isArray(r.ingredients)
          ? r.ingredients.map(x => String(x).slice(0, 100)).slice(0, 20)
          : [],
        steps: Array.isArray(r.steps)
          ? r.steps.map(x => String(x).slice(0, 250)).slice(0, 6)
          : [],
        products: Array.isArray(r.products)
          ? r.products.map(String).filter(x => ALLOWED_PRODUCTS.includes(x)).slice(0, 3)
          : []
      })).filter(r => r.name && r.steps.length === 6)
    : [];

  if (!recipes.length) {
    return json({ error: "No usable recipes were generated." }, 502, origin, env);
  }

  const result = { recipes };

  await cachePut(recipeCacheRequest, result, RECIPE_CACHE_SECONDS);
  return json(result, 200, origin, env);
}

function cleanSchoolDay(d, dayName) {
  const menu = Array.isArray(d?.menu)
    ? d.menu.map(x => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 7)
    : [];

  const ingredients = Array.isArray(d?.ingredients)
    ? d.ingredients.map(x => ({
        name: String(x?.name || "").trim().slice(0, 60),
        quantity: String(x?.quantity || "").trim().slice(0, 40)
      })).filter(x => x.name).slice(0, 25)
    : [];

  const obokProducts = Array.isArray(d?.obok_products)
    ? d.obok_products
        .map(String)
        .filter(x => ALLOWED_PRODUCTS.includes(x))
        .slice(0, 3)
    : [];

  return {
    day: dayName,
    menu,
    balance_note: String(d?.balance_note || "").trim().slice(0, 240),
    ingredients,
    obok_products: obokProducts
  };
}

function buildWeeklyShoppingFromDays(days) {
  const map = new Map();

  for (const day of days) {
    for (const item of day.ingredients || []) {
      const name = String(item?.name || "").trim();
      const quantity = String(item?.quantity || "").trim();

      if (!name) continue;

      if (!map.has(name)) {
        map.set(name, []);
      }

      if (quantity) {
        map.get(name).push(quantity);
      }
    }
  }

  return [...map.entries()].slice(0, 80).map(([name, quantities]) => ({
    name,
    quantity: quantities.length ? quantities.join(" + ") : "현장 산정"
  }));
}

const SCHOOL_MENU_FORMAT = {
  type: "json_schema",
  name: "obok_school_menu",
  description: "A five-day Korean school lunch plan with ingredients and a weekly shopping list.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      days: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: {
              type: "string",
              enum: ["월요일", "화요일", "수요일", "목요일", "금요일"]
            },
            menu: {
              type: "array",
              minItems: 5,
              maxItems: 7,
              items: { type: "string" }
            },
            balance_note: { type: "string" },
            ingredients: {
              type: "array",
              minItems: 3,
              maxItems: 25,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  quantity: { type: "string" }
                },
                required: ["name", "quantity"]
              }
            },
            obok_products: {
              type: "array",
              maxItems: 3,
              items: {
                type: "string",
                enum: ALLOWED_PRODUCTS
              }
            }
          },
          required: [
            "day", "menu", "balance_note",
            "ingredients", "obok_products"
          ]
        }
      },
      weekly_shopping: {
        type: "array",
        maxItems: 80,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            quantity: { type: "string" }
          },
          required: ["name", "quantity"]
        }
      },
      review_note: { type: "string" }
    },
    required: ["days", "weekly_shopping", "review_note"]
  }
};

async function recommendSchoolMenu(request, env, origin) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return json({ error: "Invalid JSON body." }, 400, origin, env);
  }

  const schoolLevel = String(body.schoolLevel || "중학교").trim().slice(0, 20);
  const people = Math.max(1, Math.min(5000, Number(body.people) || 500));
  const budget = Math.max(0, Number(body.budget) || 0);
  const exclude = String(body.exclude || "").trim().slice(0, 300);
  const requiredMenus = String(body.requiredMenus || "").trim().slice(0, 500);
  const excludedMenus = String(body.excludedMenus || "").trim().slice(0, 500);
  const extraRequest = String(body.extraRequest || "").trim().slice(0, 500);

  // Front-end can send the previous four weeks' menu names.
  // This keeps compatibility even when the field is absent.
  const recentMenuNames = Array.isArray(body.recentMenuNames)
    ? [...new Set(
        body.recentMenuNames
          .map(x => String(x).trim())
          .filter(Boolean)
      )].slice(0, 120)
    : [];

  // A week key makes a new week's request different from a previous week's cache.
  // If the front-end sends weekKey, use it. Otherwise derive the current ISO-like week.
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((now - yearStart) / 86400000) + yearStart.getUTCDay() + 1) / 7);
  const weekKey = String(
    body.weekKey ||
    `${now.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
  ).slice(0, 30);

  const cacheRequest = await makeCacheRequest("school-menu-v8", {
    schoolLevel,
    people,
    budget,
    exclude,
    requiredMenus,
    excludedMenus,
    extraRequest,
    recentMenuNames,
    weekKey
  });

  const cached = await cacheGet(cacheRequest);

  if (cached && Array.isArray(cached.days) && cached.days.length === 5) {
    return json({ ...cached, cached: true }, 200, origin, env);
  }

  const prompt = `
당신은 오복식품의 학교급식 AI 셰프입니다.
한국 학교 영양사가 최종 검토할 수 있는 월요일~금요일 5일 급식 초안을 만드세요.

학교급: ${schoolLevel}
1일 급식 인원: ${people}명
1인당 식재료 예산: ${budget ? budget + "원" : "미입력"}
알레르기/제외 식재료: ${exclude || "없음"}
필수 포함 메뉴: ${requiredMenus || "없음"}
제외 메뉴: ${excludedMenus || "없음"}
추가 요청: ${extraRequest || "없음"}
이번 주 식단 키: ${weekKey}

최근 4주에 이미 사용한 메뉴명:
${recentMenuNames.length ? recentMenuNames.join(", ") : "제공된 기록 없음"}

중요 규칙:
1. 월요일, 화요일, 수요일, 목요일, 금요일을 정확히 5일 만드세요.
2. 각 날짜는 5~7개 항목의 현실적인 학교급식으로 구성하세요.
3. 밥/곡류 또는 다른 주식, 국/찌개, 단백질 중심 주찬, 채소 반찬, 김치, 과일/후식 등을 상황에 맞게 균형 있게 구성하세요.
4. 성장기 학생을 고려해 곡류, 단백질 식품, 채소류, 과일류 등의 다양성을 고려하세요.
5. 육류, 생선/해산물, 달걀, 두부/콩류 등 단백질원이 한쪽에 치우치지 않게 하세요.
6. 튀김, 볶음, 조림, 구이, 찜, 무침 등 조리법도 주간에 다양하게 구성하세요.
7. 최근 4주 메뉴 목록이 제공되었다면 동일한 메뉴명은 가능한 한 사용하지 마세요. 특히 주찬과 국/찌개는 중복을 강하게 피하세요.
8. 같은 주 안에서도 같은 주찬이나 국/찌개를 반복하지 마세요.
9. 알레르기/제외 식재료를 반드시 피하세요.
10. 필수 포함 메뉴가 있으면 각 메뉴를 주간 식단에 최소 1회 반드시 포함하세요. 요일이 함께 적혀 있으면 해당 요일에 배치하세요.
11. 제외 메뉴는 식단에 절대 포함하지 마세요. 필수 메뉴가 알레르기·제외 식재료 또는 제외 메뉴와 충돌하면 안전과 제외 조건을 우선하고 해당 요일의 balance_note에 충돌 사유를 짧게 설명하세요.
12. 예산이 입력되었다면 현실적으로 고려하세요.
13. 대량급식 조리가 가능한 현실적인 메뉴를 사용하세요.
14. 각 날짜마다 ${people}명 기준 주요 식재료와 예상 구매량을 적으세요.
15. 수량은 kg, L, 개, 봉 등 현장에서 이해하기 쉬운 단위를 사용하세요.
16. 각 날짜에 balance_note를 짧게 작성하세요.
17. 오복 제품은 억지로 넣지 말고 자연스럽게 필요한 경우에만 사용하세요.
18. 사용 가능한 오복 제품명은 다음뿐입니다: ${ALLOWED_PRODUCTS.join(", ")}.
19. weekly_shopping에는 5일 전체 주요 구매 식재료를 합산한 주간 구매목록을 작성하세요.
20. 공식 영양기준을 충족한다고 단정하지 말고, 영양사의 최종 검토용 초안으로 작성하세요.
21. 모든 내용은 한국어로 작성하세요.
`.trim();

  let text;

  try {
    text = await callOpenAI(
      env,
      [{ type: "input_text", text: prompt }],
      6500,
      SCHOOL_MENU_FORMAT
    );
  } catch (e) {
    console.error("School menu AI failed", {
      message: e?.message || String(e),
      stack: e?.stack || ""
    });

    if (isBusyError(e)) {
      return retryAfterJson(origin, env);
    }

    return json({
      error: "AI school menu generation failed.",
      detail: String(e?.message || "").slice(0, 300)
    }, 502, origin, env);
  }

  let parsed;

  try {
    parsed = parseJsonObject(text);
  } catch (e) {
    console.error("School menu JSON parse failed", {
      message: e?.message || String(e),
      output_preview: String(text || "").slice(0, 1000)
    });

    return json({
      error: "AI returned an invalid school menu format."
    }, 502, origin, env);
  }

  const validDays = ["월요일", "화요일", "수요일", "목요일", "금요일"];

  const sourceDays = Array.isArray(parsed.days) ? parsed.days : [];

  const days = validDays.map((dayName, index) => {
    const byName = sourceDays.find(d => String(d?.day || "").trim() === dayName);
    const source = byName || sourceDays[index] || {};
    return cleanSchoolDay(source, dayName);
  });

  const complete = days.every(d =>
    Array.isArray(d.menu) &&
    d.menu.length >= 5 &&
    Array.isArray(d.ingredients) &&
    d.ingredients.length >= 3
  );

  if (!complete) {
    console.error("School menu normalization incomplete", {
      day_lengths: days.map(d => ({
        day: d.day,
        menu: d.menu.length,
        ingredients: d.ingredients.length
      }))
    });

    return json({
      error: "AI did not generate a complete 5-day menu."
    }, 502, origin, env);
  }

  let weeklyShopping = Array.isArray(parsed.weekly_shopping)
    ? parsed.weekly_shopping.map(x => ({
        name: String(x?.name || "").trim().slice(0, 60),
        quantity: String(x?.quantity || "").trim().slice(0, 40)
      })).filter(x => x.name).slice(0, 80)
    : [];

  // Safety fallback: if the model somehow returns no weekly shopping list,
  // build one from the daily ingredient lists instead of failing the page.
  if (!weeklyShopping.length) {
    weeklyShopping = buildWeeklyShoppingFromDays(days);
  }

  const result = {
    days,
    weekly_shopping: weeklyShopping,
    review_note: String(
      parsed.review_note ||
      "실제 제공 전 학교 영양사가 학교급식 관련 기준, 알레르기, 식재료 규격 및 학교별 영양관리 기준을 확인해 최종 검토해 주세요."
    ).slice(0, 300),
    week_key: weekKey
  };

  await cachePut(cacheRequest, result, SCHOOL_MENU_CACHE_SECONDS);
  return json(result, 200, origin, env);
}

async function enforceAiRateLimit(request, env, origin, pathname) {
  if (!env.AI_RATE_LIMITER) return null;

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${pathname}:${ip}`;

  try {
    const { success } = await env.AI_RATE_LIMITER.limit({ key });

    if (success) return null;

    const response = json({
      error: "요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.",
      code: "RATE_LIMITED"
    }, 429, origin, env);

    response.headers.set("Retry-After", "60");
    return response;
  } catch (e) {
    console.error("Rate limiter failed open", e);
    return null;
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env)
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "obok-ai-chef",
        version: "8.0-structured-school-menu",
        features: [
          "fridge-vision",
          "recipe-ai",
          "school-meal-ai",
          "structured-output",
          "weekly-shopping",
          "recent-4-week-menu-avoidance",
          "edge-cache",
          "timeout-protection",
          "rate-limit-10-per-minute"
        ]
      }, 200, origin, env);
    }

    if (!env.OPENAI_API_KEY) {
      return json({
        error: "OPENAI_API_KEY secret is not configured."
      }, 500, origin, env);
    }

    if (url.pathname === "/analyze-fridge" && request.method === "POST") {
      const limited = await enforceAiRateLimit(request, env, origin, url.pathname);
      if (limited) return limited;
      return analyzeFridge(request, env, origin);
    }

    if (url.pathname === "/recommend-recipes" && request.method === "POST") {
      const limited = await enforceAiRateLimit(request, env, origin, url.pathname);
      if (limited) return limited;
      return recommendRecipes(request, env, origin);
    }

    if (url.pathname === "/recommend-school-menu" && request.method === "POST") {
      const limited = await enforceAiRateLimit(request, env, origin, url.pathname);
      if (limited) return limited;
      return recommendSchoolMenu(request, env, origin);
    }

    return json({ error: "Not found" }, 404, origin, env);
  }
};
