import { describe, it, expect } from 'vitest';
import { getCombOptions, canRecipe, doRecipe, doCombine } from './combos';
import { mkH } from '../constants/gameData';

const ALL_GRADES = ["노말", "고급", "영웅", "전설", "신화", "불멸"];

describe('getCombOptions', () => {
  it('폴른 세라핌 레시피를 재료가 모두 있을 때 노출한다', () => {
    const heroes = [
      mkH("타락성익", "고급"),
      mkH("심연악마", "고급"),
      mkH("어둠정령", "노말"),
    ];
    const target = heroes[0];
    const opts = getCombOptions({
      heroes,
      round: 1,
      unlockedGrades: ALL_GRADES,
      heroId: target.id,
    });
    const found = opts.find(o => o.isRecipe && o.r === "폴른 세라핌");
    expect(found).toBeTruthy();
    expect(found.g).toBe("전설");
  });

  it('황금정령은 동일 등급(전설→전설)이어도 예외적으로 노출된다', () => {
    const heroes = [
      mkH("금단의 현자", "전설"),
      mkH("마검군주", "전설"),
      mkH("무속성", "노말"),
    ];
    const target = heroes[0];
    const opts = getCombOptions({
      heroes,
      round: 1,
      unlockedGrades: ALL_GRADES,
      heroId: target.id,
    });
    const found = opts.find(o => o.isRecipe && o.r === "황금정령");
    expect(found).toBeTruthy();
  });

  it('일반 레시피는 결과 등급이 내 등급보다 높지 않으면 노출되지 않는다', () => {
    // 황금정령(전설 재료 필요) 본인이 이미 전설이라 일반 규칙이면 숨겨져야 하지만
    // isGoldUnit 예외가 없는 일반 레시피로 확인: 세라핌(영웅 재료 → 전설)을 영웅 유닛 기준으로 조회
    const heroes = [
      mkH("성익천사", "영웅"),
      mkH("신수호자", "영웅"),
      mkH("천사", "노말"),
    ];
    const target = heroes[0];
    const opts = getCombOptions({
      heroes,
      round: 1,
      unlockedGrades: ALL_GRADES,
      heroId: target.id,
    });
    expect(opts.find(o => o.isRecipe && o.r === "세라핌")).toBeTruthy();

    // 재료 유닛(성익천사) 본인이 이미 결과 등급(전설)과 같거나 높으면
    // resultIdx(전설) <= myGradeIdx(전설) 이므로 노출되지 않아야 한다
    const heroes2 = [
      mkH("성익천사", "전설"),
      mkH("신수호자", "영웅"),
      mkH("천사", "노말"),
    ];
    const target2 = heroes2[0];
    const opts2 = getCombOptions({
      heroes: heroes2,
      round: 1,
      unlockedGrades: ALL_GRADES,
      heroId: target2.id,
    });
    expect(opts2.find(o => o.isRecipe && o.r === "세라핌")).toBeFalsy();
  });

  it('미개방 등급의 조합/레시피는 필터링된다', () => {
    const heroes = [
      mkH("타락성익", "고급"),
      mkH("심연악마", "고급"),
      mkH("어둠정령", "노말"),
    ];
    const target = heroes[0];
    // 전설 등급이 개방되지 않은 상태
    const opts = getCombOptions({
      heroes,
      round: 1,
      unlockedGrades: ["노말", "고급", "영웅"],
      heroId: target.id,
    });
    expect(opts.find(o => o.r === "폴른 세라핌")).toBeFalsy();
  });
});

