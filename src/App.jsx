import { useState, useRef, useEffect, useCallback } from "react";

const CS=48,COLS=9,ROWS=14;

// ══════════════════════════════════════════
// 맵 정의 (3종)
// 맵A: 지그재그 4단 (단일경로)
// 맵B: S자 5단 (단일경로)
// 맵 정의
// ══════════════════════════════════════════
const MAP_DEFS={
  B:{
    name:"S자",
    spawn:[0,0],
    goal:[4,13],
    buildTrack:()=>{
      const p=[];
      for(let c=0;c<=8;c++)p.push([c,0]);
      for(let r=1;r<=4;r++)p.push([8,r]);
      for(let c=7;c>=0;c--)p.push([c,4]);
      for(let r=5;r<=9;r++)p.push([0,r]);
      for(let c=1;c<=8;c++)p.push([c,9]);
      for(let r=10;r<=13;r++)p.push([8,r]);
      for(let c=7;c>=4;c--)p.push([c,13]);
      return p;
    },
    fork:false,
  },
  C:{
    name:"이중분기",
    spawn:[4,0],
    goal:[4,13],
    buildTrack:()=>null,
    fork:true,
    buildPaths:()=>{
      const main=[];
      for(let r=0;r<=2;r++)main.push([4,r]);
      const left1=[];
      for(let c=3;c>=0;c--)left1.push([c,2]);
      for(let r=3;r<=6;r++)left1.push([0,r]);
      for(let c=1;c<=4;c++)left1.push([c,6]);
      const right1=[];
      for(let c=5;c<=8;c++)right1.push([c,2]);
      for(let r=3;r<=6;r++)right1.push([8,r]);
      for(let c=7;c>=4;c--)right1.push([c,6]);
      const mid=[];
      for(let r=7;r<=8;r++)mid.push([4,r]);
      const left2=[];
      for(let c=3;c>=1;c--)left2.push([c,8]);
      for(let r=9;r<=11;r++)left2.push([1,r]);
      for(let c=2;c<=4;c++)left2.push([c,11]);
      const right2=[];
      for(let c=5;c<=7;c++)right2.push([c,8]);
      for(let r=9;r<=11;r++)right2.push([7,r]);
      for(let c=6;c>=4;c--)right2.push([c,11]);
      const merge=[];
      for(let r=12;r<=13;r++)merge.push([4,r]);
      return{main,left1,right1,mid,left2,right2,merge};
    },
  },
  D:{
    name:"나선형",
    spawn:[0,0],
    goal:[4,7],
    buildTrack:()=>{
      const p=[];
      // 외곽 1겹
      for(let c=0;c<=8;c++)p.push([c,0]);   // 위 →
      for(let r=1;r<=13;r++)p.push([8,r]);  // 오른쪽 ↓
      for(let c=7;c>=0;c--)p.push([c,13]); // 아래 ←
      for(let r=12;r>=3;r--)p.push([0,r]); // 왼쪽 ↑
      // 안쪽으로 한 번 더
      for(let c=1;c<=7;c++)p.push([c,3]);   // →
      for(let r=4;r<=10;r++)p.push([7,r]);  // ↓
      for(let c=6;c>=4;c--)p.push([c,10]); // ←
      // 중앙 골로
      for(let r=9;r>=7;r--)p.push([4,r]);
      return p;
    },
    fork:false,
  },
  E:{
    name:"역방향",
    spawn:[4,13],
    goal:[4,0],
    buildTrack:()=>{
      const p=[];
      // 아래서 위로
      for(let r=13;r>=10;r--)p.push([4,r]);
      // 오른쪽으로
      for(let c=5;c<=8;c++)p.push([c,10]);
      // 위로
      for(let r=9;r>=6;r--)p.push([8,r]);
      // 왼쪽으로
      for(let c=7;c>=0;c--)p.push([c,6]);
      // 위로
      for(let r=5;r>=2;r--)p.push([0,r]);
      // 오른쪽으로
      for(let c=1;c<=8;c++)p.push([c,2]);
      // 위로
      for(let r=1;r>=0;r--)p.push([8,r]);
      // 왼쪽으로 골까지
      for(let c=7;c>=4;c--)p.push([c,0]);
      return p;
    },
    fork:false,
  },
  F:{
    name:"대각선",
    spawn:[0,0],
    goal:[8,13],
    buildTrack:()=>{
      const p=[];
      // 대각 ↘
      for(let i=0;i<=5;i++)p.push([i,i]);
      // 오른쪽으로
      for(let c=6;c<=8;c++)p.push([c,5]);
      // 대각 ↙
      for(let i=1;i<=6;i++)p.push([8-i,5+i]);
      // 왼쪽으로
      for(let c=1;c>=0;c--)p.push([c,11]);
      // 아래로
      for(let r=12;r<=13;r++)p.push([0,r]);
      // 오른쪽으로 골까지
      for(let c=1;c<=8;c++)p.push([c,13]);
      return p;
    },
    fork:false,
  },
};

// 현재 맵 상태 (게임 시작시 결정)
let CURRENT_MAP=null;

// 회전 모드 경로 생성 (외곽을 시계방향으로 N바퀴)
function buildRotPath(laps){
  const lap=[];
  // 시계방향 외곽: 상→우→하→좌
  for(let c=0;c<COLS;c++)lap.push([c,0]);
  for(let r=1;r<ROWS;r++)lap.push([COLS-1,r]);
  for(let c=COLS-2;c>=0;c--)lap.push([c,ROWS-1]);
  for(let r=ROWS-2;r>=1;r--)lap.push([0,r]);
  const path=[];
  for(let i=0;i<laps;i++)for(const t of lap)path.push(t);
  return path;
}
let TRACK=[];
let FORK_PATHS=null;
let SPAWN_TILE=[0,0];
let GOAL_TILE=[8,13];
let TS=new Set();
let CX=4,CY=6;

function buildMap(mapKey){
  const def=MAP_DEFS[mapKey];
  SPAWN_TILE=[...def.spawn];
  GOAL_TILE=[...def.goal];
  if(def.fork){
    FORK_PATHS=def.buildPaths();
    const allTiles=[
      ...FORK_PATHS.main,
      ...(FORK_PATHS.left1||FORK_PATHS.left||[]),
      ...(FORK_PATHS.right1||FORK_PATHS.right||[]),
      ...(FORK_PATHS.mid||[]),
      ...(FORK_PATHS.left2||[]),
      ...(FORK_PATHS.right2||[]),
      ...FORK_PATHS.merge,
    ];
    TRACK=allTiles;
    TS=new Set(allTiles.map(([c,r])=>`${c},${r}`));
  } else {
    TRACK=def.buildTrack();
    FORK_PATHS=null;
    TS=new Set(TRACK.map(([c,r])=>`${c},${r}`));
  }
  if(mapKey==='C'){CX=4;CY=5;}
  else if(mapKey==='D'){CX=4;CY=6;}
  else if(mapKey==='E'){CX=4;CY=9;}
  else if(mapKey==='F'){CX=4;CY=7;}
  else{CX=4;CY=6;}
  CURRENT_MAP=mapKey;
}

// ══════════════════════════════════════════
// 패치노트
// ══════════════════════════════════════════
const PATCH_NOTES=[
  {
    version:"v1.6",
    date:"2025-06-17",
    title:"난이도 밸런스 조정",
    changes:[
      "📈 적 HP 라운드당 증가량 +22 → +50으로 상향",
      "📈 10라운드 구간마다 라운드당 증가량 ×1.3 누적 (1~10R: +50, 11~20R: +65, 21~30R: +84 ...)",
      "💀 후반 난이도 대폭 상승 (91~100R 라운드당 +530)",
    ]
  },
  {
    date:"2025-06-17",
    title:"인간 계열 유닛 추가",
    changes:[
      "🧑 노말 유닛 '인간' 추가 (무속성, 단일공격, 기본부터 뽑기 가능)",
      "🧙 고급 14종: 인간+속성 → 화염마법사/수마법사/대지마법사 등",
      "🔮 영웅 14종: 같은 마법사×2 → 홍염마법사/심해마법사/뇌전마법사 등",
      "👸 전설 14종: 같은 영웅×2 → 화염마법왕/해왕마법사/번개마법왕 등",
      "🌋 신화 14종: 같은 전설×2 → 화염마법신/해왕마법신/번개마법신 등",
      "👑 불멸 1종: 원소마법황 (신화×4 + 전설×2 + 무속성)",
      "📊 인간 계열 총 57종 추가로 조합표 대폭 확장",
    ]
  },
  {
    date:"2025-06-17",
    title:"콘텐츠 개방 시스템 추가",
    changes:[
      "🏆 클리어 횟수 기반 콘텐츠 개방 시스템 도입",
      "⚔️ 난이도 잠금: 쉬움(기본) → 보통(1클리어) → 어려움(5클리어)",
      "🌿 속성 잠금: 불/물/땅/바람 기본 → 1클리어: 전기/얼음/빛/어둠 → 5클리어: 나머지 전체",
      "💎 등급 잠금: 영웅까지 기본 → 1클리어: 전설 → 3클리어: 신화 → 5클리어: 불멸",
      "🦸 히든영웅 잠금: 수호자(기본)→상인(1)→저격수(2)→시간술사(3)→번개신(4)→연금술사(5)→도박사(6)",
      "🔒 잠긴 난이도/히든영웅은 해금 조건 표시",
      "📊 타이틀 화면에 클리어 횟수 및 다음 개방 안내 표시",
      "💾 클리어 횟수 로컬 저장 (재접속해도 유지)",
    ]
  },
  {
    date:"2025-06-17",
    title:"회전 모드 & 맵 대규모 개편",
    changes:[
      "🔄 회전 모드 추가: 외곽을 시계방향으로 순환 (일반 2바퀴, 보스 3바퀴)",
      "🎯 회전 모드 적 종류: 일반/고속(2.2배)/공중(1.8배)/투명(반투명)",
      "⚔️ 속성별 공격 가능 대상 구분 (공중/투명 타겟팅 차별화)",
      "🗺️ 맵 5종으로 확대: S자/이중분기/나선형/역방향/대각선",
      "🔀 이중분기 맵: 1차+2차 분기 각각 독립 랜덤 선택",
      "🎲 맵 선택 UI: 랜덤맵 / 선택맵 탭 분리",
      "⏭️ HUD 스킵 버튼: 라이프 옆 카운트다운 표시+스킵",
      "🎬 적 걷기 애니메이션, 사망 파티클 효과, 유닛 공격 모션 추가",
      "👁️ 적 클릭 시 하단 정보 패널 (HP/상태이상 표시)",
      "🌿 나무 속박 너프: 속박 중 재갱신 불가, 해제 후 면역 3초",
      "📋 패치노트 버전 기반 표시 (새 패치 시 자동으로 다시 표시)",
    ]
  },
  {
    date:"2025-06-17",
    title:"히든영웅 개편 & 밸런스 조정",
    changes:[
      "🦸 히든영웅 전면 개편 (전사/마법사/도적/궁수/힐러 삭제)",
      "💰 상인: 골드 획득+30%",
      "🎯 저격수: 사거리+2.0",
      "🛡️ 수호자: 라이프+15",
      "⚡ 번개신: 10% 확률 연쇄공격",
      "🌀 시간술사: 슬로우 효과+50% (버그 수정 포함)",
      "⚗️ 연금술사: 상태이상 효과×1.5 (지속시간+수치 전부)",
      "🎰 도박사: 5라운드마다 주사위 굴리기 (1~6 랜덤 보상/페널티)",
      "🌿 나무 속박 너프: 속박 중 재갱신 불가, 속박 해제 후 면역 3초",
      "⚔️ 공격력 버프 제거: 히든영웅이 공격력에 영향 없음",
      "🎮 난이도 재조정: 쉬움×1.7 / 보통×1.3 / 어려움×1.0",
      "🏠 홈버튼 위치 변경: HUD 좌측 상단 (라이프 왼쪽)",
    ]
  },
  {
    version:"v1.1",
    date:"2025-06-17",
    title:"속성별 특성 구현",
    changes:[
      "🔥 불/운석 → 범위공격 (스플래시 데미지)",
      "⚡ 전기 → 체인 (최대 3회 튕김, 60% 감쇠)",
      "🌀 바람/소리 → 관통 (일직선 전체 타격)",
      "☠️ 독 → 지속데미지 (3초 독 중첩)",
      "🌿 나무 → 속박 (1.5초 이동정지)",
      "💧 물 → 방어감소 (5초간 받는 데미지+30%)",
      "🌑 어둠 → 스턴 (0.8초 완전정지)",
      "✨ 빛 → 광역데미지 (범위 2.0칸)",
      "❄️ 얼음/⏳시간/🌊홍수 → 슬로우 (기존 유지)",
      "🎨 상태이상 시각화 (스턴=황금테두리, 속박=초록점선, 독=초록오라, 방어감소=빨간테두리)",
      "📋 유닛 선택 패널에 속성 특성 설명 표시",
    ]
  },
  {
    version:"v1.0",
    date:"2025-06-16",
    title:"콘텐츠 대확장",
    changes:[
      "⏳ 새 속성 3종 추가 (시간/홍수/운석) + 조합 연결",
      "💰 황금정령 추가 (전설, 처치마다 골드+, 강화할수록 증가)",
      "🔄 변신정령 추가 (영웅, 라운드마다 속성 랜덤 변경)",
      "👑 히든영웅 6종 추가 (상인/저격수/수호자/번개신/시간술사/연금술사)",
      "👑 기존 히든영웅 버프 전면 강화",
      "💀 보스 속성 저항 추가 (라운드별 약점 1~2개, 약점 2배/기타 10%)",
      "📣 보스 카운트다운에 약점 속성 미리 표시",
      "🌀 무한모드 추가 (100라운드 클리어 후 계속)",
      "⚡ 연쇄공격 시스템 (번개신 히든영웅 전용)",
      "💰 상인 히든영웅 골드 보너스 적용",
    ]
  },
  {
    version:"v0.9",
    date:"2025-06-16",
    title:"게임성 개선 - 웨이브 & 적 다양화",
    changes:[
      "🐝 웨이브 5종 추가 (무리/속도/장갑/힐러/일반)",
      "🧬 적 4종 추가 (분열/재생/돌진/방패)",
      "💀 보스 광폭화 (HP 40% 이하 시 속도·데미지 증가)",
      "💚 힐러형 적 - 주변 적 HP 회복",
      "🛡️ 방패·장갑 적 - 데미지 감소",
      "🌀 재생형 적 - 주기적 HP 회복",
      "🐗 돌진형 적 - 주기적 순간 가속",
      "🧬 분열형 적 - 처치 시 2마리로 분열",
      "📣 웨이브 타입 카운트다운에 표시",
    ]
  },
  {
    version:"v0.8",
    date:"2025-06-16",
    title:"UI/UX 전면 개선",
    changes:[
      "🎨 맵 타일 비주얼 개선 (흙길 텍스처, 방향 화살표)",
      "🎨 스폰/골 타일 펄스 애니메이션",
      "👾 적 비주얼 개선 (일반/중간보스/보스 각각 차별화)",
      "❤️ 체력바 개선 (둥근 모서리, 색상 변화)",
      "🧊 슬로우 걸린 적 파란 오라 표시",
      "📊 HUD 2줄 분리 및 뱃지 스타일 적용",
      "🔘 액션 버튼 그라디언트 + 그림자 효과",
      "✨ 유닛 등급별 글로우 이펙트 강화",
      "🏆 닉네임 + 랭킹 시스템 추가",
      "🐛 슬로우 타이머 버그 수정 (적 멈춤 현상)",
    ]
  },
  {
    version:"v0.7",
    date:"2025-06-16",
    title:"난이도 & 랭킹 기반 작업",
    changes:[
      "⚔️ 난이도 수치 재조정 (쉬움×2.0 / 보통×1.6 / 어려움×1.3)",
      "📋 조합표 개편 - 탭 분리, 클릭 조합 제거 (정보 전용)",
      "🗡️ 전설/신화/불멸 유닛 선택 패널에서 조합 가능",
      "🐛 랭킹 동일 닉네임 갱신 기준 수정 (라운드→골드→코인)",
    ]
  },
  {
    version:"v0.6",
    date:"2025-06-16",
    title:"사거리 & 난이도 업데이트",
    changes:[
      "⚔️ 난이도 선택 추가 (쉬움/보통/어려움)",
      "🎯 유닛별 사거리 차별화 (속성/등급마다 다름)",
      "🎯 유닛 클릭 시 사거리 원 시각화",
      "🐛 난이도 선택 버그 수정 (비동기 적용 오류)",
    ]
  },
  {
    version:"v0.5",
    date:"2025-06-16",
    title:"조합표 개편",
    changes:[
      "📋 조합표 탭 분리 (고급/영웅/전설/신화/불멸)",
      "📋 전설 이상 유닛도 선택 패널에서 조합 가능",
      "📋 조합표는 정보 확인 전용, 보유수 표시",
      "🐛 게임 시작 후 적이 움직이지 않던 버그 수정",
    ]
  },
  {
    version:"v0.4",
    date:"2025-06-16",
    title:"맵 시스템 & 시작화면",
    changes:[
      "🗺️ 맵 3종 랜덤 적용 (지그재그/S자/분기)",
      "🔀 분기 맵 추가 - 적이 두 갈래로 나뉘어 이동",
      "🎮 타이틀 시작화면 추가",
      "👑 히든영웅 선택 화면 분리",
      "🏠 게임 중 홈버튼 추가",
    ]
  },
  {
    version:"v0.3",
    date:"2025-06-15",
    title:"속성 & 소환 연출",
    changes:[
      "☠️ 독/나무 속성 추가 (조합 포함)",
      "✨ 전설 이상 뽑기 시 소환 연출 추가",
      "🎨 속성별 투사체/임팩트 이펙트 차별화",
    ]
  },
  {
    version:"v0.2",
    date:"2025-06-15",
    title:"골드/조합 시스템",
    changes:[
      "💰 킬골드 제거 → 라운드 클리어 골드 방식",
      "⚗️ 조합 시스템 개편 (고급15종 + 영웅13종 COMBO)",
      "⚗️ 전설/신화/불멸 레시피 조합 추가",
      "🎰 도박장 추가 (10라운드 해금)",
    ]
  },
  {
    version:"v0.1",
    date:"2025-06-14",
    title:"초기 버전",
    changes:[
      "🎮 랜덤 디펜스 기본 시스템",
      "🗡️ 히든영웅 버프 시스템",
      "🪙 코인 상점",
      "📦 뭉치기/보관함 시스템",
    ]
  },
];

const BASE=["불","물","땅","바람","전기","얼음","빛","어둠","소리","독","나무","시간","홍수","운석","인간"];
// 클리어 횟수별 개방 속성
const UNLOCK_ELEMENTS=(cc)=>{
  const els=["불","물","땅","바람","인간"]; // 기본
  if(cc>=1)els.push("전기","얼음","빛","어둠");
  if(cc>=5)els.push("소리","독","나무","시간","홍수","운석");
  return els;
};
// 클리어 횟수별 개방 등급
const UNLOCK_GRADES=(cc)=>{
  const grades=["노말","고급","영웅"];
  if(cc>=1)grades.push("전설");
  if(cc>=3)grades.push("신화");
  if(cc>=5)grades.push("불멸");
  return grades;
};
// 클리어 횟수별 개방 난이도
const UNLOCK_DIFF=(cc)=>{
  const diffs=["easy"];
  if(cc>=1)diffs.push("normal");
  if(cc>=5)diffs.push("hard");
  return diffs;
};
const EC={불:"#f44",물:"#48f",땅:"#a73",바람:"#8d8",전기:"#fd0",얼음:"#8ef",빛:"#ffa",어둠:"#a4f",소리:"#f8c",무속성:"#ccc",독:"#8bc34a",나무:"#4caf50",용암:"#f60",폭풍화염:"#f30",빙하:"#0cf",번개폭풍:"#fa0",공허:"#84a",공명:"#f6f",돌풍:"#afd",화염폭풍:"#f80",해일:"#08f",태풍:"#4fa",번개신:"#ff4",절대영도:"#aef",신성광:"#ffc",심연:"#608",용암폭풍:"#f50",냉기폭풍:"#8df",뇌신:"#fe0",빙하신:"#0ef",빛의신:"#ffe",어둠신:"#404",신성폭풍:"#fda",혼돈:"#628",맹독:"#6db33f",독안개:"#9ccc65",가시숲:"#388e3c",독폭풍:"#7cb342",맹독늪:"#558b2f",지진:"#a73",음파해일:"#08f",용암지진:"#b52",음파폭풍:"#f4c",불의왕:"#f50",빙설신:"#8ef",성음:"#feb",화염제왕:"#f60",파도왕:"#06f",대지왕:"#a63",폭풍왕:"#6d6",번개왕:"#ff0",빙하왕:"#0cf",광명왕:"#ffd",암흑왕:"#a0c",음파왕:"#f9c",혼돈왕:"#c6c",화염신화:"#f40",파도신화:"#04c",폭풍신화:"#0ff",번개신화:"#ff0",빙하신화:"#aff",광명신화:"#ffa",암흑신화:"#609",음파신화:"#f6a",폭풍불멸:"#fff",번개불멸:"#ff8",빙하불멸:"#aff",광명불멸:"#ffd",암흑불멸:"#808",창조불멸:"#faf",용왕불멸:"#fa4",신성불멸:"#ffd",혼돈불멸:"#c0f",궁극불멸:"#fff",화염불멸:"#f80",창조신화:"#f4f",용왕신화:"#f80",신성신화:"#fea",혼돈신화:"#a0f",시간:"#c084fc",홍수:"#38bdf8",운석:"#fb923c",시간의눈보라:"#d8b4fe",홍수해일:"#7dd3fc",화염운석:"#fdba74",시간폭풍:"#a855f7",대홍수:"#0ea5e9",운석폭우:"#f97316",시간지배자:"#9333ea",해일왕:"#0284c7",운석신:"#ea580c",황금정령:"#ffd700",변신정령:"#e2e8f0",
  인간:"#94a3b8",
  화염마법사:"#f97316",수마법사:"#38bdf8",대지마법사:"#a78a5a",폭풍마법사:"#86efac",번개마법사:"#fde047",빙결마법사:"#bae6fd",성마법사:"#fef08a",흑마법사:"#c084fc",음파마법사:"#f9a8d4",독마법사:"#86efac",삼림마법사:"#4ade80",시간마법사:"#d8b4fe",홍수마법사:"#7dd3fc",운석마법사:"#fdba74",
  홍염마법사:"#ef4444",심해마법사:"#0ea5e9",암석마법사:"#92400e",폭풍술사:"#22c55e",뇌전마법사:"#eab308",절빙마법사:"#93c5fd",신성마법사:"#fef9c3",심연마법사:"#7c3aed",공명마법사:"#ec4899",맹독마법사:"#65a30d",고목마법사:"#166534",시공마법사:"#9333ea",해일마법사:"#0284c7",천공마법사:"#ea580c",
  화염마법왕:"#dc2626",해왕마법사:"#0369a1",대지마법왕:"#78350f",폭풍마법왕:"#15803d",번개마법왕:"#ca8a04",빙하마법왕:"#60a5fa",광명마법왕:"#fef08a",암흑마법왕:"#6d28d9",음파마법왕:"#db2777",독왕마법사:"#4d7c0f",삼림마법왕:"#14532d",시간마법왕:"#7e22ce",홍수마법왕:"#1d4ed8",운석마법왕:"#c2410c",
  화염마법신:"#b91c1c",해왕마법신:"#1e40af",대지마법신:"#451a03",폭풍마법신:"#14532d",번개마법신:"#713f12",빙하마법신:"#1e3a5f",광명마법신:"#fef3c7",암흑마법신:"#3b0764",음파마법신:"#831843",독왕마법신:"#1a2e05",삼림마법신:"#052e16",시간마법신:"#2e1065",홍수마법신:"#172554",운석마법신:"#431407",
  원소마법황:"#f0abfc",
};
const EE={불:"🔥",물:"💧",땅:"🪨",바람:"🌀",전기:"⚡",얼음:"❄️",빛:"✨",어둠:"🌑",소리:"🔊",무속성:"⭐",독:"☠️",나무:"🌿",맹독:"🐍",독안개:"🌫️",가시숲:"🌵",독폭풍:"💀",맹독늪:"🌑",용암:"👺",폭풍화염:"💣",빙하:"🧊",번개폭풍:"🦅",공허:"🧛",공명:"🦇",돌풍:"💨",화염폭풍:"😈",해일:"🧟",번개신:"💀",절대영도:"🐍",신성광:"🧝",심연:"🧟",용암폭풍:"🪓",냉기폭풍:"🥶",태풍:"🌪️",뇌신:"⚡",빙하신:"❄️",빛의신:"🌟",어둠신:"💀",신성폭풍:"🪽",혼돈:"🌀",폭풍신화:"👑",번개신화:"⚡",빙하신화:"❄️",광명신화:"🌟",암흑신화:"🌑",창조신화:"✨",용왕신화:"🐉",신성신화:"👑",혼돈신화:"🌀",폭풍불멸:"🌊",번개불멸:"⚡",빙하불멸:"❄️",광명불멸:"🌟",암흑불멸:"🌑",창조불멸:"✨",용왕불멸:"🐉",신성불멸:"👑",혼돈불멸:"🌀",궁극불멸:"💫",시간:"⏳",홍수:"🌊",운석:"☄️",시간의눈보라:"❄️",홍수해일:"🌊",화염운석:"🔥",시간폭풍:"⌛",대홍수:"🌀",운석폭우:"💥",시간지배자:"🕰️",해일왕:"🌊",운석신:"☄️",황금정령:"💰",변신정령:"🔄",
  인간:"🧑",
  화염마법사:"🧙",수마법사:"🧙",대지마법사:"🧙",폭풍마법사:"🧙",번개마법사:"🧙",빙결마법사:"🧙",성마법사:"🧙",흑마법사:"🧙",음파마법사:"🧙",독마법사:"🧙",삼림마법사:"🧙",시간마법사:"🧙",홍수마법사:"🧙",운석마법사:"🧙",
  홍염마법사:"🔮",심해마법사:"🔮",암석마법사:"🔮",폭풍술사:"🔮",뇌전마법사:"🔮",절빙마법사:"🔮",신성마법사:"🔮",심연마법사:"🔮",공명마법사:"🔮",맹독마법사:"🔮",고목마법사:"🔮",시공마법사:"🔮",해일마법사:"🔮",천공마법사:"🔮",
  화염마법왕:"👸",해왕마법사:"👸",대지마법왕:"👸",폭풍마법왕:"👸",번개마법왕:"👸",빙하마법왕:"👸",광명마법왕:"👸",암흑마법왕:"👸",음파마법왕:"👸",독왕마법사:"👸",삼림마법왕:"👸",시간마법왕:"👸",홍수마법왕:"👸",운석마법왕:"👸",
  화염마법신:"🌋",해왕마법신:"🌊",대지마법신:"🗻",폭풍마법신:"🌪️",번개마법신:"⚡",빙하마법신:"❄️",광명마법신:"☀️",암흑마법신:"🌑",음파마법신:"🎵",독왕마법신:"☠️",삼림마법신:"🌳",시간마법신:"⏰",홍수마법신:"🌊",운석마법신:"☄️",
  원소마법황:"👑",
};
const EN={불:"화염정령",물:"물정령",땅:"대지정령",바람:"바람정령",전기:"번개정령",얼음:"서리정령",빛:"빛의정령",어둠:"어둠정령",소리:"음파정령",무속성:"무속성",독:"독정령",나무:"나무정령",맹독:"맹독정령",독안개:"독안개",가시숲:"가시숲정령",독폭풍:"독폭풍",맹독늪:"맹독늪",용암:"고블린",폭풍화염:"화염폭탄병",빙하:"빙하유령",번개폭풍:"폭풍매",공허:"뱀파이어",공명:"음파박쥐",돌풍:"돌풍조",화염폭풍:"임프",해일:"구울",번개신:"스켈레톤",절대영도:"코볼트",신성광:"하피",심연:"좀비",용암폭풍:"오크전사",냉기폭풍:"냉기마법사",태풍:"폭풍독수리",뇌신:"뇌신전사",빙하신:"빙하신수",빛의신:"신성폭격수",어둠신:"드레드로드",신성폭풍:"타락천사",혼돈:"혼돈술사",폭풍신화:"폭풍의신",번개신화:"번개의신",빙하신화:"빙하의신",광명신화:"광명의신",암흑신화:"암흑의신",창조신화:"창조신",용왕신화:"용왕",신성신화:"신성군주",혼돈신화:"혼돈신",폭풍불멸:"폭풍불멸",번개불멸:"번개불멸",빙하불멸:"빙하불멸",광명불멸:"광명불멸",암흑불멸:"암흑불멸",창조불멸:"창조불멸",용왕불멸:"용왕불멸",신성불멸:"신성불멸",혼돈불멸:"혼돈불멸",궁극불멸:"궁극불멸",화염제왕:"화염제왕",파도왕:"파도왕",대지왕:"대지왕",폭풍왕:"폭풍왕",번개왕:"번개왕",빙하왕:"빙하왕",광명왕:"광명왕",암흑왕:"암흑왕",음파왕:"음파왕",혼돈왕:"혼돈왕",화염신화:"화염신화",파도신화:"파도신화",음파신화:"음파신화",화염불멸:"화염불멸",지진:"지진정령",음파해일:"음파해일",용암지진:"용암지진",음파폭풍:"음파폭풍",불의왕:"불의왕",빙설신:"빙설신",성음:"성음",시간:"시간정령",홍수:"홍수정령",운석:"운석정령",시간의눈보라:"시간의눈보라",홍수해일:"홍수해일",화염운석:"화염운석",시간폭풍:"시간폭풍술사",대홍수:"대홍수신",운석폭우:"운석술사",시간지배자:"시간지배자",해일왕:"해일왕",운석신:"운석신",황금정령:"황금정령",변신정령:"변신정령",
  인간:"인간",
  화염마법사:"화염마법사",수마법사:"수마법사",대지마법사:"대지마법사",폭풍마법사:"폭풍마법사",번개마법사:"번개마법사",빙결마법사:"빙결마법사",성마법사:"성마법사",흑마법사:"흑마법사",음파마법사:"음파마법사",독마법사:"독마법사",삼림마법사:"삼림마법사",시간마법사:"시간마법사",홍수마법사:"홍수마법사",운석마법사:"운석마법사",
  홍염마법사:"홍염마법사",심해마법사:"심해마법사",암석마법사:"암석마법사",폭풍술사:"폭풍술사",뇌전마법사:"뇌전마법사",절빙마법사:"절빙마법사",신성마법사:"신성마법사",심연마법사:"심연마법사",공명마법사:"공명마법사",맹독마법사:"맹독마법사",고목마법사:"고목마법사",시공마법사:"시공마법사",해일마법사:"해일마법사",천공마법사:"천공마법사",
  화염마법왕:"화염마법왕",해왕마법사:"해왕마법사",대지마법왕:"대지마법왕",폭풍마법왕:"폭풍마법왕",번개마법왕:"번개마법왕",빙하마법왕:"빙하마법왕",광명마법왕:"광명마법왕",암흑마법왕:"암흑마법왕",음파마법왕:"음파마법왕",독왕마법사:"독왕마법사",삼림마법왕:"삼림마법왕",시간마법왕:"시간마법왕",홍수마법왕:"홍수마법왕",운석마법왕:"운석마법왕",
  화염마법신:"화염마법신",해왕마법신:"해왕마법신",대지마법신:"대지마법신",폭풍마법신:"폭풍마법신",번개마법신:"번개마법신",빙하마법신:"빙하마법신",광명마법신:"광명마법신",암흑마법신:"암흑마법신",음파마법신:"음파마법신",독왕마법신:"독왕마법신",삼림마법신:"삼림마법신",시간마법신:"시간마법신",홍수마법신:"홍수마법신",운석마법신:"운석마법신",
  원소마법황:"원소마법황",
};
const hr=(hex,a)=>{const h=hex.replace('#','');const l=h.length===3?h[0]+h[0]+h[1]+h[1]+h[2]+h[2]:h;return `rgba(${parseInt(l.slice(0,2),16)},${parseInt(l.slice(2,4),16)},${parseInt(l.slice(4,6),16)},${a})`;};
const GC={노말:"#aaa",고급:"#4af",영웅:"#a4f",전설:"#fa0",신화:"#f44",불멸:"#f8f"};
const ATK_MAP={노말:12,고급:22,영웅:42,전설:67,신화:97,불멸:167};
const SELL_PRICE={노말:5,고급:10,영웅:20,전설:35,신화:50,불멸:75};

