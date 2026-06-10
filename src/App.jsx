import { useState, useRef, useEffect, useCallback } from "react";

const CS=48,COLS=9,ROWS=14;
const TRACK=(()=>{const p=[];for(let c=1;c<=7;c++)p.push([c,1]);for(let r=2;r<=12;r++)p.push([7,r]);for(let c=6;c>=1;c--)p.push([c,12]);for(let r=11;r>=2;r--)p.push([1,r]);return p;})();
const TS=new Set(TRACK.map(([c,r])=>`${c},${r}`));
const CX=4,CY=7;
const BASE=["불","물","땅","바람","전기","얼음","빛","어둠","소리"];
const EC={불:"#f44",물:"#48f",땅:"#a73",바람:"#8d8",전기:"#fd0",얼음:"#8ef",빛:"#ffa",어둠:"#a4f",소리:"#f8c",무속성:"#ccc",용암:"#f60",폭풍화염:"#f30",빙하:"#0cf",진흙:"#8a4",번개폭풍:"#fa0",공허:"#84a",공명:"#f6f",플라즈마:"#f4f",안개:"#abc",눈보라:"#cef",성음:"#feb",암흑파동:"#80c",동토:"#68a",증기:"#ddf",돌풍:"#afd",화염폭풍:"#f80",해일:"#08f",태풍:"#4fa",번개신:"#ff4",절대영도:"#aef",신성광:"#ffc",심연:"#608",용암폭풍:"#f50",냉기폭풍:"#8df",어둠번개:"#c4f",성스러운얼음:"#aff",빛의해일:"#afe",허리케인:"#0fc",뇌신:"#fe0",빙하신:"#0ef",빛의신:"#ffe",어둠신:"#404",천지개벽:"#f8f",용신:"#f60",신성폭풍:"#fda",혼돈:"#628",폭풍신화:"#0ff",번개신화:"#ff0",빙하신화:"#aff",광명신화:"#eef",암흑신화:"#404",창조신화:"#f4f",용왕신화:"#f80",신성신화:"#fea",혼돈신화:"#a0f",폭풍불멸:"#fff",번개불멸:"#ff8",빙하불멸:"#aff",광명불멸:"#ffd",암흑불멸:"#808",창조불멸:"#faf",용왕불멸:"#fa4",신성불멸:"#ffd",혼돈불멸:"#c0f",궁극불멸:"#fff"};
const EE={불:"🔥",물:"💧",땅:"🪨",바람:"🌀",전기:"⚡",얼음:"❄️",빛:"✨",어둠:"🌑",소리:"🔊",무속성:"⭐",
  용암:"👺",폭풍화염:"💣",플라즈마:"🦎",증기:"👻",빙하:"🧊",진흙:"🟤",안개:"🌫️",번개폭풍:"🦅",
  공허:"🧛",공명:"🦇",눈보라:"🌨️",성음:"🔮",암흑파동:"😈",동토:"🦖",돌풍:"💨",화염폭풍:"😈",해일:"🧟",
  번개신:"💀",절대영도:"🐍",신성광:"🧝",심연:"🧟",
  용암폭풍:"🪓",냉기폭풍:"🥶",어둠번개:"⚔️",성스러운얼음:"🧙",빛의해일:"🐲",태풍:"🌪️",뇌신:"⚡",빙하신:"❄️",빛의신:"🌟",어둠신:"💀",천지개벽:"💥",용신:"🐉",신성폭풍:"🪽",혼돈:"🌀",허리케인:"🌊",
  폭풍신화:"👑",번개신화:"⚡",빙하신화:"❄️",광명신화:"🌟",암흑신화:"🌑",창조신화:"✨",용왕신화:"🐉",신성신화:"👑",혼돈신화:"🌀",
  폭풍불멸:"🌊",번개불멸:"⚡",빙하불멸:"❄️",광명불멸:"🌟",암흑불멸:"🌑",창조불멸:"✨",용왕불멸:"🐉",신성불멸:"👑",혼돈불멸:"🌀",궁극불멸:"💫"};
const EN={
  불:"화염정령",물:"물정령",땅:"대지정령",바람:"바람정령",전기:"번개정령",
  얼음:"서리정령",빛:"빛의정령",어둠:"어둠정령",소리:"음파정령",무속성:"무속성",
  용암:"고블린",폭풍화염:"화염폭탄병",플라즈마:"번개도마뱀",증기:"안개유령",
  빙하:"빙하유령",진흙:"진흙골렘",안개:"안개유령",번개폭풍:"폭풍매",
  공허:"뱀파이어",공명:"음파박쥐",눈보라:"눈보라요정",성음:"신성슬라임",
  암흑파동:"어둠임프",동토:"코볼트",돌풍:"돌풍조",화염폭풍:"임프",해일:"구울",
  번개신:"스켈레톤",절대영도:"코볼트",신성광:"하피",심연:"좀비",
  용암폭풍:"오크전사",냉기폭풍:"냉기마법사",어둠번개:"어둠기사",
  성스러운얼음:"네크로맨서",빛의해일:"와이번",태풍:"폭풍독수리",
  뇌신:"뇌신전사",빙하신:"빙하신수",빛의신:"신성폭격수",
  어둠신:"드레드로드",천지개벽:"천지개벽",용신:"용신기사",
  신성폭풍:"타락천사",혼돈:"혼돈술사",허리케인:"타락천사",
  오크킹:"오크킹",리치킹:"리치킹",공허군주:"공허군주",타락신:"타락신",
  어둠의군주:"어둠의군주",
  폭풍신화:"폭풍의신",번개신화:"번개의신",빙하신화:"빙하의신",
  광명신화:"광명의신",암흑신화:"암흑의신",창조신화:"창조신",
  용왕신화:"용왕",신성신화:"신성군주",혼돈신화:"혼돈신",
  폭풍불멸:"폭풍불멸",번개불멸:"번개불멸",빙하불멸:"빙하불멸",
  광명불멸:"광명불멸",암흑불멸:"암흑불멸",창조불멸:"창조불멸",
  용왕불멸:"용왕불멸",신성불멸:"신성불멸",혼돈불멸:"혼돈불멸",궁극불멸:"궁극불멸",
};
const GC={노말:"#aaa",고급:"#4af",영웅:"#a4f",전설:"#fa0",신화:"#f44",불멸:"#f8f"};
const ATK_MAP={노말:10,고급:25,영웅:45,전설:70,신화:100,불멸:150};
const SELL_PRICE={노말:5,고급:10,영웅:20,전설:35,신화:50,불멸:75};
const GRADE_BY_COUNT={2:"노말",3:"고급",4:"고급",5:"영웅",6:"영웅",7:"전설",8:"전설",9:"전설",10:"전설"};

