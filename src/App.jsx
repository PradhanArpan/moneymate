/* ─────────────────────────────────────────────────────────────────
   MONEYMATE  ·  Smart Money Tracker  ·  v5.2
   ─────────────────────────────────────────────────────────────────*/
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Wallet, PiggyBank, Target, LayoutDashboard, List,
  Plus, Trash2, X, ChevronLeft, ChevronRight, TrendingUp,
  Download, FileUp, Edit2, ArrowLeft, RefreshCw, Settings,
  Search, Filter,
} from "lucide-react";

/* ── Colours ─────────────────────────────────────────────────────── */
const C = {
  bg:"#F3F6F2",card:"#FFFFFF",ink:"#263238",muted:"#7D8B8C",
  border:"#E0E7E2",brand:"#43A047",brandDim:"#EAF7EA",
  income:"#43A047",expense:"#EF5350",xfer:"#4F7DD4",
  gold:"#F9A825",dark:"#123524",warn:"#F59E0B",
  softExpense:"#FFEDEE",softIncome:"#EAF7EA",softBlue:"#EEF3FF",
  charts:["#EF5350","#FF9800","#F9A825","#43A047","#4F7DD4",
          "#8E64C8","#26A69A","#EC407A","#5E6AD2","#00ACC1","#78909C"],
};

/* ── Constants ───────────────────────────────────────────────────── */
const EXPENSE_CATS  = ["Food","Groceries","Transport","Rent","Utilities","Shopping","Health","Entertainment","EMI","Education","Other"];
const INCOME_CATS   = ["Salary","Business","Interest","Gift","Other"];
const BANK_TYPES    = ["Bank","UPI / Wallet","Cash"];
const CC_TYPES      = ["Visa","Mastercard","Amex","RuPay","HDFC CC","SBI CC","ICICI CC","Axis CC","Other CC"];
const LOAN_TYPES    = ["Car Loan","Home Loan","Personal Loan","Education Loan","Business Loan","Gold Loan","Other Loan"];
const INVEST_TYPES  = ["Mutual Fund","Stocks","SGB","Bonds","FD","PPF","NPS","Other"];
const CAT_EMOJI = {
  Food:"🍜",Groceries:"🛒",Transport:"🚗",Rent:"🏠",Utilities:"⚡",
  Shopping:"🛍️",Health:"💊",Entertainment:"🎬",EMI:"🏦",Education:"📚",
  Other:"📌",Salary:"💼",Business:"📈",Interest:"💰",Gift:"🎁",Transfer:"↔️",
};

/* ── Utils ───────────────────────────────────────────────────────── */
const inr    = n=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Math.round(n||0));
const uid    = ()=>Math.random().toString(36).slice(2,9);
const today  = ()=>new Date().toISOString().slice(0,10);
const curMo  = ()=>today().slice(0,7);
const mkKey  = d=>d.slice(0,7);
const prevMo = mk=>{const d=new Date(mk+"-01");d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7);};
const nextMo = mk=>{const d=new Date(mk+"-01");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,7);};
const monthLabel=mk=>{const[y,m]=mk.split("-");return new Date(+y,+m-1,1).toLocaleString("en-IN",{month:"long",year:"numeric"});};
const shortMo =mk=>{const[y,m]=mk.split("-");return new Date(+y,+m-1,1).toLocaleString("en-IN",{month:"short"});};
const daysBefore=(s,n)=>{const d=new Date(s);d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
const prevDay = s=>{const d=new Date(s);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);};
const currentFY=()=>{const m=new Date().getMonth();return m>=3?new Date().getFullYear():new Date().getFullYear()-1;};
const fyRange =y=>({start:`${y}-04-01`,end:`${y+1}-03-31`});
const monthsBetween=(a,b)=>{const da=new Date(a),db=new Date(b);return Math.max(0,(db.getFullYear()-da.getFullYear())*12+(db.getMonth()-da.getMonth()));};

const ymd=d=>d.toISOString().slice(0,10);
const addDays=(s,n)=>{const d=new Date(s);d.setDate(d.getDate()+n);return ymd(d);};
const currentYear=()=>new Date().getFullYear();
const startOfWeek=(s=today())=>{const d=new Date(s);const day=d.getDay();d.setDate(d.getDate()-((day+6)%7));return ymd(d);};
const periodRange=p=>{
  if(!p||p.kind==="month"){
    const mk=p?.month||curMo(),[y,m]=mk.split("-").map(Number);
    return {start:`${mk}-01`,end:ymd(new Date(y,m,0))};
  }
  if(p.kind==="today")return {start:today(),end:today()};
  if(p.kind==="week"){const st=p.start||startOfWeek();return {start:st,end:addDays(st,6)};}
  if(p.kind==="year"){const y=p.year||currentYear();return {start:`${y}-01-01`,end:`${y}-12-31`};}
  if(p.kind==="custom")return {start:p.start||"0000-00-00",end:p.end||"9999-99-99"};
  return null;
};
const periodLabel=p=>{
  if(!p||p.kind==="month")return monthLabel(p?.month||curMo());
  if(p.kind==="today")return "Today";
  if(p.kind==="week"){const r=periodRange(p);return `${new Date(r.start).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}–${new Date(r.end).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}`;}
  if(p.kind==="year")return String(p.year||currentYear());
  if(p.kind==="all")return "All time";
  if(p.kind==="custom")return `${p.start||"Start"} → ${p.end||"End"}`;
  return "Period";
};
const shiftPeriod=(p,dir)=>{
  if(!p||p.kind==="month")return {kind:"month",month:dir>0?nextMo(p?.month||curMo()):prevMo(p?.month||curMo())};
  if(p.kind==="week")return {kind:"week",start:addDays(p.start||startOfWeek(),dir*7)};
  if(p.kind==="year")return {kind:"year",year:(p.year||currentYear())+dir};
  return p;
};
const periodTxns=(txns,p)=>{const r=periodRange(p);if(!r)return txns;return txns.filter(t=>t.date>=r.start&&t.date<=r.end);};
const dateDiff=(a,b)=>Math.round((new Date(a).getTime()-new Date(b).getTime())/86400000);
const recurringDueDate=r=>{const mk=curMo(),[y,m]=mk.split("-").map(Number),ld=new Date(y,m,0).getDate();return `${mk}-${String(Math.min(Math.max(+r.day||1,1),ld)).padStart(2,"0")}`;};
const recurringState=r=>{
  const paid=r.lastDone===curMo(),due=recurringDueDate(r),diff=dateDiff(due,today());
  if(paid)return {key:"paid",label:"Paid",tone:C.income,bg:C.softIncome,rank:4,due,diff};
  if(diff<0)return {key:"overdue",label:`${Math.abs(diff)}d overdue`,tone:C.expense,bg:C.softExpense,rank:0,due,diff};
  if(diff===0)return {key:"today",label:"Due today",tone:C.warn,bg:"#FFF8E8",rank:1,due,diff};
  if(diff<=7)return {key:"soon",label:`In ${diff}d`,tone:C.gold,bg:"#FFF8E8",rank:2,due,diff};
  return {key:"later",label:`Day ${r.day}`,tone:C.muted,bg:C.bg,rank:3,due,diff};
};
const lastBackupLabel=()=>{const d=daysSinceBackup();if(d>=999)return "Never backed up";if(d===0)return "Backed up today";if(d===1)return "Backed up yesterday";return `Last backup: ${d} days ago`;};


function evalExpr(s){
  s=String(s||"").replace(/\s+/g,"").replace(/,/g,"");
  if(!s||!/^[\d+\-*/().]+$/.test(s))return NaN;
  let i=0;
  const expr=()=>{let v=term();while(s[i]==="+"||s[i]==="-"){const op=s[i++];const r=term();v=op==="+"?v+r:v-r;}return v;};
  const term=()=>{let v=fact();while(s[i]==="*"||s[i]==="/"){const op=s[i++];const r=fact();v=op==="*"?v*r:v/r;}return v;};
  const fact=()=>{
    if(s[i]==="("){i++;const v=expr();if(s[i]===")") i++;return v;}
    if(s[i]==="-"){i++;return -fact();}
    let j=i;while(j<s.length&&/[\d.]/.test(s[j]))j++;
    const v=parseFloat(s.slice(i,j));i=j;return v;
  };
  const v=expr();return i===s.length&&isFinite(v)?v:NaN;
}

/* ── Data model ──────────────────────────────────────────────────── */
const DEFAULT_ACCOUNTS=[
  {id:"acc-sib",  name:"South Indian Bank",type:"Bank",  opening:0,hint:"0584"},
  {id:"acc-hdfc", name:"HDFC Bank",         type:"Bank",  opening:0,hint:"9712"},
  {id:"acc-sbi1", name:"SBI – 4034",        type:"Bank",  opening:0,hint:"4034"},
  {id:"acc-sbi2", name:"SBI – 5194",        type:"Bank",  opening:0,hint:"5194"},
  {id:"acc-ktk",  name:"Kotak Bank",         type:"Bank",  opening:0,hint:"1924"},
  {id:"acc-loan", name:"SBI Car Loan",       type:"Loan",  loanType:"Car Loan",
   sanctionedAmount:780000,outstandingAmount:576797,opening:0,hint:""},
];
const EMPTY={
  accounts:DEFAULT_ACCOUNTS,transactions:[],budgets:{},
  goals:[],recurring:[],customCats:{expense:[],income:[]},
};
const normalize=d=>({
  ...EMPTY,...d,
  accounts:d.accounts?.length?d.accounts:DEFAULT_ACCOUNTS,
  recurring:d.recurring||[],
  customCats:{expense:[],income:[],...(d.customCats||{})},
  goals:(d.goals||[]).map(g=>({linkType:"none",linkedAccountId:"",investmentType:"Mutual Fund",investmentValue:0,targetDate:"",...g})),
});

/* ── AES-256-GCM ─────────────────────────────────────────────────── */
const _e=new TextEncoder(),_d=new TextDecoder();
const b4e=b=>btoa(String.fromCharCode(...new Uint8Array(b)));
const b4d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pin,salt){
  const km=await crypto.subtle.importKey("raw",_e.encode(pin),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encData(data,pin){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(pin,salt);
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,_e.encode(JSON.stringify(data)));
  return JSON.stringify({s:b4e(salt),v:b4e(iv),c:b4e(ct)});
}
async function decData(stored,pin){
  const{s,v,c}=JSON.parse(stored);
  const key=await deriveKey(pin,b4d(s));
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b4d(v)},key,b4d(c));
  return normalize(JSON.parse(_d.decode(pt)));
}

