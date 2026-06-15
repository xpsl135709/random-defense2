import { useState, useRef, useEffect, useCallback } from "react";

const CS=48,COLS=9,ROWS=14;

// ══════════════════════════════════════════
// 맵 정의 (3종)
// 맵A: 지그재그 4단 (단일경로)
// 맵B: S자 5단 (단일경로)
// 맵C: 분기 (두 갈래)
// ══════════════════════════════════════════
const MAP_DEFS={
  A:{
    name:"지그재그",
    spawn:[0,0],
    goal:[8,13],
    // 촘촘한 지그재그: 꺾임 간격 2행, 5단
    buildTrack:()=>{
      const p=[];
      // 1단: →
      for(let c=0;c<=8;c++)p.push([c,0]);
      // 꺾임
      for(let r=1;r<=2;r++)p.push([8,r]);
      // 2단: ←
      for(let c=7;c>=0;c--)p.push([c,2]);
      // 꺾임
      for(let r=3;r<=4;r++)p.push([0,r]);
      // 3단: →
      for(let c=1;c<=8;c++)p.push([c,4]);
      // 꺾임
      for(let r=5;r<=6;r++)p.push([8,r]);
      // 4단: ←
      for(let c=7;c>=0;c--)p.push([c,6]);
      // 꺾임
      for(let r=7;r<=8;r++)p.push([0,r]);
      // 5단: →
      for(let c=1;c<=8;c++)p.push([c,8]);
      // 꺾임
      for(let r=9;r<=10;r++)p.push([8,r]);
      // 6단: ←
      for(let c=7;c>=0;c--)p.push([c,10]);
      // 꺾임
      for(let r=11;r<=12;r++)p.push([0,r]);
      // 7단: → 골로
      for(let c=1;c<=8;c++)p.push([c,12]);
      // 아래 골
      for(let r=13;r<=13;r++)p.push([8,r]);
      return p;
    },
    fork:false,
  },
  B:{
    name:"S자",
    spawn:[0,0],
    goal:[4,13],
    // 넓은 S자: 꺾임 4행 간격, 3단 큰 곡선
    buildTrack:()=>{
      const p=[];
      // 1구간: 왼쪽→오른쪽 상단
      for(let c=0;c<=8;c++)p.push([c,0]);
      // 오른쪽 아래로 길게
      for(let r=1;r<=4;r++)p.push([8,r]);
      // 2구간: 오른쪽→왼쪽 중단
      for(let c=7;c>=0;c--)p.push([c,4]);
      // 왼쪽 아래로 길게
      for(let r=5;r<=9;r++)p.push([0,r]);
      // 3구간: 왼쪽→오른쪽 하단
      for(let c=1;c<=8;c++)p.push([c,9]);
      // 오른쪽 아래로
      for(let r=10;r<=13;r++)p.push([8,r]);
      // 골 방향: 오른쪽 하단에서 가운데로
      for(let c=7;c>=4;c--)p.push([c,13]);
      return p;
    },
    fork:false,
  },
  C:{
    name:"분기",
    spawn:[4,0],
    goal:[4,13],
    // 분기맵: paths = { main, left, right, merge }
    buildTrack:()=>null, // 사용 안함
    fork:true,
    // 분기 경로 정의
    // main: spawn→분기점
    // left: 분기점→합류점 (왼쪽)
    // right: 분기점→합류점 (오른쪽)
    // merge: 합류점→goal
    buildPaths:()=>{
      const main=[];
      for(let r=0;r<=3;r++)main.push([4,r]); // 위→아래 (4,0)→(4,3)

      const left=[];
      // (4,3)→왼쪽→(1,3)→아래→(1,9)→오른쪽→(4,9)
      for(let c=3;c>=1;c--)left.push([c,3]);
      for(let r=4;r<=9;r++)left.push([1,r]);
      for(let c=2;c<=4;c++)left.push([c,9]);

      const right=[];
      // (4,3)→오른쪽→(7,3)→아래→(7,9)→왼쪽→(4,9)
      for(let c=5;c<=7;c++)right.push([c,3]);
      for(let r=4;r<=9;r++)right.push([7,r]);
      for(let c=6;c>=4;c--)right.push([c,9]);

      const merge=[];
      // (4,9)→아래→(4,13)
      for(let r=10;r<=13;r++)merge.push([4,r]);

      return{main,left,right,merge};
    },
  },
};

// 현재 맵 상태 (게임 시작시 결정)
let CURRENT_MAP=null;
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
    // TS = main + left + right + merge 모든 타일
    const allTiles=[
      ...FORK_PATHS.main,
      ...FORK_PATHS.left,
      ...FORK_PATHS.right,
      ...FORK_PATHS.merge,
    ];
    TRACK=allTiles; // 대표용 (실제론 안씀)
    TS=new Set(allTiles.map(([c,r])=>`${c},${r}`));
  } else {
    TRACK=def.buildTrack();
    FORK_PATHS=null;
    TS=new Set(TRACK.map(([c,r])=>`${c},${r}`));
  }
  // 히든영웅 위치: 경로/스폰/골 안 겹치게
  // 분기맵은 (4,6)이 경로 위라 (2,6)으로
  if(mapKey==='C'){CX=2;CY=6;}
  else{CX=4;CY=6;}
  CURRENT_MAP=mapKey;
}

