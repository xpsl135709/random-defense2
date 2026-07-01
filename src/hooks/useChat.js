import { useState, useRef, useEffect } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "../constants/gameData";

// 채팅 + 접속자 presence
export function useChat(nickname, phase, pushToast, containsAdminKeyword){
  const [showChat,setShowChat]=useState(false);
  const chatScrollRef=useRef(null);
  const [onlineUsers,setOnlineUsers]=useState([]);
  const [totalUsersCount,setTotalUsersCount]=useState(null);
  const [chatTab,setChatTab]=useState('chat'); // 'chat' | 'log'
  const [chatMessages,setChatMessages]=useState([]);
  const [chatInput,setChatInput]=useState('');
  const [chatLoading,setChatLoading]=useState(false);

  const isAdmin=()=>containsAdminKeyword(nickname.trim());

  const loadChatMessages=async()=>{
    setChatLoading(true);
    try{
      let query=`${SUPABASE_URL}/rest/v1/chat_messages?select=*&order=created_at.desc&limit=50`;
      if(!isAdmin()){
        const since=new Date();since.setHours(0,0,0,0);
        query+=`&created_at=gte.${since.toISOString()}`;
      }
      const res=await fetch(query,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const data=await res.json();
      setChatMessages(Array.isArray(data)?data.reverse():[]);
    }catch(e){setChatMessages([]);}
    setChatLoading(false);
  };

  // 조용한 새로고침 (로딩 스피너 없이, 폴링용)
  const refreshChatSilently=async()=>{
    try{
      let query=`${SUPABASE_URL}/rest/v1/chat_messages?select=*&order=created_at.desc&limit=50`;
      if(!isAdmin()){
        const since=new Date();since.setHours(0,0,0,0);
        query+=`&created_at=gte.${since.toISOString()}`;
      }
      const res=await fetch(query,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const data=await res.json();
      if(Array.isArray(data))setChatMessages(data.reverse());
    }catch(e){}
  };

  // ── 접속자 presence: 하트비트 전송 (20초마다)
  const sendHeartbeat=async()=>{
    const finalName=nickname.trim();
    if(!finalName)return;
    const inGame=phase==='game';
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/online_users?on_conflict=name`,{
        method:'POST',
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:`Bearer ${SUPABASE_KEY}`,
          'Content-Type':'application/json',
          Prefer:'resolution=merge-duplicates',
        },
        body:JSON.stringify({name:finalName,in_game:inGame,last_seen:new Date().toISOString()}),
      });
    }catch(e){}
  };

  // ── 접속자 목록 불러오기 (1분 이내 활동한 사람만)
  const loadOnlineUsers=async()=>{
    try{
      const since=new Date(Date.now()-60000).toISOString();
      const res=await fetch(`${SUPABASE_URL}/rest/v1/online_users?select=*&last_seen=gte.${since}&order=name.asc`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
      });
      const data=await res.json();
      setOnlineUsers(Array.isArray(data)?data:[]);
    }catch(e){setOnlineUsers([]);}
  };

  // 누적 사용자 수: online_users 테이블의 전체 row 수 (한번이라도 접속한 적 있는 고유 닉네임)
  const loadTotalUsersCount=async()=>{
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/online_users?select=name`,{
        headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,Prefer:'count=exact'}
      });
      const range=res.headers.get('content-range'); // 예: "0-19/42"
      if(range){
        const total=parseInt(range.split('/')[1]);
        if(!isNaN(total))setTotalUsersCount(total);
      }
    }catch(e){}
  };

  // 하트비트: 닉네임이 입력될 때마다 바로 보내지 않고 800ms 디바운스 후 전송, 이후 20초마다 유지
  useEffect(()=>{
    const trimmed=nickname.trim();
    if(!trimmed)return;
    const debounceTimer=setTimeout(()=>{
      sendHeartbeat();
    },1500);
    return ()=>clearTimeout(debounceTimer);
  },[nickname]);

  useEffect(()=>{
    loadOnlineUsers();
    loadTotalUsersCount();
    const hb=setInterval(()=>{if(nickname.trim())sendHeartbeat();},20000);
    const lu=setInterval(loadOnlineUsers,25000);
    const tu=setInterval(loadTotalUsersCount,60000);
    return ()=>{clearInterval(hb);clearInterval(lu);clearInterval(tu);};
  },[phase]);

  // 채팅창 열려있고 '전체채팅' 탭일 때 3초마다 자동 새로고침
  useEffect(()=>{
    if(!showChat||chatTab!=='chat')return;
    const iv=setInterval(refreshChatSilently,3000);
    return ()=>clearInterval(iv);
  },[showChat,chatTab]);

  // 새 메시지 도착 시 자동 스크롤
  useEffect(()=>{
    if(chatScrollRef.current){
      chatScrollRef.current.scrollTop=chatScrollRef.current.scrollHeight;
    }
  },[chatMessages]);

  const sendChatMessage=async()=>{
    const text=chatInput.trim();
    if(!text)return;
    if(text.length>200){pushToast("메시지는 200자 이하로 입력해주세요","#ef4444");return;}
    const finalName=nickname.trim();
    if(!finalName){pushToast("닉네임을 먼저 입력해주세요","#ef4444");return;}
    setChatInput('');
    try{
      await fetch(`${SUPABASE_URL}/rest/v1/chat_messages`,{
        method:'POST',
        headers:{
          apikey:SUPABASE_KEY,
          Authorization:`Bearer ${SUPABASE_KEY}`,
          'Content-Type':'application/json',
          Prefer:'return=minimal',
        },
        body:JSON.stringify({name:finalName,message:text}),
      });
      refreshChatSilently();
    }catch(e){console.error('chat send error',e);}
  };

  return {
    showChat, setShowChat, chatScrollRef,
    onlineUsers, totalUsersCount,
    chatTab, setChatTab, chatMessages, chatInput, setChatInput, chatLoading,
    loadChatMessages, sendChatMessage, isAdmin,
  };
}