/* ── Backup helpers ──────────────────────────────────────────────── */
async function exportBackup(data,pin){
  const payload=JSON.stringify({version:"5",date:today(),data:await encData(data,pin)});
  const url=URL.createObjectURL(new Blob([payload],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=`moneymate-backup-${today()}.mmbackup`;a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem("mm:lastBackup",today());
}
async function importBackup(text,pin){
  const{version,data:encrypted}=JSON.parse(text);
  if(!version||!encrypted)throw new Error("Invalid backup file");
  return await decData(encrypted,pin);
}
const daysSinceBackup=()=>{
  const lb=localStorage.getItem("mm:lastBackup");
  if(!lb)return 999;
  return Math.floor((Date.now()-new Date(lb).getTime())/86400000);
};

/* ── PDF Parser ──────────────────────────────────────────────────── */
const PDFCDN="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const loadPdf=()=>new Promise((res,rej)=>{
  if(window.pdfjsLib)return res(window.pdfjsLib);
  const s=document.createElement("script");s.src=`${PDFCDN}/pdf.min.js`;
  s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=`${PDFCDN}/pdf.worker.min.js`;res(window.pdfjsLib);};
  s.onerror=()=>rej(new Error("PDF reader failed to load"));
  document.head.appendChild(s);
});
async function extractLines(pdf){
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p),tc=await page.getTextContent(),rows=new Map();
    tc.items.forEach(it=>{if(!it.str.trim())return;const y=Math.round(it.transform[5]/3)*3;if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x:it.transform[4],str:it.str});});
    [...rows.keys()].sort((a,b)=>b-a).forEach(y=>{const ln=rows.get(y).sort((a,b)=>a.x-b.x).map(i=>i.str).join(" ").replace(/\s+/g," ").trim();if(ln)lines.push(ln);});
  }
  return lines;
}
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const DRE =/\b(\d{1,2})[\/\-.]((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2})[\/\-.](\d{2,4})\b/i;
const DRE2=/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i;
const ARE =/(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}/g;
const toISO=(d,m,y)=>{const mm=isNaN(+m)?MONTHS[m.toLowerCase().slice(0,3)]:+m;let yy=+y;if(String(y).length===2)yy+=2000;if(!mm||mm>12||+d>31||yy<2000||yy>2100)return null;return `${yy}-${String(mm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;};
const CCAT=[[/swiggy|zomato|dominos|mcdonald|kfc|restaurant|cafe|thalassery|jalpan|food/i,"Food"],[/blinkit|zepto|bigbasket|grofers|dmart|grocery|kirana/i,"Groceries"],[/uber|ola|rapido|irctc|metro|petrol|hpcl|iocl|bpcl|fastag|toll/i,"Transport"],[/rent\b|landlord|pg\b/i,"Rent"],[/electricity|bescom|tneb|jio|airtel|broadband|dth|gas bill/i,"Utilities"],[/amazon|flipkart|myntra|ajio|nykaa|meesho/i,"Shopping"],[/pharmacy|apollo|medplus|hospital|clinic|1mg/i,"Health"],[/netflix|spotify|hotstar|bookmyshow|prime|pvr/i,"Entertainment"],[/\bemi\b|loan emi|car loan|home loan/i,"EMI"],[/school|college|udemy|tuition|byjus/i,"Education"],[/indstocks|iccl|zerodha|groww|upstox/i,"Stocks"]];
const ICAT=[[/salary|sal cr|payroll/i,"Salary"],[/interest|int cr|int pd/i,"Interest"],[/dividend/i,"Interest"],[/refund|cashback|reversal/i,"Other"]];
const guessCat=(d,t)=>{const r=t==="income"?ICAT:CCAT;for(const[re,c]of r)if(re.test(d))return c;return "Other";};
const isCr=l=>/\bcr\b|credit|deposit|interest credit|dep tfr|by [a-z]|refund|cashback|nach.*cr/i.test(l);
const isDr=l=>/\bdr\b|debit|withdraw|wdl\b|paid|sent/i.test(l);
function detectTransfer(desc,accounts){
  const IFSC=[{re:/HDFC0/i,hints:["9712"]},{re:/SIBL0|SOUTH\s*I\s*\//i,hints:["0584"]},{re:/KKBK0/i,hints:["1924"]},{re:/SBIN0/i,hints:["4034","5194"]}];
  const banks=accounts.filter(a=>BANK_TYPES.includes(a.type)||a.type==="UPI / Wallet");
  const cc=accounts.filter(a=>a.type==="Credit Card");
  const loans=accounts.filter(a=>a.type==="Loan");
  if(/credit card|cc payment|cc bill|card payment/i.test(desc)&&cc.length)return cc[0].id;
  if(/loan.*emi|emi.*loan/i.test(desc)&&loans.length)return loans[0].id;
  for(const{re,hints}of IFSC){if(re.test(desc)){for(const h of hints){const a=banks.find(x=>x.hint===h);if(a)return a.id;}}}
  for(const a of banks){if(a.hint&&a.hint.length>=4&&desc.includes(a.hint))return a.id;}
  return null;
}
const isXferKw=l=>/\bneft\b|\bimps\b|\brtgs\b|\btransfer\b|\btfr\b|mb:\s*sent|wdl tfr|dep tfr/i.test(l);
function matchRecurring(row,recurList){for(const r of recurList){const words=r.name.toLowerCase().split(/\W+/).filter(w=>w.length>3);const hit=words.some(w=>row.desc.toLowerCase().includes(w));const amt=Math.abs(r.amount-row.amount)<=Math.max(r.amount*0.1,20);if(hit&&amt&&r.type===row.type)return r;}return null;}
function parseStatement(lines,accounts=[],recurList=[]){
  const all=lines.join(" ");
  const isKotak=/kotak mahindra|kkbk0007/i.test(all);
  if(all.trim().length<200&&lines.length<10){const e=new Error("SCANNED");e.scanned=true;throw e;}
  const out=[];let prevBal=null;
  const skip=l=>/^(date\b|sl\.?\s*no|transaction date|value date|particulars|narration|opening bal|closing bal|statement of|account no|page no)/i.test(l.trim());
  for(const line of lines){
    if(skip(line))continue;
    const dm=line.match(DRE)||line.match(DRE2);if(!dm)continue;
    const date=toISO(dm[1],dm[2],dm[3]);if(!date)continue;
    let amount=0,type=null;
    if(isKotak){
      const sg=line.match(/\s([+\-])([\d,]+\.\d{2})\b/);if(!sg)continue;
      amount=parseFloat(sg[2].replace(/,/g,""));type=sg[1]==="+"?"income":"expense";
      const bm=line.match(/([\d,]+\.\d{2})\s*$/);if(bm)prevBal=parseFloat(bm[1].replace(/,/g,""));
    }else{
      const cl=line.replace(/(\d)(Cr)\b/gi,"$1");
      const amts=(cl.match(ARE)||[]).map(a=>parseFloat(a.replace(/,/g,""))).filter(v=>v>0.005);
      if(!amts.length)continue;const bal=amts[amts.length-1];
      if(amts.length>=3){const c1=amts[amts.length-3],c2=amts[amts.length-2];
        if(prevBal!==null){const d=bal-prevBal;if(Math.abs(d+c1)<1.5){amount=c1;type="expense";}else if(Math.abs(d-c2)<1.5){amount=c2;type="income";}else if(Math.abs(d+c2)<1.5){amount=c2;type="expense";}else if(Math.abs(d-c1)<1.5){amount=c1;type="income";}else{amount=Math.max(c1,c2);type=isCr(cl)?"income":"expense";}}
        else{amount=c2>0?c2:c1;type=isCr(cl)?"income":isDr(cl)?"expense":"expense";}
      }else if(amts.length===2){const tx=amts[0];
        if(prevBal!==null){const d=bal-prevBal;amount=tx;if(Math.abs(Math.abs(d)-tx)<=Math.max(tx*0.02,1)){type=d>=0?"income":"expense";}else{type=isCr(cl)?"income":isDr(cl)?"expense":null;}}
        else{amount=tx;type=isCr(cl)?"income":isDr(cl)?"expense":"expense";}
      }else continue;
      if(!type)continue;prevBal=bal;
    }
    if(!amount||amount<=0)continue;
    const desc=line.replace(DRE2,"").replace(DRE,"").replace(/\s[+\-][\d,]+\.\d{2}/g,"").replace(ARE,"").replace(/\b(Cr|Dr|CR|DR|A\/C)\b/g,"").replace(/[^\w\s\/\-@.:]/g," ").replace(/\s+/g," ").trim().slice(0,70);
    const xferTo=(isXferKw(line)||isXferKw(desc))?detectTransfer(desc+line,accounts):null;
    const recMatch=matchRecurring({desc,amount,type},recurList);
    out.push({date,amount,type,desc,category:guessCat(desc,type),include:true,key:uid(),isXfer:!!xferTo,xferToId:xferTo||"",recurMatch:recMatch?{id:recMatch.id,name:recMatch.name}:null});
  }
  return out;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PIN SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PinScreen({isSetup,onSetup,onUnlock,err,setErr,onForgot}){
  const[digits,setDigits]=useState([]);const[stage,setStage]=useState(1);const[first,setFirst]=useState("");
  const push=k=>{if(digits.length>=4)return;const next=[...digits,String(k)];setDigits(next);
    if(next.length===4){const p=next.join("");
      setTimeout(()=>{if(!isSetup){onUnlock(p);setDigits([]);}else if(stage===1){setFirst(p);setStage(2);setDigits([]);setErr("");}else{if(p===first)onSetup(p);else{setErr("PINs don't match — try again");setStage(1);setFirst("");setDigits([]);}}},120);}};
  const pop=()=>setDigits(d=>d.slice(0,-1));
  const label=isSetup?(stage===1?"Set a 4-digit PIN":"Confirm your PIN"):"Enter your PIN";
  return(<div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"Inter,system-ui,sans-serif"}}>
    <div style={{fontSize:52,marginBottom:12}}>💰</div>
    <h1 style={{color:C.brand,fontFamily:"Georgia,serif",fontSize:30,fontWeight:700,margin:"0 0 4px"}}>MoneyMate</h1>
    <p style={{color:"#6B9A8A",fontSize:13,margin:"0 0 48px",letterSpacing:"0.1em",textTransform:"uppercase"}}>Smart Money Tracker</p>
    <p style={{color:"#B0C9C0",fontSize:15,marginBottom:22,fontWeight:500}}>{label}</p>
    <div style={{display:"flex",gap:18,marginBottom:36}}>{[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",background:digits.length>i?C.brand:"rgba(255,255,255,0.1)",transition:"background .15s"}}/>)}</div>
    {err&&<p style={{color:C.expense,fontSize:13,marginBottom:14,fontWeight:600}}>{err}</p>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,76px)",gap:14}}>
      {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(<button key={i} onClick={()=>k==="⌫"?pop():k!==""?push(k):null} disabled={k===""}
        style={{width:76,height:76,borderRadius:"50%",border:"none",fontSize:k==="⌫"?22:26,fontWeight:600,cursor:k===""?"default":"pointer",color:"#fff",fontFamily:"inherit",background:k===""?"transparent":k==="⌫"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>{k}</button>))}
    </div>
    {!isSetup&&<button onClick={onForgot} style={{color:"#5A8A7A",background:"none",border:"none",fontSize:13,marginTop:40,cursor:"pointer",textDecoration:"underline"}}>Forgot PIN? Reset app</button>}
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP ROOT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function App(){
  const[phase,setPhase]=useState("loading");
  const[pin,setPin]=useState("");const[err,setErr]=useState("");const[data,setData]=useState(EMPTY);
  useEffect(()=>{setPhase(localStorage.getItem("mm:setup")?"lock":"setup");},[]);
  const persist=async(next,p)=>{setData(next);try{localStorage.setItem("mm:data",await encData(next,p||pin));}catch(e){console.error(e);}};
  const handleSetup=async p=>{try{localStorage.setItem("mm:data",await encData(EMPTY,p));localStorage.setItem("mm:setup","1");}catch(e){console.error(e);}setPin(p);setData(EMPTY);setPhase("app");};
  const handleUnlock=async p=>{try{const raw=localStorage.getItem("mm:data");const d=raw?await decData(raw,p):EMPTY;setPin(p);setData(d);setErr("");setPhase("app");}catch{setErr("Wrong PIN — try again");}};
  const handleForgot=()=>{if(window.confirm("Delete ALL data permanently?")){localStorage.clear();setPhase("setup");setErr("");}};
  if(phase==="loading")return<div style={{minHeight:"100vh",background:C.dark,display:"grid",placeItems:"center",fontSize:48}}>💰</div>;
  if(phase==="setup")return<PinScreen isSetup onSetup={handleSetup} err={err} setErr={setErr}/>;
  if(phase==="lock") return<PinScreen onUnlock={handleUnlock} err={err} setErr={setErr} onForgot={handleForgot}/>;
  return<Main data={data} persist={next=>persist(next)} pin={pin}/>;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Main({data,persist,pin}){
  const[tab,setTab]=useState("home");
  const[modal,setModal]=useState(null);
  const M=(type,extra={})=>setModal({type,...extra});
  const close=()=>setModal(null);

  const addTxn  =t=>persist({...data,transactions:[...data.transactions,{...t,id:uid()}]});
  const addTxns =ts=>persist({...data,transactions:[...data.transactions,...ts.map(t=>({...t,id:uid()}))]});
  const delTxn  =id=>persist({...data,transactions:data.transactions.filter(t=>t.id!==id)});
  const editTxn =(id,ch)=>persist({...data,transactions:data.transactions.map(t=>t.id===id?{...t,...ch}:t)});
  const addAcc  =a=>persist({...data,accounts:[...data.accounts,{...a,id:uid()}]});
  const delAcc  =id=>persist({...data,accounts:data.accounts.filter(a=>a.id!==id),transactions:data.transactions.filter(t=>t.accountId!==id&&t.toAccountId!==id)});
  const editAcc =(id,ch)=>persist({...data,accounts:data.accounts.map(a=>a.id===id?{...a,...ch}:a)});
  const editLoan=(id,out)=>persist({...data,accounts:data.accounts.map(a=>a.id===id?{...a,outstandingAmount:+out}:a)});
  const editCC  =(id,ch)=>persist({...data,accounts:data.accounts.map(a=>a.id===id?{...a,...ch}:a)});
  const payLoan =(loanId,bankId,amt,note)=>{const txn={id:uid(),type:"expense",amount:+amt,category:"EMI",accountId:bankId,date:today(),note:note||"Loan payment"};const newOut=Math.max(0,(data.accounts.find(a=>a.id===loanId)?.outstandingAmount||0)-(+amt));persist({...data,transactions:[...data.transactions,txn],accounts:data.accounts.map(a=>a.id===loanId?{...a,outstandingAmount:newOut}:a)});};
  const addGoal =g=>persist({...data,goals:[...data.goals,{...g,id:uid()}]});
  const delGoal =id=>persist({...data,goals:data.goals.filter(g=>g.id!==id)});
  const editGoal=(id,ch)=>persist({...data,goals:data.goals.map(g=>g.id===id?{...g,...ch}:g)});
  const setBudget=(cat,amt)=>persist({...data,budgets:{...data.budgets,[cat]:amt}});
  const delBudget=cat=>{const b={...data.budgets};delete b[cat];persist({...data,budgets:b});};
  const addCat  =(kind,n)=>persist({...data,customCats:{...data.customCats,[kind]:[...data.customCats[kind],n.trim()]}});
  const addRec  =r=>persist({...data,recurring:[...data.recurring,{...r,id:uid(),lastDone:""}]});
  const delRec  =id=>persist({...data,recurring:data.recurring.filter(r=>r.id!==id)});
  const markPaid=rec=>{const mk=curMo(),[y,m]=mk.split("-").map(Number),ld=new Date(y,m,0).getDate();const date=`${mk}-${String(Math.min(rec.day,ld)).padStart(2,"0")}`;persist({...data,transactions:[...data.transactions,{id:uid(),type:rec.type,amount:rec.amount,category:rec.category,accountId:rec.accountId,date,note:rec.name}],recurring:data.recurring.map(r=>r.id===rec.id?{...r,lastDone:mk}:r)});};
  const importBatch=txns=>persist({...data,transactions:[...data.transactions,...txns]});
  const restoreData=d=>{persist(d);};
  const exportCSV=()=>{const head="Date,Type,Category,Account,Amount,Note\n";const body=[...data.transactions].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{const acc=data.accounts.find(a=>a.id===t.accountId)?.name||"";const q=s=>`"${String(s||"").replace(/"/g,'""')}"`;return[t.date,t.type,q(t.category),q(acc),t.amount,q(t.note)].join(",");}).join("\n");const url=URL.createObjectURL(new Blob([head+body],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`moneymate-${today()}.csv`;a.click();URL.revokeObjectURL(url);};

  const expCats=[...EXPENSE_CATS,...data.customCats.expense];
  const incCats=[...INCOME_CATS,...data.customCats.income];
  const bankAccounts=data.accounts.filter(a=>BANK_TYPES.includes(a.type));
  const cashAccount=data.accounts.find(a=>a.type==="Cash");

  const balances=useMemo(()=>{
    const b={};
    data.accounts.forEach(a=>{if(a.type==="Loan")b[a.id]=-(a.outstandingAmount||0);else if(a.type==="Credit Card")b[a.id]=-(a.currentOutstanding||0);else b[a.id]=+a.opening||0;});
    data.transactions.forEach(t=>{const amt=+t.amount||0;if(t.type==="income")b[t.accountId]=(b[t.accountId]||0)+amt;else if(t.type==="expense")b[t.accountId]=(b[t.accountId]||0)-amt;else if(t.type==="transfer"){b[t.accountId]=(b[t.accountId]||0)-amt;if(t.toAccountId)b[t.toAccountId]=(b[t.toAccountId]||0)+amt;}});
    return b;
  },[data]);
  const netWorth=Object.values(balances).reduce((s,v)=>s+v,0);

  // CC due date alerts
  const ccDueAlerts=useMemo(()=>{
    const todayNum=new Date().getDate();
    return data.accounts.filter(a=>a.type==="Credit Card"&&a.dueDay).map(a=>{
      const due=a.dueDay,diff=due>=todayNum?due-todayNum:30-todayNum+due;
      return diff<=7?{...a,daysLeft:diff}:null;
    }).filter(Boolean);
  },[data]);

  const backupReminder=daysSinceBackup()>30;

  const showFAB=tab==="entries";

  const TABS=[
    {id:"home",   Icon:LayoutDashboard,label:"Home"},
    {id:"entries",Icon:List,           label:"Entries"},
    {id:"categories",Icon:Target,      label:"Cats"},
    {id:"accounts",Icon:Wallet,        label:"Accounts"},
    {id:"budgets", Icon:Target,        label:"Budgets"},
    {id:"goals",   Icon:PiggyBank,     label:"Goals"},
    {id:"insights",Icon:TrendingUp,    label:"Insights"},
  ];

  const shared={data,balances,netWorth,expCats,incCats,bankAccounts,cashAccount,ccDueAlerts,backupReminder,
    addTxn,addTxns,delTxn,editTxn,addAcc,delAcc,editAcc,editLoan,editCC,payLoan,
    addGoal,delGoal,editGoal,setBudget,delBudget,addCat,addRec,delRec,markPaid,
    importBatch,restoreData,exportCSV,setModal:M};

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Inter,system-ui,sans-serif",color:C.ink}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input:focus,select:focus{outline:none;border-color:#0DBF9E!important;}`}</style>
      <div style={{paddingBottom:72}}>
        {tab==="home"    &&<HomeTab    {...shared}/>}
        {tab==="entries" &&<EntriesTab {...shared}/>}
        {tab==="categories"&&<CategoriesTab {...shared}/>}
        {tab==="accounts"&&<AccountsTab {...shared}/>}
        {tab==="budgets" &&<BudgetsTab  {...shared}/>}
        {tab==="goals"   &&<GoalsTab    {...shared}/>}
        {tab==="insights"&&<InsightsTab {...shared}/>}
      </div>
      {showFAB&&<button onClick={()=>M("txn")} style={{position:"fixed",right:20,bottom:82,width:54,height:54,borderRadius:"50%",background:C.brand,border:"none",color:"#fff",cursor:"pointer",boxShadow:"0 4px 20px rgba(13,191,158,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:30}}><Plus size={22}/></button>}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",height:60,zIndex:20,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(({id,Icon,label})=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:tab===id?C.brand:C.muted,fontSize:9,fontWeight:600}}>
            <Icon size={18} strokeWidth={tab===id?2.5:1.8}/>{label}
          </button>
        ))}
      </nav>
      {modal?.type==="txn"       &&<TxnModal       close={close} data={data} addTxn={addTxn} addTxns={addTxns} addRec={addRec} expCats={expCats} incCats={incCats} addCat={addCat} preset={modal}/>}
      {modal?.type==="edittxn"   &&<EditTxnModal   close={close} txn={modal.txn} data={data} editTxn={editTxn} addRec={addRec} expCats={expCats} incCats={incCats}/>}
      {modal?.type==="quickadd"  &&<QuickAddModal   close={close} data={data} addTxn={addTxn} cat={modal.cat} kind={modal.kind||"expense"} expCats={expCats} incCats={incCats}/>}
      {modal?.type==="quickcash" &&<QuickCashModal  close={close} data={data} addTxn={addTxn} expCats={expCats}/>}
      {modal?.type==="account"   &&<AccountModal    close={close} addAcc={addAcc}/>}
      {modal?.type==="credit"    &&<CreditCardModal close={close} addAcc={addAcc}/>}
      {modal?.type==="loan"      &&<LoanModal       close={close} addAcc={addAcc}/>}
      {modal?.type==="editacc"   &&<EditAccModal    close={close} account={modal.account} editAcc={editAcc}/>}
      {modal?.type==="editloan"  &&<EditLoanModal   close={close} account={modal.account} editLoan={editLoan}/>}
      {modal?.type==="editcc"    &&<EditCCModal     close={close} account={modal.account} editCC={editCC}/>}
      {modal?.type==="payloan"   &&<PayLoanModal    close={close} loan={modal.loan} bankAccounts={bankAccounts} payLoan={payLoan}/>}
      {modal?.type==="paycc"     &&<PayCCModal      close={close} cc={modal.cc} bankAccounts={bankAccounts} addTxn={addTxn}/>}
      {modal?.type==="goal"      &&<GoalModal       close={close} addGoal={addGoal} bankAccounts={bankAccounts}/>}
      {modal?.type==="editgoal"  &&<EditGoalModal   close={close} goal={modal.goal} editGoal={editGoal}/>}
      {modal?.type==="budget"    &&<BudgetModal     close={close} setBudget={setBudget} expCats={expCats}/>}
      {modal?.type==="import"    &&<ImportModal     close={close} data={data} importBatch={importBatch} expCats={expCats} incCats={incCats}/>}
      {modal?.type==="settings"  &&<SettingsModal   close={close} data={data} pin={pin} restoreData={restoreData}/>}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HomeTab({data,balances,netWorth,ccDueAlerts,backupReminder,cashAccount,setModal,markPaid,delRec,expCats}){
  const[period,setPeriod]=useState({kind:"month",month:curMo()});
  const txns=useMemo(()=>periodTxns(data.transactions,period),[data.transactions,period]);
  const inc=txns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const exp=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);
  const saved=inc-exp;
  const catSpend=useMemo(()=>{const m={};txns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[txns]);
  const pieData=Object.entries(catSpend).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  const quickCats=(expCats?.length?expCats:EXPENSE_CATS).slice(0,8);
  const wheelItems=(pieData.length?pieData:quickCats.map(name=>({name,value:0}))).slice(0,8);
  const todayTxns=data.transactions.filter(t=>t.date===today());
  const todayExp=todayTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);
  const todayInc=todayTxns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const planned=data.recurring.map(r=>({...r,status:recurringState(r)})).sort((a,b)=>a.status.rank-b.status.rank||a.status.diff-b.status.diff||a.name.localeCompare(b.name));
  const pendingCount=planned.filter(r=>r.status.key!=="paid").length;
  const dueNow=planned.filter(r=>["overdue","today"].includes(r.status.key)).length;
  const canShift=["month","week","year"].includes(period.kind||"month");
  const backupLabel=lastBackupLabel();
  const cashBal=cashAccount?balances[cashAccount.id]||0:null;
  const recent=[...data.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  const pct=v=>exp>0?Math.round((v/exp)*100):0;

  return(
    <div style={{minHeight:"100vh",background:"#F3F6F2",paddingBottom:138}}>
      <div style={{background:C.brand,color:"#fff",padding:"42px 16px 14px",boxShadow:"0 6px 18px rgba(67,160,71,0.25)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"grid",placeItems:"center",fontSize:18}}>₹</div>
            <div>
              <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.02em"}}>MoneyMate</div>
              <div style={{fontSize:11,opacity:0.82,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>Daily money tracker</div>
            </div>
          </div>
          <button onClick={()=>setModal("settings")} style={{width:38,height:38,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",display:"grid",placeItems:"center",cursor:"pointer"}}><Settings size={18}/></button>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          {canShift?<button onClick={()=>setPeriod(shiftPeriod(period,-1))} style={MoneyArrowBtn}><ChevronLeft size={18}/></button>:<span/>}
          <PeriodPicker period={period} setPeriod={setPeriod}/>
          {canShift?<button onClick={()=>setPeriod(shiftPeriod(period,1))} style={MoneyArrowBtn}><ChevronRight size={18}/></button>:<span/>}
        </div>
      </div>

      <div style={{padding:"12px 12px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <MoneySummaryTile label="Expense" value={inr(exp)} color={C.expense} accent="−"/>
          <MoneySummaryTile label="Income" value={inr(inc)} color={C.income} accent="+"/>
        </div>

        <div style={{background:C.card,borderRadius:26,padding:"14px 8px 12px",boxShadow:"0 8px 24px rgba(38,50,56,0.10)",border:"1px solid rgba(224,231,226,0.8)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px 6px"}}>
            <div>
              <div style={{fontSize:11,color:C.muted,fontWeight:900,letterSpacing:"0.08em",textTransform:"uppercase"}}>Balance</div>
              <div style={{fontSize:26,fontWeight:950,color:netWorth<0?C.expense:C.ink,letterSpacing:"-0.03em"}}>{inr(netWorth)}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:C.muted,fontWeight:900,letterSpacing:"0.08em",textTransform:"uppercase"}}>Saved</div>
              <div style={{fontSize:20,fontWeight:950,color:saved>=0?C.income:C.expense,letterSpacing:"-0.02em"}}>{inr(saved)}</div>
            </div>
          </div>

          <div style={{position:"relative",height:330,marginTop:2}}>
            <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",width:214,height:214,borderRadius:"50%",background:"#fff",boxShadow:"inset 0 0 0 1px #EEF1EE, 0 12px 28px rgba(38,50,56,0.08)"}}>
              {pieData.length>0?<ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={66} outerRadius={99} paddingAngle={2} stroke="none" onClick={s=>setModal("quickadd",{cat:s.name,kind:"expense"})} style={{cursor:"pointer"}}>
                    {pieData.map((_,i)=><Cell key={i} fill={C.charts[i%C.charts.length]}/>) }
                  </Pie>
                  <Tooltip formatter={v=>inr(v)} contentStyle={{borderRadius:12,border:`1px solid ${C.border}`,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>:<div style={{position:"absolute",inset:18,borderRadius:"50%",border:"28px solid #E8EEE8"}}/>}
              <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}>
                <div style={{textAlign:"center",width:120}}>
                  <div style={{fontSize:10,color:C.muted,fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase"}}>Spent</div>
                  <div style={{fontSize:24,fontWeight:950,color:C.expense,letterSpacing:"-0.04em",lineHeight:1.05}}>{inr(exp)}</div>
                  <div style={{fontSize:10,color:C.muted,fontWeight:800,marginTop:2}}>{periodLabel(period)}</div>
                </div>
              </div>
            </div>
            {wheelItems.map((it,i)=><WheelBubble key={it.name} item={it} index={i} percent={pct(it.value)} onClick={()=>setModal("quickadd",{cat:it.name,kind:"expense"})}/>) }
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"0 4px"}}>
            <MoneyMini label="Today spent" value={inr(todayExp)} color={C.expense}/>
            <MoneyMini label="Today income" value={inr(todayInc)} color={C.income}/>
            <MoneyMini label="Pending" value={String(pendingCount)} color={dueNow?C.expense:C.gold}/>
            <MoneyMini label="Cash" value={cashBal===null?"—":inr(cashBal)} color={C.ink}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:12}}>
          <button onClick={()=>setModal("txn",{entryType:"expense"})} style={MoneyActionRed}><span style={{fontSize:28,lineHeight:1}}>−</span><span>Expense</span></button>
          <button onClick={()=>setModal("txn",{entryType:"transfer"})} style={MoneyActionBlue}><span style={{fontSize:22,lineHeight:1}}>↔</span><span>Transfer</span></button>
          <button onClick={()=>setModal("txn",{entryType:"income"})} style={MoneyActionGreen}><span style={{fontSize:28,lineHeight:1}}>+</span><span>Income</span></button>
        </div>

        {(backupReminder||ccDueAlerts.length>0)&&<div style={{display:"grid",gap:8,marginTop:12}}>
          {backupReminder&&<div style={NoticeCard}><span style={{fontSize:18}}>💾</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:900,color:"#8A5A00"}}>Backup reminder</div><div style={{fontSize:11,color:"#9A6A00"}}>{backupLabel}</div></div><button onClick={()=>setModal("settings")} style={NoticeBtn}>Back up</button></div>}
          {ccDueAlerts.map(cc=><div key={cc.id} style={{...NoticeCard,background:"#EEF3FF",borderColor:"#D5E0FF"}}><span style={{fontSize:18}}>💳</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:900,color:C.xfer}}>{cc.name} bill due</div><div style={{fontSize:11,color:C.xfer}}>{cc.daysLeft===0?"Due today":cc.daysLeft===1?"Due tomorrow":`Due in ${cc.daysLeft} days`}</div></div><button onClick={()=>setModal("paycc",{cc})} style={{...NoticeBtn,background:C.xfer}}>Pay</button></div>)}
        </div>}

        <div style={{background:C.card,borderRadius:20,padding:14,marginTop:12,boxShadow:"0 4px 16px rgba(38,50,56,0.07)",border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <Eye style={{marginBottom:0}}>Quick entry</Eye>
            <button onClick={()=>setModal("txn",{entryType:"expense"})} style={{background:"none",border:"none",color:C.brand,fontSize:12,fontWeight:900,cursor:"pointer"}}>Full form</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9}}>
            {quickCats.map((c,i)=><button key={c} onClick={()=>setModal("quickadd",{cat:c,kind:"expense"})} style={{border:"none",background:"transparent",padding:0,cursor:"pointer",textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:"50%",margin:"0 auto 5px",background:C.charts[i%C.charts.length],display:"grid",placeItems:"center",boxShadow:"0 5px 14px rgba(38,50,56,0.14)",color:"#fff",fontSize:23}}>{CAT_EMOJI[c]||"📌"}</div>
              <div style={{fontSize:10,fontWeight:900,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c}</div>
            </button>)}
          </div>
        </div>

        <PlannedPaymentsCard planned={planned} markPaid={markPaid} delRec={delRec}/>

        {data.accounts.filter(a=>!["Loan","Credit Card"].includes(a.type)).length>0&&<div style={{marginTop:12}}>
          <Eye style={{paddingLeft:4}}>Accounts</Eye>
          <div style={{display:"flex",gap:10,overflowX:"auto",padding:"0 2px 4px"}}>
            {data.accounts.filter(a=>!["Loan","Credit Card"].includes(a.type)).map((a,i)=>(
              <button key={a.id} onClick={()=>setModal("quickadd",{cat:"Other",kind:"expense"})} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"12px 14px",flexShrink:0,minWidth:136,textAlign:"left",boxShadow:"0 4px 14px rgba(38,50,56,0.06)",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}><span style={{width:10,height:10,borderRadius:"50%",background:C.charts[(i+3)%C.charts.length]}}/><span style={{fontSize:11,color:C.muted,fontWeight:900,whiteSpace:"nowrap"}}>{a.name}</span></div>
                <div style={{fontSize:19,fontWeight:950,color:(balances[a.id]||0)<0?C.expense:C.ink,letterSpacing:"-0.03em"}}>{inr(balances[a.id])}</div>
              </button>
            ))}
          </div>
        </div>}

        {recent.length>0&&<div style={{background:C.card,borderRadius:20,padding:14,marginTop:12,boxShadow:"0 4px 16px rgba(38,50,56,0.07)",border:`1px solid ${C.border}`}}>
          <Eye>Recent</Eye>
          <div style={{display:"grid",gap:9}}>
            {recent.map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:38,height:38,borderRadius:"50%",display:"grid",placeItems:"center",background:t.type==="income"?C.softIncome:t.type==="transfer"?C.softBlue:C.softExpense,fontSize:18}}>{t.type==="transfer"?"↔️":CAT_EMOJI[t.category]||"📌"}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:900,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.category}</div><div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{t.note?` · ${t.note}`:""}</div></div>
              <div style={{fontSize:14,fontWeight:950,color:t.type==="income"?C.income:t.type==="transfer"?C.xfer:C.expense}}>{t.type==="income"?"+":t.type==="transfer"?"":"−"}{inr(t.amount)}</div>
            </div>)}
          </div>
        </div>}
      </div>
    </div>
  );
}