describe('canRecipe / doRecipe', () => {
  const findRecipe = () => ({
    r: "폴른 세라핌",
    g: "전설",
    parts: [
      { u: "타락성익", n: 1 },
      { u: "심연악마", n: 1 },
      { u: "어둠정령", n: 1 },
    ],
  });

  it('재료가 부족하면 canRecipe가 false, doRecipe는 error를 반환한다', () => {
    const recipe = findRecipe();
    const heroes = [mkH("타락성익", "고급"), mkH("심연악마", "고급")]; // 어둠정령 없음
    expect(canRecipe({ heroes, recipe })).toBe(false);

    const res = doRecipe({ heroes, recipe, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.error).toBe("재료 부족!");
    expect(res.newHeroes).toBeUndefined();
  });

  it('조합 성공 시 재료가 정확히 차감되고 결과 유닛이 추가된다', () => {
    const recipe = findRecipe();
    const heroes = [
      mkH("타락성익", "고급"),
      mkH("심연악마", "고급"),
      mkH("어둠정령", "노말"),
      mkH("오크", "노말"), // 무관한 재료, 남아있어야 함
    ];
    expect(canRecipe({ heroes, recipe })).toBe(true);

    const res = doRecipe({ heroes, recipe, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({ r: "폴른 세라핌", g: "전설" });
    expect(res.newHeroes).toHaveLength(2); // 오크 + 폴른 세라핌
    expect(res.newHeroes.some(h => h.element === "오크")).toBe(true);
    expect(res.newHeroes.some(h => h.element === "폴른 세라핌" && h.grade === "전설")).toBe(true);
    expect(res.newHeroes.some(h => h.element === "타락성익")).toBe(false);
    expect(res.newHeroes.some(h => h.element === "심연악마")).toBe(false);
    expect(res.newHeroes.some(h => h.element === "어둠정령")).toBe(false);
  });

  it('개방되지 않은 등급이면 error를 반환한다', () => {
    const recipe = findRecipe();
    const heroes = [mkH("타락성익", "고급"), mkH("심연악마", "고급"), mkH("어둠정령", "노말")];
    const res = doRecipe({ heroes, recipe, unlockedGrades: ["노말", "고급", "영웅"], gradeEnhLv: {} });
    expect(res.error).toBe("전설 등급은 아직 개방되지 않았습니다");
  });

  it('황금정령을 이미 보유 중이면 error를 반환한다', () => {
    const recipe = { r: "황금정령", g: "전설", isGoldUnit: true, parts: [{ u: "금단의 현자", n: 1 }, { u: "마검군주", n: 1 }, { u: "무속성", n: 1 }] };
    const heroes = [
      mkH("황금정령", "전설"),
      mkH("금단의 현자", "전설"),
      mkH("마검군주", "전설"),
      mkH("무속성", "노말"),
    ];
    const res = doRecipe({ heroes, recipe, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.error).toBe("황금정령은 1개만 보유할 수 있습니다");
    expect(res.color).toBe("#f59e0b");
  });
});

describe('doCombine', () => {
  it('COMBO 방식(2재료) 조합 성공 시 두 재료가 사라지고 결과가 추가된다', () => {
    const h1 = mkH("오크", "노말");
    const h2 = mkH("언데드", "노말");
    h1.col = 3; h1.row = 4;
    const heroes = [h1, h2];
    const opt = { a: "오크", b: "언데드", r: "해골투사", g: "고급", isRecipe: false };
    const res = doCombine({ heroes, heroId: h1.id, opt, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.error).toBeUndefined();
    expect(res.newHeroes).toHaveLength(1);
    expect(res.newHeroes[0].element).toBe("해골투사");
    expect(res.newHeroes[0].grade).toBe("고급");
    expect(res.newHeroes[0].col).toBe(3);
    expect(res.newHeroes[0].row).toBe(4);
    expect(res.result).toEqual({ r: "해골투사", g: "고급", via: "combo" });
  });

  it('상대 재료를 찾지 못하면 조용히 실패한다(silent)', () => {
    const h1 = mkH("오크", "노말");
    const heroes = [h1];
    const opt = { a: "오크", b: "언데드", r: "해골투사", g: "고급", isRecipe: false };
    const res = doCombine({ heroes, heroId: h1.id, opt, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.silent).toBe(true);
  });

  it('미개방 등급이면 error를 반환한다', () => {
    const h1 = mkH("오크", "노말");
    const h2 = mkH("언데드", "노말");
    const heroes = [h1, h2];
    const opt = { a: "오크", b: "언데드", r: "해골투사", g: "고급", isRecipe: false };
    const res = doCombine({ heroes, heroId: h1.id, opt, unlockedGrades: ["노말"], gradeEnhLv: {} });
    expect(res.error).toBe("고급 등급은 아직 개방되지 않았습니다");
  });

  it('RECIPES 방식(isRecipe) 조합은 doRecipe로 위임되고 via가 recipe로 표시된다', () => {
    const heroes = [
      mkH("타락성익", "고급"),
      mkH("심연악마", "고급"),
      mkH("어둠정령", "노말"),
    ];
    const opt = {
      r: "폴른 세라핌",
      g: "전설",
      isRecipe: true,
      recipe: {
        r: "폴른 세라핌",
        g: "전설",
        parts: [
          { u: "타락성익", n: 1 },
          { u: "심연악마", n: 1 },
          { u: "어둠정령", n: 1 },
        ],
      },
    };
    const res = doCombine({ heroes, heroId: heroes[0].id, opt, unlockedGrades: ALL_GRADES, gradeEnhLv: {} });
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({ r: "폴른 세라핌", g: "전설", via: "recipe" });
    expect(res.newHeroes).toHaveLength(1);
    expect(res.newHeroes[0].element).toBe("폴른 세라핌");
  });
});