const COMBO=[
  {a:"불",b:"땅",r:"용암",g:"고급"},{a:"불",b:"바람",r:"폭풍화염",g:"고급"},{a:"불",b:"전기",r:"플라즈마",g:"고급"},{a:"불",b:"물",r:"증기",g:"고급"},
  {a:"물",b:"얼음",r:"빙하",g:"고급"},{a:"물",b:"땅",r:"진흙",g:"고급"},{a:"물",b:"바람",r:"안개",g:"고급"},
  {a:"전기",b:"바람",r:"번개폭풍",g:"고급"},{a:"빛",b:"어둠",r:"공허",g:"고급"},{a:"소리",b:"전기",r:"공명",g:"고급"},
  {a:"얼음",b:"바람",r:"눈보라",g:"고급"},{a:"빛",b:"소리",r:"성음",g:"고급"},{a:"어둠",b:"소리",r:"암흑파동",g:"고급"},{a:"땅",b:"얼음",r:"동토",g:"고급"},
  {a:"바람",b:"바람",r:"돌풍",g:"고급"},{a:"불",b:"불",r:"화염폭풍",g:"고급"},{a:"물",b:"물",r:"해일",g:"고급"},
  {a:"전기",b:"전기",r:"번개신",g:"고급"},{a:"얼음",b:"얼음",r:"절대영도",g:"고급"},{a:"빛",b:"빛",r:"신성광",g:"고급"},{a:"어둠",b:"어둠",r:"심연",g:"고급"},
  {a:"돌풍",b:"돌풍",r:"태풍",g:"영웅"},
  {a:"용암",b:"폭풍화염",r:"용암폭풍",g:"영웅"},{a:"빙하",b:"눈보라",r:"냉기폭풍",g:"영웅"},
  {a:"공허",b:"번개폭풍",r:"어둠번개",g:"영웅"},{a:"성음",b:"동토",r:"성스러운얼음",g:"영웅"},
  {a:"해일",b:"성음",r:"빛의해일",g:"영웅"},{a:"화염폭풍",b:"번개폭풍",r:"플라즈마",g:"영웅"},
  {a:"불",b:"돌풍",r:"용암폭풍",g:"영웅"},{a:"물",b:"번개신",r:"빛의해일",g:"영웅"},
  {a:"얼음",b:"절대영도",r:"냉기폭풍",g:"영웅"},{a:"어둠",b:"심연",r:"어둠번개",g:"영웅"},
  {a:"태풍",b:"태풍",r:"허리케인",g:"전설"},{a:"번개신",b:"번개신",r:"뇌신",g:"전설"},
  {a:"절대영도",b:"절대영도",r:"빙하신",g:"전설"},{a:"신성광",b:"신성광",r:"빛의신",g:"전설"},{a:"심연",b:"심연",r:"어둠신",g:"전설"},
  {a:"태풍",b:"번개신",r:"뇌신",g:"전설"},{a:"용암폭풍",b:"냉기폭풍",r:"천지개벽",g:"전설"},
  {a:"용암폭풍",b:"태풍",r:"용신",g:"전설"},{a:"신성광",b:"태풍",r:"신성폭풍",g:"전설"},{a:"심연",b:"어둠번개",r:"혼돈",g:"전설"},
  {a:"태풍",b:"용암폭풍",r:"용신",g:"전설"},{a:"냉기폭풍",b:"절대영도",r:"빙하신",g:"전설"},
  {a:"어둠번개",b:"심연",r:"혼돈",g:"전설"},{a:"빛의해일",b:"신성광",r:"신성폭풍",g:"전설"},
  {a:"허리케인",b:"무속성",r:"폭풍신화",g:"신화"},{a:"뇌신",b:"무속성",r:"번개신화",g:"신화"},
  {a:"빙하신",b:"무속성",r:"빙하신화",g:"신화"},{a:"빛의신",b:"무속성",r:"광명신화",g:"신화"},
  {a:"어둠신",b:"무속성",r:"암흑신화",g:"신화"},{a:"천지개벽",b:"무속성",r:"창조신화",g:"신화"},
  {a:"용신",b:"무속성",r:"용왕신화",g:"신화"},{a:"신성폭풍",b:"무속성",r:"신성신화",g:"신화"},{a:"혼돈",b:"무속성",r:"혼돈신화",g:"신화"},
  {a:"허리케인",b:"태풍",r:"폭풍신화",g:"신화"},{a:"뇌신",b:"번개신",r:"번개신화",g:"신화"},
  {a:"빙하신",b:"절대영도",r:"빙하신화",g:"신화"},{a:"빛의신",b:"신성광",r:"광명신화",g:"신화"},
  {a:"어둠신",b:"심연",r:"암흑신화",g:"신화"},{a:"천지개벽",b:"용암폭풍",r:"창조신화",g:"신화"},
  {a:"용신",b:"태풍",r:"용왕신화",g:"신화"},{a:"혼돈",b:"어둠번개",r:"혼돈신화",g:"신화"},
  {a:"폭풍신화",b:"번개신화",r:"폭풍불멸",g:"불멸"},{a:"빙하신화",b:"광명신화",r:"빙하불멸",g:"불멸"},
  {a:"암흑신화",b:"창조신화",r:"암흑불멸",g:"불멸"},{a:"용왕신화",b:"신성신화",r:"용왕불멸",g:"불멸"},
  {a:"혼돈신화",b:"폭풍신화",r:"혼돈불멸",g:"불멸"},
  {a:"폭풍신화",b:"무속성",r:"폭풍불멸",g:"불멸"},{a:"번개신화",b:"무속성",r:"번개불멸",g:"불멸"},
  {a:"빙하신화",b:"무속성",r:"빙하불멸",g:"불멸"},{a:"광명신화",b:"무속성",r:"광명불멸",g:"불멸"},
  {a:"암흑신화",b:"무속성",r:"암흑불멸",g:"불멸"},{a:"창조신화",b:"무속성",r:"창조불멸",g:"불멸"},
  {a:"용왕신화",b:"무속성",r:"용왕불멸",g:"불멸"},{a:"신성신화",b:"무속성",r:"신성불멸",g:"불멸"},{a:"혼돈신화",b:"무속성",r:"혼돈불멸",g:"불멸"},
  {a:"폭풍불멸",b:"혼돈불멸",r:"궁극불멸",g:"불멸"},{a:"용왕불멸",b:"신성불멸",r:"궁극불멸",g:"불멸"},
];

const ITEMS=["무기","보조무기","목걸이","반지1","반지2","갑옷","모자","신발","장갑"];
const IEM={무기:"⚔️",보조무기:"🗡️",목걸이:"📿",반지1:"💍",반지2:"💍",갑옷:"🛡️",모자:"👒",신발:"👟",장갑:"🧤"};
const IGR={노말:{atk:2,color:"#aaa"},고급:{atk:5,color:"#4af"},영웅:{atk:10,color:"#a4f"}};
const IGRO=["노말","고급","영웅"];

const HH=[
  {id:"warrior",name:"전사",emoji:"⚔️",color:"#c33",desc:"ATK×2.5, SPD+30%",buff:{atkMul:2.5,atk:0,spd:0.30,magic:0}},
  {id:"mage",name:"마법사",emoji:"🧙",color:"#63c",desc:"ATK×2.0, 마법데미지+80%",buff:{atkMul:2.0,atk:0,spd:0,magic:0.80}},
  {id:"rogue",name:"도적",emoji:"🗡️",color:"#363",desc:"ATK×2.0, SPD+60%",buff:{atkMul:2.0,atk:0,spd:0.60,magic:0}},
  {id:"archer",name:"궁수",emoji:"🏹",color:"#c83",desc:"ATK×2.2, SPD+40%",buff:{atkMul:2.2,atk:0,spd:0.40,magic:0}},
  {id:"healer",name:"힐러",emoji:"💚",color:"#3c6",desc:"ATK×1.8, SPD+50%, 마법+50%",buff:{atkMul:1.8,atk:0,spd:0.50,magic:0.50}},
];

// unlockFloor: 해당 층 이상에서만 구매 가능
const SHOP_ITEMS=[
  {id:"advanced",label:"고급 유닛 선택",cost:1,grade:"고급",color:"#4af",unlockFloor:1},
  {id:"hero",label:"영웅 유닛 선택",cost:2,grade:"영웅",color:"#a4f",unlockFloor:1},
  {id:"legend",label:"전설 유닛 선택",cost:3,grade:"전설",color:"#fa0",unlockFloor:1},
  {id:"neutral",label:"무속성 유닛",cost:10,grade:"노말",element:"무속성",color:"#ccc",unlockFloor:50},
];

// 도박 테이블
const GAMBLE_GOLD=[
  {cost:10, label:"10G 도박", results:[
    {prob:0.45,reward:"gold",val:0,desc:"꽝 (0G)"},
    {prob:0.30,reward:"gold",val:15,desc:"+15G"},
    {prob:0.15,reward:"gold",val:30,desc:"+30G"},
    {prob:0.07,reward:"gold",val:60,desc:"+60G"},
    {prob:0.03,reward:"gold",val:150,desc:"+150G 🎉"},
  ]},
  {cost:50, label:"50G 도박", results:[
    {prob:0.40,reward:"gold",val:0,desc:"꽝 (0G)"},
    {prob:0.30,reward:"gold",val:70,desc:"+70G"},
    {prob:0.18,reward:"gold",val:150,desc:"+150G"},
    {prob:0.09,reward:"gold",val:300,desc:"+300G"},
    {prob:0.03,reward:"gold",val:800,desc:"+800G 🎉"},
  ]},
  {cost:100, label:"100G 도박", results:[
    {prob:0.38,reward:"gold",val:0,desc:"꽝 (0G)"},
    {prob:0.30,reward:"gold",val:140,desc:"+140G"},
    {prob:0.18,reward:"gold",val:300,desc:"+300G"},
    {prob:0.10,reward:"gold",val:600,desc:"+600G"},
    {prob:0.04,reward:"gold",val:2000,desc:"+2000G 🎉"},
  ]},
];
const GAMBLE_COIN=[
  {cost:1, label:"1코인 도박", results:[
    {prob:0.45,reward:"coin",val:0,desc:"꽝 (0코인)"},
    {prob:0.30,reward:"coin",val:2,desc:"+2코인"},
    {prob:0.15,reward:"coin",val:4,desc:"+4코인"},
    {prob:0.07,reward:"coin",val:8,desc:"+8코인"},
    {prob:0.03,reward:"coin",val:20,desc:"+20코인 🎉"},
  ]},
  {cost:5, label:"5코인 도박", results:[
    {prob:0.40,reward:"coin",val:0,desc:"꽝 (0코인)"},
    {prob:0.30,reward:"coin",val:7,desc:"+7코인"},
    {prob:0.18,reward:"coin",val:15,desc:"+15코인"},
    {prob:0.09,reward:"coin",val:30,desc:"+30코인"},
    {prob:0.03,reward:"coin",val:80,desc:"+80코인 🎉"},
  ]},
  {cost:10, label:"10코인 도박", results:[
    {prob:0.38,reward:"coin",val:0,desc:"꽝 (0코인)"},
    {prob:0.30,reward:"coin",val:14,desc:"+14코인"},
    {prob:0.18,reward:"coin",val:30,desc:"+30코인"},
    {prob:0.10,reward:"coin",val:60,desc:"+60코인"},
    {prob:0.04,reward:"coin",val:150,desc:"+150코인 🎉"},
  ]},
];

