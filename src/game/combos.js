import { COMBO, RECIPES, mkH } from '../constants/gameData';

const GRADE_ORDER = ["노말", "고급", "영웅", "전설", "신화", "불멸"];
const GRADE_RESULT = { 노말: "고급", 고급: "영웅", 영웅: "전설", 전설: "신화", 신화: "불멸" };

// heroId를 가진 영웅을 기준으로 조합/레시피 가능한 결과 목록을 계산한다.
export function getCombOptions({ heroes, round, unlockedGrades, heroId }) {
  const h = heroes.find(x => x.id === heroId);
  if (!h) return [];
  const myEls = heroes.filter(x => x.id !== heroId).map(x => x.element);
  const myElsCntEx = {};
  for (const hero of heroes) {
    if (hero.id !== heroId) myElsCntEx[hero.element] = (myElsCntEx[hero.element] || 0) + 1;
  }
  const myGradeIdx = GRADE_ORDER.indexOf(h.grade);

  const targetGrade = GRADE_RESULT[h.grade];
  const comboOpts = COMBO.filter(r => {
    if (r.g !== targetGrade) return false;
    if (!unlockedGrades.includes(r.g)) return false;
    const isSame = r.a === r.b;
    const match = isSame
      ? (h.element === r.a && (myElsCntEx[r.a] || 0) >= 1)
      : ((r.a === h.element && myEls.includes(r.b)) || (r.b === h.element && myEls.includes(r.a)));
    if (match) {
      if (r.g === "신화" && round < 20) return false;
      if (r.g === "불멸" && round < 50) return false;
      return true;
    }
    return false;
  }).map(r => ({ ...r, isRecipe: false }));

  const cnt = {};
  for (const hero of heroes) cnt[hero.element] = (cnt[hero.element] || 0) + 1;
  const recipeOpts = RECIPES.filter(recipe => {
    if (!unlockedGrades.includes(recipe.g)) return false;
    const resultIdx = GRADE_ORDER.indexOf(recipe.g);
    if (recipe.isGoldUnit) {
      if (!recipe.parts.some(p => p.u === h.element)) return false;
    } else {
      if (resultIdx <= myGradeIdx) return false;
      const usesMe = recipe.parts.some(p => p.u === h.element);
      if (!usesMe) return false;
    }
    return recipe.parts.every(p => (cnt[p.u] || 0) >= p.n);
  }).map(recipe => ({ r: recipe.r, g: recipe.g, isRecipe: true, recipe }));

  return [...comboOpts, ...recipeOpts];
}

export function canRecipe({ heroes, recipe }) {
  const cnt = {};
  for (const h of heroes) cnt[h.element] = (cnt[h.element] || 0) + 1;
  return recipe.parts.every(p => (cnt[p.u] || 0) >= p.n);
}

// RECIPES 방식 조합 계산. 성공 시 {newHeroes, result}, 실패 시 {error, color}.
export function doRecipe({ heroes, recipe, unlockedGrades, gradeEnhLv }) {
  if (!canRecipe({ heroes, recipe })) return { error: "재료 부족!", color: "#ef4444" };
  if (!unlockedGrades.includes(recipe.g)) {
    return { error: `${recipe.g} 등급은 아직 개방되지 않았습니다`, color: "#ef4444" };
  }
  if (recipe.r === "황금정령" && heroes.some(h => h.element === "황금정령")) {
    return { error: "황금정령은 1개만 보유할 수 있습니다", color: "#f59e0b" };
  }
  const remaining = [...heroes];
  for (const part of recipe.parts) {
    let removed = 0;
    for (let i = remaining.length - 1; i >= 0 && removed < part.n; i--) {
      if (remaining[i].element === part.u) { remaining.splice(i, 1); removed++; }
    }
  }
  const h = mkH(recipe.r, recipe.g, gradeEnhLv || {});
  return { newHeroes: [...remaining, h], result: { r: recipe.r, g: recipe.g } };
}

// COMBO/RECIPES 통합 조합 계산.
// 성공 시 {newHeroes, result: {r,g,via}}, 실패 시 {error, color}, 원본 재료를 찾지 못한 방어적 무동작은 {silent:true}.
export function doCombine({ heroes, heroId, opt, unlockedGrades, gradeEnhLv }) {
  if (!unlockedGrades.includes(opt.g)) {
    return { error: `${opt.g} 등급은 아직 개방되지 않았습니다`, color: "#ef4444" };
  }
  if (opt.isRecipe) {
    const res = doRecipe({ heroes, recipe: opt.recipe, unlockedGrades, gradeEnhLv });
    if (res.error) return res;
    return { newHeroes: res.newHeroes, result: { ...res.result, via: "recipe" } };
  }
  const h1 = heroes.find(x => x.id === heroId);
  const needEl = opt.a === h1.element ? opt.b : opt.a;
  const h2 = heroes.find(x => x.id !== heroId && x.element === needEl);
  if (!h1 || !h2) return { silent: true };
  const nh = mkH(opt.r, opt.g, gradeEnhLv || {});
  nh.col = h1.col; nh.row = h1.row;
  const newHeroes = heroes.filter(x => x.id !== h1.id && x.id !== h2.id).concat(nh);
  return { newHeroes, result: { r: opt.r, g: opt.g, via: "combo" } };
}
