import {useState,useEffect} from 'react';
export function useLocal(key,def){
  const [v,setV]=useState(()=>{
    try{const r=localStorage.getItem(key);if(r===null)return def;const p=JSON.parse(r);
      return Array.isArray(def)?(Array.isArray(p)?p:def):{...def,...p};}
    catch(e){console.warn('Storage read failed',e);return def;}
  });
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(v));}catch(e){console.warn('Storage write failed',e);}},[key,v]);
  return [v,setV];
}
