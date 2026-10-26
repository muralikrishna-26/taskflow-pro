import {useState,useEffect,useMemo,useRef} from 'react';
import {PRESETS,play,startLoop,stopLoop,unlock} from './sound.js';
import {useLocal} from './store.js';

const DEF={theme:'system',accent:'#6366f1',soundOn:true,completeOn:true,alarmOn:true,completePreset:'chime',alarmPreset:'classic',volume:.6,alarmVolume:.8,confirmDel:true,defPriority:'medium',compact:false};
const NAV=[['dashboard','Dashboard'],['inbox','Inbox'],['all','All Tasks'],['today','Today'],['upcoming','Upcoming'],['overdue','Overdue'],['completed','Completed'],['settings','Settings']];
const COLORS=['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899'];
const uid=()=>Math.random().toString(36).slice(2,10);
const todayStr=()=>new Date().toLocaleDateString('en-CA');
const fmt=ms=>{const s=Math.max(0,Math.floor(ms/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60);return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s%60).padStart(2,'0');};
const ts=(due,t)=>t?new Date(`${due||todayStr()}T${t}`).getTime():null;
const status=(t,now)=>t.done?'Completed':!t.endAt?null:now>=t.endAt?'Time expired':(t.startAt&&now<t.startAt)?'Not started':'In progress';
const isOver=(t,now)=>!t.done&&((t.due&&t.due<todayStr())||(t.endAt&&now>=t.endAt));
const PW={high:0,medium:1,low:2};

