import { useState, useRef, useEffect, useCallback } from "react";

import { CS, COLS, ROWS, MAP_DEFS, buildMap, applyRotationMap, TRACK, CX, CY, TS, DUAL_PATHS, FORK_PATHS, SPAWN_TILE, GOAL_TILE, CURRENT_MAP } from './constants/mapData';
import { PATCH_NOTES, BASE, UNLOCK_ELEMENTS, UNLOCK_GRADES, GC, NEXT_GRADE, SELL_PRICE, COMBO, RECIPES, getDexByGrade, HH, isBossWeak, SHOP_ITEMS, GAMBLE_GOLD, GAMBLE_COIN, SUPABASE_URL, SUPABASE_KEY, elBase, GRADE_FX, getElTrait, getWaveType, autoPlace, initGame, loadSprite, mkH, mkE, makeBoss, hr, EC, EE, EN, SPRITE_CACHE, resetIds } from './constants/gameData';
import { getCombOptions as comboGetCombOptions, canRecipe as comboCanRecipe, doRecipe as comboDoRecipe, doCombine as comboDoCombine } from './game/combos';
import SummonOverlay from './components/SummonOverlay';
import Overlay from './components/Overlay';
import Btn from './components/Btn';
import { useToasts } from './hooks/useToasts';
import { useRanking } from './hooks/useRanking';
import { useChat } from './hooks/useChat';