// ══════════════════════════════════════════
// 패치노트
// ══════════════════════════════════════════
const PATCH_NOTES=[
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

const BASE=["불","물","땅","바람","전기","얼음","빛","어둠","소리","독","나무"];
const EC={불:"#f44",물:"#48f",땅:"#a73",바람:"#8d8",전기:"#fd0",얼음:"#8ef",빛:"#ffa",어둠:"#a4f",소리:"#f8c",무속성:"#ccc",독:"#8bc34a",나무:"#4caf50",용암:"#f60",폭풍화염:"#f30",빙하:"#0cf",번개폭풍:"#fa0",공허:"#84a",공명:"#f6f",돌풍:"#afd",화염폭풍:"#f80",해일:"#08f",태풍:"#4fa",번개신:"#ff4",절대영도:"#aef",신성광:"#ffc",심연:"#608",용암폭풍:"#f50",냉기폭풍:"#8df",뇌신:"#fe0",빙하신:"#0ef",빛의신:"#ffe",어둠신:"#404",신성폭풍:"#fda",혼돈:"#628",맹독:"#6db33f",독안개:"#9ccc65",가시숲:"#388e3c",독폭풍:"#7cb342",맹독늪:"#558b2f",지진:"#a73",음파해일:"#08f",용암지진:"#b52",음파폭풍:"#f4c",불의왕:"#f50",빙설신:"#8ef",성음:"#feb",화염제왕:"#f60",파도왕:"#06f",대지왕:"#a63",폭풍왕:"#6d6",번개왕:"#ff0",빙하왕:"#0cf",광명왕:"#ffd",암흑왕:"#a0c",음파왕:"#f9c",혼돈왕:"#c6c",화염신화:"#f40",파도신화:"#04c",폭풍신화:"#0ff",번개신화:"#ff0",빙하신화:"#aff",광명신화:"#ffa",암흑신화:"#609",음파신화:"#f6a",폭풍불멸:"#fff",번개불멸:"#ff8",빙하불멸:"#aff",광명불멸:"#ffd",암흑불멸:"#808",창조불멸:"#faf",용왕불멸:"#fa4",신성불멸:"#ffd",혼돈불멸:"#c0f",궁극불멸:"#fff",화염불멸:"#f80",창조신화:"#f4f",용왕신화:"#f80",신성신화:"#fea",혼돈신화:"#a0f",암흑불멸:"#808",광명불멸:"#ffd"};
const EE={불:"🔥",물:"💧",땅:"🪨",바람:"🌀",전기:"⚡",얼음:"❄️",빛:"✨",어둠:"🌑",소리:"🔊",무속성:"⭐",독:"☠️",나무:"🌿",맹독:"🐍",독안개:"🌫️",가시숲:"🌵",독폭풍:"💀",맹독늪:"🌑",용암:"👺",폭풍화염:"💣",빙하:"🧊",번개폭풍:"🦅",공허:"🧛",공명:"🦇",돌풍:"💨",화염폭풍:"😈",해일:"🧟",번개신:"💀",절대영도:"🐍",신성광:"🧝",심연:"🧟",용암폭풍:"🪓",냉기폭풍:"🥶",태풍:"🌪️",뇌신:"⚡",빙하신:"❄️",빛의신:"🌟",어둠신:"💀",신성폭풍:"🪽",혼돈:"🌀",폭풍신화:"👑",번개신화:"⚡",빙하신화:"❄️",광명신화:"🌟",암흑신화:"🌑",창조신화:"✨",용왕신화:"🐉",신성신화:"👑",혼돈신화:"🌀",폭풍불멸:"🌊",번개불멸:"⚡",빙하불멸:"❄️",광명불멸:"🌟",암흑불멸:"🌑",창조불멸:"✨",용왕불멸:"🐉",신성불멸:"👑",혼돈불멸:"🌀",궁극불멸:"💫"};
const EN={불:"화염정령",물:"물정령",땅:"대지정령",바람:"바람정령",전기:"번개정령",얼음:"서리정령",빛:"빛의정령",어둠:"어둠정령",소리:"음파정령",무속성:"무속성",독:"독정령",나무:"나무정령",맹독:"맹독정령",독안개:"독안개",가시숲:"가시숲정령",독폭풍:"독폭풍",맹독늪:"맹독늪",용암:"고블린",폭풍화염:"화염폭탄병",빙하:"빙하유령",번개폭풍:"폭풍매",공허:"뱀파이어",공명:"음파박쥐",돌풍:"돌풍조",화염폭풍:"임프",해일:"구울",번개신:"스켈레톤",절대영도:"코볼트",신성광:"하피",심연:"좀비",용암폭풍:"오크전사",냉기폭풍:"냉기마법사",태풍:"폭풍독수리",뇌신:"뇌신전사",빙하신:"빙하신수",빛의신:"신성폭격수",어둠신:"드레드로드",신성폭풍:"타락천사",혼돈:"혼돈술사",폭풍신화:"폭풍의신",번개신화:"번개의신",빙하신화:"빙하의신",광명신화:"광명의신",암흑신화:"암흑의신",창조신화:"창조신",용왕신화:"용왕",신성신화:"신성군주",혼돈신화:"혼돈신",폭풍불멸:"폭풍불멸",번개불멸:"번개불멸",빙하불멸:"빙하불멸",광명불멸:"광명불멸",암흑불멸:"암흑불멸",창조불멸:"창조불멸",용왕불멸:"용왕불멸",신성불멸:"신성불멸",혼돈불멸:"혼돈불멸",궁극불멸:"궁극불멸",화염제왕:"화염제왕",파도왕:"파도왕",대지왕:"대지왕",폭풍왕:"폭풍왕",번개왕:"번개왕",빙하왕:"빙하왕",광명왕:"광명왕",암흑왕:"암흑왕",음파왕:"음파왕",혼돈왕:"혼돈왕",화염신화:"화염신화",파도신화:"파도신화",음파신화:"음파신화",화염불멸:"화염불멸",지진:"지진정령",음파해일:"음파해일",용암지진:"용암지진",음파폭풍:"음파폭풍",불의왕:"불의왕",빙설신:"빙설신",성음:"성음"};
const hr=(hex,a)=>{const h=hex.replace('#','');const l=h.length===3?h[0]+h[0]+h[1]+h[1]+h[2]+h[2]:h;return `rgba(${parseInt(l.slice(0,2),16)},${parseInt(l.slice(2,4),16)},${parseInt(l.slice(4,6),16)},${a})`;};
const GC={노말:"#aaa",고급:"#4af",영웅:"#a4f",전설:"#fa0",신화:"#f44",불멸:"#f8f"};
const ATK_MAP={노말:7,고급:20,영웅:40,전설:65,신화:95,불멸:145};
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
];