export default function App(){
  const [tasks,setTasks]=useLocal('tfp.v1.tasks',[]);
  const [projects,setProjects]=useLocal('tfp.v1.projects',[{id:'work',name:'Work',color:COLORS[0]},{id:'study',name:'Study',color:COLORS[1]},{id:'personal',name:'Personal',color:COLORS[2]}]);
  const [cfg,setCfg]=useLocal('tfp.v1.settings',DEF);
  const [view,setView]=useState('dashboard');
  const [proj,setProj]=useState('');
  const [q,setQ]=useState('');
  const [fp,setFp]=useState('');
  const [sort,setSort]=useState('due');
  const [now,setNow]=useState(Date.now());
  const [toast,setToast]=useState(null);
  const [edit,setEdit]=useState(null);
  const [menu,setMenu]=useState(false);
  const searchRef=useRef(),formRef=useRef();
  const toastTimer=useRef();

  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(i);},[]);
  useEffect(()=>{
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const ap=()=>{document.documentElement.dataset.theme=cfg.theme==='system'?(mq.matches?'dark':'light'):cfg.theme;};
    ap();mq.addEventListener('change',ap);
    document.documentElement.style.setProperty('--accent',cfg.accent);
    return()=>mq.removeEventListener('change',ap);
  },[cfg.theme,cfg.accent]);
  useEffect(()=>{
    const k=e=>{
      if(e.key==='Escape'){setEdit(null);setMenu(false);return;}
      if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
      if(e.key==='/'){e.preventDefault();searchRef.current?.focus();}
      if(e.key==='n'||e.key==='N'){e.preventDefault();setEdit(null);setView(v=>v==='settings'||v==='dashboard'?'all':v);setTimeout(()=>formRef.current?.focus(),50);}
    };
    window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);
  },[]);

  const say=(msg,undo)=>{clearTimeout(toastTimer.current);setToast({msg,undo});toastTimer.current=setTimeout(()=>setToast(null),6000);};
  const upd=(id,patch)=>setTasks(ts=>ts.map(t=>t.id===id?{...t,...patch,updated:Date.now()}:t));
  const sound=(kind)=>{
    if(!cfg.soundOn)return;
    if(kind==='done'&&cfg.completeOn)play(cfg.completePreset,cfg.volume);
  };
  const toggle=t=>{
    if(t.done){upd(t.id,{done:false,doneAt:null});say('Task reopened');return;}
    upd(t.id,{done:true,doneAt:Date.now()});sound('done');say('Task completed ✓');
  };
  const remove=t=>{
    if(cfg.confirmDel&&!confirm(`Delete "${t.title}"?`))return;
    setTasks(a=>a.filter(x=>x.id!==t.id));
    say('Task deleted',()=>setTasks(a=>[t,...a]));
  };
  const save=data=>{
    if(data.id){upd(data.id,data);say('Task updated');}
    else{setTasks(a=>[{...data,id:uid(),created:Date.now(),updated:Date.now(),done:false,ext:[]},...a]);say('Task added');}
    setEdit(null);
  };

  // Alarm: first expired, incomplete, un-acknowledged task
  const alarmTask=tasks.find(t=>!t.done&&t.endAt&&now>=t.endAt&&!t.ack);
  const alarmId=alarmTask?.id;
  useEffect(()=>{
    if(alarmId&&cfg.soundOn&&cfg.alarmOn)startLoop(cfg.alarmPreset,cfg.alarmVolume);
    return()=>stopLoop();
  },[alarmId,cfg.soundOn,cfg.alarmOn,cfg.alarmPreset,cfg.alarmVolume]);
  const extend=(t,min)=>{
    if(!(min>0)||min>1440){say('Enter 1–1440 minutes');return;}
    upd(t.id,{endAt:Math.max(t.endAt,Date.now())+min*60000,ack:false,ext:[...(t.ext||[]),{at:Date.now(),min}]});
    say(`Extended by ${min} min`);
  };

  const list=useMemo(()=>{
    const td=todayStr(),s=q.trim().toLowerCase();
    let r=tasks.filter(t=>{
      if(view==='inbox'&&(t.due||t.done))return false;
      if(view==='all'&&t.done)return false;
      if(view==='today'&&(t.done||t.due!==td))return false;
      if(view==='upcoming'&&(t.done||!t.due||t.due<=td))return false;
      if(view==='overdue'&&!isOver(t,now))return false;
      if(view==='completed'&&!t.done)return false;
      if(proj&&t.project!==proj)return false;
      if(fp&&t.priority!==fp)return false;
      if(s&&!`${t.title} ${t.desc} ${(t.tags||[]).join(' ')} ${projects.find(p=>p.id===t.project)?.name||''}`.toLowerCase().includes(s))return false;
      return true;
    });
    const cmp={due:(a,b)=>(a.due||'9')<(b.due||'9')?-1:1,priority:(a,b)=>PW[a.priority]-PW[b.priority],created:(a,b)=>b.created-a.created,alpha:(a,b)=>a.title.localeCompare(b.title)}[sort];
    return [...r].sort(cmp);
  },[tasks,view,proj,fp,q,sort,projects,now]);

  const title=NAV.find(n=>n[0]===view)[1];
  return <div className={'app'+(cfg.compact?' compact':'')}>
    <aside className={'side'+(menu?' open':'')}>
      <div className="logo">✔ TaskFlow Pro</div>
      <nav aria-label="Main">{NAV.map(([k,l])=><button key={k} className={view===k?'on':''} onClick={()=>{setView(k);setMenu(false);}}>{k==='settings'?'⚙ ':''}{l}</button>)}</nav>
      <h4>Projects</h4>
      {projects.map(p=>{const all=tasks.filter(t=>t.project===p.id),d=all.filter(t=>t.done).length;
        return <button key={p.id} className={proj===p.id?'on':''} onClick={()=>{setProj(proj===p.id?'':p.id);setView('all');setMenu(false);}}>
          <span className="dot" style={{background:p.color}}/>{p.name} <small>{d}/{all.length}</small></button>;})}
      <AddProject onAdd={n=>setProjects(a=>[...a,{id:uid(),name:n,color:COLORS[a.length%COLORS.length]}])}/>
      <p className="hint">Shortcuts: <kbd>/</kbd> search · <kbd>N</kbd> new task · <kbd>Esc</kbd> close</p>
    </aside>
    <main>
      <header>
        <button className="icon burger" aria-label="Open menu" onClick={()=>setMenu(!menu)}>☰</button>
        <input ref={searchRef} aria-label="Search tasks" placeholder="Search tasks ( / )" value={q} onChange={e=>{setQ(e.target.value);if(view==='dashboard'||view==='settings')setView('all');}}/>
        <button className="icon" aria-label="Toggle theme" onClick={()=>setCfg({...cfg,theme:document.documentElement.dataset.theme==='dark'?'light':'dark'})}>◐</button>
        <button className="icon" aria-label="Open settings" onClick={()=>setView('settings')}>⚙</button>
      </header>
      <h1>{title}{proj&&view!=='settings'?` · ${projects.find(p=>p.id===proj)?.name||''}`:''}</h1>
      {view==='dashboard'&&<Dashboard tasks={tasks} projects={projects} now={now}/>}
      {view==='settings'&&<Settings cfg={cfg} setCfg={setCfg} tasks={tasks} setTasks={setTasks} projects={projects} setProjects={setProjects} say={say}/>}
      {view!=='dashboard'&&view!=='settings'&&<>
        {view!=='completed'&&<TaskForm key={edit?.id||'new'} ref={formRef} edit={edit} projects={projects} defPriority={cfg.defPriority} onSave={save} onCancel={()=>setEdit(null)} tasks={tasks}/>}
        <div className="bar">
          <select aria-label="Filter priority" value={fp} onChange={e=>setFp(e.target.value)}><option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
          <select aria-label="Sort" value={sort} onChange={e=>setSort(e.target.value)}><option value="due">Sort: due date</option><option value="priority">Sort: priority</option><option value="created">Sort: newest</option><option value="alpha">Sort: A–Z</option></select>
          {proj&&<button onClick={()=>setProj('')}>Clear project filter</button>}
        </div>
        {list.length===0?<div className="empty"><div>🌱</div>Nothing here yet.<br/>Add a task above to get started.</div>
        :<ul className="tasks">{list.map(t=><TaskRow key={t.id} t={t} now={now} proj={projects.find(p=>p.id===t.project)} onToggle={()=>toggle(t)} onEdit={()=>{setEdit(t);window.scrollTo({top:0,behavior:'smooth'});}} onDel={()=>remove(t)}/>)}</ul>}
      </>}
    </main>
    {alarmTask&&<div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="al-t"><div className="dialog alarm">
      <div className="bell">⏰</div><h2 id="al-t">Your scheduled time has ended!</h2><p><b>{alarmTask.title}</b></p>
      {!(cfg.soundOn&&cfg.alarmOn)&&<small>Alarm sound is off in settings.</small>}
      <div className="btns">
        <button className="primary" onClick={()=>{toggle(alarmTask);}}>Mark Complete</button>
        <button onClick={()=>stopLoop()}>Stop Alarm</button>
        {[5,10,15].map(m=><button key={m} onClick={()=>extend(alarmTask,m)}>Extend {m} Minutes</button>)}
        <CustomExt onGo={m=>extend(alarmTask,m)}/>
        <button onClick={()=>{stopLoop();upd(alarmTask.id,{ack:true});}}>Dismiss Alarm</button>
      </div></div></div>}
    {toast&&<div className="toast" role="status">{toast.msg}{toast.undo&&<button onClick={()=>{toast.undo();setToast(null);}}>Undo</button>}</div>}
  </div>;
}

