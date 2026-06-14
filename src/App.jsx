/* ─────────────────────────────────────────────────────────────────
   MONEYMATE  ·  Smart Money Tracker  ·  v2
   ─────────────────────────────────────────────────────────────────*/
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Wallet, PiggyBank, Target, LayoutDashboard, List,
  Plus, Trash2, X, ChevronLeft, ChevronRight,
  Download, FileUp, Edit2, ArrowLeft, RefreshCw,
} from "lucide-react";

/* ── Colours ─────────────────────────────────────────────────────── */
const C = {
  bg:"#F0F4F8", card:"#FFFFFF", ink:"#1A2332", muted:"#6B7A8D",
  border:"#E2E8F0", brand:"#00C896", brandDim:"#E6FBF5",
  income:"#00C896", expense:"#FF5A5F", xfer:"#5B8DEF",
  gold:"#FFA726", dark:"#0D1B2A",
  charts:["#FF5A5F","#FF9F43","#FFA726","#00C896","#5B8DEF",
          "#A55EEA","#26D9A7","#FC5C7D","#6C5CE7","#00B8D9","#78909C"],
};

/* ── Constants ───────────────────────────────────────────────────── */
const EXPENSE_CATS  = ["Food","Groceries","Transport","Rent","Utilities","Shopping","Health","Entertainment","EMI","Education","Other"];
const INCOME_CATS   = ["Salary","Business","Interest","Gift","Other"];
const ACCOUNT_TYPES = ["Bank","UPI / Wallet","Cash","Credit Card","Loan"];
const LOAN_TYPES    = ["Car Loan","Home Loan","Personal Loan","Education Loan","Business Loan","Gold Loan","Other Loan"];
const INVEST_TYPES  = ["Mutual Fund","Stocks","SGB","Bonds","FD","PPF","NPS","Other"];
const CAT_EMOJI = {
  Food:"🍜",Groceries:"🛒",Transport:"🚗",Rent:"🏠",Utilities:"⚡",
  Shopping:"🛍️",Health:"💊",Entertainment:"🎬",EMI:"🏦",Education:"📚",
  Other:"📌",Salary:"💼",Business:"📈",Interest:"💰",Gift:"🎁",Transfer:"↔️",
};

/* ── Utilities ───────────────────────────────────────────────────── */
const inr   = n => "₹" + new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Math.round(n||0));
const uid   = () => Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);
const curMo = () => today().slice(0,7);
const mkKey = d => d.slice(0,7);
const prevMo = mk => { const d=new Date(mk+"-01"); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); };
const nextMo = mk => { const d=new Date(mk+"-01"); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); };
const monthLabel = mk => { const [y,m]=mk.split("-"); return new Date(+y,+m-1,1).toLocaleString("en-IN",{month:"long",year:"numeric"}); };
const last30 = () => { const d=new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); };

function evalExpr(s) {
  s = String(s||"").replace(/\s+/g,"").replace(/,/g,"");
  if (!s || !/^[\d+\-*/().]+$/.test(s)) return NaN;
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
const DEFAULT_ACCOUNTS = [
  {id:"acc-sib",  name:"South Indian Bank", type:"Bank",  opening:0, hint:"0584"},
  {id:"acc-hdfc", name:"HDFC Bank",          type:"Bank",  opening:0, hint:"9712"},
  {id:"acc-sbi1", name:"SBI – 4034",         type:"Bank",  opening:0, hint:"4034"},
  {id:"acc-sbi2", name:"SBI – 5194",         type:"Bank",  opening:0, hint:"5194"},
  {id:"acc-ktk",  name:"Kotak Bank",          type:"Bank",  opening:0, hint:"1924"},
  {id:"acc-loan", name:"SBI Car Loan",        type:"Loan",  loanType:"Car Loan",
   sanctionedAmount:780000, outstandingAmount:576797, opening:0, hint:""},
];

const EMPTY = {
  accounts:DEFAULT_ACCOUNTS,
  transactions:[],
  budgets:{},
  goals:[],
  recurring:[],
  customCats:{expense:[],income:[]},
};

const normalize = d => ({
  ...EMPTY,...d,
  accounts: d.accounts?.length ? d.accounts : DEFAULT_ACCOUNTS,
  recurring: d.recurring||[],
  customCats: {expense:[],income:[],...(d.customCats||{})},
  goals: (d.goals||[]).map(g=>({linkType:"none",linkedAccountId:"",investmentType:"Mutual Fund",investmentValue:0,...g})),
});

/* ── AES-256-GCM crypto ──────────────────────────────────────────── */
const _enc=new TextEncoder(), _dec=new TextDecoder();
const b64e=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function deriveKey(pin,salt){
  const km=await crypto.subtle.importKey("raw",_enc.encode(pin),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptData(data,pin){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(pin,salt);
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,_enc.encode(JSON.stringify(data)));
  return JSON.stringify({s:b64e(salt),v:b64e(iv),c:b64e(ct)});
}
async function decryptData(stored,pin){
  const {s,v,c}=JSON.parse(stored);
  const key=await deriveKey(pin,b64d(s));
  const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(v)},key,b64d(c));
  return normalize(JSON.parse(_dec.decode(pt)));
}

/* ── PDF Parser — SIB · HDFC · SBI · Kotak ──────────────────────── */
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
    const page=await pdf.getPage(p), tc=await page.getTextContent(), rows=new Map();
    tc.items.forEach(it=>{
      if(!it.str.trim())return;
      const y=Math.round(it.transform[5]/3)*3;
      if(!rows.has(y))rows.set(y,[]);
      rows.get(y).push({x:it.transform[4],str:it.str});
    });
    [...rows.keys()].sort((a,b)=>b-a).forEach(y=>{
      const ln=rows.get(y).sort((a,b)=>a.x-b.x).map(i=>i.str).join(" ").replace(/\s+/g," ").trim();
      if(ln)lines.push(ln);
    });
  }
  return lines;
}