function MoneySummaryTile({label,value,color,accent}){
  return(<div style={{background:C.card,borderRadius:18,padding:"13px 14px",boxShadow:"0 4px 14px rgba(38,50,56,0.07)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
    <div style={{width:34,height:34,borderRadius:"50%",background:color,color:"#fff",display:"grid",placeItems:"center",fontSize:23,fontWeight:900,boxShadow:`0 4px 12px ${color}55`}}>{accent}</div>
    <div style={{minWidth:0}}><div style={{fontSize:11,color:C.muted,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</div><div style={{fontSize:19,fontWeight:950,color,letterSpacing:"-0.03em",whiteSpace:"nowrap"}}>{value}</div></div>
  </div>);
}

function MoneyMini({label,value,color}){
  return(<div style={{background:"#F7FAF6",borderRadius:14,padding:"9px 5px",textAlign:"center",border:"1px solid #E8EEE8",minWidth:0}}>
    <div style={{fontSize:9,color:C.muted,fontWeight:900,letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{label}</div>
    <div style={{fontSize:13,fontWeight:950,color,marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{value}</div>
  </div>);
}

function WheelBubble({item,index,percent,onClick}){
  const pos=[
    {left:"50%",top:"2%",transform:"translate(-50%,0)"},
    {left:"82%",top:"15%",transform:"translate(-50%,0)"},
    {left:"92%",top:"44%",transform:"translate(-50%,-50%)"},
    {left:"78%",top:"73%",transform:"translate(-50%,-50%)"},
    {left:"50%",top:"87%",transform:"translate(-50%,-50%)"},
    {left:"22%",top:"73%",transform:"translate(-50%,-50%)"},
    {left:"8%",top:"44%",transform:"translate(-50%,-50%)"},
    {left:"18%",top:"15%",transform:"translate(-50%,0)"},
  ][index%8];
  const color=C.charts[index%C.charts.length];
  return(<button onClick={onClick} style={{position:"absolute",...pos,width:76,border:"none",background:"transparent",padding:0,cursor:"pointer",textAlign:"center"}}>
    <div style={{width:58,height:58,borderRadius:"50%",margin:"0 auto 4px",background:color,display:"grid",placeItems:"center",boxShadow:`0 7px 16px ${color}55`,border:"3px solid #fff",fontSize:24}}>{CAT_EMOJI[item.name]||"📌"}</div>
    <div style={{fontSize:10,fontWeight:950,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:"0 1px 0 #fff"}}>{item.name}</div>
    {item.value>0&&<div style={{fontSize:10,fontWeight:950,color:C.expense,marginTop:1}}>{percent}%</div>}
  </button>);
}

const MoneyArrowBtn={width:36,height:36,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",display:"grid",placeItems:"center",cursor:"pointer"};
const MoneyActionRed={height:62,borderRadius:18,border:"none",background:C.expense,color:"#fff",boxShadow:"0 8px 20px rgba(239,83,80,0.28)",fontSize:12,fontWeight:950,textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,cursor:"pointer"};
const MoneyActionGreen={...MoneyActionRed,background:C.income,boxShadow:"0 8px 20px rgba(67,160,71,0.28)"};
const MoneyActionBlue={...MoneyActionRed,background:C.xfer,boxShadow:"0 8px 20px rgba(79,125,212,0.22)"};
const NoticeCard={background:"#FFF8E1",border:"1px solid #F6E2A5",borderRadius:18,padding:"10px 12px",display:"flex",alignItems:"center",gap:10};
const NoticeBtn={background:C.gold,border:"none",borderRadius:999,padding:"7px 11px",fontSize:11,fontWeight:950,color:"#fff",cursor:"pointer"};

function PeriodPicker({period,setPeriod}){
  const[open,setOpen]=useState(false);
  const[cs,setCs]=useState(period.start||today());
  const[ce,setCe]=useState(period.end||today());
  const pick=p=>{setPeriod(p);setOpen(false);};
  return(<>
    <button onClick={()=>setOpen(true)} style={{border:"none",background:"rgba(255,255,255,0.18)",color:"#fff",borderRadius:999,padding:"9px 16px",fontSize:13,fontWeight:900,cursor:"pointer",minWidth:150,boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.18)"}}>{periodLabel(period)}</button>
    {open&&<Sheet close={()=>setOpen(false)} title="Select period">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <button onClick={()=>pick({kind:"today"})} style={PeriodBtn}>Today</button>
        <button onClick={()=>pick({kind:"week",start:startOfWeek()})} style={PeriodBtn}>This week</button>
        <button onClick={()=>pick({kind:"month",month:curMo()})} style={PeriodBtn}>This month</button>
        <button onClick={()=>pick({kind:"year",year:currentYear()})} style={PeriodBtn}>This year</button>
        <button onClick={()=>pick({kind:"all"})} style={{...PeriodBtn,gridColumn:"1 / -1"}}>All time</button>
      </div>
      <div style={{background:C.bg,borderRadius:14,padding:12}}>
        <L>Custom range</L>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <input type="date" style={{...F,marginBottom:0}} value={cs} onChange={e=>setCs(e.target.value)}/>
          <input type="date" style={{...F,marginBottom:0}} value={ce} onChange={e=>setCe(e.target.value)}/>
        </div>
        <button onClick={()=>pick({kind:"custom",start:cs,end:ce})} style={{...SB,marginTop:10}}>Apply custom range</button>
      </div>
    </Sheet>}
  </>);
}

function CategoryCircle({name,value,color,onClick}){
  return(<button onClick={onClick} style={{background:"transparent",border:"none",padding:0,cursor:"pointer",textAlign:"center",minWidth:0}}>
    <div style={{width:62,height:62,borderRadius:"50%",margin:"0 auto 6px",display:"grid",placeItems:"center",background:`${color}18`,border:`1px solid ${color}33`,boxShadow:"0 3px 10px rgba(13,27,42,0.05)"}}><span style={{fontSize:25}}>{CAT_EMOJI[name]||"📌"}</span></div>
    <div style={{fontSize:11,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
    <div style={{fontSize:11,fontWeight:800,color:C.expense,marginTop:2}}>{inr(value)}</div>
  </button>);
}

function MiniStat({label,value,color,bg}){
  return(<div style={{background:bg,borderRadius:14,padding:"10px 6px",textAlign:"center",minWidth:0}}>
    <div style={{fontSize:10,color:C.muted,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</div>
    <div style={{fontFamily:"Fraunces,Georgia,serif",fontSize:15,fontWeight:900,color,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
  </div>);
}

function PlannedPaymentsCard({planned,markPaid,delRec}){
  if(!planned.length)return null;
  const groups=[
    ["overdue","Overdue"],["today","Due today"],["soon","Due this week"],["later","Upcoming later"],["paid","Paid"]
  ].map(([key,label])=>({key,label,rows:planned.filter(r=>r.status.key===key)})).filter(g=>g.rows.length);
  return(<div style={{margin:"12px 16px 0",background:"#FFFBEB",borderRadius:18,padding:"14px 16px",border:"1px solid #FDE68A"}}>
    <Eye style={{color:"#92400E"}}>⏰ Planned this month</Eye>
    {groups.map(g=><div key={g.key} style={{marginTop:10}}>
      <div style={{fontSize:10,fontWeight:900,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{g.label}</div>
      <div style={{display:"grid",gap:7}}>
        {g.rows.slice(0,5).map(r=><div key={r.id} style={{display:"flex",alignItems:"center",gap:8,background:r.status.bg,borderRadius:13,padding:"9px 10px",border:`1px solid ${r.status.tone}22`}}>
          <div style={{fontSize:18}}>{CAT_EMOJI[r.category]||"📌"}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <div style={{fontSize:11,color:C.muted}}>Due {new Date(r.status.due).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"Fraunces,Georgia,serif",fontSize:14,fontWeight:900,color:r.type==="income"?C.income:C.expense}}>{r.type==="income"?"+":"−"}{inr(r.amount)}</div>
            <span style={{display:"inline-block",fontSize:10,fontWeight:900,color:r.status.tone,background:"#fff",borderRadius:999,padding:"2px 7px",marginTop:2}}>{r.status.label}</span>
          </div>
          {r.status.key!=="paid"&&<button onClick={()=>markPaid(r)} style={{background:C.brand,border:"none",borderRadius:10,color:"#fff",fontSize:11,fontWeight:900,padding:"6px 9px",cursor:"pointer"}}>Paid</button>}
          <button onClick={()=>delRec(r.id)} style={IBN}><Trash2 size={13}/></button>
        </div>)}
      </div>
    </div>)}
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CATEGORIES TAB — period grid + category drill-down
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CategoriesTab({data,expCats,setModal}){
  const[period,setPeriod]=useState({kind:"month",month:curMo()});
  const[selected,setSelected]=useState("");
  const txns=useMemo(()=>periodTxns(data.transactions,period),[data.transactions,period]);
  const spend=useMemo(()=>{const m={};txns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[txns]);
  const rows=expCats.map(name=>({name,value:spend[name]||0})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name));
  const pieData=rows.filter(r=>r.value>0);
  const total=pieData.reduce((s,r)=>s+r.value,0);
  const canShift=["month","week","year"].includes(period.kind||"month");
  if(selected){
    const catTxns=txns.filter(t=>t.type==="expense"&&t.category===selected).sort((a,b)=>b.date.localeCompare(a.date));
    return(<div style={{padding:"52px 16px 0"}}>
      <button onClick={()=>setSelected("")} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:14}}><ArrowLeft size={16}/> Categories</button>
      <div style={{background:C.card,borderRadius:22,padding:18,boxShadow:"0 4px 18px rgba(13,27,42,0.06)",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{width:58,height:58,borderRadius:"50%",background:C.softExpense,display:"grid",placeItems:"center",fontSize:26}}>{CAT_EMOJI[selected]||"📌"}</div><div style={{flex:1}}><h2 style={{...H2,marginBottom:2}}>{selected}</h2><div style={{fontFamily:"Fraunces,Georgia,serif",fontSize:24,fontWeight:800,color:C.expense}}>{inr(spend[selected]||0)}</div><div style={{fontSize:12,color:C.muted}}>{periodLabel(period)} · {catTxns.length} entr{catTxns.length===1?"y":"ies"}</div></div></div>
        <button onClick={()=>setModal("quickadd",{cat:selected,kind:"expense"})} style={{...SB,background:C.expense,marginTop:14}}>Add {selected} expense</button>
      </div>
      <div style={{display:"grid",gap:8}}>{catTxns.length===0?<div style={{background:C.card,borderRadius:14,padding:22,textAlign:"center",color:C.muted,fontSize:13}}>No transactions for this category in the selected period.</div>:catTxns.map(t=><div key={t.id} style={{background:C.card,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 1px 6px rgba(13,27,42,0.05)"}}><span style={{fontSize:20}}>{CAT_EMOJI[t.category]||"📌"}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note||t.desc||t.category}</div><div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} · {data.accounts.find(a=>a.id===t.accountId)?.name||"Account"}</div></div><div style={{fontFamily:"Fraunces,Georgia,serif",fontSize:15,fontWeight:800,color:C.expense}}>−{inr(t.amount)}</div></div>)}</div>
    </div>);
  }
  return(<div style={{padding:"52px 16px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={H2}>Categories</h2><PeriodPicker period={period} setPeriod={setPeriod}/></div>
    {canShift&&<div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:12}}><button onClick={()=>setPeriod(shiftPeriod(period,-1))} style={SoftRoundBtn}><ChevronLeft size={16}/></button><button onClick={()=>setPeriod(shiftPeriod(period,1))} style={SoftRoundBtn}><ChevronRight size={16}/></button></div>}
    <Card>
      <Eye>{periodLabel(period)} spending</Eye>
      {pieData.length>0?<div style={{position:"relative"}}><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={62} outerRadius={96} paddingAngle={3}>{pieData.map((_,i)=><Cell key={i} fill={C.charts[i%C.charts.length]}/>)}</Pie><Tooltip formatter={v=>inr(v)} contentStyle={{borderRadius:12,border:`1px solid ${C.border}`,fontSize:12}}/></PieChart></ResponsiveContainer><div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}><div style={{textAlign:"center"}}><div style={{fontFamily:"Fraunces,Georgia,serif",fontSize:24,fontWeight:800,color:C.expense}}>{inr(total)}</div><div style={{fontSize:10,color:C.muted,letterSpacing:"0.09em",fontWeight:800}}>TOTAL</div></div></div></div>:<div style={{textAlign:"center",padding:"28px 0",color:C.muted}}>No category spending in this period.</div>}
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:14,marginBottom:24}}>
      {rows.map((r,i)=><button key={r.name} onClick={()=>setSelected(r.name)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:"12px 6px",cursor:"pointer",boxShadow:"0 2px 10px rgba(13,27,42,0.04)",minWidth:0}}><div style={{width:48,height:48,borderRadius:"50%",background:`${C.charts[i%C.charts.length]}18`,border:`1px solid ${C.charts[i%C.charts.length]}33`,display:"grid",placeItems:"center",fontSize:22,margin:"0 auto 7px"}}>{CAT_EMOJI[r.name]||"📌"}</div><div style={{fontSize:10,fontWeight:800,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div><div style={{fontSize:10,fontWeight:800,color:r.value?C.expense:C.muted,marginTop:2}}>{inr(r.value)}</div></button>)}
    </div>
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ENTRIES TAB — search & filter
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EntriesTab({data,delTxn,addRec,markPaid,delRec,exportCSV,expCats,setModal}){
  const[month,setMonth]=useState(curMo());
  const[search,setSearch]=useState("");
  const[fCat,setFCat]=useState("");
  const[fAcc,setFAcc]=useState("");
  const[showFilters,setShowFilters]=useState(false);
  const monthTxns=data.transactions.filter(t=>mkKey(t.date)===month).sort((a,b)=>b.date.localeCompare(a.date));
  const filtered=monthTxns.filter(t=>{
    if(search){const q=search.toLowerCase();if(!t.note?.toLowerCase().includes(q)&&!t.category?.toLowerCase().includes(q)&&!t.desc?.toLowerCase().includes(q))return false;}
    if(fCat&&t.category!==fCat)return false;
    if(fAcc&&t.accountId!==fAcc)return false;
    return true;
  });
  const pending=data.recurring.filter(r=>r.lastDone!==curMo());
  return(
    <div style={{padding:"52px 16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h2 style={H2}>Entries</h2>
        <div style={{display:"flex",gap:6}}>
          <Pill onClick={()=>setModal("import")}><FileUp size={13}/> Import</Pill>
          {data.transactions.length>0&&<Pill onClick={exportCSV}><Download size={13}/> Export</Pill>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
        <Nbtn onClick={()=>setMonth(prevMo(month))}><ChevronLeft size={18}/></Nbtn>
        <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{monthLabel(month)}</span>
        <Nbtn onClick={()=>setMonth(nextMo(month))}><ChevronRight size={18}/></Nbtn>
      </div>
      {/* Search bar */}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <div style={{flex:1,position:"relative"}}>
          <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search transactions…" style={{...F,marginBottom:0,paddingLeft:34}}/>
        </div>
        <button onClick={()=>setShowFilters(!showFilters)} style={{background:showFilters?C.brandDim:C.card,border:`1px solid ${showFilters?C.brand:C.border}`,borderRadius:10,padding:"0 14px",color:showFilters?C.brand:C.muted,cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontWeight:600,fontSize:12}}>
          <Filter size={13}/> Filter
        </button>
      </div>
      {showFilters&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <select style={{...F,marginBottom:0,fontSize:12}} value={fCat} onChange={e=>setFCat(e.target.value)}>
          <option value="">All categories</option>
          {[...EXPENSE_CATS,...data.customCats.expense].map(c=><option key={c}>{c}</option>)}
        </select>
        <select style={{...F,marginBottom:0,fontSize:12}} value={fAcc} onChange={e=>setFAcc(e.target.value)}>
          <option value="">All accounts</option>
          {data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>}
      {/* Tax summary shortcut */}
      <div style={{marginBottom:10}}>
        <button onClick={()=>setModal("settings")} style={{background:"none",border:"none",fontSize:12,color:C.brand,cursor:"pointer",fontWeight:600,padding:0}}>📊 View tax / FY summary →</button>
      </div>
      {pending.length>0&&<div style={{background:"#FFFBEB",borderRadius:14,padding:"12px 14px",marginBottom:12,border:"1px solid #FDE68A"}}>
        <Eye style={{color:"#92400E"}}>⏰ Planned</Eye>
        {pending.map(r=>(<div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>Day {r.day} · {data.accounts.find(a=>a.id===r.accountId)?.name}</div></div><span style={{fontSize:13,fontWeight:700,color:r.type==="income"?C.income:C.expense}}>{r.type==="income"?"+":"−"}{inr(r.amount)}</span><button onClick={()=>markPaid(r)} style={{background:C.brand,border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,padding:"4px 10px",cursor:"pointer"}}>Paid</button><button onClick={()=>delRec(r.id)} style={IBN}><Trash2 size={13}/></button></div>))}
      </div>}
      {filtered.length===0&&<div style={{background:C.card,borderRadius:14,padding:24,textAlign:"center",color:C.muted}}>{search||fCat||fAcc?"No transactions match your filter.":"No entries for "+monthLabel(month)+"."}</div>}
      <div style={{display:"grid",gap:8}}>
        {filtered.map(t=>{
          const acc=data.accounts.find(a=>a.id===t.accountId),toAcc=data.accounts.find(a=>a.id===t.toAccountId);
          const isInc=t.type==="income",isXfer=t.type==="transfer";
          return(<div key={t.id} style={{background:C.card,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <div style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",flexShrink:0,fontSize:18,background:isXfer?"#EEF3FF":isInc?C.brandDim:"#FFEEEE"}}>{isXfer?"↔️":CAT_EMOJI[t.category]||"📌"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isXfer?`${acc?.name||"?"}→${toAcc?.name||"?"}`:t.category}{t.recurring?" 🔁":""}</div>
              <div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{!isXfer&&acc?` · ${acc.name}`:""}{t.note?` · ${t.note}`:""}</div>
            </div>
            <div style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:700,color:isInc?C.income:isXfer?C.xfer:C.expense,flexShrink:0}}>{isInc?"+":isXfer?"":"−"}{inr(t.amount)}</div>
            <button onClick={()=>setModal("edittxn",{txn:t})} style={IBN}><Edit2 size={14}/></button>
            <button onClick={()=>delTxn(t.id)} style={IBN}><Trash2 size={14}/></button>
          </div>);
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACCOUNTS TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AccountsTab({data,balances,netWorth,delAcc,editAcc,editLoan,payLoan,editCC,bankAccounts,setModal}){
  const[detail,setDetail]=useState(null);
  const[range,setRange]=useState("30d");
  const bankAccs=data.accounts.filter(a=>BANK_TYPES.includes(a.type));
  const ccAccs  =data.accounts.filter(a=>a.type==="Credit Card");
  const loanAccs=data.accounts.filter(a=>a.type==="Loan");

  if(detail){
    const cutoff=range==="30d"?daysBefore(today(),30):range==="3m"?daysBefore(today(),90):range==="6m"?daysBefore(today(),180):"0000-00-00";
    const txns=data.transactions.filter(t=>(t.accountId===detail.id||t.toAccountId===detail.id)&&t.date>=cutoff).sort((a,b)=>b.date.localeCompare(a.date));
    return(<div style={{padding:"52px 16px 0"}}>
      <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
      <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:20,marginBottom:14,color:"#fff"}}>
        <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>{detail.type}{detail.hint?` · ••••${detail.hint}`:""}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,margin:"6px 0"}}>{detail.name}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,color:(balances[detail.id]||0)<0?C.expense:C.brand}}>{inr(balances[detail.id])}</div>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button onClick={()=>setModal("editacc",{account:detail})} style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Edit2 size={14}/> Edit</button>
          <button onClick={()=>{if(window.confirm("Delete?"))delAcc(detail.id);setDetail(null);}} style={{flex:1,background:"rgba(255,90,95,0.2)",border:"1px solid rgba(255,90,95,0.3)",borderRadius:10,padding:"8px 0",color:"#FF5A5F",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Trash2 size={14}/> Delete</button>
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[["30d","30 days"],["3m","3 months"],["6m","6 months"],["all","All time"]].map(([v,l])=>(
          <button key={v} onClick={()=>setRange(v)} style={{flex:1,padding:"7px 0",borderRadius:8,border:`1px solid ${range===v?C.brand:C.border}`,background:range===v?C.brandDim:"#fff",color:range===v?C.brand:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>
        ))}
      </div>
      {txns.length===0&&<div style={{background:C.card,borderRadius:14,padding:20,textAlign:"center",color:C.muted}}>No transactions in this period.</div>}
      <div style={{display:"grid",gap:8}}>
        {txns.map(t=>{const isInc=t.type==="income"||(t.type==="transfer"&&t.toAccountId===detail.id);const fromA=data.accounts.find(a=>a.id===t.accountId),toA=data.accounts.find(a=>a.id===t.toAccountId);
          return(<div key={t.id} style={{background:C.card,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
            <div style={{width:34,height:34,borderRadius:10,display:"grid",placeItems:"center",fontSize:16,background:isInc?C.brandDim:"#FFEEEE",flexShrink:0}}>{t.type==="transfer"?"↔️":CAT_EMOJI[t.category]||"📌"}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.type==="transfer"?`${t.toAccountId===detail.id?`From ${fromA?.name}`:`To ${toA?.name}`}`:t.category}</div><div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"})}{t.note?` · ${t.note}`:""}</div></div>
            <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:isInc?C.income:C.expense,flexShrink:0}}>{isInc?"+":"−"}{inr(t.amount)}</div>
          </div>);
        })}
      </div>
    </div>);
  }

  const SH=({children})=><div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:18,marginBottom:10,paddingLeft:2}}>{children}</div>;
  return(<div style={{padding:"52px 16px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <h2 style={H2}>Accounts</h2>
      <div style={{display:"flex",gap:6}}>
        <Pbtn onClick={()=>setModal("account")} style={{fontSize:11,padding:"6px 10px"}}><Plus size={12}/> Account</Pbtn>
        <Pbtn onClick={()=>setModal("credit")} style={{fontSize:11,padding:"6px 10px",background:C.xfer}}><Plus size={12}/> Credit</Pbtn>
        <Pbtn onClick={()=>setModal("loan")} style={{fontSize:11,padding:"6px 10px",background:C.expense}}><Plus size={12}/> Loan</Pbtn>
      </div>
    </div>
    <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:"16px 20px",marginBottom:4}}>
      <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase",letterSpacing:"0.08em"}}>Net Worth (assets − liabilities)</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,color:netWorth<0?C.expense:"#fff",marginTop:6}}>{inr(netWorth)}</div>
    </div>
    {bankAccs.length>0&&<><SH>Bank · UPI · Cash</SH><div style={{display:"grid",gap:10}}>
      {bankAccs.map((a,i)=>(
        <div key={a.id} onClick={()=>setDetail(a)} style={{background:C.card,borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:`4px solid ${C.charts[(i+3)%C.charts.length]}`,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:14,fontWeight:700}}>{a.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{a.type}{a.hint?` · ••••${a.hint}`:""}</div></div>
            <div style={{display:"flex",gap:4}}><button onClick={e=>{e.stopPropagation();setModal("editacc",{account:a});}} style={IBN}><Edit2 size={14}/></button><button onClick={e=>{e.stopPropagation();if(window.confirm("Delete?"))delAcc(a.id);}} style={IBN}><Trash2 size={14}/></button></div>
          </div>
          <div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:(balances[a.id]||0)<0?C.expense:C.ink,marginTop:10}}>{inr(balances[a.id])}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:6}}>Tap → transactions</div>
        </div>
      ))}
    </div></>}
    {ccAccs.length>0&&<><SH>Credit Cards</SH><div style={{display:"grid",gap:10}}>
      {ccAccs.map(a=>{
        const used=Math.abs(balances[a.id]||0),lim=a.creditLimit||0,util=lim>0?Math.min(100,used/lim*100):0;
        const col=util<20?C.brand:util<50?C.gold:C.expense;
        const todayN=new Date().getDate(),dueIn=a.dueDay?a.dueDay>=todayN?a.dueDay-todayN:30-todayN+a.dueDay:null;
        return(<div key={a.id} style={{background:C.card,borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:`4px solid ${C.xfer}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontSize:14,fontWeight:700}}>{a.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{a.ccType||"Credit Card"}{dueIn!==null&&<span style={{color:dueIn<=3?C.expense:C.muted,fontWeight:600}}> · Due in {dueIn} days</span>}</div></div>
            <div style={{display:"flex",gap:4}}><button onClick={()=>setModal("editcc",{account:a})} style={IBN}><Edit2 size={14}/></button><button onClick={()=>{if(window.confirm("Delete?"))delAcc(a.id);}} style={IBN}><Trash2 size={14}/></button></div>
          </div>
          <div style={{marginTop:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:col,fontWeight:600}}>Used {inr(used)} · {Math.round(util)}%</span><span style={{color:C.muted}}>Limit {inr(lim)}</span></div>
            <div style={{height:14,background:"#EEF3FF",borderRadius:7,overflow:"visible",position:"relative"}}>
              <div style={{width:`${util}%`,height:"100%",background:col,borderRadius:7,transition:"width .4s"}}/>
              <div style={{position:"absolute",left:"20%",top:-3,bottom:-3,width:2,background:C.ink,borderRadius:1,opacity:0.5}}/>
              <div style={{position:"absolute",left:"20%",top:-16,fontSize:8,color:C.ink,fontWeight:700,transform:"translateX(-50%)",opacity:0.5,whiteSpace:"nowrap"}}>20%</div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginTop:8}}>
              <span style={{color:util<20?C.brand:util<50?C.gold:C.expense,fontWeight:600}}>{util<20?"✓ Healthy utilisation":util<50?"⚠ Above 20% mark":"🔴 High utilisation"}</span>
              <span>Available {inr(Math.max(0,lim-used))}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setModal("paycc",{cc:a})} style={{flex:1,background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:"8px 0",color:C.brand,fontWeight:700,fontSize:13,cursor:"pointer"}}>💳 Pay Bill</button>
            <button onClick={()=>setModal("editcc",{account:a})} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 0",color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>Update</button>
          </div>
        </div>);
      })}
    </div></>}
    {loanAccs.length>0&&<><SH>Loans</SH><div style={{display:"grid",gap:10}}>
      {loanAccs.map(a=>{const paid=Math.max(0,(a.sanctionedAmount||0)-(a.outstandingAmount||0));const pct=a.sanctionedAmount?Math.min(100,paid/a.sanctionedAmount*100):0;
        return(<div key={a.id} style={{background:C.card,borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",borderLeft:"4px solid #FF5A5F"}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontSize:14,fontWeight:700}}>{a.name}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{a.loanType||"Loan"}</div></div>
            <div style={{display:"flex",gap:4}}><button onClick={()=>setModal("editloan",{account:a})} style={IBN}><Edit2 size={14}/></button><button onClick={()=>{if(window.confirm("Delete?"))delAcc(a.id);}} style={IBN}><Trash2 size={14}/></button></div>
          </div>
          <div style={{marginTop:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span style={{color:C.brand,fontWeight:600}}>Paid {inr(paid)}</span><span style={{color:C.muted}}>Total {inr(a.sanctionedAmount||0)}</span></div>
            <div style={{height:14,background:"#FFE8E8",borderRadius:7,overflow:"hidden",position:"relative"}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${C.brand},#00A07A)`,borderRadius:7,transition:"width .4s"}}/><span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:9,fontWeight:700,color:pct>55?"#fff":C.expense}}>{Math.round(pct)}% paid</span></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:6}}><span style={{color:C.muted}}>Outstanding</span><span style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:C.expense}}>−{inr(a.outstandingAmount||0)}</span></div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={()=>setModal("payloan",{loan:a})} style={{flex:1,background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:"8px 0",color:C.brand,fontWeight:700,fontSize:13,cursor:"pointer"}}>💳 Pay EMI</button>
            <button onClick={()=>setModal("editloan",{account:a})} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 0",color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>Update Balance</button>
          </div>
        </div>);
      })}
    </div></>}
    {data.accounts.length===0&&<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🏦</div>Add accounts to get started.</div>}
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BUDGETS TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function BudgetsTab({data,delBudget,setModal}){
  const[month,setMonth]=useState(curMo());
  const[detail,setDetail]=useState(null);
  const monthTxns=data.transactions.filter(t=>mkKey(t.date)===month);
  const catSpend=useMemo(()=>{const m={};monthTxns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[monthTxns]);
  if(detail){
    const txns=monthTxns.filter(t=>t.category===detail.cat&&t.type==="expense").sort((a,b)=>b.date.localeCompare(a.date));
    const spent=catSpend[detail.cat]||0,pct=Math.min(100,spent/detail.limit*100),over=spent>detail.limit;
    return(<div style={{padding:"52px 16px 0"}}>
      <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
      <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><span style={{fontSize:36}}>{CAT_EMOJI[detail.cat]||"📌"}</span><div><div style={{fontSize:18,fontWeight:700}}>{detail.cat}</div><div style={{fontSize:13,color:C.muted}}>{monthLabel(month)}</div></div></div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div><div style={{fontSize:11,color:C.muted}}>Spent</div><div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:over?C.expense:C.ink}}>{inr(spent)}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.muted}}>Budget</div><div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:C.muted}}>{inr(detail.limit)}</div></div></div>
        <div style={{height:10,background:C.bg,borderRadius:5}}><div style={{width:`${pct}%`,height:"100%",background:over?C.expense:pct>80?C.gold:C.brand,borderRadius:5}}/></div>
        <div style={{fontSize:12,color:over?C.expense:C.brand,fontWeight:600,marginTop:8}}>{over?`Over by ${inr(spent-detail.limit)}`:`${inr(detail.limit-spent)} remaining`}</div>
      </div>
      <Eye>Transactions</Eye>
      <div style={{display:"grid",gap:8,marginTop:8}}>
        {txns.map(t=><div key={t.id} style={{background:C.card,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{t.note||t.category}</div><div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{data.accounts.find(a=>a.id===t.accountId)?` · ${data.accounts.find(a=>a.id===t.accountId).name}`:""}</div></div>
          <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:C.expense}}>−{inr(t.amount)}</div>
        </div>)}
      </div>
    </div>);
  }
  return(<div style={{padding:"52px 16px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><h2 style={H2}>Budgets</h2><Pbtn onClick={()=>setModal("budget")}><Plus size={15}/> Add</Pbtn></div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
      <Nbtn onClick={()=>setMonth(prevMo(month))}><ChevronLeft size={18}/></Nbtn>
      <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{monthLabel(month)}</span>
      <Nbtn onClick={()=>setMonth(nextMo(month))}><ChevronRight size={18}/></Nbtn>
    </div>
    {Object.keys(data.budgets).length===0&&<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🎯</div>Set monthly limits per category.</div>}
    <div style={{display:"grid",gap:12}}>
      {Object.entries(data.budgets).map(([cat,limit])=>{const spent=catSpend[cat]||0,pct=Math.min(100,spent/limit*100),over=spent>limit;
        return(<div key={cat} onClick={()=>setDetail({cat,limit})} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:24}}>{CAT_EMOJI[cat]||"📌"}</span><div><div style={{fontSize:14,fontWeight:700}}>{cat}</div><div style={{fontSize:11,color:C.muted}}>{inr(spent)} of {inr(limit)}</div></div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:over?C.expense:pct>80?C.gold:C.brand}}>{Math.round(pct)}%</div>{over&&<div style={{fontSize:10,color:C.expense,fontWeight:600}}>+{inr(spent-limit)}</div>}</div>
          </div>
          <div style={{height:8,background:C.bg,borderRadius:4}}><div style={{width:`${pct}%`,height:"100%",background:over?C.expense:pct>80?C.gold:C.brand,borderRadius:4}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}><span style={{fontSize:11,color:over?C.expense:C.muted,fontWeight:600}}>{over?`Over by ${inr(spent-limit)}`:`${inr(limit-spent)} left`}</span><button onClick={e=>{e.stopPropagation();delBudget(cat);}} style={{...IBN,fontSize:11,color:C.muted}}>Remove</button></div>
        </div>);
      })}
    </div>
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GOALS TAB — with target date
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GoalsTab({data,balances,bankAccounts,delGoal,editGoal,setModal}){
  const[detail,setDetail]=useState(null);
  const getSaved=g=>{if(g.linkType==="account"&&g.linkedAccountId)return balances[g.linkedAccountId]||0;if(g.linkType==="investment")return g.investmentValue||0;return g.saved||0;};
  if(detail){
    const g=data.goals.find(x=>x.id===detail);if(!g){setDetail(null);return null;}
    const saved=getSaved(g),pct=Math.min(100,saved/g.target*100),done=pct>=100;
    const linked=g.linkType==="account"?data.accounts.find(a=>a.id===g.linkedAccountId):null;
    const moLeft=g.targetDate?monthsBetween(today(),g.targetDate):null;
    const moSavNeed=moLeft>0&&!done?Math.ceil((g.target-saved)/moLeft):null;
    const onTrack=moSavNeed?moSavNeed<=(data.transactions.filter(t=>t.type==="income"&&mkKey(t.date)===curMo()).reduce((s,t)=>s+(+t.amount),0)*0.3):null;
    return(<div style={{padding:"52px 16px 0"}}>
      <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
      <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:20,marginBottom:16,color:"#fff"}}>
        <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>{g.linkType==="account"?"Bank Goal":g.linkType==="investment"?g.investmentType:"Savings Goal"}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,margin:"6px 0"}}>{g.name}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,color:done?C.brand:C.gold}}>{inr(saved)}</div>
        <div style={{fontSize:12,color:"#6B9A8A"}}>of {inr(g.target)} target{g.targetDate?` · by ${new Date(g.targetDate).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}`:""}</div>
        <div style={{height:8,background:"rgba(255,255,255,0.1)",borderRadius:4,marginTop:14}}><div style={{width:`${pct}%`,height:"100%",background:done?C.brand:C.gold,borderRadius:4}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:"#6B9A8A"}}><span>{Math.round(pct)}%</span><span>{done?"🎉 Achieved!":inr(g.target-saved)+" to go"}</span></div>
      </div>
      {moSavNeed&&<div style={{background:onTrack?"#E6FBF5":"#FFF8E8",borderRadius:14,padding:14,marginBottom:14,border:`1px solid ${onTrack?C.brand:"#FDE68A"}`}}>
        <div style={{fontSize:12,fontWeight:700,color:onTrack?C.brand:"#92400E"}}>{onTrack?"✓ On track":"⚠ Behind schedule"}</div>
        <div style={{fontSize:13,color:C.ink,marginTop:4}}>Save <b>{inr(moSavNeed)}/month</b> to reach your goal in <b>{moLeft} months</b>.</div>
      </div>}
      {g.linkType==="account"&&linked&&<div style={{background:C.card,borderRadius:14,padding:16,marginBottom:14}}><Eye>Linked account</Eye><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}><div><div style={{fontSize:14,fontWeight:700}}>{linked.name}</div><div style={{fontSize:12,color:C.muted}}>Auto-updates with balance</div></div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.brand}}>{inr(balances[linked.id]||0)}</div></div></div>}
      {g.linkType==="investment"&&<div style={{background:C.card,borderRadius:14,padding:16,marginBottom:14}}><Eye>Investment</Eye><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}><div><div style={{fontSize:14,fontWeight:700}}>{g.investmentType}</div><div style={{fontSize:12,color:C.muted}}>Updated {g.investmentValueDate||"—"}</div></div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.gold}}>{inr(g.investmentValue||0)}</div></div><button onClick={()=>setModal("editgoal",{goal:g})} style={{marginTop:12,display:"flex",alignItems:"center",gap:6,background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:"8px 14px",color:C.brand,fontWeight:700,fontSize:13,cursor:"pointer"}}><RefreshCw size={14}/> Update value</button></div>}
      {g.linkType==="none"&&!done&&<button onClick={()=>{const a=+window.prompt("Amount to add (₹):");if(a>0)editGoal(g.id,{saved:(g.saved||0)+a});}} style={{...SB,marginBottom:14}}>+ Add Money</button>}
      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setModal("editgoal",{goal:g})} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 0",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Edit2 size={14}/> Edit</button>
        <button onClick={()=>{if(window.confirm("Delete goal?"))delGoal(g.id);setDetail(null);}} style={{background:"#FFF0F0",border:`1px solid #FFD0D0`,borderRadius:12,padding:"11px 16px",color:C.expense,fontWeight:700,fontSize:14,cursor:"pointer"}}><Trash2 size={16}/></button>
      </div>
    </div>);
  }
  const totalSaved=data.goals.reduce((s,g)=>s+getSaved(g),0),totalTarget=data.goals.reduce((s,g)=>s+g.target,0);
  return(<div style={{padding:"52px 16px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h2 style={H2}>Goals</h2><Pbtn onClick={()=>setModal("goal")}><Plus size={15}/> New</Pbtn></div>
    {data.goals.length>0&&<div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:16,marginBottom:16}}><div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>Total saved</div><div style={{fontFamily:"Georgia,serif",fontSize:26,fontWeight:700,color:C.brand,marginTop:4}}>{inr(totalSaved)}</div><div style={{height:6,background:"rgba(255,255,255,0.1)",borderRadius:3,marginTop:10}}><div style={{width:`${Math.min(100,totalSaved/totalTarget*100)}%`,height:"100%",background:C.brand,borderRadius:3}}/></div><div style={{fontSize:11,color:"#6B9A8A",marginTop:6}}>{inr(totalTarget-totalSaved)} to go</div></div>}
    {data.goals.length===0&&<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🪙</div>Create savings goals or track investments.</div>}
    <div style={{display:"grid",gap:12}}>
      {data.goals.map(g=>{
        const saved=getSaved(g),pct=Math.min(100,saved/g.target*100),done=pct>=100;
        const linked=g.linkType==="account"?data.accounts.find(a=>a.id===g.linkedAccountId):null;
        const moLeft=g.targetDate?monthsBetween(today(),g.targetDate):null;
        return(<div key={g.id} onClick={()=>setDetail(g.id)} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:done?`1px solid ${C.brand}`:`1px solid ${C.border}`,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div><div style={{fontSize:15,fontWeight:700}}>{done?"🎉 ":""}{g.name}</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{g.linkType==="account"&&linked?`🏦 ${linked.name}`:g.linkType==="investment"?`📈 ${g.investmentType}`:"🪙 Manual"}{moLeft!==null?` · ${moLeft}mo left`:""}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:done?C.brand:C.ink}}>{inr(saved)}</div><div style={{fontSize:11,color:done?C.brand:C.muted,fontWeight:600}}>{Math.round(pct)}% of {inr(g.target)}</div></div>
          </div>
          <div style={{height:8,background:C.bg,borderRadius:4}}><div style={{width:`${pct}%`,height:"100%",background:done?C.brand:g.linkType==="investment"?C.xfer:C.gold,borderRadius:4,transition:"width .4s"}}/></div>
        </div>);
      })}
    </div>
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INSIGHTS TAB — net worth history, spending comparison, tax summary
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function InsightsTab({data,balances}){
  const[fy,setFy]=useState(currentFY());

  // Net worth history (12 months)
  const nwHistory=useMemo(()=>{
    const out=[];const now=new Date();
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const endDate=`${mk}-31`;
      const b={};
      data.accounts.forEach(a=>{if(a.type==="Loan")b[a.id]=-(a.outstandingAmount||0);else if(a.type==="Credit Card")b[a.id]=-(a.currentOutstanding||0);else b[a.id]=+a.opening||0;});
      data.transactions.filter(t=>t.date<=endDate).forEach(t=>{const amt=+t.amount||0;if(t.type==="income")b[t.accountId]=(b[t.accountId]||0)+amt;else if(t.type==="expense")b[t.accountId]=(b[t.accountId]||0)-amt;else if(t.type==="transfer"){b[t.accountId]=(b[t.accountId]||0)-amt;if(t.toAccountId)b[t.toAccountId]=(b[t.toAccountId]||0)+amt;}});
      out.push({m:d.toLocaleString("en-IN",{month:"short"}),nw:Object.values(b).reduce((s,v)=>s+v,0)});
    }
    return out;
  },[data]);

  // Month-on-month spending insights
  const thisMk=curMo(),lastMk=prevMo(thisMk);
  const insights=useMemo(()=>{
    const getCatSpend=mk=>{const m={};data.transactions.filter(t=>mkKey(t.date)===mk&&t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;};
    const thisC=getCatSpend(thisMk),lastC=getCatSpend(lastMk);
    const allCats=new Set([...Object.keys(thisC),...Object.keys(lastC)]);
    return[...allCats].map(cat=>{const cur=thisC[cat]||0,prev=lastC[cat]||0;const chg=prev>0?((cur-prev)/prev*100):null;return{cat,cur,prev,chg};}).sort((a,b)=>Math.abs(b.chg||0)-Math.abs(a.chg||0)).slice(0,8);
  },[data,thisMk,lastMk]);

  // Financial year tax summary
  const{start,end}=fyRange(fy);
  const fyTxns=data.transactions.filter(t=>t.date>=start&&t.date<=end);
  const fyInc=fyTxns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const fyExp=fyTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);
  const fyByCat=useMemo(()=>{const m={};fyTxns.filter(t=>t.type==="income").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[fyTxns]);
  const fyExpCat=useMemo(()=>{const m={};fyTxns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[fyTxns]);

  return(<div style={{padding:"52px 16px 0"}}>
    <h2 style={{...H2,marginBottom:14}}>Insights</h2>

    {/* Net Worth History */}
    <Card>
      <Eye>Net Worth — 12 months</Eye>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={nwHistory} margin={{top:4,right:4,left:-10,bottom:0}}>
          <CartesianGrid stroke={C.border} vertical={false}/>
          <XAxis dataKey="m" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:8,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>v>=100000?`${Math.round(v/100000)}L`:v>=1000?`${Math.round(v/1000)}k`:v}/>
          <Tooltip formatter={v=>inr(v)} contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,fontSize:12}}/>
          <Line type="monotone" dataKey="nw" stroke={C.brand} strokeWidth={2.5} dot={false}/>
        </LineChart>
      </ResponsiveContainer>
    </Card>

    {/* Month-on-month */}
    <Card>
      <Eye>{shortMo(thisMk)} vs {shortMo(lastMk)} — spending by category</Eye>
      {insights.length===0?<div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"12px 0"}}>Not enough data yet.</div>:
        insights.map(({cat,cur,prev,chg})=>(
          <div key={cat} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:18,flexShrink:0}}>{CAT_EMOJI[cat]||"📌"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:C.ink}}>{cat}</div>
              <div style={{display:"flex",gap:6,marginTop:3,alignItems:"center"}}>
                <div style={{height:6,flex:1,background:C.bg,borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,cur/(Math.max(cur,prev)||1)*100)}%`,background:C.expense,borderRadius:3}}/>
                </div>
                <span style={{fontSize:11,color:C.expense,fontWeight:600,flexShrink:0}}>{inr(cur)}</span>
              </div>
            </div>
            {chg!==null&&<div style={{fontSize:12,fontWeight:700,color:chg>0?C.expense:C.brand,flexShrink:0,minWidth:50,textAlign:"right"}}>{chg>0?"↑":"↓"}{Math.abs(Math.round(chg))}%</div>}
            {chg===null&&<div style={{fontSize:11,color:C.muted,flexShrink:0}}>New</div>}
          </div>
        ))
      }
    </Card>

    {/* Tax Summary */}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <Eye style={{marginBottom:0}}>Tax Summary</Eye>
        <div style={{display:"flex",gap:6}}>
          {[fy-1,fy].map(y=><button key={y} onClick={()=>setFy(y)} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${fy===y?C.brand:C.border}`,background:fy===y?C.brandDim:"#fff",color:fy===y?C.brand:C.muted,fontSize:11,fontWeight:700,cursor:"pointer"}}>FY {y}-{y+1}</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div style={{background:C.brandDim,borderRadius:12,padding:12}}><div style={{fontSize:11,color:C.muted}}>Total Income</div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.income,marginTop:4}}>{inr(fyInc)}</div></div>
        <div style={{background:"#FFEEEE",borderRadius:12,padding:12}}><div style={{fontSize:11,color:C.muted}}>Total Expense</div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.expense,marginTop:4}}>{inr(fyExp)}</div></div>
        <div style={{background:C.bg,borderRadius:12,padding:12}}><div style={{fontSize:11,color:C.muted}}>Net Savings</div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:(fyInc-fyExp)>=0?C.brand:C.expense,marginTop:4}}>{inr(fyInc-fyExp)}</div></div>
        <div style={{background:C.bg,borderRadius:12,padding:12}}><div style={{fontSize:11,color:C.muted}}>Savings Rate</div><div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.ink,marginTop:4}}>{fyInc>0?Math.round((fyInc-fyExp)/fyInc*100):0}%</div></div>
      </div>
      {Object.keys(fyByCat).length>0&&<><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:8}}>INCOME BY SOURCE</div>
        {Object.entries(fyByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
          <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14}}>{CAT_EMOJI[cat]||"💰"}</span><span style={{fontSize:12,color:C.ink}}>{cat}</span></div><span style={{fontSize:13,fontWeight:600,color:C.income}}>{inr(amt)}</span></div>
        ))}</>}
      <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
        <button onClick={()=>{const head="Type,Category,Date,Amount\n";const rows=fyTxns.map(t=>[t.type,t.category,t.date,t.amount].join(",")).join("\n");const url=URL.createObjectURL(new Blob([head+rows],{type:"text/csv"}));const a=document.createElement("a");a.href=url;a.download=`tax-summary-FY${fy}-${fy+1}.csv`;a.click();URL.revokeObjectURL(url);}} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:`1px dashed ${C.border}`,borderRadius:10,padding:"8px 14px",color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}><Download size={13}/> Export FY {fy}-{fy+1} CSV</button>
      </div>
    </Card>
  </div>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODALS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function QuickAddModal({close,data,addTxn,cat,kind="expense",expCats=EXPENSE_CATS,incCats=INCOME_CATS}){
  const cats=kind==="income"?incCats:expCats;
  const[chosenCat,setChosenCat]=useState(cat||cats[0]);
  const[amt,setAmt]=useState(""), [accId,setAccId]=useState(data.accounts.filter(a=>!["Loan"].includes(a.type))[0]?.id||"");
  const p=evalExpr(amt);
  const isIncome=kind==="income";
  return(<Sheet close={close}><div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:42}}>{isIncome?"💰":CAT_EMOJI[chosenCat]||"📌"}</div><div style={{fontSize:18,fontWeight:800,marginTop:6}}>{isIncome?"Quick Income":chosenCat}</div></div>
    <L>Amount (₹)</L><input autoFocus style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"/>
    {/[+\-*/]/.test(String(amt).slice(1))&&!isNaN(p)&&<div style={{fontSize:12,color:C.brand,marginTop:-8,marginBottom:10,fontWeight:700}}>= {inr(p)}</div>}
    <L>Category</L><select style={F} value={chosenCat} onChange={e=>setChosenCat(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select>
    <L>Account</L><select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{data.accounts.filter(a=>a.type!=="Loan").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
      <button onClick={close} style={{padding:"12px 0",borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,fontWeight:800,fontSize:14,cursor:"pointer"}}>Cancel</button>
      <button onClick={()=>{const a=evalExpr(amt);if(!a||a<=0||!accId)return;addTxn({type:kind,amount:a,category:chosenCat,accountId:accId,date:today(),note:""});close();}} style={{padding:"12px 0",borderRadius:12,border:"none",background:isIncome?C.income:C.expense,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>Add</button>
    </div>
  </Sheet>);
}
/* Quick cash entry */
function QuickCashModal({close,data,addTxn,expCats}){
  const cash=data.accounts.find(a=>a.type==="Cash");
  const[amt,setAmt]=useState("");const[cat,setCat]=useState(expCats[0]);const[note,setNote]=useState("");
  const p=evalExpr(amt);
  return(<Sheet close={close} title="💵 Cash Expense">
    {!cash&&<p style={{color:C.expense,fontSize:13}}>No Cash account found. Add one in Accounts first.</p>}
    {cash&&<><div style={{background:"#F0F9F5",borderRadius:10,padding:10,marginBottom:14,fontSize:13,color:C.brand,fontWeight:600}}>From: {cash.name}</div>
      <L>Amount (₹)</L><input autoFocus style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"/>
      {/[+\-*/]/.test(String(amt).slice(1))&&!isNaN(p)&&<div style={{fontSize:12,color:C.brand,marginTop:-8,marginBottom:10,fontWeight:600}}>= {inr(p)}</div>}
      <L>Category</L><select style={F} value={cat} onChange={e=>setCat(e.target.value)}>{expCats.map(c=><option key={c}>{c}</option>)}</select>
      <L>Note (optional)</L><input style={F} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. auto fare"/>
      <button onClick={()=>{const a=evalExpr(amt);if(!a||a<=0)return;addTxn({type:"expense",amount:a,category:cat,accountId:cash.id,date:today(),note});close();}} style={SB}>Add Cash Entry</button>
    </>}
  </Sheet>);
}

/* Main transaction modal — with split support */
function TxnModal({close,data,addTxn,addTxns,addRec,expCats,incCats,addCat,preset}){
  const[tp,setTp]=useState(preset?.entryType||"expense");
  const[amt,setAmt]=useState("");
  const[cat,setCat]=useState(preset?.cat||((preset?.entryType||"expense")==="income"?incCats[0]:expCats[0]));
  const nonLoan=data.accounts.filter(a=>a.type!=="Loan");
  const[accId,setAccId]=useState(nonLoan[0]?.id||"");
  const[toId,setToId]=useState(data.accounts[1]?.id||data.accounts[0]?.id||"");
  const[date,setDate]=useState(today());
  const[note,setNote]=useState("");
  const[rep,setRep]=useState(false);
  const[newCat,setNewCat]=useState(""),  [showNC,setShowNC]=useState(false);
  const[isSplit,setIsSplit]=useState(false);
  const[splits,setSplits]=useState([{cat:expCats[0],amt:""},{cat:expCats[1]||expCats[0],amt:""}]);
  const cats=tp==="income"?incCats:expCats;
  const p=evalExpr(amt);
  const splitTotal=splits.reduce((s,sp)=>s+(evalExpr(sp.amt)||0),0);
  const mainAmt=evalExpr(amt);
  const splitOk=isSplit&&!isNaN(mainAmt)&&mainAmt>0&&Math.abs(splitTotal-mainAmt)<0.01;

  const go=()=>{
    if(!accId)return;
    if(isSplit){
      if(!splitOk)return;
      const txns=splits.filter(sp=>evalExpr(sp.amt)>0).map(sp=>({type:"expense",amount:evalExpr(sp.amt),category:sp.cat,accountId:accId,date,note,id:uid()}));
      addTxns(txns);
    }else{
      const a=evalExpr(amt);if(!a||a<=0)return;
      addTxn({type:tp,amount:a,category:tp==="transfer"?"Transfer":cat,accountId:accId,toAccountId:tp==="transfer"?toId:undefined,date,note});
      if(rep&&tp!=="transfer")addRec({name:note||cat,type:tp,amount:a,category:cat,accountId:accId,day:+date.slice(8,10)||1});
    }
    close();
  };

  return(<Sheet close={close} title="New Entry">
    {!isSplit&&<div style={{display:"flex",gap:6,marginBottom:14}}>
      {["expense","income","transfer"].map(t=><button key={t} onClick={()=>{setTp(t);setCat(t==="income"?incCats[0]:expCats[0]);}} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${tp===t?C.brand:C.border}`,background:tp===t?C.brandDim:"#fff",color:tp===t?C.brand:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>)}
    </div>}
    <L>Total amount (₹)</L>
    <input style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0  or  200+150"/>
    {/[+\-*/]/.test(String(amt).slice(1))&&!isNaN(p)&&<div style={{fontSize:12,color:C.brand,marginTop:-8,marginBottom:10,fontWeight:600}}>= {inr(p)}</div>}
    {tp==="expense"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}><input type="checkbox" checked={isSplit} onChange={e=>setIsSplit(e.target.checked)} style={{width:16,height:16,accentColor:C.brand}}/>Split across multiple categories</label>}
    {isSplit&&<>
      <div style={{background:C.bg,borderRadius:12,padding:12,marginBottom:12}}>
        {splits.map((sp,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
          <select value={sp.cat} onChange={e=>setSplits(splits.map((s,j)=>j===i?{...s,cat:e.target.value}:s))} style={{...F,marginBottom:0,flex:2,padding:"8px 10px",fontSize:12}}>
            {expCats.map(c=><option key={c}>{c}</option>)}
          </select>
          <input value={sp.amt} onChange={e=>setSplits(splits.map((s,j)=>j===i?{...s,amt:e.target.value}:s))} style={{...F,marginBottom:0,flex:1,padding:"8px 10px",fontSize:12}} inputMode="decimal" placeholder="₹0"/>
          {splits.length>2&&<button onClick={()=>setSplits(splits.filter((_,j)=>j!==i))} style={IBN}><Trash2 size={14}/></button>}
        </div>)}
        <button onClick={()=>setSplits([...splits,{cat:expCats[0],amt:""}])} style={{fontSize:12,color:C.brand,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>+ Add line</button>
        <div style={{fontSize:11,color:splitOk?C.brand:C.muted,marginTop:6,fontWeight:600}}>Split total: {inr(splitTotal)} {splitOk?"✓ Matches":"≠ Must match total"}</div>
      </div>
    </>}
    {!isSplit&&tp!=="transfer"&&<><L>Category</L><select style={F} value={cat} onChange={e=>e.target.value==="__new"?setShowNC(true):(setCat(e.target.value),setShowNC(false))}>{cats.map(c=><option key={c}>{c}</option>)}<option value="__new">➕ New…</option></select>{showNC&&<div style={{display:"flex",gap:6,marginTop:-8,marginBottom:12}}><input style={{...F,marginBottom:0,flex:1}} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Category name"/><button onClick={()=>{if(newCat.trim()){addCat(tp,newCat);setCat(newCat.trim());setNewCat("");setShowNC(false);}}} style={{background:C.brand,border:"none",borderRadius:10,padding:"0 14px",color:"#fff",fontWeight:700,cursor:"pointer"}}>Add</button></div>}</>}
    <L>{tp==="transfer"?"From":"Account"}</L><select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    {tp==="transfer"&&<><L>To</L><select style={F} value={toId} onChange={e=>setToId(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
    <L>Date</L><input style={F} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
    <L>Note (optional)</L><input style={F} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. groceries"/>
    {!isSplit&&tp!=="transfer"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}><input type="checkbox" checked={rep} onChange={e=>setRep(e.target.checked)} style={{width:16,height:16,accentColor:C.brand}}/>Repeat every month</label>}
    <button onClick={go} style={SB}>{isSplit?`Save ${splits.filter(s=>evalExpr(s.amt)>0).length} entries`:"Save Entry"}</button>
  </Sheet>);
}

function EditTxnModal({close,txn,data,editTxn,addRec,expCats,incCats}){
  const[tp,setTp]=useState(txn.type);const[amt,setAmt]=useState(String(txn.amount));const[cat,setCat]=useState(txn.category);
  const nonLoan=data.accounts.filter(a=>a.type!=="Loan");
  const[accId,setAccId]=useState(txn.accountId);const[toId,setToId]=useState(txn.toAccountId||"");
  const[date,setDate]=useState(txn.date);const[note,setNote]=useState(txn.note||"");const[mkRec,setMkRec]=useState(false);
  const cats=tp==="income"?incCats:expCats;
  const go=()=>{const a=evalExpr(amt);if(!a||a<=0)return;editTxn(txn.id,{type:tp,amount:a,category:tp==="transfer"?"Transfer":cat,accountId:accId,toAccountId:tp==="transfer"?toId:undefined,date,note,recurring:mkRec||txn.recurring});if(mkRec)addRec({name:note||cat,type:tp,amount:a,category:cat,accountId:accId,day:+date.slice(8,10)||1});close();};
  return(<Sheet close={close} title="Edit Entry">
    <div style={{display:"flex",gap:6,marginBottom:14}}>{["expense","income","transfer"].map(t=><button key={t} onClick={()=>setTp(t)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${tp===t?C.brand:C.border}`,background:tp===t?C.brandDim:"#fff",color:tp===t?C.brand:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>)}</div>
    <L>Amount (₹)</L><input style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)}/>
    {tp!=="transfer"&&<><L>Category</L><select style={F} value={cat} onChange={e=>setCat(e.target.value)}>{cats.map(c=><option key={c}>{c}</option>)}</select></>}
    <L>{tp==="transfer"?"From":"Account"}</L><select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    {tp==="transfer"&&<><L>To</L><select style={F} value={toId} onChange={e=>setToId(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>}
    <L>Date</L><input style={F} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
    <L>Note</L><input style={F} value={note} onChange={e=>setNote(e.target.value)}/>
    {!txn.recurring&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}><input type="checkbox" checked={mkRec} onChange={e=>setMkRec(e.target.checked)} style={{width:16,height:16,accentColor:C.brand}}/>🔁 Mark as recurring</label>}
    <button onClick={go} style={SB}>Save Changes</button>
  </Sheet>);
}

function AccountModal({close,addAcc}){
  const[f,setF]=useState({name:"",type:"Bank",opening:"",hint:""});const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="New Account">
    <L>Name</L><input style={F} value={f.name} onChange={s("name")} placeholder="e.g. HDFC Savings"/>
    <L>Type</L><select style={F} value={f.type} onChange={s("type")}>{BANK_TYPES.map(t=><option key={t}>{t}</option>)}</select>
    <L>Current balance (₹)</L><input style={F} type="number" value={f.opening} onChange={s("opening")} placeholder="0"/>
    <L>Last 4 digits (for PDF auto-match)</L><input style={F} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")} placeholder="e.g. 4821"/>
    <button onClick={()=>{if(!f.name)return;addAcc({name:f.name,type:f.type,opening:+f.opening||0,hint:f.hint.trim()});close();}} style={SB}>Save</button>
  </Sheet>);
}

function CreditCardModal({close,addAcc}){
  const[f,setF]=useState({name:"",ccType:CC_TYPES[0],creditLimit:"",currentOutstanding:"",dueDay:"",hint:""});const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="New Credit Card">
    <L>Card name</L><input style={F} value={f.name} onChange={s("name")} placeholder="e.g. HDFC Regalia"/>
    <L>Card type</L><select style={F} value={f.ccType} onChange={s("ccType")}>{CC_TYPES.map(t=><option key={t}>{t}</option>)}</select>
    <L>Credit limit (₹)</L><input style={F} type="number" value={f.creditLimit} onChange={s("creditLimit")} placeholder="100000"/>
    <L>Current outstanding (₹)</L><input style={F} type="number" value={f.currentOutstanding} onChange={s("currentOutstanding")} placeholder="0"/>
    <L>Payment due day (1-31)</L><input style={F} type="number" min="1" max="31" value={f.dueDay} onChange={s("dueDay")} placeholder="e.g. 15 (for 15th of each month)"/>
    <L>Last 4 digits</L><input style={F} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")} placeholder="e.g. 5678"/>
    <button onClick={()=>{if(!f.name||!f.creditLimit)return;addAcc({name:f.name,type:"Credit Card",ccType:f.ccType,creditLimit:+f.creditLimit,currentOutstanding:+f.currentOutstanding||0,dueDay:+f.dueDay||0,opening:0,hint:f.hint.trim()});close();}} style={SB}>Add Credit Card</button>
  </Sheet>);
}

function EditAccModal({close,account,editAcc}){
  const[f,setF]=useState({name:account.name,opening:account.opening||0,hint:account.hint||""});const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="Edit Account">
    <L>Name</L><input style={F} value={f.name} onChange={s("name")}/>
    <L>Opening / base balance (₹)</L><input style={F} type="number" value={f.opening} onChange={s("opening")}/>
    <p style={{fontSize:12,color:C.muted,marginTop:-8}}>Transactions are added on top of this.</p>
    <L>Last 4 digits</L><input style={F} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")}/>
    <button onClick={()=>{if(!f.name)return;editAcc(account.id,{name:f.name,opening:+f.opening||0,hint:f.hint.trim()});close();}} style={SB}>Save</button>
  </Sheet>);
}