const COMBO=[
  {a:"불",b:"불",r:"화염폭풍",g:"고급"},{a:"물",b:"물",r:"해일",g:"고급"},{a:"땅",b:"땅",r:"지진",g:"고급"},
  {a:"바람",b:"바람",r:"돌풍",g:"고급"},{a:"전기",b:"전기",r:"번개신",g:"고급"},{a:"얼음",b:"얼음",r:"절대영도",g:"고급"},
  {a:"빛",b:"빛",r:"신성광",g:"고급"},{a:"어둠",b:"어둠",r:"심연",g:"고급"},{a:"소리",b:"소리",r:"공명",g:"고급"},
  {a:"불",b:"땅",r:"용암",g:"고급"},{a:"물",b:"얼음",r:"빙하",g:"고급"},{a:"바람",b:"전기",r:"번개폭풍",g:"고급"},
  {a:"빛",b:"어둠",r:"공허",g:"고급"},{a:"불",b:"바람",r:"폭풍화염",g:"고급"},{a:"물",b:"소리",r:"음파해일",g:"고급"},
  {a:"독",b:"독",r:"맹독",g:"고급"},{a:"나무",b:"나무",r:"가시숲",g:"고급"},{a:"독",b:"나무",r:"독안개",g:"고급"},
  {a:"화염폭풍",b:"용암",r:"용암폭풍",g:"영웅"},{a:"해일",b:"빙하",r:"냉기폭풍",g:"영웅"},
  {a:"번개신",b:"번개폭풍",r:"뇌신",g:"영웅"},{a:"절대영도",b:"빙하",r:"빙하신",g:"영웅"},
  {a:"신성광",b:"공허",r:"빛의신",g:"영웅"},{a:"심연",b:"공허",r:"어둠신",g:"영웅"},
  {a:"공명",b:"번개폭풍",r:"성음",g:"영웅"},{a:"돌풍",b:"번개폭풍",r:"태풍",g:"영웅"},
  {a:"지진",b:"용암",r:"용암지진",g:"영웅"},{a:"해일",b:"음파해일",r:"음파폭풍",g:"영웅"},
  {a:"폭풍화염",b:"용암폭풍",r:"불의왕",g:"영웅"},{a:"냉기폭풍",b:"빙하신",r:"빙설신",g:"영웅"},
  {a:"신성광",b:"태풍",r:"신성폭풍",g:"영웅"},
  {a:"맹독",b:"독안개",r:"독폭풍",g:"영웅"},{a:"가시숲",b:"독안개",r:"맹독늪",g:"영웅"},
  // 시간 조합
  {a:"시간",b:"시간",r:"시간폭풍",g:"고급"},
  {a:"시간",b:"바람",r:"시간의눈보라",g:"고급"},
  // 홍수 조합
  {a:"홍수",b:"홍수",r:"대홍수",g:"고급"},
  {a:"홍수",b:"물",r:"홍수해일",g:"고급"},
  // 운석 조합
  {a:"운석",b:"운석",r:"운석폭우",g:"고급"},
  {a:"운석",b:"불",r:"화염운석",g:"고급"},
  // 영웅 조합 (새 속성 - 동속성)
  {a:"시간폭풍",b:"대홍수",r:"시간지배자",g:"영웅"},
  {a:"대홍수",b:"운석폭우",r:"해일왕",g:"영웅"},
  {a:"시간폭풍",b:"운석폭우",r:"운석신",g:"영웅"},
  // 변신정령 (영웅)
  {a:"시간지배자",b:"해일왕",r:"변신정령",g:"영웅"},
  // ── 인간 계열 고급 (인간 + 속성)
  {a:"인간",b:"불",r:"화염마법사",g:"고급"},{a:"인간",b:"물",r:"수마법사",g:"고급"},
  {a:"인간",b:"땅",r:"대지마법사",g:"고급"},{a:"인간",b:"바람",r:"폭풍마법사",g:"고급"},
  {a:"인간",b:"전기",r:"번개마법사",g:"고급"},{a:"인간",b:"얼음",r:"빙결마법사",g:"고급"},
  {a:"인간",b:"빛",r:"성마법사",g:"고급"},{a:"인간",b:"어둠",r:"흑마법사",g:"고급"},
  {a:"인간",b:"소리",r:"음파마법사",g:"고급"},{a:"인간",b:"독",r:"독마법사",g:"고급"},
  {a:"인간",b:"나무",r:"삼림마법사",g:"고급"},{a:"인간",b:"시간",r:"시간마법사",g:"고급"},
  {a:"인간",b:"홍수",r:"홍수마법사",g:"고급"},{a:"인간",b:"운석",r:"운석마법사",g:"고급"},
  // ── 인간 계열 영웅 (같은 마법사×2)
  {a:"화염마법사",b:"화염마법사",r:"홍염마법사",g:"영웅"},{a:"수마법사",b:"수마법사",r:"심해마법사",g:"영웅"},
  {a:"대지마법사",b:"대지마법사",r:"암석마법사",g:"영웅"},{a:"폭풍마법사",b:"폭풍마법사",r:"폭풍술사",g:"영웅"},
  {a:"번개마법사",b:"번개마법사",r:"뇌전마법사",g:"영웅"},{a:"빙결마법사",b:"빙결마법사",r:"절빙마법사",g:"영웅"},
  {a:"성마법사",b:"성마법사",r:"신성마법사",g:"영웅"},{a:"흑마법사",b:"흑마법사",r:"심연마법사",g:"영웅"},
  {a:"음파마법사",b:"음파마법사",r:"공명마법사",g:"영웅"},{a:"독마법사",b:"독마법사",r:"맹독마법사",g:"영웅"},
  {a:"삼림마법사",b:"삼림마법사",r:"고목마법사",g:"영웅"},{a:"시간마법사",b:"시간마법사",r:"시공마법사",g:"영웅"},
  {a:"홍수마법사",b:"홍수마법사",r:"해일마법사",g:"영웅"},{a:"운석마법사",b:"운석마법사",r:"천공마법사",g:"영웅"},
];
const RECIPES=[
  {r:"화염제왕",g:"전설",parts:[{u:"용암폭풍",n:1},{u:"불의왕",n:1},{u:"화염폭풍",n:1}]},
  {r:"파도왕",g:"전설",parts:[{u:"냉기폭풍",n:1},{u:"음파폭풍",n:1},{u:"해일",n:1}]},
  {r:"대지왕",g:"전설",parts:[{u:"용암지진",n:1},{u:"지진",n:1},{u:"용암",n:1},{u:"땅",n:1}]},
  {r:"폭풍왕",g:"전설",parts:[{u:"태풍",n:1},{u:"뇌신",n:1},{u:"돌풍",n:1}]},
  {r:"번개왕",g:"전설",parts:[{u:"뇌신",n:1},{u:"성음",n:1},{u:"번개신",n:1}]},
  {r:"빙하왕",g:"전설",parts:[{u:"빙하신",n:1},{u:"빙설신",n:1},{u:"절대영도",n:1}]},
  {r:"광명왕",g:"전설",parts:[{u:"빛의신",n:1},{u:"신성폭풍",n:1},{u:"신성광",n:1}]},
  {r:"암흑왕",g:"전설",parts:[{u:"어둠신",n:1},{u:"심연",n:1},{u:"공허",n:1},{u:"어둠",n:1}]},
  {r:"음파왕",g:"전설",parts:[{u:"성음",n:1},{u:"음파폭풍",n:1},{u:"공명",n:1}]},
  {r:"혼돈왕",g:"전설",parts:[{u:"빛의신",n:1},{u:"어둠신",n:1},{u:"공허",n:2}]},
  {r:"화염신화",g:"신화",parts:[{u:"화염제왕",n:1},{u:"용암폭풍",n:1},{u:"불의왕",n:1},{u:"화염폭풍",n:2},{u:"용암",n:1},{u:"불",n:1}]},
  {r:"파도신화",g:"신화",parts:[{u:"파도왕",n:1},{u:"냉기폭풍",n:1},{u:"음파폭풍",n:1},{u:"해일",n:2},{u:"빙하",n:1},{u:"물",n:1}]},
  {r:"폭풍신화",g:"신화",parts:[{u:"폭풍왕",n:1},{u:"태풍",n:1},{u:"뇌신",n:1},{u:"돌풍",n:2},{u:"번개폭풍",n:1},{u:"바람",n:1}]},
  {r:"번개신화",g:"신화",parts:[{u:"번개왕",n:1},{u:"뇌신",n:1},{u:"성음",n:1},{u:"번개신",n:2},{u:"번개폭풍",n:1},{u:"전기",n:1}]},
  {r:"빙하신화",g:"신화",parts:[{u:"빙하왕",n:1},{u:"빙하신",n:1},{u:"빙설신",n:1},{u:"절대영도",n:2},{u:"빙하",n:1},{u:"얼음",n:1}]},
  {r:"광명신화",g:"신화",parts:[{u:"광명왕",n:1},{u:"빛의신",n:1},{u:"신성폭풍",n:1},{u:"신성광",n:2},{u:"공허",n:1},{u:"빛",n:1}]},
  {r:"암흑신화",g:"신화",parts:[{u:"암흑왕",n:1},{u:"어둠신",n:1},{u:"심연",n:2},{u:"공허",n:2},{u:"어둠",n:1}]},
  {r:"음파신화",g:"신화",parts:[{u:"음파왕",n:1},{u:"성음",n:1},{u:"음파폭풍",n:1},{u:"공명",n:2},{u:"음파해일",n:1},{u:"소리",n:1}]},
  {r:"폭풍불멸",g:"불멸",parts:[{u:"폭풍신화",n:1},{u:"번개신화",n:1},{u:"폭풍왕",n:1},{u:"번개왕",n:1},{u:"태풍",n:1},{u:"뇌신",n:1},{u:"돌풍",n:1},{u:"번개폭풍",n:1},{u:"바람",n:1}]},
  {r:"빙하불멸",g:"불멸",parts:[{u:"빙하신화",n:1},{u:"파도신화",n:1},{u:"빙하왕",n:1},{u:"파도왕",n:1},{u:"빙설신",n:1},{u:"냉기폭풍",n:1},{u:"절대영도",n:1},{u:"빙하",n:1},{u:"얼음",n:1}]},
  {r:"광명불멸",g:"불멸",parts:[{u:"광명신화",n:1},{u:"암흑신화",n:1},{u:"광명왕",n:1},{u:"암흑왕",n:1},{u:"빛의신",n:1},{u:"어둠신",n:1},{u:"신성광",n:1},{u:"심연",n:1},{u:"빛",n:1}]},
  {r:"화염불멸",g:"불멸",parts:[{u:"화염신화",n:1},{u:"음파신화",n:1},{u:"화염제왕",n:1},{u:"음파왕",n:1},{u:"용암폭풍",n:1},{u:"성음",n:1},{u:"화염폭풍",n:1},{u:"공명",n:1},{u:"불",n:1}]},
  {r:"궁극불멸",g:"불멸",parts:[{u:"폭풍신화",n:1},{u:"빙하신화",n:1},{u:"광명신화",n:1},{u:"화염신화",n:1},{u:"혼돈왕",n:1},{u:"대지왕",n:1},{u:"음파왕",n:1},{u:"파도왕",n:1},{u:"무속성",n:1}]},
  // 돈유닛 (전설 히든 - 최종조합 없음)
  {r:"황금정령",g:"전설",isGoldUnit:true,parts:[{u:"시간지배자",n:1},{u:"해일왕",n:1},{u:"운석신",n:1},{u:"무속성",n:1}]},
  // ── 인간 계열 전설 (영웅×2)
  {r:"화염마법왕",g:"전설",parts:[{u:"홍염마법사",n:2}]},
  {r:"해왕마법사",g:"전설",parts:[{u:"심해마법사",n:2}]},
  {r:"대지마법왕",g:"전설",parts:[{u:"암석마법사",n:2}]},
  {r:"폭풍마법왕",g:"전설",parts:[{u:"폭풍술사",n:2}]},
  {r:"번개마법왕",g:"전설",parts:[{u:"뇌전마법사",n:2}]},
  {r:"빙하마법왕",g:"전설",parts:[{u:"절빙마법사",n:2}]},
  {r:"광명마법왕",g:"전설",parts:[{u:"신성마법사",n:2}]},
  {r:"암흑마법왕",g:"전설",parts:[{u:"심연마법사",n:2}]},
  {r:"음파마법왕",g:"전설",parts:[{u:"공명마법사",n:2}]},
  {r:"독왕마법사",g:"전설",parts:[{u:"맹독마법사",n:2}]},
  {r:"삼림마법왕",g:"전설",parts:[{u:"고목마법사",n:2}]},
  {r:"시간마법왕",g:"전설",parts:[{u:"시공마법사",n:2}]},
  {r:"홍수마법왕",g:"전설",parts:[{u:"해일마법사",n:2}]},
  {r:"운석마법왕",g:"전설",parts:[{u:"천공마법사",n:2}]},
  // ── 인간 계열 신화 (전설×2)
  {r:"화염마법신",g:"신화",parts:[{u:"화염마법왕",n:2}]},
  {r:"해왕마법신",g:"신화",parts:[{u:"해왕마법사",n:2}]},
  {r:"대지마법신",g:"신화",parts:[{u:"대지마법왕",n:2}]},
  {r:"폭풍마법신",g:"신화",parts:[{u:"폭풍마법왕",n:2}]},
  {r:"번개마법신",g:"신화",parts:[{u:"번개마법왕",n:2}]},
  {r:"빙하마법신",g:"신화",parts:[{u:"빙하마법왕",n:2}]},
  {r:"광명마법신",g:"신화",parts:[{u:"광명마법왕",n:2}]},
  {r:"암흑마법신",g:"신화",parts:[{u:"암흑마법왕",n:2}]},
  {r:"음파마법신",g:"신화",parts:[{u:"음파마법왕",n:2}]},
  {r:"독왕마법신",g:"신화",parts:[{u:"독왕마법사",n:2}]},
  {r:"삼림마법신",g:"신화",parts:[{u:"삼림마법왕",n:2}]},
  {r:"시간마법신",g:"신화",parts:[{u:"시간마법왕",n:2}]},
  {r:"홍수마법신",g:"신화",parts:[{u:"홍수마법왕",n:2}]},
  {r:"운석마법신",g:"신화",parts:[{u:"운석마법왕",n:2}]},
  // ── 인간 계열 불멸 (신화×2 + 전설×2 + 무속성)
  {r:"원소마법황",g:"불멸",parts:[{u:"화염마법신",n:1},{u:"해왕마법신",n:1},{u:"폭풍마법신",n:1},{u:"번개마법신",n:1},{u:"화염마법왕",n:1},{u:"해왕마법사",n:1},{u:"무속성",n:1}]},
  // 변신유닛 (영웅급) - 조합은 COMBO에서 처리
];

const HH=[
  {id:"guardian",  name:"수호자",  emoji:"🛡️",color:"#6366f1",desc:"라이프+15",             buff:{extraLife:15},   unlockAt:0},
  {id:"merchant",  name:"상인",    emoji:"💰",color:"#eab308",desc:"골드 획득+30%",         buff:{goldMul:0.3},    unlockAt:1},
  {id:"sniper",    name:"저격수",  emoji:"🎯",color:"#06b6d4",desc:"사거리+2.0",            buff:{rangeBonus:2.0}, unlockAt:2},
  {id:"chrono",    name:"시간술사",emoji:"🌀",color:"#a78bfa",desc:"슬로우 효과+50%",       buff:{slowBonus:0.5},  unlockAt:3},
  {id:"thunder",   name:"번개신",  emoji:"⚡",color:"#fbbf24",desc:"10% 확률 연쇄공격",    buff:{chain:0.10},     unlockAt:4},
  {id:"alchemist", name:"연금술사",emoji:"⚗️",color:"#34d399",desc:"상태이상 효과×1.5",    buff:{statusMul:1.5},  unlockAt:5},
  {id:"gambler",   name:"도박사",  emoji:"🎰",color:"#f43f5e",desc:"5라운드마다 주사위 굴리기",buff:{gambler:true},unlockAt:6},
];
// ══════════════════════════════════════════
// 보스 테이블 (10라운드마다)
// ══════════════════════════════════════════
// 랜덤 보스 생성
const BOSS_NAMES=["화염군주","빙하제왕","번개신황","어둠군주","대지의왕","음파황제","독군주","시간신","빛의신황","혼돈마왕","심연군주","폭풍황제","독룡","운석신황","냉기제왕","번개마신","대지신","소리황제","시간마왕","혼돈신"];
const BOSS_EMOJIS=["🔥","❄️","⚡","🌑","🪨","🔊","☠️","⏳","✨","💫","🌀","🌪️","🐉","☄️","🥶","💀","🌍","🎵","🕰️","🌈"];
const BOSS_WEAK_POOL=["불","물","땅","바람","전기","얼음","빛","어둠","소리","독","나무","시간","홍수","운석","무속성"];
const BOSS_COLORS=["#f60","#0cf","#ff0","#a4f","#a73","#f8c","#8bc","#c084fc","#ffa","#fff","#628","#4fa","#f80","#fb923c","#8df","#f44","#4af","#f6f","#a855f7","#38bdf8"];

const makeBoss=(round)=>{
  // 시드 기반 랜덤 (같은 라운드면 항상 같은 보스)
  const seed=round*1234567;
  const rnd=(n)=>((seed*n*9301+49297)%233280)/233280;
  const nameIdx=Math.floor(rnd(1)*BOSS_NAMES.length);
  const emojiIdx=Math.floor(rnd(2)*BOSS_EMOJIS.length);
  const colorIdx=Math.floor(rnd(3)*BOSS_COLORS.length);
  // 약점 2개 랜덤 (중복 없이)
  const pool=[...BOSS_WEAK_POOL];
  const w1idx=Math.floor(rnd(4)*pool.length);
  const w1=pool.splice(w1idx,1)[0];
  const w2idx=Math.floor(rnd(5)*pool.length);
  const w2=pool[w2idx];
  return{
    name:BOSS_NAMES[nameIdx],
    emoji:BOSS_EMOJIS[emojiIdx],
    color:BOSS_COLORS[colorIdx],
    weak:[w1,w2],
    desc:`${w1}·${w2} 약점`,
  };
};
// 보스 weak 속성에 포함된 유닛인지 확인
const isBossWeak=(element,bossWeaks)=>{
  if(!bossWeaks||bossWeaks.length===0)return true;
  const base=EL_BASE[element]||element;
  return bossWeaks.some(w=>w===element||w===base);
};

const SHOP_ITEMS=[
  {id:"advanced",label:"고급 유닛 선택",cost:1,grade:"고급",color:"#4af",unlockRound:1},
  {id:"hero",label:"영웅 유닛 선택",cost:2,grade:"영웅",color:"#a4f",unlockRound:1},
  {id:"legend",label:"전설 유닛 선택",cost:3,grade:"전설",color:"#fa0",unlockRound:1},
  {id:"neutral",label:"무속성 유닛",cost:10,grade:"노말",element:"무속성",color:"#ccc",unlockRound:20},
];
const GAMBLE_GOLD=[
  {cost:10,label:"10G 도박",results:[{prob:0.45,reward:"gold",val:0,desc:"꽝"},{prob:0.30,reward:"gold",val:15,desc:"+15G"},{prob:0.15,reward:"gold",val:30,desc:"+30G"},{prob:0.07,reward:"gold",val:60,desc:"+60G"},{prob:0.03,reward:"gold",val:150,desc:"+150G 🎉"}]},
  {cost:50,label:"50G 도박",results:[{prob:0.40,reward:"gold",val:0,desc:"꽝"},{prob:0.30,reward:"gold",val:70,desc:"+70G"},{prob:0.18,reward:"gold",val:150,desc:"+150G"},{prob:0.09,reward:"gold",val:300,desc:"+300G"},{prob:0.03,reward:"gold",val:800,desc:"+800G 🎉"}]},
  {cost:100,label:"100G 도박",results:[{prob:0.38,reward:"gold",val:0,desc:"꽝"},{prob:0.30,reward:"gold",val:140,desc:"+140G"},{prob:0.18,reward:"gold",val:300,desc:"+300G"},{prob:0.10,reward:"gold",val:600,desc:"+600G"},{prob:0.04,reward:"gold",val:2000,desc:"+2000G 🎉"}]},
];
const GAMBLE_COIN=[
  {cost:1,label:"1코인 도박",results:[{prob:0.45,reward:"coin",val:0,desc:"꽝"},{prob:0.30,reward:"coin",val:2,desc:"+2코인"},{prob:0.15,reward:"coin",val:4,desc:"+4코인"},{prob:0.07,reward:"coin",val:8,desc:"+8코인"},{prob:0.03,reward:"coin",val:20,desc:"+20코인 🎉"}]},
  {cost:5,label:"5코인 도박",results:[{prob:0.40,reward:"coin",val:0,desc:"꽝"},{prob:0.30,reward:"coin",val:7,desc:"+7코인"},{prob:0.18,reward:"coin",val:15,desc:"+15코인"},{prob:0.09,reward:"coin",val:30,desc:"+30코인"},{prob:0.03,reward:"coin",val:80,desc:"+80코인 🎉"}]},
  {cost:10,label:"10코인 도박",results:[{prob:0.38,reward:"coin",val:0,desc:"꽝"},{prob:0.30,reward:"coin",val:14,desc:"+14코인"},{prob:0.18,reward:"coin",val:30,desc:"+30코인"},{prob:0.10,reward:"coin",val:60,desc:"+60코인"},{prob:0.04,reward:"coin",val:150,desc:"+150코인 🎉"}]},
];

