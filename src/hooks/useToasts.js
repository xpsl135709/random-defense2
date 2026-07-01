import { useState, useRef } from "react";

export function useToasts(){
  const [toasts,setToasts]=useState([]);
  const toastIdRef=useRef(1);

  // 토스트 알림: 우측에 3초간 표시
  const pushToast=(text,color)=>{
    const id=toastIdRef.current++;
    setToasts(prev=>[...prev,{id,text,color:color||"#94a3b8"}]);
    setTimeout(()=>{
      setToasts(prev=>prev.filter(t=>t.id!==id));
    },2000);
  };

  return { toasts, pushToast };
}