function LoanModal({close,addAcc}){
  const[f,setF]=useState({name:"",loanType:LOAN_TYPES[0],sanctioned:"",outstanding:""});const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="Add Loan">
    <L>Loan name</L><input style={F} value={f.name} onChange={s("name")} placeholder="e.g. Home Loan"/>
    <L>Type</L><select style={F} value={f.loanType} onChange={s("loanType")}>{LOAN_TYPES.map(t=><option key={t}>{t}</option>)}</select>
    <L>Sanctioned amount (₹)</L><input style={F} type="number" value={f.sanctioned} onChange={s("sanctioned")} placeholder="780000"/>
    <L>Current outstanding (₹)</L><input style={F} type="number" value={f.outstanding} onChange={s("outstanding")} placeholder="576797"/>
    <button onClick={()=>{if(!f.name||!f.sanctioned)return;addAcc({name:f.name,type:"Loan",loanType:f.loanType,sanctionedAmount:+f.sanctioned,outstandingAmount:+f.outstanding||0,opening:0,hint:""});close();}} style={SB}>Add</button>
  </Sheet>);
}

function EditLoanModal({close,account,editLoan}){
  const[out,setOut]=useState(account.outstandingAmount||0);
  const paid=Math.max(0,(account.sanctionedAmount||0)-out),pct=account.sanctionedAmount?Math.min(100,paid/account.sanctionedAmount*100):0;
  return(<Sheet close={close} title="Update Outstanding">
    <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:14,padding:16,marginBottom:16,color:"#fff",textAlign:"center"}}>
      <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>{account.loanType}</div>
      <div style={{height:10,background:"rgba(255,255,255,0.1)",borderRadius:5,margin:"12px 0 6px"}}><div style={{width:`${pct}%`,height:"100%",background:C.brand,borderRadius:5}}/></div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#6B9A8A"}}><span>Paid: {inr(paid)}</span><span>Total: {inr(account.sanctionedAmount||0)}</span></div>
    </div>
    <L>Current outstanding (₹)</L><input autoFocus style={F} type="number" value={out} onChange={e=>setOut(e.target.value)}/>
    <button onClick={()=>{editLoan(account.id,+out);close();}} style={SB}>Update</button>
  </Sheet>);
}