let hid=1,eid=1;
const EL_BASE={"불":"불","물":"물","땅":"땅","바람":"바람","전기":"전기","얼음":"얼음","빛":"빛","어둠":"어둠","소리":"소리","무속성":"무속성","독":"독","나무":"나무","맹독":"독","독안개":"독","가시숲":"나무","독폭풍":"독","맹독늪":"나무","화염폭풍":"불","해일":"물","지진":"땅","돌풍":"바람","번개신":"전기","절대영도":"얼음","신성광":"빛","심연":"어둠","공명":"소리","용암":"불","빙하":"물","번개폭풍":"바람","공허":"빛","폭풍화염":"불","음파해일":"물","용암폭풍":"불","냉기폭풍":"물","뇌신":"전기","빙하신":"얼음","빛의신":"빛","어둠신":"어둠","성음":"소리","태풍":"바람","용암지진":"땅","음파폭풍":"물","불의왕":"불","빙설신":"물","신성폭풍":"빛","화염제왕":"불","파도왕":"물","대지왕":"땅","폭풍왕":"바람","번개왕":"전기","빙하왕":"얼음","광명왕":"빛","암흑왕":"어둠","음파왕":"소리","혼돈왕":"빛","화염신화":"불","파도신화":"물","폭풍신화":"바람","번개신화":"전기","빙하신화":"얼음","광명신화":"빛","암흑신화":"어둠","음파신화":"소리","폭풍불멸":"바람","빙하불멸":"얼음","광명불멸":"빛","화염불멸":"불","궁극불멸":"바람","시간":"시간","홍수":"홍수","운석":"운석","시간의눈보라":"시간","홍수해일":"홍수","화염운석":"운석","시간폭풍":"시간","대홍수":"홍수","운석폭우":"운석","시간지배자":"시간","해일왕":"홍수","운석신":"운석","황금정령":"무속성","변신정령":"무속성",
  // 인간 계열
  "인간":"무속성",
  "화염마법사":"불","수마법사":"물","대지마법사":"땅","폭풍마법사":"바람","번개마법사":"전기","빙결마법사":"얼음","성마법사":"빛","흑마법사":"어둠","음파마법사":"소리","독마법사":"독","삼림마법사":"나무","시간마법사":"시간","홍수마법사":"홍수","운석마법사":"운석",
  "홍염마법사":"불","심해마법사":"물","암석마법사":"땅","폭풍술사":"바람","뇌전마법사":"전기","절빙마법사":"얼음","신성마법사":"빛","심연마법사":"어둠","공명마법사":"소리","맹독마법사":"독","고목마법사":"나무","시공마법사":"시간","해일마법사":"홍수","천공마법사":"운석",
  "화염마법왕":"불","해왕마법사":"물","대지마법왕":"땅","폭풍마법왕":"바람","번개마법왕":"전기","빙하마법왕":"얼음","광명마법왕":"빛","암흑마법왕":"어둠","음파마법왕":"소리","독왕마법사":"독","삼림마법왕":"나무","시간마법왕":"시간","홍수마법왕":"홍수","운석마법왕":"운석",
  "화염마법신":"불","해왕마법신":"물","대지마법신":"땅","폭풍마법신":"바람","번개마법신":"전기","빙하마법신":"얼음","광명마법신":"빛","암흑마법신":"어둠","음파마법신":"소리","독왕마법신":"독","삼림마법신":"나무","시간마법신":"시간","홍수마법신":"홍수","운석마법신":"운석",
  "원소마법황":"무속성",
};
const elBase=(el)=>EL_BASE[el]||el;
const GRADE_FX={노말:{glow:0,trail:0},고급:{glow:4,trail:0},영웅:{glow:6,trail:3},전설:{glow:10,trail:5},신화:{glow:14,trail:8},불멸:{glow:20,trail:12}};
// 속성별 기본 사거리 (타일 단위)
const EL_RANGE={
  "불":2.5,"물":3.0,"땅":1.8,"바람":3.5,"전기":3.2,
  "얼음":2.0,"빛":4.5,"어둠":2.8,"소리":3.8,"무속성":3.0,
  "독":2.2,"나무":2.0,
  // 고급
  "화염폭풍":2.5,"해일":3.0,"지진":1.8,"돌풍":3.5,"번개신":3.2,
  "절대영도":2.0,"신성광":4.5,"심연":2.8,"공명":3.8,
  "용암":2.2,"빙하":2.5,"번개폭풍":3.5,"공허":3.0,"폭풍화염":2.8,"음파해일":4.0,
  "맹독":2.2,"독안개":3.0,"가시숲":1.8,
  // 영웅
  "용암폭풍":2.5,"냉기폭풍":2.8,"뇌신":3.5,"빙하신":2.2,"빛의신":5.0,
  "어둠신":2.8,"성음":4.0,"태풍":3.8,"용암지진":2.0,"음파폭풍":4.2,
  "불의왕":2.8,"빙설신":2.5,"신성폭풍":4.5,"독폭풍":2.8,"맹독늪":2.2,
  // 전설
  "화염제왕":3.0,"파도왕":3.5,"대지왕":2.2,"폭풍왕":4.0,"번개왕":3.8,
  "빙하왕":2.5,"광명왕":5.5,"암흑왕":3.0,"음파왕":4.5,"혼돈왕":3.5,
  // 신화
  "화염신화":3.2,"파도신화":3.8,"폭풍신화":4.5,"번개신화":4.0,
  "빙하신화":2.8,"광명신화":6.0,"암흑신화":3.2,"음파신화":5.0,
  // 불멸
  "폭풍불멸":5.0,"빙하불멸":3.0,"광명불멸":6.5,"화염불멸":3.5,"궁극불멸":7.0,"시간":3.5,"홍수":2.8,"운석":4.0,"시간폭풍":4.0,"대홍수":3.2,"운석폭우":4.5,"시간지배자":4.5,"해일왕":3.5,"운석신":5.0,"황금정령":3.0,"변신정령":3.0,
};
// 등급별 사거리 보정
const GRADE_RANGE_BONUS={"노말":0,"고급":0.2,"영웅":0.4,"전설":0.6,"신화":0.8,"불멸":1.2};
const getRange=(el,grade)=>{
  const base=EL_RANGE[el]||3.0;
  const bonus=GRADE_RANGE_BONUS[grade]||0;
  return Math.min(base+bonus, 7.0);
};

// ══════════════════════════════════════════
// 속성별 특성 (elBase 기준)
// ══════════════════════════════════════════
const EL_TRAITS={
  "불":   {type:"splash",   desc:"범위공격",    detail:"반경 1.5칸 스플래시",   splashR:1.5, dmgMul:0.6},
  "운석": {type:"splash",   desc:"범위공격",    detail:"반경 2.0칸 스플래시",   splashR:2.0, dmgMul:0.5},
  "전기": {type:"chain",    desc:"체인",        detail:"최대 3회 튕김 (60%감쇠)",chainCnt:3,  chainMul:0.6},
  "바람": {type:"pierce",   desc:"관통",        detail:"일직선 적 전체 타격"},
  "소리": {type:"pierce",   desc:"관통",        detail:"일직선 적 전체 타격"},
  "독":   {type:"dot",      desc:"독데미지",    detail:"3초간 지속데미지",       dotDur:3,    dotMul:0.3},
  "나무": {type:"root",     desc:"속박",        detail:"1.5초 이동정지",         rootDur:1.5},
  "물":   {type:"debuff",   desc:"방어감소",    detail:"5초간 받는 데미지+30%",  debuffDur:5, debuffMul:1.3},
  "어둠": {type:"stun",     desc:"스턴",        detail:"0.8초 완전 정지",        stunDur:0.8},
  "빛":   {type:"heal",     desc:"치유",        detail:"주변 아군 HP%로 회복 (미구현→광역데미지)", splashR:2.0, dmgMul:0.4},
  "얼음": {type:"slow",     desc:"슬로우",      detail:"속도 감소"},
  "시간": {type:"slow",     desc:"광역슬로우",  detail:"범위 내 전체 슬로우"},
  "홍수": {type:"slow",     desc:"광역슬로우",  detail:"넓은 범위 슬로우"},
  "시간의눈보라":{type:"slow",desc:"슬로우",   detail:"속도 감소"},
  "홍수해일":{type:"slow",  desc:"슬로우",      detail:"속도 감소"},
  "화염운석":{type:"splash",desc:"범위공격",   detail:"반경 1.5칸 스플래시",    splashR:1.5,dmgMul:0.5},
};
const getElTrait=(el)=>{
  const base=EL_BASE[el]||el;
  return EL_TRAITS[el]||EL_TRAITS[base]||{type:"single",desc:"단일공격",detail:"적 1명 타격"};
};

const ICE_UNITS=new Set(["얼음","절대영도","빙하","빙하신","빙설신","빙하왕","빙하신화","빙하불멸","시간","시간폭풍","시간지배자"]);
const ICE_SLOW={"노말":{cd:5,dur:2,range:1.5,slow:0.45},"고급":{cd:4,dur:3,range:2.0,slow:0.40},"영웅":{cd:3,dur:4,range:2.5,slow:0.35},"전설":{cd:2,dur:5,range:3.0,slow:0.30},"신화":{cd:1.5,dur:6,range:3.5,slow:0.25},"불멸":{cd:1,dur:8,range:4.0,slow:0.20}};
// 홍수 속성: 범위 슬로우 (얼음보다 느리지만 범위 넓음)
const FLOOD_UNITS=new Set(["홍수","대홍수","해일왕"]);
const FLOOD_SLOW={"노말":{cd:6,dur:1.5,range:2.5,slow:0.6},"고급":{cd:5,dur:2,range:3.0,slow:0.55},"영웅":{cd:4,dur:2.5,range:3.5,slow:0.5},"전설":{cd:3,dur:3,range:4.0,slow:0.45},"신화":{cd:2,dur:4,range:4.5,slow:0.4},"불멸":{cd:1.5,dur:5,range:5.0,slow:0.35}};

const SPRITE_CACHE={};
const loadSprite=(el)=>{if(SPRITE_CACHE[el]&&SPRITE_CACHE[el].complete)return;const img=new Image();img.src=`/${el}.png`;SPRITE_CACHE[el]=img;};
["불","물","땅","바람","전기","얼음","빛","어둠","소리","무속성","독","나무"].forEach(loadSprite);

const mkH=(el,g="노말",gradeEnhLv={})=>{
  const lv=gradeEnhLv[g]||0;
  const bonus=lv>0?{atk:([2,4,8,14,20,32][["노말","고급","영웅","전설","신화","불멸"].indexOf(g)]||2)*lv,spd:0.05*lv}:{atk:0,spd:0};
  const isIce=ICE_UNITS.has(el);
  const isFlood=FLOOD_UNITS.has(el);
  const iceCfg=isIce?(ICE_SLOW[g]||ICE_SLOW["노말"]):isFlood?(FLOOD_SLOW[g]||FLOOD_SLOW["노말"]):null;
  const range=(isIce||isFlood)?iceCfg.range:getRange(el,g);  // rangeBonus는 게임루프에서 동적 적용
  return{id:hid++,element:el,grade:g,atk:(isIce||isFlood)?0:(ATK_MAP[g]||10)+bonus.atk,spd:Math.min(1.0+bonus.spd,3.0),range,col:null,row:null,lastShot:0,enhLv:0,isIce:isIce||isFlood,iceCfg};
};

// ── 웨이브 타입 정의
// waveType: 'normal'|'horde'|'fast'|'armored'|'healer'|'boss_rage'
// enemyType: '일반'|'은신'|'공중'|'분열'|'재생'|'돌진'|'방패'

// ── 적 생성
const mkE=(type,rnd=1,isBoss=false,isMid=false,mapKey='B',waveOpts={})=>{
  const tier=Math.floor((rnd-1)/10); // 0=1~10R, 1=11~20R, ...
  const perRound=Math.floor(50*Math.pow(1.3,tier));
  const base=isBoss?2500+rnd*220:isMid?1200+rnd*120:150+rnd*perRound;
  // 타입별 HP
  let hp=Math.floor(
    type==="은신"?base*0.75:
    type==="공중"?base*1.1:
    type==="분열"?base*0.7:
    type==="재생"?base*1.3:
    type==="방패"?base*1.5:
    base
  );
  // 웨이브 보정
  if(waveOpts.armor)hp=Math.floor(hp*1.6);
  if(waveOpts.horde)hp=Math.floor(hp*0.55);

  const spd=isBoss?0.6:isMid?0.8:
    type==="공중"?1.5:
    type==="돌진"?1.3:
    waveOpts.fast?1.9:1.0;

  // 방어력 (장갑 웨이브 or 방패형)
  const armor=waveOpts.armor?0.4:type==="방패"?0.35:0;

  const base_e={
    id:eid++,type,hp,maxHp:hp,
    pathIdx:0,
    speed:spd,baseSpd:spd,
    dmg:isBoss?5:isMid?3:1,
    remove:false,rewarded:false,
    isBoss,isMid,
    reward:isBoss?100:isMid?20:0,
    armor,          // 0~1: 데미지 감소율
    regenTimer:0,   // 재생형 HP 회복 타이머
    dashTimer:type==="돌진"?3+Math.random()*2:0, // 돌진 쿨다운
    isDashing:false,
    isRaging:false, // 보스 광폭화
    healTimer:type==="힐러"?2:0, // 힐러 쿨다운
  };

  if(mapKey==='ROT'){
    // 회전 모드: 유닛 타입별 바퀴 수
    const laps=isBoss?3:isMid?3:2;
    const rotPath=buildRotPath(laps);
    // 회전 모드 적 속성
    const rotSpd=type==='고속'?2.2:type==='공중'?1.8:type==='투명'?1.1:isBoss?0.5:isMid?0.7:1.0;
    return{...base_e,speed:rotSpd,baseSpd:rotSpd,x:rotPath[0][0]*CS,y:rotPath[0][1]*CS,path:rotPath,rotEnemy:true,
      type:type,
      isAir:type==='공중',
      isInvis:type==='투명',
    };
  }
  if(mapKey==='C'&&FORK_PATHS){
    // 1차 분기: 랜덤 좌/우
    const branch1=Math.random()<0.5?'left1':'right1';
    // 2차 분기: 랜덤 좌/우
    const branch2=Math.random()<0.5?'left2':'right2';
    const fullPath=[
      ...FORK_PATHS.main,
      ...(FORK_PATHS[branch1]||[]),
      ...(FORK_PATHS.mid||[]),
      ...(FORK_PATHS[branch2]||[]),
      ...FORK_PATHS.merge
    ];
    return{...base_e,x:fullPath[0][0]*CS,y:fullPath[0][1]*CS,path:fullPath,branch:branch1};
  }
  return{...base_e,x:TRACK[0][0]*CS,y:TRACK[0][1]*CS,path:TRACK};
};

// ── 웨이브 타입 결정
const getWaveType=(round)=>{
  if(round%10===0)return'boss';
  if(round%5===0)return'mid';
  // 라운드별 웨이브 타입 확률
  const r=Math.random();
  if(round<10)return'normal';
  if(round<20){
    if(r<0.3)return'horde';
    return'normal';
  }
  if(round<40){
    if(r<0.25)return'horde';
    if(r<0.45)return'fast';
    if(r<0.6)return'armored';
    return'normal';
  }
  // 40라운드 이후 모든 웨이브 가능
  if(r<0.2)return'horde';
  if(r<0.38)return'fast';
  if(r<0.54)return'armored';
  if(r<0.65)return'healer';
  return'normal';
};

const autoPlace=(heroes)=>{
  const used=new Set(heroes.filter(x=>x.col!==null).map(x=>`${x.col},${x.row}`));
  const avail=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(TS.has(`${c},${r}`)||(c===CX&&r===CY)||used.has(`${c},${r}`))continue;
    avail.push([c,r]);
  }
  return avail.length?avail[Math.floor(Math.random()*avail.length)]:null;
};

const initGame=(diff='hard')=>({
  heroes:[],hiddenHero:null,enemies:[],projs:[],particles:[],
  life:20,gold:50,coins:0,round:1,
  total:0,running:false,spawnT:0,spawnC:0,maxSpawn:15,
  cleared:false,over:false,
  bossSpawned:false,midSpawned:false,
  stacks:{},gameTime:0,gradeEnhLv:{},
  waveType:'normal',waveLabel:'',
  impacts:[],
  mapKey:CURRENT_MAP||'B',
  difficulty:diff,
  // 난이도별 유닛 공격력 배율: 쉬움 1.5배, 보통 1.25배, 어려움 1.0배
  diffMul:diff==='easy'?1.7:diff==='normal'?1.3:1.0,
});

