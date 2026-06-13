/* ─────────────────────────────────────────────────────────────────
   MONEYMATE  ·  Smart Money Tracker
   ─────────────────────────────────────────────────────────────────*/
import { useState, useEffect, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Wallet, PiggyBank, Target, LayoutDashboard, List,
  Plus, Trash2, X, ChevronLeft, ChevronRight,
  Download, FileUp, CheckCircle2,
} from "lucide-react";

/* ── Design tokens ───────────────────────────────────────────────── */
const C = {
  bg:       "#F0F4F8",
  card:     "#FFFFFF",
  ink:      "#1A2332",
  muted:    "#6B7A8D",
  border:   "#E2E8F0",
  brand:    "#00C896",
  brandDim: "#E6FBF5",
  income:   "#00C896",
  expense:  "#FF5A5F",
  xfer:     "#5B8DEF",
  gold:     "#FFA726",
  dark:     "#0D1B2A",
  charts: ["#FF5A5F","#FF9F43","#FFA726","#00C896","#5B8DEF",
           "#A55EEA","#26D9A7","#FC5C7D","#6C5CE7","#00B8D9","#78909C"],
};

/* ── Categories ──────────────────────────────────────────────────── */
const EXPENSE_CATS  = ["Food","Groceries","Transport","Rent","Utilities","Shopping","Health","Entertainment","EMI","Education","Other"];
const INCOME_CATS   = ["Salary","Business","Interest","Gift","Other"];
const ACCOUNT_TYPES = ["Bank","UPI / Wallet","Cash","Credit Card"];
const CAT_EMOJI = {
  Food:"🍜", Groceries:"🛒", Transport:"🚗", Rent:"🏠", Utilities:"⚡",
  Shopping:"🛍️", Health:"💊", Entertainment:"🎬", EMI:"🏦", Education:"📚",
  Other:"📌", Salary:"💼", Business:"📈", Interest:"💰", Gift:"🎁", Transfer:"↔️",
};