function EditCCModal({close,account,editCC}){
  const[out,setOut]=useState(account.currentOutstanding||0);
  const[lim,setLim]=useState(account.creditLimit||0);
  const[dueDay,setDueDay]=useState(account.dueDay||"");
  const util=lim>0?Math.min(100,out/lim*100):0;
  return(<Sheet close={close} title="Update Card">
    <L>Credit limit (₹)</L><input style={F} type="number" value={lim} onChange={e=>setLim(e.target.value)}/>
    <L>Current outstanding (₹)</L><input autoFocus style={F} type="number" value={out} onChange={e=>setOut(e.target.value)}/>
    <L>Due day (1-31)</L><input style={F} type="number" min="1" max="31" value={dueDay} onChange={e=>setDueDay(e.target.value)} placeholder="e.g. 15"/>
    <div style={{background:C.bg,borderRadius:10,padding:12,marginBottom:12}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Utilisation: {Math.round(util)}%</div>
      <div style={{height:8,background:"#EEF3FF",borderRadius:4,position:"relative"}}><div style={{width:`${util}%`,height:"100%",background:util<20?C.brand:util<50?C.gold:C.expense,borderRadius:4}}/><div style={{position:"absolute",left:"20%",top:0,bottom:0,width:2,background:C.ink,opacity:0.4}}/></div>
    </div>
    <button onClick={()=>{editCC(account.id,{currentOutstanding:+out,creditLimit:+lim,dueDay:+dueDay||0});close();}} style={SB}>Update</button>
  </Sheet>);
}

function PayLoanModal({close,loan,bankAccounts,payLoan}){
  const[amt,setAmt]=useState(""), [bankId,setBankId]=useState(bankAccounts[0]?.id||""), [note,setNote]=useState(`${loan.loanType||"Loan"} EMI`);
  const a=evalExpr(amt);
  return(<Sheet close={close} title={`Pay EMI — ${loan.name}`}>
    <div style={{background:"#FFF8E8",borderRadius:12,padding:14,marginBottom:14,border:"1px solid #FDE68A"}}><div style={{fontSize:12,color:"#92400E",fontWeight:600}}>Outstanding</div><div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:C.expense}}>{inr(loan.outstandingAmount||0)}</div></div>
    <L>EMI amount (₹)</L><input autoFocus style={F} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="e.g. 14500"/>
    <L>Pay from</L><select style={F} value={bankId} onChange={e=>setBankId(e.target.value)}>{bankAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <L>Note</L><input style={F} value={note} onChange={e=>setNote(e.target.value)}/>
    <button onClick={()=>{if(!a||a<=0||!bankId)return;payLoan(loan.id,bankId,a,note);close();}} style={SB}>Pay {!isNaN(a)&&a>0?inr(a):""}</button>
  </Sheet>);
}

