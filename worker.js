function koreanFoodLabels(value) {
  if (typeof value === "string") return value.replace(/\bzucchini\b/gi, "주키니호박").replace(/\bbroccoli\b/gi, "브로콜리").replace(/\btomato\b/gi, "토마토");
  if (Array.isArray(value)) return value.map(koreanFoodLabels);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "food_id" ? item : koreanFoodLabels(item)]));
  return value;
}
const OPENAI_API = "https://api.openai.com/v1/responses";
const PRODUCT_CATALOG = {
  "오복 우리콩 간장": { sizes: [], image: null },
  "오복 황가 양조간장": { sizes: ["1.7L"], image: "royal_soy.jpg" },
  "오복 우리콩 국간장": { sizes: [], image: "soybean_soup_soy.jpg" },
  "오복 우리콩 된장": { sizes: ["500g", "14kg"], image: "doenjang_500.jpg" },
  "오복 우리밀 고추장": { sizes: ["3kg"], image: "gochujang_3kg.jpg" },
  "오복 황실고추장": { sizes: ["14kg"], image: "gochujang_14kg.jpg" },
  "오복 양념쌈장": { sizes: ["500g"], image: "ssamjang_500.jpg" },
  "오복 춘장": { sizes: ["500g"], image: "chunjang_500.jpg" }
};
const ALLOWED_PRODUCTS = Object.keys(PRODUCT_CATALOG);
const SCHOOL_PRODUCTS = ["오복 우리밀 고추장", "오복 우리콩 된장", "오복 우리콩 간장", "오복 우리콩 국간장"];
const SCHOOL_PRODUCT_CATALOG = Object.fromEntries(SCHOOL_PRODUCTS.map(name=>[name, PRODUCT_CATALOG[name]]));
function canonicalSchoolProduct(name) {
 const value=String(name||"").trim();
 return SCHOOL_PRODUCTS.find(p=>value===p || value===p.replace(/^오복 /,"")) || null;
}
function schoolNutritionItems(items, language) {
 const names={"OBOK Wheat Gochujang":"오복 우리밀 고추장","OBOK Soybean Doenjang":"오복 우리콩 된장","OBOK Soybean Soy Sauce":"오복 우리콩 간장","OBOK Soybean Soup Soy Sauce":"오복 우리콩 국간장"};
 return cleanNutritionItems(items,language).map(item=>{
   const exact=canonicalSchoolProduct(item.name) || names[item.name];
   if(!exact)return item;
   // Our soybean soy sauce has no verified nutrition record in the source DB.
   // Never assign the Hwangga/Brewed product's values to this different product.
   return {...item,name:language==='en'?PRODUCT_EN[exact]:exact,food_id:exact==='오복 우리콩 간장'?'unknown':item.food_id};
 });
}
function schoolProductsFromIngredients(items,language) {
 return SCHOOL_PRODUCTS.filter(p=>items.some(x=>x.name===(language==='en'?PRODUCT_EN[p]:p)));
}
const NUTRITION_DB = {"fdc_168881":{"name":"쌀(생쌀)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168881","source_description":"Rice, white, short-grain, enriched, uncooked","source_url":"https://fdc.nal.usda.gov/food-details/168881/nutrients","values":{"protein_g":6.5,"sodium_mg":1.0,"fat_g":0.52,"carbohydrate_g":79.15,"energy_kcal":358.0}},"fdc_168882":{"name":"밥(익힌 흰쌀밥)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168882","source_description":"Rice, white, short-grain, enriched, cooked","source_url":"https://fdc.nal.usda.gov/food-details/168882/nutrients","values":{"carbohydrate_g":28.73,"energy_kcal":130.0,"fat_g":0.19,"protein_g":2.36,"sodium_mg":0.0}},"fdc_172448":{"name":"두부(단단한 두부)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"172448","source_description":"Tofu, firm, prepared with calcium sulfate and magnesium chloride (nigari)","source_url":"https://fdc.nal.usda.gov/food-details/172448/nutrients","values":{"protein_g":9.04,"carbohydrate_g":2.85,"energy_kcal":78.0,"fat_g":4.17,"sodium_mg":12.0}},"fdc_172449":{"name":"연두부","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"172449","source_description":"Tofu, soft, prepared with calcium sulfate and magnesium chloride (nigari)","source_url":"https://fdc.nal.usda.gov/food-details/172449/nutrients","values":{"energy_kcal":61.0,"carbohydrate_g":1.18,"protein_g":7.17,"fat_g":3.69,"sodium_mg":8.0}},"fdc_171287":{"name":"달걀(껍질 제외, 생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"171287","source_description":"Egg, whole, raw, fresh","source_url":"https://fdc.nal.usda.gov/food-details/171287/nutrients","values":{"energy_kcal":143.0,"protein_g":12.56,"sodium_mg":142.0,"fat_g":9.51,"carbohydrate_g":0.72}},"fdc_170000":{"name":"양파(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170000","source_description":"Onions, raw","source_url":"https://fdc.nal.usda.gov/food-details/170000/nutrients","values":{"fat_g":0.1,"carbohydrate_g":9.34,"energy_kcal":40.0,"protein_g":1.1,"sodium_mg":4.0}},"fdc_171052":{"name":"닭고기(껍질 없는 살, 생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"171052","source_description":"Chicken, broilers or fryers, meat only, raw","source_url":"https://fdc.nal.usda.gov/food-details/171052/nutrients","values":{"fat_g":3.08,"carbohydrate_g":0.0,"energy_kcal":119.0,"protein_g":21.39,"sodium_mg":77.0}},"fdc_167812":{"name":"돼지고기 삼겹살(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"167812","source_description":"Pork, fresh, belly, raw","source_url":"https://fdc.nal.usda.gov/food-details/167812/nutrients","values":{"fat_g":53.01,"carbohydrate_g":0.0,"energy_kcal":518.0,"sodium_mg":32.0,"protein_g":9.34}},"fdc_174030":{"name":"다진 소고기(지방 10%, 생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"174030","source_description":"Beef, ground, 90% lean meat / 10% fat, raw","source_url":"https://fdc.nal.usda.gov/food-details/174030/nutrients","values":{"fat_g":10.0,"carbohydrate_g":0.0,"protein_g":20.0,"sodium_mg":66.0,"energy_kcal":176.0}},"fdc_169975":{"name":"양배추(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169975","source_description":"Cabbage, raw","source_url":"https://fdc.nal.usda.gov/food-details/169975/nutrients","values":{"fat_g":0.1,"carbohydrate_g":5.8,"energy_kcal":25.0,"protein_g":1.28,"sodium_mg":18.0}},"fdc_168451":{"name":"무(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168451","source_description":"Radishes, oriental, raw","source_url":"https://fdc.nal.usda.gov/food-details/168451/nutrients","values":{"carbohydrate_g":4.1,"energy_kcal":18.0,"protein_g":0.6,"sodium_mg":21.0,"fat_g":0.1}},"fdc_168462":{"name":"시금치(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168462","source_description":"Spinach, raw","source_url":"https://fdc.nal.usda.gov/food-details/168462/nutrients","values":{"protein_g":2.86,"sodium_mg":79.0,"fat_g":0.39,"carbohydrate_g":3.63,"energy_kcal":23.0}},"fdc_169242":{"name":"표고버섯(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169242","source_description":"Mushrooms, shiitake, raw","source_url":"https://fdc.nal.usda.gov/food-details/169242/nutrients","values":{"fat_g":0.49,"sodium_mg":9.0,"protein_g":2.24,"carbohydrate_g":6.79,"energy_kcal":34.0}},"fdc_169291":{"name":"주키니호박(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169291","source_description":"Squash, summer, zucchini, includes skin, raw","source_url":"https://fdc.nal.usda.gov/food-details/169291/nutrients","values":{"fat_g":0.32,"carbohydrate_g":3.11,"energy_kcal":17.0,"sodium_mg":8.0,"protein_g":1.21}},"fdc_170026":{"name":"감자(껍질 포함, 생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170026","source_description":"Potatoes, flesh and skin, raw","source_url":"https://fdc.nal.usda.gov/food-details/170026/nutrients","values":{"fat_g":0.09,"energy_kcal":77.0,"sodium_mg":6.0,"protein_g":2.05,"carbohydrate_g":17.49}},"fdc_168482":{"name":"고구마(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168482","source_description":"Sweet potato, raw, unprepared (Includes foods for USDA's Food Distribution Program)","source_url":"https://fdc.nal.usda.gov/food-details/168482/nutrients","values":{"carbohydrate_g":20.12,"energy_kcal":86.0,"sodium_mg":55.0,"fat_g":0.05,"protein_g":1.57}},"fdc_168409":{"name":"오이(껍질 포함, 생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168409","source_description":"Cucumber, with peel, raw","source_url":"https://fdc.nal.usda.gov/food-details/168409/nutrients","values":{"carbohydrate_g":3.63,"energy_kcal":15.0,"sodium_mg":2.0,"fat_g":0.11,"protein_g":0.65}},"fdc_169230":{"name":"마늘(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169230","source_description":"Garlic, raw","source_url":"https://fdc.nal.usda.gov/food-details/169230/nutrients","values":{"carbohydrate_g":33.06,"energy_kcal":149.0,"sodium_mg":17.0,"protein_g":6.36,"fat_g":0.5}},"fdc_170005":{"name":"쪽파(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170005","source_description":"Onions, spring or scallions (includes tops and bulb), raw","source_url":"https://fdc.nal.usda.gov/food-details/170005/nutrients","values":{"energy_kcal":32.0,"fat_g":0.19,"protein_g":1.83,"sodium_mg":16.0,"carbohydrate_g":7.34}},"fdc_170393":{"name":"당근(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170393","source_description":"Carrots, raw","source_url":"https://fdc.nal.usda.gov/food-details/170393/nutrients","values":{"sodium_mg":69.0,"protein_g":0.93,"fat_g":0.24,"carbohydrate_g":9.58,"energy_kcal":41.0}},"fdc_173672":{"name":"고등어(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"173672","source_description":"Fish, mackerel, Pacific and jack, mixed species, raw","source_url":"https://fdc.nal.usda.gov/food-details/173672/nutrients","values":{"fat_g":7.89,"carbohydrate_g":0.0,"energy_kcal":158.0,"sodium_mg":86.0,"protein_g":20.07}},"fdc_168448":{"name":"호박(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168448","source_description":"Pumpkin, raw","source_url":"https://fdc.nal.usda.gov/food-details/168448/nutrients","values":{"carbohydrate_g":6.5,"energy_kcal":26.0,"fat_g":0.1,"protein_g":1.0,"sodium_mg":1.0}},"fdc_170151":{"name":"참깨(볶은 것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170151","source_description":"Seeds, sesame seeds, whole, roasted and toasted","source_url":"https://fdc.nal.usda.gov/food-details/170151/nutrients","values":{"fat_g":48.0,"carbohydrate_g":25.74,"energy_kcal":565.0,"protein_g":16.96,"sodium_mg":11.0}},"fdc_173468":{"name":"소금","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"173468","source_description":"Salt, table","source_url":"https://fdc.nal.usda.gov/food-details/173468/nutrients","values":{"sodium_mg":38758.0,"protein_g":0.0,"fat_g":0.0,"carbohydrate_g":0.0,"energy_kcal":0.0}},"fdc_173647":{"name":"물","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"173647","source_description":"Beverages, water, tap, drinking","source_url":"https://fdc.nal.usda.gov/food-details/173647/nutrients","values":{"fat_g":0.0,"carbohydrate_g":0.0,"energy_kcal":0.0,"protein_g":0.0,"sodium_mg":4.0}},"fdc_169655":{"name":"설탕","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169655","source_description":"Sugars, granulated","source_url":"https://fdc.nal.usda.gov/food-details/169655/nutrients","values":{"protein_g":0.0,"sodium_mg":1.0,"fat_g":0.0,"energy_kcal":387.0,"carbohydrate_g":99.98}},"fdc_169698":{"name":"옥수수전분","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169698","source_description":"Cornstarch","source_url":"https://fdc.nal.usda.gov/food-details/169698/nutrients","values":{"fat_g":0.05,"carbohydrate_g":91.27,"energy_kcal":381.0,"protein_g":0.26,"sodium_mg":9.0}},"fdc_171016":{"name":"참기름","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"171016","source_description":"Oil, sesame, salad or cooking","source_url":"https://fdc.nal.usda.gov/food-details/171016/nutrients","values":{"protein_g":0.0,"sodium_mg":0.0,"fat_g":100.0,"carbohydrate_g":0.0,"energy_kcal":884.0}},"fdc_171411":{"name":"콩기름","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"171411","source_description":"Oil, soybean, salad or cooking","source_url":"https://fdc.nal.usda.gov/food-details/171411/nutrients","values":{"sodium_mg":0.0,"protein_g":0.0,"fat_g":100.0,"carbohydrate_g":0.0,"energy_kcal":884.0}},"fdc_170108":{"name":"빨강 파프리카(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170108","source_description":"Peppers, sweet, red, raw","source_url":"https://fdc.nal.usda.gov/food-details/170108/nutrients","values":{"energy_kcal":26.0,"sodium_mg":4.0,"carbohydrate_g":6.03,"protein_g":0.99,"fat_g":0.3}},"fdc_170931":{"name":"후추","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170931","source_description":"Spices, pepper, black","source_url":"https://fdc.nal.usda.gov/food-details/170931/nutrients","values":{"fat_g":3.26,"carbohydrate_g":63.95,"energy_kcal":251.0,"protein_g":10.39,"sodium_mg":20.0}},"fdc_174210":{"name":"새우(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"174210","source_description":"Crustaceans, shrimp, mixed species, raw (may contain additives to retain moisture)","source_url":"https://fdc.nal.usda.gov/food-details/174210/nutrients","values":{"fat_g":1.01,"carbohydrate_g":0.91,"energy_kcal":71.0,"sodium_mg":566.0,"protein_g":13.61}},"fdc_168894":{"name":"밀가루(중력분)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168894","source_description":"Wheat flour, white, all-purpose, enriched, bleached","source_url":"https://fdc.nal.usda.gov/food-details/168894/nutrients","values":{"sodium_mg":2.0,"protein_g":10.33,"fat_g":0.98,"carbohydrate_g":76.31,"energy_kcal":364.0}},"fdc_172217":{"name":"우유(전지)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"172217","source_description":"Milk, whole, 3.25% milkfat, without added vitamin A and vitamin D","source_url":"https://fdc.nal.usda.gov/food-details/172217/nutrients","values":{"carbohydrate_g":4.78,"energy_kcal":61.0,"fat_g":3.27,"sodium_mg":43.0,"protein_g":3.15}},"fdc_171688":{"name":"사과(껍질 포함)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"171688","source_description":"Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)","source_url":"https://fdc.nal.usda.gov/food-details/171688/nutrients","values":{"carbohydrate_g":13.81,"energy_kcal":52.0,"fat_g":0.17,"sodium_mg":1.0,"protein_g":0.26}},"fdc_169231":{"name":"생강(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169231","source_description":"Ginger root, raw","source_url":"https://fdc.nal.usda.gov/food-details/169231/nutrients","values":{"fat_g":0.75,"sodium_mg":13.0,"protein_g":1.82,"carbohydrate_g":17.77,"energy_kcal":80.0}},"fdc_169249":{"name":"잎상추(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169249","source_description":"Lettuce, green leaf, raw","source_url":"https://fdc.nal.usda.gov/food-details/169249/nutrients","values":{"carbohydrate_g":2.87,"energy_kcal":15.0,"protein_g":1.36,"sodium_mg":28.0,"fat_g":0.15}},"fdc_170379":{"name":"브로콜리(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170379","source_description":"Broccoli, raw","source_url":"https://fdc.nal.usda.gov/food-details/170379/nutrients","values":{"carbohydrate_g":6.64,"energy_kcal":34.0,"fat_g":0.37,"protein_g":2.82,"sodium_mg":33.0}},"fdc_169228":{"name":"가지(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169228","source_description":"Eggplant, raw","source_url":"https://fdc.nal.usda.gov/food-details/169228/nutrients","values":{"fat_g":0.18,"carbohydrate_g":5.88,"energy_kcal":25.0,"sodium_mg":2.0,"protein_g":0.98}},"fdc_170457":{"name":"토마토(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170457","source_description":"Tomatoes, red, ripe, raw, year round average","source_url":"https://fdc.nal.usda.gov/food-details/170457/nutrients","values":{"carbohydrate_g":3.89,"energy_kcal":18.0,"fat_g":0.2,"sodium_mg":5.0,"protein_g":0.88}},"fdc_169251":{"name":"양송이버섯(생것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"169251","source_description":"Mushrooms, white, raw","source_url":"https://fdc.nal.usda.gov/food-details/169251/nutrients","values":{"fat_g":0.34,"sodium_mg":5.0,"protein_g":3.09,"carbohydrate_g":3.26,"energy_kcal":22.0}},"fdc_168908":{"name":"소면(마른 것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168908","source_description":"Noodles, japanese, somen, dry","source_url":"https://fdc.nal.usda.gov/food-details/168908/nutrients","values":{"protein_g":11.35,"sodium_mg":1840.0,"fat_g":0.81,"carbohydrate_g":74.1,"energy_kcal":356.0}},"fdc_168909":{"name":"소면(익힌 것)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"168909","source_description":"Noodles, japanese, somen, cooked","source_url":"https://fdc.nal.usda.gov/food-details/168909/nutrients","values":{"fat_g":0.18,"carbohydrate_g":27.54,"energy_kcal":131.0,"protein_g":4.0,"sodium_mg":161.0}},"fdc_170392":{"name":"김치(USDA 배추김치 참고값)","basis_unit":"g","basis_amount":100,"source":"USDA FoodData Central SR Legacy (2018)","source_id":"170392","source_description":"Cabbage, kimchi","source_url":"https://fdc.nal.usda.gov/food-details/170392/nutrients","values":{"fat_g":0.5,"carbohydrate_g":2.4,"energy_kcal":15.0,"protein_g":1.1,"sodium_mg":498.0}},"obok_hwangga":{"name":"오복 황가 양조간장","basis_unit":"mL","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"오복양조(황가)","source_id":"hwangga","values":{"energy_kcal":68,"carbohydrate_g":7.1,"protein_g":9,"fat_g":0.4,"sodium_mg":5145}},"obok_soup":{"name":"오복 우리콩 국간장","basis_unit":"mL","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"오복 오복 우리콩 국간장","source_id":"soup","values":{"energy_kcal":38.5,"carbohydrate_g":4.2,"protein_g":5.2,"fat_g":0.1,"sodium_mg":7090}},"obok_doenjang":{"name":"오복 우리콩 된장","basis_unit":"g","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"우리콩 재래식된장","source_id":"doenjang","values":{"energy_kcal":149.6,"carbohydrate_g":18.4,"protein_g":14.5,"fat_g":2,"sodium_mg":3605.1}},"obok_wheat":{"name":"오복 우리밀 고추장","basis_unit":"g","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"오복 우리밀 고추장","source_id":"wheat","values":{"energy_kcal":224.7,"carbohydrate_g":50.8,"protein_g":3.8,"fat_g":0.7,"sodium_mg":2265.5}},"obok_royal":{"name":"오복 황실고추장","basis_unit":"g","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"황실 고추장","source_id":"royal","values":{"energy_kcal":226.4,"carbohydrate_g":51,"protein_g":3.8,"fat_g":0.8,"sodium_mg":2291.9}},"obok_ssam":{"name":"오복 양념쌈장","basis_unit":"g","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"양념쌈장","source_id":"ssam","values":{"energy_kcal":228.8,"carbohydrate_g":45.8,"protein_g":6,"fat_g":2.4,"sodium_mg":2511.3}},"obok_chun":{"name":"오복 춘장","basis_unit":"g","basis_amount":100,"source":"오복식품 제공 제품사양 원본 데이터","source_row":"중화요리춘장","source_id":"chun","values":{"energy_kcal":157,"carbohydrate_g":26.5,"protein_g":11,"fat_g":1,"sodium_mg":3168.6}}};
const NUTRIENT_KEYS = ["energy_kcal", "carbohydrate_g", "protein_g", "fat_g", "sodium_mg"];
const NUTRITION_ITEM_SCHEMA = {
 type: "array", minItems: 1, maxItems: 60, items: {
  type: "object", additionalProperties: false,
  properties: { name: {type:"string"}, food_id: {type:"string"}, amount: {type:"number"}, unit: {type:"string",enum:["g","mL"]}, household: {type:"string"} },
  required: ["name","food_id","amount","unit","household"]
 }
};

// Product identifiers stay stable for catalog matching and nutrition calculations.
const PRODUCT_EN = {
 "오복 우리콩 간장":"OBOK Soybean Soy Sauce",
 "오복 황가 양조간장":"OBOK Hwangga Brewed Soy Sauce", "오복 우리콩 국간장":"OBOK Soybean Soup Soy Sauce",
 "오복 우리콩 된장":"OBOK Soybean Doenjang", "오복 우리밀 고추장":"OBOK Wheat Gochujang",
 "오복 황실고추장":"OBOK Hwangsil Gochujang", "오복 양념쌈장":"OBOK Seasoned Ssamjang",
 "오복 춘장":"OBOK Chunjang"
};
function selectedLanguage(body) { return body?.language === "en" ? "en" : "ko"; }
function languageInstruction(language) {
 return language === "en"
 ? "\nWrite ALL customer-facing recipe names, ingredient names, descriptions, difficulty, cooking time, household measures, cooking steps and review notes in natural English. Use Prep / Cook / Finish, minutes, tsp and tbsp. Preserve JSON keys, food_id, numeric quantities, g/mL units and exact Korean product identifiers in products/obok_products (the UI translates those identifiers). For product ingredient names use the English labels: " + JSON.stringify(PRODUCT_EN) + ". In school menus keep day identifiers 월요일/화요일/수요일/목요일/금요일 for compatibility; all other display text must be English."
 : "\n사용자에게 표시되는 메뉴명, 재료명, 설명, 조리과정은 모두 한국어로 작성하세요. zucchini는 주키니호박으로 표기하세요. food_id와 g, mL 등 계산용 식별자 및 단위는 그대로 유지하세요.";
}
function foodDisplayName(id, fallback, language) {
 const food=NUTRITION_DB[id];
 if(language!=="en") return food?.name || fallback;
 return PRODUCT_EN[food?.name] || food?.source_description || fallback;
}

function nutritionCatalog() {
 return Object.entries(NUTRITION_DB).map(([id,f])=>`${id}: ${f.name} [${f.basis_unit}]`).join("\n");
}
function cleanNutritionItems(items, language="ko") {
 return (Array.isArray(items)?items:[]).slice(0,60).map(x=>({
  name:String(foodDisplayName(x?.food_id, x?.name || "", language)).trim().slice(0,100), food_id:String(x?.food_id||"").slice(0,50),
  amount:Number(x?.amount), unit:String(x?.unit||""), household:String(x?.household||"").slice(0,80)
 })).filter(x=>x.name);
}
function calculateNutrition(items, servings) {
 const total=Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,0]));const missing=[];const sources=new Set();let matched=0;
 for(const item of items){
  const food=NUTRITION_DB[item.food_id];
  if(!food || !Number.isFinite(item.amount) || item.amount<=0 || item.unit!==food.basis_unit){missing.push(item.name);continue;}
  const ratio=item.amount/food.basis_amount/servings;
  for(const k of NUTRIENT_KEYS) total[k]+=food.values[k]*ratio;
  sources.add(food.source);matched++;
 }
 const values=matched?Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,Math.round(total[k]*(k==="sodium_mg"?1:10))/(k==="sodium_mg"?1:10)])):null;
 return {values,servings,complete:items.length>0&&missing.length===0,matched_count:matched,total_count:items.length,missing:[...new Set(missing)],sources:[...sources],note:"입력된 재료의 전체 사용량을 인원수로 나눈 예상값입니다. 조리 손실·남긴 양념·실제 배식량은 반영하지 않았습니다. 일반 재료는 USDA 참고값이며 제품별 차이가 있습니다."};
}
function ingredientText(item) {
 return `${item.name} ${Number.isFinite(item.amount)?item.amount:"수량 확인 필요"}${item.unit}${item.household?" ("+item.household+")":""}`;
}
function selectedSeason(value) {
  if (["봄", "여름", "가을", "겨울"].includes(value)) return value;
  const month = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", month: "numeric" }).format(new Date()));
  return month >= 3 && month <= 5 ? "봄" : month >= 6 && month <= 8 ? "여름" : month >= 9 && month <= 11 ? "가을" : "겨울";
}
function productOptions(names) {
  return names.map(name => ({ name, sizes: PRODUCT_CATALOG[name]?.sizes || [] }));
}
const OPENAI_TIMEOUT_MS = 120000;
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
function retryAfterJson(origin, env, error) {
  const timeout=String(error?.message||"")==="OPENAI_TIMEOUT";
  const limited=String(error?.message||"").startsWith("OPENAI_BUSY:429:");
  const response = json({
    error: timeout ? "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." : limited ? "AI 서비스의 요청 한도에 걸렸습니다. 잠시 후 다시 시도해 주세요. 반복되면 Cloudflare 로그에서 API 사용 한도 또는 잔액을 확인해 주세요." : "AI 서비스가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
    code: timeout ? "AI_TIMEOUT" : limited ? "AI_UPSTREAM_RATE_LIMIT" : "AI_BUSY"
  },503,origin,env);
  response.headers.set("Retry-After",limited?"30":"5");return response;
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
  const language = selectedLanguage(body);
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
  const imageCacheRequest = await makeCacheRequest("fridge-branded-v12", {
    language,
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
- Use short ${language === "en" ? "English" : "Korean"} ingredient names.
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
      { type: "input_text", text: prompt + languageInstruction(language) },
      { type: "input_image", image_url: imageDataUrl, detail: "high" }
    ], 500, format);
  } catch (e) {
    console.error("Image AI failed", e);
    if (isBusyError(e)) return retryAfterJson(origin, env, e);
    return json({ error: "AI image analysis failed." }, 502, origin, env);
  }
  let parsed;
  try {
    parsed = language === "en" ? parseJsonObject(text) : koreanFoodLabels(parseJsonObject(text));
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
  const language = selectedLanguage(body);
  if (!body) {
    return json({ error: "Invalid JSON body." }, 400, origin, env);
  }
  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients
        .map(x => String(x).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const servings = Math.max(1,Math.min(6,Math.floor(parseInt(body.people,10)||2)));
  const people = language === "en" ? `${servings} people` : `${servings}명`;
  const time = String(body.time || "20분 이내").slice(0, 30);
  const preference = String(body.preference || "").trim().slice(0, 500);
  const excludeNames = Array.isArray(body.excludeNames)
    ? body.excludeNames.map(x => String(x).trim()).filter(Boolean).slice(0, 12)
    : [];
  if (!ingredients.length) return json({ error: "재료를 한 가지 이상 입력해 주세요." }, 400, origin, env);
  const season = selectedSeason(body.season);
  const recipeCacheRequest = await makeCacheRequest("recipes-v10-branded-v12", {
    language,
    season,
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
Season: ${season}
Extra request: ${preference || "없음"}
Already shown recipes to avoid: ${excludeNames.length ? excludeNames.join(", ") : "없음"}
Create exactly 3 practical Korean home-cooking recipes for a beginner.
Rules:
1. Use the available ingredients as much as possible.
2. Common pantry staples may be assumed.
3. Each recipe must naturally use at least one allowed O'Bok product.
4. Allowed O'Bok products only: ${ALLOWED_PRODUCTS.join(", ")}.
5. Give exactly 6 short cooking steps.
6. Use ${language === "en" ? "English" : "Korean"}.
7. Avoid previously shown recipe names whenever reasonable.
8. Keep the 3 recipes meaningfully different.
9. Do not make medical or health claims.
10. List quantities for ALL ingredients for exactly ${people}: g or mL plus a practical household measure in parentheses. Use 1 tablespoon=15mL and 1 teaspoon=5mL for liquids; do not equate grams and mL for pastes. State approximate weights for whole vegetables.
11. Use exact OBOK-prefixed product names in ingredient names and cooking steps; include ingredient quantities. Every cooking step must specify preparation or cooking action; cooking steps include heat and minutes. Use stages 준비 / 조리 / 마무리 in the step text.
12. Prefer ${season} seasonal ingredients when compatible with available ingredients, and explain the seasonal choice in reason. Extra ingredients must be identified as 추가 준비.
13. Use exact catalog names in ingredients and products. No invented O'Bok products or package sizes. Catalog: ${JSON.stringify(PRODUCT_CATALOG)}.
14. Do NOT generate nutrient numbers. Return nutrition_ingredients for EVERY ingredient including seasonings, water and additional ingredients. Server calculates nutrition.
15. nutrition_ingredients.amount is total edible quantity for ${people}, NOT per serving. Use g except catalog soy sauces use mL. For other liquids use weighed g, not an assumed g=mL conversion. Household measures are supplementary.
16. Choose food_id only for an exact or appropriately described food in the following catalog. Preserve raw/cooked state and meat cut. Never map an unsupported ingredient to an unrelated food; set food_id="unknown". Do not replace pork cuts with belly or Korean rice cakes with snack crackers. Names must make the mapped ingredient and state clear. Keep ingredients array and nutrition_ingredients consistent.
Catalog:
${nutritionCatalog()}
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
              nutrition_ingredients: NUTRITION_ITEM_SCHEMA,
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
              "ingredients", "steps", "products", "nutrition_ingredients"
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
      [{ type: "input_text", text: prompt + languageInstruction(language) }],
      5500,
      recipeFormat
    );
  } catch (e) {
    console.error("Recipe AI failed", e);
    if (isBusyError(e)) return retryAfterJson(origin, env, e);
    return json({ error: "AI recipe generation failed." }, 502, origin, env);
  }
  let parsed;
  try {
    parsed = language === "en" ? parseJsonObject(text) : koreanFoodLabels(parseJsonObject(text));
  } catch {
    return json({ error: "AI returned an invalid recipe format." }, 502, origin, env);
  }
  const recipes = Array.isArray(parsed.recipes)
    ? parsed.recipes.slice(0, 3).map(r => ({
        name: String(r.name || (language === "en" ? "OBOK recommended recipe" : "오복 추천 요리")).slice(0, 60),
        emoji: String(r.emoji || "🍽️").slice(0, 8),
        time: String(r.time || (language === "en" ? "20 min" : "20분")).slice(0, 20),
        level: String(r.level || (language === "en" ? "Easy" : "쉬움")).slice(0, 20),
        reason: String(r.reason || "").slice(0, 200),
        nutrition_ingredients: cleanNutritionItems(r.nutrition_ingredients, language),
        ingredients: cleanNutritionItems(r.nutrition_ingredients, language).map(ingredientText),
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
  const result = { recipes: recipes.map(r => ({ ...r, servings: people, season: language === "en" ? ({봄:"Spring",여름:"Summer",가을:"Autumn",겨울:"Winter"}[season]) : season, product_options: productOptions(r.products), nutrition: calculateNutrition(r.nutrition_ingredients,servings) })) };
  await cachePut(recipeCacheRequest, result, RECIPE_CACHE_SECONDS);
  return json(result, 200, origin, env);
}
function cleanSchoolDay(d, dayName, language="ko") {
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
        .filter(x => SCHOOL_PRODUCTS.includes(x))
        .slice(0, 4)
    : [];
  return {
    day: dayName,
    menu,
    balance_note: String(d?.balance_note || "").trim().slice(0, 240),
    ingredients,
    cooking_steps: Array.isArray(d?.cooking_steps) ? d.cooking_steps.map(x => String(x).slice(0, 350)).slice(0, 6) : [],
    product_options: productOptions(obokProducts),
    nutrition_ingredients: schoolNutritionItems(d?.nutrition_ingredients, language),
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
// Only generate each ingredient once. Shopping and nutrition are calculated below.
const SCHOOL_NUTRITION_SCHEMA = {
 type:"array",minItems:3,maxItems:60,items:{
  type:"object",additionalProperties:false,
  properties:{name:{type:"string"},food_id:{type:"string"},amount:{type:"number"},unit:{type:"string",enum:["g","mL"]}},
  required:["name","food_id","amount","unit"]
 }
};
const SCHOOL_MENU_FORMAT = {
 type:"json_schema",name:"obok_school_menu",strict:true,schema:{
  type:"object",additionalProperties:false,
  properties:{days:{type:"array",minItems:5,maxItems:5,items:{
   type:"object",additionalProperties:false,
   properties:{day:{type:"string",enum:["월요일","화요일","수요일","목요일","금요일"]},
    menu:{type:"array",minItems:5,maxItems:7,items:{type:"string"}},balance_note:{type:"string"},
    cooking_steps:{type:"array",minItems:3,maxItems:4,items:{type:"string"}},
    nutrition_ingredients:SCHOOL_NUTRITION_SCHEMA,
    obok_products:{type:"array",maxItems:4,items:{type:"string",enum:SCHOOL_PRODUCTS}}},
   required:["day","menu","balance_note","cooking_steps","nutrition_ingredients","obok_products"]
  }},review_note:{type:"string"}},required:["days","review_note"]
 }
};
function sumSchoolShopping(days) {
 const sums=new Map();
 for(const day of days)for(const x of day.nutrition_ingredients){
  if(!Number.isFinite(x.amount)||x.amount<=0||!["g","mL"].includes(x.unit))continue;
  const key=`${x.name}|${x.unit}`;
  const current=sums.get(key)||{name:x.name,unit:x.unit,amount:0};current.amount+=x.amount;sums.set(key,current);
 }
 return [...sums.values()].map(x=>({name:x.name,quantity:x.amount>=1000?`${Math.round(x.amount/1000*1000)/1000}${x.unit==="g"?"kg":"L"}`:`${Math.round(x.amount*10)/10}${x.unit}`}));
}
async function recommendSchoolMenu(request, env, origin) {
  const body = await request.json().catch(() => null);
  const language = selectedLanguage(body);
  if (!body) {
    return json({ error: "Invalid JSON body." }, 400, origin, env);
  }
  const schoolLevel = String(body.schoolLevel || "중학교").trim().slice(0, 20);
  const people = Math.max(1, Math.min(5000, Math.floor(Number(body.people) || 500)));
  const season = selectedSeason(body.season);
  const budget = Math.max(0, Number(body.budget) || 0);
  const exclude = String(body.exclude || "").trim().slice(0, 300);
  const requiredMenus = String(body.requiredMenus || "").trim().slice(0, 500);
  const excludedMenus = String(body.excludedMenus || "").trim().slice(0, 500);
  const extraRequest = String(body.extraRequest || "").trim().slice(0, 500);
// Front-end can send the previous four weeks' menu names.// This keeps compatibility even when the field is absent.
  const recentMenuNames = Array.isArray(body.recentMenuNames)
    ? [...new Set(
        body.recentMenuNames
          .map(x => String(x).trim())
          .filter(Boolean)
      )].slice(0, 120)
    : [];
// A week key makes a new week's request different from a previous week's cache.// If the front-end sends weekKey, use it. Otherwise derive the current ISO-like week.
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((now - yearStart) / 86400000) + yearStart.getUTCDay() + 1) / 7);
  const weekKey = String(
    body.weekKey ||
    `${now.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
  ).slice(0, 30);
  const cacheRequest = await makeCacheRequest("school-menu-v12-four-products", {
    language,
    season,
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
계절: ${season}
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
18. 학교급식에서 사용 가능한 오복 제품명은 다음 4개뿐입니다: ${SCHOOL_PRODUCTS.join(", ")}. 이외 오복 제품(춘장, 쌈장, 황가 양조, 황실 고추장)은 제안하지 마세요. 고추장/된장/간장/국간장이 실제 쓰이면 지정한 제품명으로 재료에 표시하고 obok_products에도 넣으세요. 모든 제품을 억지로 넣지 마세요.
19. 주간 구매목록은 서버에서 계산하므로 별도로 작성하지 마세요.
20. 공식 영양기준을 충족한다고 단정하지 말고, 영양사의 최종 검토용 초안으로 작성하세요.
21. 사용자 표시 내용은 ${language === "en" ? "영어" : "한국어"}로 작성하세요. 요일 및 제품 식별자는 스키마를 유지하세요.
22. ${season} 제철 식재료를 현실적으로 활용하고 balance_note에 설명하세요.
23. 오복 제품도 ingredients에 정확한 제품명과 ${people}명 전체 사용량을 kg/L로 적으세요. 포장규격과 사용량은 구분하세요. 확인된 급식 제품규격: ${JSON.stringify(SCHOOL_PRODUCT_CATALOG)}. 없는 규격은 만들지 마세요.
24. cooking_steps에 날짜별 주찬의 준비→조리→마무리를 3~4단계로 적고 불 세기와 조리시간, 대량조리 시 나누어 조리할 점을 설명하세요.
25. 영양 수치는 작성하지 마세요. 서버가 계산합니다. nutrition_ingredients에 해당 날짜 모든 메뉴의 전체 식재료(밥·국·주찬·반찬·김치·후식·모든 양념 포함)를 빠짐없이 적으세요. amount는 ${people}명 전체 사용량이며 g 단위, 간장 제품만 mL 단위를 사용하세요. 식재료는 nutrition_ingredients에만 적고 같은 내용을 중복 작성하지 마세요. balance_note와 cooking_steps는 짧고 실용적으로 작성하세요.
26. 오복 우리콩 간장은 등록된 영양정보가 없으므로 food_id는 unknown으로 쓰세요. 황가 양조간장 데이터로 대체하지 마세요. 아래 DB에서 정확히 일치하는 식품/조리상태/부위를 선택하고 food_id를 적으세요. 없는 식품은 unknown으로 쓰세요. 비슷하다는 이유로 다른 식품에 연결하지 마세요. 생쌀/밥, 생고기/익힌 고기를 구분하세요. 영양기준 충족을 단정하지 마세요.
${nutritionCatalog()}
`.trim();
  let text;
  try {
    text = await callOpenAI(
      env,
      [{ type: "input_text", text: prompt + languageInstruction(language) }],
      9000,
      SCHOOL_MENU_FORMAT
    );
  } catch (e) {
    console.error("School menu AI failed", {
      message: e?.message || String(e),
      stack: e?.stack || ""
    });
    if (isBusyError(e)) {
      return retryAfterJson(origin, env, e);
    }
    return json({
      error: "AI school menu generation failed.",
      detail: String(e?.message || "").slice(0, 300)
    }, 502, origin, env);
  }
  let parsed;
  try {
    parsed = language === "en" ? parseJsonObject(text) : koreanFoodLabels(parseJsonObject(text));
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
    const day=cleanSchoolDay(source, dayName, language);
    day.obok_products=schoolProductsFromIngredients(day.nutrition_ingredients,language);
    day.product_options=productOptions(day.obok_products);
    day.ingredients=day.nutrition_ingredients.map(x=>({name:x.name,quantity:`${x.amount}${x.unit}`}));
    day.nutrition=calculateNutrition(day.nutrition_ingredients,people);
    return day;
  });
  const complete = days.every(d =>
    Array.isArray(d.menu) &&
    d.menu.length >= 5 &&
    Array.isArray(d.ingredients) &&
    d.ingredients.length >= 3 &&
    d.nutrition_ingredients.every(x=>!/^오복 |^OBOK /i.test(x.name) || SCHOOL_PRODUCTS.some(p=>x.name===(language==='en'?PRODUCT_EN[p]:p)))
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
  const weeklyShopping = sumSchoolShopping(days);
  const result = {
    days,
    weekly_shopping: weeklyShopping,
    review_note: String(
      parsed.review_note ||
      (language === "en" ? "Before serving, have a qualified school nutritionist review applicable meal standards, allergies, ingredient specifications and nutrition requirements." : "실제 제공 전 학교 영양사가 학교급식 관련 기준, 알레르기, 식재료 규격 및 학교별 영양관리 기준을 확인해 최종 검토해 주세요.")
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
        version: "11.0-bilingual-menu-nutrition",
        features: [
          "bilingual-ko-en",
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
