export const CS=64,COLS=9,ROWS=14;

// ══════════════════════════════════════════
// 맵 정의 (3종)
// 맵A: 지그재그 4단 (단일경로)
// 맵B: S자 5단 (단일경로)
// 맵 정의
// ══════════════════════════════════════════
export const MAP_DEFS={
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
    name:"X자",
    spawn:[0,0], // 표시용 (실제는 spawnA/spawnB)
    goal:[8,13], // 표시용 (실제는 goalA/goalB)
    buildTrack:()=>null,
    dual:true,
    buildDualPaths:()=>{
      // 경로 A: 좌상단(0,0) → 우하단(8,13) 대각선
      const pathA=[];
      for(let i=0;i<=13;i++){
        const c=Math.min(8,Math.round(i*8/13));
        pathA.push([c,i]);
      }
      // 경로 B: 우상단(8,0) → 좌하단(0,13) 대각선
      const pathB=[];
      for(let i=0;i<=13;i++){
        const c=Math.max(0,8-Math.round(i*8/13));
        pathB.push([c,i]);
      }
      return{
        pathA,pathB,
        spawnA:pathA[0],spawnB:pathB[0],
        goalA:pathA[pathA.length-1],goalB:pathB[pathB.length-1],
      };
    },
    fork:false,
  },
};

// 현재 맵 상태 (게임 시작시 결정)
export let CURRENT_MAP=null;

// 회전 모드 경로 생성 (외곽을 시계방향으로 N바퀴)
export function buildRotPath(laps){
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
export let TRACK=[];
export let FORK_PATHS=null;
export let DUAL_PATHS=null; // X자 맵: {pathA, pathB, spawnA, spawnB, goalA, goalB}
export let SPAWN_TILE=[0,0];
export let GOAL_TILE=[8,13];
export let TS=new Set();
export let CX=4,CY=6;

export function buildMap(mapKey){
  const def=MAP_DEFS[mapKey];
  SPAWN_TILE=[...def.spawn];
  GOAL_TILE=[...def.goal];
  DUAL_PATHS=null;
  if(def.dual){
    DUAL_PATHS=def.buildDualPaths();
    const allTiles=[...DUAL_PATHS.pathA,...DUAL_PATHS.pathB];
    TRACK=allTiles;
    FORK_PATHS=null;
    TS=new Set(allTiles.map(([c,r])=>`${c},${r}`));
  } else if(def.fork){
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
  else if(mapKey==='F'){CX=4;CY=6;}
  else{CX=4;CY=6;}
  CURRENT_MAP=mapKey;
}

// 회전 모드 맵 상태 적용 (단일/멀티 공용)
export function applyRotationMap(){
  CURRENT_MAP='ROT';
  SPAWN_TILE=[0,0];
  GOAL_TILE=[0,0];
  FORK_PATHS=null;
  DUAL_PATHS=null;
  TRACK=buildRotPath(1);
  TS=new Set();
  for(let c=0;c<COLS;c++){TS.add(`${c},0`);TS.add(`${c},${ROWS-1}`);}
  for(let r=0;r<ROWS;r++){TS.add(`0,${r}`);TS.add(`${COLS-1},${r}`);}
  CX=4;CY=6;
}