function PayCCModal({close,cc,bankAccounts,addTxn}){
  const[amt,setAmt]=useState(""), [bankId,setBankId]=useState(bankAccounts[0]?.id||""), [note,setNote]=useState(`${cc.name} payment`);
  const a=evalExpr(amt);
  return(<Sheet close={close} title={`Pay Bill — ${cc.name}`}>
    <div style={{background:"#EEF3FF",borderRadius:12,padding:14,marginBottom:14,border:"1px solid #C7D7FF"}}><div style={{fontSize:12,color:"#3B5BDB",fontWeight:600}}>Outstanding</div><div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:C.xfer}}>{inr(cc.currentOutstanding||0)}</div></div>
    <L>Payment amount (₹)</L><input autoFocus style={F} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Full or partial amount"/>
    <L>Pay from</L><select style={F} value={bankId} onChange={e=>setBankId(e.target.value)}>{bankAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <L>Note</L><input style={F} value={note} onChange={e=>setNote(e.target.value)}/>
    <button onClick={()=>{if(!a||a<=0||!bankId)return;addTxn({type:"transfer",amount:a,accountId:bankId,toAccountId:cc.id,date:today(),note,category:"Transfer"});close();}} style={SB}>Pay {!isNaN(a)&&a>0?inr(a):""}</button>
  </Sheet>);
}