let hid=1,eid=1;
const mkH=(el,g="노말",gradeEnhLv={})=>{
  const lv=gradeEnhLv[g]||0;
  const bonus=lv>0?{atk:(["노말","고급","영웅","전설","신화","불멸"].includes(g)?[5,10,20,35,50,80][["노말","고급","영웅","전설","신화","불멸"].indexOf(g)]:5)*lv,spd:0.05*lv}:{atk:0,spd:0};
  return{id:hid++,element:el,grade:g,atk:(ATK_MAP[g]||10)+bonus.atk,spd:Math.min(1.0+bonus.spd,3.0),range:3.5,col:null,row:null,lastShot:0,enhLv:0,atkType:ETYPE[el]||"single",slowTimer:0,dotDmg:0,dotTimer:0};
};
const mkE=(type,fl=1,rnd=1,isBoss=false,isMid=false)=>{
  const base=isBoss?6000+fl*1600+rnd*400:isMid?2000+fl*600+rnd*200:(120+fl*60)+rnd*30;
  const hp=Math.floor(type==="은신"?base*0.8:type==="공중"?base*1.2:base);
  return{id:eid++,type,hp,maxHp:hp,pathIdx:0,laps:0,
    x:TRACK[0][0]*CS,y:TRACK[0][1]*CS,
    speed:isBoss?0.6:isMid?0.8:type==="공중"?1.4:1.0,
    dmg:isBoss?5:isMid?3:1,remove:false,rewarded:false,
    isBoss,isMid,maxLaps:isBoss||isMid?5:3,
    reward:isBoss?50:isMid?10:1,slowTimer:0,dotDmg:0,dotTimer:0,baseSpeed:isBoss?0.6:isMid?0.8:0};
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
const initGame=()=>({
  heroes:[],hiddenHero:null,enemies:[],projs:[],
  life:20,gold:50,coins:0,floor:1,round:1,
  total:0,running:false,spawnT:0,spawnC:0,maxSpawn:15,
  cleared:false,floorDone:false,over:false,
  bossSpawned:false,midSpawned:false,
  stacks:{},gameTime:0,gradeEnhLv:{}, // {element: count} 뭉쳐진 유닛 보관함
});

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
  const G=useRef(initGame());
  const raf=useRef(null);
  const lt=useRef(0);
  const dragR=useRef(null);
  const spR=useRef(1);
  const gameLoopRef=useRef(null);
  const randomPicksRef=useRef([]);

  const [ui,setUi]=useState({life:20,gold:50,coins:0,floor:1,round:1,total:0,over:false,victory:false});
  const [heroes,setHeroes]=useState([]);
  const [selH,setSelH]=useState(null);
  const [drag,setDrag]=useState(null);
  const [modal,setModal]=useState(null);
  const [showCombo,setShowCombo]=useState(false);
  const [comboFilter,setComboFilter]=useState("전체");
  const [speed,setSpeedState]=useState(1);
  const [selHero,setSelHero]=useState(null);
  const [countdown,setCountdown]=useState(0);
  const [randomPicks,setRandomPicks]=useState([]);
  const [stacks,setStacks]=useState({}); // {element: count}

  const sync=useCallback(()=>{
    const g=G.current;
    setUi({life:g.life,gold:g.gold,coins:g.coins,floor:g.floor,round:g.round,total:g.total,over:g.over,victory:g.victory||false});
    setHeroes([...g.heroes]);
    setStacks({...g.stacks});
  },[]);

  const getBuff=useCallback(()=>{
    const g=G.current;
    if(!g.hiddenHero)return{atk:0,spd:0,magic:0};
    const hd=HH.find(h=>h.id===g.hiddenHero.id);
    return hd?hd.buff:{atk:0,spd:0,magic:0};
  },[]);

  const draw=useCallback(()=>{
    const c=cvs.current;if(!c)return;
    const ctx=c.getContext("2d"),g=G.current;
    ctx.clearRect(0,0,COLS*CS,ROWS*CS);
    ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,COLS*CS,ROWS*CS);
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const isT=TS.has(`${col},${r}`),isC=col===CX&&r===CY;
      ctx.fillStyle=isC?"#2d2d60":isT?"#1e3a1e":"#16213e";
      ctx.fillRect(col*CS,r*CS,CS,CS);ctx.strokeStyle="#0d1b2a";ctx.strokeRect(col*CS,r*CS,CS,CS);
    }
    for(let i=0;i<TRACK.length;i+=3){const[col,r]=TRACK[i];ctx.fillStyle="#2a4a2a";ctx.fillRect(col*CS+22,r*CS+22,4,4);}
    if(dragR.current||selHero){
      for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
        if(TS.has(`${col},${r}`)||(col===CX&&r===CY))continue;
        ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(col*CS,r*CS,CS,CS);
        ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.strokeRect(col*CS,r*CS,CS,CS);
      }
    }
    if(g.hiddenHero){
      const hd=HH.find(h=>h.id===g.hiddenHero.id);
      ctx.fillStyle=(hd?.color||"#888")+"55";ctx.fillRect(CX*CS,CY*CS,CS,CS);
      ctx.font="24px serif";ctx.fillText(hd?.emoji||"?",CX*CS+11,CY*CS+30);
      ctx.fillStyle="#aaffaa";ctx.font="bold 7px sans-serif";ctx.fillText("BUFF",CX*CS+14,CY*CS+44);
    }else{
      ctx.fillStyle="rgba(255,255,255,0.07)";ctx.fillRect(CX*CS,CY*CS,CS,CS);
      ctx.fillStyle="rgba(255,255,255,0.3)";ctx.font="11px sans-serif";ctx.fillText("히든",CX*CS+9,CY*CS+28);
    }
    for(const h of g.heroes){
      if(h.col===null)continue;
      const sel=h.id===dragR.current||h.id===selHero;
      ctx.fillStyle=(EC[h.element]||"#888")+(sel?"aa":"55");
      ctx.fillRect(h.col*CS,h.row*CS,CS,CS);
      if(sel){ctx.strokeStyle="#ffd700";ctx.lineWidth=2;ctx.strokeRect(h.col*CS+1,h.row*CS+1,CS-2,CS-2);ctx.lineWidth=1;}
      ctx.font="20px serif";ctx.fillText(EE[h.element]||"?",h.col*CS+10,h.row*CS+28);
      ctx.fillStyle=GC[h.grade]||"#fff";ctx.font="bold 7px sans-serif";ctx.fillText(h.grade,h.col*CS+2,h.row*CS+40);
      if(h.enhLv>0){ctx.fillStyle="#fd0";ctx.font="bold 8px sans-serif";ctx.fillText(`+${h.enhLv}`,h.col*CS+32,h.row*CS+14);}
    }
    for(const e of g.enemies){
      if(e.remove)continue;
      if(e.type==="은신")ctx.globalAlpha=0.35;
      if(e.slowTimer>0){ctx.fillStyle="rgba(80,80,255,0.25)";ctx.fillRect(e.x,e.y,CS,CS);}
      if(e.dotTimer>0){ctx.fillStyle="rgba(0,255,80,0.2)";ctx.fillRect(e.x,e.y,CS,CS);}
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
    for(const p of g.projs){ctx.fillStyle=p.color||"#ff0";ctx.beginPath();ctx.arc(p.x,p.y,p.size||4,0,Math.PI*2);ctx.fill();}
  },[selHero]);

  const gameLoop=useCallback((t)=>{
    const raw=Math.min((t-lt.current)/1000,0.1);
    const dt=raw*spR.current;lt.current=t;
    const g=G.current;
    if(g.over||!g.running){draw();return;}
    const isMidRound=g.round===5,isBossRound=g.round===10;
    g.spawnT+=dt;
    if(g.spawnT>1.2&&g.spawnC<g.maxSpawn){
      g.spawnT=0;g.spawnC++;
      if(isBossRound&&!g.bossSpawned){g.enemies.push(mkE("일반",g.floor,g.round,true,false));g.bossSpawned=true;}
      else if(isMidRound&&!g.midSpawned){g.enemies.push(mkE("일반",g.floor,g.round,false,true));g.midSpawned=true;}
      else if(!isBossRound&&!isMidRound){
        const types=["일반","일반","은신","공중"];
        g.enemies.push(mkE(types[Math.floor(Math.random()*types.length)],g.floor,g.round));
      }
    }
    for(const e of g.enemies){
      if(e.remove)continue;
      if(!e.baseSpeed)e.baseSpeed=e.speed;
      if(e.slowTimer>0){e.slowTimer-=dt;if(e.slowTimer<=0){e.speed=e.baseSpeed;e.slowTimer=0;}}
      if(e.dotTimer>0){e.dotTimer-=dt;e.hp-=(e.dotDmg||0)*dt;if(e.dotTimer<=0){e.dotDmg=0;e.dotTimer=0;}}
      const[tc,tr]=TRACK[e.pathIdx];
      const tx=tc*CS,ty=tr*CS,dx=tx-e.x,dy=ty-e.y;
      const dist=Math.sqrt(dx*dx+dy*dy),mv=CS*e.speed*dt*1.5;
      if(dist<mv){
        e.x=tx;e.y=ty;e.pathIdx++;
        if(e.pathIdx>=TRACK.length){
          e.pathIdx=0;e.laps=(e.laps||0)+1;
          if(e.laps>=e.maxLaps){e.remove=true;g.life=Math.max(0,g.life-e.dmg);if(g.life<=0)g.over=true;}
        }
      }else{e.x+=dx/dist*mv;e.y+=dy/dist*mv;}
    }
    g.enemies=g.enemies.filter(e=>!e.remove&&e.hp>0);
    g.total=g.enemies.length;
    if(g.total>=30){g.over=true;g.running=false;sync();draw();return;}
    g.gameTime=(g.gameTime||0)+dt; // 배속 반영된 게임시간 누적
    const buff=getBuff();
    const allH=g.heroes.filter(h=>h.col!==null);
    for(const h of allH){
      const hx=h.col*CS+CS/2,hy=h.row*CS+CS/2;
      const baseSpd=(h.spd||1)*(1+buff.spd);
      if(g.gameTime-(h.lastShot||0)<1/baseSpd)continue;
      const rng=(h.range||3.5)*CS;
      let near=null,nd=Infinity;
      for(const e of g.enemies){
        if(e.remove)continue;
        const d=Math.sqrt((e.x+CS/2-hx)**2+(e.y+CS/2-hy)**2);
        if(d<rng&&d<nd){near=e;nd=d;}
      }
      if(near){
        h.lastShot=g.gameTime;
        const baseAtk=((h.atk||10)+(h.enhLv||0)*5)*(buff.atkMul||1)+buff.atk;
        const dmg=Math.floor(baseAtk*(1+buff.magic));
        const col=EC[h.element]||"#ff0";
        const at=h.atkType||"single";
        const hx2=h.col*CS+CS/2,hy2=h.row*CS+CS/2;
        if(at==="single"){
          g.projs.push({x:hx2,y:hy2,tx:near.x+CS/2,ty:near.y+CS/2,tid:near.id,dmg,spd:320,color:col,size:4});
        }else if(at==="splash"){
          const sr=2.2*CS;
          for(const e2 of g.enemies){if(e2.remove)continue;const d2=Math.sqrt((e2.x+CS/2-near.x-CS/2)**2+(e2.y+CS/2-near.y-CS/2)**2);if(d2<sr)g.projs.push({x:hx2,y:hy2,tx:e2.x+CS/2,ty:e2.y+CS/2,tid:e2.id,dmg:d2<CS?dmg:Math.floor(dmg*0.5),spd:260,color:col,size:5});}
        }else if(at==="pierce"){
          const dx2=near.x+CS/2-hx2,dy2=near.y+CS/2-hy2,len=Math.sqrt(dx2*dx2+dy2*dy2)||1,nx=dx2/len,ny=dy2/len;
          for(const e2 of g.enemies){if(e2.remove)continue;const ex=e2.x+CS/2,ey=e2.y+CS/2;const cross=Math.abs((ex-hx2)*ny-(ey-hy2)*nx);const dot=(ex-hx2)*nx+(ey-hy2)*ny;if(cross<CS*0.8&&dot>0)g.projs.push({x:hx2,y:hy2,tx:ex,ty:ey,tid:e2.id,dmg,spd:400,color:col,size:3});}
        }else if(at==="chain"){
          const ct=[near];const cr=2.5*CS;
          for(const e2 of g.enemies){if(e2.remove||e2.id===near.id)continue;const d2=Math.sqrt((e2.x+CS/2-near.x-CS/2)**2+(e2.y+CS/2-near.y-CS/2)**2);if(d2<cr&&ct.length<4)ct.push(e2);}
          ct.forEach((e2,i)=>{const prev=i===0?{x:hx2,y:hy2}:{x:ct[i-1].x+CS/2,y:ct[i-1].y+CS/2};g.projs.push({x:prev.x,y:prev.y,tx:e2.x+CS/2,ty:e2.y+CS/2,tid:e2.id,dmg:Math.floor(dmg*(1-i*0.15)),spd:350,color:col,size:4});});
        }else if(at==="dot"){
          near.dotDmg=(near.dotDmg||0)+dmg*0.25;near.dotTimer=4;
          g.projs.push({x:hx2,y:hy2,tx:near.x+CS/2,ty:near.y+CS/2,tid:near.id,dmg:Math.floor(dmg*0.4),spd:250,color:"#4f4",size:4});
        }else if(at==="slow"){
          if(!near.baseSpeed)near.baseSpeed=near.speed;
          near.slowTimer=2.5;near.speed=near.baseSpeed*0.45;
          g.projs.push({x:hx2,y:hy2,tx:near.x+CS/2,ty:near.y+CS/2,tid:near.id,dmg:Math.floor(dmg*0.7),spd:290,color:"#88f",size:4});
        }else if(at==="multi"){
          for(let mi=0;mi<3;mi++){const sp=(mi-1)*0.12;const dx3=near.x+CS/2-hx2,dy3=near.y+CS/2-hy2,l3=Math.sqrt(dx3*dx3+dy3*dy3)||1;g.projs.push({x:hx2,y:hy2,tx:near.x+CS/2+(dy3/l3)*sp*CS,ty:near.y+CS/2-(dx3/l3)*sp*CS,tid:near.id,dmg:Math.floor(dmg*0.45),spd:440,color:col,size:3});}
        }
      }
    }
    for(const p of g.projs){
      const dx=p.tx-p.x,dy=p.ty-p.y,dist=Math.sqrt(dx*dx+dy*dy),mv=p.spd*dt;
      if(dist<mv){
        p.hit=true;
        const t2=g.enemies.find(e=>e.id===p.tid&&!e.remove&&e.hp>0);
        if(t2){
          t2.hp-=p.dmg;
          if(t2.hp<=0&&!t2.rewarded){
            t2.rewarded=true;g.gold+=t2.reward||1;
            setUi(prev=>({...prev,gold:g.gold}));
          }
        }
      }else{p.x+=dx/dist*mv;p.y+=dy/dist*mv;}
    }
    g.projs=g.projs.filter(p=>!p.hit);
    const spawnDone=(isBossRound&&g.bossSpawned)||(isMidRound&&g.midSpawned)||(!isBossRound&&!isMidRound&&g.spawnC>=g.maxSpawn);
    if(spawnDone&&g.enemies.length===0&&!g.cleared){
      g.running=false;g.cleared=true;
      if(isMidRound||isBossRound)g.coins+=1;
      const clearGold=isBossRound?100:isMidRound?50:10;
      g.gold+=clearGold;
      if(g.round===10){
        g.floorDone=true;
        if(g.floor===1||(g.floor%10===0)){
          const nu=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
          if(pos){nu.col=pos[0];nu.row=pos[1];}g.heroes.push(nu);
        }
        // 100층 클리어 = 게임 클리어
        if(g.floor===100){
          g.victory=true;g.running=false;sync();draw();return;
        }
      }
      if(g.round<10)g.round++;else{g.round=1;g.floor++;}
      g.cleared=false;g.floorDone=false;g.total=0;
      g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
      const nb=g.round===10,nm=g.round===5;
      g.maxSpawn=nb?1:nm?1:15+g.floor*2+g.round;
      sync();setCountdown(3);let cd=3;
      const iv=setInterval(()=>{
        cd--;setCountdown(cd);
        if(cd<=0){clearInterval(iv);if(!G.current.over){G.current.running=true;lt.current=performance.now();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));}}
      },1000);
      return;
    }
    draw();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));
  },[draw,sync,getBuff,setUi]);

  useEffect(()=>{gameLoopRef.current=gameLoop;},[gameLoop]);
  useEffect(()=>{draw();},[draw]);
  useEffect(()=>{draw();},[selHero,drag]);

  const autoStart=(g)=>{
    const nb=g.round===10,nm=g.round===5;
    g.maxSpawn=nb?1:nm?1:15+g.floor*2+g.round;
    g.running=true;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
    sync();lt.current=performance.now();raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
  };

  const pickHidden=(h)=>{
    const g=G.current;
    g.hiddenHero={...h,id:h.id};
    setSelH(h.id);draw();
    setCountdown(3);let cd=3;
    const iv=setInterval(()=>{cd--;setCountdown(cd);if(cd<=0){clearInterval(iv);if(!G.current.over)autoStart(G.current);}},1000);
  };

  const setDragBoth=(id)=>{dragR.current=id;setDrag(id);};

  const onCanvas=(e)=>{
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
    return COMBO.filter(r=>{
      if((r.a===h.element&&myEls.includes(r.b))||(r.b===h.element&&myEls.includes(r.a))){
        if(r.g==="신화"&&g.floor<20)return false;
        if(r.g==="불멸"&&g.floor<50)return false;
        return true;
      }
      return false;
    });
  };

  const doCombine=(heroId,recipe)=>{
    const g=G.current,h1=g.heroes.find(x=>x.id===heroId);
    if(recipe.g==="신화"&&g.floor<20){alert("신화 조합은 20층 이후 가능합니다!");return;}
    if(recipe.g==="불멸"&&g.floor<50){alert("불멸 조합은 50층 이후 가능합니다!");return;}
    const needEl=recipe.a===h1.element?recipe.b:recipe.a;
    const h2=g.heroes.find(x=>x.id!==heroId&&x.element===needEl);
    if(!h1||!h2)return;
    const pos={col:h1.col,row:h1.row};
    const nh=mkH(recipe.r,recipe.g,g.gradeEnhLv||{});
    nh.col=pos.col;nh.row=pos.row;
    const newHeroes=g.heroes.filter(x=>x.id!==h1.id&&x.id!==h2.id);
    newHeroes.push(nh);
    g.heroes=newHeroes;
    setSelHero(null);sync();draw();
  };

  // 등급별 강화 레벨 (전체 공유)
  // g.gradeEnhLv = {노말:0, 고급:0, ...}
  
