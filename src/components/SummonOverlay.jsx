import { EE, EN, GC } from '../constants/gameData';

export default function SummonOverlay({anim,onClose}){
  if(!anim)return null;
  if(!EE[anim.element]&&!EN[anim.element])return null; // 이모지/이름 없는 유닛은 연출 스킵
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