const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const DRE  = /\b(\d{1,2})[\/\-.]((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\d{1,2})[\/\-.](\d{2,4})\b/i;
const DRE2 = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i;
const ARE  = /(?:\d{1,3}(?:,\d{2,3})+|\d{2,})\.\d{2}/g;

const toISO=(d,m,y)=>{
  const mm=isNaN(+m)?MONTHS[m.toLowerCase().slice(0,3)]:+m;
  let yy=+y;if(String(y).length===2)yy+=2000;
  if(!mm||mm>12||+d>31||yy<2000||yy>2100)return null;
  return `${yy}-${String(mm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
};

const CCAT=[
  [/swiggy|zomato|dominos|mcdonald|kfc|restaurant|cafe|thalassery|jalpan|food/i,"Food"],
  [/blinkit|zepto|bigbasket|grofers|dmart|grocery|kirana/i,"Groceries"],
  [/uber|ola|rapido|irctc|metro|petrol|hpcl|iocl|bpcl|fastag|toll/i,"Transport"],
  [/rent\b|landlord|pg\b/i,"Rent"],
  [/electricity|bescom|tneb|jio|airtel|broadband|dth|gas bill/i,"Utilities"],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho/i,"Shopping"],
  [/pharmacy|apollo|medplus|hospital|clinic|1mg/i,"Health"],
  [/netflix|spotify|hotstar|bookmyshow|prime|pvr/i,"Entertainment"],
  [/\bemi\b|loan emi|car loan|home loan/i,"EMI"],
  [/school|college|udemy|tuition|byjus/i,"Education"],
  [/indstocks|iccl|zerodha|groww|upstox/i,"Stocks"],
];
const ICAT=[
  [/salary|sal cr|payroll/i,"Salary"],
  [/interest|int cr|int pd/i,"Interest"],
  [/dividend/i,"Interest"],
  [/refund|cashback|reversal/i,"Other"],
];
const guessCat=(desc,type)=>{const r=type==="income"?ICAT:CCAT;for(const[re,c]of r)if(re.test(desc))return c;return "Other";};

const isCr=l=>/\bcr\b|credit|deposit|interest credit|dep tfr|by [a-z]|refund|cashback|nach.*cr/i.test(l);
const isDr=l=>/\bdr\b|debit|withdraw|wdl\b|paid|sent/i.test(l);

/* Detect if a line is an own-account transfer and which account */
function detectTransfer(desc,accounts){
  const IFSC=[
    {re:/HDFC0/i,  hints:["9712"]},
    {re:/SIBL0|SOUTH\s*I\s*\//i,hints:["0584"]},
    {re:/KKBK0/i,  hints:["1924"]},
    {re:/SBIN0/i,  hints:["4034","5194"]},
  ];
  const banks=accounts.filter(a=>a.type==="Bank"||a.type==="UPI / Wallet");
  const cc   =accounts.filter(a=>a.type==="Credit Card");
  const loans=accounts.filter(a=>a.type==="Loan");
  if(/credit card|cc payment|cc bill|card payment/i.test(desc)&&cc.length)return cc[0].id;
  if(/loan.*emi|emi.*loan/i.test(desc)&&loans.length)return loans[0].id;
  for(const{re,hints}of IFSC){
    if(re.test(desc)){
      for(const h of hints){const a=banks.find(x=>x.hint===h);if(a)return a.id;}
    }
  }
  for(const a of banks){if(a.hint&&a.hint.length>=4&&desc.includes(a.hint))return a.id;}
  return null;
}
const isTransferKw=l=>/\bneft\b|\bimps\b|\brtgs\b|\btransfer\b|\btfr\b|mb:\s*sent|wdl tfr|dep tfr/i.test(l);

function parseStatement(lines,accounts=[]){
  const all=lines.join(" ");
  const isKotak=/kotak mahindra|kkbk0007/i.test(all);
  const out=[];
  let prevBal=null;
  const skip=l=>/^(date\b|sl\.?\s*no|transaction date|value date|particulars|narration|opening bal|closing bal|statement of|account no|page no)/i.test(l.trim());

  for(const line of lines){
    if(skip(line))continue;
    const dm=line.match(DRE)||line.match(DRE2);
    if(!dm)continue;
    const date=toISO(dm[1],dm[2],dm[3]);
    if(!date)continue;

    let amount=0,type=null;

    if(isKotak){
      // Kotak: single ±amount column  e.g. +23.00 or -8,000.00
      const sg=line.match(/\s([+\-])([\d,]+\.\d{2})\b/);
      if(!sg)continue;
      amount=parseFloat(sg[2].replace(/,/g,""));
      type=sg[1]==="+"?"income":"expense";
      const bm=line.match(/([\d,]+\.\d{2})\s*$/);
      if(bm)prevBal=parseFloat(bm[1].replace(/,/g,""));
    } else {
      // SIB balance fix: "20,557.77Cr" → strip the Cr (account-in-credit flag)
      const cl=line.replace(/(\d)(Cr)\b/gi,"$1");
      const amts=(cl.match(ARE)||[]).map(a=>parseFloat(a.replace(/,/g,""))).filter(v=>v>0.005);
      if(!amts.length)continue;
      const bal=amts[amts.length-1];

      if(amts.length>=3){
        // [c1, c2, balance] — debit/credit separate columns
        const c1=amts[amts.length-3], c2=amts[amts.length-2];
        if(prevBal!==null){
          const d=bal-prevBal;
          if(Math.abs(d+c1)<1.5)      {amount=c1;type="expense";}
          else if(Math.abs(d-c2)<1.5) {amount=c2;type="income";}
          else if(Math.abs(d+c2)<1.5) {amount=c2;type="expense";}
          else if(Math.abs(d-c1)<1.5) {amount=c1;type="income";}
          else{amount=Math.max(c1,c2);type=isCr(cl)?"income":"expense";}
        }else{
          amount=c2>0?c2:c1;
          type=isCr(cl)?"income":isDr(cl)?"expense":"expense";
        }
      } else if(amts.length===2){
        // [txAmt, balance] — most common
        const tx=amts[0];
        if(prevBal!==null){
          const d=bal-prevBal;
          amount=tx;
          if(Math.abs(Math.abs(d)-tx)<=Math.max(tx*0.02,1)){
            type=d>=0?"income":"expense";
          }else{
            type=isCr(cl)?"income":isDr(cl)?"expense":null;
          }
        }else{
          amount=tx;
          type=isCr(cl)?"income":isDr(cl)?"expense":"expense";
        }
      }else continue;

      if(!type)continue;
      prevBal=bal;
    }

    if(!amount||amount<=0)continue;

    const desc=line
      .replace(DRE2,"").replace(DRE,"")
      .replace(/\s[+\-][\d,]+\.\d{2}/g,"").replace(ARE,"")
      .replace(/\b(Cr|Dr|CR|DR|A\/C)\b/g,"")
      .replace(/[^\w\s\/\-@.:]/g," ").replace(/\s+/g," ").trim().slice(0,70);

    const xferTo = (isTransferKw(line)||isTransferKw(desc)) ? detectTransfer(desc+line,accounts) : null;
    out.push({date,amount,type,desc,
      category:guessCat(desc,type),include:true,key:uid(),
      isXfer:!!xferTo, xferToId:xferTo||""});
  }
  return out;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PIN SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PinScreen({isSetup,onSetup,onUnlock,err,setErr,onForgot}){
  const [digits,setDigits]=useState([]);
  const [stage,setStage]=useState(1);
  const [first,setFirst]=useState("");
  const push=k=>{
    if(digits.length>=4)return;
    const next=[...digits,String(k)];
    setDigits(next);
    if(next.length===4){
      const p=next.join("");
      setTimeout(()=>{
        if(!isSetup){onUnlock(p);setDigits([]);}
        else if(stage===1){setFirst(p);setStage(2);setDigits([]);setErr("");}
        else{
          if(p===first)onSetup(p);
          else{setErr("PINs don't match — try again");setStage(1);setFirst("");setDigits([]);}
        }
      },120);
    }
  };
  const pop=()=>setDigits(d=>d.slice(0,-1));
  const label=isSetup?(stage===1?"Set a 4-digit PIN":"Confirm your PIN"):"Enter your PIN";
  const PAD=[1,2,3,4,5,6,7,8,9,"",0,"⌫"];
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"Inter,system-ui,sans-serif"}}>
      <div style={{fontSize:52,marginBottom:12}}>💰</div>
      <h1 style={{color:C.brand,fontFamily:"Georgia,serif",fontSize:30,fontWeight:700,margin:"0 0 4px"}}>MoneyMate</h1>
      <p style={{color:"#6B9A8A",fontSize:13,margin:"0 0 48px",letterSpacing:"0.1em",textTransform:"uppercase"}}>Smart Money Tracker</p>
      <p style={{color:"#B0C9C0",fontSize:15,marginBottom:22,fontWeight:500}}>{label}</p>
      <div style={{display:"flex",gap:18,marginBottom:36}}>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.25)",background:digits.length>i?C.brand:"rgba(255,255,255,0.1)",transition:"background .15s"}}/>
        ))}
      </div>
      {err&&<p style={{color:C.expense,fontSize:13,marginBottom:14,fontWeight:600}}>{err}</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,76px)",gap:14}}>
        {PAD.map((k,i)=>(
          <button key={i} onClick={()=>k==="⌫"?pop():k!==""?push(k):null} disabled={k===""}
            style={{width:76,height:76,borderRadius:"50%",border:"none",fontSize:k==="⌫"?22:26,fontWeight:600,
              cursor:k===""?"default":"pointer",color:"#fff",fontFamily:"inherit",
              background:k===""?"transparent":k==="⌫"?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.12)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>{k}</button>
        ))}
      </div>
      {!isSetup&&<button onClick={onForgot} style={{color:"#5A8A7A",background:"none",border:"none",fontSize:13,marginTop:40,cursor:"pointer",textDecoration:"underline"}}>Forgot PIN? Reset app</button>}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP ROOT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function App(){
  const [phase,setPhase]=useState("loading");
  const [pin,setPin]   =useState("");
  const [err,setErr]   =useState("");
  const [data,setData] =useState(EMPTY);

  useEffect(()=>{setPhase(localStorage.getItem("mm:setup")?"lock":"setup");},[]);

  const persist=async(next,p)=>{
    setData(next);
    try{localStorage.setItem("mm:data",await encryptData(next,p||pin));}
    catch(e){console.error("save error",e);}
  };

  const handleSetup=async p=>{
    try{
      localStorage.setItem("mm:data",await encryptData(EMPTY,p));
      localStorage.setItem("mm:setup","1");
    }catch(e){console.error(e);}
    setPin(p);setData(EMPTY);setPhase("app");
  };

  const handleUnlock=async p=>{
    try{
      const raw=localStorage.getItem("mm:data");
      const d=raw?await decryptData(raw,p):EMPTY;
      setPin(p);setData(d);setErr("");setPhase("app");
    }catch{setErr("Wrong PIN — try again");}
  };

  const handleForgot=()=>{
    if(window.confirm("Delete ALL data permanently?"))
      {localStorage.clear();setPhase("setup");setErr("");}
  };

  if(phase==="loading")return <div style={{minHeight:"100vh",background:C.dark,display:"grid",placeItems:"center",fontSize:48}}>💰</div>;
  if(phase==="setup") return <PinScreen isSetup onSetup={handleSetup} err={err} setErr={setErr}/>;
  if(phase==="lock")  return <PinScreen onUnlock={handleUnlock} err={err} setErr={setErr} onForgot={handleForgot}/>;
  return <Main data={data} persist={(next)=>persist(next)} />;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MAIN APP
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Main({data,persist}){
  const [tab,setTab]     =useState("home");
  const [month,setMonth] =useState(curMo());
  const [modal,setModal] =useState(null);

  /* mutations */
  const P=(fn)=>(...args)=>persist(fn(data,...args));
  const addTxn    =P((d,t)=>({...d,transactions:[...d.transactions,{...t,id:uid()}]}));
  const delTxn    =P((d,id)=>({...d,transactions:d.transactions.filter(t=>t.id!==id)}));
  const addAcc    =P((d,a)=>({...d,accounts:[...d.accounts,{...a,id:uid()}]}));
  const delAcc    =P((d,id)=>({...d,accounts:d.accounts.filter(a=>a.id!==id),transactions:d.transactions.filter(t=>t.accountId!==id&&t.toAccountId!==id)}));
  const editAcc   =P((d,id,ch)=>({...d,accounts:d.accounts.map(a=>a.id===id?{...a,...ch}:a)}));
  const editLoan  =P((d,id,out)=>({...d,accounts:d.accounts.map(a=>a.id===id?{...a,outstandingAmount:+out}:a)}));
  const payLoan   =(loanId,bankId,amt,note)=>{
    const txn={id:uid(),type:"expense",amount:+amt,category:"EMI",accountId:bankId,date:today(),note:note||"Loan payment"};
    const newOut=Math.max(0,(data.accounts.find(a=>a.id===loanId)?.outstandingAmount||0)-amt);
    persist({...data,transactions:[...data.transactions,txn],accounts:data.accounts.map(a=>a.id===loanId?{...a,outstandingAmount:newOut}:a)});
  };
  const addGoal   =P((d,g)=>({...d,goals:[...d.goals,{...g,id:uid()}]}));
  const delGoal   =P((d,id)=>({...d,goals:d.goals.filter(g=>g.id!==id)}));
  const editGoal  =P((d,id,ch)=>({...d,goals:d.goals.map(g=>g.id===id?{...g,...ch}:g)}));
  const setBudget =P((d,cat,amt)=>({...d,budgets:{...d.budgets,[cat]:amt}}));
  const delBudget =P((d,cat)=>{const b={...d.budgets};delete b[cat];return{...d,budgets:b};});
  const addCat    =P((d,kind,name)=>({...d,customCats:{...d.customCats,[kind]:[...d.customCats[kind],name.trim()]}}));
  const addRec    =P((d,r)=>({...d,recurring:[...d.recurring,{...r,id:uid(),lastDone:""}]}));
  const delRec    =P((d,id)=>({...d,recurring:d.recurring.filter(r=>r.id!==id)}));
  const markPaid  =(rec)=>{
    const mk=curMo(),[y,m]=mk.split("-").map(Number),ld=new Date(y,m,0).getDate();
    const date=`${mk}-${String(Math.min(rec.day,ld)).padStart(2,"0")}`;
    persist({...data,
      transactions:[...data.transactions,{id:uid(),type:rec.type,amount:rec.amount,category:rec.category,accountId:rec.accountId,date,note:rec.name}],
      recurring:data.recurring.map(r=>r.id===rec.id?{...r,lastDone:mk}:r)});
  };
  const importTxns=(rows,accountId)=>{
    const ex=new Set(data.transactions.map(t=>`${t.accountId}|${t.date}|${(+t.amount).toFixed(2)}|${t.type}`));
    let added=0,skipped=0;const fresh=[];
    rows.forEach(r=>{
      const k=`${accountId}|${r.date}|${r.amount.toFixed(2)}|${r.type}`;
      if(ex.has(k)){skipped++;return;}
      ex.add(k);
      fresh.push({id:uid(),type:r.type,amount:r.amount,
        category:r.type==="transfer"?"Transfer":r.category,
        accountId,toAccountId:r.type==="transfer"?r.xferToId:undefined,
        date:r.date,note:r.desc,source:"import"});
      added++;
    });
    persist({...data,transactions:[...data.transactions,...fresh]});
    return{added,skipped};
  };
  const exportCSV=()=>{
    const head="Date,Type,Category,Account,Amount,Note\n";
    const body=[...data.transactions].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{
      const acc=data.accounts.find(a=>a.id===t.accountId)?.name||"";
      const q=s=>`"${String(s||"").replace(/"/g,'""')}"`;
      return[t.date,t.type,q(t.category),q(acc),t.amount,q(t.note)].join(",");
    }).join("\n");
    const url=URL.createObjectURL(new Blob([head+body],{type:"text/csv"}));
    const a=document.createElement("a");a.href=url;a.download=`moneymate-${today()}.csv`;a.click();URL.revokeObjectURL(url);
  };

  /* derived */
  const expCats=[...EXPENSE_CATS,...data.customCats.expense];
  const incCats=[...INCOME_CATS,...data.customCats.income];
  const bankAccounts=data.accounts.filter(a=>a.type==="Bank");

  const balances=useMemo(()=>{
    const b={};
    data.accounts.forEach(a=>{
      if(a.type==="Loan")b[a.id]=-(a.outstandingAmount||0);
      else b[a.id]=+a.opening||0;
    });
    data.transactions.forEach(t=>{
      const amt=+t.amount||0;
      if(t.type==="income")      b[t.accountId]=(b[t.accountId]||0)+amt;
      else if(t.type==="expense") b[t.accountId]=(b[t.accountId]||0)-amt;
      else if(t.type==="transfer"){
        b[t.accountId]=(b[t.accountId]||0)-amt;
        if(t.toAccountId)b[t.toAccountId]=(b[t.toAccountId]||0)+amt;
      }
    });
    return b;
  },[data]);

  const netWorth=Object.values(balances).reduce((s,v)=>s+v,0);
  const monthTxns=data.transactions.filter(t=>mkKey(t.date)===month).sort((a,b)=>b.date.localeCompare(a.date));
  const todayTxns=data.transactions.filter(t=>t.date===today()).sort((a,b)=>b.date.localeCompare(a.date));
  const mInc=monthTxns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const mExp=monthTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);
  const dInc=todayTxns.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0);
  const dExp=todayTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0);
  const catSpend=useMemo(()=>{const m={};monthTxns.filter(t=>t.type==="expense").forEach(t=>{m[t.category]=(m[t.category]||0)+(+t.amount);});return m;},[monthTxns]);
  const pending=data.recurring.filter(r=>r.lastDone!==curMo());
  const trend=useMemo(()=>{
    const out=[];const now=new Date(month+"-01");
    for(let i=5;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const tx=data.transactions.filter(t=>mkKey(t.date)===mk);
      out.push({m:d.toLocaleString("en-IN",{month:"short"}),In:tx.filter(t=>t.type==="income").reduce((s,t)=>s+(+t.amount),0),Out:tx.filter(t=>t.type==="expense").reduce((s,t)=>s+(+t.amount),0)});
    }
    return out;
  },[data,month]);

  const M=(type,extra={})=>setModal({type,...extra});
  const close=()=>setModal(null);

  const TABS=[
    {id:"home",   Icon:LayoutDashboard,label:"Home"},
    {id:"entries",Icon:List,           label:"Entries"},
    {id:"accounts",Icon:Wallet,        label:"Accounts"},
    {id:"budgets", Icon:Target,        label:"Budgets"},
    {id:"goals",   Icon:PiggyBank,     label:"Goals"},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Inter,system-ui,sans-serif",color:C.ink}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}input:focus,select:focus{outline:none;border-color:#00C896!important;}`}</style>

      <div style={{paddingBottom:72}}>
        {tab==="home"    &&<HomeTab    month={month} setMonth={setMonth} catSpend={catSpend} netWorth={netWorth} mInc={mInc} mExp={mExp} dInc={dInc} dExp={dExp} data={data} balances={balances} trend={trend} todayTxns={todayTxns} pending={pending} setModal={M}/>}
        {tab==="entries" &&<EntriesTab month={month} setMonth={setMonth} monthTxns={monthTxns} data={data} pending={pending} markPaid={markPaid} delTxn={delTxn} delRec={delRec} exportCSV={exportCSV} setModal={M}/>}
        {tab==="accounts"&&<AccountsTab data={data} balances={balances} netWorth={netWorth} delAcc={delAcc} editAcc={editAcc} editLoan={editLoan} payLoan={payLoan} bankAccounts={bankAccounts} setModal={M}/>}
        {tab==="budgets" &&<BudgetsTab  data={data} catSpend={catSpend} month={month} delBudget={delBudget} setModal={M}/>}
        {tab==="goals"   &&<GoalsTab    data={data} balances={balances} bankAccounts={bankAccounts} delGoal={delGoal} editGoal={editGoal} setModal={M}/>}
      </div>

      {/* FAB */}
      <button onClick={()=>M("txn")} style={{position:"fixed",right:20,bottom:82,width:54,height:54,borderRadius:"50%",background:C.brand,border:"none",color:"#fff",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,200,150,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:30}}><Plus size={22}/></button>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",height:64,zIndex:20,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {TABS.map(({id,Icon,label})=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:tab===id?C.brand:C.muted,fontSize:10,fontWeight:600}}>
            <Icon size={20} strokeWidth={tab===id?2.5:1.8}/>{label}
          </button>
        ))}
      </nav>

      {/* Modals */}
      {modal?.type==="txn"      &&<TxnModal      close={close} data={data} addTxn={addTxn} addRec={addRec} expCats={expCats} incCats={incCats} addCat={addCat} preset={modal}/>}
      {modal?.type==="quickadd" &&<QuickAddModal  close={close} data={data} addTxn={addTxn} cat={modal.cat}/>}
      {modal?.type==="account"  &&<AccountModal   close={close} addAcc={addAcc}/>}
      {modal?.type==="loan"     &&<LoanModal      close={close} addAcc={addAcc}/>}
      {modal?.type==="editacc"  &&<EditAccModal   close={close} account={modal.account} editAcc={editAcc}/>}
      {modal?.type==="editloan" &&<EditLoanModal  close={close} account={modal.account} editLoan={editLoan}/>}
      {modal?.type==="payloan"  &&<PayLoanModal   close={close} loan={modal.loan} bankAccounts={bankAccounts} payLoan={payLoan}/>}
      {modal?.type==="goal"     &&<GoalModal      close={close} addGoal={addGoal} bankAccounts={bankAccounts}/>}
      {modal?.type==="editgoal" &&<EditGoalModal  close={close} goal={modal.goal} editGoal={editGoal}/>}
      {modal?.type==="budget"   &&<BudgetModal    close={close} setBudget={setBudget} expCats={expCats}/>}
      {modal?.type==="import"   &&<ImportModal    close={close} data={data} importTxns={importTxns} expCats={expCats} incCats={incCats}/>}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HomeTab({month,setMonth,catSpend,netWorth,mInc,mExp,dInc,dExp,data,balances,trend,todayTxns,pending,setModal}){
  const [view,setView]=useState("monthly");
  const isD=view==="daily";
  const inc=isD?dInc:mInc, exp=isD?dExp:mExp;
  const pieData=Object.entries(catSpend).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));
  return(
    <div>
      {/* Header */}
      <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",padding:"52px 20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontFamily:"Georgia,serif",fontSize:20,color:C.brand,fontWeight:700}}>💰 MoneyMate</span>
          <div style={{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:20,padding:3}}>
            {["daily","monthly"].map(v=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",borderRadius:16,border:"none",background:view===v?"#fff":"transparent",color:view===v?C.ink:"#B0C9C0",fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{v}</button>
            ))}
          </div>
        </div>
        {!isD&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:14}}>
            <Nbtn onClick={()=>setMonth(prevMo(month))}><ChevronLeft size={16}/></Nbtn>
            <span style={{fontSize:13,color:"#B0C9C0",minWidth:130,textAlign:"center",fontWeight:500}}>{monthLabel(month)}</span>
            <Nbtn onClick={()=>setMonth(nextMo(month))}><ChevronRight size={16}/></Nbtn>
          </div>
        )}
        {isD&&<div style={{fontSize:12,color:"#6B9A8A",textAlign:"center",marginBottom:14}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>}
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,color:"#6B9A8A",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>Net Worth</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:36,fontWeight:700,color:"#fff",lineHeight:1}}>{inr(netWorth)}</div>
          <div style={{display:"flex",marginTop:16}}>
            {[["Income",inc,C.income],["Spent",exp,C.expense],["Saved",inc-exp,(inc-exp)>=0?C.income:C.expense]].map(([l,v,col])=>(
              <div key={l} style={{flex:1,textAlign:"center",borderRight:l!=="Saved"?"1px solid rgba(255,255,255,0.1)":undefined}}>
                <div style={{fontSize:10,color:"#6B9A8A",letterSpacing:"0.06em",textTransform:"uppercase"}}>{l}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:17,fontWeight:700,color:col,marginTop:4}}>{inr(v)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Donut / Daily txns */}
      <Card>
        {!isD&&pieData.length>0?(
          <>
            <Eye>Spending by category — tap a slice to add</Eye>
            <div style={{position:"relative"}}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={88} paddingAngle={2}
                    onClick={s=>setModal("quickadd",{cat:s.name})} style={{cursor:"pointer"}}>
                    {pieData.map((_,i)=><Cell key={i} fill={C.charts[i%C.charts.length]}/>)}
                  </Pie>
                  <Tooltip formatter={v=>inr(v)} contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
              <div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",pointerEvents:"none"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:C.expense}}>{inr(mExp)}</div>
                  <div style={{fontSize:10,color:C.muted,letterSpacing:"0.08em"}}>SPENT</div>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
              {pieData.map(({name,value},i)=>(
                <button key={name} onClick={()=>setModal("quickadd",{cat:name})} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 10px",background:C.bg,borderRadius:10,border:"none",cursor:"pointer"}}>
                  <div style={{width:9,height:9,borderRadius:2,background:C.charts[i%C.charts.length],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.ink,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{CAT_EMOJI[name]||"📌"} {name}</div>
                    <div style={{fontSize:11,color:C.expense,fontWeight:600}}>{inr(value)} · {Math.round(value/mExp*100)}%</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ):!isD?(
          <div style={{textAlign:"center",padding:"28px 0"}}><div style={{fontSize:44,marginBottom:8}}>💸</div><div style={{color:C.muted}}>No expenses in {monthLabel(month)}</div></div>
        ):null}
        {isD&&(
          <>
            <Eye>Today's activity</Eye>
            {todayTxns.length===0?<div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"16px 0"}}>No transactions today.</div>:
              todayTxns.slice(0,8).map(t=>(
                <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,paddingBottom:10,marginBottom:10,borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontSize:20}}>{t.type==="transfer"?"↔️":CAT_EMOJI[t.category]||"📌"}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.category}</div>
                    {t.note&&<div style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.note}</div>}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:t.type==="income"?C.income:t.type==="transfer"?C.xfer:C.expense}}>{t.type==="income"?"+":t.type==="transfer"?"":"-"}{inr(t.amount)}</div>
                </div>
              ))
            }
          </>
        )}
      </Card>

      {/* Planned */}
      {pending.length>0&&(
        <div style={{margin:"12px 16px 0",background:"#FFFBEB",borderRadius:16,padding:"14px 16px",border:"1px solid #FDE68A"}}>
          <Eye style={{color:"#92400E"}}>⏰ Planned this month</Eye>
          {pending.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{CAT_EMOJI[r.category]||"📌"} {r.name}</div><div style={{fontSize:11,color:C.muted}}>Day {r.day} · {r.category}</div></div>
              <span style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:r.type==="income"?C.income:C.expense}}>{r.type==="income"?"+":"−"}{inr(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trend */}
      {!isD&&(
        <Card>
          <Eye>6-month flow</Eye>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trend} margin={{top:4,right:4,left:-20,bottom:0}}>
              <CartesianGrid stroke={C.border} vertical={false}/>
              <XAxis dataKey="m" tick={{fontSize:10,fill:C.muted}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:v}/>
              <Tooltip formatter={v=>inr(v)} contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,fontSize:12}}/>
              <Line type="monotone" dataKey="In" stroke={C.income} strokeWidth={2.5} dot={false}/>
              <Line type="monotone" dataKey="Out" stroke={C.expense} strokeWidth={2.5} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Accounts strip */}
      {data.accounts.filter(a=>a.type!=="Loan").length>0&&(
        <div style={{margin:"12px 16px 16px"}}>
          <Eye style={{paddingLeft:2}}>Accounts</Eye>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4,marginTop:8}}>
            {data.accounts.filter(a=>a.type!=="Loan").map((a,i)=>(
              <div key={a.id} style={{background:C.card,borderRadius:14,padding:"12px 16px",flexShrink:0,minWidth:140,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",borderTop:`3px solid ${C.charts[(i+3)%C.charts.length]}`}}>
                <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{a.name}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:(balances[a.id]||0)<0?C.expense:C.ink,marginTop:4}}>{inr(balances[a.id])}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ENTRIES TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EntriesTab({month,setMonth,monthTxns,data,pending,markPaid,delTxn,delRec,exportCSV,setModal}){
  return(
    <div style={{padding:"52px 16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={H2}>Entries</h2>
        <div style={{display:"flex",gap:8}}>
          <Pill onClick={()=>setModal("import")}><FileUp size={13}/> Import PDF</Pill>
          {data.transactions.length>0&&<Pill onClick={exportCSV}><Download size={13}/> Export</Pill>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.card,borderRadius:12,padding:"10px 16px",marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
        <Nbtn onClick={()=>setMonth(prevMo(month))}><ChevronLeft size={18}/></Nbtn>
        <span style={{fontSize:14,fontWeight:600,color:C.ink}}>{monthLabel(month)}</span>
        <Nbtn onClick={()=>setMonth(nextMo(month))}><ChevronRight size={18}/></Nbtn>
      </div>
      {/* Planned */}
      {pending.length>0&&(
        <div style={{background:"#FFFBEB",borderRadius:14,padding:"12px 14px",marginBottom:14,border:"1px solid #FDE68A"}}>
          <Eye style={{color:"#92400E"}}>⏰ Planned</Eye>
          {pending.map(r=>(
            <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{r.name}</div><div style={{fontSize:11,color:C.muted}}>Day {r.day} · {data.accounts.find(a=>a.id===r.accountId)?.name}</div></div>
              <span style={{fontSize:13,fontWeight:700,color:r.type==="income"?C.income:C.expense}}>{r.type==="income"?"+":"−"}{inr(r.amount)}</span>
              <button onClick={()=>markPaid(r)} style={{background:C.brand,border:"none",borderRadius:8,color:"#fff",fontSize:11,fontWeight:700,padding:"4px 10px",cursor:"pointer"}}>Paid</button>
              <button onClick={()=>delRec(r.id)} style={IBN}><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
      )}
      {monthTxns.length===0&&<div style={{background:C.card,borderRadius:14,padding:24,textAlign:"center",color:C.muted}}>{data.accounts.length===0?"Add an account first.`":`No entries for ${monthLabel(month)}.`}</div>}
      <div style={{display:"grid",gap:8}}>
        {monthTxns.map(t=>{
          const acc=data.accounts.find(a=>a.id===t.accountId);
          const toAcc=data.accounts.find(a=>a.id===t.toAccountId);
          const isInc=t.type==="income",isXfer=t.type==="transfer";
          return(
            <div key={t.id} style={{background:C.card,borderRadius:14,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
              <div style={{width:38,height:38,borderRadius:12,display:"grid",placeItems:"center",flexShrink:0,fontSize:18,background:isXfer?"#EEF3FF":isInc?C.brandDim:"#FFEEEE"}}>{isXfer?"↔️":CAT_EMOJI[t.category]||"📌"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isXfer?`${acc?.name||"?"}→${toAcc?.name||"?"}`:t.category}</div>
                <div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{!isXfer&&acc?` · ${acc.name}`:""}{t.note?` · ${t.note}`:""}</div>
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:700,color:isInc?C.income:isXfer?C.xfer:C.expense,flexShrink:0}}>{isInc?"+":isXfer?"":"−"}{inr(t.amount)}</div>
              <button onClick={()=>delTxn(t.id)} style={IBN}><Trash2 size={14}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACCOUNTS TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AccountsTab({data,balances,netWorth,delAcc,editAcc,editLoan,payLoan,bankAccounts,setModal}){
  const [detail,setDetail]=useState(null);

  if(detail){
    const txns=data.transactions
      .filter(t=>(t.accountId===detail.id||t.toAccountId===detail.id)&&t.date>=last30())
      .sort((a,b)=>b.date.localeCompare(a.date));
    return(
      <div style={{padding:"52px 16px 0"}}>
        <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
        <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:20,marginBottom:16,color:"#fff"}}>
          <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase",letterSpacing:"0.08em"}}>{detail.type}{detail.hint?` · ••••${detail.hint}`:""}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:"#fff",margin:"6px 0"}}>{detail.name}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:34,fontWeight:700,color:(balances[detail.id]||0)<0?C.expense:C.brand}}>{inr(balances[detail.id])}</div>
          <div style={{display:"flex",gap:10,marginTop:14}}>
            <button onClick={()=>setModal("editacc",{account:detail})} style={{flex:1,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"8px 0",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Edit2 size={14}/> Edit</button>
            <button onClick={()=>{if(window.confirm("Delete account?"))delAcc(detail.id);setDetail(null);}} style={{flex:1,background:"rgba(255,90,95,0.2)",border:"1px solid rgba(255,90,95,0.3)",borderRadius:10,padding:"8px 0",color:"#FF5A5F",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Trash2 size={14}/> Delete</button>
          </div>
        </div>
        <Eye>Last 30 days</Eye>
        {txns.length===0&&<div style={{background:C.card,borderRadius:14,padding:20,textAlign:"center",color:C.muted,marginTop:8}}>No transactions in the last 30 days.</div>}
        <div style={{display:"grid",gap:8,marginTop:8}}>
          {txns.map(t=>{
            const isInc=t.type==="income"||(t.type==="transfer"&&t.toAccountId===detail.id);
            const fromA=data.accounts.find(a=>a.id===t.accountId);
            const toA  =data.accounts.find(a=>a.id===t.toAccountId);
            return(
              <div key={t.id} style={{background:C.card,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{width:34,height:34,borderRadius:10,display:"grid",placeItems:"center",fontSize:16,background:isInc?C.brandDim:"#FFEEEE",flexShrink:0}}>{t.type==="transfer"?"↔️":CAT_EMOJI[t.category]||"📌"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.type==="transfer"?`${t.toAccountId===detail.id?`From ${fromA?.name}`:` To ${toA?.name}`}`:t.category}</div>
                  <div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{t.note?` · ${t.note}`:""}</div>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:isInc?C.income:C.expense,flexShrink:0}}>{isInc?"+":"−"}{inr(t.amount)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"52px 16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={H2}>Accounts</h2>
        <div style={{display:"flex",gap:8}}>
          <Pbtn onClick={()=>setModal("account")}><Plus size={15}/> Account</Pbtn>
          <Pbtn onClick={()=>setModal("loan")} style={{background:"#FF5A5F"}}><Plus size={15}/> Loan</Pbtn>
        </div>
      </div>
      <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:"16px 20px",marginBottom:16}}>
        <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase",letterSpacing:"0.08em"}}>Net Worth (assets − liabilities)</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,color:netWorth<0?C.expense:"#fff",marginTop:6}}>{inr(netWorth)}</div>
      </div>
      {data.accounts.length===0&&<div style={{background:C.card,borderRadius:14,padding:24,textAlign:"center",color:C.muted}}>No accounts yet.</div>}
      <div style={{display:"grid",gap:12}}>
        {data.accounts.map((a,i)=>{
          if(a.type==="Loan"){
            const paid=Math.max(0,(a.sanctionedAmount||0)-(a.outstandingAmount||0));
            const pct =a.sanctionedAmount?Math.min(100,paid/(a.sanctionedAmount)*100):0;
            return(
              <div key={a.id} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",borderLeft:"4px solid #FF5A5F"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:C.ink}}>{a.name}</div>
                    <div style={{fontSize:12,color:C.muted,marginTop:2}}>{a.loanType||"Loan"}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setModal("editloan",{account:a})} style={IBN}><Edit2 size={15}/></button>
                    <button onClick={()=>{if(window.confirm("Delete loan?"))delAcc(a.id);}} style={IBN}><Trash2 size={15}/></button>
                  </div>
                </div>
                <div style={{marginTop:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                    <span style={{color:C.brand,fontWeight:600}}>Paid {inr(paid)}</span>
                    <span style={{color:C.muted}}>Sanctioned {inr(a.sanctionedAmount||0)}</span>
                  </div>
                  <div style={{height:14,background:"#FFE8E8",borderRadius:7,overflow:"hidden",position:"relative"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${C.brand},#00A07A)`,borderRadius:7,transition:"width .4s"}}/>
                    <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:9,fontWeight:700,color:pct>55?"#fff":C.expense}}>{Math.round(pct)}% paid</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginTop:6}}>
                    <span>Outstanding</span>
                    <span style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:700,color:C.expense}}>−{inr(a.outstandingAmount||0)}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button onClick={()=>setModal("payloan",{loan:a})} style={{flex:1,background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:"8px 0",color:C.brand,fontWeight:700,fontSize:13,cursor:"pointer"}}>💳 Pay EMI</button>
                  <button onClick={()=>setModal("editloan",{account:a})} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 0",color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>Update Balance</button>
                </div>
              </div>
            );
          }
          return(
            <div key={a.id} onClick={()=>setDetail(a)} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",borderLeft:`4px solid ${C.charts[(i+3)%C.charts.length]}`,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink}}>{a.name}</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:2}}>{a.type}{a.hint?` · ••••${a.hint}`:""}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={e=>{e.stopPropagation();setModal("editacc",{account:a});}} style={IBN}><Edit2 size={15}/></button>
                  <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete account?"))delAcc(a.id);}} style={IBN}><Trash2 size={15}/></button>
                </div>
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:26,fontWeight:700,color:(balances[a.id]||0)<0?C.expense:C.ink,marginTop:12}}>{inr(balances[a.id])}</div>
              <div style={{fontSize:11,color:C.muted,marginTop:8}}>Tap to see last 30 days →</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BUDGETS TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function BudgetsTab({data,catSpend,month,delBudget,setModal}){
  const [detail,setDetail]=useState(null);

  if(detail){
    const txns=data.transactions.filter(t=>t.category===detail.cat&&t.type==="expense"&&mkKey(t.date)===month).sort((a,b)=>b.date.localeCompare(a.date));
    const spent=catSpend[detail.cat]||0, pct=Math.min(100,(spent/detail.limit)*100), over=spent>detail.limit;
    return(
      <div style={{padding:"52px 16px 0"}}>
        <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
        <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <span style={{fontSize:36}}>{CAT_EMOJI[detail.cat]||"📌"}</span>
            <div><div style={{fontSize:18,fontWeight:700,color:C.ink}}>{detail.cat}</div><div style={{fontSize:13,color:C.muted}}>{monthLabel(month)}</div></div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:11,color:C.muted}}>Spent</div><div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:over?C.expense:C.ink}}>{inr(spent)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.muted}}>Budget</div><div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:C.muted}}>{inr(detail.limit)}</div></div>
          </div>
          <div style={{height:10,background:C.bg,borderRadius:5}}>
            <div style={{width:`${pct}%`,height:"100%",background:over?C.expense:pct>80?C.gold:C.brand,borderRadius:5}}/>
          </div>
          <div style={{fontSize:12,color:over?C.expense:C.brand,fontWeight:600,marginTop:8}}>{over?`Over by ${inr(spent-detail.limit)}`:`${inr(detail.limit-spent)} remaining`}</div>
        </div>
        <Eye>Transactions this month</Eye>
        {txns.length===0&&<div style={{background:C.card,borderRadius:14,padding:20,textAlign:"center",color:C.muted,marginTop:8}}>No expenses in this category.</div>}
        <div style={{display:"grid",gap:8,marginTop:8}}>
          {txns.map(t=>(
            <div key={t.id} style={{background:C.card,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600}}>{t.note||t.category}</div>
                <div style={{fontSize:11,color:C.muted}}>{new Date(t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}{data.accounts.find(a=>a.id===t.accountId)?` · ${data.accounts.find(a=>a.id===t.accountId).name}`:""}</div>
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:700,color:C.expense}}>−{inr(t.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div style={{padding:"52px 16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <h2 style={H2}>Budgets</h2>
        <Pbtn onClick={()=>setModal("budget")}><Plus size={15}/> Add</Pbtn>
      </div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>{monthLabel(month)}</div>
      {Object.keys(data.budgets).length===0&&<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🎯</div>Set monthly limits and track spending.</div>}
      <div style={{display:"grid",gap:12}}>
        {Object.entries(data.budgets).map(([cat,limit])=>{
          const spent=catSpend[cat]||0, pct=Math.min(100,(spent/limit)*100), over=spent>limit;
          return(
            <div key={cat} onClick={()=>setDetail({cat,limit})} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>{CAT_EMOJI[cat]||"📌"}</span>
                  <div><div style={{fontSize:14,fontWeight:700,color:C.ink}}>{cat}</div><div style={{fontSize:11,color:C.muted}}>{inr(spent)} of {inr(limit)}</div></div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:16,fontWeight:700,color:over?C.expense:pct>80?C.gold:C.brand}}>{Math.round(pct)}%</div>
                  {over&&<div style={{fontSize:10,color:C.expense,fontWeight:600}}>+{inr(spent-limit)}</div>}
                </div>
              </div>
              <div style={{height:8,background:C.bg,borderRadius:4}}>
                <div style={{width:`${pct}%`,height:"100%",background:over?C.expense:pct>80?C.gold:C.brand,borderRadius:4,transition:"width .3s"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                <span style={{fontSize:11,color:over?C.expense:C.muted,fontWeight:600}}>{over?`Over by ${inr(spent-limit)}`:`${inr(limit-spent)} left`}</span>
                <button onClick={e=>{e.stopPropagation();delBudget(cat);}} style={{...IBN,fontSize:11,color:C.muted}}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GOALS TAB
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GoalsTab({data,balances,bankAccounts,delGoal,editGoal,setModal}){
  const [detail,setDetail]=useState(null);
  const getSaved=g=>{
    if(g.linkType==="account"&&g.linkedAccountId)return balances[g.linkedAccountId]||0;
    if(g.linkType==="investment")return g.investmentValue||0;
    return g.saved||0;
  };

  if(detail){
    const g=data.goals.find(x=>x.id===detail);
    if(!g){setDetail(null);return null;}
    const saved=getSaved(g), pct=Math.min(100,(saved/g.target)*100), done=pct>=100;
    const linkedAcc=g.linkType==="account"?data.accounts.find(a=>a.id===g.linkedAccountId):null;
    return(
      <div style={{padding:"52px 16px 0"}}>
        <button onClick={()=>setDetail(null)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.brand,fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:16,padding:0}}><ArrowLeft size={18}/> Back</button>
        <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:20,marginBottom:16,color:"#fff"}}>
          <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>{g.linkType==="account"?"Bank Goal":g.linkType==="investment"?g.investmentType:"Savings Goal"}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,margin:"6px 0"}}>{g.name}</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:32,fontWeight:700,color:done?C.brand:C.gold}}>{inr(saved)}</div>
          <div style={{fontSize:12,color:"#6B9A8A"}}>of {inr(g.target)} target</div>
          <div style={{height:8,background:"rgba(255,255,255,0.1)",borderRadius:4,marginTop:14}}>
            <div style={{width:`${pct}%`,height:"100%",background:done?C.brand:C.gold,borderRadius:4}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12,color:"#6B9A8A"}}>
            <span>{Math.round(pct)}% reached</span><span>{done?"🎉 Goal achieved!":inr(g.target-saved)+" to go"}</span>
          </div>
        </div>
        {g.linkType==="account"&&linkedAcc&&(
          <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <Eye>Linked account</Eye>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <div><div style={{fontSize:14,fontWeight:700}}>{linkedAcc.name}</div><div style={{fontSize:12,color:C.muted}}>Balance reflects automatically</div></div>
              <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.brand}}>{inr(balances[linkedAcc.id]||0)}</div>
            </div>
          </div>
        )}
        {g.linkType==="investment"&&(
          <div style={{background:C.card,borderRadius:14,padding:16,marginBottom:14,boxShadow:"0 1px 6px rgba(0,0,0,0.05)"}}>
            <Eye>Investment</Eye>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
              <div><div style={{fontSize:14,fontWeight:700}}>{g.investmentType}</div><div style={{fontSize:12,color:C.muted}}>Last updated {g.investmentValueDate||"—"}</div></div>
              <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,color:C.gold}}>{inr(g.investmentValue||0)}</div>
            </div>
            <button onClick={()=>setModal("editgoal",{goal:g})} style={{marginTop:12,display:"flex",alignItems:"center",gap:6,background:C.brandDim,border:`1px solid ${C.brand}`,borderRadius:10,padding:"8px 14px",color:C.brand,fontWeight:700,fontSize:13,cursor:"pointer"}}><RefreshCw size={14}/> Update value</button>
          </div>
        )}
        {g.linkType==="none"&&!done&&(
          <button onClick={()=>{const a=+window.prompt("Amount to add (₹):");if(a>0)editGoal(g.id,{saved:(g.saved||0)+a});}} style={{...SB,marginBottom:14}}>+ Add Money</button>
        )}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setModal("editgoal",{goal:g})} style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 0",color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Edit2 size={14}/> Edit</button>
          <button onClick={()=>{if(window.confirm("Delete goal?"))delGoal(g.id);setDetail(null);}} style={{background:"#FFF0F0",border:`1px solid #FFD0D0`,borderRadius:12,padding:"11px 16px",color:C.expense,fontWeight:700,fontSize:14,cursor:"pointer"}}><Trash2 size={16}/></button>
        </div>
      </div>
    );
  }

  const totalSaved=data.goals.reduce((s,g)=>s+getSaved(g),0);
  const totalTarget=data.goals.reduce((s,g)=>s+g.target,0);
  return(
    <div style={{padding:"52px 16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h2 style={H2}>Goals</h2>
        <Pbtn onClick={()=>setModal("goal")}><Plus size={15}/> New Goal</Pbtn>
      </div>
      {data.goals.length>0&&(
        <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:16,padding:16,marginBottom:16}}>
          <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase",letterSpacing:"0.08em"}}>Total saved</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:26,fontWeight:700,color:C.brand,marginTop:4}}>{inr(totalSaved)}</div>
          <div style={{height:6,background:"rgba(255,255,255,0.1)",borderRadius:3,marginTop:10}}>
            <div style={{width:`${Math.min(100,totalSaved/totalTarget*100)}%`,height:"100%",background:C.brand,borderRadius:3}}/>
          </div>
          <div style={{fontSize:11,color:"#6B9A8A",marginTop:6}}>{inr(totalTarget-totalSaved)} to go</div>
        </div>
      )}
      {data.goals.length===0&&<div style={{background:C.card,borderRadius:14,padding:28,textAlign:"center",color:C.muted}}><div style={{fontSize:40,marginBottom:10}}>🪙</div>Create savings goals or track investments.</div>}
      <div style={{display:"grid",gap:12}}>
        {data.goals.map(g=>{
          const saved=getSaved(g), pct=Math.min(100,(saved/g.target)*100), done=pct>=100;
          const linkedAcc=g.linkType==="account"?data.accounts.find(a=>a.id===g.linkedAccountId):null;
          return(
            <div key={g.id} onClick={()=>setDetail(g.id)} style={{background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.06)",border:done?`1px solid ${C.brand}`:`1px solid ${C.border}`,cursor:"pointer"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink}}>{done?"🎉 ":""}{g.name}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>
                    {g.linkType==="account"&&linkedAcc?`🏦 ${linkedAcc.name}`:g.linkType==="investment"?`📈 ${g.investmentType}`:"🪙 Manual"}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:700,color:done?C.brand:C.ink}}>{inr(saved)}</div>
                  <div style={{fontSize:11,color:done?C.brand:C.muted,fontWeight:600}}>{Math.round(pct)}% of {inr(g.target)}</div>
                </div>
              </div>
              <div style={{height:8,background:C.bg,borderRadius:4}}>
                <div style={{width:`${pct}%`,height:"100%",background:done?C.brand:g.linkType==="investment"?C.xfer:C.gold,borderRadius:4,transition:"width .4s"}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MODALS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function QuickAddModal({close,data,addTxn,cat}){
  const [amt,setAmt]=useState(""), [accId,setAccId]=useState(data.accounts.filter(a=>a.type!=="Loan")[0]?.id||"");
  const p=evalExpr(amt);
  const go=()=>{const a=evalExpr(amt);if(!a||a<=0||!accId)return;addTxn({type:"expense",amount:a,category:cat,accountId:accId,date:today(),note:""});close();};
  return(
    <Sheet close={close}>
      <div style={{textAlign:"center",marginBottom:18}}><div style={{fontSize:40}}>{CAT_EMOJI[cat]||"📌"}</div><div style={{fontSize:18,fontWeight:700,marginTop:6}}>{cat}</div></div>
      <L>Amount (₹)</L><input autoFocus style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0"/>
      {/[+\-*/]/.test(String(amt).slice(1))&&!isNaN(p)&&<div style={{fontSize:12,color:C.brand,marginTop:-8,marginBottom:10,fontWeight:600}}>= {inr(p)}</div>}
      <L>Account</L>
      <select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{data.accounts.filter(a=>a.type!=="Loan").map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
        <button onClick={close} style={{padding:"12px 0",borderRadius:12,border:`1px solid ${C.border}`,background:C.bg,color:C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>Cancel</button>
        <button onClick={go} style={{padding:"12px 0",borderRadius:12,border:"none",background:C.expense,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>Add</button>
      </div>
    </Sheet>
  );
}

function TxnModal({close,data,addTxn,addRec,expCats,incCats,addCat,preset}){
  const [tp,setTp]=useState("expense");
  const [amt,setAmt]=useState("");
  const [cat,setCat]=useState(preset?.cat||expCats[0]);
  const [accId,setAccId]=useState(data.accounts.filter(a=>a.type!=="Loan")[0]?.id||"");
  const [toId,setToId]=useState(data.accounts.filter(a=>a.type!=="Loan")[1]?.id||data.accounts.filter(a=>a.type!=="Loan")[0]?.id||"");
  const [date,setDate]=useState(today());
  const [note,setNote]=useState("");
  const [rep,setRep]=useState(false);
  const [newCat,setNewCat]=useState("");
  const [showNC,setShowNC]=useState(false);
  const cats=tp==="income"?incCats:expCats;
  const p=evalExpr(amt);
  const go=()=>{
    const a=evalExpr(amt);if(!a||a<=0||!accId)return;
    addTxn({type:tp,amount:a,category:tp==="transfer"?"Transfer":cat,accountId:accId,toAccountId:tp==="transfer"?toId:undefined,date,note});
    if(rep&&tp!=="transfer")addRec({name:note||cat,type:tp,amount:a,category:cat,accountId:accId,day:+date.slice(8,10)||1});
    close();
  };
  const nonLoan=data.accounts.filter(a=>a.type!=="Loan");
  return(
    <Sheet close={close} title="New Entry">
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["expense","income","transfer"].map(t=>(
          <button key={t} onClick={()=>{setTp(t);setCat(t==="income"?incCats[0]:expCats[0]);}}
            style={{flex:1,padding:"9px 0",borderRadius:10,border:`1px solid ${tp===t?C.brand:C.border}`,background:tp===t?C.brandDim:"#fff",color:tp===t?C.brand:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>
        ))}
      </div>
      <L>Amount (₹)</L>
      <input style={F} inputMode="decimal" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0  or  200+150"/>
      {/[+\-*/]/.test(String(amt).slice(1))&&!isNaN(p)&&<div style={{fontSize:12,color:C.brand,marginTop:-8,marginBottom:10,fontWeight:600}}>= {inr(p)}</div>}
      {tp!=="transfer"&&(
        <>
          <L>Category</L>
          <select style={F} value={cat} onChange={e=>e.target.value==="__new"?setShowNC(true):(setCat(e.target.value),setShowNC(false))}>
            {cats.map(c=><option key={c}>{c}</option>)}<option value="__new">➕ New category…</option>
          </select>
          {showNC&&<div style={{display:"flex",gap:6,marginTop:-8,marginBottom:12}}>
            <input style={{...F,marginBottom:0,flex:1}} value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="Category name"/>
            <button onClick={()=>{if(newCat.trim()){addCat(tp,newCat);setCat(newCat.trim());setNewCat("");setShowNC(false);}}} style={{background:C.brand,border:"none",borderRadius:10,padding:"0 14px",color:"#fff",fontWeight:700,cursor:"pointer"}}>Add</button>
          </div>}
        </>
      )}
      <L>{tp==="transfer"?"From":"Account"}</L>
      <select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      {tp==="transfer"&&(<><L>To account</L><select style={F} value={toId} onChange={e=>setToId(e.target.value)}>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></>)}
      <L>Date</L><input style={F} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      <L>Note (optional)</L><input style={F} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. groceries at DMart"/>
      {tp!=="transfer"&&<label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,marginBottom:14,cursor:"pointer"}}><input type="checkbox" checked={rep} onChange={e=>setRep(e.target.checked)} style={{width:16,height:16,accentColor:C.brand}}/>Repeat every month</label>}
      <button onClick={go} style={SB}>Save Entry</button>
    </Sheet>
  );
}

function AccountModal({close,addAcc}){
  const [f,setF]=useState({name:"",type:"Bank",opening:"",hint:""});
  const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="New Account">
    <L>Name</L><input style={F} value={f.name} onChange={s("name")} placeholder="e.g. HDFC Savings"/>
    <L>Type</L><select style={F} value={f.type} onChange={s("type")}>{ACCOUNT_TYPES.filter(t=>t!=="Loan").map(t=><option key={t}>{t}</option>)}</select>
    <L>Current balance (₹)</L><input style={F} type="number" value={f.opening} onChange={s("opening")} placeholder="0"/>
    <L>Last 4 digits of account no. (for PDF auto-match)</L><input style={F} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")} placeholder="e.g. 4821"/>
    <button onClick={()=>{if(!f.name)return;addAcc({name:f.name,type:f.type,opening:+f.opening||0,hint:f.hint.trim()});close();}} style={SB}>Save Account</button>
  </Sheet>);
}

function EditAccModal({close,account,editAcc}){
  const [f,setF]=useState({name:account.name,opening:account.opening||0,hint:account.hint||""});
  const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="Edit Account">
    <L>Name</L><input style={F} value={f.name} onChange={s("name")}/>
    <L>Opening / base balance (₹)</L><input style={F} type="number" value={f.opening} onChange={s("opening")}/>
    <p style={{fontSize:12,color:C.muted,marginTop:-8}}>Transactions are added on top of this balance.</p>
    <L>Last 4 digits</L><input style={F} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")}/>
    <button onClick={()=>{if(!f.name)return;editAcc(account.id,{name:f.name,opening:+f.opening||0,hint:f.hint.trim()});close();}} style={SB}>Save Changes</button>
  </Sheet>);
}

function LoanModal({close,addAcc}){
  const [f,setF]=useState({name:"",loanType:LOAN_TYPES[0],sanctioned:"",outstanding:""});
  const s=k=>e=>setF({...f,[k]:e.target.value});
  return(<Sheet close={close} title="Add Loan">
    <L>Loan name</L><input style={F} value={f.name} onChange={s("name")} placeholder="e.g. SBI Car Loan"/>
    <L>Loan type</L><select style={F} value={f.loanType} onChange={s("loanType")}>{LOAN_TYPES.map(t=><option key={t}>{t}</option>)}</select>
    <L>Sanctioned / total amount (₹)</L><input style={F} type="number" value={f.sanctioned} onChange={s("sanctioned")} placeholder="780000"/>
    <L>Current outstanding (₹)</L><input style={F} type="number" value={f.outstanding} onChange={s("outstanding")} placeholder="576797"/>
    <p style={{fontSize:12,color:C.muted,marginTop:-8}}>The fuel bar fills as you pay off the loan.</p>
    <button onClick={()=>{if(!f.name||!f.sanctioned)return;addAcc({name:f.name,type:"Loan",loanType:f.loanType,sanctionedAmount:+f.sanctioned,outstandingAmount:+f.outstanding||0,opening:0,hint:""});close();}} style={SB}>Add Loan</button>
  </Sheet>);
}

function EditLoanModal({close,account,editLoan}){
  const [out,setOut]=useState(account.outstandingAmount||0);
  const paid=Math.max(0,(account.sanctionedAmount||0)-out);
  const pct=account.sanctionedAmount?Math.min(100,paid/account.sanctionedAmount*100):0;
  return(<Sheet close={close} title="Update Outstanding">
    <div style={{background:"linear-gradient(160deg,#0D1B2A,#0B3D2E)",borderRadius:14,padding:16,marginBottom:16,color:"#fff",textAlign:"center"}}>
      <div style={{fontSize:11,color:"#6B9A8A",textTransform:"uppercase"}}>{account.loanType} · {account.name}</div>
      <div style={{height:10,background:"rgba(255,255,255,0.1)",borderRadius:5,margin:"12px 0 6px"}}>
        <div style={{width:`${pct}%`,height:"100%",background:C.brand,borderRadius:5}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#6B9A8A"}}>
        <span>Paid: {inr(paid)}</span><span>Total: {inr(account.sanctionedAmount||0)}</span>
      </div>
    </div>
    <L>Current outstanding (₹)</L>
    <input autoFocus style={F} type="number" value={out} onChange={e=>setOut(e.target.value)} placeholder="Enter latest outstanding"/>
    <p style={{fontSize:12,color:C.muted,marginTop:-8}}>Get this from your latest bank statement.</p>
    <button onClick={()=>{editLoan(account.id,+out);close();}} style={SB}>Update</button>
  </Sheet>);
}

function PayLoanModal({close,loan,bankAccounts,payLoan}){
  const [amt,setAmt]=useState("");
  const [bankId,setBankId]=useState(bankAccounts[0]?.id||"");
  const [note,setNote]=useState(`${loan.loanType||"Loan"} EMI`);
  const a=evalExpr(amt);
  return(<Sheet close={close} title={`Pay EMI — ${loan.name}`}>
    <div style={{background:"#FFF8E8",borderRadius:12,padding:14,marginBottom:14,border:"1px solid #FDE68A"}}>
      <div style={{fontSize:12,color:"#92400E",fontWeight:600}}>Outstanding</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:24,fontWeight:700,color:C.expense}}>{inr(loan.outstandingAmount||0)}</div>
      <div style={{fontSize:11,color:"#92400E",marginTop:4}}>Outstanding reduces by your EMI amount after payment.</div>
    </div>
    <L>EMI amount (₹)</L><input autoFocus style={F} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="e.g. 14500"/>
    <L>Pay from</L>
    <select style={F} value={bankId} onChange={e=>setBankId(e.target.value)}>{bankAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <L>Note</L><input style={F} value={note} onChange={e=>setNote(e.target.value)}/>
    <button onClick={()=>{if(!a||a<=0||!bankId)return;payLoan(loan.id,bankId,a,note);close();}} style={SB}>Pay {!isNaN(a)&&a>0?inr(a):""}</button>
  </Sheet>);
}

function GoalModal({close,addGoal,bankAccounts}){
  const [name,setName]=useState(""),   [target,setTarget]=useState("");
  const [lt,setLt]=useState("none"),   [accId,setAccId]=useState(bankAccounts[0]?.id||"");
  const [iType,setIType]=useState(INVEST_TYPES[0]), [iVal,setIVal]=useState("");
  const [saved,setSaved]=useState("");
  const go=()=>{
    if(!name||!target)return;
    const g={name,target:+target,linkType:lt};
    if(lt==="none")         g.saved=+saved||0;
    if(lt==="account")      g.linkedAccountId=accId;
    if(lt==="investment")   {g.investmentType=iType;g.investmentValue=+iVal||0;g.investmentValueDate=today();}
    addGoal(g);close();
  };
  return(<Sheet close={close} title="New Goal">
    <L>Goal name</L><input style={F} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Emergency Fund"/>
    <L>Target amount (₹)</L><input style={F} type="number" value={target} onChange={e=>setTarget(e.target.value)} placeholder="100000"/>
    <L>Link type</L>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
      {[["none","🪙 Manual"],["account","🏦 Bank"],["investment","📈 Invest"]].map(([v,l])=>(
        <button key={v} onClick={()=>setLt(v)} style={{padding:"10px 4px",borderRadius:10,border:`1px solid ${lt===v?C.brand:C.border}`,background:lt===v?C.brandDim:"#fff",color:lt===v?C.brand:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{l}</button>
      ))}
    </div>
    {lt==="none"&&<><L>Already saved (₹)</L><input style={F} type="number" value={saved} onChange={e=>setSaved(e.target.value)} placeholder="0"/></>}
    {lt==="account"&&(bankAccounts.length>0?(<><L>Bank account</L><select style={F} value={accId} onChange={e=>setAccId(e.target.value)}>{bankAccounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><p style={{fontSize:12,color:C.muted,marginTop:-8}}>Progress = account balance.</p></>):<p style={{fontSize:13,color:C.expense}}>No Bank accounts found.</p>)}
    {lt==="investment"&&<><L>Investment type</L><select style={F} value={iType} onChange={e=>setIType(e.target.value)}>{INVEST_TYPES.map(t=><option key={t}>{t}</option>)}</select><L>Current value (₹)</L><input style={F} type="number" value={iVal} onChange={e=>setIVal(e.target.value)} placeholder="0"/></>}
    <button onClick={go} style={SB}>Save Goal</button>
  </Sheet>);
}

function EditGoalModal({close,goal,editGoal}){
  const [name,setName]=useState(goal.name),  [target,setTarget]=useState(goal.target);
  const [iVal,setIVal]=useState(goal.investmentValue||"");
  if(goal.linkType==="investment"){
    return(<Sheet close={close} title="Update Value">
      <div style={{textAlign:"center",marginBottom:18}}>
        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase"}}>Current value</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:28,fontWeight:700,color:C.gold}}>{inr(goal.investmentValue||0)}</div>
        <div style={{fontSize:12,color:C.muted}}>{goal.investmentType}</div>
      </div>
      <L>New current value (₹)</L>
      <input autoFocus style={F} type="number" value={iVal} onChange={e=>setIVal(e.target.value)} placeholder="Latest value"/>
      <button onClick={()=>{if(!iVal)return;editGoal(goal.id,{investmentValue:+iVal,investmentValueDate:today()});close();}} style={SB}>Update</button>
    </Sheet>);
  }
  return(<Sheet close={close} title="Edit Goal">
    <L>Goal name</L><input style={F} value={name} onChange={e=>setName(e.target.value)}/>
    <L>Target (₹)</L><input style={F} type="number" value={target} onChange={e=>setTarget(e.target.value)}/>
    <button onClick={()=>{if(!name||!target)return;editGoal(goal.id,{name,target:+target});close();}} style={SB}>Save Changes</button>
  </Sheet>);
}

function BudgetModal({close,setBudget,expCats}){
  const [cat,setCat]=useState(expCats[0]), [amt,setAmt]=useState("");
  return(<Sheet close={close} title="Set Budget">
    <L>Category</L><select style={F} value={cat} onChange={e=>setCat(e.target.value)}>{expCats.map(c=><option key={c}>{c}</option>)}</select>
    <L>Monthly limit (₹)</L><input style={F} type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="5000"/>
    <button onClick={()=>{if(!amt)return;setBudget(cat,+amt);close();}} style={SB}>Save Budget</button>
  </Sheet>);
}

/* PDF Import Modal */
function ImportModal({close,data,importTxns,expCats,incCats}){
  const [step,setStep] =useState("pick");
  const [file,setFile] =useState(null);
  const [pwd,setPwd]   =useState("");
  const [needPwd,setNP]=useState(false);
  const [accId,setAId] =useState(data.accounts.filter(a=>a.type!=="Loan")[0]?.id||"");
  const [rows,setRows] =useState([]);
  const [err,setErr]   =useState("");
  const [res,setRes]   =useState(null);

  const parse=async()=>{
    if(!file)return;setErr("");setStep("parsing");
    try{
      const lib=await loadPdf(), buf=await file.arrayBuffer();
      let pdf;
      try{pdf=await lib.getDocument({data:buf,password:pwd||undefined}).promise;}
      catch(e){
        if(e&&(e.name==="PasswordException"||/password/i.test(e.message||""))){
          setNP(true);setErr(pwd?"Wrong password.":"PDF is password-protected. Enter the password.");setStep("pick");return;
        }
        throw e;
      }
      const lines=await extractLines(pdf);
      const blob=lines.join(" ");
      const hit=data.accounts.find(a=>a.hint&&a.hint.length>=4&&new RegExp(`${a.hint}\\b`).test(blob));
      if(hit)setAId(hit.id);
      const parsed=parseStatement(lines,data.accounts);
      if(!parsed.length){setErr("No transactions found. Use a digital e-statement from netbanking (not a scanned PDF).");setStep("pick");return;}
      // Pre-select Transfer for likely transfers
      const withXfer=parsed.map(r=>r.isXfer?{...r,type:"transfer"}:r);
      setRows(withXfer);setStep("review");
    }catch(e){setErr(e.message||"Could not read PDF.");setStep("pick");}
  };

  const doImport=()=>{const r=importTxns(rows.filter(r=>r.include),accId);setRes(r);setStep("done");};
  const toggle  =k=>setRows(rows.map(r=>r.key===k?{...r,include:!r.include}:r));
  const setType =k=>t=>setRows(rows.map(r=>r.key===k?{...r,type:t,category:t==="transfer"?r.category:guessCat(r.desc,t)}:r));
  const setCat  =k=>c=>setRows(rows.map(r=>r.key===k?{...r,category:c}:r));
  const setXferTo=k=>id=>setRows(rows.map(r=>r.key===k?{...r,xferToId:id}:r));
  const included=rows.filter(r=>r.include).length;
  const nonLoan=data.accounts.filter(a=>a.type!=="Loan");

  return(<Sheet close={close} title="Import Statement">
    {step==="pick"&&<>
      <p style={{fontSize:13,color:C.muted,marginTop:0}}>Pick a bank e-statement PDF. Parsed on your device — nothing uploaded.</p>
      <L>PDF file</L><input type="file" accept="application/pdf" style={{...F,padding:8}} onChange={e=>{setFile(e.target.files[0]||null);setErr("");}}/>
      {needPwd&&<><L>PDF password</L><input style={F} type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Statement password"/></>}
      <L>Import into account</L>
      <select style={F} value={accId} onChange={e=>setAId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}{a.hint?` ··${a.hint}`:""}</option>)}</select>
      {err&&<p style={{fontSize:13,color:C.expense,fontWeight:500}}>{err}</p>}
      <button onClick={parse} disabled={!file} style={{...SB,background:file?C.brand:"#ccc",cursor:file?"pointer":"default"}}>Read Statement</button>
    </>}
    {step==="parsing"&&<p style={{textAlign:"center",color:C.muted,padding:"32px 0"}}>Reading your statement…</p>}
    {step==="review"&&<>
      <p style={{fontSize:13,color:C.muted,marginTop:0}}>Found <b style={{color:C.ink}}>{rows.length}</b> transactions. Transfers flagged automatically — verify before importing.</p>
      <L>Account</L>
      <select style={F} value={accId} onChange={e=>setAId(e.target.value)}>{nonLoan.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <div style={{display:"grid",gap:8,maxHeight:"44vh",overflowY:"auto"}}>
        {rows.map(r=>(
          <div key={r.key} style={{border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 12px",opacity:r.include?1:0.4}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="checkbox" checked={r.include} onChange={()=>toggle(r.key)} style={{width:18,height:18,accentColor:C.brand,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.desc||"(no description)"}</div>
                <div style={{fontSize:10,color:C.muted}}>{new Date(r.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>
              </div>
              <span style={{fontFamily:"Georgia,serif",fontSize:13,fontWeight:700,color:r.type==="income"?C.income:r.type==="transfer"?C.xfer:C.expense,flexShrink:0}}>{r.type==="income"?"+":r.type==="transfer"?"↔":"-"}{inr(r.amount)}</span>
            </div>
            {r.include&&<div style={{display:"grid",gap:4,marginTop:8}}>
              <div style={{display:"flex",gap:6}}>
                <select value={r.type} onChange={e=>setType(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11,flex:1}}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer (own account)</option>
                </select>
                {r.type!=="transfer"&&<select value={r.category} onChange={e=>setCat(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11,flex:2}}>{(r.type==="income"?incCats:expCats).map(c=><option key={c}>{c}</option>)}</select>}
              </div>
              {r.type==="transfer"&&<select value={r.xferToId||""} onChange={e=>setXferTo(r.key)(e.target.value)} style={{...F,marginBottom:0,padding:"5px 8px",fontSize:11}}>
                <option value="">— Select destination account —</option>
                {data.accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>}
            </div>}
          </div>
        ))}
      </div>
      <button onClick={doImport} disabled={!included} style={{...SB,marginTop:12,background:included?C.brand:"#ccc",cursor:included?"pointer":"default",position:"sticky",bottom:0}}>Import {included} transaction{included===1?"":"s"}</button>
    </>}
    {step==="done"&&res&&<div style={{textAlign:"center",padding:"28px 0"}}>
      <div style={{fontSize:48,marginBottom:12}}>✅</div>
      <div style={{fontSize:16,fontWeight:700,color:C.ink}}>Imported {res.added} transaction{res.added===1?"":"s"}</div>
      {res.skipped>0&&<div style={{fontSize:13,color:C.muted,marginTop:6}}>{res.skipped} duplicate{res.skipped===1?"":"s"} skipped</div>}
      <button onClick={close} style={{...SB,marginTop:20}}>Done</button>
    </div>}
  </Sheet>);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SHARED PRIMITIVES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Sheet({children,close,title}){
  return(
    <div onClick={close} style={{position:"fixed",inset:0,background:"rgba(10,20,30,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:50}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:560,padding:"20px 20px calc(20px + env(safe-area-inset-bottom))",maxHeight:"90vh",overflowY:"auto"}}>
        {title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:700,margin:0,color:C.ink}}>{title}</h2>
          <button onClick={close} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",padding:4}}><X size={20}/></button>
        </div>}
        {children}
      </div>
    </div>
  );
}
function Card({children}){return <div style={{margin:"16px 16px 0",background:C.card,borderRadius:16,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>{children}</div>;}
function Nbtn({children,onClick}){return <button onClick={onClick} style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",width:30,height:30,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{children}</button>;}
function Pbtn({children,onClick,style}){return <button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"8px 14px",borderRadius:12,border:"none",background:C.brand,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",...style}}>{children}</button>;}
function Pill({children,onClick}){return <button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:`1px solid ${C.border}`,background:C.card,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer"}}>{children}</button>;}
function Eye({children,style}){return <div style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8,...style}}>{children}</div>;}
const H2 ={fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,margin:0};
const IBN={background:"none",border:"none",color:"#BCC5CF",cursor:"pointer",padding:4};
const F  ={width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",fontSize:14,color:C.ink,background:"#FAFAFA",marginBottom:12};
const L  =({children})=><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:5,letterSpacing:"0.06em",textTransform:"uppercase"}}>{children}</div>;
const SB ={width:"100%",background:C.brand,border:"none",borderRadius:12,padding:"13px 0",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4};