const HH=[
  {id:"warrior",name:"전사",emoji:"⚔️",color:"#c33",desc:"ATK×1.75, SPD+15%",buff:{atkMul:1.75,atk:0,spd:0.15,magic:0}},
  {id:"mage",name:"마법사",emoji:"🧙",color:"#63c",desc:"ATK×1.5, 마법+40%",buff:{atkMul:1.5,atk:0,spd:0,magic:0.40}},
  {id:"rogue",name:"도적",emoji:"🗡️",color:"#363",desc:"ATK×1.5, SPD+30%",buff:{atkMul:1.5,atk:0,spd:0.30,magic:0}},
  {id:"archer",name:"궁수",emoji:"🏹",color:"#c83",desc:"ATK×1.6, SPD+20%",buff:{atkMul:1.6,atk:0,spd:0.20,magic:0}},
  {id:"healer",name:"힐러",emoji:"💚",color:"#3c6",desc:"ATK×1.4, SPD+25%, 마법+25%",buff:{atkMul:1.4,atk:0,spd:0.25,magic:0.25}},
];
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
const EL_BASE={"불":"불","물":"물","땅":"땅","바람":"바람","전기":"전기","얼음":"얼음","빛":"빛","어둠":"어둠","소리":"소리","무속성":"무속성","독":"독","나무":"나무","맹독":"독","독안개":"독","가시숲":"나무","독폭풍":"독","맹독늪":"나무","화염폭풍":"불","해일":"물","지진":"땅","돌풍":"바람","번개신":"전기","절대영도":"얼음","신성광":"빛","심연":"어둠","공명":"소리","용암":"불","빙하":"물","번개폭풍":"바람","공허":"빛","폭풍화염":"불","음파해일":"물","용암폭풍":"불","냉기폭풍":"물","뇌신":"전기","빙하신":"얼음","빛의신":"빛","어둠신":"어둠","성음":"소리","태풍":"바람","용암지진":"땅","음파폭풍":"물","불의왕":"불","빙설신":"물","신성폭풍":"빛","화염제왕":"불","파도왕":"물","대지왕":"땅","폭풍왕":"바람","번개왕":"전기","빙하왕":"얼음","광명왕":"빛","암흑왕":"어둠","음파왕":"소리","혼돈왕":"빛","화염신화":"불","파도신화":"물","폭풍신화":"바람","번개신화":"전기","빙하신화":"얼음","광명신화":"빛","암흑신화":"어둠","음파신화":"소리","폭풍불멸":"바람","빙하불멸":"얼음","광명불멸":"빛","화염불멸":"불","궁극불멸":"바람"};
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
  "폭풍불멸":5.0,"빙하불멸":3.0,"광명불멸":6.5,"화염불멸":3.5,"궁극불멸":7.0,
};
// 등급별 사거리 보정
const GRADE_RANGE_BONUS={"노말":0,"고급":0.2,"영웅":0.4,"전설":0.6,"신화":0.8,"불멸":1.2};
const getRange=(el,grade)=>{
  const base=EL_RANGE[el]||3.0;
  const bonus=GRADE_RANGE_BONUS[grade]||0;
  return Math.min(base+bonus, 7.0);
};

const ICE_UNITS=new Set(["얼음","절대영도","빙하","빙하신","빙설신","빙하왕","빙하신화","빙하불멸"]);
const ICE_SLOW={"노말":{cd:5,dur:2,range:1.5,slow:0.45},"고급":{cd:4,dur:3,range:2.0,slow:0.40},"영웅":{cd:3,dur:4,range:2.5,slow:0.35},"전설":{cd:2,dur:5,range:3.0,slow:0.30},"신화":{cd:1.5,dur:6,range:3.5,slow:0.25},"불멸":{cd:1,dur:8,range:4.0,slow:0.20}};

const SPRITE_CACHE={};
const loadSprite=(el)=>{if(SPRITE_CACHE[el]&&SPRITE_CACHE[el].complete)return;const img=new Image();img.src=`/${el}.png`;SPRITE_CACHE[el]=img;};
["불","물","땅","바람","전기","얼음","빛","어둠","소리","무속성","독","나무"].forEach(loadSprite);

const mkH=(el,g="노말",gradeEnhLv={})=>{
  const lv=gradeEnhLv[g]||0;
  const bonus=lv>0?{atk:([5,10,20,35,50,80][["노말","고급","영웅","전설","신화","불멸"].indexOf(g)]||5)*lv,spd:0.05*lv}:{atk:0,spd:0};
  const isIce=ICE_UNITS.has(el);
  const iceCfg=isIce?(ICE_SLOW[g]||ICE_SLOW["노말"]):null;
  const range=isIce?iceCfg.range:getRange(el,g);
  return{id:hid++,element:el,grade:g,atk:isIce?0:(ATK_MAP[g]||10)+bonus.atk,spd:Math.min(1.0+bonus.spd,3.0),range,col:null,row:null,lastShot:0,enhLv:0,isIce,iceCfg};
};