/* ── Utilities ───────────────────────────────────────────────────── */
const inr  = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const uid  = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const curMo = () => today().slice(0, 7);
const mkKey = (d) => d.slice(0, 7);
const monthLabel = (mk) => {
  const [y, m] = mk.split("-");
  return new Date(+y, +m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};
const prevMo = (mk) => { const d = new Date(mk + "-01"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const nextMo = (mk) => { const d = new Date(mk + "-01"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); };

/* Safe expression evaluator — "200+150" → 350 */
function evalExpr(s) {
  s = String(s || "").replace(/\s+/g, "").replace(/,/g, "");
  if (!s || !/^[\d+\-*/().]+$/.test(s)) return NaN;
  let i = 0;
  const expr = () => { let v = term(); while (s[i] === "+" || s[i] === "-") { const op = s[i++]; const r = term(); v = op === "+" ? v + r : v - r; } return v; };
  const term = () => { let v = fact(); while (s[i] === "*" || s[i] === "/") { const op = s[i++]; const r = fact(); v = op === "*" ? v * r : v / r; } return v; };
  const fact = () => {
    if (s[i] === "(") { i++; const v = expr(); if (s[i] === ")") i++; return v; }
    if (s[i] === "-") { i++; return -fact(); }
    let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++;
    const v = parseFloat(s.slice(i, j)); i = j; return v;
  };
  const v = expr();
  return i === s.length && isFinite(v) ? v : NaN;
}

/* ── Data model ──────────────────────────────────────────────────── */
const EMPTY = {
  accounts: [], transactions: [], budgets: {}, goals: [],
  recurring: [], customCats: { expense: [], income: [] },
};
const normalize = (d) => ({
  ...EMPTY, ...d,
  recurring:   d.recurring   || [],
  customCats:  { expense: [], income: [], ...(d.customCats || {}) },
});

/* ── AES-256-GCM encryption ──────────────────────────────────────── */
const ENC = new TextEncoder();
const DEC = new TextDecoder();
const b64e = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = (s)   => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey("raw", ENC.encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function encryptData(data, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(pin, salt);
  const ct   = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, ENC.encode(JSON.stringify(data)));
  return JSON.stringify({ salt: b64e(salt), iv: b64e(iv), ct: b64e(ct) });
}
async function decryptData(stored, pin) {
  const { salt, iv, ct } = JSON.parse(stored);
  const key = await deriveKey(pin, b64d(salt));
  const pt  = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(iv) }, key, b64d(ct));
  return normalize(JSON.parse(DEC.decode(pt)));
}

/* ── PDF statement parser ────────────────────────────────────────── */
const PDF_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const loadPdf = () => new Promise((res, rej) => {
  if (window.pdfjsLib) return res(window.pdfjsLib);
  const s = document.createElement("script");
  s.src = `${PDF_CDN}/pdf.min.js`;
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDF_CDN}/pdf.worker.min.js`; res(window.pdfjsLib); };
  s.onerror = () => rej(new Error("PDF reader failed to load"));
  document.head.appendChild(s);
});
async function extractLines(pdf) {
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc   = await page.getTextContent();
    const rows = new Map();
    tc.items.forEach(it => {
      if (!it.str.trim()) return;
      const y = Math.round(it.transform[5] / 3) * 3;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: it.transform[4], str: it.str });
    });
    [...rows.keys()].sort((a, b) => b - a).forEach(y => {
      const line = rows.get(y).sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}
const MONTHS  = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
const DATE_RE = /^(\d{1,2})[\/\-. ]([A-Za-z]{3}|\d{1,2})[\/\-. ](\d{2,4})\b/;
const AMT_RE  = /(?:\d{1,3}(?:,\d{2,3})+|\d+)\.\d{2}\b/g;
const toISO   = (d, m, y) => {
  const mm = isNaN(+m) ? MONTHS[m.toLowerCase().slice(0, 3)] : +m;
  let yy = +y; if (String(y).length === 2) yy += 2000;
  if (!mm || mm > 12 || +d > 31) return null;
  return `${yy}-${String(mm).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
};
const CAT_RULES = [
  [/swiggy|zomato|dominos|mcdonald|kfc|restaurant|cafe/i, "Food"],
  [/blinkit|zepto|bigbasket|grofers|dmart|grocery/i,      "Groceries"],
  [/uber|ola|rapido|irctc|metro|petrol|hpcl|iocl|bpcl|fastag/i, "Transport"],
  [/rent\b|landlord/i, "Rent"],
  [/electricity|bescom|tneb|jio|airtel|broadband|dth|gas/i, "Utilities"],
  [/amazon|flipkart|myntra|ajio|nykaa|shopping/i, "Shopping"],
  [/pharmacy|apollo|medplus|hospital|1mg/i,       "Health"],
  [/netflix|spotify|hotstar|bookmyshow|prime|pvr/i,"Entertainment"],
  [/\bemi\b|loan/i, "EMI"],
  [/school|college|udemy|tuition|byjus/i, "Education"],
];
const INC_RULES = [
  [/salary|sal cr|payroll/i, "Salary"],
  [/interest|int\.? cr/i,    "Interest"],
  [/refund|cashback|reversal/i, "Other"],
];
const guessCategory = (desc, type) => {
  const rules = type === "income" ? INC_RULES : CAT_RULES;
  for (const [re, cat] of rules) if (re.test(desc)) return cat;
  return "Other";
};
function parseStatement(lines) {
  const out = []; let prevBal = null;
  for (const line of lines) {
    const dm = line.match(DATE_RE); if (!dm) continue;
    const date = toISO(dm[1], dm[2], dm[3]); if (!date) continue;
    const amts = (line.match(AMT_RE) || []).map(a => parseFloat(a.replace(/,/g, "")));
    if (!amts.length) continue;
    let amount, type = null;
    if (amts.length >= 2) {
      const balance = amts[amts.length - 1];
      amount = amts[amts.length - 2];
      if (prevBal !== null && Math.abs(Math.abs(prevBal - balance) - amount) < 0.01)
        type = balance < prevBal ? "expense" : "income";
      prevBal = balance;
    } else { amount = amts[0]; }
    if (!type) type = /\bcr\b|credit|deposit|received/i.test(line) ? "income" : "expense";
    if (!amount || amount <= 0) continue;
    const desc = line.replace(DATE_RE, "").replace(AMT_RE, "").replace(/\s+/g, " ").trim().slice(0, 60);
    out.push({ date, amount, type, desc, category: guessCategory(desc, type), include: true, key: uid() });
  }
  return out;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PIN SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PinScreen({ isSetup, onSetup, onUnlock, error, setError, onForgot }) {
  const [digits, setDigits] = useState([]);
  const [stage,  setStage]  = useState(1);   // 1 = enter, 2 = confirm (setup only)
  const [first,  setFirst]  = useState("");

  const push = (d) => {
    if (digits.length >= 4) return;
    const next = [...digits, String(d)];
    setDigits(next);
    if (next.length === 4) {
      const p = next.join("");
      setTimeout(() => {
        if (!isSetup) {
          onUnlock(p);
          setDigits([]);
        } else if (stage === 1) {
          setFirst(p); setStage(2); setDigits([]); setError("");
        } else {
          if (p === first) { onSetup(p); }
          else { setError("PINs don't match — try again"); setStage(1); setFirst(""); setDigits([]); }
        }
      }, 120);
    }
  };
  const pop   = () => setDigits(d => d.slice(0, -1));
  const label = isSetup ? (stage === 1 ? "Set a 4-digit PIN" : "Confirm your PIN") : "Enter your PIN";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0D1B2A 0%,#0B3D2E 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "Inter,system-ui,sans-serif" }}>
      <div style={{ fontSize: 52, marginBottom: 12 }}>💰</div>
      <h1 style={{ color: C.brand, fontFamily: "Georgia,serif", fontSize: 30, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.5px" }}>MoneyMate</h1>
      <p style={{ color: "#6B9A8A", fontSize: 13, margin: "0 0 52px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Smart Money Tracker</p>
      <p style={{ color: "#B0C9C0", fontSize: 15, marginBottom: 24, fontWeight: 500 }}>{label}</p>
      <div style={{ display: "flex", gap: 18, marginBottom: 36 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: digits.length > i ? C.brand : "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.2)", transition: "background 0.15s" }} />
        ))}
      </div>
      {error && <p style={{ color: C.expense, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,76px)", gap: 14 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k, i) => (
          <button key={i} onClick={() => k === "⌫" ? pop() : k !== "" ? push(k) : null} disabled={k === ""}
            style={{ width: 76, height: 76, borderRadius: "50%", border: "none", fontSize: k === "⌫" ? 22 : 26, fontWeight: 600, cursor: k === "" ? "default" : "pointer", color: "#fff", fontFamily: "inherit",
              background: k === "" ? "transparent" : k === "⌫" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            {k}
          </button>
        ))}
      </div>
      {!isSetup && (
        <button onClick={onForgot} style={{ color: "#5A8A7A", background: "none", border: "none", fontSize: 13, marginTop: 40, cursor: "pointer", textDecoration: "underline" }}>
          Forgot PIN? Reset app
        </button>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP ROOT — handles PIN gate
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | setup | lock | app
  const [pin,   setPin]   = useState("");
  const [err,   setErr]   = useState("");
  const [data,  setData]  = useState(EMPTY);

  /* Check if app has been set up before */
  useEffect(() => {
    setPhase(localStorage.getItem("mm:setup") ? "lock" : "setup");
  }, []);

  /* Save encrypted data */
  const persist = async (next, pinOverride) => {
    setData(next);
    try {
      const encrypted = await encryptData(next, pinOverride || pin);
      localStorage.setItem("mm:data", encrypted);
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  /* First-time setup — called with confirmed PIN */
  const handleSetup = async (p) => {
    try {
      const encrypted = await encryptData(EMPTY, p);
      localStorage.setItem("mm:data", encrypted);
      localStorage.setItem("mm:setup", "1");
    } catch (e) {
      console.error("Setup save failed:", e);
    }
    setPin(p);
    setData(EMPTY);
    setPhase("app");
  };

  /* Unlock — verify PIN by attempting decryption */
  const handleUnlock = async (p) => {
    try {
      const raw = localStorage.getItem("mm:data");
      const d   = raw ? await decryptData(raw, p) : EMPTY;
      setPin(p); setData(d); setErr(""); setPhase("app");
    } catch {
      setErr("Wrong PIN — try again");
    }
  };

  /* Reset app */
  const handleForgot = () => {
    if (window.confirm("This will permanently delete all your data. Are you sure?")) {
      localStorage.clear();
      setPhase("setup");
      setErr("");
    }
  };

  if (phase === "loading") return (
    <div style={{ minHeight: "100vh", background: C.dark, display: "grid", placeItems: "center", fontSize: 48 }}>💰</div>
  );
  if (phase === "setup") return <PinScreen isSetup onSetup={handleSetup} error={err} setError={setErr} />;
  if (phase === "lock")  return <PinScreen onUnlock={handleUnlock} error={err} setError={setErr} onForgot={handleForgot} />;
  return <FinanceApp data={data} persist={persist} />;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FINANCE APP
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FinanceApp({ data, persist }) {
  const [tab,   setTab]   = useState("home");
  const [month, setMonth] = useState(curMo());
  const [modal, setModal] = useState(null);

  /* ── Mutations ───────────────────────────────────────────────── */
  const addTxn    = (t)       => persist({ ...data, transactions: [...data.transactions, { ...t, id: uid() }] });
  const delTxn    = (id)      => persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) });
  const addAcc    = (a)       => persist({ ...data, accounts: [...data.accounts, { ...a, id: uid() }] });
  const delAcc    = (id)      => persist({ ...data, accounts: data.accounts.filter(a => a.id !== id), transactions: data.transactions.filter(t => t.accountId !== id && t.toAccountId !== id) });
  const addGoal   = (g)       => persist({ ...data, goals: [...data.goals, { ...g, id: uid(), saved: +g.saved || 0 }] });
  const delGoal   = (id)      => persist({ ...data, goals: data.goals.filter(g => g.id !== id) });
  const fundGoal  = (id, amt) => persist({ ...data, goals: data.goals.map(g => g.id === id ? { ...g, saved: g.saved + amt } : g) });
  const setBudget = (cat, amt)=> persist({ ...data, budgets: { ...data.budgets, [cat]: amt } });
  const delBudget = (cat)     => { const n = { ...data.budgets }; delete n[cat]; persist({ ...data, budgets: n }); };
  const addCat    = (kind, name) => { const n = name.trim(); if (!n) return; persist({ ...data, customCats: { ...data.customCats, [kind]: [...data.customCats[kind], n] } }); };
  const addRec    = (r)       => persist({ ...data, recurring: [...data.recurring, { ...r, id: uid(), lastDone: "" }] });
  const delRec    = (id)      => persist({ ...data, recurring: data.recurring.filter(r => r.id !== id) });
  const markPaid  = (rec)     => {
    const mk = curMo(), [y, m] = mk.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const date = `${mk}-${String(Math.min(rec.day, lastDay)).padStart(2, "0")}`;
    persist({ ...data,
      transactions: [...data.transactions, { id: uid(), type: rec.type, amount: rec.amount, category: rec.category, accountId: rec.accountId, date, note: rec.name, source: "recurring" }],
      recurring:    data.recurring.map(r => r.id === rec.id ? { ...r, lastDone: mk } : r),
    });
  };
  const importTxns = (rows, accountId) => {
    const ex = new Set(data.transactions.map(t => `${t.accountId}|${t.date}|${(+t.amount).toFixed(2)}|${t.type}`));
    let added = 0, skipped = 0;
    const fresh = [];
    rows.forEach(r => {
      const k = `${accountId}|${r.date}|${r.amount.toFixed(2)}|${r.type}`;
      if (ex.has(k)) { skipped++; return; }
      ex.add(k);
      fresh.push({ id: uid(), type: r.type, amount: r.amount, category: r.category, accountId, date: r.date, note: r.desc, source: "import" });
      added++;
    });
    persist({ ...data, transactions: [...data.transactions, ...fresh] });
    return { added, skipped };
  };
  const exportCSV = () => {
    const head = "Date,Type,Category,Account,Amount,Note\n";
    const body = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => {
      const acc = data.accounts.find(a => a.id === t.accountId)?.name || "";
      const q   = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
      return [t.date, t.type, q(t.category), q(acc), t.amount, q(t.note)].join(",");
    }).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a   = document.createElement("a"); a.href = url; a.download = `moneymate-${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Derived ─────────────────────────────────────────────────── */
  const expCats = [...EXPENSE_CATS, ...data.customCats.expense];
  const incCats = [...INCOME_CATS,  ...data.customCats.income];

  const balances = useMemo(() => {
    const b = {};
    data.accounts.forEach(a => b[a.id] = +a.opening || 0);
    data.transactions.forEach(t => {
      const amt = +t.amount || 0;
      if      (t.type === "income")   b[t.accountId]  = (b[t.accountId]  || 0) + amt;
      else if (t.type === "expense")  b[t.accountId]  = (b[t.accountId]  || 0) - amt;
      else if (t.type === "transfer") { b[t.accountId] = (b[t.accountId] || 0) - amt; b[t.toAccountId] = (b[t.toAccountId] || 0) + amt; }
    });
    return b;
  }, [data]);

  const netWorth  = Object.values(balances).reduce((s, v) => s + v, 0);
  const monthTxns = data.transactions.filter(t => mkKey(t.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const mIncome   = monthTxns.filter(t => t.type === "income").reduce((s, t)  => s + +t.amount, 0);
  const mExpense  = monthTxns.filter(t => t.type === "expense").reduce((s, t) => s + +t.amount, 0);
  const catSpend  = useMemo(() => { const m = {}; monthTxns.filter(t => t.type === "expense").forEach(t => { m[t.category] = (m[t.category] || 0) + +t.amount; }); return m; }, [monthTxns]);
  const pending   = data.recurring.filter(r => r.lastDone !== curMo());
  const trend     = useMemo(() => {
    const out = []; const now = new Date(month + "-01");
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tx = data.transactions.filter(t => mkKey(t.date) === mk);
      out.push({ m: d.toLocaleString("en-IN", { month: "short" }), In: tx.filter(t => t.type === "income").reduce((s, t) => s + +t.amount, 0), Out: tx.filter(t => t.type === "expense").reduce((s, t) => s + +t.amount, 0) });
    }
    return out;
  }, [data, month]);

  const shared = { data, month, setMonth, setModal, balances, netWorth, mIncome, mExpense, catSpend, monthTxns, trend, expCats, incCats, pending, markPaid, delTxn, delAcc, delGoal, fundGoal, delBudget, delRec, exportCSV };

  const TABS = [
    { id: "home",    Icon: LayoutDashboard, label: "Home"     },
    { id: "entries", Icon: List,            label: "Entries"  },
    { id: "accounts",Icon: Wallet,          label: "Accounts" },
    { id: "budgets", Icon: Target,          label: "Budgets"  },
    { id: "goals",   Icon: PiggyBank,       label: "Goals"    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Inter,system-ui,sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        input:focus, select:focus { outline: none; border-color: #00C896 !important; }
      `}</style>

      <div style={{ paddingBottom: 72 }}>
        {tab === "home"     && <HomeScreen     {...shared} />}
        {tab === "entries"  && <EntriesScreen  {...shared} />}
        {tab === "accounts" && <AccountsScreen {...shared} />}
        {tab === "budgets"  && <BudgetsScreen  {...shared} />}
        {tab === "goals"    && <GoalsScreen    {...shared} />}
      </div>

      {/* FAB */}
      <button onClick={() => setModal({ type: "txn" })}
        style={{ position: "fixed", right: 20, bottom: 82, width: 54, height: 54, borderRadius: "50%", background: C.brand, border: "none", color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,200,150,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30 }}>
        <Plus size={22} />
      </button>

      {/* Bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", height: 64, zIndex: 20, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: tab === id ? C.brand : C.muted, fontSize: 10, fontWeight: 600 }}>
            <Icon size={20} strokeWidth={tab === id ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </nav>

      {/* Modals */}
      {modal?.type === "txn"     && <TxnModal     modal={modal} close={() => setModal(null)} data={data} addTxn={addTxn} addRec={addRec} expCats={expCats} incCats={incCats} addCat={addCat} />}
      {modal?.type === "quickadd"&& <QuickAddModal modal={modal} close={() => setModal(null)} data={data} addTxn={addTxn} />}
      {modal?.type === "account" && <AccountModal  close={() => setModal(null)} addAcc={addAcc} />}
      {modal?.type === "goal"    && <GoalModal     close={() => setModal(null)} addGoal={addGoal} />}
      {modal?.type === "budget"  && <BudgetModal   close={() => setModal(null)} setBudget={setBudget} expCats={expCats} />}
      {modal?.type === "fund"    && <FundModal     goal={modal.goal} close={() => setModal(null)} fundGoal={fundGoal} />}
      {modal?.type === "import"  && <ImportModal   close={() => setModal(null)} data={data} importTxns={importTxns} expCats={expCats} incCats={incCats} />}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOME SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HomeScreen({ data, month, setMonth, setModal, balances, netWorth, mIncome, mExpense, catSpend, trend, pending }) {
  const pieData = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  return (
    <div>
      {/* Header */}
      <div style={{ background: "linear-gradient(160deg,#0D1B2A 0%,#0B3D2E 100%)", padding: "52px 20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 20, color: C.brand, fontWeight: 700 }}>💰 MoneyMate</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <NavBtn onClick={() => setMonth(prevMo(month))}><ChevronLeft size={16} /></NavBtn>
            <span style={{ fontSize: 13, color: "#B0C9C0", minWidth: 108, textAlign: "center", fontWeight: 500 }}>{monthLabel(month)}</span>
            <NavBtn onClick={() => setMonth(nextMo(month))}><ChevronRight size={16} /></NavBtn>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6B9A8A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Net Worth</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 38, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{inr(netWorth)}</div>
          <div style={{ display: "flex", marginTop: 18 }}>
            {[["Income", mIncome, C.income], ["Spent", mExpense, C.expense], ["Saved", mIncome - mExpense, mIncome - mExpense >= 0 ? C.income : C.expense]].map(([lbl, val, col]) => (
              <div key={lbl} style={{ flex: 1, textAlign: "center", borderRight: lbl !== "Saved" ? "1px solid rgba(255,255,255,0.1)" : undefined }}>
                <div style={{ fontSize: 10, color: "#6B9A8A", letterSpacing: "0.06em", textTransform: "uppercase" }}>{lbl}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, color: col, marginTop: 4 }}>{inr(val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Donut chart */}
      <SectionCard>
        {pieData.length > 0 ? (
          <>
            <Eyebrow>Tap a slice to quick-add</Eyebrow>
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2}
                    onClick={s => setModal({ type: "quickadd", cat: s.name })} style={{ cursor: "pointer" }}>
                    {pieData.map((_, i) => <Cell key={i} fill={C.charts[i % C.charts.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => inr(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: C.expense }}>{inr(mExpense)}</div>
                  <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>SPENT</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              {pieData.slice(0, 6).map(({ name, value }, i) => (
                <button key={name} onClick={() => setModal({ type: "quickadd", cat: name })}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.bg, borderRadius: 10, border: "none", cursor: "pointer" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: C.charts[i % C.charts.length], flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{CAT_EMOJI[name] || "📌"} {name}</div>
                    <div style={{ fontSize: 11, color: C.expense, fontWeight: 600 }}>{inr(value)}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>💸</div>
            <div style={{ color: C.muted, fontSize: 14 }}>No expenses yet for {monthLabel(month)}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Tap + to add your first entry</div>
          </div>
        )}
      </SectionCard>

      {/* Planned payments */}
      {pending.length > 0 && (
        <div style={{ margin: "12px 16px 0", background: "#FFFBEB", borderRadius: 16, padding: "14px 16px", border: "1px solid #FDE68A" }}>
          <Eyebrow style={{ color: "#92400E" }}>⏰ Planned this month</Eyebrow>
          {pending.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{CAT_EMOJI[r.category] || "📌"} {r.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Day {r.day} · {r.category}</div>
              </div>
              <span style={{ fontFamily: "Georgia,serif", fontSize: 14, fontWeight: 700, color: r.type === "income" ? C.income : C.expense }}>{r.type === "income" ? "+" : "−"}{inr(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 6-month trend */}
      <SectionCard>
        <Eyebrow>6-month flow</Eyebrow>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={C.border} vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: C.muted }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
            <Tooltip formatter={v => inr(v)} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
            <Line type="monotone" dataKey="In"  stroke={C.income}  strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="Out" stroke={C.expense} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
          {[["Income", C.income], ["Expense", C.expense]].map(([l, col]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.muted }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: col }} />{l}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Account scroll */}
      {data.accounts.length > 0 && (
        <div style={{ margin: "12px 16px 16px" }}>
          <Eyebrow style={{ paddingLeft: 4 }}>Accounts</Eyebrow>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginTop: 8 }}>
            {data.accounts.map((a, i) => (
              <div key={a.id} style={{ background: C.card, borderRadius: 14, padding: "12px 16px", flexShrink: 0, minWidth: 140, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderTop: `3px solid ${C.charts[(i + 3) % C.charts.length]}` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: (balances[a.id] || 0) < 0 ? C.expense : C.ink, marginTop: 4 }}>{inr(balances[a.id])}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{a.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ENTRIES SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EntriesScreen({ data, month, setMonth, setModal, monthTxns, delTxn, pending, markPaid, delRec, exportCSV, balances }) {
  return (
    <div style={{ padding: "52px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={headStyle}>Entries</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Pill onClick={() => setModal({ type: "import" })}><FileUp size={13} /> Import</Pill>
          {data.transactions.length > 0 && <Pill onClick={exportCSV}><Download size={13} /> Export</Pill>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card, borderRadius: 12, padding: "10px 16px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <NavBtn onClick={() => setMonth(prevMo(month))}><ChevronLeft size={18} /></NavBtn>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{monthLabel(month)}</span>
        <NavBtn onClick={() => setMonth(nextMo(month))}><ChevronRight size={18} /></NavBtn>
      </div>
      {pending.length > 0 && (
        <div style={{ background: "#FFFBEB", borderRadius: 14, padding: "12px 14px", marginBottom: 14, border: "1px solid #FDE68A" }}>
          <Eyebrow style={{ color: "#92400E" }}>⏰ Planned</Eyebrow>
          {pending.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Day {r.day} · {data.accounts.find(a => a.id === r.accountId)?.name}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: r.type === "income" ? C.income : C.expense }}>{r.type === "income" ? "+" : "−"}{inr(r.amount)}</span>
              <button onClick={() => markPaid(r)} style={{ background: C.brand, border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", cursor: "pointer" }}>Paid</button>
              <button onClick={() => delRec(r.id)} style={iconBtn}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
      {monthTxns.length === 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: "center", color: C.muted }}>
          {data.accounts.length === 0 ? "Add an account first, then log entries against it." : `No entries for ${monthLabel(month)}. Tap + to add one.`}
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {monthTxns.map(t => {
          const acc = data.accounts.find(a => a.id === t.accountId);
          const to  = data.accounts.find(a => a.id === t.toAccountId);
          const isInc = t.type === "income", isXfer = t.type === "transfer";
          return (
            <div key={t.id} style={{ background: C.card, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 18, background: isXfer ? "#EEF3FF" : isInc ? C.brandDim : "#FFEEEE" }}>
                {isXfer ? "↔️" : CAT_EMOJI[t.category] || "📌"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isXfer ? `${acc?.name || "?"} → ${to?.name || "?"}` : t.category}
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {!isXfer && acc ? ` · ${acc.name}` : ""}{t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 15, fontWeight: 700, color: isInc ? C.income : isXfer ? C.xfer : C.expense, flexShrink: 0 }}>
                {isInc ? "+" : isXfer ? "" : "−"}{inr(t.amount)}
              </div>
              <button onClick={() => delTxn(t.id)} style={iconBtn}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ACCOUNTS SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function AccountsScreen({ data, setModal, balances, netWorth, delAcc }) {
  return (
    <div style={{ padding: "52px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={headStyle}>Accounts</h2>
        <PrimaryBtn onClick={() => setModal({ type: "account" })}><Plus size={15} /> Add</PrimaryBtn>
      </div>
      <div style={{ background: C.dark, borderRadius: 16, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#6B9A8A", letterSpacing: "0.08em", textTransform: "uppercase" }}>Total Net Worth</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 32, fontWeight: 700, color: "#fff", marginTop: 6 }}>{inr(netWorth)}</div>
      </div>
      {data.accounts.length === 0 && <div style={{ background: C.card, borderRadius: 14, padding: 24, textAlign: "center", color: C.muted }}>No accounts yet. Add a bank, UPI wallet, or cash account.</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {data.accounts.map((a, i) => (
          <div key={a.id} style={{ background: C.card, borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", borderLeft: `4px solid ${C.charts[(i + 3) % C.charts.length]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{a.name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{a.type}{a.hint ? ` · ••••${a.hint}` : ""}</div>
              </div>
              <button onClick={() => delAcc(a.id)} style={iconBtn}><Trash2 size={15} /></button>
            </div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, color: (balances[a.id] || 0) < 0 ? C.expense : C.ink, marginTop: 12 }}>{inr(balances[a.id])}</div>
            <div style={{ height: 4, background: C.bg, borderRadius: 2, marginTop: 10 }}>
              <div style={{ height: "100%", width: `${Math.min(100, Math.abs(balances[a.id] || 0) / (Math.abs(netWorth) || 1) * 100)}%`, background: C.charts[(i + 3) % C.charts.length], borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   BUDGETS SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function BudgetsScreen({ data, setModal, catSpend, month, delBudget }) {
  return (
    <div style={{ padding: "52px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={headStyle}>Budgets</h2>
        <PrimaryBtn onClick={() => setModal({ type: "budget" })}><Plus size={15} /> Add</PrimaryBtn>
      </div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{monthLabel(month)}</div>
      {Object.keys(data.budgets).length === 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: 28, textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
          Set monthly limits per category and track how you're doing.
        </div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {Object.entries(data.budgets).map(([cat, limit]) => {
          const spent = catSpend[cat] || 0;
          const pct   = Math.min(100, (spent / limit) * 100);
          const over  = spent > limit;
          const color = over ? C.expense : pct > 80 ? C.gold : C.brand;
          return (
            <div key={cat} style={{ background: C.card, borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{CAT_EMOJI[cat] || "📌"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{cat}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{inr(spent)} of {inr(limit)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color }}>{Math.round(pct)}%</div>
                  {over && <div style={{ fontSize: 10, color: C.expense, fontWeight: 600 }}>+{inr(spent - limit)}</div>}
                </div>
              </div>
              <div style={{ height: 8, background: C.bg, borderRadius: 4 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .3s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <span style={{ fontSize: 11, color: over ? C.expense : C.muted, fontWeight: 600 }}>{over ? `Over by ${inr(spent - limit)}` : `${inr(limit - spent)} left`}</span>
                <button onClick={() => delBudget(cat)} style={{ ...iconBtn, fontSize: 11, color: C.muted }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GOALS SCREEN
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GoalsScreen({ data, setModal, delGoal, fundGoal }) {
  const totalSaved  = data.goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = data.goals.reduce((s, g) => s + g.target, 0);
  return (
    <div style={{ padding: "52px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={headStyle}>Goals</h2>
        <PrimaryBtn onClick={() => setModal({ type: "goal" })}><Plus size={15} /> New Goal</PrimaryBtn>
      </div>
      {data.goals.length > 0 && (
        <div style={{ background: C.dark, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#6B9A8A", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total saved</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, color: C.brand, marginTop: 4 }}>{inr(totalSaved)}</div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, marginTop: 10 }}>
            <div style={{ width: `${Math.min(100, (totalSaved / totalTarget) * 100)}%`, height: "100%", background: C.brand, borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 11, color: "#6B9A8A", marginTop: 6 }}>{inr(totalTarget - totalSaved)} to go</div>
        </div>
      )}
      {data.goals.length === 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: 28, textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🪙</div>
          Create savings goals — emergency fund, vacation, phone — and watch them fill up.
        </div>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {data.goals.map(g => {
          const pct  = Math.min(100, (g.saved / g.target) * 100);
          const done = pct >= 100;
          return (
            <div key={g.id} style={{ background: C.card, borderRadius: 16, padding: 16, boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: done ? `1px solid ${C.brand}` : `1px solid ${C.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{done ? "🎉 " : ""}{g.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Target: {inr(g.target)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: done ? C.brand : C.ink }}>{inr(g.saved)}</div>
                  <div style={{ fontSize: 11, color: done ? C.brand : C.muted, fontWeight: 600 }}>{Math.round(pct)}%</div>
                </div>
              </div>
              <div style={{ height: 10, background: C.bg, borderRadius: 5 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: done ? C.brand : C.gold, borderRadius: 5, transition: "width .4s" }} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {!done && <button onClick={() => setModal({ type: "fund", goal: g })} style={{ flex: 1, background: C.brandDim, border: `1px solid ${C.brand}`, borderRadius: 10, padding: "8px 0", color: C.brand, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Add Money</button>}
                <button onClick={() => delGoal(g.id)} style={iconBtn}><Trash2 size={16} /></button>
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

/* Quick-add (Monefy style — category pre-filled, just enter amount) */
function QuickAddModal({ modal, close, data, addTxn }) {
  const [amt, setAmt]     = useState("");
  const [accId, setAccId] = useState(data.accounts[0]?.id || "");
  const preview = evalExpr(amt);
  const submit  = () => {
    const a = evalExpr(amt); if (!a || a <= 0 || !accId) return;
    addTxn({ type: "expense", amount: a, category: modal.cat, accountId: accId, date: today(), note: "" });
    close();
  };
  return (
    <Sheet close={close}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 40 }}>{CAT_EMOJI[modal.cat] || "📌"}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, marginTop: 6 }}>{modal.cat}</div>
        <div style={{ fontSize: 12, color: C.muted }}>Quick expense</div>
      </div>
      <label style={lbl}>Amount (₹)</label>
      <input autoFocus style={field} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0" />
      {/[+\-*/]/.test(String(amt).slice(1)) && !isNaN(preview) && <div style={{ fontSize: 12, color: C.brand, marginTop: -8, marginBottom: 10, fontWeight: 600 }}>= {inr(preview)}</div>}
      <label style={lbl}>Account</label>
      <select style={field} value={accId} onChange={e => setAccId(e.target.value)}>
        {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
        <button onClick={close}   style={{ padding: "12px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        <button onClick={submit}  style={{ padding: "12px 0", borderRadius: 12, border: "none", background: C.expense, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add</button>
      </div>
    </Sheet>
  );
}

/* Full entry modal */
function TxnModal({ modal, close, data, addTxn, addRec, expCats, incCats, addCat }) {
  const [tp,      setTp]     = useState("expense");
  const [amt,     setAmt]    = useState("");
  const [cat,     setCat]    = useState(expCats[0]);
  const [accId,   setAccId]  = useState(data.accounts[0]?.id || "");
  const [toId,    setToId]   = useState(data.accounts[1]?.id || data.accounts[0]?.id || "");
  const [date,    setDate]   = useState(today());
  const [note,    setNote]   = useState("");
  const [repeat,  setRepeat] = useState(false);
  const [newCat,  setNewCat] = useState("");
  const [showNew, setShowNew]= useState(false);
  const cats    = tp === "income" ? incCats : expCats;
  const preview = evalExpr(amt);
  const submit  = () => {
    const a = evalExpr(amt); if (!a || a <= 0 || !accId) return;
    addTxn({ type: tp, amount: a, category: tp === "transfer" ? "Transfer" : cat, accountId: accId, toAccountId: tp === "transfer" ? toId : undefined, date, note });
    if (repeat && tp !== "transfer") addRec({ name: note || cat, type: tp, amount: a, category: cat, accountId: accId, day: +date.slice(8, 10) || 1 });
    close();
  };
  return (
    <Sheet close={close} title="New Entry">
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {["expense", "income", "transfer"].map(t => (
          <button key={t} onClick={() => { setTp(t); setCat(t === "income" ? incCats[0] : expCats[0]); }}
            style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${tp === t ? C.brand : C.border}`, background: tp === t ? C.brandDim : "#fff", color: tp === t ? C.brand : C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
            {t}
          </button>
        ))}
      </div>
      <label style={lbl}>Amount (₹)</label>
      <input style={field} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0  or  200+150" />
      {/[+\-*/]/.test(String(amt).slice(1)) && !isNaN(preview) && <div style={{ fontSize: 12, color: C.brand, marginTop: -8, marginBottom: 10, fontWeight: 600 }}>= {inr(preview)}</div>}
      {tp !== "transfer" && (
        <>
          <label style={lbl}>Category</label>
          <select style={field} value={cat} onChange={e => e.target.value === "__new" ? setShowNew(true) : (setCat(e.target.value), setShowNew(false))}>
            {cats.map(c => <option key={c}>{c}</option>)}
            <option value="__new">➕ New category…</option>
          </select>
          {showNew && (
            <div style={{ display: "flex", gap: 6, marginTop: -8, marginBottom: 12 }}>
              <input style={{ ...field, marginBottom: 0, flex: 1 }} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Category name" />
              <button onClick={() => { if (newCat.trim()) { addCat(tp, newCat); setCat(newCat.trim()); setNewCat(""); setShowNew(false); } }} style={{ background: C.brand, border: "none", borderRadius: 10, padding: "0 14px", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Add</button>
            </div>
          )}
        </>
      )}
      <label style={lbl}>{tp === "transfer" ? "From account" : "Account"}</label>
      <select style={field} value={accId} onChange={e => setAccId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      {tp === "transfer" && (
        <><label style={lbl}>To account</label><select style={field} value={toId} onChange={e => setToId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></>
      )}
      <label style={lbl}>Date</label>
      <input style={field} type="date" value={date} onChange={e => setDate(e.target.value)} />
      <label style={lbl}>Note (optional)</label>
      <input style={field} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. groceries at DMart" />
      {tp !== "transfer" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.ink, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.brand }} />
          Repeat every month (planned payment)
        </label>
      )}
      <button onClick={submit} style={saveBtn}>Save Entry</button>
    </Sheet>
  );
}

function AccountModal({ close, addAcc }) {
  const [f, setF] = useState({ name: "", type: ACCOUNT_TYPES[0], opening: "", hint: "" });
  const s = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet close={close} title="New Account">
      <label style={lbl}>Account name</label><input style={field} value={f.name} onChange={s("name")} placeholder="e.g. HDFC Savings" />
      <label style={lbl}>Type</label><select style={field} value={f.type} onChange={s("type")}>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
      <label style={lbl}>Current balance (₹)</label><input style={field} type="number" value={f.opening} onChange={s("opening")} placeholder="0" />
      <label style={lbl}>Last 4 digits (for PDF auto-match)</label><input style={field} inputMode="numeric" maxLength={4} value={f.hint} onChange={s("hint")} placeholder="e.g. 4821" />
      <button onClick={() => { if (!f.name) return; addAcc({ name: f.name, type: f.type, opening: +f.opening || 0, hint: f.hint.trim() }); close(); }} style={saveBtn}>Save Account</button>
    </Sheet>
  );
}

function GoalModal({ close, addGoal }) {
  const [f, setF] = useState({ name: "", target: "", saved: "" });
  const s = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet close={close} title="New Goal">
      <label style={lbl}>Goal name</label><input style={field} value={f.name} onChange={s("name")} placeholder="e.g. Emergency fund" />
      <label style={lbl}>Target (₹)</label><input style={field} type="number" value={f.target} onChange={s("target")} placeholder="50000" />
      <label style={lbl}>Already saved (₹)</label><input style={field} type="number" value={f.saved} onChange={s("saved")} placeholder="0" />
      <button onClick={() => { if (!f.name || !f.target) return; addGoal({ name: f.name, target: +f.target, saved: +f.saved || 0 }); close(); }} style={saveBtn}>Save Goal</button>
    </Sheet>
  );
}

function BudgetModal({ close, setBudget, expCats }) {
  const [cat, setCat] = useState(expCats[0]);
  const [amt, setAmt] = useState("");
  return (
    <Sheet close={close} title="Set Budget">
      <label style={lbl}>Category</label><select style={field} value={cat} onChange={e => setCat(e.target.value)}>{expCats.map(c => <option key={c}>{c}</option>)}</select>
      <label style={lbl}>Monthly limit (₹)</label><input style={field} type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="5000" />
      <button onClick={() => { if (!amt) return; setBudget(cat, +amt); close(); }} style={saveBtn}>Save Budget</button>
    </Sheet>
  );
}

function FundModal({ goal, close, fundGoal }) {
  const [amt, setAmt] = useState("");
  const a = evalExpr(amt);
  return (
    <Sheet close={close} title={`Add to ${goal.name}`}>
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Currently saved</div>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, color: C.gold, marginTop: 4 }}>{inr(goal.saved)}</div>
        <div style={{ fontSize: 12, color: C.muted }}>of {inr(goal.target)}</div>
      </div>
      <label style={lbl}>Amount to add (₹)</label>
      <input autoFocus style={field} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="1000" />
      <button onClick={() => { if (!a || a <= 0) return; fundGoal(goal.id, a); close(); }} style={saveBtn}>
        Add {!isNaN(a) && a > 0 ? inr(a) : ""}
      </button>
    </Sheet>
  );
}

/* PDF Import modal */
function ImportModal({ close, data, importTxns, expCats, incCats }) {
  const [step,    setStep]    = useState("pick");
  const [file,    setFile]    = useState(null);
  const [pwd,     setPwd]     = useState("");
  const [needPwd, setNeedPwd] = useState(false);
  const [accId,   setAccId]   = useState(data.accounts[0]?.id || "");
  const [rows,    setRows]    = useState([]);
  const [err,     setErr]     = useState("");
  const [result,  setResult]  = useState(null);

  const parse = async () => {
    if (!file) return;
    setErr(""); setStep("parsing");
    try {
      const lib = await loadPdf();
      const buf = await file.arrayBuffer();
      let pdf;
      try {
        pdf = await lib.getDocument({ data: buf, password: pwd || undefined }).promise;
      } catch (e) {
        if (e && (e.name === "PasswordException" || /password/i.test(e.message || ""))) {
          setNeedPwd(true);
          setErr(pwd ? "Wrong password — try again." : "This PDF is password-protected. Enter the password (usually your DOB or mobile number).");
          setStep("pick"); return;
        }
        throw e;
      }
      const lines = await extractLines(pdf);
      const blob  = lines.join(" ");
      const hit   = data.accounts.find(a => a.hint && new RegExp(`[Xx*]{2,}\\s*${a.hint}\\b|${a.hint}\\b`).test(blob));
      if (hit) setAccId(hit.id);
      const parsed = parseStatement(lines);
      if (!parsed.length) { setErr("No transaction rows found. Use a digital e-statement from netbanking, not a scanned PDF."); setStep("pick"); return; }
      setRows(parsed); setStep("review");
    } catch (e) {
      setErr(e.message || "Couldn't read this PDF.");
      setStep("pick");
    }
  };

  const doImport = () => { const res = importTxns(rows.filter(r => r.include), accId); setResult(res); setStep("done"); };
  const toggle   = k => setRows(rows.map(r => r.key === k ? { ...r, include: !r.include } : r));
  const setCat   = (k, c) => setRows(rows.map(r => r.key === k ? { ...r, category: c } : r));
  const setType  = (k, t) => setRows(rows.map(r => r.key === k ? { ...r, type: t, category: guessCategory(r.desc, t) } : r));
  const included = rows.filter(r => r.include).length;

  return (
    <Sheet close={close} title="Import Statement">
      {step === "pick" && <>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 0 }}>Pick a bank e-statement PDF. Everything is parsed on your device — nothing is uploaded anywhere.</p>
        <label style={lbl}>PDF file</label>
        <input type="file" accept="application/pdf" style={{ ...field, padding: 8 }} onChange={e => { setFile(e.target.files[0] || null); setErr(""); }} />
        {needPwd && <><label style={lbl}>PDF password</label><input style={field} type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Statement password" /></>}
        <label style={lbl}>Import into account</label>
        <select style={field} value={accId} onChange={e => setAccId(e.target.value)}>
          {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.hint ? ` ··${a.hint}` : ""}</option>)}
        </select>
        {err && <p style={{ fontSize: 13, color: C.expense, fontWeight: 500 }}>{err}</p>}
        <button onClick={parse} disabled={!file} style={{ ...saveBtn, background: file ? C.brand : "#ccc", cursor: file ? "pointer" : "default" }}>Read Statement</button>
      </>}
      {step === "parsing" && <p style={{ textAlign: "center", color: C.muted, padding: "32px 0" }}>Reading your statement…</p>}
      {step === "review" && <>
        <p style={{ fontSize: 13, color: C.muted, marginTop: 0 }}>Found <b style={{ color: C.ink }}>{rows.length}</b> transactions. Untick anything you don't want — exact duplicates are skipped automatically.</p>
        <label style={lbl}>Account</label>
        <select style={field} value={accId} onChange={e => setAccId(e.target.value)}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <div style={{ display: "grid", gap: 8, maxHeight: "44vh", overflowY: "auto" }}>
          {rows.map(r => (
            <div key={r.key} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", opacity: r.include ? 1 : 0.4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={r.include} onChange={() => toggle(r.key)} style={{ width: 18, height: 18, accentColor: C.brand, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc || "(no description)"}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <span style={{ fontFamily: "Georgia,serif", fontSize: 13, fontWeight: 700, color: r.type === "income" ? C.income : C.expense, flexShrink: 0 }}>{r.type === "income" ? "+" : "−"}{inr(r.amount)}</span>
              </div>
              {r.include && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <select value={r.type} onChange={e => setType(r.key, e.target.value)} style={{ ...field, marginBottom: 0, padding: "5px 8px", fontSize: 11, flex: 1 }}>
                    <option value="expense">Expense</option><option value="income">Income</option>
                  </select>
                  <select value={r.category} onChange={e => setCat(r.key, e.target.value)} style={{ ...field, marginBottom: 0, padding: "5px 8px", fontSize: 11, flex: 2 }}>
                    {(r.type === "income" ? incCats : expCats).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={doImport} disabled={!included} style={{ ...saveBtn, marginTop: 12, background: included ? C.brand : "#ccc", cursor: included ? "pointer" : "default", position: "sticky", bottom: 0 }}>
          Import {included} transaction{included === 1 ? "" : "s"}
        </button>
      </>}
      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>Imported {result.added} transaction{result.added === 1 ? "" : "s"}</div>
          {result.skipped > 0 && <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{result.skipped} duplicate{result.skipped === 1 ? "" : "s"} skipped</div>}
          <button onClick={close} style={{ ...saveBtn, marginTop: 20 }}>Done</button>
        </div>
      )}
    </Sheet>
  );
}

/* ── Shared primitives ───────────────────────────────────────────── */
function Sheet({ children, close, title }) {
  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(10,20,30,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 560, padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", maxHeight: "90vh", overflowY: "auto" }}>
        {title && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, margin: 0, color: C.ink }}>{title}</h2>
            <button onClick={close} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}><X size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
function SectionCard({ children }) {
  return <div style={{ margin: "16px 16px 0", background: C.card, borderRadius: 16, padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>{children}</div>;
}
function NavBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</button>;
}
function PrimaryBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 12, border: "none", background: C.brand, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{children}</button>;
}
function Pill({ children, onClick }) {
  return <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function Eyebrow({ children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, ...style }}>{children}</div>;
}
const headStyle = { fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, margin: 0 };
const iconBtn   = { background: "none", border: "none", color: "#BCC5CF", cursor: "pointer", padding: 4 };
const field     = { width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: C.ink, background: "#FAFAFA", marginBottom: 12 };
const lbl       = { fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5, display: "block", letterSpacing: "0.06em", textTransform: "uppercase" };
const saveBtn   = { width: "100%", background: C.brand, border: "none", borderRadius: 12, padding: "13px 0", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 };