// 공격 타입 정의
const ATYPE={
  single:{label:"단일",color:"#aaa"},    // 가장 가까운 적 1개
  splash:{label:"범위",color:"#f80"},    // 주변 범위 데미지
  pierce:{label:"관통",color:"#4af"},    // 직선 관통
  chain:{label:"체인",color:"#f4f"},     // 적에서 적으로 튕김
  dot:{label:"독",color:"#4f4"},         // 지속 피해
  slow:{label:"슬로우",color:"#88f"},    // 이동속도 감소
  multi:{label:"연사",color:"#ff4"},     // 다발 공격
};
// 속성별 공격 타입
const ETYPE={
  불:"single",물:"slow",땅:"splash",바람:"pierce",전기:"chain",
  얼음:"slow",빛:"multi",어둠:"dot",소리:"splash",무속성:"single",
  용암:"splash",폭풍화염:"splash",플라즈마:"chain",증기:"slow",
  빙하:"slow",진흙:"slow",안개:"slow",번개폭풍:"chain",
  공허:"dot",공명:"splash",눈보라:"slow",성음:"multi",
  암흑파동:"dot",동토:"slow",돌풍:"pierce",화염폭풍:"splash",해일:"slow",
  번개신:"chain",절대영도:"slow",신성광:"multi",심연:"dot",
  용암폭풍:"splash",냉기폭풍:"slow",어둠번개:"chain",
  성스러운얼음:"slow",빛의해일:"splash",태풍:"pierce",
  뇌신:"chain",빙하신:"slow",빛의신:"multi",어둠신:"dot",
  천지개벽:"splash",용신:"pierce",신성폭풍:"splash",혼돈:"dot",허리케인:"pierce",
  폭풍신화:"pierce",번개신화:"chain",빙하신화:"slow",광명신화:"multi",
  암흑신화:"dot",창조신화:"splash",용왕신화:"splash",신성신화:"multi",혼돈신화:"dot",
  폭풍불멸:"pierce",번개불멸:"chain",빙하불멸:"slow",광명불멸:"multi",
  암흑불멸:"dot",창조불멸:"splash",용왕불멸:"splash",신성불멸:"multi",혼돈불멸:"dot",
  궁극불멸:"splash",
};
const GRADE_ENH_COST={노말:20,고급:50,영웅:100,전설:200,신화:400,불멸:800};
  const GRADE_ENH_BONUS={노말:{atk:5,spd:0.05},고급:{atk:10,spd:0.05},영웅:{atk:20,spd:0.05},전설:{atk:35,spd:0.05},신화:{atk:50,spd:0.05},불멸:{atk:80,spd:0.05}};

  const getGradeEnhLv=(grade)=>(G.current.gradeEnhLv||{})[grade]||0;

  const doGradeEnhance=(grade)=>{
    const g=G.current;
    if(!g.gradeEnhLv)g.gradeEnhLv={};
    const lv=g.gradeEnhLv[grade]||0;
    const cost=GRADE_ENH_COST[grade]*(lv+1);
    if(g.gold<cost){alert(`골드 부족! (${cost}G 필요)`);return;}
    g.gold-=cost;
    g.gradeEnhLv[grade]=(lv+1);
    // 해당 등급 전 유닛에 보너스 적용
    const bonus=GRADE_ENH_BONUS[grade];
    for(const h of g.heroes){
      if(h.grade===grade){
        h.atk+=bonus.atk;
        h.spd=Math.min((h.spd||1)+bonus.spd,3.0);
      }
    }
    sync();draw();
    alert(`✅ ${grade} 등급 전체 강화 완료!\nATK+${bonus.atk} / SPD+${(bonus.spd*100).toFixed(0)}%\n(강화 Lv.${lv+1})`);
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
    const price=SELL_PRICE[h.grade]||5;
    g.gold+=price;
    g.heroes=g.heroes.filter(x=>x.id!==heroId);
    setSelHero(null);
    setUi(prev=>({...prev,gold:g.gold}));
    sync();draw();
  };

  // ── 뭉치기: 같은 속성 유닛을 스택으로 보관
  const getSameElementGroups=()=>{
    const g=G.current;
    const map={};
    for(const h of g.heroes){
      if(!map[h.element])map[h.element]=[];
      map[h.element].push(h);
    }
    return Object.entries(map).filter(([,arr])=>arr.length>=1).map(([el,arr])=>({el,arr}));
  };

  const doStack=(el,count)=>{
    const g=G.current;
    const targets=g.heroes.filter(h=>h.element===el).slice(0,count);
    if(targets.length<count)return;
    const removeIds=new Set(targets.map(x=>x.id));
    const newHeroes=g.heroes.filter(x=>!removeIds.has(x.id));
    g.heroes=newHeroes;
    if(!g.stacks)g.stacks={};
    g.stacks={...g.stacks,[el]:(g.stacks[el]||0)+count};
    setModal(null);sync();draw();
  };

  const popStack=(el)=>{
    const g=G.current;
    if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const newStacks={...g.stacks};
    newStacks[el]-=1;
    if(newStacks[el]===0)delete newStacks[el];
    g.stacks=newStacks;
    const h=mkH(el,"노말",g.gradeEnhLv||{});
    const pos=autoPlace(g.heroes);
    if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes=[...g.heroes,h];
    sync();draw();
  };

  const popStackAll=(el)=>{
    const g=G.current;
    if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const cnt=g.stacks[el];
    const newStacks={...g.stacks};
    delete newStacks[el];
    g.stacks=newStacks;
    const newHeroes=[...g.heroes];
    for(let i=0;i<cnt;i++){
      const h=mkH(el,"노말",g.gradeEnhLv||{});
      const pos=autoPlace(newHeroes);
      if(pos){h.col=pos[0];h.row=pos[1];}
      newHeroes.push(h);
    }
    g.heroes=newHeroes;
    sync();draw();
  };

  const stackCombine=(el)=>{
    const g=G.current;
    if(!g.stacks||!g.stacks[el]||g.stacks[el]<2){alert("스택에 2개 이상 필요합니다.");return;}
    const newStacks={...g.stacks};
    newStacks[el]-=2;
    if(newStacks[el]===0)delete newStacks[el];
    g.stacks=newStacks;
    const recipes=COMBO.filter(r=>r.a===el&&r.b===el);
    let nh;
    if(recipes.length>0){const r=recipes[Math.floor(Math.random()*recipes.length)];nh=mkH(r.r,r.g,g.gradeEnhLv||{});}
    else{nh=mkH(el,"고급",g.gradeEnhLv||{});}
    const pos=autoPlace(g.heroes);
    if(pos){nh.col=pos[0];nh.row=pos[1];}
    g.heroes=[...g.heroes,nh];
    sync();draw();
  };

  // 무작위 3개 조합
  const toggleRandomPick=(heroId)=>{
    setRandomPicks(prev=>{
      let next;
      if(prev.includes(heroId))next=prev.filter(x=>x!==heroId);
      else if(prev.length>=3)next=prev;
      else next=[...prev,heroId];
      randomPicksRef.current=next;
      return next;
    });
  };

  const doRandomMerge=()=>{
    const g=G.current;
    const picks=randomPicksRef.current;
    if(picks.length!==3){alert("3개를 선택하세요!");return;}
    const targets=picks.map(id=>g.heroes.find(h=>h.id===id)).filter(Boolean);
    if(targets.length!==3){alert("선택한 유닛을 찾을 수 없습니다.");return;}
    const els=targets.map(h=>h.element);
    let result=null;
    for(const r of COMBO){
      if(els.includes(r.a)&&els.includes(r.b)){result=r;break;}
    }
    const pos={col:targets[0].col,row:targets[0].row};
    let nh;
    if(result){nh=mkH(result.r,result.g,g.gradeEnhLv||{});}
    else{const pool=COMBO.filter(r=>r.g==="고급");const rnd=pool[Math.floor(Math.random()*pool.length)];nh=mkH(rnd.r,rnd.g,g.gradeEnhLv||{});}
    nh.col=pos.col;nh.row=pos.row;
    const newHeroes=g.heroes.filter(x=>!picks.includes(x.id));
    newHeroes.push(nh);
    g.heroes=newHeroes;
    randomPicksRef.current=[];
    setRandomPicks([]);setModal(null);setSelHero(null);sync();draw();
  };

  const genHeroByElement=(el)=>{
    const g=G.current;
    if(g.gold<10){alert("골드 부족! (10G)");return;}
    g.gold-=10;
    const h=mkH(el,"노말",g.gradeEnhLv||{});
    const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes.push(h);setModal(null);sync();draw();
  };

  const buyWithCoin=(item)=>{
    const g=G.current;
    if(g.coins<item.cost){alert(`코인 부족! (${item.cost}개 필요)`);return;}
    // 무속성은 바로 지급
    if(item.element){
      g.coins-=item.cost;
      const h=mkH(item.element,item.grade,g.gradeEnhLv||{});
      const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
      g.heroes.push(h);setModal(null);sync();draw();return;
    }
    // 나머지는 속성 선택 모달로
    setModal({type:"coinPick",item});
  };

  const buyCoinByElement=(item,el)=>{
    const g=G.current;
    if(g.coins<item.cost){alert(`코인 부족!`);return;}
    g.coins-=item.cost;
    const h=mkH(el,item.grade,g.gradeEnhLv||{});
    const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes.push(h);setModal(null);sync();draw();
  };

  const reset=()=>{
    if(raf.current)cancelAnimationFrame(raf.current);
    hid=1;eid=1;G.current=initGame();dragR.current=null;spR.current=1;
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setStacks({});sync();draw();
  };

  const changeSpeed=(s)=>{spR.current=s;setSpeedState(s);};
  const hd=HH.find(h=>h.id===selH);
  const myEls=new Set(heroes.map(h=>h.element));
  const fCombo=comboFilter==="전체"?COMBO:COMBO.filter(r=>r.g===comboFilter);
  const selHeroObj=heroes.find(h=>h.id===selHero);
  const combOpts=selHero?getCombOptions(selHero):[];
  const buff=getBuff();

  return(
    <div style={{fontFamily:"sans-serif",background:"#0d1117",minHeight:"100vh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",padding:"8px"}}>
      {/* HUD */}
      <div style={{width:"100%",maxWidth:440,display:"flex",justifyContent:"space-between",alignItems:"center",background:"#161b22",borderRadius:10,padding:"6px 10px",marginBottom:4,border:"1px solid #30363d",fontSize:13}}>
        <span>❤️<b style={{color:"#f66"}}>{ui.life}</b></span>
        <span>💰<b style={{color:"#fd0"}}>{ui.gold}G</b></span>
        <span style={{color:"#a78bfa",fontWeight:"bold",cursor:"pointer"}} onClick={()=>setModal("shop")}>🪙{ui.coins}</span>
        <span>🏰{ui.floor}층 R{ui.round}/10</span>
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
      </div>
      {countdown>0&&<div style={{width:"100%",maxWidth:440,textAlign:"center",background:"#1a2a1a",borderRadius:8,padding:"5px",marginBottom:4,border:"1px solid #2a4a2a",fontSize:14,color:"#4f8",fontWeight:"bold"}}>⏱ {countdown}초 후 시작...</div>}
      {/* 캔버스 */}
      <canvas ref={cvs} width={COLS*CS} height={ROWS*CS} onClick={onCanvas}
        style={{width:"100%",maxWidth:440,borderRadius:10,border:`2px solid ${drag?"rgba(255,215,0,0.5)":"#30363d"}`,cursor:drag||selHero?"crosshair":"default"}}/>
      {/* 게임오버 */}
      {ui.over&&<Overlay><div style={{fontSize:40,textAlign:"center"}}>💀</div><div style={{fontSize:20,fontWeight:"bold",color:"#f44",margin:"8px 0",textAlign:"center"}}>게임 오버</div><Btn bg="#c33" onClick={reset}>다시 시작</Btn></Overlay>}
      {ui.victory&&<Overlay>
        <div style={{fontSize:44,textAlign:"center"}}>🏆</div>
        <div style={{fontSize:22,fontWeight:"bold",color:"#fd0",margin:"8px 0",textAlign:"center"}}>100층 클리어!</div>
        <div style={{color:"#4f8",fontSize:14,marginBottom:6,textAlign:"center"}}>축하합니다! 모든 층을 정복했습니다!</div>
        <div style={{color:"#aaa",fontSize:12,marginBottom:16,textAlign:"center"}}>❤️ {ui.life} | 💰 {ui.gold}G | 🏰 {ui.floor}층</div>
        <Btn bg="#1f6feb" onClick={reset}>처음부터</Btn>
      </Overlay>}
      {/* 히든영웅 선택 */}
      {!selH&&(
        <div style={{width:"100%",maxWidth:440,background:"#161b22",borderRadius:10,padding:10,marginTop:6,border:"1px solid #30363d"}}>
          <div style={{fontSize:12,color:"#888",marginBottom:8}}>👑 히든영웅 선택 → 3초 후 자동 시작</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {HH.map(h=>(
              <button key={h.id} onClick={()=>pickHidden(h)}
                style={{background:h.color+"22",border:`1px solid ${h.color}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#eee",fontSize:12,textAlign:"left"}}>
                <div>{h.emoji} <b>{h.name}</b></div>
                <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{h.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 액션 버튼 */}
      <div style={{width:"100%",maxWidth:440,display:"flex",gap:6,marginTop:6}}>
        <Btn bg="#1f6feb" onClick={()=>{
          const g=G.current;
          if(g.gold<10){alert("골드 부족! (10G)");return;}
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
              <div style={{fontSize:10,color:"#aaa"}}>ATK {Math.floor((selHeroObj.atk*(buff.atkMul||1)+buff.atk)*(1+buff.magic))} | SPD {(((selHeroObj.spd||1)*(1+buff.spd))*100).toFixed(0)}% | <span style={{color:ATYPE[selHeroObj.atkType||"single"]?.color}}>{ATYPE[selHeroObj.atkType||"single"]?.label}</span></div>
            </div>
            <button onClick={()=>setSelHero(null)} style={{marginLeft:"auto",background:"#333",border:"none",color:"#aaa",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            <button onClick={()=>{setSelHero(null);setDragBoth(selHeroObj.id);}} style={{background:"#1f6feb",border:"none",color:"#fff",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>📍 이동</button>
            <button onClick={()=>doSell(selHeroObj.id)} style={{background:"#3a1010",border:"1px solid #f66",color:"#f88",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>💰 판매 (+{SELL_PRICE[selHeroObj.grade]||5}G)</button>
          </div>
          {combOpts.length>0&&(
            <><div style={{fontSize:11,color:"#aaa",marginBottom:5}}>⚗️ 조합 가능</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {combOpts.map((r,i)=>(
                <button key={i} onClick={()=>doCombine(selHero,r)}
                  style={{background:GC[r.g]+"22",border:`1px solid ${GC[r.g]}`,borderRadius:8,padding:"4px 9px",cursor:"pointer",color:"#eee",fontSize:11}}>
                  {EE[r.r]||""} {EN[r.r]||r.r} <span style={{color:GC[r.g],fontSize:10}}>[{r.g}]</span>
                </button>
              ))}
            </div></>
          )}
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
              <div style={{fontSize:8,color:ATYPE[h.atkType||"single"]?.color||"#aaa"}}>{ATYPE[h.atkType||"single"]?.label||""}</div>
              <div style={{fontSize:9,color:GC[h.grade]}}>{h.grade}</div>
            </div>
          );
        })}
      </div>
      {/* 히든영웅 버프 */}
      {hd&&(
        <div style={{width:"100%",maxWidth:440,background:hd.color+"18",border:`1px solid ${hd.color}44`,borderRadius:10,padding:"7px 12px",marginTop:4,fontSize:12}}>
          <span style={{color:hd.color,fontWeight:"bold"}}>{hd.emoji} {hd.name}</span>
          <span style={{color:"#aaffaa",marginLeft:8}}>🟢 {hd.desc}</span>
        </div>
      )}
      {/* 코인 속성 선택 모달 */}
      {modal&&modal.type==="coinPick"&&(()=>{
        const item=modal.item;
        const pool=item.grade==="노말"?BASE:item.grade==="고급"?[...new Set(COMBO.filter(r=>r.g==="고급").map(r=>r.r))]:item.grade==="영웅"?[...new Set(COMBO.filter(r=>r.g==="영웅").map(r=>r.r))]:[...new Set(COMBO.filter(r=>r.g==="전설").map(r=>r.r))];
        return(
          <Overlay>
            <div style={{fontSize:15,fontWeight:"bold",color:item.color,marginBottom:4,textAlign:"center"}}>{item.label}</div>
            <div style={{color:"#a78bfa",fontSize:13,marginBottom:10,textAlign:"center"}}>🪙 {item.cost}개 사용</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:12}}>
              {pool.map(el=>(
                <button key={el} onClick={()=>buyCoinByElement(item,el)}
                  style={{background:(EC[el]||"#888")+"33",border:`1px solid ${EC[el]||"#888"}`,borderRadius:10,padding:"8px 6px",cursor:"pointer",color:"#eee",fontSize:12,minWidth:52,textAlign:"center"}}>
                  <div style={{fontSize:18}}>{EE[el]||"?"}</div>
                  <div style={{fontSize:9,color:GC[item.grade]}}>{item.grade}</div>
                  <div style={{fontSize:9}}>{el}</div>
                </button>
              ))}
            </div>
            <Btn bg="#444" onClick={()=>setModal("shop")} style={{width:"100%"}}>← 뒤로</Btn>
          </Overlay>
        );
      })()}

      {/* 등급 강화 모달 */}
      {modal==="gradeEnh"&&(()=>{
        const g=G.current;
        return(
        <Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#fd0",marginBottom:4,textAlign:"center"}}>⬆️ 등급 강화</div>
          <div style={{color:"#aaa",fontSize:11,marginBottom:10,textAlign:"center"}}>강화 시 해당 등급 전 유닛에 즉시 적용</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {["노말","고급","영웅","전설","신화","불멸"].map(grade=>{
              const lv=getGradeEnhLv(grade);
              const cost=GRADE_ENH_COST[grade]*(lv+1);
              const bonus=GRADE_ENH_BONUS[grade];
              const count=heroes.filter(h=>h.grade===grade).length;
              const canAfford=ui.gold>=cost;
              return(
                <div key={grade} style={{background:"#21262d",borderRadius:9,padding:"8px 12px",border:`1px solid ${GC[grade]||"#444"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div>
                      <span style={{color:GC[grade],fontWeight:"bold",fontSize:13}}>{grade}</span>
                      <span style={{color:"#555",fontSize:11,marginLeft:6}}>보유 {count}개</span>
                      {lv>0&&<span style={{color:"#fd0",fontSize:11,marginLeft:6}}>Lv.{lv}</span>}
                    </div>
                    <button onClick={()=>doGradeEnhance(grade)} disabled={!canAfford}
                      style={{background:canAfford?GC[grade]+"33":"#333",border:`1px solid ${canAfford?GC[grade]:"#444"}`,
                        color:canAfford?GC[grade]:"#555",borderRadius:7,padding:"4px 12px",
                        cursor:canAfford?"pointer":"not-allowed",fontSize:12,fontWeight:"bold"}}>
                      💰 {cost}G
                    </button>
                  </div>
                  <div style={{fontSize:10,color:"#888"}}>
                    ATK+{bonus.atk} / SPD+{(bonus.spd*100).toFixed(0)}% → 전 {grade} 유닛 적용
                    {lv>0&&<span style={{color:"#fd0",marginLeft:6}}>누적: ATK+{bonus.atk*lv} / SPD+{(bonus.spd*100*lv).toFixed(0)}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <Btn bg="#333" onClick={()=>setModal(null)} style={{width:"100%"}}>닫기</Btn>
        </Overlay>
        );
      })()}

      {/* 뭉치기 모달 */}
      {modal==="merge"&&(()=>{
        const sameGroups=getSameElementGroups();
        const stackEntries=Object.entries(stacks).filter(([,n])=>n>0);
        return(
        <Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#4f8",marginBottom:10,textAlign:"center"}}>✨ 뭉치기</div>

          {/* 스택 보관함 */}
          {stackEntries.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#4f8",marginBottom:6}}>📦 보관함</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {stackEntries.map(([el,cnt])=>(
                  <div key={el} style={{background:(EC[el]||"#888")+"22",border:`1px solid ${EC[el]||"#888"}`,borderRadius:10,padding:"6px 10px",textAlign:"center",minWidth:68}}>
                    <div style={{fontSize:20}}>{EE[el]||"?"}</div>
                    <div style={{fontSize:11,color:"#eee"}}>{el}</div>
                    <div style={{fontSize:13,color:"#fd0",fontWeight:"bold",margin:"2px 0"}}>×{cnt}</div>
                    <div style={{display:"flex",gap:3,justifyContent:"center",flexWrap:"wrap"}}>
                      <button onClick={()=>popStack(el)} style={{background:"#1f6feb",border:"none",color:"#fff",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10}}>빼기</button>
                      <button onClick={()=>popStackAll(el)} style={{background:"#0a3a7a",border:"1px solid #4af",color:"#4af",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10}}>모두빼기</button>
                    </div>
                    {cnt>=2&&<button onClick={()=>stackCombine(el)} style={{background:"#553300",border:"1px solid #fd0",color:"#fd0",borderRadius:5,padding:"2px 6px",cursor:"pointer",fontSize:10,marginTop:3,width:"100%"}}>조합</button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 배치된 같은 속성 뭉치기 */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#aaa",marginBottom:6}}>🔗 배치된 유닛 보관함에 넣기</div>
            {sameGroups.length===0&&<div style={{fontSize:11,color:"#555"}}>배치된 유닛 없음</div>}
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              {sameGroups.map(({el,arr})=>(
                <div key={el} style={{background:"#21262d",borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:4}}>
                  <span style={{fontSize:13}}>{EE[el]||""} {el} <b style={{color:"#aaa"}}>×{arr.length}</b></span>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>doStack(el,1)}
                      style={{background:"#4f844",border:"1px solid #4f8",color:"#4f8",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
                      넣기
                    </button>
                    <button onClick={()=>doStack(el,arr.length)}
                      style={{background:"#1a3a1a",border:"1px solid #4f8",color:"#4f8",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
                      모두넣기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 무작위 3개 조합 */}
          <div style={{borderTop:"1px solid #30363d",paddingTop:10}}>
            <div style={{fontSize:12,color:"#aaa",marginBottom:6}}>🎲 무작위 3개 조합 <span style={{color:"#fd0"}}>({randomPicks.length}/3)</span></div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {heroes.map(h=>{
                const isPicked=randomPicks.includes(h.id);
                return(
                  <div key={h.id} onClick={()=>toggleRandomPick(h.id)}
                    style={{background:isPicked?"rgba(80,200,80,0.2)":"#21262d",
                      border:`2px solid ${isPicked?"#4f8":GC[h.grade]||"#444"}`,
                      borderRadius:7,padding:"4px 6px",cursor:"pointer",textAlign:"center",minWidth:44}}>
                    <div style={{fontSize:16}}>{EE[h.element]||"?"}</div>
                    <div style={{fontSize:8,color:GC[h.grade]}}>{h.grade}</div>
                  </div>
                );
              })}
            </div>
            <Btn bg={randomPicks.length===3?"#1a5c2a":"#333"} onClick={doRandomMerge} disabled={randomPicks.length!==3} style={{width:"100%",marginBottom:8}}>
              🎲 조합하기 {randomPicks.length===3?"":"(3개 선택)"}
            </Btn>
          </div>
          <Btn bg="#444" onClick={()=>{setModal(null);setRandomPicks([]);randomPicksRef.current=[];}} style={{width:"100%"}}>닫기</Btn>
        </Overlay>
        );
      })()}
      {/* 코인 상점 */}
      {modal==="shop"&&(
        <Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#a78bfa",marginBottom:4,textAlign:"center"}}>🪙 코인 상점</div>
          <div style={{color:"#fd0",fontSize:13,marginBottom:10,textAlign:"center"}}>보유: {ui.coins}개 | 현재 {ui.floor}층</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
            {SHOP_ITEMS.map(item=>{
              const locked=ui.floor<item.unlockFloor;
              return(
                <button key={item.id} onClick={()=>!locked&&buyWithCoin(item)}
                  disabled={ui.coins<item.cost||locked}
                  style={{background:locked?"#21262d":ui.coins>=item.cost?item.color+"22":"#21262d",
                    border:`1px solid ${locked?"#333":ui.coins>=item.cost?item.color:"#333"}`,
                    borderRadius:8,padding:"9px 14px",
                    cursor:locked||ui.coins<item.cost?"not-allowed":"pointer",
                    color:locked?"#444":ui.coins>=item.cost?"#eee":"#555",
                    fontSize:13,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:locked?"#444":item.color,fontWeight:"bold"}}>
                    {locked?`🔒 ${item.label} (${item.unlockFloor}층~)`:item.label}
                  </span>
                  <span style={{color:locked?"#444":"#a78bfa",fontWeight:"bold"}}>🪙 {item.cost}</span>
                </button>
              );
            })}
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn bg="#1a3a2a" onClick={()=>setModal("gamble")} style={{flex:1}}>🎲 도박장</Btn>
            <Btn bg="#333" onClick={()=>setModal(null)} style={{flex:1}}>닫기</Btn>
          </div>
        </Overlay>
      )}

      {/* 도박 모달 */}
      {modal==="gamble"&&(()=>{
        const doGamble=(table,cost,isGold)=>{
          const g=G.current;
          if(isGold&&g.gold<cost){alert("골드 부족!");return;}
          if(!isGold&&g.coins<cost){alert("코인 부족!");return;}
          if(isGold)g.gold-=cost;else g.coins-=cost;
          const rand=Math.random();
          let acc=0,chosen=table.results[table.results.length-1];
          for(const r of table.results){acc+=r.prob;if(rand<acc){chosen=r;break;}}
          if(chosen.reward==="gold")g.gold+=chosen.val;
          else g.coins+=chosen.val;
          sync();
          const icon=chosen.val===0?"😢":chosen.desc.includes("🎉")?"🎉":"😊";
          alert(`${icon} ${chosen.desc}`);
        };
        return(
        <Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:"#fd0",marginBottom:10,textAlign:"center"}}>🎲 도박장</div>
          <div style={{color:"#aaa",fontSize:11,marginBottom:10,textAlign:"center"}}>보유 💰{ui.gold}G | 🪙{ui.coins}</div>
          <div style={{fontSize:12,color:"#4af",marginBottom:6,fontWeight:"bold"}}>💰 골드 도박</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
            {GAMBLE_GOLD.map(t=>(
              <button key={t.cost} onClick={()=>doGamble(t,t.cost,true)}
                disabled={ui.gold<t.cost}
                style={{background:ui.gold>=t.cost?"#2a1a00":"#21262d",border:`1px solid ${ui.gold>=t.cost?"#fd0":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:ui.gold>=t.cost?"pointer":"not-allowed",color:ui.gold>=t.cost?"#fd0":"#555",fontSize:12,display:"flex",justifyContent:"space-between"}}>
                <span>{t.label}</span>
                <span style={{color:"#aaa",fontSize:11}}>최대 {t.results[t.results.length-1].desc}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:12,color:"#a78bfa",marginBottom:6,fontWeight:"bold"}}>🪙 코인 도박</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
            {GAMBLE_COIN.map(t=>(
              <button key={t.cost} onClick={()=>doGamble(t,t.cost,false)}
                disabled={ui.coins<t.cost}
                style={{background:ui.coins>=t.cost?"#1a0a2a":"#21262d",border:`1px solid ${ui.coins>=t.cost?"#a78bfa":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:ui.coins>=t.cost?"pointer":"not-allowed",color:ui.coins>=t.cost?"#a78bfa":"#555",fontSize:12,display:"flex",justifyContent:"space-between"}}>
                <span>{t.label}</span>
                <span style={{color:"#aaa",fontSize:11}}>최대 {t.results[t.results.length-1].desc}</span>
              </button>
            ))}
          </div>
          <div style={{fontSize:12,color:"#4f8",marginBottom:6,fontWeight:"bold",borderTop:"1px solid #30363d",paddingTop:10,marginTop:2}}>⚔️ 유닛 도박</div>
          <div style={{fontSize:10,color:"#888",marginBottom:6}}>성공 시 해당 등급 유닛 획득, 실패 시 꽝</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:10}}>
            {[
              {cost:1,label:"🪙1 — 고급~영웅",desc:"고급 60% / 영웅 30% / 꽝 10%",
               fn:()=>{
                 const g=G.current;if(g.coins<1){alert("코인 부족!");return;}
                 g.coins-=1;const r=Math.random();
                 let grade,result;
                 if(r<0.10){result="꽝";grade=null;}
                 else if(r<0.70){grade="고급";}
                 else{grade="영웅";}
                 if(grade){
                   const pool=grade==="고급"?[...new Set(COMBO.filter(x=>x.g==="고급").map(x=>x.r))]:[...new Set(COMBO.filter(x=>x.g==="영웅").map(x=>x.r))];
                   const el=pool[Math.floor(Math.random()*pool.length)];
                   const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
                   if(pos){h.col=pos[0];h.row=pos[1];}
                   g.heroes=[...g.heroes,h];
                   sync();draw();alert(`✨ ${EE[el]||""} ${el} [${grade}] 획득!`);
                 }else{sync();alert("😢 꽝...");}
               }},
              {cost:3,label:"🪙3 — 영웅~신화",desc:"영웅 50% / 전설 35% / 신화 10% / 꽝 5%",
               fn:()=>{
                 const g=G.current;if(g.coins<3){alert("코인 부족!");return;}
                 if(g.floor<20&&Math.random()>0.5){g.coins-=3;sync();alert("😢 꽝... (신화는 20층 이후 해금)");return;}
                 g.coins-=3;const r=Math.random();
                 let grade;
                 if(r<0.05)grade=null;
                 else if(r<0.55)grade="영웅";
                 else if(r<0.90)grade="전설";
                 else grade=g.floor>=20?"신화":"전설";
                 if(grade){
                   const pool=[...new Set(COMBO.filter(x=>x.g===grade).map(x=>x.r))];
                   const el=pool.length?pool[Math.floor(Math.random()*pool.length)]:BASE[Math.floor(Math.random()*BASE.length)];
                   const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);
                   if(pos){h.col=pos[0];h.row=pos[1];}
                   g.heroes=[...g.heroes,h];
                   sync();draw();alert(`✨ ${EE[el]||""} ${el} [${grade}] 획득!`);
                 }else{sync();alert("😢 꽝...");}
               }},
              {cost:5,label:"🪙5 — 신화 or 무속성",desc:"신화 60% / 무속성 30% / 꽝 10% (50층↑)",
               fn:()=>{
                 const g=G.current;if(g.coins<5){alert("코인 부족!");return;}
                 if(g.floor<50){alert("50층 이후 해금!");return;}
                 g.coins-=5;const r=Math.random();
                 if(r<0.10){sync();alert("😢 꽝...");return;}
                 let h;
                 if(r<0.70){
                   const pool=[...new Set(COMBO.filter(x=>x.g==="신화").map(x=>x.r))];
                   const el=pool[Math.floor(Math.random()*pool.length)];
                   h=mkH(el,"신화",g.gradeEnhLv||{});
                   const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
                   g.heroes=[...g.heroes,h];sync();draw();alert(`✨ ${EE[el]||""} ${el} [신화] 획득!`);
                 }else{
                   h=mkH("무속성","노말",g.gradeEnhLv||{});
                   const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
                   g.heroes=[...g.heroes,h];sync();draw();alert("⭐ 무속성 유닛 획득!");
                 }
               }},
            ].map(item=>(
              <button key={item.cost} onClick={item.fn}
                disabled={ui.coins<item.cost||(item.cost===5&&ui.floor<50)}
                style={{background:ui.coins>=item.cost&&!(item.cost===5&&ui.floor<50)?"#0a2a1a":"#21262d",
                  border:`1px solid ${ui.coins>=item.cost&&!(item.cost===5&&ui.floor<50)?"#4f8":"#333"}`,
                  borderRadius:8,padding:"8px 12px",
                  cursor:ui.coins>=item.cost&&!(item.cost===5&&ui.floor<50)?"pointer":"not-allowed",
                  color:ui.coins>=item.cost&&!(item.cost===5&&ui.floor<50)?"#eee":"#555",fontSize:12,textAlign:"left"}}>
                <div style={{fontWeight:"bold",color:item.cost===5?"#f44":item.cost===3?"#fa0":"#4af"}}>{item.label}</div>
                <div style={{fontSize:10,color:"#888",marginTop:2}}>{item.cost===5&&ui.floor<50?`🔒 50층 이후 해금`:item.desc}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:"#555",marginBottom:8,textAlign:"center"}}>💰골드 도박: 꽝 ~40% | 대박 ~3~4%</div>
          <Btn bg="#444" onClick={()=>setModal("shop")} style={{width:"100%"}}>← 뒤로</Btn>
        </Overlay>
        );
      })()}
      {/* 조합표 */}
      {showCombo&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={()=>setShowCombo(false)}>
          <div style={{background:"#161b22",borderRadius:14,padding:16,border:"1px solid #30363d",width:330,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:"bold",marginBottom:8,fontSize:15}}>⚗️ 조합표</div>
            <div style={{display:"flex",gap:4,marginBottom:10,flexWrap:"wrap"}}>
              {["전체","고급","영웅","전설","신화","불멸"].map(g=>(
                <button key={g} onClick={()=>setComboFilter(g)}
                  style={{background:comboFilter===g?(GC[g]||"#444")+"44":"#21262d",border:`1px solid ${GC[g]||"#555"}`,borderRadius:6,padding:"2px 7px",cursor:"pointer",color:GC[g]||"#eee",fontSize:11}}>{g}</button>
              ))}
            </div>
            {["고급","영웅","전설","신화","불멸"].filter(g=>comboFilter==="전체"||comboFilter===g).map(g=>(
              <div key={g} style={{marginBottom:10}}>
                <div style={{color:GC[g],fontWeight:"bold",fontSize:11,marginBottom:4,borderBottom:"1px solid #333",paddingBottom:2}}>[{g}] {fCombo.filter(r=>r.g===g).length}종</div>
                {fCombo.filter(r=>r.g===g).map((r,i)=>{
                  const can=myEls.has(r.a)&&myEls.has(r.b);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:3,marginBottom:3,fontSize:11,opacity:can?1:0.3,filter:can?"none":"grayscale(100%)"}}>
                      <span>{EE[r.a]||""}{EN[r.a]||r.a}</span><span style={{color:"#555"}}>+</span>
                      <span>{EE[r.b]||""}{EN[r.b]||r.b}</span><span style={{color:"#555"}}>→</span>
                      <span style={{color:can?GC[r.g]:"#555",fontWeight:"bold"}}>{EE[r.r]||""}{EN[r.r]||r.r}</span>
                      {can&&<span style={{color:"#4f8",fontSize:9}}>✓</span>}
                    </div>
                  );
                })}
              </div>
            ))}
            <Btn bg="#333" onClick={()=>setShowCombo(false)} style={{width:"100%",marginTop:6}}>닫기</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