// ══════════════════════════════════════════
// 소환 연출
// ══════════════════════════════════════════
function SummonOverlay({anim,onClose}){
  if(!anim)return null;
  const c=GC[anim.grade]||"#fff";
  const pc=anim.grade==="불멸"?24:anim.grade==="신화"?16:10;
  const bg=anim.grade==="불멸"?"radial-gradient(ellipse at center,rgba(255,136,255,0.18) 0%,rgba(0,0,0,0.96) 70%)":anim.grade==="신화"?"radial-gradient(ellipse at center,rgba(255,68,68,0.15) 0%,rgba(0,0,0,0.96) 70%)":"radial-gradient(ellipse at center,rgba(255,170,0,0.12) 0%,rgba(0,0,0,0.95) 70%)";
  return(
    <div onClick={onClose} style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:bg,display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,cursor:"pointer",animation:"sFadeIn 0.35s ease"}}>
      <style>{`
        @keyframes sFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes sPop{0%{transform:scale(0.2) rotate(-15deg);opacity:0}55%{transform:scale(1.18) rotate(4deg);opacity:1}75%{transform:scale(0.95) rotate(-2deg)}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes sGlow{0%,100%{filter:drop-shadow(0 0 18px ${c}) drop-shadow(0 0 36px ${c})}50%{filter:drop-shadow(0 0 40px ${c}) drop-shadow(0 0 80px ${c})}}
        @keyframes sOrbit{from{transform:rotate(var(--s)) translateX(var(--r)) rotate(calc(-1*var(--s)))}to{transform:rotate(calc(var(--s) + 360deg)) translateX(var(--r)) rotate(calc(-1*(var(--s)+360deg)))}}
        @keyframes sRing{0%{transform:scale(0.4);opacity:0.9}100%{transform:scale(2.2);opacity:0}}
        @keyframes sTxtIn{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{position:"absolute",width:160,height:160,borderRadius:"50%",border:`3px solid ${c}`,animation:"sRing 1.2s ease-out infinite",pointerEvents:"none"}}/>
      {Array.from({length:pc}).map((_,i)=>{
        const ang=(360/pc)*i,r2=anim.grade==="불멸"?110:anim.grade==="신화"?95:78,sz=anim.grade==="불멸"?8:6,dur=1.0+(i%3)*0.12;
        return(<div key={i} style={{position:"absolute",width:sz,height:sz,borderRadius:"50%",background:c,top:"50%",left:"50%",marginTop:-sz/2,marginLeft:-sz/2,"--s":`${ang}deg`,"--r":`${r2}px`,animation:`sOrbit ${dur}s linear infinite`,animationDelay:`${i*(dur/pc)}s`,boxShadow:`0 0 ${sz+4}px ${c}`,pointerEvents:"none"}}/>);
      })}
      <div style={{textAlign:"center",animation:"sPop 0.6s cubic-bezier(.34,1.56,.64,1) 0.05s both",position:"relative",zIndex:1,userSelect:"none"}}>
        <div style={{fontSize:anim.grade==="불멸"?110:anim.grade==="신화"?96:82,animation:"sGlow 1.8s ease-in-out infinite",lineHeight:1,marginBottom:14}}>{EE[anim.element]||"✨"}</div>
        <div style={{fontSize:26,fontWeight:"bold",color:"#fff",textShadow:`0 0 16px ${c}`,letterSpacing:2,marginBottom:8,animation:"sTxtIn 0.4s ease 0.3s both"}}>{EN[anim.element]||anim.element}</div>
        <div style={{display:"inline-block",fontSize:15,fontWeight:"bold",color:c,border:`2px solid ${c}`,borderRadius:10,padding:"5px 24px",letterSpacing:6,boxShadow:`0 0 18px ${c}66`,background:`${c}11`,animation:"sTxtIn 0.4s ease 0.45s both"}}>{anim.grade}</div>
        <div style={{marginTop:18,fontSize:11,color:"#555",animation:"sTxtIn 0.4s ease 0.8s both"}}>탭하여 닫기</div>
      </div>
    </div>
  );
}

function Overlay({children}){
  return(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,overflowY:"auto"}}>
      <div style={{background:"#161b22",borderRadius:16,padding:20,border:"1px solid #30363d",width:"90%",maxWidth:380,maxHeight:"88vh",overflowY:"auto"}}>{children}</div>
    </div>
  );
}
function Btn({bg,children,onClick,disabled,style}){
  return(
    <button onClick={onClick} disabled={disabled}
      style={{background:bg,border:"none",color:"#eee",borderRadius:8,padding:"8px 12px",cursor:disabled?"not-allowed":"pointer",fontSize:13,fontWeight:"bold",flex:1,opacity:disabled?0.5:1,...style}}>
      {children}
    </button>
  );
}

export default function App(){
  const cvs=useRef(null);
  const G=useRef(null);
  const raf=useRef(null);
  const lt=useRef(0);
  const dragR=useRef(null);
  const spR=useRef(1);
  const gameLoopRef=useRef(null);
  const randomPicksRef=useRef([]);

  // 게임 화면 단계: 'title' | 'hidden' | 'game'
  const [phase,setPhase]=useState('title');
  const [difficulty,setDifficulty]=useState('easy');
  const [clearCount,setClearCount]=useState(()=>{try{return parseInt(localStorage.getItem('clearCount')||'0');}catch{return 0;}});
  const [mapMode,setMapMode]=useState('random'); // 'random' | 'pick'
  const [selectedMap,setSelectedMap]=useState('B');
  const [showPatch,setShowPatch]=useState(()=>{
    try{
      const seen=localStorage.getItem('patchSeenVersion');
      return seen!==PATCH_NOTES[0].version;
    }catch{return true;}
  });
  const [showGuide,setShowGuide]=useState(false);
  const [nickname,setNickname]=useState('');
  const [showRanking,setShowRanking]=useState(false);
  const [ranking,setRanking]=useState([]);
  const [rankLoading,setRankLoading]=useState(false); // 첫 진입시 패치노트 표시 // easy/normal/hard
  const [ui,setUi]=useState({life:20,gold:50,coins:0,round:1,total:0,over:false,victory:false});
  const [heroes,setHeroes]=useState([]);
  const [selH,setSelH]=useState(null);
  const [selEnemy,setSelEnemy]=useState(null);
  const [drag,setDrag]=useState(null);
  const [modal,setModal]=useState(null);
  const [showCombo,setShowCombo]=useState(false);
  const [comboFilter,setComboFilter]=useState("고급");
  const [speed,setSpeedState]=useState(1);
  const [selHero,setSelHero]=useState(null);
  const [countdown,setCountdown]=useState(0);
  const countdownRef=useRef(null);
  const countdownValRef=useRef(0);
  const [randomPicks,setRandomPicks]=useState([]);
  const [stacks,setStacks]=useState({});
  const [summonAnim,setSummonAnim]=useState(null);
  const [detailHero,setDetailHero]=useState(null); // 상세정보 모달
  const longPressTimer=useRef(null);
  const [currentMapName,setCurrentMapName]=useState('');
  const [rotMode,setRotMode]=useState(false); // 회전 모드 여부

  const triggerSummon=(el,grade)=>{
    if(!["전설","신화","불멸"].includes(grade))return;
    setSummonAnim({element:el,grade});
  };

  const sync=useCallback(()=>{
    const g=G.current;if(!g)return;
    setUi({life:g.life,gold:g.gold,coins:g.coins,round:g.round,total:g.total,over:g.over,victory:g.victory||false});
    setHeroes([...g.heroes]);
    setStacks({...g.stacks});
  },[]);

  const getBuff=useCallback(()=>{
    const g=G.current;if(!g||!g.hiddenHero)return{goldMul:0,rangeBonus:0,chain:0,slowBonus:0,statusMul:1,gambler:false};
    const hd=HH.find(h=>h.id===g.hiddenHero.id);
    return hd?{...{goldMul:0,rangeBonus:0,chain:0,slowBonus:0,statusMul:1,gambler:false},...hd.buff}:{goldMul:0,rangeBonus:0,chain:0,slowBonus:0,statusMul:1,gambler:false};
  },[]);

  const draw=useCallback(()=>{
    const c=cvs.current;if(!c)return;
    const ctx=c.getContext("2d"),g=G.current;
    ctx.clearRect(0,0,COLS*CS,ROWS*CS);
    ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,COLS*CS,ROWS*CS);

    // ── 배경
    ctx.fillStyle="#0d1117";ctx.fillRect(0,0,COLS*CS,ROWS*CS);

    // ── 타일 배경
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const isT=TS.has(`${col},${r}`),isC=col===CX&&r===CY;
      const isSpawn=col===SPAWN_TILE[0]&&r===SPAWN_TILE[1];
      const isGoal=col===GOAL_TILE[0]&&r===GOAL_TILE[1];
      if(isSpawn||isGoal){
        // 스폰/골은 나중에 별도 처리
        ctx.fillStyle="#111827";ctx.fillRect(col*CS,r*CS,CS,CS);
      } else if(isC){
        // 히든영웅 슬롯
        ctx.fillStyle="#1e1b4b";ctx.fillRect(col*CS,r*CS,CS,CS);
        ctx.strokeStyle="#3730a3";ctx.lineWidth=1;ctx.strokeRect(col*CS+0.5,r*CS+0.5,CS-1,CS-1);ctx.lineWidth=1;
      } else if(isT){
        // 경로 타일 - 흙길 느낌
        ctx.fillStyle="#1c2a1c";ctx.fillRect(col*CS,r*CS,CS,CS);
        // 경로 텍스처 (어두운 점)
        ctx.fillStyle="#162016";
        ctx.fillRect(col*CS+4,r*CS+4,2,2);
        ctx.fillRect(col*CS+CS-8,r*CS+CS-8,2,2);
        ctx.strokeStyle="#0f1a0f";ctx.lineWidth=1;ctx.strokeRect(col*CS,r*CS,CS,CS);
      } else {
        // 일반 타일 - 약간 질감
        ctx.fillStyle="#111827";ctx.fillRect(col*CS,r*CS,CS,CS);
        ctx.strokeStyle="#0d1420";ctx.lineWidth=1;ctx.strokeRect(col*CS,r*CS,CS,CS);
      }
    }

    // ── 회전 모드 외곽 강조
    if(CURRENT_MAP==='ROT'){
      ctx.save();
      ctx.strokeStyle="rgba(124,58,237,0.5)";ctx.lineWidth=3;
      ctx.strokeRect(0,0,COLS*CS,ROWS*CS);
      // 외곽 타일 색상
      for(let c=0;c<COLS;c++){
        ctx.fillStyle="rgba(124,58,237,0.08)";ctx.fillRect(c*CS,0,CS,CS);
        ctx.fillRect(c*CS,(ROWS-1)*CS,CS,CS);
      }
      for(let r=1;r<ROWS-1;r++){
        ctx.fillStyle="rgba(124,58,237,0.08)";ctx.fillRect(0,r*CS,CS,CS);
        ctx.fillRect((COLS-1)*CS,r*CS,CS,CS);
      }
      ctx.restore();
    }

    // ── 분기맵 경로 색상
    if(CURRENT_MAP==='C'&&FORK_PATHS){
      // 1차 분기 좌/우
      (FORK_PATHS.left1||[]).forEach(([col,r])=>{
        ctx.fillStyle="rgba(59,130,246,0.15)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
      (FORK_PATHS.right1||[]).forEach(([col,r])=>{
        ctx.fillStyle="rgba(239,68,68,0.15)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
      // 2차 분기 좌/우
      (FORK_PATHS.left2||[]).forEach(([col,r])=>{
        ctx.fillStyle="rgba(99,102,241,0.15)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
      (FORK_PATHS.right2||[]).forEach(([col,r])=>{
        ctx.fillStyle="rgba(251,146,60,0.15)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
      // 분기점/합류점 황금 테두리
      ctx.save();ctx.shadowColor="#fd0";ctx.shadowBlur=8;
      ctx.strokeStyle="#fd0";ctx.lineWidth=2;
      // 1차 분기점
      const bp1=FORK_PATHS.main[FORK_PATHS.main.length-1];
      ctx.strokeRect(bp1[0]*CS+2,bp1[1]*CS+2,CS-4,CS-4);
      // 1차 합류/2차 분기점
      const mp1=FORK_PATHS.mid[0];
      ctx.strokeRect(mp1[0]*CS+2,mp1[1]*CS+2,CS-4,CS-4);
      // 2차 분기점
      const bp2=FORK_PATHS.mid[FORK_PATHS.mid.length-1];
      ctx.strokeRect(bp2[0]*CS+2,bp2[1]*CS+2,CS-4,CS-4);
      // 2차 합류점
      const mp2=FORK_PATHS.merge[0];
      ctx.strokeRect(mp2[0]*CS+2,mp2[1]*CS+2,CS-4,CS-4);
      ctx.restore();
    }

    // ── 경로 화살표 (방향 표시)
    {
      const trackRef=CURRENT_MAP==='C'&&FORK_PATHS
        ?[...FORK_PATHS.main,...(FORK_PATHS.left1||[]),...(FORK_PATHS.right1||[]),...(FORK_PATHS.mid||[]),...(FORK_PATHS.left2||[]),...(FORK_PATHS.right2||[]),...FORK_PATHS.merge]
        :TRACK;
      ctx.fillStyle="rgba(255,255,255,0.08)";
      for(let i=1;i<trackRef.length-1;i+=4){
        const[pc,pr]=trackRef[i-1],[nc,nr]=trackRef[i+1];
        const dx=nc-pc,dy=nr-pr;
        const cx2=trackRef[i][0]*CS+CS/2,cy2=trackRef[i][1]*CS+CS/2;
        const len=Math.sqrt(dx*dx+dy*dy)||1;
        const ux=dx/len,uy=dy/len;
        ctx.beginPath();
        ctx.moveTo(cx2+ux*6,cy2+uy*6);
        ctx.lineTo(cx2-ux*4+uy*4,cy2-uy*4-ux*4);
        ctx.lineTo(cx2-ux*4-uy*4,cy2-uy*4+ux*4);
        ctx.closePath();ctx.fill();
      }
    }

    // ── 스폰 타일
    {const[sc,sr]=SPAWN_TILE;
      const t=Date.now()/1000;
      const pulse=Math.sin(t*2)*0.15+0.25;
      ctx.save();
      ctx.shadowColor="#22c55e";ctx.shadowBlur=12;
      ctx.fillStyle=`rgba(34,197,94,${pulse})`;ctx.fillRect(sc*CS,sr*CS,CS,CS);
      ctx.strokeStyle="#22c55e";ctx.lineWidth=2;ctx.strokeRect(sc*CS+1,sr*CS+1,CS-2,CS-2);
      ctx.restore();
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 8px sans-serif";ctx.fillStyle="#4ade80";ctx.fillText("SPAWN",sc*CS+CS/2,sr*CS+14);
      ctx.font="bold 16px sans-serif";ctx.fillStyle="#4ade80";ctx.fillText("▶",sc*CS+CS/2,sr*CS+33);
      ctx.textAlign="left";ctx.textBaseline="alphabetic";}

    // ── 골 타일
    {const[gc2,gr]=GOAL_TILE;
      const t=Date.now()/1000;
      const pulse=Math.sin(t*2+1)*0.15+0.25;
      ctx.save();
      ctx.shadowColor="#ef4444";ctx.shadowBlur=12;
      ctx.fillStyle=`rgba(239,68,68,${pulse})`;ctx.fillRect(gc2*CS,gr*CS,CS,CS);
      ctx.strokeStyle="#ef4444";ctx.lineWidth=2;ctx.strokeRect(gc2*CS+1,gr*CS+1,CS-2,CS-2);
      ctx.restore();
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 8px sans-serif";ctx.fillStyle="#f87171";ctx.fillText("GOAL",gc2*CS+CS/2,gr*CS+14);
      ctx.font="bold 16px sans-serif";ctx.fillStyle="#f87171";ctx.fillText("🏁",gc2*CS+CS/2,gr*CS+33);
      ctx.textAlign="left";ctx.textBaseline="alphabetic";}

    // 배치 가이드
    if(dragR.current||selHero){
      for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
        if(TS.has(`${col},${r}`)||(col===CX&&r===CY))continue;
        ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(col*CS,r*CS,CS,CS);
        ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.strokeRect(col*CS,r*CS,CS,CS);
      }
    }

    // 선택된 유닛 사거리 표시
    if(g&&selHero){
      const sh=g.heroes.find(h=>h.id===selHero);
      if(sh&&sh.col!==null){
        const hx=sh.col*CS+CS/2,hy=sh.row*CS+CS/2;
        const rng=(sh.range||3.0)*CS;
        const gc=GC[sh.grade]||"#aaa";
        // 사거리 채우기
        ctx.save();
        ctx.beginPath();ctx.arc(hx,hy,rng,0,Math.PI*2);
        ctx.fillStyle=gc.replace('#','rgba(').replace(/^rgba\(/,'rgba(')+'22)';
        // 직접 rgba 계산
        ctx.fillStyle=hr(gc,0.08);
        ctx.fill();
        // 사거리 테두리
        ctx.strokeStyle=gc;ctx.lineWidth=1.5;ctx.globalAlpha=0.5;
        ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.arc(hx,hy,rng,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);ctx.globalAlpha=1;
        // 사거리 수치 표시
        ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillStyle="#fff";ctx.globalAlpha=0.8;
        ctx.fillText(`사거리 ${sh.range.toFixed(1)}`,hx,hy-rng-8);
        ctx.globalAlpha=1;ctx.textAlign="left";ctx.textBaseline="alphabetic";
        ctx.restore();
      }
    }

    // 히든영웅
    if(g&&g.hiddenHero){
      const hd=HH.find(h=>h.id===g.hiddenHero.id);
      ctx.fillStyle=hr(hd?.color||"#888888",0.33);ctx.fillRect(CX*CS,CY*CS,CS,CS);
      ctx.font="24px serif";ctx.fillText(hd?.emoji||"?",CX*CS+11,CY*CS+30);
      ctx.fillStyle="#aaffaa";ctx.font="bold 7px sans-serif";ctx.fillText("BUFF",CX*CS+14,CY*CS+44);
    }else{
      ctx.fillStyle="rgba(255,255,255,0.07)";ctx.fillRect(CX*CS,CY*CS,CS,CS);
      ctx.fillStyle="rgba(255,255,255,0.3)";ctx.font="11px sans-serif";ctx.fillText("히든",CX*CS+9,CY*CS+28);
    }

    // 영웅
    if(g)for(const h of g.heroes){
      if(h.col===null)continue;
      const sel=h.id===dragR.current||h.id===selHero;
      // 공격 모션: 타겟 방향으로 3px 찌르기
      let animOX=0,animOY=0;
      if(h.shootAnim>0){
        const prog=h.shootAnim/0.15;
        const push=Math.sin(prog*Math.PI)*3;
        // 아래 방향(적이 아래에 있는 경우가 많음)으로 찌르기
        animOY=-push;
      }
      const hx=h.col*CS+animOX,hy=h.row*CS+animOY;
      const gr=GC[h.grade]||"#6b7280";
      ctx.save();
      // 등급별 배경 글로우
      const glowMap={노말:0,고급:4,영웅:6,전설:10,신화:14,불멸:20};
      const glow=glowMap[h.grade]||0;
      if(glow>0){ctx.shadowColor=gr;ctx.shadowBlur=glow;}
      if(sel){ctx.fillStyle="rgba(251,191,36,0.12)";ctx.fillRect(hx,hy,CS,CS);}
      // 변신정령: 현재 변신 속성으로 표시
      const dispEl=h._isMorph&&h._morphEl?h._morphEl:h.element;
      const spr=SPRITE_CACHE[dispEl]||SPRITE_CACHE[h.element];
      if(spr&&spr.complete&&spr.naturalWidth>0){ctx.drawImage(spr,hx,hy,CS,CS);}
      else{
        ctx.fillStyle=gr+"22";ctx.beginPath();ctx.arc(hx+CS/2,hy+CS/2,CS/2-2,0,Math.PI*2);ctx.fill();
        ctx.font="20px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.shadowBlur=0;ctx.fillStyle="#fff";
        ctx.fillText(EE[dispEl]||EE[h.element]||"?",hx+CS/2,hy+CS/2);
        ctx.textAlign="left";ctx.textBaseline="alphabetic";loadSprite(h.element);
      }
      // 변신정령 표시
      if(h._isMorph){
        ctx.fillStyle="#a78bfa";ctx.font="bold 7px sans-serif";ctx.textAlign="center";
        ctx.fillText("변신",hx+CS/2,hy+8);ctx.textAlign="left";
      }
      ctx.shadowBlur=0;
      // 테두리
      ctx.strokeStyle=sel?"#fbbf24":gr;ctx.lineWidth=sel?2.5:h.grade==="불멸"?2:1;
      ctx.strokeRect(hx+0.5,hy+0.5,CS-1,CS-1);ctx.lineWidth=1;
      // 등급 뱃지 (하단)
      ctx.fillStyle=gr+"cc";ctx.fillRect(hx,hy+CS-12,CS,12);
      ctx.fillStyle="#000a";ctx.fillRect(hx,hy+CS-12,CS,12);
      ctx.fillStyle=gr;ctx.font="bold 7px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(h.grade,hx+CS/2,hy+CS-6);ctx.textAlign="left";ctx.textBaseline="alphabetic";
      if(h.enhLv>0){
        ctx.fillStyle="#fcd34d";ctx.font="bold 9px sans-serif";
        ctx.fillText(`+${h.enhLv}`,hx+3,hy+12);
      }
      ctx.restore();
    }

    // ── 적 렌더링
    if(g)for(const e of g.enemies){
      if(e.remove)continue;
      ctx.save();
      if(e.type==="은신")ctx.globalAlpha=0.4;
      const ex=e.x,ey=e.y;
      const hR=Math.max(0,e.hp/e.maxHp);
      const rad=e.isBoss?CS/2+2:e.isMid?CS/2-1:CS/2-5;

      // 보스: 붉은 육각 + 글로우
      if(e.isBoss){
        ctx.shadowColor="#ff0000";ctx.shadowBlur=16;
        // 육각형
        ctx.beginPath();
        for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;ctx.lineTo(ex+CS/2+rad*Math.cos(a),ey+CS/2+rad*Math.sin(a));}
        ctx.closePath();
        const bg=ctx.createRadialGradient(ex+CS/2,ey+CS/2,0,ex+CS/2,ey+CS/2,rad);
        bg.addColorStop(0,"#7f1d1d");bg.addColorStop(1,"#450a0a");
        ctx.fillStyle=bg;ctx.fill();
        ctx.strokeStyle="#ef4444";ctx.lineWidth=2;ctx.stroke();
        ctx.shadowBlur=0;
        // 이모지
        ctx.font="22px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText("💀",ex+CS/2,ey+CS/2);
        ctx.font="bold 7px sans-serif";ctx.fillStyle="#fca5a5";ctx.fillText("BOSS",ex+CS/2,ey+CS/2+14);
        ctx.textAlign="left";ctx.textBaseline="alphabetic";

      // 중간보스: 주황 다이아몬드
      } else if(e.isMid){
        ctx.shadowColor="#f97316";ctx.shadowBlur=10;
        ctx.save();ctx.translate(ex+CS/2,ey+CS/2);ctx.rotate(Math.PI/4);
        const s=rad*0.85;
        const bg2=ctx.createLinearGradient(-s,-s,s,s);
        bg2.addColorStop(0,"#7c2d12");bg2.addColorStop(1,"#431407");
        ctx.fillStyle=bg2;ctx.fillRect(-s,-s,s*2,s*2);
        ctx.strokeStyle="#fb923c";ctx.lineWidth=1.5;ctx.strokeRect(-s,-s,s*2,s*2);
        ctx.restore();
        ctx.shadowBlur=0;
        ctx.font="16px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText("⚡",ex+CS/2,ey+CS/2);
        ctx.font="bold 6px sans-serif";ctx.fillStyle="#fed7aa";ctx.fillText("MID",ex+CS/2,ey+CS/2+13);
        ctx.textAlign="left";ctx.textBaseline="alphabetic";

      // 일반/특수 적
      } else {
        const typeStyle={
          "일반":  {clr:"#991b1b",clrL:"#dc2626",emoji:"👾"},
          "은신":  {clr:"#5b21b6",clrL:"#7c3aed",emoji:"🥷"},
          "공중":  {clr:"#1e3a8a",clrL:"#2563eb",emoji:"🦅"},
          "분열":  {clr:"#065f46",clrL:"#059669",emoji:"🧬"},
          "재생":  {clr:"#134e4a",clrL:"#0d9488",emoji:"🌀"},
          "돌진":  {clr:"#7c2d12",clrL:"#ea580c",emoji:"🐗"},
          "방패":  {clr:"#1e3a5f",clrL:"#0369a1",emoji:"🛡️"},
          "힐러":  {clr:"#14532d",clrL:"#16a34a",emoji:"💚"},
          // 회전 모드 전용
          "고속":  {clr:"#92400e",clrL:"#f59e0b",emoji:"💨"},
          "투명":  {clr:"#1e1b4b",clrL:"#6366f1",emoji:"👁️"},
        };
        // 회전 모드 투명 유닛 반투명 처리
        if(e.isInvis&&!e.stunTimer&&!e.rootTimer)ctx.globalAlpha=0.25;
        const ts=typeStyle[e.type]||typeStyle["일반"];

        // 돌진 중 빠른 잔상
        if(e.isDashing){
          ctx.globalAlpha=0.3;ctx.fillStyle=ts.clrL;
          ctx.beginPath();ctx.arc(ex+CS/2-8,ey+CS/2,rad*0.7,0,Math.PI*2);ctx.fill();
          ctx.globalAlpha=e.type==="은신"?0.4:1;
        }

        const bg3=ctx.createRadialGradient(ex+CS/2-2,ey+CS/2-2,0,ex+CS/2,ey+CS/2,rad);
        bg3.addColorStop(0,ts.clrL);bg3.addColorStop(1,ts.clr);
        ctx.fillStyle=bg3;
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad,0,Math.PI*2);ctx.fill();

        // 방패형: 앞쪽에 방패 표시
        if(e.type==="방패"){
          ctx.strokeStyle="#38bdf8";ctx.lineWidth=2.5;
          ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+2,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
        }
        // 재생형: 회전 오라
        if(e.type==="재생"){
          const t2=Date.now()/1000;
          ctx.strokeStyle="#2dd4bf";ctx.lineWidth=1.5;ctx.globalAlpha=0.5;
          ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+3,t2*2,t2*2+Math.PI*1.2);ctx.stroke();
          ctx.globalAlpha=e.type==="은신"?0.4:1;
        }
        // 힐러형: 초록 십자
        if(e.type==="힐러"){
          ctx.strokeStyle="#4ade80";ctx.lineWidth=2;ctx.globalAlpha=0.7;
          const cx2=ex+CS/2,cy2=ey+CS/2;
          ctx.beginPath();ctx.moveTo(cx2,cy2-rad-4);ctx.lineTo(cx2,cy2+rad+4);ctx.stroke();
          ctx.beginPath();ctx.moveTo(cx2-rad-4,cy2);ctx.lineTo(cx2+rad+4,cy2);ctx.stroke();
          ctx.globalAlpha=1;
        }

        ctx.strokeStyle=ts.clrL;ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad,0,Math.PI*2);ctx.stroke();
        // 걷기 바운스
        const bounce=Math.sin((g.gameTime||0)*8+(e.id||0))*2;
        // 공중 유닛은 살짝 위로 띄움
        const airOffset=e.isAir?-6:0;
        ctx.font="14px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText(ts.emoji,ex+CS/2,ey+CS/2+1+bounce+airOffset);
        if(e.isAir){
          ctx.font="8px serif";ctx.fillStyle="#7dd3fc";
          ctx.fillText("〜",ex+CS/2,ey+CS/2+8+bounce);
        }
        ctx.textAlign="left";ctx.textBaseline="alphabetic";
      }

      // 체력바 - 개선
      const bw=e.isBoss?CS*1.2:e.isMid?CS*1.0:CS-8;
      const bx=ex+(CS-bw)/2,by=ey-10;
      const bh=e.isBoss?6:4;
      // 배경
      ctx.fillStyle="rgba(0,0,0,0.6)";ctx.beginPath();ctx.roundRect?ctx.roundRect(bx,by,bw,bh,bh/2):ctx.fillRect(bx,by,bw,bh);ctx.fill();
      // 체력
      const hpColor=hR>0.6?"#22c55e":hR>0.3?"#eab308":"#ef4444";
      ctx.fillStyle=hpColor;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(bx,by,bw*hR,bh,bh/2);ctx.fill();}
      else{ctx.fillRect(bx,by,bw*hR,bh);}
      // 테두리
      ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=0.5;ctx.strokeRect(bx,by,bw,bh);

      // 상태이상 시각화
      if(e.stunTimer>0){
        ctx.strokeStyle="#ffd700";ctx.lineWidth=2.5;ctx.globalAlpha=0.8;
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+3,0,Math.PI*2);ctx.stroke();
        ctx.font="10px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillStyle="#ffd700";ctx.fillText("★",ex+CS/2,ey+CS/2-rad-6);
        ctx.textAlign="left";ctx.textBaseline="alphabetic";
      } else if(e.rootTimer>0){
        ctx.strokeStyle="#22c55e";ctx.lineWidth=2;ctx.globalAlpha=0.8;
        ctx.setLineDash([3,3]);
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+3,0,Math.PI*2);ctx.stroke();
        ctx.setLineDash([]);
      } else if(e.slowTimer>0){
        ctx.fillStyle="rgba(147,210,255,0.25)";
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+2,0,Math.PI*2);ctx.fill();
      }
      if(e.dotTimer>0&&e.dotDmg>0){
        ctx.globalAlpha=0.5+Math.sin(Date.now()/200)*0.3;
        ctx.fillStyle="rgba(139,195,74,0.4)";
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+4,0,Math.PI*2);ctx.fill();
      }
      if(e.debuff){
        ctx.strokeStyle="#ef4444";ctx.lineWidth=1.5;ctx.globalAlpha=0.6;
        ctx.beginPath();ctx.arc(ex+CS/2,ey+CS/2,rad+5,0,Math.PI*2);ctx.stroke();
      }

      ctx.restore();
    }

    // 투사체
    if(g)for(const p of g.projs){
      const c=p.color||"#ff0";
      const eb=p.elBase||"무속성";
      const fx=GRADE_FX[p.grade]||GRADE_FX.노말;
      ctx.save();
      if(fx.glow>0){ctx.shadowColor=c;ctx.shadowBlur=fx.glow;}
      switch(eb){
        case "불": ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,4+Math.sin(p.age*20)*1,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ff0";ctx.globalAlpha=0.6;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();break;
        case "물": ctx.fillStyle=c;ctx.globalAlpha=0.85;ctx.beginPath();ctx.ellipse(p.x,p.y,4,5,Math.atan2(p.ty-p.sy,p.tx-p.sx),0,Math.PI*2);ctx.fill();break;
        case "땅": ctx.fillStyle=c;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*6);ctx.fillRect(-4,-4,8,8);ctx.restore();break;
        case "바람": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*10);ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*1.3);ctx.stroke();ctx.restore();break;
        case "전기": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-5,p.y-5);ctx.lineTo(p.x+2,p.y);ctx.lineTo(p.x-3,p.y+2);ctx.lineTo(p.x+5,p.y+5);ctx.stroke();ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();break;
        case "얼음": ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*3);for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*Math.PI/3);ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();ctx.restore();}ctx.restore();break;
        case "빛": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.globalAlpha=0.8;ctx.beginPath();ctx.moveTo(p.sx,p.sy);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.fillStyle="#fff";ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();break;
        case "어둠": ctx.fillStyle="#222";ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(p.x,p.y,5.5,0,Math.PI*2);ctx.stroke();break;
        case "소리": ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.globalAlpha=0.7;for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(p.x,p.y,3+i*3+Math.sin(p.age*15)*1,0,Math.PI*2);ctx.stroke();}break;
        case "독": ctx.fillStyle=c;ctx.globalAlpha=0.9;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=0.5;for(let i=0;i<3;i++){const ang=p.age*5+i*(Math.PI*2/3);ctx.fillStyle="#0f0";ctx.beginPath();ctx.arc(p.x+Math.cos(ang)*5,p.y+Math.sin(ang)*5,1.5,0,Math.PI*2);ctx.fill();}break;
        case "나무": ctx.fillStyle=c;ctx.globalAlpha=0.9;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*4);ctx.beginPath();ctx.ellipse(0,-4,2.5,5,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(4,2,2.5,5,Math.PI/3*2,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(-4,2,2.5,5,-Math.PI/3*2,0,Math.PI*2);ctx.fill();ctx.restore();break;
        case "시간": // 시계 바늘 회전
          ctx.strokeStyle=c;ctx.lineWidth=2;
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*8);
          ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-3);ctx.stroke();
          ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(2,0);ctx.stroke();
          ctx.restore();break;
        case "홍수": // 물결
          ctx.fillStyle=c;ctx.globalAlpha=0.8;
          ctx.beginPath();ctx.ellipse(p.x,p.y,6,3,p.age*3,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.globalAlpha=0.4;
          ctx.beginPath();ctx.ellipse(p.x,p.y,6,3,p.age*3,0,Math.PI*2);ctx.stroke();
          break;
        case "운석": // 불타는 바위
          ctx.fillStyle=c;
          ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.age*5);
          ctx.beginPath();
          for(let i=0;i<5;i++){const a=i*(Math.PI*2/5),r2=i%2===0?5:3;ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);}
          ctx.closePath();ctx.fill();
          ctx.restore();
          ctx.fillStyle="#ff0";ctx.globalAlpha=0.5;
          ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);ctx.fill();
          break;
        default: ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill();
      }
      if(fx.trail>0){const mdx=p.tx-p.sx,mdy=p.ty-p.sy,mlen=Math.sqrt(mdx*mdx+mdy*mdy)||1;const ux2=mdx/mlen,uy2=mdy/mlen;ctx.globalAlpha=0.25;ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,fx.trail/3);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-ux2*fx.trail*2,p.y-uy2*fx.trail*2);ctx.stroke();}
      if(p.grade==="불멸"){ctx.globalAlpha=0.5;for(let i=0;i<3;i++){const ang=p.age*8+i*(Math.PI*2/3);ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x+Math.cos(ang)*6,p.y+Math.sin(ang)*6,1.5,0,Math.PI*2);ctx.fill();}}
      ctx.restore();
    }

    // 죽음 파티클 렌더링
    if(g&&g.particles)for(const p of g.particles){
      const prog=1-(p.life/p.maxLife);
      ctx.save();ctx.globalAlpha=(p.life/p.maxLife)*0.9;
      ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1-prog*0.5),0,Math.PI*2);ctx.fill();
      ctx.restore();
    }

    // 임팩트
    if(g&&g.impacts)for(const im of g.impacts){
      const prog=im.t/im.maxT;
      const c=im.color||"#ff0";
      const eb=im.elBase||"무속성";
      const big=im.grade==="전설"||im.grade==="신화"||im.grade==="불멸";
      const baseR=big?6:4,growR=big?20:14;
      ctx.save();ctx.globalAlpha=1-prog;
      switch(eb){
        case "불": ctx.fillStyle=c;for(let i=0;i<5;i++){const ang=i*(Math.PI*2/5);ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.7,im.y+Math.sin(ang)*prog*growR*0.7,2,0,Math.PI*2);ctx.fill();}ctx.strokeStyle="#ff0";ctx.lineWidth=2;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*0.6,0,Math.PI*2);ctx.stroke();break;
        case "물": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR,0,Math.PI*2);ctx.stroke();break;
        case "땅": ctx.fillStyle=c;for(let i=0;i<4;i++){const ang=i*(Math.PI/2)+prog*2;ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.6,im.y+Math.sin(ang)*prog*growR*0.6-prog*5,2,0,Math.PI*2);ctx.fill();}break;
        case "바람": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.save();ctx.translate(im.x,im.y);ctx.rotate(prog*8);ctx.beginPath();ctx.arc(0,0,baseR+prog*growR,0,Math.PI*1.5);ctx.stroke();ctx.restore();break;
        case "전기": ctx.strokeStyle=c;ctx.lineWidth=2;for(let i=0;i<4;i++){const ang=i*(Math.PI/2)+Math.random();ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*(baseR+prog*growR),im.y+Math.sin(ang)*(baseR+prog*growR));ctx.stroke();}break;
        case "얼음": ctx.strokeStyle=c;ctx.lineWidth=1.5;for(let i=0;i<6;i++){const ang=i*(Math.PI/3);ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*(baseR+prog*growR*0.8),im.y+Math.sin(ang)*(baseR+prog*growR*0.8));ctx.stroke();}break;
        case "빛": ctx.fillStyle="#fff";ctx.globalAlpha=(1-prog)*0.8;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*0.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=2;ctx.globalAlpha=1-prog;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR,0,Math.PI*2);ctx.stroke();break;
        case "어둠": ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(im.x,im.y,baseR+(1-prog)*growR*0.5,0,Math.PI*2);ctx.stroke();break;
        case "소리": ctx.strokeStyle=c;ctx.lineWidth=1.5;for(let i=0;i<2;i++)ctx.beginPath(),ctx.arc(im.x,im.y,baseR+prog*growR*(0.6+i*0.4),0,Math.PI*2),ctx.stroke();break;
        case "독": ctx.fillStyle=c;for(let i=0;i<6;i++){const ang=i*(Math.PI/3)+prog*2;ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.7,im.y+Math.sin(ang)*prog*growR*0.7,2.5,0,Math.PI*2);ctx.fill();}break;
        case "나무": ctx.strokeStyle=c;ctx.lineWidth=2;for(let i=0;i<5;i++){const ang=i*(Math.PI*2/5)-Math.PI/2;ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*(baseR+prog*growR),im.y+Math.sin(ang)*(baseR+prog*growR));ctx.stroke();}break;
        default: ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR,0,Math.PI*2);ctx.stroke();
      }
      if(im.grade==="신화"||im.grade==="불멸"){ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.globalAlpha=(1-prog)*0.6;ctx.beginPath();ctx.arc(im.x,im.y,(baseR+prog*growR)*1.3,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  },[selHero]);

  const gameLoop=useCallback((t)=>{
    const raw=Math.min((t-lt.current)/1000,0.1);
    const dt=raw*spR.current;lt.current=t;
    const g=G.current;
    if(!g||g.over||!g.running){draw();return;}
    const isMidRound=g.round%5===0&&g.round%10!==0,isBossRound=g.round%10===0;
    const wt=g.waveType||'normal';
    const waveOpts={
      horde:wt==='horde',fast:wt==='fast',
      armor:wt==='armored',healer:wt==='healer',
    };
    // 무리 웨이브는 빠르게 스폰
    const spawnInterval=wt==='horde'?0.55:1.2;
    g.spawnT+=dt;

    // ── 회전 모드 스폰
    if(g.rotMode){
      if(g.spawnT>spawnInterval&&g.spawnC<g.maxSpawn){
        g.spawnT=0;g.spawnC++;
        if(isBossRound&&!g.bossSpawned){
          const bossInfo=makeBoss(g.round);g.currentBoss=bossInfo;
          const boss=mkE('일반',g.round,true,false,'ROT',{});
          boss.isRageReady=true;boss.bossInfo=bossInfo;
          g.enemies.push(boss);g.bossSpawned=true;
        } else if(isMidRound&&!g.midSpawned){
          g.enemies.push(mkE('일반',g.round,false,true,'ROT',{}));g.midSpawned=true;
        } else if(!isBossRound&&!isMidRound){
          const rotPool=g.round<10
            ?['일반','일반','고속']
            :g.round<25
            ?['일반','고속','공중','투명']
            :['일반','고속','공중','투명','투명','공중'];
          const type=rotPool[Math.floor(Math.random()*rotPool.length)];
          g.enemies.push(mkE(type,g.round,false,false,'ROT',{}));
        }
      }
    } else if(g.spawnT>spawnInterval&&g.spawnC<g.maxSpawn){
      g.spawnT=0;g.spawnC++;
      if(isBossRound&&!g.bossSpawned){
        const bossInfo=makeBoss(g.round);
        g.currentBoss=bossInfo;
        const boss=mkE("일반",g.round,true,false,g.mapKey,{});
        boss.isRageReady=true;boss.bossInfo=bossInfo;
        g.enemies.push(boss);g.bossSpawned=true;
      } else if(isMidRound&&!g.midSpawned){
        g.enemies.push(mkE("일반",g.round,false,true,g.mapKey,{}));g.midSpawned=true;
      } else if(!isBossRound&&!isMidRound){
        let type="일반";
        if(wt==='horde'){
          // 무리: 일반/공중 위주
          type=["일반","일반","일반","공중"][Math.floor(Math.random()*4)];
        } else if(wt==='fast'){
          type=["일반","은신","공중","돌진"][Math.floor(Math.random()*4)];
        } else if(wt==='armored'){
          type=["일반","일반","방패"][Math.floor(Math.random()*3)];
        } else if(wt==='healer'){
          // 힐러 웨이브: 5마리 중 1마리 힐러
          type=g.spawnC%5===2?"힐러":["일반","재생"][Math.floor(Math.random()*2)];
        } else {
          // 일반 웨이브: 라운드 따라 다양화
          const pool=g.round<15
            ?["일반","일반","은신"]
            :g.round<30
            ?["일반","은신","공중","분열"]
            :["일반","은신","공중","분열","재생","돌진"];
          type=pool[Math.floor(Math.random()*pool.length)];
        }
        g.enemies.push(mkE(type,g.round,false,false,g.mapKey,waveOpts));
      }
    } // end normal spawn

    // 적 이동 + 특수 행동
    const newEnemies=[];
    for(const e of g.enemies){
      if(e.remove)continue;

      // 슬로우 타이머
      if(e.slowTimer>0){
        e.slowTimer-=dt;
        if(e.slowTimer<=0){e.slowTimer=0;if(e.baseSpeed&&!e.stunTimer&&!e.rootTimer){e.speed=e.baseSpeed;e.baseSpeed=null;}}
      }
      // 스턴 타이머
      if(e.stunTimer>0){
        e.stunTimer-=dt;
        if(e.stunTimer<=0){e.stunTimer=0;if(e.baseSpeed){e.speed=e.baseSpeed;e.baseSpeed=null;}}
      }
      // 속박 타이머
      if(e.rootTimer>0){
        e.rootTimer-=dt;
        if(e.rootTimer<=0){e.rootTimer=0;e.rootImmune=3;if(e.baseSpeed){e.speed=e.baseSpeed;e.baseSpeed=null;}}
      }
      // 속박 면역 타이머
      if(e.rootImmune>0){e.rootImmune-=dt;if(e.rootImmune<=0)e.rootImmune=0;}
      // 방어감소 타이머
      if(e.debuffTimer>0){
        e.debuffTimer-=dt;
        if(e.debuffTimer<=0){e.debuffTimer=0;e.debuff=false;e.debuffMul=1;}
      }
      // 독 지속데미지
      if(e.dotTimer>0&&e.dotDmg>0){
        e.dotTimer-=dt;
        e._dotTick=(e._dotTick||0)+dt;
        if(e._dotTick>=1){
          e._dotTick=0;
          e.hp-=e.dotDmg;
          if(e.hp<=0&&!e.rewarded){e.rewarded=true;if(e.isBoss)g.currentBoss=null;}
        }
        if(e.dotTimer<=0){e.dotTimer=0;e.dotDmg=0;e._dotTick=0;e.dotStacks=0;}
      }

      // 재생형: 매 3초마다 최대HP의 3% 회복
      if(e.type==="재생"&&!e.remove){
        e.regenTimer=(e.regenTimer||0)+dt;
        if(e.regenTimer>=3){e.regenTimer=0;e.hp=Math.min(e.maxHp,e.hp+Math.floor(e.maxHp*0.03));}
      }

      // 힐러형: 주변 적 HP 회복
      if(e.type==="힐러"&&!e.remove){
        e.healTimer=(e.healTimer||0)+dt;
        if(e.healTimer>=2){
          e.healTimer=0;
          for(const other of g.enemies){
            if(other.id===e.id||other.remove)continue;
            const d=Math.sqrt((other.x-e.x)**2+(other.y-e.y)**2);
            if(d<CS*2.5)other.hp=Math.min(other.maxHp,other.hp+Math.floor(other.maxHp*0.05));
          }
        }
      }

      // 돌진형: 주기적으로 순간 가속
      if(e.type==="돌진"&&!e.remove){
        e.dashTimer=(e.dashTimer||0)-dt;
        if(e.dashTimer<=0){
          e.isDashing=true;
          e.dashTimer=4+Math.random()*2;
          setTimeout(()=>{if(e)e.isDashing=false;},600);
        }
      }

      // 보스 광폭화: HP 40% 이하
      if(e.isBoss&&e.isRageReady&&!e.isRaging&&e.hp/e.maxHp<0.4){
        e.isRaging=true;
        e.speed=e.baseSpd*1.7;
        e.dmg=e.dmg*2;
      }

      const path=e.path;
      if(!path||e.pathIdx>=path.length){
        e.remove=true;g.life=Math.max(0,g.life-e.dmg);if(g.life<=0)g.over=true;sync();continue;
      }
      const[tc,tr]=path[e.pathIdx];
      const tx=tc*CS,ty=tr*CS,dx=tx-e.x,dy=ty-e.y;
      const spd=e.isDashing?e.speed*2.5:e.speed;
      const dist=Math.sqrt(dx*dx+dy*dy),mv=CS*spd*dt*1.5;
      if(dist<mv){
        e.x=tx;e.y=ty;e.pathIdx++;
        if(e.pathIdx>=path.length){e.remove=true;g.life=Math.max(0,g.life-e.dmg);if(g.life<=0)g.over=true;sync();}
      }else{e.x+=dx/dist*mv;e.y+=dy/dist*mv;}
    }

    // 분열형 처리: 죽으면 2마리 생성
    for(const e of g.enemies){
      if(e.type==="분열"&&e.hp<=0&&!e.rewarded&&!e.splitDone){
        e.splitDone=true;
        for(let i=0;i<2;i++){
          const child=mkE("일반",g.round,false,false,g.mapKey,{});
          child.hp=Math.floor(child.maxHp*0.4);
          child.maxHp=child.hp;
          child.pathIdx=Math.max(0,e.pathIdx-1);
          child.x=e.x+(i===0?-8:8);child.y=e.y;
          newEnemies.push(child);
        }
      }
    }
    // 죽는 파티클 생성
    if(!g.particles)g.particles=[];
    for(const e of g.enemies){
      if((e.remove||e.hp<=0)&&!e.deathParticleDone){
        e.deathParticleDone=true;
        const cx=e.x+CS/2,cy=e.y+CS/2;
        const clr=e.isBoss?"#ef4444":e.isMid?"#fb923c":"#f87171";
        for(let i=0;i<6;i++){
          const a=Math.random()*Math.PI*2;
          const spd=30+Math.random()*50;
          g.particles.push({x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:0.5+Math.random()*0.3,maxLife:0.5+Math.random()*0.3,r:2+Math.random()*3,color:clr});
        }
      }
    }
    g.enemies=[...g.enemies.filter(e=>!e.remove&&e.hp>0),...newEnemies];
    g.total=g.enemies.length;
    if(g.total>=30){g.over=true;g.running=false;sync();draw();return;}
    g.gameTime=(g.gameTime||0)+dt;
    const buff=getBuff();
    // 황금정령: 적 처치 시 골드 지급
    const goldUnits=g.heroes.filter(h=>h.col!==null&&h.element==="황금정령");
    // 황금정령은 1개 한정 (여러 개 있어도 가장 높은 강화레벨 1개만 적용)
    const bestGold=goldUnits.length>0?goldUnits.reduce((best,h)=>h.enhLv>best.enhLv?h:best,goldUnits[0]):null;
    const goldPerKill=bestGold?1+(bestGold.enhLv||0):0;

    const allH=g.heroes.filter(h=>h.col!==null);
    for(const h of allH){
      const hx=h.col*CS+CS/2,hy=h.row*CS+CS/2;
      const baseSpd=(h.spd||1);
      if(g.gameTime-(h.lastShot||0)<1/baseSpd)continue;
      const rng=((h.range||3.5)+(buff.rangeBonus||0))*CS;
      if(h.isIce&&h.iceCfg){
        const cfg=h.iceCfg;
        if(g.gameTime-h.lastShot>=cfg.cd){
          h.lastShot=g.gameTime;
          for(const e of g.enemies){
            if(e.remove)continue;
            const d=Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2);
            if(d<=cfg.range*CS){if(!e.baseSpeed)e.baseSpeed=e.speed;e.slowTimer=cfg.dur*(buff.statusMul||1);e.speed=e.baseSpeed*Math.max(0.05,cfg.slow-(buff.slowBonus||0)*cfg.slow);g.projs.push({x:hx,y:hy,tx:e.x+CS/2,ty:e.y+CS/2,tid:e.id,dmg:0,spd:400,color:"#aef",size:3,age:0,sx:hx,sy:hy});}
          }
        }
        continue;
      }
      // 속성별 공격 가능 대상 (회전 모드)
      const elB=elBase(h._isMorph&&h._morphEl?h._morphEl:h.element);
      const canHitAir=g.rotMode?['전기','바람','소리','불','운석','얼음','시간','홍수','빛','독'].includes(elB):true;
      const canHitInvis=g.rotMode?['불','운석','얼음','시간','홍수','빛','독'].includes(elB):true;

      let near=null,nd=Infinity;
      for(const e of g.enemies){
        if(e.remove)continue;
        if(g.rotMode){
          if(e.isAir&&!canHitAir)continue;
          if(e.isInvis&&!canHitInvis)continue;
        }
        const d=Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2);
        if(d<rng&&d<nd){near=e;nd=d;}
      }
      if(near){
        h.lastShot=g.gameTime;
        const diffMul=g.diffMul||1.0;
        const baseAtk=((h.atk||10)+(h.enhLv||0)*5)*diffMul;
        const dmg=Math.floor(baseAtk);
        // 보스 약점 배율
        const bossData=g.currentBoss;
        let finalDmg=dmg;
        if(near.isBoss&&bossData&&bossData.weak){
          finalDmg=isBossWeak(h.element,bossData.weak)?dmg*2:Math.max(1,Math.floor(dmg*0.1));
        }
        const projEl=h._isMorph&&h._morphEl?h._morphEl:h.element;
        g.projs.push({x:hx,y:hy,tx:near.x+CS/2,ty:near.y+CS/2,tid:near.id,dmg:finalDmg,spd:300,color:EC[projEl]||"#ff0",elBase:elBase(projEl),grade:h.grade,sx:hx,sy:hy,age:0});
        h.shootAnim=0.15; // 공격 모션 타이머
        // 연쇄공격 (번개신 히든영웅)
        if(buff.chain&&Math.random()<buff.chain){
          const chain2=g.enemies.filter(e=>e.id!==near.id&&!e.remove&&e.hp>0&&Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2)<rng);
          if(chain2.length>0){
            const ct=chain2[Math.floor(Math.random()*chain2.length)];
            g.projs.push({x:near.x+CS/2,y:near.y+CS/2,tx:ct.x+CS/2,ty:ct.y+CS/2,tid:ct.id,dmg:Math.floor(finalDmg*0.6),spd:400,color:"#ffd700",elBase:"전기",grade:h.grade,sx:hx,sy:hy,age:0});
          }
        }
      }
    }
    const applyDmg=(enemy,dmg,killGold,g2)=>{
      if(!enemy||enemy.remove||enemy.hp<=0)return;
      const debuffMul=enemy.debuff?enemy.debuffMul||1:1;
      const reduced=Math.max(1,Math.floor(dmg*(1-(enemy.armor||0))*debuffMul));
      enemy.hp-=reduced;
      if(enemy.hp<=0&&!enemy.rewarded){
        enemy.rewarded=true;
        if(enemy.isBoss)g2.currentBoss=null;
        const kg=(enemy.reward||0)+killGold;
        if(kg>0){g2.gold+=kg;setUi(prev=>({...prev,gold:g2.gold}));}
      }
    };

    for(const p of g.projs){
      p.age=(p.age||0)+dt;
      const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.sqrt(dx*dx+dy*dy),mv=p.spd*dt;
      if(dist<mv){
        p.hit=true;
        if(!g.impacts)g.impacts=[];
        g.impacts.push({x:p.tx,y:p.ty,t:0,maxT:0.3,color:p.color,elBase:p.elBase,grade:p.grade});
        const t2=g.enemies.find(e=>e.id===p.tid&&!e.remove&&e.hp>0);
        const trait=getElTrait(p.elBase||"무속성");

        if(trait.type==="splash"||trait.type==="heal"){
          // 범위공격 - 중심점 주변 스플래시
          const sr=(trait.splashR||1.5)*CS;
          for(const e of g.enemies){
            if(e.remove)continue;
            const sd=Math.sqrt((e.x+CS/2-p.tx)**2+(e.y+CS/2-p.ty)**2);
            if(sd<=sr){
              const splashDmg=e.id===p.tid?p.dmg:Math.floor(p.dmg*(trait.dmgMul||0.5));
              if(splashDmg>0)applyDmg(e,splashDmg,goldPerKill,g);
              g.impacts.push({x:e.x+CS/2,y:e.y+CS/2,t:0,maxT:0.2,color:p.color,elBase:p.elBase,grade:p.grade});
            }
          }

        } else if(trait.type==="chain"){
          // 체인 - 튕기기
          if(t2&&p.dmg>0)applyDmg(t2,p.dmg,goldPerKill,g);
          let chainSrc=t2;let chainDmg=Math.floor(p.dmg*(trait.chainMul||0.6));
          const hit=new Set([p.tid]);
          for(let ci=0;ci<(trait.chainCnt||3)&&chainSrc&&chainDmg>0;ci++){
            const nxt=g.enemies.filter(e=>!e.remove&&e.hp>0&&!hit.has(e.id))
              .sort((a,b)=>Math.sqrt((a.x-chainSrc.x)**2+(a.y-chainSrc.y)**2)-Math.sqrt((b.x-chainSrc.x)**2+(b.y-chainSrc.y)**2))[0];
            if(!nxt)break;
            hit.add(nxt.id);
            applyDmg(nxt,chainDmg,goldPerKill,g);
            g.projs.push({x:chainSrc.x+CS/2,y:chainSrc.y+CS/2,tx:nxt.x+CS/2,ty:nxt.y+CS/2,tid:nxt.id,dmg:0,spd:500,color:"#ffd700",elBase:"전기",grade:p.grade,sx:chainSrc.x+CS/2,sy:chainSrc.y+CS/2,age:0,isChainVfx:true});
            chainSrc=nxt;chainDmg=Math.floor(chainDmg*(trait.chainMul||0.6));
          }

        } else if(trait.type==="pierce"){
          // 관통 - 발사 방향 직선상 적 전체
          const px=p.sx,py=p.sy,ex2=p.tx,ey2=p.ty;
          const pdx=ex2-px,pdy=ey2-py,plen=Math.sqrt(pdx*pdx+pdy*pdy)||1;
          const pux=pdx/plen,puy=pdy/plen;
          for(const e of g.enemies){
            if(e.remove)continue;
            const epx=e.x+CS/2-px,epy=e.y+CS/2-py;
            const dot=epx*pux+epy*puy;
            if(dot<0)continue;
            const perpX=epx-dot*pux,perpY=epy-dot*puy;
            const perp=Math.sqrt(perpX*perpX+perpY*perpY);
            if(perp<=CS*0.6){
              applyDmg(e,p.dmg,goldPerKill,g);
              g.impacts.push({x:e.x+CS/2,y:e.y+CS/2,t:0,maxT:0.2,color:p.color,elBase:p.elBase,grade:p.grade});
            }
          }

        } else if(trait.type==="dot"){
          // 독 지속데미지
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            const maxDotStacks=3;
            t2.dotStacks=(t2.dotStacks||0)+1;
            if(t2.dotStacks<=maxDotStacks){
              t2.dotDmg=(t2.dotDmg||0)+Math.floor(p.dmg*(trait.dotMul||0.3)*(buff.statusMul||1));
            }
            t2.dotTimer=Math.max(t2.dotTimer||0,(trait.dotDur||3)*(buff.statusMul||1));
          }

        } else if(trait.type==="root"){
          // 속박 - 면역 중이면 적용 안 함, 속박 중 재갱신 안 함
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            if(!t2.rootImmune&&!t2.rootTimer){
              if(!t2.baseSpeed)t2.baseSpeed=t2.speed;
              t2.speed=0;t2.rootTimer=(trait.rootDur||1.5)*(buff.statusMul||1);
            }
          }

        } else if(trait.type==="stun"){
          // 스턴 - 완전 정지 + 데미지 없음
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            if(!t2.baseSpeed)t2.baseSpeed=t2.speed;
            t2.speed=0;t2.stunTimer=(trait.stunDur||0.8)*(buff.statusMul||1);
          }

        } else if(trait.type==="debuff"){
          // 방어감소 디버프
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            t2.debuff=true;t2.debuffMul=(trait.debuffMul||1.3);t2.debuffTimer=(trait.debuffDur||5)*(buff.statusMul||1);
          }

        } else {
          // 단일공격 (기본)
          if(t2&&p.dmg>0)applyDmg(t2,p.dmg,goldPerKill,g);
        }
      }else{p.x+=dx/dist*mv;p.y+=dy/dist*mv;}
    }
    g.projs=g.projs.filter(p=>!p.hit&&!p.isChainVfx);
    if(g.impacts){for(const im of g.impacts)im.t+=dt;g.impacts=g.impacts.filter(im=>im.t<im.maxT);}
    if(g.particles){for(const p of g.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=dt;}g.particles=g.particles.filter(p=>p.life>0);}
    for(const h of g.heroes){if(h.shootAnim>0)h.shootAnim-=dt;}

    const spawnDone=(isBossRound&&g.bossSpawned)||(isMidRound&&g.midSpawned)||(!isBossRound&&!isMidRound&&g.spawnC>=g.maxSpawn);
    // 회전 모드: 적 다 잡아도 타이머 끝날 때까지 대기
    const canClear=spawnDone&&g.enemies.length===0&&!g.cleared&&(!g.rotMode||countdownValRef.current===0);
    if(canClear){
      g.running=false;g.cleared=true;
      if(isMidRound||isBossRound)g.coins+=1;
      const goldMul=1+(getBuff().goldMul||0);
      const clearGold=Math.floor((isBossRound?80:isMidRound?50:20)*goldMul);
      g.gold+=clearGold;
      if(g.round%20===0){const nu=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){nu.col=pos[0];nu.row=pos[1];}g.heroes.push(nu);}
      // 도박사 히든영웅: 5라운드마다 주사위
      if(getBuff().gambler&&g.round%5===0){
        const dice=Math.ceil(Math.random()*6);
        let diceMsg="";
        if(dice===1){
          const normals=g.heroes.filter(h=>h.col!==null&&h.grade==="노말");
          if(normals.length>0){const t=normals[Math.floor(Math.random()*normals.length)];t.col=null;t.row=null;diceMsg="🎲1 - 노말 유닛 1개 랜덤 삭제!";}
          else diceMsg="🎲1 - 삭제할 노말 유닛 없음";
        }else if(dice===2){
          const pool=g.unlockedEls||BASE;
          const el=pool[Math.floor(Math.random()*pool.length)];
          const h=mkH(el,"노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
          if(pos){h.col=pos[0];h.row=pos[1];g.heroes.push(h);diceMsg=`🎲2 - 노말 ${EN[el]||el} 생성!`;}
          else diceMsg="🎲2 - 빈 칸 없음";
        }else if(dice===3){
          g.gold+=50;diceMsg="🎲3 - 골드 +50!";
        }else if(dice===4){
          const pool=g.unlockedEls||BASE;
          const el=pool[Math.floor(Math.random()*pool.length)];
          const h=mkH(el,"고급",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
          if(pos){h.col=pos[0];h.row=pos[1];g.heroes.push(h);diceMsg=`🎲4 - 고급 ${EN[el]||el} 생성!`;}
          else diceMsg="🎲4 - 빈 칸 없음";
        }else if(dice===5){
          g.coins=(g.coins||0)+3;diceMsg="🎲5 - 코인 +3!";
        }else{
          const h=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
          if(pos){h.col=pos[0];h.row=pos[1];g.heroes.push(h);diceMsg="🎲6 - 무속성 유닛 생성!";}
          else diceMsg="🎲6 - 빈 칸 없음";
        }
        sync();draw();alert(`🎰 도박사 주사위!\n${diceMsg}`);
      }
      if(g.round===100&&!g.infiniteMode){
        // 무한모드 여부 물어보기 (victory 대신 특별 처리)
        g.victory=true;g.running=false;sync();draw();return;
      }
      if(g.round>100){
        // 무한모드: 난이도 점점 올라감
        g.diffMul=Math.min((g.diffMul||1.3)*0.95,0.5); // 점점 어려워짐(배율 감소=유닛 약해짐)
      }
      g.round++;g.cleared=false;g.total=0;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
      // 변신정령: 라운드마다 속성 랜덤 변경
      const morphElements=[...BASE];
      for(const h of g.heroes){
        if(h.element==="변신정령"||h._isMorph){
          h._isMorph=true;
          const newEl=morphElements[Math.floor(Math.random()*morphElements.length)];
          h._morphEl=newEl; // 시각적 속성 (실제 공격속성)
        }
      }
      const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
      // 웨이브 타입 결정
      const newWt=getWaveType(g.round);
      g.waveType=newWt;
      const waveLabels={normal:'',horde:'🐝 무리 웨이브!',fast:'⚡ 속도 웨이브!',armored:'🛡️ 장갑 웨이브!',healer:'💚 힐러 웨이브!',boss:'💀 보스!',mid:'⚡ 중간보스!'};
      g.waveLabel=waveLabels[newWt]||'';
      // 무리 웨이브는 적 많이
      g.maxSpawn=nb?1:nm?1:newWt==='horde'?Math.floor((15+g.round)*1.8):g.rotMode?20:15+g.round;
      sync();setCountdown(30);countdownValRef.current=30;let cd=30;
      if(countdownRef.current)clearInterval(countdownRef.current);
      const iv=setInterval(()=>{cd--;setCountdown(cd);countdownValRef.current=cd;if(cd<=0){clearInterval(iv);countdownRef.current=null;if(!G.current.over){G.current.running=true;lt.current=performance.now();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));}}},1000);
      countdownRef.current=iv;
      return;
    }
    draw();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));
  },[draw,sync,getBuff,setUi]);

  useEffect(()=>{gameLoopRef.current=gameLoop;},[gameLoop]);
  useEffect(()=>{if(phase==='game')draw();},[draw,phase]);
  useEffect(()=>{if(phase==='game')draw();},[selHero,drag]);

  // 카운트다운 스킵
  const skipCountdown=()=>{
    if(countdownRef.current){clearInterval(countdownRef.current);countdownRef.current=null;}
    setCountdown(0);countdownValRef.current=0;
    if(!G.current.over) autoStart(G.current);
  };

  const autoStart=(g)=>{
    const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
    g.maxSpawn=nb?1:nm?1:g.rotMode?20:15+g.round;
    g.running=true;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
    sync();lt.current=performance.now();raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
  };

  // 게임 시작: 맵 결정 → 히든영웅 화면
  const startGame=(mapOverride)=>{
    if(raf.current)cancelAnimationFrame(raf.current);
    hid=1;eid=1;
    setRotMode(false);
    const keys=['B','C','D','E','F'];
    let mk;
    if(mapOverride) mk=mapOverride;
    else if(mapMode==='pick') mk=selectedMap;
    else mk=keys[Math.floor(Math.random()*keys.length)];
    buildMap(mk);
    setCurrentMapName(MAP_DEFS[mk].name);
    G.current=initGame(difficulty);
    G.current.mapKey=mk;
    G.current.clearCount=clearCount;
    G.current.unlockedEls=UNLOCK_ELEMENTS(clearCount);
    G.current.unlockedGrades=UNLOCK_GRADES(clearCount);
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    sync();
    setPhase('hidden');
  };

  const startRotation=()=>{
    if(raf.current)cancelAnimationFrame(raf.current);
    hid=1;eid=1;
    // 회전 모드: 외곽 네모 맵, TRACK을 외곽으로 설정
    CURRENT_MAP='ROT';
    SPAWN_TILE=[0,0];
    GOAL_TILE=[0,0]; // 2바퀴 돌면 제거
    FORK_PATHS=null;
    TRACK=buildRotPath(1); // 대표용 1바퀴 (렌더링용)
    TS=new Set(); // 회전 모드는 경로=외곽 전체, 배치 불가 타일은 외곽
    for(let c=0;c<COLS;c++){TS.add(`${c},0`);TS.add(`${c},${ROWS-1}`);}
    for(let r=0;r<ROWS;r++){TS.add(`0,${r}`);TS.add(`${COLS-1},${r}`);}
    CX=4;CY=6;
    setCurrentMapName('회전');
    const g=initGame('hard');
    g.mapKey='ROT';
    g.clearCount=clearCount;
    g.unlockedEls=UNLOCK_ELEMENTS(clearCount);
    g.unlockedGrades=UNLOCK_GRADES(clearCount);
    g.diffMul=0.8;
    g.rotMode=true;
    G.current=g;
    setRotMode(true);
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    sync();
    setPhase('hidden');
  };

  const pickHidden=(h)=>{
    const g=G.current;
    g.hiddenHero={...h,id:h.id};
    // 난이도 최종 반영
    g.difficulty=difficulty;
    g.diffMul=difficulty==='easy'?1.7:difficulty==='normal'?1.3:1.0;
    // 수호자: 시작 라이프 +10
    if(h.buff&&h.buff.extraLife){g.life+=h.buff.extraLife;}
    // 미배치 유닛 자동 배치
    for(const hero of g.heroes){
      if(hero.col===null){
        const pos=autoPlace(g.heroes);
        if(pos){hero.col=pos[0];hero.row=pos[1];}
      }
    }
    setSelH(h.id);
    setPhase('game');
    // 캔버스 렌더 후 카운트다운 → 게임 시작
    setTimeout(()=>{
      draw();
      setCountdown(30);countdownValRef.current=30;
      let cd=30;
      if(countdownRef.current)clearInterval(countdownRef.current);
      const iv=setInterval(()=>{
        cd--;setCountdown(cd);countdownValRef.current=cd;
        if(cd<=0){
          clearInterval(iv);countdownRef.current=null;
          if(!G.current.over) autoStart(G.current);
        }
      },1000);
      countdownRef.current=iv;
    },80);
  };

  const setDragBoth=(id)=>{dragR.current=id;setDrag(id);};

  const onCanvas=(e)=>{
    if(phase!=='game')return;
    const rect=cvs.current.getBoundingClientRect();
    const sx=(COLS*CS)/rect.width,sy=(ROWS*CS)/rect.height;
    const px=(e.clientX-rect.left)*sx;
    const py=(e.clientY-rect.top)*sy;
    const col=Math.floor(px/CS);
    const row=Math.floor(py/CS);
    if(col<0||col>=COLS||row<0||row>=ROWS)return;
    const g=G.current;
    // 적 클릭 감지 (픽셀 기반)
    const clickedEnemy=g.enemies.find(en=>{
      if(en.remove||en.hp<=0)return false;
      const ex=en.x+CS/2,ey=en.y+CS/2;
      return Math.abs(px-ex)<CS*0.7&&Math.abs(py-ey)<CS*0.7;
    });
    if(clickedEnemy){setSelEnemy({...clickedEnemy});setSelHero(null);setDragBoth(null);return;}
    setSelEnemy(null);
    const moveId=dragR.current||selHero;
    if(moveId){
      const clickedH=g.heroes.find(h=>h.col===col&&h.row===row);
      if(clickedH&&clickedH.id===moveId){setDragBoth(null);setSelHero(null);return;}
      if(TS.has(`${col},${row}`)||(col===CX&&row===CY)){setDragBoth(null);setSelHero(null);return;}
      const moving=g.heroes.find(h=>h.id===moveId);
      if(moving){
        if(clickedH&&clickedH.id!==moveId){const tmp={col:moving.col,row:moving.row};moving.col=col;moving.row=row;clickedH.col=tmp.col;clickedH.row=tmp.row;}
        else{moving.col=col;moving.row=row;}
      }
      setDragBoth(null);setSelHero(null);sync();draw();
    }else{
      const clicked=g.heroes.find(h=>h.col===col&&h.row===row);
      if(clicked){setSelHero(clicked.id===selHero?null:clicked.id);setDragBoth(null);}
      else setSelHero(null);
    }
  };

  const onHero=(hero)=>{
    if(dragR.current&&dragR.current!==hero.id){
      const g=G.current,a=g.heroes.find(h=>h.id===dragR.current),b=hero;
      if(a&&b.col!==null){const tmp={col:a.col,row:a.row};a.col=b.col;a.row=b.row;b.col=tmp.col;b.row=tmp.row;sync();draw();}
      setDragBoth(null);return;
    }
    if(dragR.current===hero.id){setDragBoth(null);return;}
    setSelHero(hero.id===selHero?null:hero.id);setDragBoth(null);
  };

  const getCombOptions=(heroId)=>{
    const g=G.current,h=g.heroes.find(x=>x.id===heroId);
    if(!h)return[];
    const myEls=g.heroes.filter(x=>x.id!==heroId).map(x=>x.element);
    const myCnt={};
    for(const hero of g.heroes) myCnt[hero.element]=(myCnt[hero.element]||0)+1;
    // 같은 속성 조합 체크용 (선택한 유닛 제외한 카운트)
    const myElsCntEx={};
    for(const hero of g.heroes){if(hero.id!==heroId)myElsCntEx[hero.element]=(myElsCntEx[hero.element]||0)+1;}

    // 고급/영웅: COMBO 방식
    const comboOpts=COMBO.filter(r=>{
      const isSame=r.a===r.b;
      // 동속성: 내가 그 속성이고 + 나머지에 1개 더 있어야
      // 이속성: 내가 a면 나머지에 b, 내가 b면 나머지에 a
      const match=isSame
        ?(h.element===r.a&&(myElsCntEx[r.a]||0)>=1)
        :((r.a===h.element&&myEls.includes(r.b))||(r.b===h.element&&myEls.includes(r.a)));
      if(match){
        if(r.g==="신화"&&g.round<20)return false;
        if(r.g==="불멸"&&g.round<50)return false;
        return true;
      }
      return false;
    }).map(r=>({...r,isRecipe:false}));

    // 전설/신화/불멸: RECIPES 방식 - 선택 유닛이 재료 중 하나라도 포함되면 표시
    const recipeOpts=RECIPES.filter(recipe=>{
      // 선택 유닛이 재료에 포함되는지
      const usesMe=recipe.parts.some(p=>p.u===h.element);
      if(!usesMe)return false;
      // 전체 재료 충족 여부
      return recipe.parts.every(p=>(myCnt[p.u]||0)>=p.n);
    }).map(recipe=>({r:recipe.r,g:recipe.g,isRecipe:true,recipe}));

    return [...comboOpts,...recipeOpts];
  };

  const doCombine=(heroId,opt)=>{
    const g=G.current;
    if(opt.isRecipe){
      // RECIPES 방식
      doRecipe(opt.recipe);
      setSelHero(null);
      return;
    }
    // COMBO 방식
    const h1=g.heroes.find(x=>x.id===heroId);
    const needEl=opt.a===h1.element?opt.b:opt.a;
    const h2=g.heroes.find(x=>x.id!==heroId&&x.element===needEl);
    if(!h1||!h2)return;
    const pos={col:h1.col,row:h1.row};
    const nh=mkH(opt.r,opt.g,g.gradeEnhLv||{});
    nh.col=pos.col;nh.row=pos.row;
    g.heroes=g.heroes.filter(x=>x.id!==h1.id&&x.id!==h2.id);
    g.heroes.push(nh);
    setSelHero(null);sync();draw();triggerSummon(opt.r,opt.g);
  };

  const GRADE_ENH_COST={노말:10,고급:15,영웅:25,전설:30,신화:40,불멸:50};
  const GRADE_ENH_BONUS={노말:{atk:2,spd:0.05},고급:{atk:4,spd:0.05},영웅:{atk:8,spd:0.05},전설:{atk:14,spd:0.05},신화:{atk:20,spd:0.05},불멸:{atk:32,spd:0.05}};
  const getGradeEnhLv=(grade)=>(G.current?.gradeEnhLv||{})[grade]||0;

  const MAX_GRADE_ENH=20;
  const doGradeEnhance=(grade)=>{
    const g=G.current;if(!g.gradeEnhLv)g.gradeEnhLv={};
    const lv=g.gradeEnhLv[grade]||0;
    if(lv>=MAX_GRADE_ENH){alert(`최대 등급강화(${MAX_GRADE_ENH}강)에 도달했습니다!`);return;}
    const cost=GRADE_ENH_COST[grade]*(lv+1);
    if(g.gold<cost){alert(`골드 부족! (${cost}G)`);return;}
    g.gold-=cost;g.gradeEnhLv[grade]=(lv+1);
    const bonus=GRADE_ENH_BONUS[grade];
    for(const h of g.heroes){if(h.grade===grade){h.atk+=bonus.atk;h.spd=Math.min((h.spd||1)+bonus.spd,3.0);}}
    sync();draw();alert(`✅ ${grade} 강화 완료! ATK+${bonus.atk}/SPD+${(bonus.spd*100).toFixed(0)}% (Lv.${lv+1})`);
  };

  const ENHANCE_GRADES=["전설","신화","불멸"]; // 강화 가능 등급
  const maxEnh=(h)=>h.element==="황금정령"?20:10; // 황금정령만 20강
  const enhCost=(h)=>10*(h.enhLv+1);
  const canEnhance=(h)=>ENHANCE_GRADES.includes(h.grade)&&(h.enhLv||0)<maxEnh(h);
  const doEnhance=(heroId)=>{
    const g=G.current,h=g.heroes.find(x=>x.id===heroId);
    if(!h)return;
    if(!ENHANCE_GRADES.includes(h.grade)){alert("전설 이상 유닛만 강화 가능합니다!");return;}
    if((h.enhLv||0)>=maxEnh(h)){alert(`최대 강화(${maxEnh(h)}강)에 도달했습니다!`);return;}
    const cost=enhCost(h);
    if(g.gold<cost){alert(`골드 부족! (${cost}G)`);return;}
    g.gold-=cost;h.enhLv=(h.enhLv||0)+1;h.atk+=5;h.spd=Math.min((h.spd||1)+0.02,2.5);
    sync();draw();
  };

  const doSell=(heroId)=>{
    const g=G.current,h=g.heroes.find(x=>x.id===heroId);
    if(!h)return;
    g.gold+=SELL_PRICE[h.grade]||5;
    g.heroes=g.heroes.filter(x=>x.id!==heroId);
    setSelHero(null);sync();draw();
  };

  const getSameElementGroups=()=>{
    const g=G.current;const map={};
    for(const h of g.heroes){if(!map[h.element])map[h.element]=[];map[h.element].push(h);}
    return Object.entries(map).filter(([,arr])=>arr.length>=1).map(([el,arr])=>({el,arr}));
  };

  const doStack=(el,count)=>{
    const g=G.current;
    const targets=g.heroes.filter(h=>h.element===el).slice(0,count);
    if(targets.length<count)return;
    const removeIds=new Set(targets.map(x=>x.id));
    g.heroes=g.heroes.filter(x=>!removeIds.has(x.id));
    if(!g.stacks)g.stacks={};
    g.stacks={...g.stacks,[el]:(g.stacks[el]||0)+count};
    setModal(null);sync();draw();
  };

  const popStack=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const newStacks={...g.stacks};newStacks[el]-=1;if(newStacks[el]===0)delete newStacks[el];
    g.stacks=newStacks;
    const h=mkH(el,"노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
    if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes=[...g.heroes,h];sync();draw();
  };

  const popStackAll=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const cnt=g.stacks[el];const newStacks={...g.stacks};delete newStacks[el];g.stacks=newStacks;
    const newHeroes=[...g.heroes];
    for(let i=0;i<cnt;i++){const h=mkH(el,"노말",g.gradeEnhLv||{});const pos=autoPlace(newHeroes);if(pos){h.col=pos[0];h.row=pos[1];}newHeroes.push(h);}
    g.heroes=newHeroes;sync();draw();
  };

  const canRecipe=(recipe)=>{
    const g=G.current;const cnt={};
    for(const h of g.heroes)cnt[h.element]=(cnt[h.element]||0)+1;
    return recipe.parts.every(p=>(cnt[p.u]||0)>=p.n);
  };

  const doRecipe=(recipe)=>{
    const g=G.current;if(!canRecipe(recipe)){alert("재료 부족!");return;}
    // 황금정령은 1개만 보유 가능
    if(recipe.r==="황금정령"&&g.heroes.some(h=>h.element==="황금정령")){
      alert("황금정령은 1개만 보유할 수 있습니다!");return;
    }
    const remaining=[...g.heroes];
    for(const part of recipe.parts){let removed=0;for(let i=remaining.length-1;i>=0&&removed<part.n;i--){if(remaining[i].element===part.u){remaining.splice(i,1);removed++;}}}
    const h=mkH(recipe.r,recipe.g,g.gradeEnhLv||{});const pos=autoPlace(remaining);
    if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes=[...remaining,h];setModal(null);sync();draw();triggerSummon(recipe.r,recipe.g);
  };

  const stackCombine=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<2){alert("스택에 2개 이상 필요");return;}
    const newStacks={...g.stacks};newStacks[el]-=2;if(newStacks[el]===0)delete newStacks[el];g.stacks=newStacks;
    const recipes=COMBO.filter(r=>r.a===el&&r.b===el);
    let nh;
    if(recipes.length>0){const r=recipes[Math.floor(Math.random()*recipes.length)];nh=mkH(r.r,r.g,g.gradeEnhLv||{});}
    else{nh=mkH(el,"고급",g.gradeEnhLv||{});}
    const pos=autoPlace(g.heroes);if(pos){nh.col=pos[0];nh.row=pos[1];}
    g.heroes=[...g.heroes,nh];sync();draw();
  };

  const toggleRandomPick=(heroId)=>{
    setRandomPicks(prev=>{
      let next;
      if(prev.includes(heroId))next=prev.filter(x=>x!==heroId);
      else if(prev.length>=3)next=prev;
      else next=[...prev,heroId];
      randomPicksRef.current=next;return next;
    });
  };

  const doRandomMerge=()=>{
    const g=G.current;const picks=randomPicksRef.current;
    if(picks.length!==3){alert("3개를 선택하세요!");return;}
    const targets=picks.map(id=>g.heroes.find(h=>h.id===id)).filter(Boolean);
    if(targets.length!==3){alert("선택한 유닛을 찾을 수 없습니다.");return;}
    const els=targets.map(h=>h.element);
    let result=null;
    for(const r of COMBO){if(els.includes(r.a)&&els.includes(r.b)){result=r;break;}}
    const pos={col:targets[0].col,row:targets[0].row};
    let nh;
    if(result){nh=mkH(result.r,result.g,g.gradeEnhLv||{});}
    else{const pool=COMBO.filter(r=>r.g==="고급");const rnd=pool[Math.floor(Math.random()*pool.length)];nh=mkH(rnd.r,rnd.g,g.gradeEnhLv||{});}
    nh.col=pos.col;nh.row=pos.row;
    g.heroes=g.heroes.filter(x=>!picks.includes(x.id));g.heroes.push(nh);
    randomPicksRef.current=[];setRandomPicks([]);setModal(null);setSelHero(null);sync();draw();
  };

  const buyWithCoin=(item)=>{
    const g=G.current;if(g.coins<item.cost){alert(`코인 부족! (${item.cost}개 필요)`);return;}
    if(item.element){g.coins-=item.cost;const h=mkH(item.element,item.grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes.push(h);setModal(null);sync();draw();triggerSummon(item.element,item.grade);return;}
    setModal({type:"coinPick",item});
  };
  const buyCoinByElement=(item,el)=>{
    const g=G.current;if(g.coins<item.cost){alert("코인 부족!");return;}
    g.coins-=item.cost;const h=mkH(el,item.grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes.push(h);setModal(null);sync();draw();triggerSummon(el,item.grade);
  };

  // ── 랭킹 저장
  const saveRecord=async(isVictory)=>{
    if(isVictory){
      const newCount=clearCount+1;
      setClearCount(newCount);
      try{localStorage.setItem('clearCount',String(newCount));}catch{}
    }
    if(!nickname.trim())return;
    const g=G.current;
    const record={
      name:nickname.trim(),
      difficulty:g.difficulty||'hard',
      round:g.round,
      gold:g.gold,
      coins:g.coins,
      map:currentMapName,
      victory:isVictory,
      ts:Date.now(),
    };
    try{
      // 기존 랭킹 불러오기
      let list=[];
      try{const res=await window.storage.get('ranking',true);if(res)list=JSON.parse(res.value);}catch(e){}
      // 같은 닉네임 중 더 좋은 기록만 남기기 (라운드 기준)
      const others=list.filter(r=>r.name!==record.name);
      const mine=list.find(r=>r.name===record.name);
      // 이전 기록보다 높을 때만 갱신 (라운드→골드→코인 순 비교)
      const isBetter=!mine
        ||(record.round>mine.round)
        ||(record.round===mine.round&&record.gold>mine.gold)
        ||(record.round===mine.round&&record.gold===mine.gold&&record.coins>mine.coins);
      const best=isBetter?record:mine;
      const newList=[...others,best]
        .sort((a,b)=>b.round-a.round||b.gold-a.gold)
        .slice(0,50);
      await window.storage.set('ranking',JSON.stringify(newList),true);
    }catch(e){console.error('ranking save error',e);}
  };

  // ── 랭킹 불러오기
  const loadRanking=async()=>{
    setRankLoading(true);
    try{
      const res=await window.storage.get('ranking',true);
      if(res){setRanking(JSON.parse(res.value));}
      else setRanking([]);
    }catch(e){setRanking([]);}
    setRankLoading(false);
  };

  const changeSpeed=(s)=>{spR.current=s;setSpeedState(s);};
  const hd=HH.find(h=>h.id===selH);
  const myEls=new Set(heroes.map(h=>h.element));
  const myElsCnt=heroes.reduce((acc,h)=>{acc[h.element]=(acc[h.element]||0)+1;return acc;},{});
  const fCombo=COMBO.filter(r=>r.g===comboFilter);
  const selHeroObj=heroes.find(h=>h.id===selHero);
  const combOpts=selHero?getCombOptions(selHero):[];
  const buff=getBuff();

  // ══════════════════════════════════════════
  // 타이틀 화면
  // ══════════════════════════════════════════
  if(phase==='title'){
    return(
      <>
      <div style={{fontFamily:"sans-serif",background:"#0d1117",minHeight:"100vh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{fontSize:52,marginBottom:6,filter:"drop-shadow(0 0 20px #3b82f6)"}}>🗡️</div>
        <div style={{fontSize:30,fontWeight:"bold",background:"linear-gradient(135deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:4,letterSpacing:3}}>랜덤 디펜스</div>
        <div style={{fontSize:12,color:"#374151",marginBottom:8,letterSpacing:4}}>RANDOM DEFENSE</div>
        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
          <span style={{background:"#1e293b",borderRadius:8,padding:"4px 10px",fontSize:12,color:"#fcd34d",fontWeight:"bold"}}>🏆 {clearCount}클리어</span>
          {clearCount<1&&<span style={{fontSize:11,color:"#555"}}>쉬움 클리어 시 보통 난이도·전설 개방</span>}
          {clearCount>=1&&clearCount<3&&<span style={{fontSize:11,color:"#555"}}>{3-clearCount}클리어 후 신화 개방</span>}
          {clearCount>=3&&clearCount<5&&<span style={{fontSize:11,color:"#555"}}>{5-clearCount}클리어 후 불멸·어려움 개방</span>}
          {clearCount>=5&&<span style={{fontSize:11,color:"#4ade80"}}>✅ 모든 콘텐츠 개방!</span>}
        </div>

        {/* 맵 선택 */}
        <div style={{width:"100%",maxWidth:340,marginBottom:20}}>
          <div style={{fontSize:11,color:"#888",marginBottom:8,textAlign:"center"}}>🗺️ 맵 설정</div>
          {/* 랜덤 / 선택 탭 */}
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {[{key:"random",label:"🎲 랜덤맵"},{key:"pick",label:"🗺️ 선택맵"}].map(m=>(
              <button key={m.key} onClick={()=>setMapMode(m.key)}
                style={{flex:1,background:mapMode===m.key?"linear-gradient(135deg,#1f6feb,#6e40c9)":"#161b22",border:`1px solid ${mapMode===m.key?"#3b82f6":"#30363d"}`,color:mapMode===m.key?"#fff":"#888",borderRadius:10,padding:"9px 0",cursor:"pointer",fontSize:13,fontWeight:mapMode===m.key?"bold":"normal",transition:"all 0.15s"}}>
                {m.label}
              </button>
            ))}
          </div>
          {/* 랜덤: 맵 미리보기만 표시 */}
          {mapMode==='random'&&(
            <div style={{display:"flex",gap:6}}>
              {[{key:"B",label:"S자",color:"#4f8",icon:"〰️"},{key:"C",label:"이중분기",color:"#fa0",icon:"🔀"},{key:"D",label:"나선형",color:"#c084fc",icon:"🌀"},{key:"E",label:"역방향",color:"#f87171",icon:"⬆️"},{key:"F",label:"대각선",color:"#fb923c",icon:"↗️"}].map(m=>(
                <div key={m.key} style={{flex:1,background:"#161b22",border:`1px solid ${m.color}22`,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                  <div style={{fontSize:16,marginBottom:2}}>{m.icon}</div>
                  <div style={{fontSize:10,color:m.color}}>{m.label}</div>
                </div>
              ))}
            </div>
          )}
          {/* 선택: 클릭으로 선택 */}
          {mapMode==='pick'&&(
            <div style={{display:"flex",gap:6}}>
              {[{key:"B",label:"S자",color:"#4f8",icon:"〰️"},{key:"C",label:"이중분기",color:"#fa0",icon:"🔀"},{key:"D",label:"나선형",color:"#c084fc",icon:"🌀"},{key:"E",label:"역방향",color:"#f87171",icon:"⬆️"},{key:"F",label:"대각선",color:"#fb923c",icon:"↗️"}].map(m=>(
                <button key={m.key} onClick={()=>setSelectedMap(m.key)}
                  style={{flex:1,background:selectedMap===m.key?`${m.color}22`:"#161b22",border:`2px solid ${selectedMap===m.key?m.color:m.color+"22"}`,borderRadius:10,padding:"8px 6px",textAlign:"center",cursor:"pointer",transition:"all 0.15s"}}>
                  <div style={{fontSize:16,marginBottom:2}}>{m.icon}</div>
                  <div style={{fontSize:10,color:m.color,fontWeight:selectedMap===m.key?"bold":"normal"}}>{m.label}</div>
                  {selectedMap===m.key&&<div style={{fontSize:9,color:m.color,marginTop:2}}>✓ 선택됨</div>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 닉네임 입력 */}
        <div style={{width:"100%",maxWidth:340,marginBottom:16}}>
          <div style={{fontSize:11,color:"#888",marginBottom:6,textAlign:"center"}}>👤 닉네임</div>
          <input
            value={nickname}
            onChange={e=>setNickname(e.target.value)}
            maxLength={12}
            placeholder="닉네임 입력 (최대 12자)"
            style={{width:"100%",background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:"10px 14px",color:"#eee",fontSize:14,outline:"none",boxSizing:"border-box",textAlign:"center"}}
          />
        </div>

        <div style={{display:"flex",gap:8,marginBottom:10,width:"100%",maxWidth:340}}>
          <button onClick={()=>startGame(null)}
            style={{flex:2,background:"linear-gradient(135deg,#1f6feb,#6e40c9)",border:"none",color:"#fff",borderRadius:12,padding:"14px 0",cursor:"pointer",fontSize:16,fontWeight:"bold",letterSpacing:1,boxShadow:"0 4px 20px rgba(31,111,235,0.4)"}}>
            ⚔️ 게임 시작
          </button>
          <button onClick={()=>startRotation()}
            style={{flex:1,background:"linear-gradient(135deg,#7c3aed,#dc2626)",border:"none",color:"#fff",borderRadius:12,padding:"14px 0",cursor:"pointer",fontSize:14,fontWeight:"bold",boxShadow:"0 4px 20px rgba(124,58,237,0.4)"}}>
            🔄 회전
          </button>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <button onClick={()=>{setShowRanking(true);loadRanking();}}
            style={{background:"none",border:"1px solid #30363d",color:"#fd0",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>
            🏆 랭킹
          </button>
          <button onClick={()=>setShowGuide(true)}
            style={{background:"none",border:"1px solid #30363d",color:"#4af",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>
            📖 설명
          </button>
          <button onClick={()=>setShowPatch(true)}
            style={{background:"none",border:"1px solid #30363d",color:"#555",borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>
            📋 패치노트
          </button>
        </div>
        <div style={{fontSize:11,color:"#444",textAlign:"center"}}>{mapMode==='random'?'매 게임 5종 맵 중 랜덤으로 시작':`${MAP_DEFS[selectedMap].name} 맵으로 시작`}</div>
      </div>

      {/* 랭킹 모달 */}
      {showRanking&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:400,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:"bold"}}>🏆 랭킹</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>loadRanking()}
                  disabled={rankLoading}
                  style={{background:"#1e293b",border:"1px solid #334155",color:rankLoading?"#475569":"#94a3b8",borderRadius:7,padding:"4px 10px",cursor:rankLoading?"not-allowed":"pointer",fontSize:12}}>
                  {rankLoading?"⏳":"🔄"} 새로고침
                </button>
                <button onClick={()=>setShowRanking(false)} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
              </div>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {rankLoading&&<div style={{textAlign:"center",color:"#555",padding:20}}>불러오는 중...</div>}
              {!rankLoading&&ranking.length===0&&<div style={{textAlign:"center",color:"#555",padding:20}}>아직 기록이 없어요</div>}
              {!rankLoading&&ranking.map((r,i)=>{
                const diffColor=r.difficulty==='easy'?'#4f8':r.difficulty==='normal'?'#4af':'#f44';
                const diffLabel=r.difficulty==='easy'?'쉬움':r.difficulty==='normal'?'보통':'어려움';
                const isMe=r.name===nickname.trim();
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",marginBottom:6,borderRadius:10,background:isMe?"rgba(31,111,235,0.12)":"rgba(255,255,255,0.02)",border:`1px solid ${isMe?"#1f6feb":"#21262d"}`}}>
                    <div style={{width:28,textAlign:"center",fontWeight:"bold",fontSize:14,color:i===0?"#fd0":i===1?"#aaa":i===2?"#c84":"#555",flexShrink:0}}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <span style={{fontWeight:"bold",fontSize:13,color:isMe?"#4af":"#eee",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                        {r.victory&&<span style={{fontSize:10,color:"#fd0",flexShrink:0}}>👑클리어</span>}
                        {isMe&&<span style={{fontSize:10,color:"#4af",flexShrink:0}}>← 나</span>}
                      </div>
                      <div style={{display:"flex",gap:8,fontSize:11,color:"#888",flexWrap:"wrap"}}>
                        <span style={{color:diffColor}}>{diffLabel}</span>
                        <span style={{color:"#4af"}}>R{r.round}/100</span>
                        <span style={{color:"#fd0"}}>💰{r.gold}G</span>
                        <span style={{color:"#a78bfa"}}>🪙{r.coins}</span>
                        <span style={{color:"#555"}}>{r.map}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{padding:"12px 16px",borderTop:"1px solid #21262d",flexShrink:0}}>
              <button onClick={()=>setShowRanking(false)} style={{width:"100%",background:"#1f6feb",border:"none",color:"#fff",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 게임 설명 모달 */}
      {showGuide&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:400,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:"bold",color:"#4af"}}>📖 게임 설명</div>
              <button onClick={()=>setShowGuide(false)} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"14px 18px"}}>
              {[
                {icon:"🎯",title:"게임 목표",color:"#f87171",items:["적이 경로를 따라 GOAL에 도달하면 라이프 감소","라이프가 0이 되거나 적이 30마리 넘으면 게임 오버","100라운드를 버티면 클리어 (무한모드 도전 가능)"]},
                {icon:"🎲",title:"유닛 뽑기 & 배치",color:"#60a5fa",items:["뽑기(10G) → 랜덤 속성 노말 유닛 획득","획득한 유닛을 경로 밖 빈 칸에 배치","유닛 클릭 → 이동/강화/판매 가능","유닛 꾹 누르기 → 상세 정보 확인"]},
                {icon:"⚗️",title:"조합 시스템",color:"#a78bfa",items:["같은 속성 2개 → 고급 유닛으로 조합","고급 유닛 2개 → 영웅 유닛으로 조합","영웅 이상 조합으로 전설/신화/불멸 제작 가능","조합표에서 필요 재료 확인","유닛 선택 후 하단 조합 버튼 클릭"]},
                {icon:"⚡",title:"속성별 특성",color:"#fbbf24",items:["🔥 불/☄️ 운석 → 범위 스플래시 데미지","⚡ 전기 → 최대 3회 체인 공격","🌀 바람/🔊 소리 → 일직선 관통","☠️ 독 → 3초 지속데미지 (최대 3중첩)","🌿 나무 → 속박 / 💧 물 → 방어감소","🌑 어둠 → 스턴 / ❄️ 얼음·시간·홍수 → 슬로우"]},
                {icon:"👑",title:"히든영웅",color:"#f97316",items:["게임 시작 전 히든영웅 1명 선택","전체 유닛에 버프 적용 (공격력/속도/사거리 등)","상인: 골드+30% / 저격수: 사거리+2","수호자: 라이프+10 / 번개신: 연쇄공격","시간술사: 슬로우 강화 / 연금술사: 균형형"]},
                {icon:"⬆️",title:"강화 시스템",color:"#4ade80",items:["개별강화: 전설 이상만 가능 (최대 10강)","황금정령은 개별강화 20강 (강화마다 +1골드)","등급강화: 전 유닛 일괄 능력치 상승 (최대 20강)","코인 상점에서 고급/영웅/전설 유닛 구매"]},
                {icon:"💀",title:"보스 & 웨이브",color:"#f44",items:["5라운드마다 중간보스, 10라운드마다 보스 등장","보스는 약점 속성에만 정상 데미지 (나머지 10%)","카운트다운에서 다음 보스 약점 미리 확인","무리/속도/장갑/힐러 등 다양한 웨이브 등장","보스 HP 40% 이하 시 광폭화"]},
              ].map(section=>(
                <div key={section.title} style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <span style={{fontSize:18}}>{section.icon}</span>
                    <span style={{fontSize:14,fontWeight:"bold",color:section.color}}>{section.title}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,paddingLeft:8}}>
                    {section.items.map((item,i)=>(
                      <div key={i} style={{display:"flex",gap:6,fontSize:12,color:"#94a3b8",lineHeight:1.5}}>
                        <span style={{color:section.color,flexShrink:0}}>•</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{borderBottom:"1px solid #1e293b",marginTop:12}}/>
                </div>
              ))}
            </div>
            <div style={{padding:"12px 18px",borderTop:"1px solid #21262d",flexShrink:0}}>
              <button onClick={()=>setShowGuide(false)} style={{width:"100%",background:"#1d4ed8",border:"none",color:"#fff",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 패치노트 모달 */}
      {showPatch&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:380,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
            {/* 헤더 */}
            <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div>
                <div style={{fontSize:16,fontWeight:"bold",color:"#eee"}}>📋 패치노트</div>
                <div style={{fontSize:11,color:"#555",marginTop:2}}>랜덤 디펜스 업데이트 내역</div>
              </div>
              <button onClick={()=>setShowPatch(false)}
                style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer",padding:"0 4px",lineHeight:1}}>✕</button>
            </div>
            {/* 스크롤 영역 */}
            <div style={{overflowY:"auto",flex:1,padding:"12px 20px"}}>
              {PATCH_NOTES.map((p,i)=>(
                <div key={p.version} style={{marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{background:i===0?"#1f6feb22":"#21262d",border:`1px solid ${i===0?"#1f6feb":"#30363d"}`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:"bold",color:i===0?"#4af":"#555"}}>
                      {p.version}
                    </span>
                    <span style={{fontSize:12,fontWeight:"bold",color:i===0?"#eee":"#666"}}>{p.title}</span>
                    <span style={{fontSize:10,color:"#333",marginLeft:"auto"}}>{p.date}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,paddingLeft:4}}>
                    {p.changes.map((c,j)=>(
                      <div key={j} style={{fontSize:12,color:i===0?"#aaa":"#444",lineHeight:1.5}}>
                        {c}
                      </div>
                    ))}
                  </div>
                  {i<PATCH_NOTES.length-1&&<div style={{borderBottom:"1px solid #21262d",marginTop:14}}/>}
                </div>
              ))}
            </div>
            {/* 닫기 버튼 */}
            <div style={{padding:"12px 20px",borderTop:"1px solid #21262d",flexShrink:0}}>
              <button onClick={()=>setShowPatch(false)}
                style={{width:"100%",background:"#1f6feb",border:"none",color:"#fff",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:14,fontWeight:"bold",marginBottom:6}}>
                확인
              </button>
              <button onClick={()=>{try{localStorage.setItem('patchSeenVersion',PATCH_NOTES[0].version);}catch{}setShowPatch(false);}}
                style={{width:"100%",background:"transparent",border:"1px solid #30363d",color:"#555",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:12}}>
                다음 패치 전까지 보지않기
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }

  // ══════════════════════════════════════════
  // 히든영웅 선택 화면
  // ══════════════════════════════════════════
  if(phase==='hidden'){
    return(
      <div style={{fontFamily:"sans-serif",background:"#0d1117",minHeight:"100vh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{width:"100%",maxWidth:400,background:"#161b22",borderRadius:16,padding:20,border:"1px solid #30363d"}}>
          <div style={{textAlign:"center",marginBottom:4}}>
            <div style={{fontSize:11,color:"#4af",marginBottom:4}}>🗺️ {currentMapName} 맵</div>
            <div style={{fontSize:18,fontWeight:"bold",marginBottom:4}}>👑 히든영웅 선택</div>
            <div style={{fontSize:12,color:"#666",marginBottom:12}}>영웅을 선택하면 게임이 시작됩니다</div>
          </div>
          {/* 난이도 선택 */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:"#888",marginBottom:6,textAlign:"center"}}>⚔️ 난이도</div>
            <div style={{display:"flex",gap:6}}>
              {[
                {key:'easy',label:'쉬움',desc:'공격력 ×1.7',color:'#4f8',icon:'🌱',need:0},
                {key:'normal',label:'보통',desc:'공격력 ×1.3',color:'#4af',icon:'⚔️',need:1},
                {key:'hard',label:'어려움',desc:'공격력 ×1.0',color:'#f44',icon:'💀',need:5},
              ].map(d=>{
                const unlocked=clearCount>=d.need;
                return(
                  <button key={d.key} onClick={()=>unlocked&&setDifficulty(d.key)}
                    style={{flex:1,background:difficulty===d.key&&unlocked?d.color+'22':'#21262d',
                      border:`2px solid ${difficulty===d.key&&unlocked?d.color:'#30363d'}`,
                      borderRadius:10,padding:"8px 4px",cursor:unlocked?"pointer":"not-allowed",textAlign:"center",opacity:unlocked?1:0.4}}>
                    <div style={{fontSize:18,marginBottom:2}}>{unlocked?d.icon:"🔒"}</div>
                    <div style={{fontSize:12,fontWeight:"bold",color:difficulty===d.key&&unlocked?d.color:'#aaa'}}>{unlocked?d.label:`${d.need}클리어`}</div>
                    <div style={{fontSize:9,color:"#555",marginTop:1}}>{unlocked?d.desc:"잠김"}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {HH.map(h=>{
              const unlocked=clearCount>=h.unlockAt;
              return(
                <button key={h.id} onClick={()=>unlocked&&pickHidden(h)}
                  style={{background:unlocked?`${h.color}18`:"#1a1a2e",border:`2px solid ${unlocked?h.color:"#333"}`,borderRadius:10,padding:"12px 16px",cursor:unlocked?"pointer":"not-allowed",color:unlocked?"#eee":"#555",textAlign:"left",display:"flex",alignItems:"center",gap:12,opacity:unlocked?1:0.5}}>
                  <span style={{fontSize:28}}>{unlocked?h.emoji:"🔒"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",fontSize:15,color:unlocked?h.color:"#444"}}>{unlocked?h.name:`${h.unlockAt}클리어 후 개방`}</div>
                    <div style={{fontSize:11,color:unlocked?"#aaa":"#333",marginTop:2}}>{unlocked?h.desc:`${h.unlockAt}번 클리어하면 해금됩니다`}</div>
                  </div>
                  {unlocked&&<span style={{fontSize:10,color:h.color,background:`${h.color}22`,borderRadius:4,padding:"2px 6px"}}>선택</span>}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setPhase('title')} style={{marginTop:12,background:"#21262d",border:"1px solid #30363d",color:"#666",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:12,width:"100%"}}>← 타이틀로</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // 게임 화면
  // ══════════════════════════════════════════
  return(
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#060d1a",minHeight:"100vh",color:"#e2e8f0",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px"}}>
      <SummonOverlay anim={summonAnim} onClose={()=>setSummonAnim(null)}/>

      {/* HUD - 2줄 */}
      <div style={{width:"100%",maxWidth:440,marginBottom:4}}>
        {/* 1줄: 스탯 */}
        <div style={{display:"flex",alignItems:"center",gap:0,background:"#0f172a",borderRadius:"10px 10px 0 0",padding:"5px 10px",border:"1px solid #1e293b",borderBottom:"none"}}>
          <div style={{display:"flex",align:"center",gap:6,flex:1,flexWrap:"nowrap",overflow:"hidden"}}>
            <button onClick={()=>setPhase('title')} style={{background:"transparent",border:"1px solid #1e293b",color:"#6b7280",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontSize:12,flexShrink:0}}>🏠</button>
            <span style={{background:"#450a0a",borderRadius:6,padding:"2px 7px",fontSize:12,color:"#fca5a5",fontWeight:"bold",flexShrink:0}}>❤️{ui.life}</span>
            {countdown>0&&<button onClick={skipCountdown} style={{background:"#1e3a5f",border:"1px solid #3b82f6",color:"#60a5fa",borderRadius:6,padding:"2px 7px",cursor:"pointer",fontSize:11,fontWeight:"bold",flexShrink:0}}>⏭️{countdown}s</button>}
            <span style={{background:"#1c1917",borderRadius:6,padding:"2px 7px",fontSize:12,color:"#fcd34d",fontWeight:"bold",flexShrink:0}}>💰{ui.gold}G</span>
            <span style={{background:"#1e1b4b",borderRadius:6,padding:"2px 7px",fontSize:12,color:"#a78bfa",fontWeight:"bold",flexShrink:0,cursor:"pointer"}} onClick={()=>setModal("shop")}>🪙{ui.coins}</span>
            <span style={{background:"#172554",borderRadius:6,padding:"2px 7px",fontSize:11,color:"#60a5fa",fontWeight:"bold",flexShrink:0}}>R{ui.round}<span style={{color:"#374151",fontWeight:"normal"}}>/100</span></span>
            <span style={{background:ui.total>=24?"#450a0a":"#111827",borderRadius:6,padding:"2px 7px",fontSize:11,color:ui.total>=24?"#f87171":"#6b7280",flexShrink:0}}>👾{ui.total}/30</span>
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0,marginLeft:6}}>
            <span style={{fontSize:10,color:G.current?.difficulty==='easy'?'#4ade80':G.current?.difficulty==='normal'?'#60a5fa':'#f87171',background:"#1e293b",borderRadius:5,padding:"2px 5px"}}>
              {G.current?.difficulty==='easy'?'쉬움':G.current?.difficulty==='normal'?'보통':'어려움'}
            </span>
            <span style={{fontSize:10,color:"#60a5fa",background:"#1e293b",borderRadius:5,padding:"2px 5px"}}>{currentMapName}</span>
            {rotMode&&<span style={{fontSize:10,color:"#c084fc",background:"#1e293b",borderRadius:5,padding:"2px 5px"}}>🔄회전</span>}
            <button onClick={()=>setShowCombo(true)} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:5,padding:"2px 7px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>조합표</button>
          </div>
        </div>
        {/* 2줄: 배속 + 홈 */}
        <div style={{display:"flex",gap:3,background:"#0a0f1a",borderRadius:"0 0 10px 10px",padding:"4px 6px",border:"1px solid #1e293b",borderTop:"none"}}>
          {[1,2,3,4].map(s=>(
            <button key={s} onClick={()=>changeSpeed(s)}
              style={{flex:1,background:speed===s?"#1d4ed8":"transparent",border:`1px solid ${speed===s?"#3b82f6":"#1e293b"}`,color:speed===s?"#fff":"#475569",borderRadius:6,padding:"4px 0",cursor:"pointer",fontSize:13,fontWeight:"bold",transition:"all 0.15s"}}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      {countdown>0&&(()=>{
        const nb=G.current?.round%10===0;
        const bossInfo=nb?makeBoss(G.current?.round||10):null;
        return(
        <div style={{width:"100%",maxWidth:440,marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:bossInfo?"linear-gradient(135deg,#450a0a,#7f1d1d)":"linear-gradient(135deg,#052e16,#14532d)",borderRadius:bossInfo?"8px 8px 0 0":8,padding:"6px 10px",border:`1px solid ${bossInfo?"#ef4444":"#166534"}`,fontSize:15,color:bossInfo?"#fca5a5":"#4ade80",fontWeight:"bold"}}>
            {G.current?.waveLabel&&<span style={{fontSize:13,marginRight:8,color:"#fcd34d"}}>{G.current.waveLabel}</span>}
            <span>⏱ {countdown}초 후 시작</span>
            <button onClick={skipCountdown}
              style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:6,padding:"2px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold",marginLeft:8,flexShrink:0}}>
              ▶ 스킵
            </button>
          </div>
          {bossInfo&&(
            <div style={{background:"#1c0a0a",borderRadius:"0 0 8px 8px",padding:"5px 10px",border:"1px solid #7f1d1d",borderTop:"none",display:"flex",alignItems:"center",gap:8,fontSize:11}}>
              <span style={{fontSize:16}}>{bossInfo.emoji}</span>
              <span style={{color:"#fca5a5",fontWeight:"bold"}}>{bossInfo.name}</span>
              <span style={{color:"#888",flex:1}}>{bossInfo.desc}</span>
              <div style={{display:"flex",gap:3}}>
                {(bossInfo.weak||[]).map(w=>(
                  <span key={w} style={{background:"#451a03",border:"1px solid #f97316",borderRadius:4,padding:"1px 4px",color:"#fb923c",fontSize:10}}>{EE[w]||w}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      <canvas ref={cvs} width={COLS*CS} height={ROWS*CS} onClick={onCanvas}
        style={{width:"100%",maxWidth:440,borderRadius:12,
          border:`2px solid ${drag?"rgba(251,191,36,0.6)":selHero?"rgba(99,102,241,0.5)":"#1e293b"}`,
          boxShadow:drag?"0 0 15px rgba(251,191,36,0.2)":selHero?"0 0 15px rgba(99,102,241,0.15)":"0 4px 20px rgba(0,0,0,0.5)",
          cursor:drag||selHero?"crosshair":"default"}}/>

      {/* 게임오버 */}
      {ui.over&&(()=>{
        const g=G.current;
        const diff=g?.difficulty||'hard';
        const diffLabel=diff==='easy'?'🌱쉬움':diff==='normal'?'⚔️보통':'💀어려움';
        return(<Overlay>
          <div style={{fontSize:40,textAlign:"center"}}>💀</div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#f44",margin:"8px 0",textAlign:"center"}}>게임 오버</div>
          <div style={{background:"#21262d",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>닉네임</span><span style={{color:"#eee",fontWeight:"bold"}}>{nickname||'익명'}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>난이도</span><span>{diffLabel}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>라운드</span><span style={{color:"#4af",fontWeight:"bold"}}>R{ui.round}/100</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>골드</span><span style={{color:"#fd0"}}>💰{ui.gold}G</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#888"}}>코인</span><span style={{color:"#a78bfa"}}>🪙{ui.coins}</span></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <Btn bg="#c33" onClick={()=>{saveRecord(false);startGame(null);}}>다시 시작</Btn>
            <Btn bg="#333" onClick={()=>{saveRecord(false);setPhase('title');}}>타이틀로</Btn>
          </div>
          <Btn bg="#21262d" onClick={()=>{saveRecord(false);setShowRanking(true);loadRanking();}} style={{width:"100%",border:"1px solid #30363d"}}>🏆 랭킹 보기</Btn>
        </Overlay>);
      })()}
      {ui.victory&&(()=>{
        const g=G.current;
        const diff=g?.difficulty||'hard';
        const diffLabel=diff==='easy'?'🌱쉬움':diff==='normal'?'⚔️보통':'💀어려움';
        return(<Overlay>
          <div style={{fontSize:44,textAlign:"center"}}>🏆</div>
          <div style={{fontSize:22,fontWeight:"bold",color:"#fd0",margin:"8px 0",textAlign:"center"}}>100층 클리어!</div>
          <div style={{color:"#4f8",fontSize:14,marginBottom:6,textAlign:"center"}}>축하합니다!</div>
          <div style={{background:"#21262d",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>닉네임</span><span style={{color:"#eee",fontWeight:"bold"}}>{nickname||'익명'}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>난이도</span><span>{diffLabel}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>골드</span><span style={{color:"#fd0"}}>💰{ui.gold}G</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#888"}}>코인</span><span style={{color:"#a78bfa"}}>🪙{ui.coins}</span></div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <Btn bg="#1f6feb" onClick={()=>{saveRecord(true);startGame(null);}}>다시 시작</Btn>
            <Btn bg="#333" onClick={()=>{saveRecord(true);setPhase('title');}}>타이틀로</Btn>
          </div>
          <Btn bg="linear-gradient(135deg,#7c3aed,#4f46e5)" onClick={()=>{
            const g=G.current;
            g.victory=false;g.over=false;g.infiniteMode=true;
            g.running=true;lt.current=performance.now();
            raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
            setUi(prev=>({...prev,victory:false,over:false}));
          }} style={{width:"100%",marginBottom:6,border:"1px solid #7c3aed"}}>🌀 무한모드 계속하기</Btn>
          <Btn bg="#21262d" onClick={()=>{saveRecord(true);setShowRanking(true);loadRanking();}} style={{width:"100%",border:"1px solid #30363d"}}>🏆 랭킹 보기</Btn>
        </Overlay>);
      })()}

      {/* 액션 버튼 */}
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:5,marginTop:5}}>
        <button onClick={()=>{
          const g=G.current;if(g.gold<10){alert("골드 부족! (10G)");return;}
          g.gold-=10;
          const h=mkH(UNLOCK_ELEMENTS(clearCount)[Math.floor(Math.random()*UNLOCK_ELEMENTS(clearCount).length)],"노말",g.gradeEnhLv||{});
          const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
          g.heroes.push(h);sync();draw();
        }} style={{flex:1.3,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",border:"1px solid #3b82f6",color:"#fff",borderRadius:10,padding:"9px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold",boxShadow:"0 2px 8px rgba(59,130,246,0.3)"}}>
          🎲 뽑기<br/><span style={{fontSize:10,opacity:0.8}}>10G</span>
        </button>
        <button onClick={()=>{setRandomPicks([]);setModal("merge");}} style={{flex:1,background:"linear-gradient(135deg,#15803d,#166534)",border:"1px solid #22c55e",color:"#fff",borderRadius:10,padding:"9px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold",boxShadow:"0 2px 8px rgba(34,197,94,0.2)"}}>
          ✨<br/><span style={{fontSize:10,opacity:0.8}}>뭉치기</span>
        </button>
        <button onClick={()=>setModal("gradeEnh")} style={{flex:1,background:"linear-gradient(135deg,#92400e,#78350f)",border:"1px solid #f59e0b",color:"#fff",borderRadius:10,padding:"9px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold",boxShadow:"0 2px 8px rgba(245,158,11,0.2)"}}>
          ⬆️<br/><span style={{fontSize:10,opacity:0.8}}>강화</span>
        </button>
        <button onClick={()=>setModal("shop")} style={{flex:1,background:"linear-gradient(135deg,#4c1d95,#3b0764)",border:"1px solid #a78bfa",color:"#fff",borderRadius:10,padding:"9px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold",boxShadow:"0 2px 8px rgba(167,139,250,0.2)"}}>
          🪙<br/><span style={{fontSize:10,opacity:0.8}}>{ui.coins}</span>
        </button>
      </div>

      {(drag||selHero)&&(
        <div style={{width:"100%",maxWidth:440,fontSize:11,color:"#fbbf24",marginTop:4,padding:"4px 10px",background:"rgba(251,191,36,0.08)",borderRadius:7,border:"1px solid rgba(251,191,36,0.2)",textAlign:"center"}}>
          📍 이동할 칸 클릭 &nbsp;|&nbsp; 다른 영웅 = 스왑 &nbsp;|&nbsp; 같은 영웅 = 취소
        </div>
      )}

      {/* 선택 영웅 패널 */}
      {selEnemy&&(
        <div style={{width:"100%",maxWidth:440,background:"#0f172a",border:"1px solid #dc262644",borderRadius:12,padding:"10px 12px",marginTop:5}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:20}}>
                {selEnemy.type==="은신"?"👻":selEnemy.type==="공중"?"🦅":selEnemy.type==="분열"?"🔀":selEnemy.type==="재생"?"💚":selEnemy.type==="방패"?"🛡️":selEnemy.type==="돌진"?"💨":selEnemy.isBoss?"💀":"👾"}
              </span>
              <div>
                <span style={{color:"#f87171",fontWeight:"bold",fontSize:13}}>{selEnemy.isBoss?"보스":selEnemy.type} 적</span>
                {selEnemy.isBoss&&selEnemy.isRaging&&<span style={{color:"#ff4500",fontSize:10,marginLeft:4}}>⚠️광폭화</span>}
              </div>
            </div>
            <button onClick={()=>setSelEnemy(null)} style={{background:"transparent",border:"none",color:"#475569",cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <div style={{background:"#1e293b",borderRadius:8,padding:"5px 10px",fontSize:12}}>
              <span style={{color:"#94a3b8"}}>HP </span>
              <span style={{color:"#f87171",fontWeight:"bold"}}>{Math.max(0,Math.floor(selEnemy.hp))}</span>
              <span style={{color:"#475569"}}> / {selEnemy.maxHp}</span>
            </div>
            <div style={{background:"#1e293b",borderRadius:8,padding:"5px 10px",fontSize:12}}>
              <span style={{color:"#94a3b8"}}>체력 </span>
              <span style={{color:"#22c55e",fontWeight:"bold"}}>{Math.round((selEnemy.hp/selEnemy.maxHp)*100)}%</span>
            </div>
            {selEnemy.isBoss&&selEnemy.weak&&(
              <div style={{background:"#1e293b",borderRadius:8,padding:"5px 10px",fontSize:12}}>
                <span style={{color:"#94a3b8"}}>약점 </span>
                {selEnemy.weak.map(w=><span key={w} style={{color:"#fbbf24",fontWeight:"bold",marginRight:3}}>{EE[w]||w}{EN[w]||w}</span>)}
              </div>
            )}
            {selEnemy.stunTimer>0&&<span style={{background:"#78350f",color:"#fcd34d",borderRadius:6,padding:"3px 8px",fontSize:11}}>⚡스턴 {selEnemy.stunTimer.toFixed(1)}s</span>}
            {selEnemy.rootTimer>0&&<span style={{background:"#14532d",color:"#86efac",borderRadius:6,padding:"3px 8px",fontSize:11}}>🌿속박 {selEnemy.rootTimer.toFixed(1)}s</span>}
            {selEnemy.rootImmune>0&&<span style={{background:"#1e293b",color:"#64748b",borderRadius:6,padding:"3px 8px",fontSize:11}}>🛡속박면역 {selEnemy.rootImmune.toFixed(1)}s</span>}
            {selEnemy.slowTimer>0&&<span style={{background:"#0c4a6e",color:"#7dd3fc",borderRadius:6,padding:"3px 8px",fontSize:11}}>❄️슬로우 {selEnemy.slowTimer.toFixed(1)}s</span>}
            {selEnemy.dotTimer>0&&<span style={{background:"#14532d",color:"#4ade80",borderRadius:6,padding:"3px 8px",fontSize:11}}>☠️독 {selEnemy.dotTimer.toFixed(1)}s</span>}
            {selEnemy.debuff&&selEnemy.debuffTimer>0&&<span style={{background:"#450a0a",color:"#fca5a5",borderRadius:6,padding:"3px 8px",fontSize:11}}>💧방어감소 {selEnemy.debuffTimer.toFixed(1)}s</span>}
          </div>
        </div>
      )}
      {selHeroObj&&(
        <div style={{width:"100%",maxWidth:440,background:"#0f172a",border:`1px solid ${GC[selHeroObj.grade]||"#fa0"}66`,borderRadius:12,padding:"10px 12px",marginTop:5,boxShadow:`0 0 12px ${GC[selHeroObj.grade]||"#fa0"}22`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:40,height:40,borderRadius:10,background:`${GC[selHeroObj.grade]||"#aaa"}22`,border:`1px solid ${GC[selHeroObj.grade]||"#aaa"}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
              {EE[selHeroObj.element]||"?"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{color:GC[selHeroObj.grade],fontWeight:"bold",fontSize:13}}>{EN[selHeroObj.element]||selHeroObj.element}</span>
                <span style={{background:`${GC[selHeroObj.grade]||"#aaa"}22`,color:GC[selHeroObj.grade],fontSize:10,borderRadius:4,padding:"1px 5px",border:`1px solid ${GC[selHeroObj.grade]||"#aaa"}44`}}>{selHeroObj.grade}</span>
                {selHeroObj.enhLv>0&&<span style={{color:"#fcd34d",fontSize:11,fontWeight:"bold"}}>+{selHeroObj.enhLv}</span>}
              </div>
              <div style={{display:"flex",gap:8,marginTop:2,fontSize:10,color:"#64748b"}}>
                <span>⚔️{Math.floor((selHeroObj.atk+(selHeroObj.enhLv||0)*5))}</span>
                <span>💨{((selHeroObj.spd||1)*100).toFixed(0)}%</span>
                <span>🎯{(selHeroObj.range||3.0).toFixed(1)}</span>
              </div>
              {(()=>{
                const trait=getElTrait(elBase(selHeroObj.element));
                const traitColor={single:"#64748b",splash:"#f97316",chain:"#fbbf24",pierce:"#60a5fa",dot:"#4ade80",root:"#22c55e",stun:"#fcd34d",debuff:"#ef4444",slow:"#7dd3fc",heal:"#86efac"}[trait.type]||"#64748b";
                return(
                  <div style={{marginTop:4,display:"flex",gap:4,flexWrap:"wrap"}}>
                    <span style={{background:traitColor+"22",border:`1px solid ${traitColor}55`,borderRadius:5,padding:"1px 6px",fontSize:10,color:traitColor,fontWeight:"bold"}}>
                      {trait.desc}
                    </span>
                    <span style={{fontSize:10,color:"#475569"}}>{trait.detail}</span>
                  </div>
                );
              })()}
            </div>
            <button onClick={()=>setSelHero(null)} style={{background:"#1e293b",border:"1px solid #334155",color:"#64748b",borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:13}}>✕</button>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:8}}>
            <button onClick={()=>{setSelHero(null);setDragBoth(selHeroObj.id);}} style={{flex:1,background:"#1d4ed8",border:"none",color:"#fff",borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>📍 이동</button>
            {canEnhance(selHeroObj)?
              <button onClick={()=>doEnhance(selHeroObj.id)} style={{flex:1,background:"#78350f",border:"1px solid #f59e0b",color:"#fcd34d",borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>⬆️ {enhCost(selHeroObj)}G <span style={{fontSize:9,opacity:0.7}}>({selHeroObj.enhLv||0}/{maxEnh(selHeroObj)})</span></button>
              :<div style={{flex:1,background:"#1e293b",border:"1px solid #334155",color:"#475569",borderRadius:8,padding:"6px",fontSize:11,textAlign:"center"}}>{ENHANCE_GRADES.includes(selHeroObj.grade)?"최대강화":"강화불가"}</div>
            }
            <button onClick={()=>doSell(selHeroObj.id)} style={{flex:1,background:"#450a0a",border:"1px solid #ef4444",color:"#fca5a5",borderRadius:8,padding:"6px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>💰+{SELL_PRICE[selHeroObj.grade]||5}G</button>
          </div>
          {combOpts.length>0&&(<><div style={{fontSize:11,color:"#aaa",marginBottom:5}}>⚗️ 조합 가능</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {combOpts.map((r,i)=>(
                <button key={i} onClick={()=>doCombine(selHero,r)}
                  style={{background:hr(GC[r.g]||"#888",0.13),border:`1px solid ${GC[r.g]||"#888"}`,borderRadius:8,padding:"4px 9px",cursor:"pointer",color:"#eee",fontSize:11}}>
                  {EE[r.r]||""} {EN[r.r]||r.r} <span style={{color:GC[r.g],fontSize:10}}>[{r.g}]</span>
                </button>
              ))}
            </div></>)}
          {combOpts.length===0&&<div style={{fontSize:11,color:"#555"}}>조합 가능한 재료 없음</div>}
        </div>
      )}

      {/* 영웅 목록 */}
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:4,flexWrap:"wrap",marginTop:5,paddingBottom:4}}>
        {heroes.map(h=>{
          const isSel=h.id===selHero,isDrag=h.id===drag;
          const gc=GC[h.grade]||"#6b7280";
          return(
            <div key={h.id}
              onClick={()=>onHero(h)}
              onTouchStart={(e)=>{
                e.preventDefault();
                longPressTimer.current=setTimeout(()=>{
                  longPressTimer.current=null;
                  setDetailHero(h);
                },450);
              }}
              onTouchEnd={()=>{
                if(longPressTimer.current){clearTimeout(longPressTimer.current);longPressTimer.current=null;}
              }}
              onTouchMove={()=>{
                if(longPressTimer.current){clearTimeout(longPressTimer.current);longPressTimer.current=null;}
              }}
              style={{background:isSel?`${gc}20`:isDrag?"#1e3a5f":"#0f172a",
                border:`2px solid ${isSel?gc:isDrag?"#60a5fa":gc+"44"}`,
                borderRadius:9,padding:"5px 6px",cursor:"pointer",minWidth:50,textAlign:"center",
                boxShadow:isSel?`0 0 10px ${gc}55`:"none",
                transition:"border-color 0.15s",userSelect:"none",WebkitUserSelect:"none"}}>
              <div style={{fontSize:18,lineHeight:1.2}}>{EE[h.element]||"?"}</div>
              <div style={{fontSize:8,color:gc,fontWeight:"bold",lineHeight:1.2}}>{h.grade}</div>
              {h.enhLv>0&&<div style={{fontSize:8,color:"#fcd34d",fontWeight:"bold"}}>+{h.enhLv}</div>}
            </div>
          );
        })}
      </div>

      {/* 유닛 상세정보 모달 (롱프레스) */}
      {detailHero&&(()=>{
        const dh=detailHero;
        const gc2=GC[dh.grade]||"#aaa";
        const trait=getElTrait(elBase(dh.element));
        const traitColor={single:"#64748b",splash:"#f97316",chain:"#fbbf24",pierce:"#60a5fa",dot:"#4ade80",root:"#22c55e",stun:"#fcd34d",debuff:"#ef4444",slow:"#7dd3fc",heal:"#86efac"}[trait.type]||"#64748b";
        const atkVal=Math.floor((dh.atk+(dh.enhLv||0)*5));
        const spdVal=((dh.spd||1)*100).toFixed(0);
        const rngVal=((dh.range||3.0)+(buff.rangeBonus||0)).toFixed(1);
        return(
          <div onClick={()=>setDetailHero(null)}
            style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20}}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:"#0f172a",border:`2px solid ${gc2}`,borderRadius:16,padding:20,width:"100%",maxWidth:320,boxShadow:`0 0 30px ${gc2}44`}}>
              {/* 헤더 */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{width:56,height:56,borderRadius:12,background:`${gc2}22`,border:`2px solid ${gc2}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>
                  {EE[dh.element]||"?"}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:"bold",color:"#f1f5f9"}}>{EN[dh.element]||dh.element}</div>
                  <div style={{display:"flex",gap:6,marginTop:3,alignItems:"center"}}>
                    <span style={{background:`${gc2}22`,color:gc2,fontSize:11,borderRadius:5,padding:"1px 7px",border:`1px solid ${gc2}44`,fontWeight:"bold"}}>{dh.grade}</span>
                    {dh.enhLv>0&&<span style={{color:"#fcd34d",fontSize:12,fontWeight:"bold"}}>+{dh.enhLv}</span>}
                  </div>
                </div>
                <button onClick={()=>setDetailHero(null)} style={{background:"none",border:"none",color:"#475569",fontSize:20,cursor:"pointer"}}>✕</button>
              </div>

              {/* 스탯 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[
                  {label:"공격력",value:atkVal,icon:"⚔️",color:"#f87171"},
                  {label:"공속",value:spdVal+"%",icon:"💨",color:"#60a5fa"},
                  {label:"사거리",value:rngVal,icon:"🎯",color:"#a78bfa"},
                ].map(s=>(
                  <div key={s.label} style={{background:"#1e293b",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:16,marginBottom:2}}>{s.icon}</div>
                    <div style={{fontSize:14,fontWeight:"bold",color:s.color}}>{s.value}</div>
                    <div style={{fontSize:9,color:"#64748b",marginTop:1}}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 특성 */}
              <div style={{background:"#1e293b",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>속성 특성</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{background:traitColor+"22",border:`1px solid ${traitColor}55`,borderRadius:6,padding:"3px 10px",fontSize:12,color:traitColor,fontWeight:"bold",flexShrink:0}}>
                    {trait.desc}
                  </span>
                  <span style={{fontSize:11,color:"#94a3b8"}}>{trait.detail}</span>
                </div>
              </div>

              {/* 속성 */}
              <div style={{background:"#1e293b",borderRadius:10,padding:"10px 12px",marginBottom:16}}>
                <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>속성</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>{EE[elBase(dh.element)]||EE[dh.element]||"?"}</span>
                  <span style={{fontSize:13,color:"#e2e8f0"}}>{elBase(dh.element)}</span>
                  {elBase(dh.element)!==dh.element&&<span style={{fontSize:11,color:"#475569"}}>({dh.element})</span>}
                </div>
              </div>

              {/* 버튼 */}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setDetailHero(null);setSelHero(dh.id===selHero?null:dh.id);}}
                  style={{flex:1,background:"#1d4ed8",border:"none",color:"#fff",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:"bold"}}>
                  선택
                </button>
                <button onClick={()=>setDetailHero(null)}
                  style={{flex:1,background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13}}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 히든영웅 버프 */}
      {hd&&(
        <div style={{width:"100%",maxWidth:440,background:hr(hd.color,0.07),border:`1px solid ${hd.color}44`,borderRadius:10,padding:"6px 12px",marginTop:4,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20}}>{hd.emoji}</span>
          <span style={{color:hd.color,fontWeight:"bold",fontSize:12}}>{hd.name}</span>
          <span style={{color:"#86efac",fontSize:11,flex:1}}>{hd.desc}</span>
          <span style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px #22c55e",flexShrink:0,display:"inline-block"}}/>
        </div>
      )}

      {/* 모달들 */}
      {modal&&modal.type==="coinPick"&&(()=>{
        const item=modal.item;
        const pool=item.grade==="노말"?BASE:item.grade==="고급"?[...new Set(COMBO.filter(r=>r.g==="고급").map(r=>r.r))]:item.grade==="영웅"?[...new Set(COMBO.filter(r=>r.g==="영웅").map(r=>r.r))]:[...new Set(RECIPES.filter(r=>r.g==="전설").map(r=>r.r))];
        return(<Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:item.color,marginBottom:4,textAlign:"center"}}>{item.label}</div>
          <div style={{color:"#a78bfa",fontSize:13,marginBottom:10,textAlign:"center"}}>🪙 {item.cost}개 사용</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:12}}>
            {pool.map(el=>(<button key={el} onClick={()=>buyCoinByElement(item,el)} style={{background:(EC[el]||"#888")+"33",border:`1px solid ${EC[el]||"#888"}`,borderRadius:10,padding:"8px 6px",cursor:"pointer",color:"#eee",fontSize:12,minWidth:52,textAlign:"center"}}><div style={{fontSize:18}}>{EE[el]||"?"}</div><div style={{fontSize:9,color:GC[item.grade]}}>{item.grade}</div><div style={{fontSize:9}}>{el}</div></button>))}
          </div>
          <Btn bg="#444" onClick={()=>setModal("shop")} style={{width:"100%"}}>← 뒤로</Btn>
        </Overlay>);
      })()}

      {modal==="gradeEnh"&&(()=>{
        return(<Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#fd0",marginBottom:4,textAlign:"center"}}>⬆️ 등급 강화</div>
          <div style={{color:"#aaa",fontSize:11,marginBottom:10,textAlign:"center"}}>강화 시 해당 등급 전 유닛에 즉시 적용</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {["노말","고급","영웅","전설","신화","불멸"].map(grade=>{
              const lv=getGradeEnhLv(grade);const cost=GRADE_ENH_COST[grade]*(lv+1);const bonus=GRADE_ENH_BONUS[grade];
              const count=heroes.filter(h=>h.grade===grade).length;const canAfford=ui.gold>=cost;
              return(<div key={grade} style={{background:"#21262d",borderRadius:9,padding:"8px 12px",border:`1px solid ${GC[grade]||"#444"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div><span style={{color:GC[grade],fontWeight:"bold",fontSize:13}}>{grade}</span><span style={{color:"#555",fontSize:11,marginLeft:6}}>보유 {count}개</span>{lv>0&&<span style={{color:"#fd0",fontSize:11,marginLeft:6}}>Lv.{lv}</span>}</div>
                  <button onClick={()=>doGradeEnhance(grade)} disabled={!canAfford||lv>=MAX_GRADE_ENH} style={{background:canAfford&&lv<MAX_GRADE_ENH?GC[grade]+"33":"#333",border:`1px solid ${canAfford&&lv<MAX_GRADE_ENH?GC[grade]:"#444"}`,color:canAfford&&lv<MAX_GRADE_ENH?GC[grade]:"#555",borderRadius:7,padding:"4px 12px",cursor:canAfford&&lv<MAX_GRADE_ENH?"pointer":"not-allowed",fontSize:12,fontWeight:"bold"}}>{lv>=MAX_GRADE_ENH?"최대":"💰 "+cost+"G"}</button>
                </div>
                <div style={{fontSize:10,color:"#888"}}>ATK+{bonus.atk}/SPD+{(bonus.spd*100).toFixed(0)}%{lv>0&&<span style={{color:"#fd0",marginLeft:6}}>누적: ATK+{bonus.atk*lv}</span>}</div>
              </div>);
            })}
          </div>
          <Btn bg="#333" onClick={()=>setModal(null)} style={{width:"100%"}}>닫기</Btn>
        </Overlay>);
      })()}

      {modal==="merge"&&(()=>{
        const sameGroups=getSameElementGroups();const stackEntries=Object.entries(stacks).filter(([,n])=>n>0);
        return(<Overlay>
          <Btn bg="#444" onClick={()=>{setModal(null);setRandomPicks([]);randomPicksRef.current=[];}} style={{width:"100%",marginBottom:10}}>닫기</Btn>
          <div style={{fontSize:15,fontWeight:"bold",color:"#4f8",marginBottom:10,textAlign:"center"}}>✨ 뭉치기</div>
          {stackEntries.length>0&&(<div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#4f8",marginBottom:6}}>📦 보관함</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {stackEntries.map(([el,cnt])=>(<div key={el} style={{background:hr(EC[el]||"#888",0.13),border:`1px solid ${EC[el]||"#888"}`,borderRadius:10,padding:"6px 10px",textAlign:"center",minWidth:68}}>
                <div style={{fontSize:20}}>{EE[el]||"?"}</div><div style={{fontSize:11,color:"#eee"}}>{el}</div>
                <div style={{fontSize:13,color:"#fd0",fontWeight:"bold",margin:"2px 0"}}>×{cnt}</div>
                <div style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>
                  <button onClick={()=>popStack(el)} style={{background:"#1f6feb",border:"none",color:"#fff",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10}}>빼기</button>
                  <button onClick={()=>popStackAll(el)} style={{background:"#0a3a7a",border:"1px solid #4af",color:"#4af",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10}}>모두빼기</button>
                </div>
                {cnt>=2&&<button onClick={()=>stackCombine(el)} style={{background:"#553300",border:"1px solid #fd0",color:"#fd0",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10,marginTop:3,width:"100%"}}>조합</button>}
              </div>))}
            </div>
          </div>)}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#aaa",marginBottom:6}}>🔗 배치된 유닛 보관함에 넣기</div>
            {sameGroups.length===0&&<div style={{fontSize:11,color:"#555"}}>배치된 유닛 없음</div>}
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {sameGroups.map(({el,arr})=>(<div key={el} style={{background:"#21262d",borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                <span style={{fontSize:13}}>{EE[el]||""} {el} <b style={{color:"#aaa"}}>×{arr.length}</b></span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>doStack(el,1)} style={{background:"#4f844",border:"1px solid #4f8",color:"#4f8",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>넣기</button>
                  <button onClick={()=>doStack(el,arr.length)} style={{background:"#1a3a1a",border:"1px solid #4f8",color:"#4f8",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>모두넣기</button>
                </div>
              </div>))}
            </div>
          </div>
          <div style={{borderTop:"1px solid #30363d",paddingTop:10}}>
            <div style={{fontSize:12,color:"#aaa",marginBottom:6}}>🎲 무작위 3개 조합 <span style={{color:"#fd0"}}>({randomPicks.length}/3)</span></div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {heroes.map(h=>{const isPicked=randomPicks.includes(h.id);return(<div key={h.id} onClick={()=>toggleRandomPick(h.id)} style={{background:isPicked?"rgba(80,200,80,0.2)":"#21262d",border:`2px solid ${isPicked?"#4f8":GC[h.grade]||"#444"}`,borderRadius:7,padding:"4px 6px",cursor:"pointer",textAlign:"center",minWidth:44}}><div style={{fontSize:16}}>{EE[h.element]||"?"}</div><div style={{fontSize:8,color:GC[h.grade]}}>{h.grade}</div></div>);})}
            </div>
            <Btn bg={randomPicks.length===3?"#1a5c2a":"#333"} onClick={doRandomMerge} disabled={randomPicks.length!==3} style={{width:"100%",marginBottom:8}}>🎲 조합하기 {randomPicks.length===3?"":"(3개 선택)"}</Btn>
          </div>
        </Overlay>);
      })()}

      {modal==="shop"&&(<Overlay>
        <div style={{fontSize:15,fontWeight:"bold",color:"#a78bfa",marginBottom:4,textAlign:"center"}}>🪙 코인 상점</div>
        <div style={{color:"#fd0",fontSize:13,marginBottom:10,textAlign:"center"}}>보유: {ui.coins}개 | {ui.round}라운드</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
          {SHOP_ITEMS.map(item=>{const locked=ui.round<item.unlockRound;return(<button key={item.id} onClick={()=>!locked&&buyWithCoin(item)} disabled={ui.coins<item.cost||locked} style={{background:locked?"#21262d":ui.coins>=item.cost?item.color+"22":"#21262d",border:`1px solid ${locked?"#333":ui.coins>=item.cost?item.color:"#333"}`,borderRadius:8,padding:"9px 14px",cursor:locked||ui.coins<item.cost?"not-allowed":"pointer",color:locked?"#444":ui.coins>=item.cost?"#eee":"#555",fontSize:13,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:locked?"#444":item.color,fontWeight:"bold"}}>{locked?`🔒 ${item.label} (${item.unlockRound}R~)`:item.label}</span><span style={{color:locked?"#444":"#a78bfa",fontWeight:"bold"}}>🪙 {item.cost}</span></button>);})}
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn bg={ui.round>=10?"#1a3a2a":"#21262d"} onClick={()=>{if(ui.round<10){alert("도박장은 10라운드 이후!");return;}setModal("gamble");}} style={{flex:1,color:ui.round>=10?undefined:"#555"}}>{ui.round>=10?"🎲 도박장":"🔒 도박장(10R~)"}</Btn>
          <Btn bg="#333" onClick={()=>setModal(null)} style={{flex:1}}>닫기</Btn>
        </div>
      </Overlay>)}

      {modal==="gamble"&&(()=>{
        const doGamble=(table,cost,isGold)=>{
          const g=G.current;
          if(isGold&&g.gold<cost){alert("골드 부족!");return;}
          if(!isGold&&g.coins<cost){alert("코인 부족!");return;}
          if(isGold)g.gold-=cost;else g.coins-=cost;
          const rand=Math.random();let acc=0,chosen=table.results[table.results.length-1];
          for(const r of table.results){acc+=r.prob;if(rand<acc){chosen=r;break;}}
          if(chosen.reward==="gold")g.gold+=chosen.val;else g.coins+=chosen.val;
          sync();alert(`${chosen.val===0?"😢":chosen.desc.includes("🎉")?"🎉":"😊"} ${chosen.desc}`);
        };
        return(<Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#fd0",marginBottom:10,textAlign:"center"}}>🎲 도박장</div>
          <div style={{color:"#aaa",fontSize:11,marginBottom:10,textAlign:"center"}}>💰{ui.gold}G | 🪙{ui.coins}</div>
          <div style={{fontSize:12,color:"#4af",marginBottom:6,fontWeight:"bold"}}>💰 골드 도박</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
            {GAMBLE_GOLD.map(t=>(<button key={t.cost} onClick={()=>doGamble(t,t.cost,true)} disabled={ui.gold<t.cost} style={{background:ui.gold>=t.cost?"#2a1a00":"#21262d",border:`1px solid ${ui.gold>=t.cost?"#fd0":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:ui.gold>=t.cost?"pointer":"not-allowed",color:ui.gold>=t.cost?"#fd0":"#555",fontSize:12,display:"flex",justifyContent:"space-between"}}><span>{t.label}</span><span style={{color:"#aaa",fontSize:11}}>최대 {t.results[t.results.length-1].desc}</span></button>))}
          </div>
          <div style={{fontSize:12,color:"#a78bfa",marginBottom:6,fontWeight:"bold"}}>🪙 코인 도박</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
            {GAMBLE_COIN.map(t=>(<button key={t.cost} onClick={()=>doGamble(t,t.cost,false)} disabled={ui.coins<t.cost} style={{background:ui.coins>=t.cost?"#1a0a2a":"#21262d",border:`1px solid ${ui.coins>=t.cost?"#a78bfa":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:ui.coins>=t.cost?"pointer":"not-allowed",color:ui.coins>=t.cost?"#a78bfa":"#555",fontSize:12,display:"flex",justifyContent:"space-between"}}><span>{t.label}</span><span style={{color:"#aaa",fontSize:11}}>최대 {t.results[t.results.length-1].desc}</span></button>))}
          </div>
          <div style={{fontSize:12,color:"#4f8",marginBottom:6,fontWeight:"bold",borderTop:"1px solid #30363d",paddingTop:10}}>⚔️ 유닛 도박</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
            {[
              {cost:1,label:"🪙1 — 고급~영웅",desc:"고급60%/영웅30%/꽝10%",fn:()=>{
                const g=G.current;if(g.coins<1){alert("코인 부족!");return;}g.coins-=1;const r=Math.random();
                let grade=null;if(r>=0.10&&r<0.70)grade="고급";else if(r>=0.70)grade="영웅";
                if(grade){const pool=grade==="고급"?[...new Set(COMBO.filter(x=>x.g==="고급").map(x=>x.r))]:[...new Set(COMBO.filter(x=>x.g==="영웅").map(x=>x.r))];const el=pool[Math.floor(Math.random()*pool.length)];const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();draw();alert(`✨ ${EE[el]||""} ${el} [${grade}] 획득!`);}else{sync();alert("😢 꽝...");}
              }},
              {cost:3,label:"🪙3 — 영웅~신화",desc:"영웅50%/전설35%/신화10%/꽝5%",fn:()=>{
                const g=G.current;if(g.coins<3){alert("코인 부족!");return;}g.coins-=3;const r=Math.random();
                let grade=null;if(r>=0.05&&r<0.55)grade="영웅";else if(r>=0.55&&r<0.90)grade="전설";else if(r>=0.90)grade=g.round>=20?"신화":"전설";
                if(grade){const pool=grade==="신화"?[...new Set(RECIPES.filter(x=>x.g==="신화").map(x=>x.r))]:grade==="전설"?[...new Set(RECIPES.filter(x=>x.g==="전설").map(x=>x.r))]:grade==="영웅"?[...new Set(COMBO.filter(x=>x.g==="영웅").map(x=>x.r))]:[...new Set(COMBO.filter(x=>x.g==="고급").map(x=>x.r))];const el=pool.length?pool[Math.floor(Math.random()*pool.length)]:BASE[Math.floor(Math.random()*BASE.length)];const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();draw();triggerSummon(el,grade);if(!["전설","신화","불멸"].includes(grade))alert(`✨ ${EE[el]||""} ${el} [${grade}] 획득!`);}else{sync();alert("😢 꽝...");}
              }},
              {cost:5,label:"🪙5 — 신화 (35R↑)",desc:"신화60%/무속성30%/꽝10%",fn:()=>{
                const g=G.current;if(g.coins<5){alert("코인 부족!");return;}if(g.round<35){alert("35라운드 이후 해금!");return;}g.coins-=5;const r=Math.random();
                if(r<0.10){sync();alert("😢 꽝...");return;}
                if(r<0.70){const pool=[...new Set(RECIPES.filter(x=>x.g==="신화").map(x=>x.r))];const el=pool.length?pool[Math.floor(Math.random()*pool.length)]:BASE[0];const h=mkH(el,"신화",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();draw();triggerSummon(el,"신화");}
                else{const h=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();draw();alert("⭐ 무속성 유닛 획득!");}
              }},
            ].map(item=>(<button key={item.cost} onClick={item.fn} disabled={ui.coins<item.cost||(item.cost===5&&ui.round<35)} style={{background:ui.coins>=item.cost&&!(item.cost===5&&ui.round<35)?"#0a2a1a":"#21262d",border:`1px solid ${ui.coins>=item.cost&&!(item.cost===5&&ui.round<35)?"#4f8":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:ui.coins>=item.cost&&!(item.cost===5&&ui.round<35)?"pointer":"not-allowed",color:ui.coins>=item.cost&&!(item.cost===5&&ui.round<35)?"#eee":"#555",fontSize:12,textAlign:"left"}}><div style={{fontWeight:"bold",color:item.cost===5?"#f44":item.cost===3?"#fa0":"#4af"}}>{item.label}</div><div style={{fontSize:10,color:"#888",marginTop:2}}>{item.desc}</div></button>))}
          </div>
          <Btn bg="#444" onClick={()=>setModal("shop")} style={{width:"100%"}}>← 뒤로</Btn>
        </Overlay>);
      })()}

      {/* 조합표 */}
      {showCombo&&(()=>{
        // 전설이상: 유닛 클릭 선택 방식
        const unitCnt={};for(const h of heroes)unitCnt[h.element]=(unitCnt[h.element]||0)+1;
        const allTabs=["고급","영웅","전설","신화","불멸"];
        const unlockedGrades=G.current?.unlockedGrades||["노말","고급","영웅"];
        const tabs=allTabs.filter(t=>unlockedGrades.includes(t));
        const isHighGrade=["전설","신화","불멸"].includes(comboFilter);
        const curRecipes=isHighGrade?RECIPES.filter(r=>r.g===comboFilter):[];
        const curCombos=!isHighGrade?fCombo:[];
        return(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={()=>setShowCombo(false)}>
          <div style={{background:"#161b22",borderRadius:14,padding:16,border:"1px solid #30363d",width:"92%",maxWidth:360,maxHeight:"88vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            {/* 헤더 */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontWeight:"bold",fontSize:15}}>⚗️ 조합표</div>
              <button onClick={()=>setShowCombo(false)} style={{background:"none",border:"none",color:"#666",fontSize:18,cursor:"pointer",padding:"0 4px"}}>✕</button>
            </div>
            {/* 탭 */}
            <div style={{display:"flex",gap:4,marginBottom:12,flexShrink:0}}>
              {tabs.map(g=>(
                <button key={g} onClick={()=>setComboFilter(g)}
                  style={{flex:1,background:comboFilter===g?(GC[g]||"#444")+"33":"#21262d",
                    border:`2px solid ${comboFilter===g?(GC[g]||"#aaa"):"#30363d"}`,
                    borderRadius:8,padding:"6px 2px",cursor:"pointer",
                    color:comboFilter===g?(GC[g]||"#eee"):"#555",
                    fontSize:11,fontWeight:comboFilter===g?"bold":"normal",
                    transition:"all 0.15s"}}>
                  {g}
                </button>
              ))}
            </div>
            {/* 콘텐츠 스크롤 영역 - 조합표는 정보만 표시 */}
            <div style={{overflowY:"auto",flex:1}}>
              {(()=>{
                let rows=[];
                if(!isHighGrade){
                  // 고급/영웅: COMBO 전체 표시
                  rows=curCombos.map(r=>({
                    key:r.r,
                    parts:[{u:r.a,n:1},{u:r.b,n:1}],
                    result:r.r,
                    grade:r.g,
                    can:(r.a===r.b?(unitCnt[r.a]||0)>=2:(myEls.has(r.a)&&myEls.has(r.b))),
                  }));
                } else {
                  // 전설/신화/불멸: RECIPES 전체 표시
                  rows=curRecipes.map(recipe=>({
                    key:recipe.r,
                    parts:recipe.parts,
                    result:recipe.r,
                    grade:recipe.g,
                    can:canRecipe(recipe),
                  }));
                }
                if(rows.length===0){
                  return <div style={{color:"#555",fontSize:12,textAlign:"center",marginTop:20}}>조합 없음</div>;
                }
                return rows.map(row=>{
                  const gc=GC[row.grade]||"#aaa";
                  return(
                    <div key={row.key}
                      style={{marginBottom:8,padding:"8px 10px",borderRadius:10,
                        background:row.can?"rgba(80,200,80,0.05)":"rgba(255,255,255,0.02)",
                        border:`1px solid ${row.can?gc+"55":"#222"}`}}>
                      {/* 결과 유닛 */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <span style={{fontSize:20}}>{EE[row.result]||"?"}</span>
                        <span style={{fontSize:13,color:gc,fontWeight:"bold"}}>{EN[row.result]||row.result}</span>
                        {row.can&&<span style={{fontSize:10,color:"#4f8",marginLeft:"auto"}}>✓ 조합가능</span>}
                      </div>
                      {/* 재료 목록 */}
                      <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                        {row.parts.map((p,pi)=>{
                          const have=unitCnt[p.u]||0;
                          const ok=have>=(p.n||1);
                          return(
                            <span key={pi} style={{
                              display:"flex",alignItems:"center",gap:2,
                              background:ok?"rgba(0,80,0,0.35)":"rgba(40,40,40,0.6)",
                              border:`1px solid ${ok?"#3a6a3a":"#333"}`,
                              borderRadius:5,padding:"2px 5px",fontSize:10}}>
                              <span>{EE[p.u]||"?"}</span>
                              <span style={{color:ok?"#8f8":"#888"}}>{EN[p.u]||p.u}</span>
                              {(p.n||1)>1&&<span style={{color:ok?"#4f8":"#666"}}>×{p.n}</span>}
                              <span style={{color:ok?"#4f8":"#555"}}>({have})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