export default function App(){
  // 모든 화면 스크롤 완전 차단
  useEffect(()=>{
    const noScroll=(e)=>{
      // 모달 내부 스크롤 허용 (overflowY:auto/scroll 요소)
      let el=e.target;
      while(el&&el!==document.body){
        const s=window.getComputedStyle(el);
        if(s.overflowY==='auto'||s.overflowY==='scroll'){return;}
        el=el.parentElement;
      }
      e.preventDefault();
    };
    const style=document.createElement('style');
    style.innerHTML='html,body{overflow:hidden!important;position:fixed!important;width:100%!important;height:100%!important;margin:0!important;padding:0!important;}#root,#__next{padding-top:env(safe-area-inset-top,0px);box-sizing:border-box;}';
    document.head.appendChild(style);
    document.addEventListener('touchmove',noScroll,{passive:false});
    return()=>{
      document.head.removeChild(style);
      document.removeEventListener('touchmove',noScroll);
    };
  },[]);

  // 홈화면 내렸다 복귀 시 게임 루프 재개
  useEffect(()=>{
    const onVisibility=()=>{
      if(document.visibilityState==='visible'){
        const g=G.current;
        if(!g||g.over)return;
        // RAF가 죽어있으면 재시작
        if(!raf.current){
          lt.current=performance.now();
          raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
        }
        // 카운트다운 중이었으면 draw만 다시
        if(safeDrawRef.current)safeDrawRef.current();
      }else{
        // 백그라운드 진입 시 RAF 중단 (배터리 절약)
        if(raf.current){cancelAnimationFrame(raf.current);raf.current=null;}
      }
    };
    document.addEventListener('visibilitychange',onVisibility);
    return()=>document.removeEventListener('visibilitychange',onVisibility);
  },[]);
  // ── RAF 안전 시작 헬퍼 (중복 루프 방지)
  const startRAFRef=useRef(null);
  const cvs=useRef(null);
  const G=useRef(null);
  const raf=useRef(null);
  const lt=useRef(0);
  const dragR=useRef(null);
  const spR=useRef(1);
  const gameLoopRef=useRef(null);
  const safeDrawRef=useRef(null);
  const selHeroRef=useRef(null);
  const randomPicksRef=useRef([]);
  const transformPicksRef=useRef([]);

  // 게임 화면 단계: 'title' | 'diff' | 'hidden' | 'game'
  const [phase,setPhase]=useState('title');
  const [difficulty,setDifficulty]=useState('easy');
  const [clearCount,setClearCount]=useState(()=>{try{const nick=localStorage.getItem("nickname")||"";return nick?parseInt(localStorage.getItem("cc_"+nick)||"0"):0;}catch{return 0;}});
  const [isAdminMode,setIsAdminMode]=useState(false);
  // 닉네임 기반 clearCount 로드 헬퍼
  const loadClearCount=(nick)=>{try{return parseInt(localStorage.getItem('cc_'+nick)||'0');}catch{return 0;}};
  const saveClearCount=(nick,n)=>{try{localStorage.setItem('cc_'+nick,String(n));}catch{}};
  // 서버에서 clear_count 불러오기
  const loadClearCountFromServer=async(nick)=>{
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/rankings?name=eq.${encodeURIComponent(nick)}&select=clear_count`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const data=await res.json();
      const serverCount=data&&data[0]&&data[0].clear_count!=null?parseInt(data[0].clear_count)||0:0;
      const localCount=loadClearCount(nick);
      const finalCount=Math.max(serverCount,localCount);
      saveClearCount(nick,finalCount);
      // 로컬이 서버보다 높으면 서버도 업데이트
      if(finalCount>serverCount&&data&&data[0]){
        fetch(`${SUPABASE_URL}/rest/v1/rankings?name=eq.${encodeURIComponent(nick)}`,{
          method:'PATCH',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({clear_count:finalCount}),
        }).catch(()=>{});
      }
      return finalCount;
    }catch(e){console.error('loadClearCount server error',e);}
    return loadClearCount(nick);
  };
  const [showCheatModal,setShowCheatModal]=useState(false);
  const [showNicknamePrompt,setShowNicknamePrompt]=useState(false);
  const [cheatInput,setCheatInput]=useState('');
  const cheatPressTimer=useRef(null);
  const savedThisGameRef=useRef(false);
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
  const [showAdminPwPrompt,setShowAdminPwPrompt]=useState(false);
  const [adminPwInput,setAdminPwInput]=useState('');
  const pendingNicknameRef=useRef('');
  // 일반 닉네임 비밀번호 시스템
  const [showUserPwPrompt,setShowUserPwPrompt]=useState(false);
  const [nicknameErr,setNicknameErr]=useState(""); // 비밀번호 입력 모달
  const [userPwInput,setUserPwInput]=useState('');
  const [userPwMode,setUserPwMode]=useState('login'); // 'register' | 'login'
  const [userPwMsg,setUserPwMsg]=useState(''); // 안내 메시지
  const ADMIN_PASSWORD="gkdlgkdl5!";
  const ADMIN_KEYWORDS=["운영","운영자","영자"];
  const containsAdminKeyword=(s)=>ADMIN_KEYWORDS.some(k=>s.includes(k));

  // 닉네임 욕설/비속어 목록
  const BANNED_WORDS=["씨발","시발","씨팔","시팔","씨빨","ㅅㅂ","ㅆㅂ","개새","개새끼","새끼","미친","미친놈","미친년","병신","ㅂㅅ","지랄","ㅈㄹ","좆","좃","보지","보지년","자지","자지새끼","쌍년","쌍놈","창녀","창년","걸레","쓰레기","개같","개쓰레기","뒤져","뒤지","죽어","꺼져","닥쳐","섹스","섹시","야동","야한","음란","성교","강간","성폭","항문","fuck","sex","porn","nude","naked","bitch","asshole","shit","bastard","cock","dick","pussy","ass"];
  // 자음/모음만 있는지 체크 (ㄱ-ㅎ: 자음, ㅏ-ㅣ: 모음)
  const hasIncompleteKorean=(s)=>/[ㄱ-ㅎㅏ-ㅣ]/.test(s);
  // 완성된 한글+영문+숫자+공백만 허용
  const isValidNickname=(s)=>{
    if(hasIncompleteKorean(s))return{ok:false,msg:"완성된 글자만 입력할 수 있어요 (자음/모음 단독 불가)"};
    if(!/^[가-힣a-zA-Z0-9 _-]+$/.test(s))return{ok:false,msg:"특수문자는 사용할 수 없어요"};
    if(s.length<1)return{ok:false,msg:"닉네임을 입력해주세요"};
    const lower=s.toLowerCase();
    const banned=BANNED_WORDS.find(w=>lower===w.toLowerCase());
    if(banned)return{ok:false,msg:"사용할 수 없는 닉네임이에요"};
    return{ok:true,msg:""};
  };
  const handleNicknameChange=(val,maxLen)=>{
    const trimmedVal=maxLen?val.slice(0,maxLen):val;
    setNickname(trimmedVal);
    // 실시간 자음/모음 체크
    if(hasIncompleteKorean(trimmedVal)){setNicknameErr("자음/모음만 입력할 수 없어요");}
    else{setNicknameErr("");}
  };
  // 입력 완료 시점(blur/확인버튼)에 운영자 키워드 체크
  const confirmNickname=()=>{
    const trimmedVal=nickname.trim();
    if(!trimmedVal)return false;
    // 닉네임 유효성 검사
    if(!containsAdminKeyword(trimmedVal)){
      const valid=isValidNickname(trimmedVal);
      if(!valid.ok){alert(valid.msg);return false;}
    }
    if(containsAdminKeyword(trimmedVal)){
      pendingNicknameRef.current=trimmedVal;
      setNickname('');
      setShowAdminPwPrompt(true);
      return false;
    }
    // 일반 닉네임 비밀번호 체크
    pendingNicknameRef.current=trimmedVal;
    setNickname('');
    const stored=localStorage.getItem('upw_'+trimmedVal);
    if(stored){
      // 기존 유저 → 로그인
      setUserPwMode('login');
      setUserPwMsg('');
    } else {
      // 신규 유저 → 등록
      setUserPwMode('register');
      setUserPwMsg('');
    }
    setUserPwInput('');
    setShowUserPwPrompt(true);
    return false;
  };
  const {toasts,pushToast}=useToasts();
  const {showRanking,setShowRanking,ranking,multiRanking,rankLoading,rankPeriod,setRankPeriod,rankMode,setRankMode,loadRanking}=useRanking();
  const [ui,setUi]=useState({life:20,gold:50,coins:0,round:1,total:0,over:false,victory:false});
  const [heroes,setHeroes]=useState([]);
  const [selH,setSelH]=useState(null);
  const [selEnemy,setSelEnemy]=useState(null);
  const [drag,setDrag]=useState(null);
  const [modal,setModal]=useState(null);
  const [showCombo,setShowCombo]=useState(false);
  const [showDex,setShowDex]=useState(false);
  const [dexTab,setDexTab]=useState('dex'); // 'dex' | 'combo'
  const [dexGradeFilter,setDexGradeFilter]=useState('노말');
  const {showChat,setShowChat,chatScrollRef,onlineUsers,totalUsersCount,chatTab,setChatTab,chatMessages,chatInput,setChatInput,chatLoading,loadChatMessages,sendChatMessage,isAdmin}=useChat(nickname,phase,pushToast,containsAdminKeyword);
  const [comboFilter,setComboFilter]=useState("고급");
  const [comboSearch,setComboSearch]=useState("");
  const [speed,setSpeedState]=useState(1);
  const [selHero,setSelHeroState]=useState(null);
  const setSelHero=(id)=>{setSelHeroState(id);selHeroRef.current=id;};
  const [countdown,setCountdown]=useState(0);
  const countdownRef=useRef(null);
  const countdownValRef=useRef(0);
  const [randomPicks,setRandomPicks]=useState([]);
  const [transformPicks,setTransformPicks]=useState([]);
  const [mergeTab,setMergeTab]=useState("storage"); // "storage" | "alchemy"
  const [stacks,setStacks]=useState({});
  const [summonAnim,setSummonAnim]=useState(null);
  const [detailHero,setDetailHero]=useState(null); // 상세정보 모달
  const longPressTimer=useRef(null);
  const [currentMapName,setCurrentMapName]=useState('');
  const [rotMode,setRotMode]=useState(false); // 회전 모드 여부
  const [heroListTab,setHeroListTab]=useState("placed"); // "placed" | "waiting"

  // ── 멀티플레이 state
  const [multiPhase,setMultiPhase]=useState(null);
  const multiPhaseRef=useRef(null);
  const setMultiPhaseWithRef=(v)=>{multiPhaseRef.current=v;setMultiPhase(v);};
  const [myRoomId,setMyRoomId]=useState(null);
  const [roomPlayers,setRoomPlayers]=useState([]);
  const [roomInfo,setRoomInfo]=useState(null);
  const [joinInput,setJoinInput]=useState('');
  const [multiEnemiesClear,setMultiEnemiesClear]=useState(false);
  const [selectedRoom,setSelectedRoom]=useState(null);
  const [multiSpeed,setMultiSpeed]=useState(1);
  const [showMultiStatus,setShowMultiStatus]=useState(false);
  const multiSyncRef=useRef(null); // 멀티 현황판
  const [roomTypeSelect,setRoomTypeSelect]=useState('public');
  const [customRoomCode,setCustomRoomCode]=useState('');
  const [publicRooms,setPublicRooms]=useState([]);
  const [publicRoomsLoading,setPublicRoomsLoading]=useState(false);
  const multiPollRef=useRef(null);
  const multiSkipPollRef=useRef(null);
  const isHostRef=useRef(false);

  const triggerSummon=(el,grade)=>{
    if(!["전설","신화","불멸"].includes(grade))return;
    setSummonAnim({element:el,grade});
  };
  // 개인 뽑기/조합 로그
  const [pullLog,setPullLog]=useState([]);
  const logPull=(action,el,grade)=>{
    setPullLog(prev=>[{id:Date.now()+Math.random(),action,el,grade,ts:new Date()},...prev].slice(0,100));
  };
  const notifyResult=(action,el,grade)=>{
    pushToast(`${action} ${EE[el]||""} ${EN[el]||el} [${grade}]`,GC[grade]||"#94a3b8");
    logPull(action,el,grade);
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
    try{
    const c=cvs.current;if(!c)return;
    const ctx=c.getContext("2d"),g=G.current;
    // ctx 상태 완전 초기화 (이전 프레임 오염 방지)
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
    ctx.shadowBlur=0;ctx.shadowColor="transparent";
    ctx.setLineDash([]);ctx.lineWidth=1;ctx.fillStyle="#060d1a";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.clearRect(0,0,COLS*CS,ROWS*CS);
    ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,COLS*CS,ROWS*CS);

    // ── 배경
    ctx.fillStyle="#0d1117";ctx.fillRect(0,0,COLS*CS,ROWS*CS);

    // ── 타일 배경
    const bgTheme=g?.bgTheme||'stone';
    for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
      const isT=TS.has(`${col},${r}`),isC=col===CX&&r===CY;
      const isSpawn=DUAL_PATHS
        ?((col===DUAL_PATHS.spawnA[0]&&r===DUAL_PATHS.spawnA[1])||(col===DUAL_PATHS.spawnB[0]&&r===DUAL_PATHS.spawnB[1]))
        :(col===SPAWN_TILE[0]&&r===SPAWN_TILE[1]);
      const isGoal=DUAL_PATHS
        ?((col===DUAL_PATHS.goalA[0]&&r===DUAL_PATHS.goalA[1])||(col===DUAL_PATHS.goalB[0]&&r===DUAL_PATHS.goalB[1]))
        :(col===GOAL_TILE[0]&&r===GOAL_TILE[1]);
      const tx=col*CS,ty=r*CS;
      if(isSpawn||isGoal){
        ctx.fillStyle="#111827";ctx.fillRect(tx,ty,CS,CS);
      } else if(isC){
        // 히든영웅 슬롯
        ctx.fillStyle="#1e1b4b";ctx.fillRect(tx,ty,CS,CS);
        ctx.strokeStyle="#3730a3";ctx.lineWidth=1;ctx.strokeRect(tx+0.5,ty+0.5,CS-1,CS-1);ctx.lineWidth=1;
      } else if(isT){
        // 경로 타일
        if(bgTheme==='grass'){
          // 풀밭 테마: 흙길
          ctx.fillStyle="#5c3d1a";ctx.fillRect(tx,ty,CS,CS);
          ctx.fillStyle="#4a2f10";
          ctx.fillRect(tx+3,ty+3,4,3);ctx.fillRect(tx+CS-9,ty+CS-8,5,3);
          ctx.fillRect(tx+CS/2-2,ty+CS/2-1,4,3);
          ctx.strokeStyle="#3d2408";ctx.lineWidth=1;ctx.strokeRect(tx,ty,CS,CS);
        } else {
          // 돌바닥 테마: 어두운 돌길
          ctx.fillStyle="#2a2a35";ctx.fillRect(tx,ty,CS,CS);
          ctx.fillStyle="#222230";
          ctx.fillRect(tx+2,ty+2,CS/2-3,CS/2-3);
          ctx.fillRect(tx+CS/2+1,ty+CS/2+1,CS/2-3,CS/2-3);
          ctx.strokeStyle="#1a1a22";ctx.lineWidth=1;ctx.strokeRect(tx,ty,CS,CS);
          // 돌 균열
          ctx.strokeStyle="#1e1e28";ctx.lineWidth=0.5;
          ctx.beginPath();ctx.moveTo(tx+CS/2,ty+2);ctx.lineTo(tx+CS/2+3,ty+CS/2);ctx.stroke();
        }
      } else {
        // 일반 배치 타일
        if(bgTheme==='grass'){
          // 풀밭 테마
          ctx.fillStyle="#1a3320";ctx.fillRect(tx,ty,CS,CS);
          ctx.fillStyle="#152a1a";
          // 풀 느낌 점점
          ctx.fillRect(tx+5,ty+4,2,3);ctx.fillRect(tx+CS-9,ty+7,2,3);
          ctx.fillRect(tx+CS/2,ty+CS-10,2,3);ctx.fillRect(tx+8,ty+CS-7,2,3);
          ctx.strokeStyle="#112216";ctx.lineWidth=1;ctx.strokeRect(tx,ty,CS,CS);
        } else {
          // 돌바닥 테마
          ctx.fillStyle="#16161f";ctx.fillRect(tx,ty,CS,CS);
          // 돌 블록 패턴
          const brickH=CS/2;
          const offset=r%2===0?0:CS/2;
          ctx.fillStyle="#111118";
          ctx.fillRect(tx+offset,ty,CS/2-1,brickH-1);
          ctx.fillRect(tx+offset-CS/2,ty+brickH,CS/2-1,brickH-1);
          ctx.fillRect(tx+offset+CS/2,ty+brickH,CS/2-1,brickH-1);
          ctx.strokeStyle="#0e0e15";ctx.lineWidth=1;ctx.strokeRect(tx,ty,CS,CS);
        }
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

    // ── X자 맵 경로 색상
    if(DUAL_PATHS){
      DUAL_PATHS.pathA.forEach(([col,r])=>{
        ctx.fillStyle="rgba(59,130,246,0.13)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
      DUAL_PATHS.pathB.forEach(([col,r])=>{
        ctx.fillStyle="rgba(168,85,247,0.13)";ctx.fillRect(col*CS+1,r*CS+1,CS-2,CS-2);
      });
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
    const drawSpawnTile=(sc,sr)=>{
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
      ctx.textAlign="left";ctx.textBaseline="alphabetic";
    };
    const drawGoalTile=(gc2,gr)=>{
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
      ctx.textAlign="left";ctx.textBaseline="alphabetic";
    };
    if(DUAL_PATHS){
      drawSpawnTile(DUAL_PATHS.spawnA[0],DUAL_PATHS.spawnA[1]);
      drawSpawnTile(DUAL_PATHS.spawnB[0],DUAL_PATHS.spawnB[1]);
      drawGoalTile(DUAL_PATHS.goalA[0],DUAL_PATHS.goalA[1]);
      drawGoalTile(DUAL_PATHS.goalB[0],DUAL_PATHS.goalB[1]);
    } else {
      drawSpawnTile(SPAWN_TILE[0],SPAWN_TILE[1]);
      drawGoalTile(GOAL_TILE[0],GOAL_TILE[1]);
    }

    // 배치 가이드
    if(dragR.current||selHero){
      for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++){
        if(TS.has(`${col},${r}`)||(col===CX&&r===CY))continue;
        ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(col*CS,r*CS,CS,CS);
        ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.strokeRect(col*CS,r*CS,CS,CS);
      }
    }

    // 선택된 유닛 사거리 표시 (선택 중 + 재배치 중 모두)
    if(g&&(selHeroRef.current||dragR.current)){
      const sh=g.heroes.find(h=>h.id===(selHeroRef.current||dragR.current));
      if(sh&&sh.col!==null&&sh.row!==null&&!isNaN(sh.col)&&!isNaN(sh.row)){
        const hx=sh.col*CS+CS/2,hy=sh.row*CS+CS/2;
        const rng=Math.min((sh.range||3.0)*CS, COLS*CS); // 최대 맵 크기로 제한
        const gc=GC[sh.grade]||"#aaa";
        if(gc&&!isNaN(rng)){
        // 사거리 채우기
        ctx.save();
        ctx.beginPath();ctx.arc(hx,hy,rng,0,Math.PI*2);
        ctx.fillStyle=hr(gc,0.06);
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
        } // end if(gc&&!isNaN(rng))
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
      // 등급별 이미지 크기: 노말40/고급48/영웅60/전설72/신화88/불멸104
      const IMG_SIZE={노말:48,고급:56,영웅:68,전설:80,신화:96,불멸:112};
      const iSz=IMG_SIZE[h.grade]||40;
      const iOff=(CS-iSz)/2;
      if(spr&&spr.complete&&spr.naturalWidth>0){ctx.drawImage(spr,hx+iOff,hy+iOff,iSz,iSz);}
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
      // 꼬리 잔상
      if(fx.trail>0){
        const mdx=p.tx-p.sx,mdy=p.ty-p.sy,mlen=Math.sqrt(mdx*mdx+mdy*mdy)||1;
        const ux2=mdx/mlen,uy2=mdy/mlen;
        const trailLen=fx.trail*2.5;
        const grad=ctx.createLinearGradient(p.x,p.y,p.x-ux2*trailLen,p.y-uy2*trailLen);
        grad.addColorStop(0,c+'cc');grad.addColorStop(1,c+'00');
        ctx.globalAlpha=0.6;ctx.strokeStyle=grad;
        ctx.lineWidth=Math.max(1.5,fx.trail/2.5);
        ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-ux2*trailLen,p.y-uy2*trailLen);ctx.stroke();
      }
      // 등급별 궤도 파티클
      if(fx.orbits>0){
        for(let i=0;i<fx.orbits;i++){
          const ang=p.age*10+i*(Math.PI*2/fx.orbits);
          const orR=fx.projR+2;
          ctx.globalAlpha=0.7;ctx.fillStyle=c;
          ctx.beginPath();ctx.arc(p.x+Math.cos(ang)*orR,p.y+Math.sin(ang)*orR,1.2,0,Math.PI*2);ctx.fill();
        }
      }
      // 불멸: 추가 링
      if(p.grade==="불멸"){
        ctx.globalAlpha=0.35;ctx.strokeStyle="#fff";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(p.x,p.y,fx.projR+4+Math.sin(p.age*12)*2,0,Math.PI*2);ctx.stroke();
      }
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
      const fx2=GRADE_FX[im.grade]||GRADE_FX.노말;
      const baseR=fx2.impactR*0.3,growR=fx2.impactGrow;
      const lw=im.grade==="불멸"?3:im.grade==="신화"?2.5:im.grade==="전설"?2:1.5;
      ctx.save();
      // 쇼크웨이브 (전설 이상)
      if(fx2.shockwave){
        ctx.globalAlpha=(1-prog)*0.35;
        ctx.strokeStyle="#fff";ctx.lineWidth=lw+1;
        ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*1.5,0,Math.PI*2);ctx.stroke();
      }
      ctx.globalAlpha=1-prog;
      switch(eb){
        case "불": {
          ctx.shadowColor=c;ctx.shadowBlur=fx2.glow;
          const cnt=im.grade==="불멸"?10:im.grade==="신화"?8:im.grade==="전설"?6:5;
          ctx.fillStyle=c;
          for(let i=0;i<cnt;i++){const ang=i*(Math.PI*2/cnt)+prog;ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.75,im.y+Math.sin(ang)*prog*growR*0.75,lw+1,0,Math.PI*2);ctx.fill();}
          ctx.strokeStyle="#ff0";ctx.lineWidth=lw;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*0.6,0,Math.PI*2);ctx.stroke();
          break;
        }
        case "물": {
          for(let r=0;r<fx2.rings;r++){ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.globalAlpha=(1-prog)*(1-r*0.3);ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*(0.6+r*0.4),0,Math.PI*2);ctx.stroke();}
          break;
        }
        case "땅": {
          const cnt2=im.grade==="불멸"?8:im.grade==="신화"?6:4;
          ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=fx2.glow*0.5;
          for(let i=0;i<cnt2;i++){const ang=i*(Math.PI*2/cnt2)+prog*2;ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.7,im.y+Math.sin(ang)*prog*growR*0.7-prog*6,lw+1,0,Math.PI*2);ctx.fill();}
          break;
        }
        case "바람": {
          ctx.shadowColor=c;ctx.shadowBlur=fx2.glow*0.5;
          for(let r=0;r<fx2.rings;r++){ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.globalAlpha=(1-prog)*(1-r*0.25);ctx.save();ctx.translate(im.x,im.y);ctx.rotate(prog*(6+r*2));ctx.beginPath();ctx.arc(0,0,baseR+prog*growR*(0.5+r*0.5),0,Math.PI*1.5);ctx.stroke();ctx.restore();}
          break;
        }
        case "전기": {
          ctx.shadowColor=c;ctx.shadowBlur=fx2.glow;
          const bolts=im.grade==="불멸"?8:im.grade==="신화"?6:im.grade==="전설"?5:4;
          ctx.strokeStyle=c;ctx.lineWidth=lw;
          for(let i=0;i<bolts;i++){const ang=i*(Math.PI*2/bolts)+Math.random()*0.3;const r2=baseR+prog*growR;ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*r2*0.5+Math.random()*6-3,im.y+Math.sin(ang)*r2*0.5+Math.random()*6-3);ctx.lineTo(im.x+Math.cos(ang)*r2,im.y+Math.sin(ang)*r2);ctx.stroke();}
          break;
        }
        case "얼음": {
          const spokes=im.grade==="불멸"?12:im.grade==="신화"?8:6;
          ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.shadowColor=c;ctx.shadowBlur=fx2.glow*0.5;
          for(let i=0;i<spokes;i++){const ang=i*(Math.PI*2/spokes);ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*(baseR+prog*growR*0.9),im.y+Math.sin(ang)*(baseR+prog*growR*0.9));ctx.stroke();}
          break;
        }
        case "빛": {
          ctx.shadowColor="#fff";ctx.shadowBlur=fx2.glow*1.5;
          ctx.fillStyle="#fff";ctx.globalAlpha=(1-prog)*0.6;ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*0.4,0,Math.PI*2);ctx.fill();
          for(let r=0;r<fx2.rings;r++){ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.globalAlpha=(1-prog)*(1-r*0.3);ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*(0.5+r*0.5),0,Math.PI*2);ctx.stroke();}
          break;
        }
        case "어둠": {
          const darks=im.grade==="불멸"?3:im.grade==="신화"?2:1;
          for(let r=0;r<darks;r++){ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.globalAlpha=(1-prog)*(1-r*0.3);ctx.beginPath();ctx.arc(im.x,im.y,baseR+(1-prog)*growR*(0.4+r*0.4),0,Math.PI*2);ctx.stroke();}
          break;
        }
        case "독": {
          const dots=im.grade==="불멸"?10:im.grade==="신화"?8:6;
          ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=fx2.glow*0.5;
          for(let i=0;i<dots;i++){const ang=i*(Math.PI*2/dots)+prog*2;ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*prog*growR*0.75,im.y+Math.sin(ang)*prog*growR*0.75,lw+0.5,0,Math.PI*2);ctx.fill();}
          break;
        }
        case "나무": {
          const branches=im.grade==="불멸"?8:im.grade==="신화"?6:5;
          ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.shadowColor=c;ctx.shadowBlur=fx2.glow*0.5;
          for(let i=0;i<branches;i++){const ang=i*(Math.PI*2/branches)-Math.PI/2;ctx.beginPath();ctx.moveTo(im.x,im.y);ctx.lineTo(im.x+Math.cos(ang)*(baseR+prog*growR),im.y+Math.sin(ang)*(baseR+prog*growR));ctx.stroke();}
          break;
        }
        default: {
          for(let r=0;r<fx2.rings;r++){ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.globalAlpha=(1-prog)*(1-r*0.3);ctx.beginPath();ctx.arc(im.x,im.y,baseR+prog*growR*(0.5+r*0.5),0,Math.PI*2);ctx.stroke();}
        }
      }
      // 전설 이상: 흰 링 추가
      if(fx2.rings>=2){
        ctx.strokeStyle="#fff";ctx.lineWidth=1;ctx.globalAlpha=(1-prog)*0.4;
        ctx.beginPath();ctx.arc(im.x,im.y,(baseR+prog*growR)*1.2,0,Math.PI*2);ctx.stroke();
      }
      // 불멸: 골드 반짝이
      if(im.grade==="불멸"){
        ctx.fillStyle="#ffd700";ctx.globalAlpha=(1-prog)*0.8;
        for(let i=0;i<6;i++){const ang=im.t*20+i*(Math.PI/3);ctx.beginPath();ctx.arc(im.x+Math.cos(ang)*growR*0.6*prog,im.y+Math.sin(ang)*growR*0.6*prog,2,0,Math.PI*2);ctx.fill();}
      }
      ctx.restore();
    }
  }catch(err){console.error("draw error:",err);}
  },[selHero]);
  const drawPending=useRef(false);
  const safeDraw=useCallback(()=>{
    if(drawPending.current)return;
    drawPending.current=true;
    requestAnimationFrame(()=>{drawPending.current=false;draw();});
  },[draw]);

  const gameLoop=useCallback((t)=>{
    const raw=Math.min((t-lt.current)/1000,0.1);
    const dt=raw*spR.current;lt.current=t;
    const g=G.current;
    if(!g||g.over){draw();return;}
    if(!g.running){
      // 카운트다운 중이면 draw만 하고 루프 유지
      if(countdownValRef.current>0||countdownRef.current){
        draw();raf.current=requestAnimationFrame((t2)=>gameLoopRef.current(t2));return;
      }
      // 카운트다운 끝났는데 running=false면 강제 재개
      if(!g.cleared){
        g.running=true;
      } else {
        // cleared인데 카운트다운도 없으면 다음 라운드 강제 시작
        g.cleared=false;
        const nb2=g.round%10===0,nm2=g.round%5===0&&g.round%10!==0;
        g.maxSpawn=nb2?1:nm2?1:g.rotMode?20:15+g.round;
        g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
        g.running=true;
      }
    }
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
        if(e.stunTimer<=0){e.stunTimer=0;if(e.baseSpeed){e.speed=e.isRaging?e.baseSpd*1.7:e.baseSpeed;e.baseSpeed=null;}}
      }
      // 속박 타이머
      if(e.rootTimer>0){
        e.rootTimer-=dt;
        if(e.rootTimer<=0){e.rootTimer=0;e.rootImmune=3;if(e.baseSpeed){e.speed=e.isRaging?e.baseSpd*1.7:e.baseSpeed;e.baseSpeed=null;}}
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
      // 스턴/속박 중이면 이동 스킵
      if((e.stunTimer||0)>0||(e.rootTimer||0)>0)continue;
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
    const newTotal=g.enemies.length;
    g.total=newTotal;
    if(g.total>=30){g.over=true;g.running=false;sync();safeDraw();return;}
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
          // 스턴 - 완전 정지 + 데미지 없음 (보스/중간보스 면역, 스턴 중 갱신 안됨)
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            if(!t2.isBoss&&!t2.isMid&&!(t2.stunTimer>0)){
              if(!t2.baseSpeed)t2.baseSpeed=t2.speed;
              t2.speed=0;t2.stunTimer=(trait.stunDur||0.8)*(buff.statusMul||1);
            }
          }

        } else if(trait.type==="debuff"){
          // 방어감소 디버프
          if(t2){
            applyDmg(t2,p.dmg,goldPerKill,g);
            t2.debuff=true;t2.debuffMul=(trait.debuffMul||1.3);t2.debuffTimer=(trait.debuffDur||5)*(buff.statusMul||1);
          }

        } else if(trait.type==="armorBreak"){
          // 방어무시 - armor 임시 0으로 처리
          if(t2&&p.dmg>0){
            const origArmor=t2.armor||0;
            t2.armor=0;
            applyDmg(t2,p.dmg,goldPerKill,g);
            t2.armor=origArmor;
          }

        } else if(trait.type==="rockSplash"){
          // 바위파편 - 주 타겟 + 주변 최대 3마리 60%
          if(t2&&p.dmg>0)applyDmg(t2,p.dmg,goldPerKill,g);
          const nearby=g.enemies
            .filter(e=>!e.remove&&e.hp>0&&e.id!==p.tid)
            .sort((a,b)=>Math.sqrt((a.x-p.tx)**2+(a.y-p.ty)**2)-Math.sqrt((b.x-p.tx)**2+(b.y-p.ty)**2))
            .slice(0,trait.splashCnt||3);
          for(const nb of nearby){
            const frag=Math.floor(p.dmg*(trait.splashMul||0.6));
            if(frag>0){applyDmg(nb,frag,goldPerKill,g);g.impacts.push({x:nb.x+CS/2,y:nb.y+CS/2,t:0,maxT:0.2,color:"#a73",elBase:"땅",grade:p.grade});}
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

    // 보스/중간보스 강제 스폰 안전장치: 적이 없는데 스폰이 안 된 경우
    if(isBossRound&&!g.bossSpawned&&g.enemies.length===0&&g.spawnC>=g.maxSpawn){
      // maxSpawn이 1인데 이미 spawnC>=1이면 보스 스폰 기회를 놓친 것 → 강제 스폰
      const bossInfo=makeBoss(g.round);g.currentBoss=bossInfo;
      const boss=mkE("일반",g.round,true,false,g.rotMode?'ROT':g.mapKey,{});
      boss.isRageReady=true;boss.bossInfo=bossInfo;
      g.enemies.push(boss);g.bossSpawned=true;
    }
    if(isMidRound&&!g.midSpawned&&g.enemies.length===0&&g.spawnC>=g.maxSpawn){
      g.enemies.push(mkE("일반",g.round,false,true,g.rotMode?'ROT':g.mapKey,{}));g.midSpawned=true;
    }
    const spawnDone=(isBossRound&&g.bossSpawned)||(isMidRound&&g.midSpawned)||(!isBossRound&&!isMidRound&&g.spawnC>=g.maxSpawn);
    if(newTotal!==ui.total)sync();
    // 회전 모드: 적 다 잡아도 타이머 끝날 때까지 대기
    // ── 멀티: 본인 적 전부 처치 감지 → 스킵 버튼 활성화
    if(g.multiRoomId&&spawnDone&&g.enemies.length===0&&!g.cleared&&!multiEnemiesClear){
      setMultiEnemiesClear(true);
      (async()=>{
        try{
          await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${g.multiRoomId}&nickname=eq.${encodeURIComponent(g.multiNickname)}`,{
            method:'PATCH',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
            body:JSON.stringify({enemies_clear:true,last_update:new Date().toISOString()}),
          });
        }catch(e){}
      })();
    }
    const canClear=spawnDone&&g.enemies.length===0&&!g.cleared&&(!g.rotMode||countdownValRef.current===0)&&!g.multiRoomId;
    if(canClear){
      g.running=false;g.cleared=true;
      if(isMidRound||isBossRound)g.coins+=1;
      const goldMul=1+(getBuff().goldMul||0);
      const baseGold=g.difficulty==='hard'?20:30;
      const clearGold=Math.floor((isBossRound?80:isMidRound?50:baseGold)*goldMul);
      g.gold+=clearGold;
      if(g.round===10||g.round%20===0){const nu=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){nu.col=pos[0];nu.row=pos[1];}g.heroes.push(nu);if(g.round===10)pushToast("⏳ 무속성 유닛 획득! (10라운드 보너스)","#c084fc");}
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
        sync();safeDraw();pushToast(`🎰 ${diceMsg}`,"#a78bfa");
      }
      const targetRound=g.difficulty==='easy'?50:g.difficulty==='normal'?70:100;
      if(g.round===targetRound&&!g.infiniteMode){
        // 무한모드 여부 물어보기 (victory 대신 특별 처리)
        g.victory=true;g.running=false;sync();safeDraw();return;
      }
      if(g.round>targetRound){
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
  useEffect(()=>{safeDrawRef.current=safeDraw;},[safeDraw]);
  // 닉네임 변경 시 해당 닉네임 clearCount 로드
  useEffect(()=>{
    if(!nickname||isAdminMode)return;
    try{setClearCount(parseInt(localStorage.getItem("cc_"+nickname)||"0"));}catch{}
  },[nickname,isAdminMode]);
  useEffect(()=>{if(phase==='game')draw();},[draw,phase]);
  useEffect(()=>{if(phase==='game')draw();},[selHero,drag]);

  // 카운트다운 스킵
  const skipCountdown=async()=>{
    if(countdownRef.current){clearInterval(countdownRef.current);countdownRef.current=null;}
    setCountdown(0);countdownValRef.current=0;
    if(!G.current.over) autoStart(G.current);
    // 멀티 방장: 게스트에게 카운트다운 스킵 신호 전송
    const g=G.current;
    if(g?.multiRoomId&&isHostRef.current){
      try{
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${g.multiRoomId}`,{
          method:'PATCH',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({skip_countdown:true}),
        });
        // 1.5초 후 플래그 리셋 (게스트가 감지할 시간 확보)
        setTimeout(async()=>{
          try{
            await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${g.multiRoomId}`,{
              method:'PATCH',
              headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
              body:JSON.stringify({skip_countdown:false}),
            });
          }catch(e){}
        },2000);
      }catch(e){}
    }
  };

  // 다음 라운드 실제 처리 (싱글/멀티 공용)
  const doNextRound=(g)=>{
    const isBossRound=g.round%10===0,isMidRound=g.round%5===0&&g.round%10!==0;
    const goldMul=1+(getBuff().goldMul||0);
    const baseGold=g.difficulty==='hard'?20:30;
    g.gold+=Math.floor((isBossRound?80:isMidRound?50:baseGold)*goldMul);
    if(isBossRound||isMidRound)g.coins+=1;
    g.round++;
    g.cleared=false;
    g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
    const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
    const newWt=getWaveType(g.round);
    g.waveType=newWt;
    const waveLabels={normal:'',horde:'🐝 무리 웨이브!',fast:'⚡ 속도 웨이브!',armored:'🛡️ 장갑 웨이브!',healer:'💚 힐러 웨이브!',boss:'💀 보스!',mid:'⚡ 중간보스!'};
    g.waveLabel=waveLabels[newWt]||'';
    g.maxSpawn=nb?1:nm?1:newWt==='horde'?Math.floor((15+g.round)*1.8):g.rotMode?20:15+g.round;
    // 못 잡은 적 수 유지 (멀티: 이전 적 제거 안 함)
    g.total=g.enemies.filter(e=>!e.remove&&e.hp>0).length;
    g.running=true;
    if(!raf.current){lt.current=performance.now();raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));}
    sync();
  };

  // 라운드 강제 스킵
  const skipRound=async()=>{
    const g=G.current;
    if(!g||!g.running||g.over||g.cleared||g.victory)return;

    // ── 멀티: 스킵 누르면 전원 강제 다음 라운드
    if(g.multiRoomId){
      const nick=g.multiNickname;
      try{
        // rooms.round 를 +1 → 다른 플레이어 폴링이 감지해서 강제 진입
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${g.multiRoomId}`,{
          method:'PATCH',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({round:g.round+1}),
        });
        // 전원 skipped/enemies_clear 리셋
        await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${g.multiRoomId}`,{
          method:'PATCH',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({skipped:false,enemies_clear:false}),
        });
      }catch(e){}
      // 본인도 바로 다음 라운드 (폴링 중복 방지를 위해 round 미리 올림)
      doNextRound(g);
      setMultiEnemiesClear(false);
      return;
    }

    // ── 싱글: 기존과 동일
    doNextRound(g);
  };

  const autoStart=(g)=>{
    const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
    const wt=getWaveType(g.round);g.waveType=wt;
    g.maxSpawn=nb?1:nm?1:wt==='horde'?Math.floor((15+g.round)*1.8):g.rotMode?20:15+g.round;
    g.running=true;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
    sync();
    // 중복 루프 방지
    if(raf.current)cancelAnimationFrame(raf.current);
    lt.current=performance.now();raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
  };

  // 게임 시작: 맵 결정 → 히든영웅 화면
  const startGame=(mapOverride)=>{
    if(!nickname.trim()){setShowNicknamePrompt(true);return;}
    if(raf.current)cancelAnimationFrame(raf.current);
    resetIds();
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
    savedThisGameRef.current=false;
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setTransformPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    sync();
    setPhase('diff');
  };

  const startRotation=()=>{
    if(!nickname.trim()){setShowNicknamePrompt(true);return;}
    if(raf.current)cancelAnimationFrame(raf.current);
    resetIds();
    applyRotationMap();
    setCurrentMapName('회전');
    const g=initGame('hard');
    g.mapKey='ROT';
    g.clearCount=clearCount;
    g.unlockedEls=UNLOCK_ELEMENTS(clearCount);
    g.unlockedGrades=UNLOCK_GRADES(clearCount);
    g.diffMul=1.0;
    g.rotMode=true;
    savedThisGameRef.current=false;
    G.current=g;
    setRotMode(true);
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setTransformPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    sync();
    setPhase('hidden');
  };

  const pickHidden=async(h)=>{
    const g=G.current;
    g.hiddenHero={...h,id:h.id};
    // 난이도: 멀티 게스트면 g에 이미 설정된 값 유지, 아니면 로컬 state
    const finalDiff=g.difficulty||difficulty;
    g.difficulty=finalDiff;
    g.diffMul=finalDiff==='easy'?2.2:finalDiff==='normal'?1.5:1.3;
    // 수호자: 시작 라이프 추가
    if(h.buff&&h.buff.extraLife){g.life+=h.buff.extraLife;sync();}
    // 멀티: 방장이 히든영웅 선택 시 rooms에 저장 → 게스트 자동 적용
    if(g.multiRoomId&&isHostRef.current){
      try{
        await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${g.multiRoomId}`,{
          method:'PATCH',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({hidden_hero:h.id}),
        });
      }catch(e){}
    }
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
      setDragBoth(null);setSelHero(null);sync();safeDraw();
    }else{
      const clicked=g.heroes.find(h=>h.col===col&&h.row===row);
      if(clicked){setSelHero(clicked.id===selHero?null:clicked.id);setDragBoth(null);}
      else setSelHero(null);
    }
  };

  const onHero=(hero)=>{
    if(dragR.current&&dragR.current!==hero.id){
      const g=G.current,a=g.heroes.find(h=>h.id===dragR.current),b=hero;
      if(a&&b.col!==null){const tmp={col:a.col,row:a.row};a.col=b.col;a.row=b.row;b.col=tmp.col;b.row=tmp.row;sync();safeDraw();}
      setDragBoth(null);return;
    }
    if(dragR.current===hero.id){setDragBoth(null);return;}
    setSelHero(hero.id===selHero?null:hero.id);setDragBoth(null);
  };

  const getCombOptions=(heroId)=>{
    const g=G.current;
    const unlockedG=g.unlockedGrades||UNLOCK_GRADES(clearCount);
    return comboGetCombOptions({heroes:g.heroes,round:g.round,unlockedGrades:unlockedG,heroId});
  };

  const doCombine=(heroId,opt)=>{
    const g=G.current;
    const unlockedG=g.unlockedGrades||UNLOCK_GRADES(clearCount);
    const res=comboDoCombine({heroes:g.heroes,heroId,opt,unlockedGrades:unlockedG,gradeEnhLv:g.gradeEnhLv||{}});
    if(res.silent)return;
    if(res.error){pushToast(res.error,res.color);setSelHero(null);return;}
    g.heroes=res.newHeroes;
    if(res.result.via==="recipe"){
      setModal(null);sync();safeDraw();triggerSummon(res.result.r,res.result.g);notifyResult("⚗️ 조합",res.result.r,res.result.g);
      setSelHero(null);
    }else{
      setSelHero(null);setHeroListTab("waiting");sync();safeDraw();triggerSummon(res.result.r,res.result.g);notifyResult("⚗️ 조합",res.result.r,res.result.g);
    }
  };

  const GRADE_ENH_COST={노말:10,고급:15,영웅:25,전설:30,신화:40,불멸:50};
  const GRADE_ENH_BONUS={노말:{atk:2,spd:0.05},고급:{atk:4,spd:0.05},영웅:{atk:8,spd:0.05},전설:{atk:14,spd:0.05},신화:{atk:20,spd:0.05},불멸:{atk:32,spd:0.05}};
  const getGradeEnhLv=(grade)=>(G.current?.gradeEnhLv||{})[grade]||0;

  const MAX_GRADE_ENH=20;
  const doGradeEnhance=(grade)=>{
    const g=G.current;if(!g.gradeEnhLv)g.gradeEnhLv={};
    const lv=g.gradeEnhLv[grade]||0;
    if(lv>=MAX_GRADE_ENH){pushToast(`최대 등급강화(${MAX_GRADE_ENH}강) 도달`,"#f59e0b");return;}
    const cost=GRADE_ENH_COST[grade]*(lv+1);
    if(g.gold<cost){pushToast(`골드 부족! (${cost}G 필요)`,"#ef4444");return;}
    g.gold-=cost;g.gradeEnhLv[grade]=(lv+1);
    const bonus=GRADE_ENH_BONUS[grade];
    for(const h of g.heroes){if(h.grade===grade){h.atk+=bonus.atk;h.spd=Math.min((h.spd||1)+bonus.spd,3.0);}}
    sync();safeDraw();pushToast(`✅ ${grade} 강화 완료! ATK+${bonus.atk} SPD+${(bonus.spd*100).toFixed(0)}% (Lv.${lv+1})`,"#4ade80");
  };

  const ENHANCE_GRADES=["전설","신화","불멸"]; // 강화 가능 등급
  const maxEnh=(h)=>h.element==="황금정령"?20:10; // 황금정령만 20강
  const enhCost=(h)=>10*(h.enhLv+1);
  const canEnhance=(h)=>ENHANCE_GRADES.includes(h.grade)&&(h.enhLv||0)<maxEnh(h);
  const doEnhance=(heroId)=>{
    const g=G.current;
    if(!g||g.over)return;
    const h=g.heroes.find(x=>x.id===heroId);
    if(!h)return;
    if(!ENHANCE_GRADES.includes(h.grade)){pushToast("전설 이상 유닛만 강화 가능합니다","#ef4444");return;}
    if((h.enhLv||0)>=maxEnh(h)){pushToast(`최대 강화(${maxEnh(h)}강) 도달`,"#f59e0b");return;}
    const cost=enhCost(h);
    if(g.gold<cost){pushToast(`골드 부족! (${cost}G 필요)`,"#ef4444");return;}
    g.gold-=cost;h.enhLv=(h.enhLv||0)+1;h.atk+=5;h.spd=Math.min((h.spd||1)+0.02,2.5);
    sync();safeDraw();
  };

  const doSell=(heroId)=>{
    const g=G.current;
    if(!g||g.over)return;
    const h=g.heroes.find(x=>x.id===heroId);
    if(!h)return;
    g.gold+=SELL_PRICE[h.grade]||5;
    g.heroes=g.heroes.filter(x=>x.id!==heroId);
    setSelHero(null);sync();safeDraw();
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
    setModal(null);sync();safeDraw();
  };

  const popStack=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const newStacks={...g.stacks};newStacks[el]-=1;if(newStacks[el]===0)delete newStacks[el];
    g.stacks=newStacks;
    const h=mkH(el,"노말",g.gradeEnhLv||{});
    // 보관함에서 꺼내기 → 대기중
    g.heroes=[...g.heroes,h];sync();safeDraw();
  };

  const popStackAll=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<=0)return;
    const cnt=g.stacks[el];const newStacks={...g.stacks};delete newStacks[el];g.stacks=newStacks;
    const newHeroes=[...g.heroes];
    for(let i=0;i<cnt;i++){const h=mkH(el,"노말",g.gradeEnhLv||{});newHeroes.push(h);}
    g.heroes=newHeroes;sync();safeDraw();
  };

  const canRecipe=(recipe)=>{
    const g=G.current;if(!g)return false;
    return comboCanRecipe({heroes:g.heroes,recipe});
  };

  const doRecipe=(recipe)=>{
    const g=G.current;
    const unlockedG=g.unlockedGrades||UNLOCK_GRADES(clearCount);
    const res=comboDoRecipe({heroes:g.heroes,recipe,unlockedGrades:unlockedG,gradeEnhLv:g.gradeEnhLv||{}});
    if(res.error){pushToast(res.error,res.color);return;}
    // 조합 결과는 대기중으로
    g.heroes=res.newHeroes;setModal(null);sync();safeDraw();triggerSummon(res.result.r,res.result.g);notifyResult("⚗️ 조합",res.result.r,res.result.g);
  };

  const stackCombine=(el)=>{
    const g=G.current;if(!g.stacks||!g.stacks[el]||g.stacks[el]<2){pushToast("보관함에 2개 이상 필요합니다","#ef4444");return;}
    const newStacks={...g.stacks};newStacks[el]-=2;if(newStacks[el]===0)delete newStacks[el];g.stacks=newStacks;
    const recipes=COMBO.filter(r=>r.a===el&&r.b===el);
    let nh;
    if(recipes.length>0){const r=recipes[Math.floor(Math.random()*recipes.length)];nh=mkH(r.r,r.g,g.gradeEnhLv||{});}
    else{nh=mkH(el,"고급",g.gradeEnhLv||{});}
    const pos=autoPlace(g.heroes);if(pos){nh.col=pos[0];nh.row=pos[1];}
    g.heroes=[...g.heroes,nh];sync();safeDraw();
  };

  const toggleRandomPick=(heroId)=>{
    const g=G.current;
    setRandomPicks(prev=>{
      let next;
      if(prev.includes(heroId)){
        next=prev.filter(x=>x!==heroId);
      }else if(prev.length>=3){
        next=prev;
      }else{
        // 같은 등급만 선택 가능
        if(prev.length>0){
          const firstHero=g.heroes.find(h=>h.id===prev[0]);
          const thisHero=g.heroes.find(h=>h.id===heroId);
          if(firstHero&&thisHero&&firstHero.grade!==thisHero.grade){
            pushToast(`같은 등급끼리만 선택 가능합니다 (${firstHero.grade})`,"#ef4444");
            return prev;
          }
        }
        next=[...prev,heroId];
      }
      randomPicksRef.current=next;return next;
    });
  };

  // 등급별 결과 풀 (이름만 추출, 중복 제거) - 연금술은 전설까지만
  const getPoolByGrade=(grade)=>{
    const alchemyGrades=["고급","영웅","전설"];
    if(!alchemyGrades.includes(grade))return[];
    const fromCombo=COMBO.filter(r=>r.g===grade).map(r=>r.r);
    const fromRecipes=RECIPES.filter(r=>r.g===grade).map(r=>r.r);
    return [...new Set([...fromCombo,...fromRecipes])];
  };

  const doRandomMerge=()=>{
    const g=G.current;const picks=randomPicksRef.current;
    if(picks.length!==3){pushToast("3개를 선택해주세요","#ef4444");return;}
    const targets=picks.map(id=>g.heroes.find(h=>h.id===id)).filter(Boolean);
    if(targets.length!==3){pushToast("선택한 유닛을 찾을 수 없습니다","#ef4444");return;}
    const grades=targets.map(t=>t.grade);
    if(new Set(grades).size>1){pushToast("같은 등급끼리만 조합 가능합니다","#ef4444");return;}
    const fromGrade=grades[0];
    const nextGrade=NEXT_GRADE[fromGrade];
    if(!nextGrade){pushToast("더 이상 조합할 수 없는 최고 등급입니다","#f59e0b");return;}
    const unlockedG=g.unlockedGrades||UNLOCK_GRADES(clearCount);
    if(!unlockedG.includes(nextGrade)){pushToast(`${nextGrade} 등급은 아직 개방되지 않았습니다`,"#ef4444");return;}
    const pool=getPoolByGrade(nextGrade);
    const result=pool.length?{r:pool[Math.floor(Math.random()*pool.length)],g:nextGrade}:null;
    if(!result){pushToast("조합 가능한 결과가 없습니다","#ef4444");return;}
    // 배치된 유닛 위치 우선 사용, 없으면 자동배치
    const placedTarget=targets.find(t=>t.col!==null);
    const nh=mkH(result.r,result.g,g.gradeEnhLv||{});
    const remaining=g.heroes.filter(x=>!picks.includes(x.id));
    if(placedTarget){nh.col=placedTarget.col;nh.row=placedTarget.row;}
    else{const pos=autoPlace(remaining);if(pos){nh.col=pos[0];nh.row=pos[1];}}
    g.heroes=[...remaining,nh];
    randomPicksRef.current=[];setRandomPicks([]);setModal(null);setSelHero(null);sync();safeDraw();
    triggerSummon(result.r,result.g);notifyResult("🎲 조합",result.r,result.g);
  };

  const toggleTransformPick=(heroId)=>{
    const g=G.current;
    setTransformPicks(prev=>{
      let next;
      if(prev.includes(heroId)){
        next=prev.filter(x=>x!==heroId);
      }else if(prev.length>=2){
        next=prev;
      }else{
        if(prev.length>0){
          const firstHero=g.heroes.find(h=>h.id===prev[0]);
          const thisHero=g.heroes.find(h=>h.id===heroId);
          if(firstHero&&thisHero&&firstHero.grade!==thisHero.grade){
            pushToast(`같은 등급끼리만 선택 가능합니다 (${firstHero.grade})`,"#ef4444");
            return prev;
          }
        }
        next=[...prev,heroId];
      }
      transformPicksRef.current=next;return next;
    });
  };

  // 변환: 같은 등급 2개 선택 → 같은 등급 내 무작위 다른 유닛 1개로 변환
  const doTransform=()=>{
    const g=G.current;const picks=transformPicksRef.current;
    if(picks.length!==2){pushToast("2개를 선택해주세요","#ef4444");return;}
    const targets=picks.map(id=>g.heroes.find(h=>h.id===id)).filter(Boolean);
    if(targets.length!==2){pushToast("선택한 유닛을 찾을 수 없습니다","#ef4444");return;}
    const grades=targets.map(t=>t.grade);
    if(grades[0]!==grades[1]){pushToast("같은 등급끼리만 변환 가능합니다","#ef4444");return;}
    const grade=grades[0];
    const fullPool=getPoolByGrade(grade);
    // 가능하면 보유한 2개와 다른 유닛으로, 풀이 부족하면 전체 풀에서
    const diffPool=fullPool.filter(name=>!targets.some(t=>t.element===name));
    const finalPool=diffPool.length?diffPool:fullPool;
    const result=finalPool[Math.floor(Math.random()*finalPool.length)];
    const placedTarget=targets.find(t=>t.col!==null);
    const nh=mkH(result,grade,g.gradeEnhLv||{});
    const remaining=g.heroes.filter(x=>!picks.includes(x.id));
    if(placedTarget){nh.col=placedTarget.col;nh.row=placedTarget.row;}
    else{const pos=autoPlace(remaining);if(pos){nh.col=pos[0];nh.row=pos[1];}}
    g.heroes=[...remaining,nh];
    transformPicksRef.current=[];setTransformPicks([]);setModal(null);setSelHero(null);sync();safeDraw();
    triggerSummon(result,grade);notifyResult("🔄 변환",result,grade);
  };

  const buyWithCoin=(item)=>{
    const g=G.current;if(g.coins<item.cost){pushToast(`🪙 코인 부족! (${item.cost}개 필요)`,"#ef4444");return;}
    const unlockedG=g.unlockedGrades||UNLOCK_GRADES(clearCount);
    if(item.grade&&!unlockedG.includes(item.grade)){pushToast(`${item.grade} 등급은 아직 개방되지 않았습니다`,"#ef4444");return;}
    if(item.element){g.coins-=item.cost;const h=mkH(item.element,item.grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes.push(h);setModal(null);sync();safeDraw();triggerSummon(item.element,item.grade);return;}
    setModal({type:"coinPick",item});
  };
  const buyCoinByElement=(item,el)=>{
    const g=G.current;if(g.coins<item.cost){pushToast("🪙 코인 부족!","#ef4444");return;}
    g.coins-=item.cost;const h=mkH(el,item.grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
    g.heroes.push(h);setModal(null);sync();safeDraw();triggerSummon(el,item.grade);
  };

  // ── 랭킹 저장
  const saveRecord=async(isVictory)=>{
    if(savedThisGameRef.current)return; // 같은 게임에서 중복 저장 방지
    savedThisGameRef.current=true;
    // 멀티: 게임 종료 시 방 정리
    const mg=G.current;
    if(mg?.multiRoomId){
      const rid=mg.multiRoomId;
      const mnick=mg.multiNickname;
      stopMultiSkipPoll();
      stopMultiPoll();
      try{
        await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${rid}&nickname=eq.${encodeURIComponent(mnick)}`,{
          method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        // 방장이면 방 삭제
        if(isHostRef.current){
          await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${rid}`,{
            method:'DELETE',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
          });
        }
      }catch(e){}
      isHostRef.current=false;
    }
    let newClearCount=clearCount;
    if(isVictory){
      newClearCount=isAdminMode?clearCount:clearCount+1;
      setClearCount(newClearCount);
      if(!isAdminMode)saveClearCount(nickname,newClearCount);
    }
    const finalName=nickname.trim();
    const g=G.current;
    if(isAdminMode)return; // 관리자 랭킹 저장 제외
    const record={
      name:finalName,
      difficulty:g.difficulty||'hard',
      round:g.round,
      gold:g.gold,
      coins:g.coins,
      map:currentMapName,
      victory:isVictory,
      clear_count:newClearCount,
      updated_at:new Date().toISOString(),
    };
    try{
      // 기존 기록 조회 (같은 닉네임)
      const getRes=await fetch(`${SUPABASE_URL}/rest/v1/rankings?name=eq.${encodeURIComponent(finalName)}&select=round,gold,coins`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const existing=await getRes.json();
      const mine=existing&&existing[0];
      const isBetter=!mine
        ||(record.round>mine.round)
        ||(record.round===mine.round&&record.gold>mine.gold)
        ||(record.round===mine.round&&record.gold===mine.gold&&record.coins>mine.coins);
      
      if(!isBetter){
        // 기록은 안 갱신해도 클리어 수는 항상 최신으로 업데이트
        if(isVictory&&mine){
          await fetch(`${SUPABASE_URL}/rest/v1/rankings?name=eq.${encodeURIComponent(finalName)}`,{
            method:'PATCH',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
            body:JSON.stringify({clear_count:newClearCount,updated_at:new Date().toISOString()}),
          });
        }
        return;
      }
      // upsert: 같은 이름 있으면 갱신, 없으면 삽입
      await fetch(`${SUPABASE_URL}/rest/v1/rankings?on_conflict=name`,{
        method:'POST',
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:`Bearer ${SUPABASE_KEY}`,
          'Content-Type':'application/json',
          Prefer:'resolution=merge-duplicates',
        },
        body:JSON.stringify(record),
      });
      // 멀티 게임이면 multi_rankings에도 저장 (INSERT, 갱신 아님 - 판별 기록 누적)
      if(g.multiRoomId){
        await fetch(`${SUPABASE_URL}/rest/v1/multi_rankings`,{
          method:'POST',
          headers:{
            apikey:SUPABASE_KEY,
            Authorization:`Bearer ${SUPABASE_KEY}`,
            'Content-Type':'application/json',
            Prefer:'return=minimal',
          },
          body:JSON.stringify({...record,room_id:g.multiRoomId}),
        });
      }
    }catch(e){console.error('ranking save error',e);}
  };

  const changeSpeed=(s)=>{spR.current=s;setSpeedState(s);};

  // ══════════════════════════════════════════
  // 멀티플레이 함수
  // ══════════════════════════════════════════
  const genRoomId=()=>Math.random().toString(36).slice(2,8).toUpperCase();

  const stopMultiPoll=()=>{
    if(multiPollRef.current){clearInterval(multiPollRef.current);multiPollRef.current=null;}
  };
  const stopMultiSkipPoll=()=>{
    if(multiSkipPollRef.current){clearInterval(multiSkipPollRef.current);multiSkipPollRef.current=null;}
    if(multiSyncRef.current){clearInterval(multiSyncRef.current);multiSyncRef.current=null;}
  };

  // 멀티: 내 상태 서버 동기화 (적 수 포함)
  const syncMultiState=async()=>{
    const g=G.current;
    if(!g||!g.multiRoomId||!g.multiNickname)return;
    const aliveEnemies=g.enemies?g.enemies.filter(e=>!e.remove&&e.hp>0).length:0;
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${g.multiRoomId}&nickname=eq.${encodeURIComponent(g.multiNickname)}`,{
        method:'PATCH',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({
          life:g.life,gold:g.gold,coins:g.coins,round:g.round,
          enemies_clear:aliveEnemies===0&&g.spawnC>=g.maxSpawn,
          is_alive:!g.over,
          enemy_count:aliveEnemies,
          last_update:new Date().toISOString(),
        }),
      });
    }catch(e){}
  };

  // 멀티: 스킵 폴링: rooms.round 변경 감지 → 강제 다음 라운드
  const startMultiSkipPoll=(roomId)=>{
    stopMultiSkipPoll();
    let lastSeenRound=-1;
    multiSkipPollRef.current=setInterval(async()=>{
      const g=G.current;
      if(!g||g.over)return;
      try{
        const res=await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}&select=round,hidden_hero,skip_countdown`,{
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        const data=await res.json();
        if(!data||!data[0])return;
        // 현황판 갱신
        const pRes=await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${roomId}&order=nickname.asc`,{
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        const pData=await pRes.json();
        if(Array.isArray(pData))setRoomPlayers(pData);
        const serverRound=data[0].round;
        // 게스트: hidden_hero 감지 → 자동 픽
        if(!isHostRef.current&&data[0].hidden_hero&&!g.hiddenHero){
          const heroData=HH.find(h=>h.id===data[0].hidden_hero);
          if(heroData)pickHidden(heroData);
          return;
        }
        // 게스트: 방장이 카운트다운 스킵 → 게스트도 즉시 스킵
        if(!isHostRef.current&&data[0].skip_countdown&&countdownValRef.current>0){
          if(countdownRef.current){clearInterval(countdownRef.current);countdownRef.current=null;}
          setCountdown(0);countdownValRef.current=0;
          if(!g.over)autoStart(g);
          // 플래그 리셋 (게스트가 처리 완료 후 서버 플래그 지울 필요 없음 - 방장이 다음에 지움)
          return;
        }
        // 이미 처리한 라운드는 무시 (중복 방지)
        if(serverRound===lastSeenRound)return;
        if(serverRound>g.round){
          lastSeenRound=serverRound;
          doNextRound(g);
          setMultiEnemiesClear(false);
        }
      }catch(e){}
    },1500);
  };

  // 공개방 목록 불러오기
  const loadPublicRooms=async()=>{
    setPublicRoomsLoading(true);
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/rooms?status=eq.waiting&host=not.is.null&order=created_at.desc&limit=20&created_at=gte.${new Date(Date.now()-30*60*1000).toISOString()}`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const data=await res.json();
      if(Array.isArray(data)){
        // 각 방 인원 수 가져오기
        const withCount=await Promise.all(data.map(async(room)=>{
          try{
            const pr=await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${room.id}&select=nickname`,{
              headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
            });
            const players=await pr.json();
            return{...room,playerCount:Array.isArray(players)?players.length:0};
          }catch{return{...room,playerCount:0};}
        }));
        // is_private 없으면 id가 순수 랜덤(6자)인 것만 공개방으로 표시
        // id가 6자 랜덤이면 공개방 (비공개방은 사용자 지정이라 보통 다름)
        setPublicRooms(withCount);
      }
    }catch(e){}
    setPublicRoomsLoading(false);
  };

  // 방 생성 (호스트) - isPrivate: 비공개(코드지정) / 공개
  const createRoom=async(isPrivate,code)=>{
    const nick=nickname.trim();
    if(!nick){alert('닉네임을 먼저 입력해주세요');return;}
    // 비공개: 코드 직접 지정, 공개: 랜덤 생성
    let roomId;
    if(isPrivate){
      if(!code||code.length<4){pushToast('방 코드를 4자 이상 입력해주세요','#ef4444');return;}
      roomId=code.toUpperCase();
    }else{
      roomId=genRoomId();
    }
    try{
      // 중복 방 코드 체크
      const check=await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const existing=await check.json();
      if(existing&&existing[0]){pushToast('이미 사용 중인 방 코드입니다','#ef4444');return;}

      await fetch(`${SUPABASE_URL}/rest/v1/rooms`,{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify({id:roomId,host:nick,round:1,status:'waiting',difficulty,created_at:new Date().toISOString()}),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/room_players`,{
        method:'POST',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify({room_id:roomId,nickname:nick,life:20,gold:50,coins:0,round:1,skipped:false,enemies_clear:false,is_alive:true,game_state:null,last_update:new Date().toISOString()}),
      });
      isHostRef.current=true;
      setMyRoomId(roomId);
      setMultiPhaseWithRef('waiting');
      startMultiPoll(roomId);
    }catch(e){pushToast('방 생성 실패','#ef4444');console.error(e);}
  };

  // 방 참가
  const joinRoom=async(roomId)=>{
    const nick=nickname.trim();
    if(!nick){alert('닉네임을 먼저 입력해주세요');return;}
    const rid=(roomId||'').toString().trim().toUpperCase();
    if(!rid){pushToast('방 코드를 입력해주세요','#ef4444');return;}
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${rid}&status=eq.waiting`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const rooms=await res.json();
      if(!rooms||!rooms[0]){pushToast('방을 찾을 수 없거나 이미 시작된 방입니다','#ef4444');return;}
      const pr=await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${rid}&nickname=eq.${encodeURIComponent(nick)}`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const existing=await pr.json();
      if(!existing||!existing[0]){
        await fetch(`${SUPABASE_URL}/rest/v1/room_players`,{
          method:'POST',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},
          body:JSON.stringify({room_id:rid,nickname:nick,life:20,gold:50,coins:0,round:1,skipped:false,enemies_clear:false,is_alive:true,game_state:null,last_update:new Date().toISOString()}),
        });
      }
      isHostRef.current=false;
      setMyRoomId(rid);
      setRoomInfo(rooms[0]);
      setMultiPhaseWithRef('waiting');
      startMultiPoll(rid);
    }catch(e){pushToast('방 참가 실패','#ef4444');console.error(e);}
  };

  // 방 나가기
  const leaveRoom=async()=>{
    const nick=nickname.trim();
    if(myRoomId){
      try{
        await fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${myRoomId}&nickname=eq.${encodeURIComponent(nick)}`,{
          method:'DELETE',
          headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
        });
        if(isHostRef.current){
          await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${myRoomId}`,{
            method:'DELETE',
            headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
          });
        }
      }catch(e){}
    }
    stopMultiPoll();
    stopMultiSkipPoll();
    setMyRoomId(null);
    setRoomPlayers([]);
    setRoomInfo(null);
    setMultiPhaseWithRef(null);
    isHostRef.current=false;
  };

  // 대기실 폴링 (2초마다)
  const startMultiPoll=(roomId)=>{
    stopMultiPoll();
    const poll=async()=>{
      try{
        const [rRes,pRes]=await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${roomId}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}}),
          fetch(`${SUPABASE_URL}/rest/v1/room_players?room_id=eq.${roomId}&order=nickname.asc`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}}),
        ]);
        const [roomData,playersData]=await Promise.all([rRes.json(),pRes.json()]);
        if(roomData&&roomData[0])setRoomInfo(roomData[0]);
        if(Array.isArray(playersData))setRoomPlayers(playersData);
        // 게스트: 방장 난이도/속도 실시간 반영
        if(!isHostRef.current&&roomData&&roomData[0]){
          if(roomData[0].difficulty)setDifficulty(roomData[0].difficulty);
          if(roomData[0].speed)setMultiSpeed(roomData[0].speed);
        }
        // 게스트: 호스트가 게임 시작하면 자동 진입 (대기실에서만)
        if(roomData&&roomData[0]&&roomData[0].status==='playing'&&!isHostRef.current&&multiPhaseRef.current==='waiting'){
          stopMultiPoll();
          const spd=roomData[0].speed||1;
          startMultiGame(roomData[0].difficulty||'easy',roomId,spd);
        }
      }catch(e){}
    };
    poll();
    multiPollRef.current=setInterval(poll,1500); // 1.5초로 단축
  };

  // 호스트 게임 시작
  const startMultiGameAsHost=async()=>{
    if(!myRoomId)return;
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${myRoomId}`,{
        method:'PATCH',
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({status:'playing',round:1,difficulty,speed:multiSpeed}),
      });
      stopMultiPoll();
      startMultiGame(difficulty,myRoomId,multiSpeed);
    }catch(e){pushToast('게임 시작 실패','#ef4444');}
  };

  // 멀티 게임 진입 (호스트/게스트 공용)
  const startMultiGame=(diff,roomId,spd=1)=>{
    const rid=roomId||myRoomId;
    setMultiPhaseWithRef('playing');
    applyRotationMap();
    setCurrentMapName('회전(멀티)');
    setRotMode(true);
    if(raf.current)cancelAnimationFrame(raf.current);
    resetIds();
    const g=initGame(diff);
    g.mapKey='ROT';
    g.rotMode=true;
    g.clearCount=clearCount;
    g.unlockedEls=UNLOCK_ELEMENTS(99);
    g.unlockedGrades=UNLOCK_GRADES(99);
    g.diffMul=diff==='easy'?2.2:diff==='normal'?1.5:1.3;
    g.multiRoomId=rid;
    g.multiNickname=nickname.trim();
    G.current=g;
    savedThisGameRef.current=false;
    setSelH(null);setHeroes([]);setDrag(null);setModal(null);
    setSpeedState(1);setSelHero(null);setCountdown(0);setRandomPicks([]);setTransformPicks([]);setStacks({});
    setSummonAnim(null);dragR.current=null;spR.current=1;
    setMultiEnemiesClear(false);
    sync();
    // 속도 적용
    spR.current=spd;setSpeedState(spd);
    // 스킵 폴링 시작 (hidden_hero 감지 포함)
    startMultiSkipPoll(rid);
    // 내 상태 서버 동기화 (2초마다)
    if(multiSyncRef.current)clearInterval(multiSyncRef.current);
    multiSyncRef.current=setInterval(syncMultiState,2000);
    setPhase('hidden');
  };
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
      <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",height:"100dvh",maxHeight:"100dvh",color:"#eee",overflow:"hidden",boxSizing:"border-box",position:"relative"}}>

        {/* 전체 배경 이미지 */}
        <img src="/title-bg.png" alt="" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"center center",zIndex:0,pointerEvents:"none"}}/>
        {/* 전체 어둠 오버레이 - 하단으로 갈수록 진하게 */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.3) 45%,rgba(0,0,0,0.75) 65%,rgba(0,0,0,0.88) 100%)",zIndex:1,pointerEvents:"none"}}/>

        {/* 콘텐츠 레이어 */}
        <div style={{position:"relative",zIndex:2,height:"100%",display:"flex",flexDirection:"column",alignItems:"center"}}>

          {/* 상단 정보 */}
          <div style={{width:"100%",maxWidth:440,padding:"12px 14px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexShrink:0}}>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              <button onClick={()=>setShowNicknamePrompt(true)}
                style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"5px 10px",color:nickname.trim()?"#93c5fd":"#aaa",fontSize:12,cursor:"pointer",fontWeight:nickname.trim()?"600":"normal",backdropFilter:"blur(6px)",textAlign:"left"}}>
                👤 {nickname.trim()||"닉네임 설정"}
              </button>
              <span
                onTouchStart={()=>{cheatPressTimer.current=setTimeout(()=>{setCheatInput(String(clearCount));setShowCheatModal(true);},2500);}}
                onTouchEnd={()=>{if(cheatPressTimer.current)clearTimeout(cheatPressTimer.current);}}
                onMouseDown={()=>{cheatPressTimer.current=setTimeout(()=>{setCheatInput(String(clearCount));setShowCheatModal(true);},2500);}}
                onMouseUp={()=>{if(cheatPressTimer.current)clearTimeout(cheatPressTimer.current);}}
                style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#f59e0b",fontWeight:"600",userSelect:"none",backdropFilter:"blur(6px)",display:"inline-block",cursor:"pointer"}}>
                🏆 {clearCount}클리어
              </span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(0,0,0,0.5)",borderRadius:8,padding:"5px 9px",backdropFilter:"blur(6px)"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#22c55e",flexShrink:0}}/>
              <span style={{fontSize:11,color:"#94a3b8"}}>{onlineUsers.length}명 접속중</span>
            </div>
          </div>

          {/* 접속자 태그 */}
          {onlineUsers.length>0&&(
            <div style={{width:"100%",maxWidth:440,padding:"6px 14px 0",display:"flex",flexWrap:"wrap",gap:4,flexShrink:0}}>
              {onlineUsers.slice(0,5).map(u=>(
                <span key={u.name} style={{background:"rgba(0,0,0,0.55)",border:`1px solid ${u.in_game?"#22c55e":"rgba(255,255,255,0.12)"}`,borderRadius:6,padding:"2px 7px",fontSize:10,color:containsAdminKeyword(u.name)?"#fbbf24":u.in_game?"#4ade80":"#94a3b8",backdropFilter:"blur(4px)"}}>
                  {containsAdminKeyword(u.name)?"👑 ":u.in_game?"🎮 ":""}{u.name}
                </span>
              ))}
            </div>
          )}

          {/* 스페이서 - 이미지 캐릭터 영역 */}
          <div style={{flex:1}}/>

          {/* 하단 버튼 영역 */}
          <div style={{width:"100%",maxWidth:440,padding:"0 14px 20px",flexShrink:0}}>

            {/* 맵 선택 */}
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",gap:6,marginBottom:5}}>
                {[{key:"random",label:"🎲 랜덤"},{key:"pick",label:"🗺️ 직접 선택"}].map(m=>(
                  <button key={m.key} onClick={()=>setMapMode(m.key)}
                    style={{flex:1,background:mapMode===m.key?"rgba(30,58,95,0.85)":"rgba(20,25,40,0.7)",border:`1px solid ${mapMode===m.key?"#3b82f6":"rgba(255,255,255,0.12)"}`,color:mapMode===m.key?"#93c5fd":"#94a3b8",borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,fontWeight:mapMode===m.key?"600":"normal",backdropFilter:"blur(6px)"}}>
                    {m.label}
                  </button>
                ))}
              </div>
              {mapMode==='pick'&&(
                <div style={{display:"flex",gap:5,marginBottom:4}}>
                  {[{key:"B",label:"S자",icon:"〰️"},{key:"C",label:"분기",icon:"🔀"},{key:"D",label:"나선",icon:"🌀"},{key:"E",label:"역방향",icon:"⬆️"},{key:"F",label:"X자",icon:"❌"}].map(m=>(
                    <button key={m.key} onClick={()=>setSelectedMap(m.key)}
                      style={{flex:1,background:selectedMap===m.key?"rgba(30,58,95,0.85)":"rgba(20,25,40,0.7)",border:`1px solid ${selectedMap===m.key?"#3b82f6":"rgba(255,255,255,0.12)"}`,borderRadius:8,padding:"6px 4px",textAlign:"center",cursor:"pointer",backdropFilter:"blur(6px)"}}>
                      <div style={{fontSize:13}}>{m.icon}</div>
                      <div style={{fontSize:9,color:selectedMap===m.key?"#93c5fd":"#64748b",marginTop:1}}>{m.label}</div>
                    </button>
                  ))}
                </div>
              )}
              <div style={{fontSize:10,color:"rgba(150,163,190,0.8)",textAlign:"center"}}>
                {mapMode==='random'?`🎲 랜덤맵`:`🗺️ ${MAP_DEFS[selectedMap]?.name} 선택됨`}
              </div>
            </div>

            {/* 메인 버튼 */}
            <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:7}}>
              <button onClick={()=>startGame(null)}
                style={{width:"100%",background:"linear-gradient(135deg,rgba(29,78,216,0.92),rgba(37,99,235,0.92))",border:"1px solid rgba(59,130,246,0.8)",color:"#fff",borderRadius:12,padding:"13px 0",cursor:"pointer",fontSize:16,fontWeight:"700",backdropFilter:"blur(6px)",boxShadow:"0 4px 20px rgba(29,78,216,0.5)"}}>
                ⚔️ 게임 시작
              </button>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>startRotation()}
                  style={{flex:1,background:"rgba(20,25,40,0.75)",border:"1px solid rgba(255,255,255,0.15)",color:"#cbd5e1",borderRadius:10,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:"600",backdropFilter:"blur(6px)"}}>
                  🔄 회전 모드
                </button>
                <button onClick={()=>{setMultiPhaseWithRef('lobby');loadPublicRooms();}}
                  style={{flex:1,background:"rgba(13,45,26,0.85)",border:"1px solid rgba(22,101,52,0.8)",color:"#4ade80",borderRadius:10,padding:"10px 0",cursor:"pointer",fontSize:13,fontWeight:"600",backdropFilter:"blur(6px)"}}>
                  👥 멀티플레이
                </button>
              </div>
            </div>

            {/* 유틸 버튼 */}
            <div style={{display:"flex",gap:5}}>
              {[
                {label:"🏆 랭킹",fn:()=>{setShowRanking(true);loadRanking();}},
                {label:"📖 설명",fn:()=>setShowGuide(true)},
                {label:"📔 도감",fn:()=>{setShowDex(true);setDexTab('dex');}},
                {label:"📋 패치노트",fn:()=>setShowPatch(true)},
              ].map(b=>(
                <button key={b.label} onClick={b.fn}
                  style={{flex:1,background:"rgba(20,25,40,0.75)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:11,backdropFilter:"blur(6px)"}}>
                  {b.label}
                </button>
              ))}
            </div>

            {clearCount<5&&(
              <div style={{marginTop:7,textAlign:"center",fontSize:10,color:"rgba(120,140,170,0.8)"}}>
                {clearCount<1&&"쉬움 클리어 시 전설 등급·보통 난이도 개방"}
                {clearCount>=1&&clearCount<3&&`${3-clearCount}클리어 후 신화 등급 개방`}
                {clearCount>=3&&clearCount<5&&`${5-clearCount}클리어 후 불멸·어려움 개방`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 랭킹 모달 */}
      {showRanking&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:400,maxHeight:"88vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"16px 20px 12px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:16,fontWeight:"bold"}}>🏆 랭킹</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>loadRanking(rankPeriod,rankMode)}
                  disabled={rankLoading}
                  style={{background:"#1e293b",border:"1px solid #334155",color:rankLoading?"#475569":"#94a3b8",borderRadius:7,padding:"4px 10px",cursor:rankLoading?"not-allowed":"pointer",fontSize:12}}>
                  {rankLoading?"⏳":"🔄"} 새로고침
                </button>
                <button onClick={()=>setShowRanking(false)} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
              </div>
            </div>
            {/* 싱글/멀티 탭 */}
            <div style={{display:"flex",gap:6,padding:"10px 16px 0",flexShrink:0}}>
              {[{key:'single',label:'⚔️ 싱글'},{key:'multi',label:'👥 멀티'}].map(m=>(
                <button key={m.key} onClick={()=>{setRankMode(m.key);loadRanking(rankPeriod,m.key);}}
                  style={{flex:1,background:rankMode===m.key?(m.key==='multi'?"#14532d":"#1d3a6e"):"#1e293b",border:`2px solid ${rankMode===m.key?(m.key==='multi'?"#22c55e":"#3b82f6"):"#334155"}`,color:rankMode===m.key?"#fff":"#94a3b8",borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:13,fontWeight:rankMode===m.key?"bold":"normal"}}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* 기간 탭 */}
            <div style={{display:"flex",gap:6,padding:"8px 16px 0",flexShrink:0}}>
              {[{key:'daily',label:'📅 일간'},{key:'weekly',label:'📆 주간'},{key:'all',label:'🏆 누적'}].map(p=>(
                <button key={p.key} onClick={()=>{setRankPeriod(p.key);loadRanking(p.key,rankMode);}}
                  style={{flex:1,background:rankPeriod===p.key?"#1f6feb":"#1e293b",border:`1px solid ${rankPeriod===p.key?"#3b82f6":"#334155"}`,color:rankPeriod===p.key?"#fff":"#94a3b8",borderRadius:8,padding:"6px 0",cursor:"pointer",fontSize:12,fontWeight:rankPeriod===p.key?"bold":"normal"}}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{overflowY:"auto",flex:1,padding:"12px 16px"}}>
              {rankLoading&&<div style={{textAlign:"center",color:"#555",padding:20}}>불러오는 중...</div>}
              {!rankLoading&&rankMode==='single'&&ranking.length===0&&<div style={{textAlign:"center",color:"#555",padding:20}}>아직 기록이 없어요</div>}
              {!rankLoading&&rankMode==='multi'&&multiRanking.length===0&&<div style={{textAlign:"center",color:"#555",padding:20}}>아직 멀티 기록이 없어요</div>}
              {!rankLoading&&(rankMode==='single'?ranking:multiRanking).map((r,i)=>{
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
                        {rankMode==='multi'&&<span style={{fontSize:10,color:"#4ade80",background:"#052e16",borderRadius:4,padding:"1px 5px",flexShrink:0}}>멀티</span>}
                        {r.victory&&<span style={{fontSize:10,color:"#fd0",flexShrink:0}}>👑클리어</span>}
                        {isMe&&<span style={{fontSize:10,color:"#4af",flexShrink:0}}>← 나</span>}
                      </div>
                      <div style={{display:"flex",gap:8,fontSize:11,color:"#888",flexWrap:"wrap"}}>
                        <span style={{color:diffColor}}>{diffLabel}</span>
                        <span style={{color:"#4af"}}>R{r.round}/{r.difficulty==='easy'?50:r.difficulty==='normal'?70:100}</span>
                        <span style={{color:"#fd0"}}>💰{r.gold}G</span>
                        <span style={{color:"#a78bfa"}}>🪙{r.coins}</span>
                        {rankMode==='single'&&<span style={{color:"#a78bfa",fontWeight:"bold"}}>🏆{r.clear_count||0}클리어</span>}
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
                {icon:"⚡",title:"속성/종족별 특성",color:"#fbbf24",items:[
                  "🔥 불정령 → 범위 스플래시 데미지",
                  "⚡ 번개정령 → 최대 3회 체인 공격",
                  "🌀 바람정령 → 일직선 관통 공격",
                  "☠️ 어둠정령 → 스턴",
                  "🌿 나무정령 → 속박",
                  "💧 물정령 → 방어감소",
                  "✨ 빛정령 → 방어무시 (방어력 완전 무시)",
                  "🪨 대지정령 → 느린 공격속도, 피격 시 주변 3마리 60% 파편 데미지",
                  "⏳ 시간정령 → 슬로우 (희귀/상점 전용)",
                  "종족(오크/언데드 등) → 조합 재료, 속성정령과 교차 조합 가능",
                ]},
                {icon:"👑",title:"히든영웅",color:"#f97316",items:["게임 시작 전 히든영웅 1명 선택","전체 유닛에 버프 적용 (공격력/속도/사거리 등)","상인: 골드+30% / 저격수: 사거리+2","수호자: 라이프+15 / 번개신: 연쇄공격","시간술사: 슬로우 강화 / 연금술사: 균형형","도박사: 5라운드마다 랜덤 보너스"]},
                {icon:"⬆️",title:"강화 시스템",color:"#4ade80",items:["개별강화: 전설 이상만 가능 (최대 10강)","황금정령은 개별강화 20강 (강화마다 +1골드)","등급강화: 전 유닛 일괄 능력치 상승 (최대 20강)","코인 상점에서 유닛 직접 구매 가능","보관함: 노말 유닛 보관 후 연금술 조합에 활용"]},
                {icon:"💀",title:"보스 & 웨이브",color:"#f44",items:["5라운드마다 중간보스, 10라운드마다 보스 등장","보스는 약점 속성에만 정상 데미지 (나머지 10%)","10라운드 보스 처치 시 무속성 유닛 지급","20라운드마다 보스 처치 시 무속성 추가 지급","무리/속도/장갑/힐러 등 다양한 웨이브 등장","보스 HP 40% 이하 시 광폭화"]},
                {icon:"🏆",title:"클리어 개방 기준",color:"#fcd34d",items:[
                  "기본 속성: 불/물/대지/바람/인간/어둠/나무/오크/언데드/뱀파이어/수인",
                  "기본 등급: 노말~영웅 (고급 32종·영웅 25종 조합 가능)",
                  "1클리어: 번개/빛/천사/악마 추가 + 전설 등급 개방",
                  "3클리어: 신화 등급 개방",
                  "5클리어: 불멸 등급 개방 + 어려움 난이도 개방",
                  "난이도: 기본 쉬움 → 1클리어: 보통 → 5클리어: 어려움",
                ]},
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
      {showCheatModal&&(
        <div onClick={()=>setShowCheatModal(false)}
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:700,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#161b22",borderRadius:16,border:"1px solid #f59e0b",padding:20,width:"100%",maxWidth:320}}>
            <div style={{fontSize:15,fontWeight:"bold",color:"#fbbf24",marginBottom:4,textAlign:"center"}}>🔧 클리어 횟수 직접 설정</div>
            <div style={{fontSize:11,color:"#888",marginBottom:14,textAlign:"center"}}>버그로 누락된 클리어 기록을 복구할 때만 사용하세요.</div>
            <input type="number" min="0" max="999" value={cheatInput} onChange={e=>setCheatInput(e.target.value)}
              style={{width:"100%",background:"#0d1117",border:"1px solid #334155",borderRadius:8,padding:"10px",color:"#eee",fontSize:16,textAlign:"center",outline:"none",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowCheatModal(false)} style={{flex:1,background:"#21262d",border:"1px solid #30363d",color:"#aaa",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13}}>취소</button>
              <button onClick={()=>{
                const n=Math.max(0,Math.min(999,parseInt(cheatInput)||0));
                setClearCount(n);
                if(!isAdminMode)saveClearCount(nickname,n);
                setShowCheatModal(false);
              }} style={{flex:1,background:"#f59e0b",border:"none",color:"#000",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:"bold"}}>적용</button>
            </div>
          </div>
        </div>
      )}
      {showDex&&(()=>{
        const allGrades=["노말","고급","영웅","전설","신화","불멸"];
        const items=getDexByGrade(dexGradeFilter);
        return(
        <div onClick={()=>setShowDex(false)}
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:650,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:400,maxHeight:"86vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:"bold"}}>📔 도감 & 조합표</div>
              <button onClick={()=>setShowDex(false)} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            {/* 메인 탭: 도감 / 조합 재료 */}
            <div style={{display:"flex",gap:6,padding:"10px 14px 0",flexShrink:0}}>
              {[{key:'dex',label:'📔 유닛 도감'},{key:'combo',label:'⚗️ 조합 재료'}].map(tb=>(
                <button key={tb.key} onClick={()=>setDexTab(tb.key)}
                  style={{flex:1,background:dexTab===tb.key?"#1f6feb":"#1e293b",border:`1px solid ${dexTab===tb.key?"#3b82f6":"#334155"}`,color:dexTab===tb.key?"#fff":"#94a3b8",borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,fontWeight:dexTab===tb.key?"bold":"normal"}}>
                  {tb.label}
                </button>
              ))}
            </div>
            {/* 등급 필터 */}
            <div style={{display:"flex",gap:4,padding:"10px 14px 0",flexShrink:0,flexWrap:"wrap"}}>
              {allGrades.map(g=>(
                <button key={g} onClick={()=>setDexGradeFilter(g)}
                  style={{background:dexGradeFilter===g?(GC[g]||"#444")+"33":"#21262d",border:`2px solid ${dexGradeFilter===g?(GC[g]||"#aaa"):"#30363d"}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",color:dexGradeFilter===g?(GC[g]||"#eee"):"#666",fontSize:11,fontWeight:dexGradeFilter===g?"bold":"normal"}}>
                  {g}
                </button>
              ))}
            </div>
            {/* 콘텐츠 */}
            <div style={{overflowY:"auto",flex:1,padding:"12px 14px"}}>
              {dexTab==='dex'&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {items.map(item=>{
                    const trait=getElTrait(item.name);
                    return(
                      <div key={item.name} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",border:`1px solid ${GC[dexGradeFilter]||"#333"}33`,borderRadius:10,padding:"8px 10px"}}>
                        <div style={{width:36,height:36,borderRadius:9,background:`${GC[dexGradeFilter]||"#aaa"}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                          {EE[item.name]||"?"}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:"bold",color:"#eee"}}>{EN[item.name]||item.name}</div>
                          <div style={{fontSize:10,color:"#777"}}>{trait?.desc||""} {trait?.detail?`· ${trait.detail}`:""}</div>
                        </div>
                      </div>
                    );
                  })}
                  {items.length===0&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:30}}>해당 등급 유닛이 없습니다.</div>}
                </div>
              )}
              {dexTab==='combo'&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {dexGradeFilter==='노말'&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:30}}>노말 유닛은 뽑기로 획득합니다.</div>}
                  {items.filter(it=>it.parts).map(item=>(
                    <div key={item.name} style={{background:"#0f172a",border:`1px solid ${GC[dexGradeFilter]||"#333"}33`,borderRadius:10,padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                        <span style={{fontSize:15}}>{EE[item.name]||"?"}</span>
                        <span style={{fontSize:13,fontWeight:"bold",color:GC[dexGradeFilter]||"#eee"}}>{EN[item.name]||item.name}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {item.parts.map((p,i)=>(
                          <span key={i} style={{background:"#21262d",borderRadius:6,padding:"2px 7px",fontSize:10,color:"#aaa"}}>
                            {EE[p.u]||""} {EN[p.u]||p.u}{p.n>1?` x${p.n}`:""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {showNicknamePrompt&&(
        <div onClick={()=>{setShowNicknamePrompt(false);setNickname(nickname);}}
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:700,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#161b22",borderRadius:16,border:"1px solid #3b82f6",padding:24,width:"100%",maxWidth:320}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:8}}>👤</div>
            <div style={{fontSize:15,fontWeight:"bold",color:"#60a5fa",marginBottom:4,textAlign:"center"}}>닉네임 설정</div>
            <div style={{fontSize:11,color:"#888",marginBottom:14,textAlign:"center"}}>채팅·랭킹에 사용됩니다 (최대 12자)</div>
            <input value={nickname} onChange={e=>handleNicknameChange(e.target.value,12)}
              onKeyDown={e=>{
                if(e.key==='Enter'&&nickname.trim()){
                  const ok=confirmNickname();
                  if(ok!==false)setShowNicknamePrompt(false);
                }
              }}
              placeholder="닉네임 입력" autoFocus maxLength={12}
              style={{width:"100%",background:"#0d1117",border:`1px solid ${nicknameErr?"#ef4444":"#334155"}`,borderRadius:8,padding:"12px",color:"#eee",fontSize:16,textAlign:"center",outline:"none",marginBottom:6,boxSizing:"border-box"}}/>
            {nicknameErr&&<div style={{fontSize:11,color:"#ef4444",textAlign:"center",marginBottom:8}}>{nicknameErr}</div>}
            {!nicknameErr&&<div style={{height:20}}/>}
            <button
              onClick={()=>{
                if(!nickname.trim())return;
                const ok=confirmNickname();
                if(ok!==false)setShowNicknamePrompt(false);
              }}
              disabled={!nickname.trim()||!!nicknameErr}
              style={{width:"100%",background:nickname.trim()&&!nicknameErr?"linear-gradient(135deg,#1f6feb,#6e40c9)":"#21262d",border:"none",color:nickname.trim()&&!nicknameErr?"#fff":"#555",borderRadius:10,padding:"12px",cursor:nickname.trim()&&!nicknameErr?"pointer":"not-allowed",fontSize:15,fontWeight:"bold"}}>
              ✅ 확인
            </button>
          </div>
        </div>
      )}
      {showAdminPwPrompt&&(
        <div onClick={()=>{setShowAdminPwPrompt(false);setAdminPwInput('');}}
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:710,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#161b22",borderRadius:16,border:"1px solid #f59e0b",padding:20,width:"100%",maxWidth:320}}>
            <div style={{fontSize:32,textAlign:"center",marginBottom:6}}>🔐</div>
            <div style={{fontSize:15,fontWeight:"bold",color:"#fbbf24",marginBottom:4,textAlign:"center"}}>운영자 인증</div>
            <div style={{fontSize:11,color:"#888",marginBottom:14,textAlign:"center"}}>'운영', '운영자', '영자' 포함 닉네임은 비밀번호가 필요합니다.</div>
            <input type="password" value={adminPwInput} onChange={e=>setAdminPwInput(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='Enter'){
                  if(adminPwInput===ADMIN_PASSWORD){setNickname(pendingNicknameRef.current);setShowAdminPwPrompt(false);setAdminPwInput('');setClearCount(999);setIsAdminMode(true);pushToast('👑 관리자 모드: 모든 기능 개방!','#f59e0b');}
                  else{alert("비밀번호가 틀렸습니다!");}
                }
              }}
              placeholder="비밀번호 입력" autoFocus
              style={{width:"100%",background:"#0d1117",border:"1px solid #334155",borderRadius:8,padding:"10px",color:"#eee",fontSize:16,textAlign:"center",outline:"none",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowAdminPwPrompt(false);setAdminPwInput('');}} style={{flex:1,background:"#21262d",border:"1px solid #30363d",color:"#aaa",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13}}>취소</button>
              <button onClick={()=>{
                if(adminPwInput===ADMIN_PASSWORD){setNickname(pendingNicknameRef.current);setShowAdminPwPrompt(false);setAdminPwInput('');setClearCount(999);setIsAdminMode(true);pushToast('👑 관리자 모드: 모든 기능 개방!','#f59e0b');}
                else{alert("비밀번호가 틀렸습니다!");}
              }} style={{flex:1,background:"#f59e0b",border:"none",color:"#000",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:"bold"}}>확인</button>
            </div>
          </div>
        </div>
      )}
      {/* 일반 닉네임 비밀번호 모달 */}
      {showUserPwPrompt&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:340,padding:24}}>
            <div style={{fontSize:16,fontWeight:"bold",color:"#e2e8f0",marginBottom:6,textAlign:"center"}}>
              {userPwMode==="register"?"🔐 비밀번호 등록":"🔑 비밀번호 입력"}
            </div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16,textAlign:"center"}}>
              {userPwMode==="register"
                ?pendingNicknameRef.current+" 처음 접속입니다. 비밀번호를 등록해주세요."
                :pendingNicknameRef.current+" 의 비밀번호를 입력하세요."}
            </div>
            {userPwMsg&&<div style={{fontSize:12,color:userPwMsg.includes("완료")||userPwMsg.includes("성공")?"#4ade80":"#f87171",marginBottom:10,textAlign:"center",background:userPwMsg.includes("완료")||userPwMsg.includes("성공")?"#052e16":"#450a0a",borderRadius:8,padding:"6px 10px"}}>{userPwMsg}</div>}
            <input
              type="password"
              placeholder="비밀번호 입력 (4자 이상)..."
              value={userPwInput}
              onChange={e=>setUserPwInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")document.getElementById("userPwConfirmBtn")?.click();}}
              style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:8,padding:"10px 12px",color:"#e2e8f0",fontSize:14,marginBottom:12,boxSizing:"border-box",outline:"none"}}
              autoFocus
            />
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowUserPwPrompt(false);setUserPwInput("");setNickname("");}} style={{flex:1,background:"#21262d",border:"1px solid #30363d",color:"#aaa",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13}}>취소</button>
              <button id="userPwConfirmBtn" onClick={()=>{
                const pw=userPwInput.trim();
                if(!pw||pw.length<4){setUserPwMsg("비밀번호는 4자 이상이어야 합니다.");return;}
                const nick=pendingNicknameRef.current;
                if(userPwMode==="register"){
                  try{localStorage.setItem("upw_"+nick,pw);}catch{}
                  setUserPwMsg("✅ 등록 완료! 접속합니다...");
                  setTimeout(()=>{
                    setNickname(nick);
                    try{localStorage.setItem("nickname",nick);}catch{}
                    loadClearCountFromServer(nick).then(cnt=>{
                      let final=nick==="경찰"?Math.max(cnt,5):cnt;
                      if(nick==="경찰"&&final>cnt)saveClearCount(nick,final);
                      else saveClearCount(nick,final);
                      setClearCount(final);
                    });
                    setShowUserPwPrompt(false);setUserPwInput("");setUserPwMsg("");
                    setShowNicknamePrompt(false);
                    pushToast("환영합니다, "+nick+"!","#4ade80");
                  },1000);
                }else{
                  let stored="";try{stored=localStorage.getItem("upw_"+nick)||"";}catch{}
                  if(pw===stored){
                    setUserPwMsg("✅ 로그인 성공! 접속합니다...");
                    setTimeout(()=>{
                      setNickname(nick);
                      try{localStorage.setItem("nickname",nick);}catch{}
                      loadClearCountFromServer(nick).then(cnt=>{
                        const final=nick==="경찰"?Math.max(cnt,5):cnt;
                        if(nick==="경찰"&&final>cnt)saveClearCount(nick,final);
                        setClearCount(final);
                      });
                      setShowUserPwPrompt(false);setUserPwInput("");setUserPwMsg("");
                      setShowNicknamePrompt(false);
                      pushToast(nick+"님 접속!","#60a5fa");
                    },800);
                  }else{
                    setUserPwMsg("❌ 비밀번호가 틀렸습니다.");
                    setUserPwInput("");
                  }
                }
              }} style={{flex:1.5,background:"#1d4ed8",border:"none",color:"#fff",borderRadius:8,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:"bold"}}>
                {userPwMode==="register"?"등록":"확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멀티플레이 로비 */}
      {multiPhase==='lobby'&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16,overflowY:"auto"}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:380,padding:20}}>
            {/* 헤더 */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:16,fontWeight:"bold",color:"#4ade80"}}>👥 멀티플레이</div>
              <button onClick={()=>{setMultiPhaseWithRef(null);setRoomTypeSelect('public');setCustomRoomCode('');setJoinInput('');}} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>

            {/* ── 방 만들기 섹션 ── */}
            <div style={{background:"#0d1117",borderRadius:12,padding:14,marginBottom:14,border:"1px solid #21262d"}}>
              <div style={{fontSize:12,color:"#888",marginBottom:10,fontWeight:"bold"}}>🏠 방 만들기</div>
              {/* 공개/비공개 탭 */}
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                {[{key:'public',label:'🌐 공개방',desc:'누구나 참가 가능'},{key:'private',label:'🔒 비공개방',desc:'코드 아는 사람만'}].map(t=>(
                  <button key={t.key} onClick={()=>setRoomTypeSelect(t.key)}
                    style={{flex:1,background:roomTypeSelect===t.key?"#1f3a5f":"#161b22",border:`2px solid ${roomTypeSelect===t.key?"#3b82f6":"#30363d"}`,borderRadius:10,padding:"8px 6px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
                    <div style={{fontSize:12,fontWeight:"bold",color:roomTypeSelect===t.key?"#60a5fa":"#555"}}>{t.label}</div>
                    <div style={{fontSize:10,color:roomTypeSelect===t.key?"#94a3b8":"#444",marginTop:2}}>{t.desc}</div>
                  </button>
                ))}
              </div>
              {/* 비공개: 코드 입력 */}
              {roomTypeSelect==='private'&&(
                <div style={{marginBottom:10}}>
                  <input
                    value={customRoomCode}
                    onChange={e=>setCustomRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))}
                    placeholder="방 코드 입력 (4~8자, 영문/숫자)"
                    style={{width:"100%",background:"#161b22",border:"1px solid #3b82f6",borderRadius:8,padding:"10px 12px",color:"#eee",fontSize:14,outline:"none",boxSizing:"border-box",letterSpacing:3,textAlign:"center"}}
                  />
                  <div style={{fontSize:10,color:"#555",marginTop:4,textAlign:"center"}}>친구에게 이 코드를 알려주세요</div>
                </div>
              )}
              {roomTypeSelect==='public'&&(
                <div style={{fontSize:11,color:"#555",marginBottom:10,textAlign:"center"}}>방 코드가 자동 생성됩니다 · 공개방 목록에 표시</div>
              )}
              <button
                onClick={()=>createRoom(roomTypeSelect==='private',customRoomCode)}
                disabled={roomTypeSelect==='private'&&customRoomCode.length<4}
                style={{width:"100%",background:roomTypeSelect==='private'&&customRoomCode.length<4?"#21262d":"linear-gradient(135deg,#1f6feb,#6e40c9)",border:"none",color:"#fff",borderRadius:10,padding:"11px 0",cursor:roomTypeSelect==='private'&&customRoomCode.length<4?"not-allowed":"pointer",fontSize:14,fontWeight:"bold",opacity:roomTypeSelect==='private'&&customRoomCode.length<4?0.5:1}}>
                {roomTypeSelect==='public'?"🌐 공개방 만들기":"🔒 비공개방 만들기"}
              </button>
            </div>

            {/* ── 방 참가 섹션 ── */}
            <div style={{background:"#0d1117",borderRadius:12,padding:14,border:"1px solid #21262d"}}>
              <div style={{fontSize:12,color:"#888",marginBottom:10,fontWeight:"bold"}}>🚪 방 참가</div>
              {/* 코드 직접 입력 */}
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <input
                  value={joinInput}
                  onChange={e=>setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))}
                  placeholder="방 코드 입력"
                  style={{flex:1,background:"#161b22",border:"1px solid #30363d",borderRadius:8,padding:"10px 12px",color:"#eee",fontSize:14,outline:"none",letterSpacing:3,textAlign:"center"}}
                />
                <button onClick={()=>joinRoom(joinInput)}
                  disabled={joinInput.length<4}
                  style={{background:joinInput.length>=4?"#22c55e22":"#161b22",border:`1px solid ${joinInput.length>=4?"#22c55e":"#333"}`,color:joinInput.length>=4?"#4ade80":"#555",borderRadius:8,padding:"10px 18px",cursor:joinInput.length<4?"not-allowed":"pointer",fontSize:13,fontWeight:"bold",opacity:joinInput.length<4?0.5:1,whiteSpace:"nowrap"}}>
                  참가
                </button>
              </div>
              {/* 공개방 목록 */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:11,color:"#888"}}>🌐 공개방 목록</div>
                <button onClick={loadPublicRooms} style={{background:"none",border:"none",color:"#4af",fontSize:10,cursor:"pointer",padding:0}}>
                  {publicRoomsLoading?"⏳":"🔄"} 새로고침
                </button>
              </div>
              {publicRooms.length===0&&!publicRoomsLoading&&(
                <div style={{textAlign:"center",color:"#444",fontSize:11,padding:"10px 0"}}>공개방이 없습니다</div>
              )}
              {publicRoomsLoading&&<div style={{textAlign:"center",color:"#555",fontSize:11,padding:"10px 0"}}>불러오는 중...</div>}
              {publicRooms.map(room=>(
                <div key={room.id} onClick={()=>setSelectedRoom(room)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#161b22",borderRadius:8,marginBottom:6,border:"1px solid #21262d",cursor:"pointer",transition:"border-color 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='#22c55e'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='#21262d'}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:"#eee",fontWeight:"bold"}}>{room.host}의 방</div>
                    <div style={{fontSize:10,color:"#555",marginTop:2}}>
                      코드: <span style={{color:"#fcd34d",letterSpacing:2}}>{room.id}</span>
                      <span style={{marginLeft:8}}>👤 {room.playerCount||0}명 대기중</span>
                    </div>
                  </div>
                  <span style={{fontSize:11,color:"#4ade80"}}>▶</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 공개방 참가 확인 팝업 */}
      {selectedRoom&&(
        <div onClick={()=>setSelectedRoom(null)}
          style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20}}>
          <div onClick={e=>e.stopPropagation()}
            style={{background:"#161b22",borderRadius:16,border:"1px solid #22c55e",padding:22,width:"100%",maxWidth:320}}>
            <div style={{fontSize:13,color:"#888",marginBottom:4}}>이 방에 참가할까요?</div>
            <div style={{fontSize:18,fontWeight:"bold",color:"#eee",marginBottom:4}}>{selectedRoom.host}의 방</div>
            <div style={{fontSize:12,color:"#555",marginBottom:6}}>
              코드: <span style={{color:"#fcd34d",letterSpacing:3,fontWeight:"bold"}}>{selectedRoom.id}</span>
              <span style={{marginLeft:10}}>👤 {selectedRoom.playerCount||0}명 대기중</span>
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:16}}>
              난이도: <span style={{color:"#60a5fa"}}>{selectedRoom.difficulty==='easy'?'🌱 쉬움':selectedRoom.difficulty==='normal'?'⚔️ 보통':'💀 어려움'}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setSelectedRoom(null)}
                style={{flex:1,background:"#21262d",border:"1px solid #30363d",color:"#888",borderRadius:10,padding:"11px 0",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>
                취소
              </button>
              <button onClick={()=>{const r=selectedRoom;setSelectedRoom(null);joinRoom(r.id);}}
                style={{flex:2,background:"linear-gradient(135deg,#166534,#15803d)",border:"1px solid #22c55e",color:"#4ade80",borderRadius:10,padding:"11px 0",cursor:"pointer",fontSize:14,fontWeight:"bold"}}>
                ✅ 참가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 멀티플레이 대기실 */}
      {multiPhase==='waiting'&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.95)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16,overflowY:"auto"}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:380,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:16,fontWeight:"bold",color:"#4ade80"}}>🏠 대기실</div>
              <button onClick={leaveRoom} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#888",marginBottom:12}}>
              방 코드: <span style={{color:"#fcd34d",fontWeight:"bold",letterSpacing:4,fontSize:14}}>{myRoomId}</span>
              <span style={{color:"#555",marginLeft:8}}>· 친구에게 공유하세요</span>
            </div>

            {/* 난이도/속도 설정 - 방장만 표시 */}
            {isHostRef.current&&(
              <>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,color:"#888",marginBottom:6}}>⚔️ 난이도</div>
                <div style={{display:"flex",gap:6}}>
                  {[{key:'easy',label:'🌱 쉬움',color:'#4ade80'},{key:'normal',label:'⚔️ 보통',color:'#60a5fa'},{key:'hard',label:'💀 어려움',color:'#f87171'}].map(d=>(
                    <button key={d.key} onClick={async()=>{
                      setDifficulty(d.key);
                      if(myRoomId){try{await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${myRoomId}`,{method:'PATCH',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({difficulty:d.key})});}catch(e){}}
                    }}
                      style={{flex:1,background:difficulty===d.key?`${d.color}22`:"#0d1117",border:`2px solid ${difficulty===d.key?d.color:"#21262d"}`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:11,color:difficulty===d.key?d.color:"#555",fontWeight:"bold"}}>{d.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:"#888",marginBottom:6}}>⚡ 게임 속도</div>
                <div style={{display:"flex",gap:6}}>
                  {[{s:1,label:'1x'},{s:2,label:'2x'},{s:3,label:'3x'},{s:4,label:'4x'}].map(sp=>(
                    <button key={sp.s} onClick={async()=>{
                      setMultiSpeed(sp.s);
                      if(myRoomId){try{await fetch(`${SUPABASE_URL}/rest/v1/rooms?id=eq.${myRoomId}`,{method:'PATCH',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({speed:sp.s})});}catch(e){}}
                    }}
                      style={{flex:1,background:multiSpeed===sp.s?"#1e3a5f":"#0d1117",border:`2px solid ${multiSpeed===sp.s?"#3b82f6":"#21262d"}`,borderRadius:8,padding:"8px 4px",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:13,color:multiSpeed===sp.s?"#93c5fd":"#555",fontWeight:"bold"}}>{sp.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              </>
            )}
            {!isHostRef.current&&roomInfo&&(
              <div style={{marginBottom:12,background:"#0d1117",borderRadius:8,padding:"8px 12px",border:"1px solid #21262d",fontSize:11,color:"#555"}}>
                {difficulty==='easy'?'🌱 쉬움':difficulty==='normal'?'⚔️ 보통':'💀 어려움'} · {multiSpeed}x 속도 (방장 설정)
              </div>
            )}

            {/* 참가자 목록 */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,color:"#888",marginBottom:8}}>참가자 {roomPlayers.length}명</div>
              {roomPlayers.map(p=>(
                <div key={p.nickname} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#0d1117",borderRadius:8,marginBottom:6,border:"1px solid #21262d"}}>
                  <span style={{fontSize:16}}>{p.nickname===roomInfo?.host?"👑":"👤"}</span>
                  <span style={{fontSize:14,color:"#eee",flex:1}}>{p.nickname}</span>
                  {p.nickname===roomInfo?.host&&<span style={{fontSize:10,color:"#fcd34d",background:"#2d1f00",borderRadius:4,padding:"2px 6px"}}>방장</span>}
                  {p.nickname===nickname.trim()&&<span style={{fontSize:10,color:"#60a5fa",background:"#0c1a2e",borderRadius:4,padding:"2px 6px"}}>나</span>}
                </div>
              ))}
            </div>

            {isHostRef.current?(
              <button onClick={startMultiGameAsHost}
                disabled={roomPlayers.length<2}
                style={{width:"100%",background:roomPlayers.length>=2?"linear-gradient(135deg,#1f6feb,#6e40c9)":"#21262d",border:"none",color:"#fff",borderRadius:10,padding:"13px 0",cursor:roomPlayers.length>=2?"pointer":"not-allowed",fontSize:15,fontWeight:"bold",opacity:roomPlayers.length<2?0.5:1}}>
                {roomPlayers.length>=2?"⚔️ 게임 시작":"⏳ 2명 이상 필요"}
              </button>
            ):(
              <div style={{textAlign:"center",color:"#555",fontSize:13,padding:"14px 0",background:"#0d1117",borderRadius:10,border:"1px solid #1e293b"}}>
                ⏳ 방장이 게임을 시작할 때까지 대기 중...
              </div>
            )}
          </div>
        </div>
      )}

      </>
    );
  }

  // ══════════════════════════════════════════
  // 히든영웅 선택 화면
  // ══════════════════════════════════════════
  // ── 난이도 선택 화면
  if(phase==='diff'){
    return(
      <div style={{fontFamily:"sans-serif",background:"#0d1117",height:"100dvh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px",boxSizing:"border-box"}}>
        <div style={{width:"100%",maxWidth:400,background:"#161b22",borderRadius:16,padding:24,border:"1px solid #30363d"}}>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:11,color:"#4af",marginBottom:6}}>🗺️ {currentMapName} 맵</div>
            <div style={{fontSize:22,fontWeight:"bold",marginBottom:4}}>⚔️ 난이도 선택</div>
            <div style={{fontSize:12,color:"#666"}}>난이도를 선택해주세요</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
            {[
              {key:'easy',label:'🌱 쉬움',desc:'공격력 ×2.2 · 입문자 추천',color:'#4f8',need:0},
              {key:'normal',label:'⚔️ 보통',desc:'공격력 ×1.5 · 1클리어 해금',color:'#4af',need:1},
              {key:'hard',label:'💀 어려움',desc:'공격력 ×1.3 · 5클리어 해금',color:'#f44',need:5},
            ].map(d=>{
              const unlocked=clearCount>=d.need;
              return(
                <button key={d.key} onClick={()=>unlocked&&setDifficulty(d.key)}
                  style={{background:difficulty===d.key&&unlocked?d.color+'22':'#21262d',
                    border:`2px solid ${difficulty===d.key&&unlocked?d.color:'#30363d'}`,
                    borderRadius:12,padding:"14px 18px",cursor:unlocked?"pointer":"not-allowed",
                    textAlign:"left",display:"flex",alignItems:"center",gap:14,opacity:unlocked?1:0.4}}>
                  <div style={{fontSize:32}}>{unlocked?d.label.split(' ')[0]:"🔒"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:"bold",color:difficulty===d.key&&unlocked?d.color:'#aaa'}}>
                      {unlocked?d.label.split(' ').slice(1).join(' '):`${d.need}클리어 후 개방`}
                    </div>
                    <div style={{fontSize:11,color:"#666",marginTop:3}}>{unlocked?d.desc:`${d.need}번 클리어하면 해금됩니다`}</div>
                  </div>
                  {difficulty===d.key&&unlocked&&<span style={{fontSize:18,color:d.color}}>✓</span>}
                </button>
              );
            })}
          </div>
          <button onClick={()=>setPhase('hidden')}
            style={{width:"100%",background:"linear-gradient(135deg,#1f6feb,#6e40c9)",border:"none",color:"#fff",borderRadius:12,padding:"14px 0",cursor:"pointer",fontSize:16,fontWeight:"bold",marginBottom:10}}>
            다음 → 영웅 선택
          </button>
          <button onClick={()=>setPhase('title')}
            style={{width:"100%",background:"#21262d",border:"1px solid #30363d",color:"#666",borderRadius:10,padding:"10px",cursor:"pointer",fontSize:13}}>
            ← 타이틀로
          </button>
        </div>
      </div>
    );
  }

  // ── 히든영웅 선택 화면
  if(phase==='hidden'){
    // 멀티 게스트: 방장이 히든영웅 고를 때까지 대기
    if(G.current?.multiRoomId&&!isHostRef.current){
      return(
        <div style={{fontFamily:"sans-serif",background:"#0d1117",height:"100dvh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,boxSizing:"border-box"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:16}}>👑</div>
            <div style={{fontSize:18,fontWeight:"bold",marginBottom:8}}>방장이 영웅을 선택 중...</div>
            <div style={{fontSize:13,color:"#555"}}>방장이 히든영웅을 선택하면 자동으로 게임이 시작됩니다</div>
          </div>
        </div>
      );
    }
    return(
      <div style={{fontFamily:"sans-serif",background:"#0d1117",height:"100dvh",maxHeight:"100dvh",color:"#eee",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"10px 12px",boxSizing:"border-box",overflow:"hidden"}}>
        <div style={{width:"100%",maxWidth:400,display:"flex",flexDirection:"column",height:"100%",maxHeight:"100%"}}>
          {/* 헤더 */}
          <div style={{textAlign:"center",marginBottom:8,flexShrink:0}}>
            <div style={{fontSize:10,color:"#4af",marginBottom:2}}>🗺️ {currentMapName} · {difficulty==='easy'?'🌱 쉬움':difficulty==='normal'?'⚔️ 보통':'💀 어려움'}</div>
            <div style={{fontSize:17,fontWeight:"bold"}}>👑 히든영웅 선택</div>
          </div>
          {/* 영웅 목록 */}
          <div style={{display:"flex",flexDirection:"column",gap:5,flex:1,minHeight:0}}>
            {HH.map(h=>{
              const unlocked=clearCount>=h.unlockAt||!!G.current?.multiRoomId;
              if(unlocked){
                return(
                  <button key={h.id} onClick={()=>pickHidden(h)}
                    style={{background:`${h.color}18`,border:`2px solid ${h.color}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",color:"#eee",textAlign:"left",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                    <span style={{fontSize:24,flexShrink:0}}>{h.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:"bold",fontSize:14,color:h.color}}>{h.name}</div>
                      <div style={{fontSize:11,color:"#aaa",marginTop:1}}>{h.desc}</div>
                    </div>
                    <span style={{fontSize:10,color:h.color,background:`${h.color}22`,borderRadius:4,padding:"2px 8px",flexShrink:0}}>선택</span>
                  </button>
                );
              }else{
                return(
                  <div key={h.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 14px",opacity:0.7}}>
                    <span style={{fontSize:14}}>🔒</span>
                    <span style={{fontSize:11,color:"#888"}}>{h.unlockAt}클리어 후 개방</span>
                  </div>
                );
              }
            })}
          </div>
          {/* 뒤로가기 */}
          <button onClick={()=>setPhase('diff')} style={{marginTop:8,background:"#21262d",border:"1px solid #30363d",color:"#666",borderRadius:8,padding:"8px",cursor:"pointer",fontSize:12,width:"100%",flexShrink:0}}>← 난이도 다시 선택</button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // 게임 화면
  // ══════════════════════════════════════════
  return(
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#060d1a",height:"100dvh",maxHeight:"100dvh",color:"#e2e8f0",display:"flex",flexDirection:"column",alignItems:"center",padding:"0",overflow:"hidden",boxSizing:"border-box"}}>
      <div style={{width:"100%",maxWidth:520,height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <SummonOverlay anim={summonAnim} onClose={()=>setSummonAnim(null)}/>

      {showChat&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}}>
          <div style={{background:"#161b22",borderRadius:16,border:"1px solid #30363d",width:"100%",maxWidth:400,maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"14px 18px 10px",borderBottom:"1px solid #21262d",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:"bold"}}>💬 채팅</div>
              <button onClick={()=>setShowChat(false)} style={{background:"none",border:"none",color:"#555",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:6,padding:"10px 14px 0",flexShrink:0}}>
              {[{key:'chat',label:'💬 전체채팅'},{key:'log',label:'📜 내 기록'}].map(tb=>(
                <button key={tb.key} onClick={()=>{setChatTab(tb.key);if(tb.key==='chat')loadChatMessages();}}
                  style={{flex:1,background:chatTab===tb.key?"#1f6feb":"#1e293b",border:`1px solid ${chatTab===tb.key?"#3b82f6":"#334155"}`,color:chatTab===tb.key?"#fff":"#94a3b8",borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,fontWeight:chatTab===tb.key?"bold":"normal"}}>
                  {tb.label}
                </button>
              ))}
            </div>
            {chatTab==='chat'&&!isAdmin()&&(
              <div style={{fontSize:10,color:"#555",textAlign:"center",padding:"6px 0 0"}}>오늘 메시지만 표시됩니다 (매일 초기화)</div>
            )}

            {chatTab==='chat'&&(<>
              <div ref={chatScrollRef} style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:6,minHeight:200}}>
                {chatLoading&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:20}}>불러오는 중...</div>}
                {!chatLoading&&chatMessages.length===0&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:20}}>아직 메시지가 없습니다. 첫 메시지를 남겨보세요!</div>}
                {!chatLoading&&chatMessages.map(m=>{
                  const isMe=m.name===nickname.trim();
                  const isMsgAdmin=containsAdminKeyword(m.name);
                  return(
                    <div key={m.id} style={{alignSelf:isMe?"flex-end":"flex-start",maxWidth:"80%"}}>
                      <div style={{fontSize:10,color:isMe?"#60a5fa":isMsgAdmin?"#fbbf24":"#888",marginBottom:2,textAlign:isMe?"right":"left"}}>{isMsgAdmin?"👑 ":""}{m.name}</div>
                      <div style={{background:isMe?"#1d4ed8":isMsgAdmin?"#3a2e0f":"#21262d",color:"#eee",borderRadius:10,padding:"6px 10px",fontSize:13,wordBreak:"break-word",border:isMsgAdmin&&!isMe?"1px solid #f59e0b44":"none"}}>{m.message}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:6,padding:"10px 14px",borderTop:"1px solid #21262d",flexShrink:0}}>
                <input value={chatInput} onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')sendChatMessage();}}
                  placeholder="메시지 입력..." maxLength={200}
                  style={{flex:1,background:"#0d1117",border:"1px solid #334155",borderRadius:8,padding:"8px 10px",color:"#eee",fontSize:13,outline:"none"}}/>
                <button onClick={sendChatMessage} style={{background:"#1f6feb",border:"none",color:"#fff",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:13,fontWeight:"bold"}}>전송</button>
              </div>
            </>)}

            {chatTab==='log'&&(
              <div style={{flex:1,overflowY:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:6,minHeight:200,maxHeight:400}}>
                {pullLog.length===0&&<div style={{textAlign:"center",color:"#555",fontSize:12,padding:20}}>아직 뽑기/조합 기록이 없습니다.</div>}
                {pullLog.map(log=>(
                  <div key={log.id} style={{display:"flex",alignItems:"center",gap:8,background:"#1c1f26",borderRadius:8,padding:"6px 10px",fontSize:12}}>
                    <span style={{color:"#888",fontSize:10,flexShrink:0,minWidth:34}}>{log.ts.getHours().toString().padStart(2,'0')}:{log.ts.getMinutes().toString().padStart(2,'0')}</span>
                    <span style={{color:"#60a5fa",flexShrink:0}}>{log.action}</span>
                    <span style={{flex:1}}>{EE[log.el]||""} {EN[log.el]||log.el}</span>
                    <span style={{color:GC[log.grade]||"#888",fontWeight:"bold",flexShrink:0}}>[{log.grade}]</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* 멀티 현황판 */}
      {showMultiStatus&&G.current?.multiRoomId&&(
        <div style={{position:"fixed",top:52,right:8,zIndex:500,background:"rgba(13,17,23,0.95)",border:"1px solid #30363d",borderRadius:12,padding:12,minWidth:200,maxWidth:260,backdropFilter:"blur(8px)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:"bold",color:"#4ade80"}}>👥 멀티 현황</div>
            <button onClick={()=>setShowMultiStatus(false)} style={{background:"none",border:"none",color:"#555",fontSize:14,cursor:"pointer"}}>✕</button>
          </div>
          {roomPlayers.length===0?(
            <div style={{fontSize:11,color:"#555",textAlign:"center",padding:"8px 0"}}>현황 로딩 중...</div>
          ):roomPlayers.map(p=>(
            <div key={p.nickname} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",background:p.nickname===G.current?.multiNickname?"#0f2d4a":"#161b22",borderRadius:8,marginBottom:4,border:`1px solid ${p.nickname===G.current?.multiNickname?"#1d4ed8":"#21262d"}`}}>
              <span style={{fontSize:12}}>{p.is_alive===false?"💀":p.enemies_clear?"✅":"⚔️"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:"#eee",fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {p.nickname}{p.nickname===G.current?.multiNickname&&" (나)"}
                </div>
                <div style={{fontSize:10,color:"#888",marginTop:1}}>
                  R{p.round||1} · ❤️{p.life} · 💰{p.gold}G
                  {p.enemy_count!=null&&<span style={{color:p.enemy_count>0?"#f87171":"#4ade80",marginLeft:4}}>👾{p.enemy_count}</span>}
                </div>
              </div>
            </div>
          ))}
          <div style={{fontSize:9,color:"#333",textAlign:"right",marginTop:4}}>2초마다 갱신</div>
        </div>
      )}

      {/* 토스트 알림 (우측 상단, 3초 후 사라짐) */}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}html,body{overflow:hidden;height:100%;margin:0;padding:0;}`}</style>
      <div style={{position:"fixed",top:60,right:8,zIndex:600,display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",pointerEvents:"none"}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:"#0f172a",border:`1px solid ${t.color}`,borderRadius:8,padding:"7px 12px",fontSize:12,color:"#eee",boxShadow:`0 2px 12px ${t.color}33`,maxWidth:220,animation:"toastIn 0.25s ease-out"}}>
            {t.text}
          </div>
        ))}
      </div>

      {/* HUD */}
      <div style={{width:"100%",maxWidth:480,marginBottom:4}}>
        {/* 1줄: 🏠 ❤️ 히든영웅 R라운드 💰 🪙 👾 */}
        {(()=>{
          const g=G.current;
          const hhId=g?.hiddenHero?.id;
          const hhData=hhId?HH.find(h=>h.id===hhId):null;
          return(
            <div style={{display:"flex",alignItems:"center",gap:3,background:"#0f172a",borderRadius:"10px 10px 0 0",padding:"4px 6px",border:"1px solid #1e293b",borderBottom:"none"}}>
              <button onClick={()=>setPhase('title')} style={{background:"transparent",border:"1px solid #1e293b",color:"#6b7280",borderRadius:6,padding:"2px 5px",cursor:"pointer",fontSize:10,flexShrink:0}}>🏠</button>
              <span style={{background:"#450a0a",borderRadius:6,padding:"2px 5px",fontSize:11,color:"#fca5a5",fontWeight:"bold",flexShrink:0}}>❤️{ui.life}</span>
              {hhData&&<span style={{background:`${hhData.color}22`,border:`1px solid ${hhData.color}55`,borderRadius:6,padding:"2px 5px",fontSize:10,color:hhData.color,fontWeight:"bold",flexShrink:0}}>{hhData.emoji}{hhData.desc}</span>}
              <span style={{background:"#172554",borderRadius:6,padding:"2px 6px",fontSize:11,color:"#93c5fd",fontWeight:"bold",flexShrink:0}}>R{ui.round}<span style={{fontSize:9,color:"#374151"}}>/{g?.difficulty==='easy'?50:g?.difficulty==='normal'?70:100}</span></span>
              <span style={{flex:1}}/>
              <span style={{background:"#1c1917",borderRadius:6,padding:"2px 5px",fontSize:11,color:"#fcd34d",fontWeight:"bold",flexShrink:0}}>💰{ui.gold}G</span>
              <span style={{background:"#1e1b4b",borderRadius:6,padding:"2px 5px",fontSize:11,color:"#a78bfa",fontWeight:"bold",flexShrink:0,cursor:"pointer"}} onClick={()=>setModal("shop")}>🪙{ui.coins}</span>
              <span style={{background:ui.total>=25?"#450a0a":ui.total>=15?"#1c1917":"#111827",borderRadius:6,padding:"2px 5px",fontSize:11,color:ui.total>=25?"#f87171":ui.total>=15?"#fcd34d":"#6b7280",fontWeight:ui.total>=15?"bold":"normal",flexShrink:0}}>👾{ui.total}/30</span>
            </div>
          );
        })()}
        {/* 2줄: 맵/난이도 + 배속토글 + 대화 + 조합표 */}
        <div style={{display:"flex",alignItems:"center",gap:3,background:"#0a0f1a",padding:"3px 6px",border:"1px solid #1e293b",borderTop:"none",borderBottom:countdown>0?"none":"none"}}>
          <span style={{background:"#1e293b",borderRadius:5,padding:"2px 5px",fontSize:10,color:"#60a5fa",flexShrink:0}}>{currentMapName}{rotMode?" 🔄":""}</span>
          <span style={{background:"#1e293b",borderRadius:5,padding:"2px 5px",fontSize:10,color:G.current?.difficulty==='easy'?'#4ade80':G.current?.difficulty==='normal'?'#60a5fa':'#f87171',flexShrink:0}}>
            {G.current?.difficulty==='easy'?'쉬움':G.current?.difficulty==='normal'?'보통':'어려움'}
          </span>
          {countdown>0&&!G.current?.multiRoomId&&(
            <button onClick={skipCountdown}
              style={{background:"#166534",border:"1px solid #22c55e",color:"#4ade80",borderRadius:5,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:"bold",flexShrink:0}}>
              ▶ 라운드스킵 {countdown}s
            </button>
          )}
          {G.current?.multiRoomId&&countdown>0&&isHostRef.current&&(
            <button onClick={skipCountdown}
              style={{background:"#1e3a5f",border:"2px solid #60a5fa",color:"#93c5fd",borderRadius:5,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:"bold",flexShrink:0}}>
              👑 방장스킵 {countdown}s
            </button>
          )}
          {G.current?.multiRoomId&&multiEnemiesClear&&countdown===0&&(
            <button onClick={skipRound}
              style={{background:"#14532d",border:"2px solid #4ade80",color:"#4ade80",borderRadius:5,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:"bold",flexShrink:0}}>
              ⏭️ 스킵 (전원강제)
            </button>
          )}
          <span style={{flex:1}}/>
          {/* 배속 토글: 멀티 게임 중엔 숨김 */}
          {!G.current?.multiRoomId&&(
            <button onClick={()=>changeSpeed(speed>=4?1:speed+1)}
              style={{background:"#1d4ed8",border:"1px solid #3b82f6",color:"#fff",borderRadius:6,padding:"2px 10px",cursor:"pointer",fontSize:12,fontWeight:"bold",flexShrink:0}}>
              {speed}x
            </button>
          )}
          <button onClick={()=>{setShowChat(true);loadChatMessages();}} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold",flexShrink:0}}>💬</button>
          {G.current?.multiRoomId&&<button onClick={()=>setShowMultiStatus(v=>!v)} style={{background:showMultiStatus?"#1e3a5f":"#1e293b",border:`1px solid ${showMultiStatus?"#3b82f6":"transparent"}`,color:showMultiStatus?"#93c5fd":"#94a3b8",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold",flexShrink:0}}>👥</button>}
          <button onClick={()=>{setComboFilter("고급");setComboSearch("");setShowCombo(true);}} style={{background:"#1e293b",border:"none",color:"#94a3b8",borderRadius:5,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:"bold",flexShrink:0}}>조합표</button>
        </div>
        {/* 보스 라운드 정보 줄 */}
        {countdown>0&&(()=>{
          const nb=G.current?.round%10===0;
          const bossInfo=nb?makeBoss(G.current?.round||10):null;
          if(!bossInfo)return(
            <div style={{background:"#052e16",borderRadius:"0 0 10px 10px",padding:"3px 8px",border:"1px solid #166534",borderTop:"none",display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#4ade80"}}>
              {G.current?.waveLabel&&<span style={{color:"#fcd34d",fontWeight:"bold"}}>{G.current.waveLabel}</span>}
            </div>
          );
          return(
            <div style={{background:"#1c0a0a",borderRadius:"0 0 10px 10px",padding:"5px 10px",border:"1px solid #7f1d1d",borderTop:"1px solid #1e293b",display:"flex",alignItems:"center",gap:8,fontSize:11}}>
              <span style={{fontSize:16}}>{bossInfo.emoji}</span>
              <span style={{color:"#fca5a5",fontWeight:"bold"}}>{bossInfo.name}</span>
              <span style={{color:"#888",flex:1}}>{bossInfo.desc}</span>
              <div style={{display:"flex",gap:3}}>
                {(bossInfo.weak||[]).map(w=>(
                  <span key={w} style={{background:"#451a03",border:"1px solid #f97316",borderRadius:4,padding:"1px 4px",color:"#fb923c",fontSize:10}}>{EE[w]||w}</span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>


      <canvas ref={cvs} width={COLS*CS} height={ROWS*CS}
        onTouchEnd={(e)=>{
          e.preventDefault();
          const t=e.changedTouches[0];
          onCanvas({clientX:t.clientX,clientY:t.clientY});
        }}
        onClick={onCanvas}
        style={{width:"100%",flex:1,minHeight:0,display:"block",
          borderRadius:8,
          border:`2px solid ${drag?"rgba(251,191,36,0.6)":selHero?"rgba(99,102,241,0.5)":"#1e293b"}`,
          boxShadow:drag?"0 0 15px rgba(251,191,36,0.2)":selHero?"0 0 15px rgba(99,102,241,0.15)":"0 4px 20px rgba(0,0,0,0.5)",
          cursor:drag||selHero?"crosshair":"default",touchAction:"none"}}/>

      {/* 게임오버 */}
      {ui.over&&(()=>{
        const g=G.current;
        const diff=g?.difficulty||'hard';
        const diffLabel=diff==='easy'?'🌱쉬움':diff==='normal'?'⚔️보통':'💀어려움';
        const targetRound=diff==='easy'?50:diff==='normal'?70:100;
        return(<Overlay>
          <div style={{fontSize:40,textAlign:"center"}}>💀</div>
          <div style={{fontSize:20,fontWeight:"bold",color:"#f44",margin:"8px 0",textAlign:"center"}}>게임 오버</div>
          <div style={{background:"#21262d",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>닉네임</span><span style={{color:"#eee",fontWeight:"bold"}}>{nickname||'익명'}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>난이도</span><span>{diffLabel}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"#888"}}>라운드</span><span style={{color:"#4af",fontWeight:"bold"}}>R{ui.round}/{targetRound}</span></div>
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
        const targetRound=diff==='easy'?50:diff==='normal'?70:100;
        return(<Overlay>
          <div style={{fontSize:44,textAlign:"center"}}>🏆</div>
          <div style={{fontSize:22,fontWeight:"bold",color:"#fd0",margin:"8px 0",textAlign:"center"}}>{targetRound}층 클리어!</div>
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
          <Btn bg="linear-gradient(135deg,#7c3aed,#4f46e5)" onClick={async()=>{
            await saveRecord(true);
            const g=G.current;
            g.victory=false;g.over=false;g.infiniteMode=true;
            g.round++;g.cleared=false;g.total=0;g.spawnT=0;g.spawnC=0;g.bossSpawned=false;g.midSpawned=false;
            const nb=g.round%10===0,nm=g.round%5===0&&g.round%10!==0;
            const newWt=getWaveType(g.round);
            g.waveType=newWt;
            const waveLabels={normal:'',horde:'🐝 무리 웨이브!',fast:'⚡ 속도 웨이브!',armored:'🛡️ 장갑 웨이브!',healer:'💚 힐러 웨이브!',boss:'💀 보스!',mid:'⚡ 중간보스!'};
            g.waveLabel=waveLabels[newWt]||'';
            g.maxSpawn=nb?1:nm?1:newWt==='horde'?Math.floor((15+g.round)*1.8):g.rotMode?20:15+g.round;
            g.running=true;lt.current=performance.now();
            raf.current=requestAnimationFrame((t)=>gameLoopRef.current(t));
            sync();
            setUi(prev=>({...prev,victory:false,over:false}));
          }} style={{width:"100%",marginBottom:6,border:"1px solid #7c3aed"}}>🌀 무한모드 계속하기</Btn>
          <Btn bg="#21262d" onClick={()=>{saveRecord(true);setShowRanking(true);loadRanking();}} style={{width:"100%",border:"1px solid #30363d"}}>🏆 랭킹 보기</Btn>
        </Overlay>);
      })()}

      {/* ── 하단 고정 바 ── */}
      <div style={{width:"100%",maxWidth:480,background:"#0a0f1a",borderTop:"1px solid #1e293b",flexShrink:0}}>
        {/* 액션 버튼 */}
        <div style={{display:"flex",gap:3,padding:"3px 4px 1px 4px"}}>
          <button onClick={()=>{
            const g=G.current;if(g.gold<10){pushToast("💰 골드 부족! (10G)","#ef4444");return;}
            g.gold-=10;
            const el=UNLOCK_ELEMENTS(clearCount)[Math.floor(Math.random()*UNLOCK_ELEMENTS(clearCount).length)];
            const h=mkH(el,"노말",g.gradeEnhLv||{});
            const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}
            g.heroes.push(h);sync();safeDraw();
            notifyResult("🎲 뽑기",el,"노말");
          }} style={{flex:1.3,background:"linear-gradient(135deg,#1d4ed8,#1e40af)",border:"1px solid #3b82f6",color:"#fff",borderRadius:8,padding:"4px 2px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
            🎲 뽑기<br/><span style={{fontSize:9,opacity:0.8}}>10G</span>
          </button>
          <button onClick={()=>{setRandomPicks([]);setTransformPicks([]);setMergeTab("storage");setModal("merge");}} style={{flex:1,background:"linear-gradient(135deg,#15803d,#166534)",border:"1px solid #22c55e",color:"#fff",borderRadius:8,padding:"4px 2px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
            📦<br/><span style={{fontSize:9,opacity:0.8}}>보관함</span>
          </button>
          <button onClick={()=>setModal("gradeEnh")} style={{flex:1,background:"linear-gradient(135deg,#92400e,#78350f)",border:"1px solid #f59e0b",color:"#fff",borderRadius:8,padding:"4px 2px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
            ⬆️<br/><span style={{fontSize:9,opacity:0.8}}>강화</span>
          </button>
          <button onClick={()=>setModal("shop")} style={{flex:1,background:"linear-gradient(135deg,#4c1d95,#3b0764)",border:"1px solid #a78bfa",color:"#fff",borderRadius:8,padding:"4px 2px",cursor:"pointer",fontSize:11,fontWeight:"bold"}}>
            🪙<br/><span style={{fontSize:9,opacity:0.8}}>{ui.coins}</span>
          </button>
        </div>
        {/* 배치중/대기중 버튼 */}
        {(()=>{
          const placedHeroes=heroes.filter(h=>h.col!==null);
          const waitingHeroes=heroes.filter(h=>h.col===null);
          const waitingCount=waitingHeroes.length;
          return(
            <div style={{display:"flex",gap:3,padding:"3px 4px 4px 4px"}}>
              <button onClick={()=>{setHeroListTab("placed");setModal("heroList");}}
                style={{flex:1,background:"#0f1f3a",border:"1px solid #60a5fa44",borderRadius:7,padding:"5px 4px",cursor:"pointer",color:"#60a5fa",fontSize:11,fontWeight:"bold"}}>
                ⚔️ 배치중 ({placedHeroes.length})
              </button>
              <button onClick={()=>{setHeroListTab("waiting");setModal("heroList");}}
                style={{flex:1,background:"#0f1f0f",border:`1px solid ${waitingCount>0?"#4ade80":"#1e293b"}`,borderRadius:7,padding:"5px 4px",cursor:"pointer",color:waitingCount>0?"#4ade80":"#475569",fontSize:11,fontWeight:"bold",position:"relative"}}>
                📦 대기중 ({waitingCount})
                {waitingCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",width:15,height:15,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:"bold",lineHeight:1}}>{waitingCount}</span>}
              </button>
            </div>
          );
        })()}
      </div>

      {/* 적 클릭 팝업 - fixed 오버레이 */}
      {selEnemy&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:150,background:"rgba(0,0,0,0.7)",padding:"10px 12px",borderTop:"1px solid #dc262644"}}
          onClick={()=>setSelEnemy(null)}>
          <div onClick={e=>e.stopPropagation()} style={{maxWidth:480,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{fontSize:18}}>{selEnemy.isBoss?"💀":selEnemy.type==="은신"?"👻":selEnemy.type==="공중"?"🦅":"👾"}</span>
              <span style={{color:"#f87171",fontWeight:"bold",fontSize:13}}>{selEnemy.isBoss?"보스":selEnemy.type} 적</span>
              {selEnemy.isBoss&&selEnemy.isRaging&&<span style={{color:"#ff4500",fontSize:10}}>⚠️광폭화</span>}
              <span style={{flex:1}}/>
              <span style={{color:"#f87171",fontWeight:"bold",fontSize:12}}>{Math.max(0,Math.floor(selEnemy.hp))}/{selEnemy.maxHp}</span>
              <button onClick={()=>setSelEnemy(null)} style={{background:"transparent",border:"none",color:"#475569",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {selEnemy.isBoss&&selEnemy.weak&&selEnemy.weak.map(w=><span key={w} style={{background:"#451a03",border:"1px solid #f97316",borderRadius:4,padding:"2px 6px",color:"#fb923c",fontSize:10}}>약점:{EE[w]||w}</span>)}
              {selEnemy.stunTimer>0&&<span style={{background:"#78350f",color:"#fcd34d",borderRadius:5,padding:"2px 6px",fontSize:10}}>⚡스턴 {selEnemy.stunTimer.toFixed(1)}s</span>}
              {selEnemy.rootTimer>0&&<span style={{background:"#14532d",color:"#86efac",borderRadius:5,padding:"2px 6px",fontSize:10}}>🌿속박 {selEnemy.rootTimer.toFixed(1)}s</span>}
              {selEnemy.slowTimer>0&&<span style={{background:"#0c4a6e",color:"#7dd3fc",borderRadius:5,padding:"2px 6px",fontSize:10}}>❄️슬로우 {selEnemy.slowTimer.toFixed(1)}s</span>}
              {selEnemy.dotTimer>0&&<span style={{background:"#14532d",color:"#4ade80",borderRadius:5,padding:"2px 6px",fontSize:10}}>☠️독 {selEnemy.dotTimer.toFixed(1)}s</span>}
            </div>
          </div>
        </div>
      )}
      {/* 유닛 클릭 팝업 모달 */}
      {/* 배치중/대기중 유닛 목록 모달 */}
      {modal==="heroList"&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={()=>setModal(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:"100%",maxWidth:480,background:"#0d1117",borderRadius:"16px 16px 0 0",border:"1px solid #1e293b",maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            {/* 헤더 */}
            <div style={{display:"flex",gap:3,padding:"12px 12px 8px 12px",borderBottom:"1px solid #1e293b",flexShrink:0}}>
              <button onClick={()=>setHeroListTab("placed")}
                style={{flex:1,background:heroListTab==="placed"?"#1e3a5f":"transparent",border:`1px solid ${heroListTab==="placed"?"#60a5fa":"#334155"}`,borderRadius:8,padding:"7px 4px",cursor:"pointer",color:heroListTab==="placed"?"#60a5fa":"#475569",fontSize:12,fontWeight:"bold"}}>
                ⚔️ 배치중 ({heroes.filter(h=>h.col!==null).length})
              </button>
              <button onClick={()=>setHeroListTab("waiting")}
                style={{flex:1,background:heroListTab==="waiting"?"#1a2e1a":"transparent",border:`1px solid ${heroListTab==="waiting"?"#4ade80":"#334155"}`,borderRadius:8,padding:"7px 4px",cursor:"pointer",color:heroListTab==="waiting"?"#4ade80":"#475569",fontSize:12,fontWeight:"bold"}}>
                📦 대기중 ({heroes.filter(h=>h.col===null).length})
              </button>
              <button onClick={()=>setModal(null)}
                style={{background:"#1e293b",border:"1px solid #334155",color:"#64748b",borderRadius:8,padding:"7px 12px",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
            {/* 유닛 목록 */}
            <div style={{overflowY:"auto",padding:"10px 12px 20px",display:"flex",flexWrap:"wrap",gap:6,alignContent:"flex-start"}}>
              {(()=>{
                const list=heroListTab==="placed"?heroes.filter(h=>h.col!==null):heroes.filter(h=>h.col===null);
                if(list.length===0)return <div style={{color:"#334155",fontSize:12,padding:"16px",width:"100%",textAlign:"center"}}>{heroListTab==="placed"?"배치된 유닛 없음":"대기 유닛 없음"}</div>;
                return list.map(h=>{
                  const gc=GC[h.grade]||"#6b7280";
                  const isSel=h.id===selHero;
                  return(
                    <div key={h.id}
                      onClick={()=>{
                        if(heroListTab==="waiting"){
                          const g=G.current;
                          const pos=autoPlace(g.heroes.filter(x=>x.id!==h.id));
                          if(pos){const t=g.heroes.find(x=>x.id===h.id);if(t){t.col=pos[0];t.row=pos[1];sync();safeDraw();pushToast(`${EN[h.element]||h.element} 배치완료`,"#4ade80");setModal(null);}}
                          else{pushToast("빈 배치 칸이 없습니다!","#ef4444");}
                        }else{
                          setModal(null);
                          setTimeout(()=>setSelHero(h.id),50);
                        }
                      }}
                      style={{background:isSel?`${gc}25`:"#0f172a",border:`2px solid ${isSel?gc:gc+"66"}`,
                        borderRadius:12,padding:"10px 10px",cursor:"pointer",minWidth:68,textAlign:"center",
                        boxShadow:isSel?`0 0 10px ${gc}66`:"none"}}>
                      <div style={{fontSize:32,lineHeight:1.2}}>{EE[h.element]||"?"}</div>
                      <div style={{fontSize:10,color:gc,fontWeight:"bold",marginTop:3}}>{h.grade}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{EN[h.element]||h.element}</div>
                      {h.enhLv>0&&<div style={{fontSize:10,color:"#fcd34d",fontWeight:"bold"}}>+{h.enhLv}</div>}
                      {heroListTab==="waiting"&&<div style={{fontSize:9,color:"#4ade80",marginTop:2}}>탭→배치</div>}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {selHeroObj&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:180,background:"rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}
          onClick={()=>setSelHero(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:"100%",maxWidth:480,background:"#0d1117",borderRadius:"16px 16px 0 0",border:`1px solid ${GC[selHeroObj.grade]||"#333"}66`,boxShadow:`0 -4px 20px ${GC[selHeroObj.grade]||"#000"}33`,display:"flex",flexDirection:"column",maxHeight:"75vh"}}>
            {/* 스크롤 가능 상단 영역 (유닛 정보 + 조합 목록) */}
            <div style={{overflowY:"auto",padding:"14px 14px 8px",flex:1}}>
              {/* 유닛 정보 헤더 */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{width:52,height:52,borderRadius:12,background:`${GC[selHeroObj.grade]||"#aaa"}22`,border:`2px solid ${GC[selHeroObj.grade]||"#aaa"}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                  {EE[selHeroObj.element]||"?"}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{color:GC[selHeroObj.grade],fontWeight:"bold",fontSize:15}}>{EN[selHeroObj.element]||selHeroObj.element}</span>
                    <span style={{background:`${GC[selHeroObj.grade]||"#aaa"}22`,color:GC[selHeroObj.grade],fontSize:11,borderRadius:5,padding:"1px 6px",border:`1px solid ${GC[selHeroObj.grade]||"#aaa"}44`}}>{selHeroObj.grade}</span>
                    {selHeroObj.enhLv>0&&<span style={{color:"#fcd34d",fontSize:12,fontWeight:"bold"}}>+{selHeroObj.enhLv}</span>}
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#64748b"}}>
                    <span>⚔️ {Math.floor(selHeroObj.atk+(selHeroObj.enhLv||0)*5)}</span>
                    <span>💨 {((selHeroObj.spd||1)*100).toFixed(0)}%</span>
                    <span>🎯 {(selHeroObj.range||3.0).toFixed(1)}</span>
                  </div>
                  {(()=>{const trait=getElTrait(elBase(selHeroObj.element));const tc={single:"#64748b",splash:"#f97316",chain:"#fbbf24",pierce:"#60a5fa",dot:"#4ade80",root:"#22c55e",stun:"#fcd34d",debuff:"#ef4444",slow:"#7dd3fc",heal:"#86efac",armorBreak:"#e2e8f0",rockSplash:"#a16207"}[trait.type]||"#64748b";return <span style={{background:tc+"22",border:`1px solid ${tc}44`,borderRadius:4,padding:"1px 6px",fontSize:10,color:tc,marginTop:3,display:"inline-block"}}>{trait.desc} — {trait.detail}</span>})()}
                </div>
                <button onClick={()=>setSelHero(null)} style={{background:"#1e293b",border:"1px solid #334155",color:"#64748b",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:14,alignSelf:"flex-start"}}>✕</button>
              </div>
              {/* 조합 가능 목록 */}
              {combOpts.length>0&&(
                <div>
                  <div style={{fontSize:12,color:"#a78bfa",fontWeight:"bold",marginBottom:8}}>⚗️ 조합 가능</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {combOpts.map((r,i)=>{
                      const gc2=GC[r.g]||"#888";
                      return(
                        <button key={i} onClick={()=>{doCombine(selHero,r);setSelHero(null);}}
                          style={{background:"#0f172a",border:`1.5px solid ${gc2}`,borderRadius:10,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left"}}>
                          <span style={{fontSize:26}}>{EE[r.r]||"⚗️"}</span>
                          <div style={{flex:1}}>
                            <div style={{color:"#eee",fontWeight:"bold",fontSize:14}}>{EN[r.r]||r.r}</div>
                            <div style={{color:gc2,fontSize:11,marginTop:1}}>{r.g} 등급</div>
                          </div>
                          <span style={{background:gc2,color:"#000",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:"bold"}}>조합</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* 항상 하단 고정: 재배치/강화/판매 */}
            <div style={{display:"flex",gap:6,padding:"10px 14px 20px",borderTop:"1px solid #1e293b",flexShrink:0}}>
              <button onClick={()=>{setSelHero(null);setDragBoth(selHeroObj.id);}} style={{flex:1,background:"#1d4ed8",border:"none",color:"#fff",borderRadius:10,padding:"12px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>📍 재배치</button>
              {canEnhance(selHeroObj)
                ?<button onClick={()=>{doEnhance(selHeroObj.id);setSelHero(null);}} style={{flex:1.3,background:"#78350f",border:"1px solid #f59e0b",color:"#fcd34d",borderRadius:10,padding:"12px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>⬆️ 강화 {enhCost(selHeroObj)}G<br/><span style={{fontSize:9,opacity:0.7}}>({selHeroObj.enhLv||0}/{maxEnh(selHeroObj)}강)</span></button>
                :<div style={{flex:1.3,background:"#1e293b",border:"1px solid #334155",color:"#475569",borderRadius:10,padding:"12px 4px",fontSize:11,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center"}}>{ENHANCE_GRADES.includes(selHeroObj.grade)?"최대강화":"강화불가"}</div>
              }
              <button onClick={()=>{doSell(selHeroObj.id);setSelHero(null);}} style={{flex:1,background:"#450a0a",border:"1px solid #ef4444",color:"#fca5a5",borderRadius:10,padding:"12px 4px",cursor:"pointer",fontSize:12,fontWeight:"bold"}}>💰판매<br/><span style={{fontSize:10}}>+{SELL_PRICE[selHeroObj.grade]||5}G</span></button>
            </div>
          </div>
        </div>
      )}
      {/* 이동 힌트 (드래그 모드) */}
      {(drag||selHero)&&!selHeroObj&&(
        <div style={{position:"fixed",bottom:120,left:"50%",transform:"translateX(-50%)",zIndex:160,fontSize:11,color:"#fbbf24",padding:"5px 14px",background:"rgba(0,0,0,0.8)",borderRadius:20,border:"1px solid rgba(251,191,36,0.3)",whiteSpace:"nowrap",pointerEvents:"none"}}>
          📍 이동할 칸 클릭 | 다른 영웅 = 스왑
        </div>
      )}

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
            style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:500}}>
            <div onClick={e=>e.stopPropagation()}
              style={{background:"#0f172a",border:`2px solid ${gc2}`,borderBottom:"none",borderRadius:"16px 16px 0 0",padding:20,paddingBottom:"max(20px, env(safe-area-inset-bottom))",width:"100%",maxWidth:480,boxShadow:`0 -4px 30px ${gc2}44`}}>
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



      {/* 모달들 */}
      {modal&&modal.type==="coinPick"&&(()=>{
        const item=modal.item;
        const pool=item.grade==="노말"
          ?BASE
          :item.grade==="고급"
          ?[...new Set(COMBO.filter(r=>r.g==="고급").map(r=>r.r))]
          :item.grade==="영웅"
          ?[...new Set(RECIPES.filter(r=>r.g==="영웅").map(r=>r.r))]
          :[...new Set(RECIPES.filter(r=>r.g==="전설").map(r=>r.r))];
        return(<Overlay>
          <div style={{fontSize:15,fontWeight:"bold",color:item.color,marginBottom:4,textAlign:"center"}}>{item.label}</div>
          <div style={{color:"#a78bfa",fontSize:13,marginBottom:10,textAlign:"center"}}>🪙 {item.cost}개 사용</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginBottom:12}}>
            {pool.map(el=>(<button key={el} onClick={()=>buyCoinByElement(item,el)} style={{background:"#161b22",border:`1px solid ${EC[el]||GC[item.grade]||"#888"}`,borderRadius:10,padding:"8px 6px",cursor:"pointer",color:"#eee",fontSize:12,minWidth:52,textAlign:"center"}}><div style={{fontSize:18}}>{EE[el]||"?"}</div><div style={{fontSize:9,color:GC[item.grade]}}>{item.grade}</div><div style={{fontSize:9,color:"#aaa"}}>{el}</div></button>))}
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
          {/* 헤더 */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{fontSize:15,fontWeight:"bold",color:mergeTab==="storage"?"#4f8":"#f59e0b"}}>
              {mergeTab==="storage"?"📦 보관함":"⚗️ 연금술"}
            </div>
            <Btn bg="#444" onClick={()=>{setModal(null);setRandomPicks([]);randomPicksRef.current=[];setTransformPicks([]);transformPicksRef.current=[];}}>닫기</Btn>
          </div>
          {/* 탭 전환 버튼 */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            <button onClick={()=>setMergeTab("storage")} style={{flex:1,background:mergeTab==="storage"?"#1a3a1a":"#21262d",border:`2px solid ${mergeTab==="storage"?"#4f8":"#333"}`,borderRadius:8,padding:"7px 4px",cursor:"pointer",color:mergeTab==="storage"?"#4f8":"#666",fontSize:12,fontWeight:"bold"}}>📦 보관함</button>
            <button onClick={()=>setMergeTab("alchemy")} style={{flex:1,background:mergeTab==="alchemy"?"#2a1f00":"#21262d",border:`2px solid ${mergeTab==="alchemy"?"#f59e0b":"#333"}`,borderRadius:8,padding:"7px 4px",cursor:"pointer",color:mergeTab==="alchemy"?"#f59e0b":"#666",fontSize:12,fontWeight:"bold"}}>⚗️ 연금술</button>
          </div>

          {/* 보관함 탭 */}
          {mergeTab==="storage"&&(<>
            {stackEntries.length>0&&(<div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#4f8",marginBottom:6}}>📦 보관 중인 유닛</div>
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
            {stackEntries.length===0&&<div style={{fontSize:11,color:"#555",marginBottom:10}}>보관함이 비어있습니다.</div>}
            <div style={{marginBottom:4}}>
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
          </>)}

          {/* 연금술 탭 */}
          {mergeTab==="alchemy"&&(<>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#f59e0b",marginBottom:4,fontWeight:"bold"}}>🎲 무작위 조합 <span style={{color:"#fd0",fontSize:11}}>({randomPicks.length}/3)</span></div>
              <div style={{fontSize:10,color:"#666",marginBottom:8}}>같은 등급 3개를 선택 → 한 단계 위 등급 유닛 랜덤 획득 (속성 무관)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                {heroes.map(h=>{const isPicked=randomPicks.includes(h.id);return(<div key={h.id} onClick={()=>toggleRandomPick(h.id)} style={{background:isPicked?"rgba(80,200,80,0.2)":"#21262d",border:`2px solid ${isPicked?"#4f8":GC[h.grade]||"#444"}`,borderRadius:9,padding:"8px 10px",cursor:"pointer",textAlign:"center",minWidth:62,minHeight:62}}><div style={{fontSize:24}}>{EE[h.element]||"?"}</div><div style={{fontSize:10,color:GC[h.grade]}}>{h.grade}</div></div>);})}
              </div>
              <Btn bg={randomPicks.length===3?"#1a5c2a":"#333"} onClick={doRandomMerge} disabled={randomPicks.length!==3} style={{width:"100%"}}>🎲 조합하기 {randomPicks.length===3?"":"(3개 선택)"}</Btn>
            </div>
            <div style={{borderTop:"1px solid #30363d",paddingTop:14}}>
              <div style={{fontSize:12,color:"#a78bfa",marginBottom:4,fontWeight:"bold"}}>🔄 변환 <span style={{color:"#fd0",fontSize:11}}>({transformPicks.length}/2)</span></div>
              <div style={{fontSize:10,color:"#666",marginBottom:8}}>같은 등급 2개를 선택 → 같은 등급 내 다른 유닛으로 무작위 교체 (등급 변화 없음)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
                {heroes.map(h=>{const isPicked=transformPicks.includes(h.id);return(<div key={h.id} onClick={()=>toggleTransformPick(h.id)} style={{background:isPicked?"rgba(168,85,247,0.2)":"#21262d",border:`2px solid ${isPicked?"#a855f7":GC[h.grade]||"#444"}`,borderRadius:9,padding:"8px 10px",cursor:"pointer",textAlign:"center",minWidth:62,minHeight:62}}><div style={{fontSize:24}}>{EE[h.element]||"?"}</div><div style={{fontSize:10,color:GC[h.grade]}}>{h.grade}</div></div>);})}
              </div>
              <Btn bg={transformPicks.length===2?"#5b2a8a":"#333"} onClick={doTransform} disabled={transformPicks.length!==2} style={{width:"100%"}}>🔄 변환하기 {transformPicks.length===2?"":"(2개 선택)"}</Btn>
            </div>
          </>)}
        </Overlay>);
      })()}

      {modal==="shop"&&(<Overlay>
        <div style={{fontSize:15,fontWeight:"bold",color:"#a78bfa",marginBottom:4,textAlign:"center"}}>🪙 코인 상점</div>
        <div style={{color:"#fd0",fontSize:13,marginBottom:10,textAlign:"center"}}>보유: {ui.coins}개 | {ui.round}라운드</div>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
          {SHOP_ITEMS.map(item=>{
            const unlockedG=G.current?.unlockedGrades||["노말","고급","영웅"];
            const gradeLocked=item.grade&&!unlockedG.includes(item.grade);
            const locked=ui.round<item.unlockRound||gradeLocked;
            const lockLabel=gradeLocked?`🔒 ${item.label} (등급 미개방)`:`🔒 ${item.label} (${item.unlockRound}R~)`;
            return(<button key={item.id} onClick={()=>!locked&&buyWithCoin(item)} disabled={ui.coins<item.cost||locked} style={{background:locked?"#21262d":ui.coins>=item.cost?item.color+"22":"#21262d",border:`1px solid ${locked?"#333":ui.coins>=item.cost?item.color:"#333"}`,borderRadius:8,padding:"9px 14px",cursor:locked||ui.coins<item.cost?"not-allowed":"pointer",color:locked?"#444":ui.coins>=item.cost?"#eee":"#555",fontSize:13,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:locked?"#444":item.color,fontWeight:"bold"}}>{locked?lockLabel:item.label}</span><span style={{color:locked?"#444":"#a78bfa",fontWeight:"bold"}}>🪙 {item.cost}</span></button>);})}
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn bg={ui.round>=10?"#1a3a2a":"#21262d"} onClick={()=>{if(ui.round<10){pushToast("도박장은 10라운드 이후 사용 가능합니다","#f59e0b");return;}setModal("gamble");}} style={{flex:1,color:ui.round>=10?undefined:"#555"}}>{ui.round>=10?"🎲 도박장":"🔒 도박장(10R~)"}</Btn>
          <Btn bg="#333" onClick={()=>setModal(null)} style={{flex:1}}>닫기</Btn>
        </div>
      </Overlay>)}

      {modal==="gamble"&&(()=>{
        const doGamble=(table,cost,isGold)=>{
          const g=G.current;
          if(isGold&&g.gold<cost){pushToast("💰 골드 부족!","#ef4444");return;}
          if(!isGold&&g.coins<cost){pushToast("🪙 코인 부족!","#ef4444");return;}
          if(isGold)g.gold-=cost;else g.coins-=cost;
          const rand=Math.random();let acc=0,chosen=table.results[table.results.length-1];
          for(const r of table.results){acc+=r.prob;if(rand<acc){chosen=r;break;}}
          if(chosen.reward==="gold")g.gold+=chosen.val;else g.coins+=chosen.val;
          sync();pushToast(`${chosen.val===0?"😢":chosen.desc.includes("🎉")?"🎉":"😊"} ${chosen.desc}`,chosen.val===0?"#94a3b8":isGold?"#fbbf24":"#a78bfa");
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
            {(()=>{
              const g0=G.current;
              const unlocked0=g0?.unlockedGrades||["노말","고급","영웅"];
              const need3=!unlocked0.includes("전설"); // 3코인 도박은 전설 포함 -> 1클리어 필요
              const need5=!unlocked0.includes("신화"); // 5코인 도박은 신화 포함 -> 3클리어 필요
              return[
              {cost:1,label:"🪙1 — 고급~영웅",desc:"고급60%/영웅30%/꽝10%",locked:false,lockMsg:"",fn:()=>{
                const g=G.current;if(g.coins<1){pushToast("🪙 코인 부족!","#ef4444");return;}
                const unlocked=g.unlockedGrades||["노말","고급","영웅"];
                g.coins-=1;const r=Math.random();
                let grade=null;if(r>=0.10&&r<0.70)grade="고급";else if(r>=0.70)grade="영웅";
                if(grade&&!unlocked.includes(grade))grade=unlocked.includes("고급")?"고급":null;
                if(grade){const pool=grade==="고급"?[...new Set(COMBO.filter(x=>x.g==="고급").map(x=>x.r))]:[...new Set(COMBO.filter(x=>x.g==="영웅").map(x=>x.r))];const el=pool[Math.floor(Math.random()*pool.length)];const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();safeDraw();pushToast(`✨ ${EE[el]||""} ${EN[el]||el} [${grade}] 획득!`,GC[grade]||"#a78bfa");}else{sync();pushToast("😢 꽝...","#94a3b8");}
              }},
              {cost:3,label:"🪙3 — 영웅~전설",desc:"영웅50%/전설35%/신화10%/꽝5%",locked:need3,lockMsg:"전설 등급 개방 필요 (1클리어)",fn:()=>{
                const g=G.current;if(g.coins<3){pushToast("🪙 코인 부족!","#ef4444");return;}
                const unlocked=g.unlockedGrades||["노말","고급","영웅"];
                if(!unlocked.includes("전설")){pushToast("🔒 전설 등급 미개방 (1클리어 필요)","#ef4444");return;}
                g.coins-=3;const r=Math.random();
                let grade=null;if(r>=0.05&&r<0.55)grade="영웅";else if(r>=0.55&&r<0.90)grade="전설";else if(r>=0.90)grade=g.round>=20?"신화":"전설";
                if(grade&&!unlocked.includes(grade)){
                  const fallbackOrder=["신화","전설","영웅","고급"];
                  grade=fallbackOrder.find(gr=>unlocked.includes(gr))||"고급";
                }
                if(grade){const pool=grade==="신화"?[...new Set(RECIPES.filter(x=>x.g==="신화").map(x=>x.r))]:grade==="전설"?[...new Set(RECIPES.filter(x=>x.g==="전설").map(x=>x.r))]:grade==="영웅"?[...new Set(COMBO.filter(x=>x.g==="영웅").map(x=>x.r))]:[...new Set(COMBO.filter(x=>x.g==="고급").map(x=>x.r))];const el=pool.length?pool[Math.floor(Math.random()*pool.length)]:BASE[Math.floor(Math.random()*BASE.length)];const h=mkH(el,grade,g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();safeDraw();triggerSummon(el,grade);if(!["전설","신화","불멸"].includes(grade))pushToast(`✨ ${EE[el]||""} ${EN[el]||el} [${grade}] 획득!`,GC[grade]||"#a78bfa");}else{sync();pushToast("😢 꽝...","#94a3b8");}
              }},
              {cost:5,label:"🪙5 — 신화 (35R↑)",desc:"신화60%/무속성30%/꽝10%",locked:need5,lockMsg:"신화 등급 개방 필요 (3클리어)",fn:()=>{
                const g=G.current;if(g.coins<5){pushToast("🪙 코인 부족!","#ef4444");return;}if(g.round<35){pushToast("⏳ 35라운드 이후 해금!","#ef4444");return;}
                const unlocked=g.unlockedGrades||["노말","고급","영웅"];
                if(!unlocked.includes("신화")){pushToast("🔒 신화 등급 미개방 (3클리어 필요)","#ef4444");return;}
                g.coins-=5;const r=Math.random();
                if(r<0.10){sync();pushToast("😢 꽝...","#94a3b8");return;}
                if(r<0.70){const pool=[...new Set(RECIPES.filter(x=>x.g==="신화").map(x=>x.r))];const el=pool.length?pool[Math.floor(Math.random()*pool.length)]:BASE[0];const h=mkH(el,"신화",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();safeDraw();triggerSummon(el,"신화");}
                else{const h=mkH("무속성","노말",g.gradeEnhLv||{});const pos=autoPlace(g.heroes);if(pos){h.col=pos[0];h.row=pos[1];}g.heroes=[...g.heroes,h];sync();safeDraw();pushToast("⭐ 무속성 유닛 획득!","#fbbf24");}
              }},
            ];})().map(item=>{
              const disabled=ui.coins<item.cost||(item.cost===5&&ui.round<35)||item.locked;
              return(<button key={item.cost} onClick={item.fn} disabled={disabled} style={{background:!disabled?"#0a2a1a":"#21262d",border:`1px solid ${!disabled?"#4f8":"#333"}`,borderRadius:8,padding:"8px 12px",cursor:!disabled?"pointer":"not-allowed",color:!disabled?"#eee":"#555",fontSize:12,textAlign:"left"}}>
                <div style={{fontWeight:"bold",color:item.locked?"#555":item.cost===5?"#f44":item.cost===3?"#fa0":"#4af"}}>{item.locked?"🔒 ":""}{item.label}</div>
                <div style={{fontSize:10,color:"#888",marginTop:2}}>{item.locked?item.lockMsg:item.desc}</div>
              </button>);
            })}
          </div>
          <Btn bg="#444" onClick={()=>setModal("shop")} style={{width:"100%"}}>← 뒤로</Btn>
        </Overlay>);
      })()}

      {/* 조합표 */}
      {showCombo&&(()=>{
        // 전설이상: 유닛 클릭 선택 방식
        const unitCnt={};for(const h of (heroes||[]))unitCnt[h.element]=(unitCnt[h.element]||0)+1;
        const allTabs=["고급","영웅","전설","신화","불멸"];
        const unlockedGrades=G.current?.unlockedGrades||["노말","고급","영웅"];
        const tabs=allTabs.filter(t=>unlockedGrades.includes(t));
        const isHighGrade=["전설","신화","불멸"].includes(comboFilter);
        // 모든 등급: COMBO + RECIPES 둘 다 참조
        const curRecipes=RECIPES.filter(r=>r.g===comboFilter);
        const curCombos=COMBO.filter(r=>r.g===comboFilter);
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
            {/* 검색창 */}
            <div style={{marginBottom:8,flexShrink:0}}>
              <input
                value={comboSearch}
                onChange={e=>setComboSearch(e.target.value)}
                placeholder="유닛 이름 검색..."
                style={{width:"100%",background:"#0d1117",border:"1px solid #30363d",borderRadius:8,
                  padding:"7px 10px",color:"#e2e8f0",fontSize:12,boxSizing:"border-box",outline:"none"}}
              />
            </div>
            {/* 콘텐츠 스크롤 영역 */}
            <div key={comboFilter+comboSearch} style={{overflowY:"auto",flex:1}}>
              {(()=>{
                let rows=[];
                // COMBO + RECIPES 통합 (고급~불멸 모두)
                const comboRows=COMBO.filter(r=>r.g===comboFilter).map(r=>({
                  key:r.r,
                  parts:[{u:r.a,n:1},{u:r.b,n:1}],
                  result:r.r,
                  grade:r.g,
                  can:(r.a===r.b?(unitCnt[r.a]||0)>=2:(myEls.has(r.a)&&myEls.has(r.b))),
                }));
                const recipeRows=RECIPES.filter(r=>r.g===comboFilter).map(recipe=>({
                  key:recipe.r,
                  parts:recipe.parts,
                  result:recipe.r,
                  grade:recipe.g,
                  can:canRecipe(recipe),
                }));
                const seen=new Set(comboRows.map(r=>r.key));
                rows=[...comboRows,...recipeRows.filter(r=>!seen.has(r.key))];
                // 검색어 필터
                if(comboSearch.trim()){
                  const q=comboSearch.trim().toLowerCase();
                  rows=rows.filter(r=>{
                    const resultMatch=(EN[r.result]||r.result).toLowerCase().includes(q);
                    const partMatch=r.parts.some(p=>(EN[p.u]||p.u).toLowerCase().includes(q));
                    return resultMatch||partMatch;
                  });
                }
                if(rows.length===0){
                  return <div style={{color:"#555",fontSize:12,textAlign:"center",marginTop:20}}>{comboSearch?"검색 결과 없음":"조합 없음"}</div>;
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
    </div>
  );
}