// ── 적 생성: 분기맵이면 path 정보 포함
const mkE=(type,rnd=1,isBoss=false,isMid=false,mapKey='A')=>{
  const base=isBoss?2500+rnd*220:isMid?1200+rnd*120:150+rnd*22;
  const hp=Math.floor(type==="은신"?base*0.8:type==="공중"?base*1.2:base);
  const spd=isBoss?0.6:isMid?0.8:type==="공중"?1.4:1.0;

  if(mapKey==='C'&&FORK_PATHS){
    // 분기맵: 분기점에서 랜덤 좌/우 선택
    const branch=Math.random()<0.5?'left':'right';
    const fullPath=[
      ...FORK_PATHS.main,
      ...FORK_PATHS[branch],
      ...FORK_PATHS.merge,
    ];
    return{id:eid++,type,hp,maxHp:hp,
      x:fullPath[0][0]*CS,y:fullPath[0][1]*CS,
      pathIdx:0,path:fullPath,
      speed:spd,dmg:isBoss?5:isMid?3:1,
      remove:false,rewarded:false,
      isBoss,isMid,
      reward:isBoss?100:isMid?20:0,
      branch};
  }
  // 단일경로
  return{id:eid++,type,hp,maxHp:hp,
    x:TRACK[0][0]*CS,y:TRACK[0][1]*CS,
    pathIdx:0,path:TRACK,
    speed:spd,dmg:isBoss?5:isMid?3:1,
    remove:false,rewarded:false,
    isBoss,isMid,
    reward:isBoss?100:isMid?20:0};
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
  heroes:[],hiddenHero:null,enemies:[],projs:[],
  life:20,gold:50,coins:0,round:1,
  total:0,running:false,spawnT:0,spawnC:0,maxSpawn:15,
  cleared:false,over:false,
  bossSpawned:false,midSpawned:false,
  stacks:{},gameTime:0,gradeEnhLv:{},
  impacts:[],
  mapKey:CURRENT_MAP||'A',
  difficulty:diff,
  // 난이도별 유닛 공격력 배율: 쉬움 1.5배, 보통 1.25배, 어려움 1.0배
  diffMul:diff==='easy'?1.5:diff==='normal'?1.25:1.0,
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
  const [difficulty,setDifficulty]=useState('hard');
  const [showPatch,setShowPatch]=useState(true); // 첫 진입시 패치노트 표시 // easy/normal/hard
  const [ui,setUi]=useState({life:20,gold:50,coins:0,round:1,total:0,over:false,victory:false});
  const [heroes,setHeroes]=useState([]);
  const [selH,setSelH]=useState(null);
  const [drag,setDrag]=useState(null);
  const [modal,setModal]=useState(null);
  const [showCombo,setShowCombo]=useState(false);
  const [comboFilter,setComboFilter]=useState("고급");
  const [speed,setSpeedState]=useState(1);
  const [selHero,setSelHero]=useState(null);
  const [countdown,setCountdown]=useState(0);
  const [randomPicks,setRandomPicks]=useState([]);
  const [stacks,setStacks]=useState({});
  const [summonAnim,setSummonAnim]=useState(null);
  const [currentMapName,setCurrentMapName]=useState('');

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
    const g=G.current;if(!g||!g.hiddenHero)return{atk:0,spd:0,magic:0};
    const hd=HH.find(h=>h.id===g.hiddenHero.id);
    return hd?hd.buff:{atk:0,spd:0,magic:0};
  },[]);

  const draw=useCallback(()=>{
    const c=cvs.current;if(!c)return;
    const ctx=c.getContext("2d"),g=G.current;
    ctx.clearRect(0,0,COLS*CS,ROWS*CS);
    ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,COLS*CS,ROWS*CS);

    // 타일 배경
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const isT=TS.has(`${col},${r}`),isC=col===CX&&r===CY;
      const isSpawn=col===SPAWN_TILE[0]&&r===SPAWN_TILE[1];
      const isGoal=col===GOAL_TILE[0]&&r===GOAL_TILE[1];
      ctx.fillStyle=isC?"#2d2d60":isSpawn?"#1a3a1a":isGoal?"#3a1a1a":isT?"#1e3a1e":"#16213e";
      ctx.fillRect(col*CS,r*CS,CS,CS);
      ctx.strokeStyle="#0d1b2a";ctx.strokeRect(col*CS,r*CS,CS,CS);
    }

    // 분기맵 C: 왼/오른쪽 경로 색 다르게
    if(CURRENT_MAP==='C'&&FORK_PATHS){
      FORK_PATHS.left.forEach(([col,r])=>{
        ctx.fillStyle="rgba(0,120,200,0.12)";ctx.fillRect(col*CS,r*CS,CS,CS);
      });
      FORK_PATHS.right.forEach(([col,r])=>{
        ctx.fillStyle="rgba(200,80,0,0.12)";ctx.fillRect(col*CS,r*CS,CS,CS);
      });
      // 분기점 표시
      const bp=FORK_PATHS.main[FORK_PATHS.main.length-1];
      ctx.strokeStyle="#fd0";ctx.lineWidth=2;ctx.strokeRect(bp[0]*CS+1,bp[1]*CS+1,CS-2,CS-2);ctx.lineWidth=1;
      // 합류점 표시
      const mp=FORK_PATHS.merge[0];
      ctx.strokeStyle="#fd0";ctx.lineWidth=2;ctx.strokeRect(mp[0]*CS+1,mp[1]*CS+1,CS-2,CS-2);ctx.lineWidth=1;
    }

    // 경로 방향점
    const trackRef=CURRENT_MAP==='C'&&FORK_PATHS?[...FORK_PATHS.main,...FORK_PATHS.left,...FORK_PATHS.right,...FORK_PATHS.merge]:TRACK;
    for(let i=0;i<trackRef.length;i+=3){const[col,r]=trackRef[i];ctx.fillStyle="#2a4a2a";ctx.fillRect(col*CS+22,r*CS+22,4,4);}

    // 스폰/골 표시
    {const[sc,sr]=SPAWN_TILE;
      ctx.fillStyle="rgba(80,255,80,0.2)";ctx.fillRect(sc*CS,sr*CS,CS,CS);
      ctx.strokeStyle="#4f8";ctx.lineWidth=2;ctx.strokeRect(sc*CS+1,sr*CS+1,CS-2,CS-2);ctx.lineWidth=1;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 8px sans-serif";ctx.fillStyle="#4f8";ctx.fillText("SPAWN",sc*CS+CS/2,sr*CS+14);
      ctx.font="bold 14px sans-serif";ctx.fillStyle="#4f8";ctx.fillText("S",sc*CS+CS/2,sr*CS+34);
      ctx.textAlign="left";ctx.textBaseline="alphabetic";}
    {const[gc2,gr]=GOAL_TILE;
      ctx.fillStyle="rgba(255,80,80,0.2)";ctx.fillRect(gc2*CS,gr*CS,CS,CS);
      ctx.strokeStyle="#f44";ctx.lineWidth=2;ctx.strokeRect(gc2*CS+1,gr*CS+1,CS-2,CS-2);ctx.lineWidth=1;
      ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font="bold 8px sans-serif";ctx.fillStyle="#f44";ctx.fillText("GOAL",gc2*CS+CS/2,gr*CS+14);
      ctx.font="bold 14px sans-serif";ctx.fillStyle="#f44";ctx.fillText("G",gc2*CS+CS/2,gr*CS+34);
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
      const hx=h.col*CS,hy=h.row*CS;
      const gr=GC[h.grade]||"#aaaaaa";
      if(sel){ctx.fillStyle="rgba(255,215,0,0.15)";ctx.fillRect(hx,hy,CS,CS);}
      const spr=SPRITE_CACHE[h.element];
      if(spr&&spr.complete&&spr.naturalWidth>0){ctx.drawImage(spr,hx,hy,CS,CS);}
      else{ctx.fillStyle=gr+"33";ctx.fillRect(hx,hy,CS,CS);ctx.font="20px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.fillText(EE[h.element]||"?",hx+CS/2,hy+CS/2);ctx.textAlign="left";ctx.textBaseline="alphabetic";loadSprite(h.element);}
      ctx.strokeStyle=sel?"#ffd700":gr;ctx.lineWidth=sel?2.5:1;ctx.strokeRect(hx,hy,CS,CS);ctx.lineWidth=1;
      ctx.fillStyle=gr;ctx.font="bold 7px sans-serif";ctx.fillText(h.grade,hx+2,hy+CS-3);
      if(h.enhLv>0){ctx.fillStyle="#fd0";ctx.font="bold 8px sans-serif";ctx.fillText(`+${h.enhLv}`,hx+32,hy+14);}
    }

    // 적
    if(g)for(const e of g.enemies){
      if(e.remove)continue;
      if(e.type==="은신")ctx.globalAlpha=0.35;
      const hR=e.hp/e.maxHp;
      const bw=e.isBoss?CS*1.3:e.isMid?CS*1.1:CS-4;
      ctx.fillStyle="#333";ctx.fillRect(e.x+(CS-bw)/2,e.y-8,bw,5);
      ctx.fillStyle=e.isBoss?"#f44":e.isMid?"#fa0":hR>0.5?"#4f4":hR>0.25?"#fa0":"#f44";
      ctx.fillRect(e.x+(CS-bw)/2,e.y-8,bw*hR,5);
      const rad=e.isBoss?CS/2:e.isMid?CS/2-2:CS/2-4;
      ctx.fillStyle=e.isBoss?"#800":e.isMid?"#850":e.type==="일반"?"#c44":e.type==="은신"?"#646":"#44c";
      ctx.beginPath();ctx.arc(e.x+CS/2,e.y+CS/2,rad,0,Math.PI*2);ctx.fill();
      if(e.isBoss){ctx.fillStyle="#faa";ctx.font="bold 8px sans-serif";ctx.fillText("BOSS",e.x+8,e.y+CS/2+3);}
      else if(e.isMid){ctx.fillStyle="#fda";ctx.font="bold 7px sans-serif";ctx.fillText("MID",e.x+11,e.y+CS/2+3);}
      else{ctx.font="15px serif";ctx.fillText(e.type==="일반"?"👾":e.type==="은신"?"🥷":"🦅",e.x+10,e.y+29);}
      ctx.globalAlpha=1;
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
        default: ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.globalAlpha=0.7;ctx.beginPath();ctx.arc(p.x,p.y,1.8,0,Math.PI*2);ctx.fill();
      }
      if(fx.trail>0){const mdx=p.tx-p.sx,mdy=p.ty-p.sy,mlen=Math.sqrt(mdx*mdx+mdy*mdy)||1;const ux2=mdx/mlen,uy2=mdy/mlen;ctx.globalAlpha=0.25;ctx.strokeStyle=c;ctx.lineWidth=Math.max(1,fx.trail/3);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-ux2*fx.trail*2,p.y-uy2*fx.trail*2);ctx.stroke();}
      if(p.grade==="불멸"){ctx.globalAlpha=0.5;for(let i=0;i<3;i++){const ang=p.age*8+i*(Math.PI*2/3);ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x+Math.cos(ang)*6,p.y+Math.sin(ang)*6,1.5,0,Math.PI*2);ctx.fill();}}
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
    g.spawnT+=dt;
    if(g.spawnT>1.2&&g.spawnC<g.maxSpawn){
      g.spawnT=0;g.spawnC++;
      if(isBossRound&&!g.bossSpawned){g.enemies.push(mkE("일반",g.round,true,false,g.mapKey));g.bossSpawned=true;}
      else if(isMidRound&&!g.midSpawned){g.enemies.push(mkE("일반",g.round,false,true,g.mapKey));g.midSpawned=true;}
      else if(!isBossRound&&!isMidRound){
        const types=["일반","일반","은신","공중"];
        g.enemies.push(mkE(types[Math.floor(Math.random()*types.length)],g.round,false,false,g.mapKey));
      }
    }

    // 적 이동 (path 기반)
    for(const e of g.enemies){
      if(e.remove)continue;
      const path=e.path;
      if(!path||e.pathIdx>=path.length){e.remove=true;g.life=Math.max(0,g.life-e.dmg);if(g.life<=0)g.over=true;continue;}
      const[tc,tr]=path[e.pathIdx];
      const tx=tc*CS,ty=tr*CS,dx=tx-e.x,dy=ty-e.y;
      const dist=Math.sqrt(dx*dx+dy*dy),mv=CS*e.speed*dt*1.5;
      if(dist<mv){
        e.x=tx;e.y=ty;e.pathIdx++;
        if(e.pathIdx>=path.length){e.remove=true;g.life=Math.max(0,g.life-e.dmg);if(g.life<=0)g.over=true;}
      }else{e.x+=dx/dist*mv;e.y+=dy/dist*mv;}
    }
    g.enemies=g.enemies.filter(e=>!e.remove&&e.hp>0);
    g.total=g.enemies.length;
    if(g.total>=30){g.over=true;g.running=false;sync();draw();return;}
    g.gameTime=(g.gameTime||0)+dt;
    const buff=getBuff();
    const allH=g.heroes.filter(h=>h.col!==null);
    for(const h of allH){
      const hx=h.col*CS+CS/2,hy=h.row*CS+CS/2;
      const baseSpd=(h.spd||1)*(1+buff.spd);
      if(g.gameTime-(h.lastShot||0)<1/baseSpd)continue;
      const rng=(h.range||3.5)*CS;
      if(h.isIce&&h.iceCfg){
        const cfg=h.iceCfg;
        if(g.gameTime-h.lastShot>=cfg.cd){
          h.lastShot=g.gameTime;
          for(const e of g.enemies){
            if(e.remove)continue;
            const d=Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2);
            if(d<=cfg.range*CS){if(!e.baseSpeed)e.baseSpeed=e.speed;e.slowTimer=cfg.dur;e.speed=e.baseSpeed*cfg.slow;g.projs.push({x:hx,y:hy,tx:e.x+CS/2,ty:e.y+CS/2,tid:e.id,dmg:0,spd:400,color:"#aef",size:3,age:0,sx:hx,sy:hy});}
          }
        }
        continue;
      }
      let near=null,nd=Infinity;
      for(const e of g.enemies){
        if(e.remove)continue;
        const d=Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2);
        if(d<rng&&d<nd){near=e;nd=d;}
      }
      if(near){
        h.lastShot=g.gameTime;
        const diffMul=g.diffMul||1.0;
        const baseAtk=(((h.atk||10)+(h.enhLv||0)*5)*(buff.atkMul||1)+buff.atk)*diffMul;
        const dmg=Math.floor(baseAtk*(1+buff.magic));
        g.projs.push({x:hx,y:hy,tx:near.x+CS/2,ty:near.y+CS/2,tid:near.id,dmg,spd:300,color:EC[h.element]||"#ff0",elBase:elBase(h.element),grade:h.grade,sx:hx,sy:hy,age:0});
      }
    }
    for(const p of g.projs){
      p.age=(p.age||0)+dt;
      const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.sqrt(dx*dx+dy*dy),mv=p.spd*dt;
      if(dist<mv){
        p.hit=true;
        if(!g.impacts)g.impacts=[];
        g.impacts.push({x:p.tx,y:p.ty,t:0,maxT:0.25,color:p.color,elBase:p.elBase,grade:p.grade});
        const t2=g.enemies.find(e=>e.id===p.tid&&!e.remove&&e.hp>0);
        if(t2&&p.dmg>0){t2.hp-=p.dmg;if(t2.hp<=0&&!t2.rewarded){t2.rewarded=true;if(t2.reward>0){g.gold+=t2.reward;setUi(prev=>({...prev,gold:g.gold}));}}}
      }else{p.x+=dx/dist*mv;p.y+=dy/dist*mv;}
    }
    g.projs=g.projs.filter(p=>!p.hit);
    if(g.impacts){for(const im of g.impacts)im.t+=dt;g.impacts=g.impacts.filter(im=>im.t<im.maxT);}

    const spawnDone=(isBossRound&&g.bossSpawned)||(isMidRound&&g.midSpawned)||(!isBossRound&&!isMidRound&&g.spawnC>=g.maxSpawn);
    if(spawnDone&&g.enemies.length===0&&!g.cleared){
      g.running=false;g.cleared=true;
      if(isMidRound||isBossRound)g.coins+=1;
      const clearGold=isBossRound?80:isMidRound?50:20;
      g.gold+=clearGold;
      if(g.round%20===0){const nu=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){nu.col=pos[0];nu.row=pos[1];}g.heroes.push(nu);}
      if(g.round===100){g.victory=true;g.running=false;sync();draw();return;}
      g.round++;g.cleared=false;g.total=0;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
      const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
      g.maxSpawn=nb?1:nm?1:15+g.round;
      sync();setCountdown(3);let cd=3;
      const iv=setInterval(()=>{cd--;setCountdown(cd);if(cd<=0){clearInterval(iv);if(!G.current.over){G.current.running=true;lt.current=performance.now();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));}}},1000);
      return;
    }
    draw();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));
  },[draw,sync,getBuff,setUi]);

  useEffect(()=>{gameLoopRef.current=gameLoop;},[gameLoop]);
  useEffect(()=>{if(phase==='game')draw();},[draw,phase]);
  useEffect(()=>{if(phase==='game')draw();},[selHero,drag]);

  const autoStart=(g)=>{
    const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
    g.maxSpawn=nb?1:nm?1:15+g.round;
    g.running=true;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
    sync();lt.current=performance.now();raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
  };

  // 게임 시작: 맵 결정 → 히든영웅 화면
  const startGame=(mapOverride)=>{
    if(raf.current)cancelAnimationFrame(raf.current);
    hid=1;eid=1;
    const keys=['A','B','C'];
    const mk=mapOverride||keys[Math.floor(Math.random()*keys.length)];
    buildMap(mk);
    setCurrentMapName(MAP_DEFS[mk].name);
    G.current=initGame(difficulty);
    G.current.mapKey=mk;
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    sync();
    setPhase('hidden');
  };

  const pickHidden=(h)=>{
    const g=G.current;
    g.hiddenHero={...h,id:h.id};
    // 난이도를 히든영웅 선택 시점에 최종 반영 (state 비동기 문제 해결)
    g.difficulty=difficulty;
    g.diffMul=difficulty==='easy'?1.5:difficulty==='normal'?1.25:1.0;
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
      setCountdown(3);
      let cd=3;
      const iv=setInterval(()=>{
        cd--;setCountdown(cd);
        if(cd<=0){
          clearInterval(iv);
          if(!G.current.over) autoStart(G.current);
        }
      },1000);
    },80);
  };

  const setDragBoth=(id)=>{dragR.current=id;setDrag(id);};

  const onCanvas=(e)=>{
    if(phase!=='game')return;
    const rect=cvs.current.getBoundingClientRect();
    const sx=(COLS*CS)/rect.width,sy=(ROWS*CS)/rect.height;
    const col=Math.floor((e.clientX-rect.left)*sx/CS);
    const row=Math.floor((e.clientY-rect.top)*sy/CS);
    if(col<0||col>=COLS||row<0||row>=ROWS)return;
    const g=G.current;
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

    // 고급/영웅: COMBO 방식
    const comboOpts=COMBO.filter(r=>{
      if((r.a===h.element&&myEls.includes(r.b))||(r.b===h.element&&myEls.includes(r.a))){
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
  const GRADE_ENH_BONUS={노말:{atk:5,spd:0.05},고급:{atk:10,spd:0.05},영웅:{atk:20,spd:0.05},전설:{atk:35,spd:0.05},신화:{atk:50,spd:0.05},불멸:{atk:80,spd:0.05}};
  const getGradeEnhLv=(grade)=>(G.current?.gradeEnhLv||{})[grade]||0;

  const doGradeEnhance=(grade)=>{
    const g=G.current;if(!g.gradeEnhLv)g.gradeEnhLv={};
    const lv=g.gradeEnhLv[grade]||0;
    const cost=GRADE_ENH_COST[grade]*(lv+1);
    if(g.gold<cost){alert(`골드 부족! (${cost}G)`);return;}
    g.gold-=cost;g.gradeEnhLv[grade]=(lv+1);
    const bonus=GRADE_ENH_BONUS[grade];
    for(const h of g.heroes){if(h.grade===grade){h.atk+=bonus.atk;h.spd=Math.min((h.spd||1)+bonus.spd,3.0);}}
    sync();draw();alert(`✅ ${grade} 강화 완료! ATK+${bonus.atk}/SPD+${(bonus.spd*100).toFixed(0)}% (Lv.${lv+1})`);
  };

  const enhCost=(h)=>10*(h.enhLv+1);
  const doEnhance=(heroId)=>{
    const g=G.current,h=g.heroes.find(x=>x.id===heroId);
    if(!h)return;
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

  const changeSpeed=(s)=>{spR.current=s;setSpeedState(s);};
  const hd=HH.find(h=>h.id===selH);
  const myEls=new Set(heroes.map(h=>h.element));
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
        <div style={{fontSize:44,marginBottom:8}}>🗡️</div>
        <div style={{fontSize:28,fontWeight:"bold",color:"#4af",marginBottom:4,letterSpacing:2}}>랜덤 디펜스</div>
        <div style={{fontSize:13,color:"#555",marginBottom:32}}>Random Defense</div>

        {/* 맵 미리보기 */}
        <div style={{display:"flex",gap:8,marginBottom:28}}>
          {[
            {label:"지그재그",color:"#4af",icon:"⚡"},
            {label:"S자",color:"#4f8",icon:"〰️"},
            {label:"분기",color:"#fa0",icon:"🔀"},
          ].map(m=>(
            <div key={m.label} style={{background:"#161b22",border:`1px solid ${m.color}33`,borderRadius:10,padding:"8px 12px",textAlign:"center",flex:1}}>
              <div style={{fontSize:18,marginBottom:2}}>{m.icon}</div>
              <div style={{fontSize:11,color:m.color,fontWeight:"bold"}}>{m.label}</div>
            </div>
          ))}
        </div>

        <button onClick={()=>startGame(null)}
          style={{background:"linear-gradient(135deg,#1f6feb,#6e40c9)",border:"none",color:"#fff",borderRadius:12,padding:"14px 48px",cursor:"pointer",fontSize:18,fontWeight:"bold",letterSpacing:2,boxShadow:"0 4px 20px rgba(31,111,235,0.4)",marginBottom:12}}>
          ⚔️ 게임 시작
        </button>
        <button onClick={()=>setShowPatch(true)}
          style={{background:"none",border:"1px solid #30363d",color:"#555",borderRadius:8,padding:"6px 20px",cursor:"pointer",fontSize:12,marginBottom:8}}>
          📋 패치노트
        </button>
        <div style={{fontSize:11,color:"#444",textAlign:"center"}}>매 게임 3종 맵 중 랜덤으로 시작</div>
      </div>

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
                style={{width:"100%",background:"#1f6feb",border:"none",color:"#fff",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>
                확인
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
                {key:'easy',label:'쉬움',desc:'공격력 ×1.5',color:'#4f8',icon:'🌱'},
                {key:'normal',label:'보통',desc:'공격력 ×1.25',color:'#4af',icon:'⚔️'},
                {key:'hard',label:'어려움',desc:'공격력 ×1.0',color:'#f44',icon:'💀'},
              ].map(d=>(
                <button key={d.key} onClick={()=>setDifficulty(d.key)}
                  style={{flex:1,background:difficulty===d.key?d.color+'22':'#21262d',
                    border:`2px solid ${difficulty===d.key?d.color:'#30363d'}`,
                    borderRadius:10,padding:"8px 4px",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:18,marginBottom:2}}>{d.icon}</div>
                  <div style={{fontSize:12,fontWeight:"bold",color:difficulty===d.key?d.color:'#aaa'}}>{d.label}</div>
                  <div style={{fontSize:9,color:"#555",marginTop:1}}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {HH.map(h=>(
              <button key={h.id} onClick={()=>pickHidden(h)}
                style={{background:hr(h.color,0.1),border:`2px solid ${h.color}`,borderRadius:10,padding:"12px 16px",cursor:"pointer",color:"#eee",textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:28}}>{h.emoji}</span>
                <div>
                  <div style={{fontWeight:"bold",fontSize:15,color:h.color}}>{h.name}</div>
                  <div style={{fontSize:11,color:"#aaa",marginTop:2}}>{h.desc}</div>
                </div>
              </button>
            ))}
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
    <div style={{fontFamily:"sans-serif",background:"#0d1117",minHeight:"100vh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px"}}>
      <SummonOverlay anim={summonAnim} onClose={()=>setSummonAnim(null)}/>

      {/* HUD */}
      <div style={{width:"100%",maxWidth:440,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#161b22",borderRadius:10,padding:"6px 10px",marginBottom:4,border:"1px solid #30363d",fontSize:13}}>
        <span>❤️<b style={{color:"#f66"}}>{ui.life}</b></span>
        <span>💰<b style={{color:"#fd0"}}>{ui.gold}G</b></span>
        <span style={{color:"#a78bfa",fontWeight:"bold",cursor:"pointer"}} onClick={()=>setModal("shop")}>🪙{ui.coins}</span>
        <span style={{fontSize:11,color:"#4af"}}>🗺️{currentMapName}</span>
        <span style={{fontSize:10,color:G.current?.difficulty==='easy'?'#4f8':G.current?.difficulty==='normal'?'#4af':'#f44'}}>{G.current?.difficulty==='easy'?'🌱쉬움':G.current?.difficulty==='normal'?'⚔️보통':'💀어려움'}</span>
        <span>🎯R{ui.round}/100</span>
        <span style={{color:ui.total>=24?"#f44":"#aaa",fontSize:12}}>👾{ui.total}/30</span>
        <button onClick={()=>setShowCombo(true)} style={{background:"#21262d",border:"1px solid #444",color:"#eee",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:12}}>조합표</button>
      </div>

      {/* 배속 */}
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:4,marginBottom:4}}>
        {[1,2,3,4].map(s=>(
          <button key={s} onClick={()=>changeSpeed(s)}
            style={{flex:1,background:speed===s?"#1f6feb":"#21262d",border:`1px solid ${speed===s?"#58f":"#444"}`,color:speed===s?"#fff":"#aaa",borderRadius:7,padding:"5px 0",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>
            {s}x
          </button>
        ))}
        <button onClick={()=>setPhase('title')} style={{background:"#21262d",border:"1px solid #444",color:"#666",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12}}>🏠</button>
      </div>

      {countdown>0&&<div style={{width:"100%",maxWidth:440,textAlign:"center",background:"#1a2a1a",borderRadius:8,padding:"5px",marginBottom:4,border:"1px solid #2a4a2a",fontSize:14,color:"#4f8",fontWeight:"bold"}}>⏱ {countdown}초 후 시작...</div>}

      <canvas ref={cvs} width={COLS*CS} height={ROWS*CS} onClick={onCanvas}
        style={{width:"100%",maxWidth:440,borderRadius:10,border:`2px solid ${drag?"rgba(255,215,0,0.5)":"#30363d"}`,cursor:drag||selHero?"crosshair":"default"}}/>

      {/* 게임오버 */}
      {ui.over&&<Overlay>
        <div style={{fontSize:40,textAlign:"center"}}>💀</div>
        <div style={{fontSize:20,fontWeight:"bold",color:"#f44",margin:"8px 0",textAlign:"center"}}>게임 오버</div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn bg="#c33" onClick={()=>startGame(null)}>다시 시작</Btn>
          <Btn bg="#333" onClick={()=>setPhase('title')}>타이틀로</Btn>
        </div>
      </Overlay>}
      {ui.victory&&<Overlay>
        <div style={{fontSize:44,textAlign:"center"}}>🏆</div>
        <div style={{fontSize:22,fontWeight:"bold",color:"#fd0",margin:"8px 0",textAlign:"center"}}>100층 클리어!</div>
        <div style={{color:"#4f8",fontSize:14,marginBottom:6,textAlign:"center"}}>축하합니다!</div>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <Btn bg="#1f6feb" onClick={()=>startGame(null)}>다시 시작</Btn>
          <Btn bg="#333" onClick={()=>setPhase('title')}>타이틀로</Btn>
        </div>
      </Overlay>}

      {/* 액션 버튼 */}
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:6,marginTop:6}}>
        <Btn bg="#1f6feb" onClick={()=>{
          const g=G.current;if(g.gold<10){alert("골드 부족! (10G)");return;}
          g.gold-=10;
          const h=mkH(BASE[Math.floor(Math.random()*BASE.length)],"노말",g.gradeEnhLv||{});
          const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
          g.heroes.push(h);sync();draw();
        }}>🎲 뽑기 (10G)</Btn>
        <Btn bg="#1a5c2a" onClick={()=>{setRandomPicks([]);setModal("merge");}}>✨ 뭉치기</Btn>
        <Btn bg="#b8860b" onClick={()=>setModal("gradeEnh")}>⬆️ 강화</Btn>
        <Btn bg="#6e40c9" onClick={()=>setModal("shop")}>🪙 {ui.coins}</Btn>
      </div>

      {(drag||selHero)&&<div style={{width:"100%",maxWidth:440,fontSize:12,color:"#fd0",marginTop:4,padding:"3px 8px",background:"rgba(255,215,0,0.07)",borderRadius:6}}>📍 이동할 칸 클릭 / 다른 영웅=스왑 / 같은 영웅=취소</div>}

      {/* 선택 영웅 패널 */}
      {selHeroObj&&(
        <div style={{width:"100%",maxWidth:440,background:"#1c2030",border:"1px solid #fa0",borderRadius:10,padding:"10px 12px",marginTop:6}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:22}}>{EE[selHeroObj.element]||"?"}</span>
            <div>
              <span style={{color:GC[selHeroObj.grade],fontWeight:"bold"}}>{EN[selHeroObj.element]||selHeroObj.element} [{selHeroObj.grade}]</span>
              {selHeroObj.enhLv>0&&<span style={{color:"#fd0",marginLeft:6}}>+{selHeroObj.enhLv}</span>}
              <div style={{fontSize:10,color:"#aaa"}}>ATK {Math.floor(((selHeroObj.atk+(selHeroObj.enhLv||0)*5)*(buff.atkMul||1)+buff.atk)*(1+buff.magic))} | SPD {(((selHeroObj.spd||1)*(1+buff.spd))*100).toFixed(0)}% | 사거리 {(selHeroObj.range||3.0).toFixed(1)}</div>
            </div>
            <button onClick={()=>setSelHero(null)} style={{marginLeft:"auto",background:"#333",border:"none",color:"#aaa",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            <button onClick={()=>{setSelHero(null);setDragBoth(selHeroObj.id);}} style={{background:"#1f6feb",border:"none",color:"#fff",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>📍 이동</button>
            <button onClick={()=>doEnhance(selHeroObj.id)} style={{background:"#553300",border:"1px solid #fd0",color:"#fd0",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>⬆️ 강화 ({enhCost(selHeroObj)}G)</button>
            <button onClick={()=>doSell(selHeroObj.id)} style={{background:"#3a1010",border:"1px solid #f66",color:"#f88",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>💰 판매 (+{SELL_PRICE[selHeroObj.grade]||5}G)</button>
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
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:5,flexWrap:"wrap",marginTop:6,paddingBottom:4}}>
        {heroes.map(h=>{
          const isSel=h.id===selHero,isDrag=h.id===drag;
          return(
            <div key={h.id} onClick={()=>onHero(h)}
              style={{background:isSel?"rgba(255,170,0,0.15)":isDrag?"#004488":"#21262d",
                border:`2px solid ${isSel?"#fa0":isDrag?"#fd0":GC[h.grade]||"#444"}`,
                borderRadius:8,padding:"5px 7px",cursor:"pointer",fontSize:13,minWidth:52,textAlign:"center",
                boxShadow:isSel?"0 0 10px rgba(255,170,0,0.4)":"none"}}>
              <div style={{fontSize:17}}>{EE[h.element]||"?"}</div>
              <div style={{fontSize:7,color:"#888",lineHeight:1.1}}>{EN[h.element]||h.element}</div>
              <div style={{fontSize:9,color:GC[h.grade]}}>{h.grade}</div>
              {h.enhLv>0&&<div style={{fontSize:8,color:"#fd0"}}>+{h.enhLv}</div>}
            </div>
          );
        })}
      </div>

      {/* 히든영웅 버프 */}
      {hd&&(
        <div style={{width:"100%",maxWidth:440,background:hr(hd.color,0.09),border:`1px solid ${hd.color}`,borderRadius:10,padding:"7px 12px",marginTop:4,fontSize:12}}>
          <span style={{color:hd.color,fontWeight:"bold"}}>{hd.emoji} {hd.name}</span>
          <span style={{color:"#aaffaa",marginLeft:8}}>🟢 {hd.desc}</span>
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
                  <button onClick={()=>doGradeEnhance(grade)} disabled={!canAfford} style={{background:canAfford?GC[grade]+"33":"#333",border:`1px solid ${canAfford?GC[grade]:"#444"}`,color:canAfford?GC[grade]:"#555",borderRadius:7,padding:"4px 12px",cursor:canAfford?"pointer":"not-allowed",fontSize:12,fontWeight:"bold"}}>💰 {cost}G</button>
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
        const tabs=["고급","영웅","전설","신화","불멸"];
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
                    can:myEls.has(r.a)&&myEls.has(r.b),
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
