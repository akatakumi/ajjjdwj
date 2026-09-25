import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const $ = s => document.querySelector(s);
const els = {
  roomKey: $('#roomKey'), saveKeyBtn: $('#saveKeyBtn'), syncBadge: $('#syncBadge'),
  statusText: $('#statusText'), liveTimer: $('#liveTimer'), todayTotal: $('#todayTotal'),
  remaining: $('#remaining'), progressBar: $('#progressBar'), mainAction: $('#mainAction'),
  historyList: $('#historyList'), dailyLimit: $('#dailyLimit'), refreshBtn: $('#refreshBtn'), undoBtn: $('#undoBtn')
};

let db = null;
let unsubscribe = null;
let remoteState = null;
let ticker = null;
let configured = false;

const savedKey = localStorage.getItem('breaksync.roomKey') || '';
const savedLimit = Number(localStorage.getItem('breaksync.limit') || 60);
els.roomKey.value = savedKey;
els.dailyLimit.value = String(savedLimit);

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});}
function fmtDuration(ms){
  const s=Math.max(0,Math.floor(ms/1000)), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return [h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');
}
function minutes(ms){return Math.floor(ms/60000)}

function normalize(s){
  return s || { active:false, startedAt:null, sessions:[], updatedAt:null };
}
function todaySessions(state){
  return (state.sessions||[]).filter(x=>dayKey(x.start)===dayKey());
}
function calcTodayMs(state){
  let total=todaySessions(state).reduce((a,x)=>a+Math.max(0,(x.end||Date.now())-x.start),0);
  if(state.active && state.startedAt && dayKey(state.startedAt)===dayKey()) total += Date.now()-state.startedAt;
  return total;
}
function render(){
  const s=normalize(remoteState);
  const total=calcTodayMs(s);
  const limitMin=Number(els.dailyLimit.value||60);
  els.todayTotal.textContent=`${minutes(total)}分`;
  els.remaining.textContent=`${Math.max(0,limitMin-minutes(total))}分`;
  els.progressBar.style.width=`${Math.min(100,total/(limitMin*60000)*100)}%`;
  els.statusText.textContent=s.active?'休憩中':'勤務中';
  els.mainAction.textContent=s.active?'休憩終了':'休憩開始';
  els.mainAction.classList.toggle('breaking',s.active);
  els.liveTimer.textContent=s.active && s.startedAt ? fmtDuration(Date.now()-s.startedAt) : '00:00:00';

  const sessions=todaySessions(s).slice().sort((a,b)=>b.start-a.start);
  els.historyList.innerHTML=sessions.length?'':`<div class="empty">今日はまだ休憩履歴がありません</div>`;
  sessions.forEach(x=>{
    const row=document.createElement('div'); row.className='history-item';
    row.innerHTML=`<div class="times">${fmtTime(x.start)}〜${x.end?fmtTime(x.end):'休憩中'}</div><div class="duration">${fmtDuration((x.end||Date.now())-x.start)}</div>`;
    els.historyList.appendChild(row);
  });
}

async function initFirebase(){
  try{
    const mod = await import('./firebase-config.js');
    const app=initializeApp(mod.firebaseConfig); db=getFirestore(app); configured=true;
    setBadge('接続準備OK',true);
    if(savedKey) subscribe(savedKey);
  }catch(e){
    configured=false; setBadge('Firebase未設定',false); console.warn(e);
    remoteState=JSON.parse(localStorage.getItem('breaksync.localState')||'null'); render();
  }
}
function setBadge(text,on){els.syncBadge.textContent=text;els.syncBadge.className=`badge ${on?'online':'offline'}`}
function refFor(key){return doc(db,'breakrooms',key)}
async function subscribe(key){
  if(unsubscribe) unsubscribe();
  if(!configured){setBadge('この端末のみ',false); return;}
  setBadge('同期中…',true);
  const ref=refFor(key);
  const snap=await getDoc(ref);
  if(!snap.exists()) await setDoc(ref,{active:false,startedAt:null,sessions:[],updatedAt:serverTimestamp()});
  unsubscribe=onSnapshot(ref,s=>{remoteState=normalize(s.data());setBadge('同期済み',true);render();},()=>setBadge('同期エラー',false));
}
async function saveState(next){
  remoteState=next; render();
  const key=els.roomKey.value.trim();
  if(configured && key){await setDoc(refFor(key),{...next,updatedAt:serverTimestamp()},{merge:true});}
  else localStorage.setItem('breaksync.localState',JSON.stringify(next));
}

els.saveKeyBtn.addEventListener('click',()=>{
  const key=els.roomKey.value.trim(); if(!key) return;
  localStorage.setItem('breaksync.roomKey',key); subscribe(key);
});
els.dailyLimit.addEventListener('change',()=>{localStorage.setItem('breaksync.limit',els.dailyLimit.value);render();});
els.refreshBtn.addEventListener('click',render);
els.mainAction.addEventListener('click',async()=>{
  const s=normalize(remoteState); const now=Date.now();
  if(!s.active){await saveState({...s,active:true,startedAt:now});}
  else{
    const start=s.startedAt||now;
    await saveState({...s,active:false,startedAt:null,sessions:[...(s.sessions||[]),{start,end:now}]});
  }
});
els.undoBtn.addEventListener('click',async()=>{
  const s=normalize(remoteState);
  if(s.active){await saveState({...s,active:false,startedAt:null});return;}
  if((s.sessions||[]).length){const arr=s.sessions.slice(0,-1);await saveState({...s,sessions:arr});}
});

if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
ticker=setInterval(render,1000);
initFirebase();