function CustomExt({onGo}){const [v,setV]=useState('');return <span className="cx"><input type="number" min="1" max="1440" aria-label="Custom minutes" placeholder="min" value={v} onChange={e=>setV(e.target.value)}/><button onClick={()=>onGo(Number(v))}>Custom</button></span>;}
function AddProject({onAdd}){const [v,setV]=useState('');return <form className="addp" onSubmit={e=>{e.preventDefault();if(v.trim()){onAdd(v.trim());setV('');}}}><input aria-label="New project" placeholder="+ New project" value={v} onChange={e=>setV(e.target.value)}/></form>;}

import {forwardRef} from 'react';
const TaskForm=forwardRef(function TaskForm({edit,projects,defPriority,onSave,onCancel,tasks},ref){
  const [f,setF]=useState(()=>edit?{...edit,tags:(edit.tags||[]).join(' '),start:edit.startAt?new Date(edit.startAt).toTimeString().slice(0,5):'',end:edit.endAt?new Date(edit.endAt).toTimeString().slice(0,5):''}:{title:'',desc:'',priority:defPriority,project:projects[0]?.id||'',due:'',start:'',end:'',tags:''});
  const [err,setErr]=useState('');
  const set=(k,v)=>setF({...f,[k]:v});
  const submit=e=>{
    e.preventDefault();
    if(!f.title.trim())return setErr('Please enter a title.');
    if((f.start||f.end)&&!(f.start&&f.end))return setErr('Set both start and end time.');
    const startAt=ts(f.due,f.start),endAt=ts(f.due,f.end);
    if(startAt&&endAt<=startAt)return setErr('End time must be after start time.');
    const clash=startAt&&tasks.find(t=>t.id!==f.id&&!t.done&&t.startAt&&t.endAt&&startAt<t.endAt&&endAt>t.startAt);
    if(clash&&!confirm(`This overlaps with "${clash.title}". Save anyway?`))return;
    setErr('');
    onSave({id:f.id,title:f.title.trim(),desc:f.desc||'',priority:f.priority,project:f.project,due:f.due,startAt,endAt,ack:false,
      tags:f.tags.split(/[\s,]+/).filter(Boolean).map(x=>x.replace(/^#/,''))});
  };
  return <form className="card form" onSubmit={submit}>
    <input ref={ref} aria-label="Task title" placeholder="Add a task and press Enter…" value={f.title} onChange={e=>set('title',e.target.value)}/>
    <textarea aria-label="Description" placeholder="Notes (optional)" rows="2" value={f.desc} onChange={e=>set('desc',e.target.value)}/>
    <div className="row">
      <label>Priority<select value={f.priority} onChange={e=>set('priority',e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
      <label>Project<select value={f.project} onChange={e=>set('project',e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Due date<input type="date" value={f.due} onChange={e=>set('due',e.target.value)}/></label>
      <label>Start<input type="time" value={f.start} onChange={e=>set('start',e.target.value)}/></label>
      <label>End<input type="time" value={f.end} onChange={e=>set('end',e.target.value)}/></label>
      <label>Tags<input placeholder="#react #urgent" value={f.tags} onChange={e=>set('tags',e.target.value)}/></label>
    </div>
    {err&&<div className="err" role="alert">{err}</div>}
    <div><button className="primary" type="submit">{edit?'Save changes':'Add task'}</button>{edit&&<button type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
});

function TaskRow({t,now,proj,onToggle,onEdit,onDel}){
  const st=status(t,now),pct=t.startAt&&t.endAt?Math.min(100,Math.max(0,(now-t.startAt)/(t.endAt-t.startAt)*100)):0;
  const hm=x=>new Date(x).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return <li className={'task card'+(t.done?' done':'')}>
    <button className={'check'+(t.done?' on':'')} aria-label={t.done?'Reopen task':'Mark complete'} onClick={onToggle}>{t.done?'✓':''}</button>
    <div className="body">
      <div className="t">{t.title} <span className={'pri '+t.priority}>{t.priority}</span></div>
      {t.desc&&<div className="muted">{t.desc}</div>}
      <div className="meta">
        {proj&&<span><span className="dot" style={{background:proj.color}}/>{proj.name}</span>}
        {t.due&&<span className={isOver(t,now)?'bad':''}>📅 {t.due}</span>}
        {t.startAt&&<span>🕒 {hm(t.startAt)}–{hm(t.endAt)}</span>}
        {(t.tags||[]).map(g=><span key={g}>#{g}</span>)}
        {st&&<span className={'st '+st.replace(/\s/g,'')}>{st}</span>}
        {!t.done&&t.endAt&&now<t.endAt&&<span>⏳ {fmt(t.endAt-now)} left</span>}
        {(t.ext||[]).length>0&&<span>+{t.ext.reduce((a,x)=>a+x.min,0)}m extended</span>}
      </div>
      {t.startAt&&!t.done&&<div className="prog"><i style={{width:pct+'%'}}/></div>}
    </div>
    <div className="acts"><button aria-label="Edit task" onClick={onEdit}>✎</button><button aria-label="Delete task" onClick={onDel}>🗑</button></div>
  </li>;
}

function Dashboard({tasks,projects,now}){
  const td=todayStr(),today=tasks.filter(t=>t.due===td),dn=today.filter(t=>t.done).length;
  const done=tasks.filter(t=>t.done).length,rate=tasks.length?Math.round(done/tasks.length*100):0;
  const over=tasks.filter(t=>isOver(t,now)).length;
  const stat=(n,l)=><div className="card stat"><b>{n}</b><span>{l}</span></div>;
  if(!tasks.length)return <div className="empty"><div>🚀</div>Welcome to TaskFlow Pro!<br/>Open “All Tasks” and add your first task.</div>;
  return <>
    <div className="stats">{stat(`${dn}/${today.length}`,'Done today')}{stat(over,'Overdue')}{stat(done,'Completed total')}{stat(rate+'%','Completion rate')}</div>
    <h3>Project progress</h3>
    {projects.map(p=>{const a=tasks.filter(t=>t.project===p.id),d=a.filter(t=>t.done).length,pc=a.length?d/a.length*100:0;
      return <div key={p.id} className="card pr"><span><span className="dot" style={{background:p.color}}/>{p.name}</span><div className="prog"><i style={{width:pc+'%',background:p.color}}/></div><small>{d}/{a.length}</small></div>;})}
    <h3>By priority (open tasks)</h3>
    <div className="stats">{['high','medium','low'].map(k=>stat(tasks.filter(t=>!t.done&&t.priority===k).length,k))}</div>
  </>;
}

function Settings({cfg,setCfg,tasks,setTasks,projects,setProjects,say}){
  const set=(k,v)=>setCfg({...cfg,[k]:v});
  const opts=Object.entries(PRESETS).map(([k,p])=><option key={k} value={k}>{p.name}</option>);
  const exp=()=>{const b=new Blob([JSON.stringify({version:1,tasks,projects,settings:cfg},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='taskflow-backup.json';a.click();URL.revokeObjectURL(a.href);};
  const imp=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();
    r.onload=()=>{try{
      const d=JSON.parse(r.result);
      if(!Array.isArray(d.tasks)||d.tasks.some(t=>!t.id||typeof t.title!=='string'))throw new Error('bad');
      if(confirm('Replace ALL current data with this backup?')){setTasks(d.tasks);if(Array.isArray(d.projects))setProjects(d.projects);if(d.settings)setCfg({...DEF,...d.settings});say('Backup restored');}
    }catch{say('Invalid backup file.');}};
    r.onerror=()=>say('Could not read file.');r.readAsText(file);e.target.value='';
  };
  const sw=(k,l)=><label className="sw"><input type="checkbox" checked={cfg[k]} onChange={e=>set(k,e.target.checked)}/>{l}</label>;
  return <div className="settings">
    <section className="card"><h3>Appearance</h3>
      <label>Theme<select value={cfg.theme} onChange={e=>set('theme',e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label>Accent color<input type="color" value={cfg.accent} onChange={e=>set('accent',e.target.value)}/></label>
      {sw('compact','Compact task density')}
    </section>
    <section className="card"><h3>General</h3>
      <label>Default priority<select value={cfg.defPriority} onChange={e=>set('defPriority',e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
      {sw('confirmDel','Confirm before deleting a task')}
    </section>
    <section className="card"><h3>Sounds & alarms</h3>
      <button className="primary" onClick={()=>{unlock()?say('Sounds enabled'):say('Audio not supported in this browser');play(cfg.completePreset,cfg.volume);}}>Enable / Test Sound</button>
      {sw('soundOn','Sounds enabled (master switch)')}{sw('completeOn','Task-completion sound')}{sw('alarmOn','Deadline alarm (repeats until stopped)')}
      <label>Completion ringtone<select value={cfg.completePreset} onChange={e=>set('completePreset',e.target.value)}>{opts}</select></label>
      <button onClick={()=>play(cfg.completePreset,cfg.volume)}>▶ Preview completion</button>
      <label>Completion volume<input type="range" min="0.05" max="1" step="0.05" value={cfg.volume} onChange={e=>set('volume',+e.target.value)}/></label>
      <label>Alarm ringtone<select value={cfg.alarmPreset} onChange={e=>set('alarmPreset',e.target.value)}>{opts}</select></label>
      <button onClick={()=>startLoop(cfg.alarmPreset,cfg.alarmVolume)}>▶ Preview alarm</button><button onClick={stopLoop}>■ Stop preview</button>
      <label>Alarm volume<input type="range" min="0.05" max="1" step="0.05" value={cfg.alarmVolume} onChange={e=>set('alarmVolume',+e.target.value)}/></label>
      <small>Alarms only work while this page is open in your browser.</small>
    </section>
    <section className="card"><h3>Data & privacy</h3>
      <button onClick={exp}>Export JSON backup</button>
      <label className="file">Import JSON backup<input type="file" accept="application/json" onChange={imp}/></label>
      <button onClick={()=>{if(confirm('Delete all completed tasks?')){setTasks(a=>a.filter(t=>!t.done));say('Completed tasks cleared');}}}>Clear completed tasks</button>
      <button onClick={()=>{if(confirm('Reset settings to defaults?')){setCfg(DEF);say('Settings reset');}}}>Reset settings to defaults</button>
      <button className="danger" onClick={()=>{if(confirm('Delete ALL tasks and projects? This cannot be undone.')){setTasks([]);say('All data reset');}}}>Reset all data</button>
    </section>
    <section className="card"><h3>About</h3><p>TaskFlow Pro v1.0 · React + Vite. Everything is stored in this browser’s localStorage only — nothing is sent to a server and it does not sync across devices.</p></section>
  </div>;
}
