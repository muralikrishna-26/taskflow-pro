// Web Audio ringtone engine: synthesized presets, one alarm loop at a time.
export const PRESETS={
 classic:{name:'Classic Alarm',type:'square',len:1,seq:[[880,0,.12],[660,.15,.12],[880,.3,.12],[660,.45,.12]]},
 digital:{name:'Digital Beep',type:'square',len:.6,seq:[[1200,0,.1]]},
 bell:{name:'Gentle Bell',type:'sine',len:1.6,seq:[[660,0,.9],[990,0,.6]]},
 double:{name:'Double Beep',type:'triangle',len:1,seq:[[800,0,.1],[800,.18,.1]]},
 rising:{name:'Rising Alarm',type:'sawtooth',len:1.4,seq:[[400,0,.15],[500,.18,.15],[600,.36,.15],[800,.54,.25]]},
 chime:{name:'Soft Chime',type:'sine',len:1.5,seq:[[523,0,.5],[659,.2,.5],[784,.4,.7]]},
 urgent:{name:'Urgent Pulse',type:'sawtooth',len:.9,seq:[[1000,0,.08],[1000,.12,.08],[1000,.24,.08],[1000,.36,.08]]},
 minimal:{name:'Minimal Notification',type:'sine',len:1,seq:[[1046,0,.15]]}
};
let ctx=null,timer=null;
export function unlock(){
  try{
    if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;ctx=new C();}
    if(ctx.state==='suspended')ctx.resume();
    return true;
  }catch(e){console.warn('Audio unavailable',e);return false;}
}
export function play(id,vol=.6){
  if(!unlock())return false;
  const p=PRESETS[id]||PRESETS.classic,t0=ctx.currentTime+.02;
  p.seq.forEach(([f,s,d])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=p.type;o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t0+s);
    g.gain.exponentialRampToValueAtTime(Math.max(.001,vol*.5),t0+s+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t0+s+d);
    o.connect(g).connect(ctx.destination);o.start(t0+s);o.stop(t0+s+d+.05);
  });
  return true;
}
export function startLoop(id,vol){
  stopLoop();
  if(!play(id,vol))return;
  const p=PRESETS[id]||PRESETS.classic;
  timer=setInterval(()=>play(id,vol),(p.len+.4)*1000);
}
export function stopLoop(){if(timer){clearInterval(timer);timer=null;}}
export const isLooping=()=>timer!==null;