function GoalModal({close,addGoal,bankAccounts}){
  const[name,setName]=useState(""),  [target,setTarget]=useState(""), [targetDate,setTargetDate]=useState("");
  const[lt,setLt]=useState("none"), [accId,setAccId]=useState(bankAccounts[0]?.id||"");
  const[iType,setIType]=useState(INVEST_TYPES[0]), [iVal,setIVal]=useState(""), [saved,setSaved]=useState("");
  const go=()=>{if(!name||!target)return;const g={name,target:+target,targetDate,linkType:lt};if(lt==="none")g.saved=+saved||0;if(lt==="account")g.linkedAccountId=accId;if(lt==="investment"){g.investmentType=iType;g.investmentValue=+iVal||0;g.investmentValueDate=today();}addGoal(g);close();};
  return(<Sheet close={close} title="New Goal">
    <L>Goal name</L><input style={F} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Emergency Fund"/>
    <L>Target amount (₹)</L><input style={F} type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder="100000"/>
    <L>Target date (optional)</L><input style={F} type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/>
    <p style={{fontSize:12,color:C.muted,marginTop:-8}}>App will calculate how much to save monthly to reach it on time.</p>
    <L>Type</L>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
      {[["none","🪙 Manual"],["account","🏦 Bank"],["investment","📈 Invest"]].map(([v,l])=><button key={v} onClick={()=>setLt(v)} style={{padding:"10px 4px",borderRadius:10,border:`1px solid ${lt===v?C.brand:C.border}`,background:lt===v?C.brandDim:"#fff",color:lt===v?C.brand:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{l}</button>)}
    </div>
    {lt==="none"&&<><L>Already saved (₹)</L><input style={F} type="number" value={saved} onChange={e=>setSaved(e.target.value)} placeholder="0"/></>}
    {lt==="account"&&(bankAccounts.length>0?<><L>Bank account</L><select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{bankAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>:<p style={{color:C.expense,fontSize:13}}>No bank accounts found.</p>)}
    {lt==="investment"&&<><L>Type</L><select style={F} value={iType} onChange={e=>setIType(e.target.value)}>{INVEST_TYPES.map(t=><option key={t}>{t}</option>)}</select><L>Current value (₹)</L><input style={F} type="number" value={iVal} onChange={e=>setIVal(e.target.value)} placeholder="0"/></>}
    <button onClick={go} style={SB}>Save Goal</button>
  </Sheet>);
}

function EditGoalModal({close,goal,editGoal}){
  const[name,setName]=useState(goal.name), [target,setTarget]=useState(goal.target), [iVal,setIVal]=useState(goal.investmentValue||""), [targetDate,setTargetDate]=useState(goal.targetDate||"");
  if(goal.linkType==="investment")return(<Sheet close={close} title="Update Value"><div style={{textAlign:"center",marginBottom:18}}><div style={{fontFamily:"Georgia,serif",fontSize:28,fontWeight:700,color:C.gold}}>{inr(goal.investmentValue||0)}</div><div style={{fontSize:12,color:C.muted}}>{goal.investmentType}</div></div><L>New value (₹)</L><input autoFocus style={F} type="number" value={iVal} onChange={e=>setIVal(e.target.value)}/><button onClick={()=>{if(!iVal)return;editGoal(goal.id,{investmentValue:+iVal,investmentValueDate:today()});close();}} style={SB}>Update</button></Sheet>);
  return(<Sheet close={close} title="Edit Goal"><L>Name</L><input style={F} value={name} onChange={e=>setName(e.target.value)}/><L>Target (₹)</L><input style={F} type="number" value={target} onChange={e=>setTarget(e.target.value)}/><L>Target date (optional)</L><input style={F} type="date" value={targetDate} onChange={e=>setTargetDate(e.target.value)}/><button onClick={()=>{if(!name||!target)return;editGoal(goal.id,{name,target:+target,targetDate});close();}} style={SB}>Save</button></Sheet>);
}

function BudgetModal({close,setBudget,expCats}){
  const[cat,setCat]=useState(expCats[0]), [amt,setAmt]=useState("");
  return(<Sheet close={close} title="Set Budget"><L>Category</L><select style={F} value={cat} onChange={e=>setCat(e.target.value)}>{expCats.map(c=><option key={c}>{c}</option>)}</select><L>Monthly limit (₹)</L><input style={F} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="5000"/><button onClick={()=>{if(!amt)return;setBudget(cat,+amt);close();}} style={SB}>Save</button></Sheet>);
}

/* Settings — backup, restore */
function SettingsModal({close,data,pin,restoreData}){
  const[restoreStep,setRestoreStep]=useState("idle");
  const[restoreFile,setRestoreFile]=useState(null);
  const[restorePin,setRestorePin]=useState("");
  const[restoreErr,setRestoreErr]=useState("");
  const[restoreMsg,setRestoreMsg]=useState("");
  const lb=localStorage.getItem("mm:lastBackup");
  const daysAgo=lb?Math.floor((Date.now()-new Date(lb).getTime())/86400000):null;
  const[fyMode,setFyMode]=useState(false);

  const doRestore=async()=>{
    if(!restoreFile)return;setRestoreErr("");
    try{const text=await restoreFile.text();const d=await importBackup(text,restorePin);restoreData(d);setRestoreMsg("Restored successfully! All your data is back.");setRestoreStep("done");}
    catch(e){setRestoreErr("Could not restore — wrong PIN or invalid file.");}
  };

  const fy=currentFY();const{start,end}=fyRange(fy);
  const fyTxns=data.transactions.filter(t=>t.date>=start&&t.date<=end);
  const fyInc=fyTxns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const fyExp=fyTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);

  return(<Sheet close={close} title="Settings">
    {/* Backup */}
    <div style={{background:C.bg,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>💾 Backup</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{lb?`Last backup: ${daysAgo===0?"today":daysAgo===1?"yesterday":`${daysAgo} days ago`}`:"Never backed up"}</div>
      <p style={{fontSize:12,color:C.muted,marginBottom:12}}>Downloads an encrypted .mmbackup file. Safe to save in Google Drive, email to yourself, or WhatsApp. Only you can open it with your PIN.</p>
      <button onClick={async()=>{await exportBackup(data,pin);}} style={SB}>Export full backup (.mmbackup)</button>
    </div>

    {/* Restore */}
    <div style={{background:C.bg,borderRadius:14,padding:16,marginBottom:12}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🔄 Restore from backup</div>
      <p style={{fontSize:12,color:C.muted,marginBottom:12}}>Upload a .mmbackup file and enter the PIN that was used when the backup was created.</p>
      {restoreStep==="idle"&&<>
        <L>Backup file (.mmbackup)</L>
        <input type="file" accept=".mmbackup,.json" style={{...F,padding:8}} onChange={e=>{setRestoreFile(e.target.files[0]||null);setRestoreErr("");}}/>
        <L>PIN used when backup was created</L>
        <input style={F} type="password" value={restorePin} onChange={e=>setRestorePin(e.target.value)} placeholder="Your PIN"/>
        {restoreErr&&<p style={{fontSize:13,color:C.expense,fontWeight:500}}>{restoreErr}</p>}
        <button onClick={doRestore} disabled={!restoreFile||!restorePin} style={{...SB,background:restoreFile&&restorePin?C.brand:"#ccc"}}>Restore</button>
      </>}
      {restoreStep==="done"&&<div style={{color:C.brand,fontWeight:600,fontSize:13}}>{restoreMsg}</div>}
    </div>

    {/* Tax Summary shortcut */}
    <div style={{background:C.bg,borderRadius:14,padding:16}}>
      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>📊 FY {fy}-{fy+1} Summary</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
        <div style={{background:"#E6FBF5",borderRadius:10,padding:10}}><div style={{fontSize:11,color:C.muted}}>Income</div><div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:C.income}}>{inr(fyInc)}</div></div>
        <div style={{background:"#FFEEEE",borderRadius:10,padding:10}}><div style={{fontSize:11,color:C.muted}}>Expense</div><div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:C.expense}}>{inr(fyExp)}</div></div>
      </div>
      <div style={{fontSize:12,color:C.muted,marginTop:8}}>Net savings: <b style={{color:(fyInc-fyExp)>=0?C.brand:C.expense}}>{inr(fyInc-fyExp)}</b> · See full breakdown in the Insights tab.</div>
    </div>
  </Sheet>);
}

/* PDF Import */
function ImportModal({close,data,importBatch,expCats,incCats}){
  const[step,setStep]=useState("pick");const[file,setFile]=useState(null);const[pwd,setPwd]=useState("");const[needPwd,setNP]=useState(false);
  const[accId,setAId]=useState(data.accounts.filter(a=>a.type!=="Loan")[0]?.id||"");
  const[rows,setRows]=useState([]);const[err,setErr]=useState("");const[res,setRes]=useState(null);
  const[skipped,setSkipped]=useState([]);const[showSkipped,setShowSkipped]=useState(false);
  const[carryoverDate,setCOD]=useState("");const[carryoverAmt,setCOA]=useState("");const[showCarryover,setSC]=useState(false);
  const nonLoan=data.accounts.filter(a=>a.type!=="Loan");
  const parse=async()=>{if(!file)return;setErr("");setStep("parsing");
    try{const lib=await loadPdf(),buf=await file.arrayBuffer();let pdf;
      try{pdf=await lib.getDocument({data:buf,password:pwd||undefined}).promise;}
      catch(e){if(e&&(e.name==="PasswordException"||/password/i.test(e.message||""))){setNP(true);setErr(pwd?"Wrong password — try again.":"PDF is password-protected. Enter the password (usually your DOB or mobile number).");setStep("pick");return;}throw e;}
      const lines=await extractLines(pdf);const blob=lines.join(" ");
      const hit=data.accounts.find(a=>a.hint&&a.hint.length>=4&&new RegExp(`${a.hint}\\b`).test(blob));if(hit)setAId(hit.id);
      let parsed;
      try{parsed=parseStatement(lines,data.accounts,data.recurring);}
      catch(e){if(e.scanned){setErr("Scanned/image PDF detected — no text found.\n\nFor HDFC: NetBanking → Account Statement by Email (choose e-Statement).\nFor SBI: YONO app → eStatements.\nFor others: look for 'Download Statement' not 'Print Statement'.");setStep("pick");return;}throw e;}
      if(!parsed.length){setErr("No transactions found. Use a digital e-statement from netbanking.");setStep("pick");return;}
      const withXfer=parsed.map(r=>r.isXfer?{...r,type:"transfer"}:r);setRows(withXfer);
      const targetAcc=hit?.id||accId;const hasExisting=data.transactions.some(t=>t.accountId===targetAcc);
      if(!hasExisting&&withXfer.length>0){const sorted=[...withXfer].sort((a,b)=>a.date.localeCompare(b.date));setCOD(prevDay(sorted[0].date));setSC(true);setStep("carryover");}
      else setStep("review");
    }catch(e){setErr(e.message||"Could not read PDF.");setStep("pick");}};

  const doImport=()=>{
    const ex=new Set(data.transactions.map(t=>`${t.accountId}|${t.date}|${(+t.amount).toFixed(2)}|${t.type}`));
    const fresh=[],skip=[];
    if(showCarryover&&carryoverAmt&&+carryoverAmt>0)fresh.push({id:uid(),type:"income",amount:+carryoverAmt,category:"Other",accountId:accId,date:carryoverDate,note:"Opening balance carryover",source:"carryover"});
    rows.filter(r=>r.include).forEach(r=>{const k=`${accId}|${r.date}|${r.amount.toFixed(2)}|${r.type}`;if(ex.has(k)){skip.push(r);return;}ex.add(k);fresh.push({id:uid(),type:r.type,amount:r.amount,category:r.type==="transfer"?"Transfer":r.category,accountId:accId,toAccountId:r.type==="transfer"?r.xferToId:undefined,date:r.date,note:r.desc,source:"import",recurring:!!r.recurMatch});});
    importBatch(fresh);setSkipped(skip);setRes({added:fresh.length-(showCarryover&&carryoverAmt&&+carryoverAmt>0?1:0),skipped:skip.length,carryover:showCarryover&&+carryoverAmt>0});setStep("done");
  };
  const toggle=k=>setRows(rows.map(r=>r.key===k?{...r,include:!r.include}:r));
  const setType=k=>t=>setRows(rows.map(r=>r.key===k?{...r,type:t}:r));
  const setCat=k=>c=>setRows(rows.map(r=>r.key===k?{...r,category:c}:r));
  const setXferTo=k=>id=>setRows(rows.map(r=>r.key===k?{...r,xferToId:id}:r));
  const included=rows.filter(r=>r.include).length;

  return(<Sheet close={close} title="Import Statement">
    {step==="pick"&&<>
      <p style={{fontSize:13,color:C.muted,marginTop:0}}>Pick a bank e-statement PDF. Parsed on your device — nothing uploaded.</p>
      <L>PDF file</L><input type="file" accept="application/pdf" style={{...F,padding:8}} onChange={e=>{setFile(e.target.files[0]||null);setErr("");}}/>
      {needPwd&&<><L>PDF password</L><input style={F} type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="HDFC: first 4 letters of name + DOB in DDMM (e.g. ARPA0408)"/><p style={{fontSize:11,color:C.muted,marginTop:-8}}>HDFC: name (4 letters) + DDMM of date of birth · SBI: account number + DOB · Kotak: 4-digit PIN</p></>}
      <L>Import into account</L><select style={F} value={accId} onChange={e=>setAId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}{a.hint?` ··${a.hint}`:""}</option>)}</select>
      {err&&<p style={{fontSize:13,color:C.expense,fontWeight:500,whiteSpace:"pre-wrap"}}>{err}</p>}
      <button onClick={parse} disabled={!file} style={{...SB,background:file?C.brand:"#ccc",cursor:file?"pointer":"default"}}>Read Statement</button>
    </>}
    {step==="parsing"&&<p style={{textAlign:"center",color:C.muted,padding:"32px 0"}}>Reading your statement…</p>}
    {step==="carryover"&&<>
      <div style={{background:"#EEF3FF",borderRadius:14,padding:16,marginBottom:16,border:"1px solid #C7D7FF"}}><div style={{fontSize:13,fontWeight:700,color:C.xfer,marginBottom:6}}>📌 First statement for this account</div><div style={{fontSize:13,color:C.ink}}>Statement starts from {rows.length>0?[...rows].sort((a,b)=>a.date.localeCompare(b.date))[0].date:""}. Enter your balance on <b>{carryoverDate}</b> to set the correct opening balance.</div></div>
      <L>Account balance on {carryoverDate} (₹)</L>
      <input autoFocus style={F} type="number" value={carryoverAmt} onChange={e=>setCOA(e.target.value)} placeholder="0 if unknown"/>
      <p style={{fontSize:12,color:C.muted,marginTop:-8}}>Creates a one-time opening balance entry. Skip if unsure.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>{setSC(false);setCOA("");setStep("review");}} style={{padding:"12px 0",borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Skip</button>
        <button onClick={()=>setStep("review")} style={{...SB,margin:0}}>Continue</button>
      </div>
    </>}
    {step==="review"&&<>
      <p style={{fontSize:13,color:C.muted,marginTop:0}}>Found <b style={{color:C.ink}}>{rows.length}</b> transactions. 🔁 = recurring match · ⚡ = likely transfer.</p>
      <L>Account</L><select style={F} value={accId} onChange={e=>setAId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <div style={{display:"grid",gap:8,maxHeight:"44vh",overflowY:"auto"}}>
        {rows.map(r=>(<div key={r.key} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",opacity:r.include?1:0.4}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <input type="checkbox" checked={r.include} onChange={()=>toggle(r.key)} style={{width:18,height:18,accentColor:C.brand,flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.recurMatch&&<span style={{color:C.brand}}>🔁 </span>}{r.isXfer&&!r.recurMatch&&<span style={{color:C.xfer}}>⚡ </span>}{r.desc||"(no description)"}{r.recurMatch&&<span style={{fontSize:10,color:C.brand}}> · "{r.recurMatch.name}"</span>}</div>
              <div style={{fontSize:10,color:C.muted}}>{new Date(r.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
            </div>
            <span style={{fontFamily:"Georgia,serif",fontSize:13,fontWeight:700,color:r.type==="income"?C.income:r.type==="transfer"?C.xfer:C.expense,flexShrink:0}}>{r.type==="income"?"+":r.type==="transfer"?"↔":"−"}{inr(r.amount)}</span>
          </div>
          {r.include&&<div style={{display:"grid",gap:4,marginTop:8}}>
            <div style={{display:"flex",gap:6}}>
              <select value={r.type} onChange={e=>setType(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11,flex:1}}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select>
              {r.type!=="transfer"&&<select value={r.category} onChange={e=>setCat(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11,flex:2}}>{(r.type==="income"?incCats:expCats).map(c=><option key={c}>{c}</option>)}</select>}
            </div>
            {r.type==="transfer"&&<select value={r.xferToId||""} onChange={e=>setXferTo(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11}}><option value="">— Select destination —</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}
          </div>}
        </div>))}
      </div>
      <button onClick={doImport} disabled={!included} style={{...SB,marginTop:12,background:included?C.brand:"#ccc",cursor:included?"pointer":"default",position:"sticky",bottom:0}}>Import {included}</button>
    </>}
    {step==="done"&&res&&<div style={{textAlign:"center",padding:"20px 0"}}>
      <div style={{fontSize:44,marginBottom:12}}>✅</div>
      {res.carryover&&<div style={{background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:10,marginBottom:12,fontSize:13,color:C.brand}}>Opening balance carryover added ✓</div>}
      <div style={{fontSize:16,fontWeight:700,color:C.ink}}>{res.added} transaction{res.added===1?"":"s"} imported</div>
      {res.skipped>0&&<div style={{fontSize:13,color:C.muted,marginTop:6}}>{res.skipped} duplicate{res.skipped===1?"":"s"} skipped</div>}
      {skipped.length>0&&<button onClick={()=>setShowSkipped(!showSkipped)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,color:C.muted,cursor:"pointer",marginTop:8}}>{showSkipped?"Hide":"View"} skipped</button>}
      {showSkipped&&<div style={{textAlign:"left",marginTop:10,display:"grid",gap:6,maxHeight:"25vh",overflowY:"auto"}}>{skipped.map((r,i)=><div key={i} style={{background:C.bg,borderRadius:8,padding:"8px 10px",fontSize:11}}><div style={{fontWeight:600,color:C.muted}}>{r.desc}</div><div style={{color:C.muted}}>{r.date} · {inr(r.amount)}</div></div>)}</div>}
      <button onClick={close} style={{...SB,marginTop:16}}>Done</button>
    </div>}
  </Sheet>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED PRIMITIVES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Sheet({children,close,title}){return(<div onClick={close} style={{position:"fixed",inset:0,background:"rgba(10,20,30,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50}}><div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:560,padding:"20px 20px calc(20px + env(safe-area-inset-bottom))",maxHeight:"90vh",overflowY:"auto"}}>{title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><h2 style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,margin:0,color:C.ink}}>{title}</h2><button onClick={close} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:4}}><X size={20}/></button></div>}{children}</div></div>);}
function Card({children}){return <div style={{margin:"16px 16px 0",background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>{children}</div>;}
function Nbtn({children,onClick}){return <button onClick={onClick} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",width:30,height:30,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;}
function Pbtn({children,onClick,style}){return <button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"8px 12px",borderRadius:12,border:"none",background:C.brand,color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",...style}}>{children}</button>;}
function Pill({children,onClick}){return <button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:C.card,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{children}</button>;}
function Eye({children,style}){return <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8,...style}}>{children}</div>;}
const SoftRoundBtn={background:C.card,border:`1px solid ${C.border}`,color:C.muted,width:34,height:34,borderRadius:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(13,27,42,0.05)"};
const PeriodBtn={padding:"12px 10px",borderRadius:14,border:`1px solid ${C.border}`,background:C.card,color:C.ink,fontSize:13,fontWeight:800,cursor:"pointer"};
const H2 ={fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,margin:0};
const IBN={background:"none",border:"none",color:"#BCC5CF",cursor:"pointer",padding:4};
const F  ={width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",fontSize:14,color:C.ink,background:"#FAFAFA",marginBottom:12};
const L  =({children})=><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{children}</div>;
const SB ={width:"100%",background:C.brand,border:"none",borderRadius:12,padding:"13px 0",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4};
