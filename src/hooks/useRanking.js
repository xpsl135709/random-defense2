import { useState } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "../constants/gameData";

export function useRanking(){
  const [showRanking,setShowRanking]=useState(false);
  const [ranking,setRanking]=useState([]);
  const [multiRanking,setMultiRanking]=useState([]);
  const [rankLoading,setRankLoading]=useState(false);
  const [rankPeriod,setRankPeriod]=useState('all'); // 'daily'|'weekly'|'all'
  const [rankMode,setRankMode]=useState('single'); // 'single'|'multi'

  // ── 랭킹 불러오기 (일간/주간/누적)
  const loadRanking=async(period,mode)=>{
    setRankLoading(true);
    try{
      const p=period||rankPeriod;
      const m=mode||rankMode;
      let timeFilter='';
      if(p==='daily'){const since=new Date();since.setHours(0,0,0,0);timeFilter=`&updated_at=gte.${since.toISOString()}`;}
      else if(p==='weekly'){const since=new Date();since.setDate(since.getDate()-7);timeFilter=`&updated_at=gte.${since.toISOString()}`;}

      if(m==='multi'){
        // 멀티 랭킹: multi_rankings 테이블
        let query=`${SUPABASE_URL}/rest/v1/multi_rankings?select=*&order=round.desc,gold.desc&limit=50${timeFilter}`;
        const res=await fetch(query,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
        const data=await res.json();
        // 익명 제거
        const filtered=Array.isArray(data)?data.filter(r=>r.name&&!r.name.startsWith('익명')):[];
        setMultiRanking(filtered);
      }else{
        // 싱글 랭킹: 기존 rankings 테이블, 익명 제거
        let query=`${SUPABASE_URL}/rest/v1/rankings?select=*&order=round.desc,gold.desc&limit=50${timeFilter}`;
        const res=await fetch(query,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
        const data=await res.json();
        const filtered=Array.isArray(data)?data.filter(r=>r.name&&!r.name.startsWith('익명')):[];
        setRanking(filtered);
      }
    }catch(e){if((mode||rankMode)==='multi')setMultiRanking([]);else setRanking([]);}
    setRankLoading(false);
  };

  return { showRanking, setShowRanking, ranking, multiRanking, rankLoading, rankPeriod, setRankPeriod, rankMode, setRankMode, loadRanking };
}
