import React, { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

interface Session {
  id: number;
  date: string;
  start: string;
  end: string;
  project: string;
  desc: string;
  cat: string;
  duration: number;
}

interface DailyReview {
  win: string;
  distraction: string;
  energy: number;
  notes: string;
}

interface DailyReviews {
  [date: string]: DailyReview;
}

const CATEGORIES = ["Video Editing","Content Curation","Motion Graphics","Color Grading","Sound Design","Learning","Outreach","Other"];
const CAT_COLORS = ["#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#ec4899","#10b981","#f97316","#6b7280"];
const BADGES = [
  { id:"first", label:"First Hour", icon:"⚡", req:1 },
  { id:"ten", label:"10 Hours", icon:"🔥", req:10 },
  { id:"quarter", label:"25 Hours", icon:"💪", req:25 },
  { id:"half", label:"50 Hours", icon:"🌟", req:50 },
  { id:"seventy", label:"75 Hours", icon:"🚀", req:75 },
  { id:"century", label:"100 Hours", icon:"🏆", req:100 },
];
const TABS = ["Dashboard","Log","Journal","Daily Review","Analytics","Achievements"];

const fmtTime = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const today = () => new Date().toISOString().slice(0,10);
const parseHrs = (start: string | undefined | null, end: string | undefined | null) => {
  if(!start||!end) return 0;
  const [sh,sm]=start.split(":").map(Number), [eh,em]=end.split(":").map(Number);
  const startM = sh*60 + sm;
  let endM = eh*60 + em;
  if (endM < startM) {
    endM += 24 * 60; // Rollover to the next day (add 24 hours)
  }
  return Math.max(0, (endM - startM) / 60);
};

const glassCard = "bg-white/70 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl shadow-xs dark:shadow-none transition-all duration-300 hover:shadow-md hover:scale-[1.005]";
const btnBlue = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/20";

function CircleProgress({ pct, darkMode }: { pct: number; darkMode: boolean }) {
  const r = 54, c = 2*Math.PI*r, dash = (pct/100)*c;
  return (
    <svg width="140" height="140" className="drop-shadow-lg transition-transform duration-500 hover:scale-105">
      <circle cx="70" cy="70" r={r} fill="none" stroke={darkMode ? "#ffffff10" : "#00000010"} strokeWidth="10"/>
      <circle cx="70" cy="70" r={r} fill="none" stroke="url(#blueGrad)" strokeWidth="10"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 70 70)" style={{transition:"stroke-dasharray 0.8s ease"}}/>
      <defs><linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#06b6d4"/>
      </linearGradient></defs>
      <text x="70" y="65" textAnchor="middle" fill="currentColor" className="text-slate-900 dark:text-white font-bold" fontSize="22">{pct}%</text>
      <text x="70" y="83" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400" fontSize="11">complete</text>
    </svg>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  accent?: string;
  delay?: number;
}

function StatCard({ label, value, sub, accent, delay = 0 }: StatCardProps) {
  return (
    <div 
      className={`${glassCard} p-4 flex flex-col gap-1 transition-all duration-300 hover:scale-[1.04] hover:shadow-lg hover:border-blue-500/30 dark:hover:border-blue-500/30 animate-scale-up opacity-0`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-bold ${accent||"text-slate-900 dark:text-white"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}

function VoiceWaveform({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-0.5 h-3.5 px-1">
      <div className="w-0.5 h-3 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.1s" }} />
      <div className="w-0.5 h-4 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.3s" }} />
      <div className="w-0.5 h-2 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.5s" }} />
      <div className="w-0.5 h-5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.2s" }} />
      <div className="w-0.5 h-3 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.4s" }} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem("sprint_dark_mode");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("sprint_authenticated") === "true";
  });
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("sprint_dark_mode", JSON.stringify(darkMode));
  }, [darkMode]);

  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem("sprint_sessions")||"[]"); } catch{ return []; }
  });
  const [dailyReviews, setDailyReviews] = useState<DailyReviews>(() => {
    try { return JSON.parse(localStorage.getItem("sprint_reviews")||"{}"); } catch{ return {}; }
  });
  const [startDate] = useState(() => localStorage.getItem("sprint_start")||(()=>{const d=today();localStorage.setItem("sprint_start",d);return d;})());

  // Session form
  const [form, setForm] = useState<Omit<Session, "id" | "duration">>({ date:today(), start:"", end:"", project:"", desc:"", cat:"Video Editing" });
  const [formMsg, setFormMsg] = useState("");

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [pomSecs, setPomSecs] = useState(25*60);
  const [pomRunning, setPomRunning] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const timerRef = useRef<any>(null);
  const pomRef = useRef<any>(null);

  // Speech Recognition STT
  const recognitionRefs = useRef<{ [key: string]: any }>({});
  const isListeningRef = useRef<{ [key: string]: boolean }>({});
  const [activeListening, setActiveListening] = useState<{ [key: string]: boolean }>({});
  const valuesRef = useRef({ desc: "", notes: "", win: "", distraction: "" });

  const currentNotes = dailyReviews[form.date]?.notes || "";
  const currentWin = dailyReviews[form.date]?.win || "";
  const currentDistraction = dailyReviews[form.date]?.distraction || "";

  useEffect(() => {
    valuesRef.current = {
      desc: form.desc,
      notes: currentNotes,
      win: currentWin,
      distraction: currentDistraction
    };
  }, [form.desc, currentNotes, currentWin, currentDistraction]);

  const startSpeech = (field: "desc" | "notes" | "win" | "distraction", updateFn: (val: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition is not supported in your browser. Please try Google Chrome or Safari.");
      return;
    }

    isListeningRef.current[field] = true;
    setActiveListening(prev => ({ ...prev, [field]: true }));

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setActiveListening(prev => ({ ...prev, [field]: true }));
    };

    rec.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          text += event.results[i][0].transcript;
        }
      }
      if (text) {
        const latestVal = valuesRef.current[field];
        updateFn(latestVal ? latestVal + " " + text.trim() : text.trim());
      }
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        isListeningRef.current[field] = false;
        setActiveListening(prev => ({ ...prev, [field]: false }));
      }
    };

    rec.onend = () => {
      if (isListeningRef.current[field]) {
        setTimeout(() => {
          if (isListeningRef.current[field]) {
            startSpeech(field, updateFn);
          }
        }, 100);
      } else {
        setActiveListening(prev => ({ ...prev, [field]: false }));
      }
    };

    recognitionRefs.current[field] = rec;
    try {
      rec.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
  };

  const toggleSpeech = (field: "desc" | "notes" | "win" | "distraction", updateFn: (val: string) => void) => {
    if (isListeningRef.current[field]) {
      isListeningRef.current[field] = false;
      setActiveListening(prev => ({ ...prev, [field]: false }));
      if (recognitionRefs.current[field]) {
        try {
          recognitionRefs.current[field].stop();
        } catch (e) {
          console.error("Error stopping speech recognition:", e);
        }
      }
    } else {
      startSpeech(field, updateFn);
    }
  };

  const adjustEndTime = (mins: number) => {
    let baseTime = form.start || "12:00";
    if (form.end) {
      baseTime = form.end;
    }
    const [h, m] = baseTime.split(":").map(Number);
    const newDate = new Date();
    newDate.setHours(h);
    newDate.setMinutes(m + mins);
    const hh = String(newDate.getHours()).padStart(2, "0");
    const mm = String(newDate.getMinutes()).padStart(2, "0");
    setForm(f => ({ ...f, end: `${hh}:${mm}` }));
  };

  const setEndTimeNow = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setForm(f => ({ ...f, end: `${hh}:${mm}` }));
  };

  // Load data from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const fetchCloudData = async () => {
      try {
        // Fetch sessions
        const { data: cloudSessions, error: sessError } = await supabase
          .from("sessions")
          .select("*")
          .order("id", { ascending: true });

        if (sessError) throw sessError;
        if (cloudSessions) {
          setSessions(cloudSessions as Session[]);
        }

        // Fetch daily reviews
        const { data: cloudReviews, error: revError } = await supabase
          .from("daily_reviews")
          .select("*");

        if (revError) throw revError;
        if (cloudReviews) {
          const reviewsMap: DailyReviews = {};
          cloudReviews.forEach((r: any) => {
            reviewsMap[r.date] = {
              win: r.win || "",
              distraction: r.distraction || "",
              energy: r.energy ?? 7,
              notes: r.notes || "",
            };
          });
          setDailyReviews(reviewsMap);
        }
      } catch (err) {
        console.error("Error fetching data from Supabase:", err);
      }
    };

    fetchCloudData();
  }, []);

  // Persist local storage as a fallback cache
  useEffect(()=>{ localStorage.setItem("sprint_sessions",JSON.stringify(sessions)); },[sessions]);
  useEffect(()=>{ localStorage.setItem("sprint_reviews",JSON.stringify(dailyReviews)); },[dailyReviews]);

  // Timer tick
  useEffect(()=>{
    if(timerRunning){ timerRef.current=setInterval(()=>setTimerSecs(s=>s+1),1000); }
    else if (timerRef.current !== null) { clearInterval(timerRef.current); }
    return ()=>{ if (timerRef.current !== null) clearInterval(timerRef.current); };
  },[timerRunning]);

  // Pomodoro tick
  useEffect(()=>{
    if(pomRunning){ pomRef.current=setInterval(()=>setPomSecs(s=>{ if(s<=1){if (pomRef.current !== null) clearInterval(pomRef.current);setPomRunning(false);return 0;} return s-1; }),1000); }
    else if (pomRef.current !== null) { clearInterval(pomRef.current); }
    return ()=>{ if (pomRef.current !== null) clearInterval(pomRef.current); };
  },[pomRunning]);

  const totalHrs = sessions.reduce((a,s)=>a+s.duration,0);
  const doneHrs = +totalHrs.toFixed(2);
  const remHrs = +(100-doneHrs).toFixed(2);
  const pct = Math.min(100,Math.round(doneHrs));

  const daysSince = Math.max(1,Math.ceil((Date.now()-new Date(startDate).getTime())/(1000*86400)));
  const daysLeft = Math.max(0,10-daysSince+1);
  const avgPerDay = +(doneHrs/Math.max(1,daysSince-1+(daysSince===1?0.5:0))).toFixed(2);
  const reqPace = daysLeft>0?+(remHrs/daysLeft).toFixed(2):0;

  // streak
  const streak = (() => {
    const days = [...new Set(sessions.map(s=>s.date))].sort().reverse();
    let str=0, cur=new Date();
    for(const d of days){
      const dd=new Date(d); dd.setHours(0,0,0,0); cur.setHours(0,0,0,0);
      const diff=Math.round((cur.getTime() - dd.getTime())/86400000);
      if(diff>1) break; str++; cur=dd;
    }
    return str;
  })();

  const motivation = doneHrs===0?"Start your first session — every hour compounds."
    :doneHrs>=100?"🏆 MISSION COMPLETE! You did it!"
    :avgPerDay>=reqPace?"🟢 You're ahead of schedule. Keep this pace!"
    :`⚠️ You need ${reqPace} hrs/day to finish on time. Focus now!`;

  const estCompletion = reqPace>0?`~${daysLeft} day${daysLeft!==1?"s":""} at ${reqPace} hrs/day`:"Done!";

  // Per-day data
  const dayMap: { [key: string]: { hrs: number; tasks: number } } = {};
  sessions.forEach(s=>{
    if(!dayMap[s.date]) dayMap[s.date]={hrs:0,tasks:0};
    dayMap[s.date].hrs+=s.duration; dayMap[s.date].tasks++;
  });
  const dayData = Object.entries(dayMap).sort().map(([d,v])=>({day:d.slice(5),hrs:+v.hrs.toFixed(2)}));

  // Per-cat data
  const catMap: { [key: string]: number } = {};
  sessions.forEach(s=>{ catMap[s.cat]=(catMap[s.cat]||0)+s.duration; });
  const catData = Object.entries(catMap).map(([n,v])=>({name:n,hrs:+v.toFixed(2)}));

  const longestSession = sessions.reduce((a,s)=>s.duration>a?s.duration:a,0);
  const avgSession = sessions.length?+(doneHrs/sessions.length).toFixed(2):0;
  const mostProductiveDay = dayData.reduce((a,b)=>b.hrs>a.hrs?b:a,{day:"—",hrs:0}).day;

  const earnedBadges = BADGES.filter(b=>doneHrs>=b.req);

  const addSession = async () => {
    const dur = parseHrs(form.start, form.end);
    if(!form.date||!form.start||!form.end||dur<=0){setFormMsg("Please fill all fields with valid times.");return;}
    if(!form.desc.trim()){setFormMsg("Add a task description.");return;}
    
    const sessionObj = { id: Date.now(), ...form, duration: +dur.toFixed(2) };
    setSessions(prev=>[...prev, sessionObj]);
    setForm(f=>({...f,start:"",end:"",project:"",desc:"",cat:"Video Editing"}));
    setFormMsg("✅ Session logged!");
    setTimeout(()=>setFormMsg(""),2500);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("sessions").insert([sessionObj]);
        if (error) throw error;
      } catch (err) {
        console.error("Error inserting session to Supabase:", err);
      }
    }
  };

  const deleteSession = async (id: number) => {
    setSessions(prev => prev.filter(x => x.id !== id));
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("sessions").delete().eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Error deleting session from Supabase:", err);
      }
    }
  };

  const stopTimerAndFill = () => {
    setTimerRunning(false);
    if(timerStart){
      const now=new Date(), s=new Date(timerStart);
      setForm(f=>({...f,
        date:today(),
        start:`${String(s.getHours()).padStart(2,"0")}:${String(s.getMinutes()).padStart(2,"0")}`,
        end:`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`
      }));
      setTab("Log");
    }
    setTimerSecs(0); setTimerStart(null);
  };

  const exportCSV = () => {
    const h="Date,Start,End,Duration(hrs),Project,Category,Description";
    const rows=sessions.map(s=>`${s.date},${s.start},${s.end},${s.duration},"${s.project}",${s.cat},"${s.desc}"`);
    const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent([h,...rows].join("\n")); a.download="sprint_log.csv"; a.click();
  };
  const exportJSON = () => {
    const a=document.createElement("a"); a.href="data:application/json;charset=utf-8,"+encodeURIComponent(JSON.stringify({sessions,dailyReviews,startDate},null,2)); a.download="sprint_data.json"; a.click();
  };
  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f=e.target.files?.[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const res = ev.target?.result;
        if (typeof res === "string") {
          const d = JSON.parse(res);
          if(d.sessions) setSessions(d.sessions);
          if(d.dailyReviews) setDailyReviews(d.dailyReviews);
        }
      }catch{}
    };
    r.readAsText(f);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctCode = (import.meta.env.VITE_DASHBOARD_PASSCODE || "divy100").toLowerCase();
    if (passcode.toLowerCase() === correctCode) {
      localStorage.setItem("sprint_authenticated", "true");
      setIsAuthenticated(true);
      setErrorMsg("");
    } else {
      setIsShaking(true);
      setErrorMsg("Incorrect passcode. Try again.");
      setPasscode("");
      setTimeout(() => setIsShaking(false), 400);
    }
  };

  // Journal sorted
  const journalSessions = [...sessions].sort((a,b)=>new Date(a.date+' '+a.start).getTime() - new Date(b.date+' '+b.start).getTime());

  // Focus mode overlay
  if(focusMode) return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-black flex flex-col items-center justify-center z-50 gap-8">
      <div className="text-blue-600 dark:text-blue-400 text-lg font-semibold tracking-widest uppercase">Focus Mode</div>
      <div className="text-8xl font-mono font-bold text-slate-900 dark:text-white">{fmtTime(timerSecs)}</div>
      <div className="flex gap-4">
        <button className={btnBlue} onClick={()=>{ if(!timerRunning&&timerSecs===0) setTimerStart(new Date()); setTimerRunning(r=>!r); }}>{timerRunning?"Pause":"Start"}</button>
        <button className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={stopTimerAndFill}>Stop & Log</button>
        <button className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>setFocusMode(false)}>Exit</button>
      </div>
    </div>
  );

  // Passcode Lockscreen UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white transition-colors duration-300 px-4 py-8 flex items-center justify-center relative overflow-hidden" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
        {/* Moving Ambient Glowing Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/15 dark:bg-blue-500/10 blur-[100px] pointer-events-none animate-blob-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/15 dark:bg-purple-500/10 blur-[120px] pointer-events-none animate-blob-2" />
        <div className="absolute top-[35%] left-[25%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 blur-[95px] pointer-events-none animate-blob-3" />

        <button 
          onClick={() => setDarkMode(!darkMode)} 
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 transition-all text-sm cursor-pointer z-50 hover:scale-105 duration-200"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? "☀️" : "🌙"}
        </button>

        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start z-10">
          {/* Left Panel: Passcode Lock */}
          <div className="md:col-span-5 space-y-6 animate-scale-up opacity-0" style={{ animationDelay: "100ms" }}>
            <div className={`w-full p-8 ${glassCard} text-center space-y-6 shadow-lg ${isShaking ? "animate-shake" : ""}`}>
              <div className="space-y-2">
                <div className="text-4xl animate-float">🔐</div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back, Divy</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Enter your passcode to unlock full dashboard access.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  type="password"
                  placeholder="••••••••"
                  value={passcode}
                  onChange={e => {
                    setPasscode(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className="w-full text-center tracking-widest bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 placeholder-slate-300 dark:placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 focus:scale-[1.01]"
                  autoFocus
                />

                {errorMsg && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium animate-pulse">{errorMsg}</p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold transition-all cursor-pointer shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.02] duration-300"
                >
                  Unlock Dashboard
                </button>
              </form>

              {!import.meta.env.VITE_DASHBOARD_PASSCODE && (
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Default passcode is <code className="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">divy100</code></p>
              )}
            </div>
          </div>

          {/* Right Panel: Scout Challenge Progress Stream */}
          <div className="md:col-span-7 space-y-6 animate-scale-up opacity-0" style={{ animationDelay: "200ms" }}>
            <div className={`p-6 ${glassCard} space-y-6 shadow-lg`}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Challenge Live Stream 📢</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Scout view: Open progress of Divy's 100-hour sprint.</p>
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  Live Tracker
                </div>
              </div>

              {/* Progress Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 transition-all duration-300 hover:scale-[1.05] hover:border-blue-500/20 animate-scale-up opacity-0" style={{ animationDelay: "300ms" }}>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Done</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{doneHrs}h</div>
                </div>
                <div className="text-center p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 transition-all duration-300 hover:scale-[1.05] hover:border-blue-500/20 animate-scale-up opacity-0" style={{ animationDelay: "350ms" }}>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Remaining</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-white">{remHrs}h</div>
                </div>
                <div className="text-center p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 transition-all duration-300 hover:scale-[1.05] hover:border-blue-500/20 animate-scale-up opacity-0" style={{ animationDelay: "400ms" }}>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Streak</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{streak}d</div>
                </div>
                <div className="text-center p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 transition-all duration-300 hover:scale-[1.05] hover:border-blue-500/20 animate-scale-up opacity-0" style={{ animationDelay: "450ms" }}>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Days Left</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-white">{daysLeft}d</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 animate-scale-up opacity-0" style={{ animationDelay: "500ms" }}>
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">Total Completion</span>
                  <span className="text-blue-600 dark:text-blue-400">{pct}%</span>
                </div>
                <div className="h-3.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-[1000ms] ease-out bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400" style={{width:`${pct}%`}}/>
                </div>
              </div>

              {/* 10-Day Productivity Heatmap */}
              {dayData.length > 0 && (
                <div className="space-y-3 animate-scale-up opacity-0 border-t border-slate-200 dark:border-white/10 pt-4" style={{ animationDelay: "550ms" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Activity Heatmap</h3>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({length:10},(_,i)=>{
                      const d=new Date(startDate); d.setDate(d.getDate()+i);
                      const ds=d.toISOString().slice(0,10);
                      const hrs=dayMap[ds]?.hrs||0;
                      const alpha=Math.min(1,hrs/10);
                      return (
                        <div key={ds} className="flex flex-col items-center gap-1 transition-all duration-300 hover:scale-110">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-900 dark:text-white" style={{background:`rgba(59,130,246,${0.05+alpha*0.95})`,border: darkMode ? `1px solid rgba(59,130,246,${0.1+alpha*0.3})` : `1px solid rgba(59,130,246,${0.2+alpha*0.3})`}}>
                            {hrs>0?`${hrs.toFixed(1)}`:"—"}
                          </div>
                          <span className="text-[9px] text-slate-500 dark:text-slate-600 font-semibold">D{i+1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Focus Breakdown */}
              {catData.length > 0 && (
                <div className="space-y-3 animate-scale-up opacity-0 border-t border-slate-200 dark:border-white/10 pt-4" style={{ animationDelay: "600ms" }}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sprint Focus</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catData.sort((a,b)=>b.hrs-a.hrs).slice(0, 4).map((c) => (
                      <div key={c.name} className="p-2.5 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col gap-1 hover:border-blue-500/20 transition-all duration-300 hover:scale-[1.01]">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-slate-600 dark:text-slate-300 truncate">{c.name}</span>
                          <span className="text-blue-600 dark:text-blue-400">{c.hrs}h</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" style={{width:`${(c.hrs/doneHrs)*100}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activities */}
              <div className="space-y-3 border-t border-slate-200 dark:border-white/10 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 animate-scale-up opacity-0" style={{ animationDelay: "650ms" }}>Latest Activities</h3>
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic animate-scale-up opacity-0" style={{ animationDelay: "700ms" }}>No work logged yet. The challenge is just beginning!</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {[...sessions].reverse().slice(0, 4).map((s, index) => (
                      <div 
                        key={s.id} 
                        className="p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 flex items-start gap-3 hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all hover:scale-[1.02] hover:-translate-y-0.5 duration-300 animate-slide-in-right opacity-0"
                        style={{ animationDelay: `${index * 80 + 600}ms` }}
                      >
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">{s.duration}h</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{s.cat}</span>
                            {s.project && <span className="text-[10px] text-slate-400 dark:text-slate-500">· {s.project}</span>}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{s.desc}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{s.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-black dark:text-white transition-colors duration-300 relative overflow-hidden" style={{fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Moving Ambient Glowing Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[120px] pointer-events-none animate-blob-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[650px] h-[650px] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[130px] pointer-events-none animate-blob-2" />
      <div className="absolute top-[30%] left-[25%] w-[400px] h-[400px] rounded-full bg-cyan-500/8 dark:bg-cyan-500/4 blur-[100px] pointer-events-none animate-blob-3" />

      {/* Header */}
      <div className="border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/80 backdrop-blur sticky top-0 z-40 transition-colors duration-300 relative">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
              <span className="animate-float">⚡</span> 100 Hours in 10 Days
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 italic">Every hour compounds.</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 transition-all text-sm cursor-pointer hover:scale-105 duration-200"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <div 
              className={`px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${isSupabaseConfigured ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"}`}
              title={isSupabaseConfigured ? "Syncing to Supabase Cloud Database" : "Saving locally to browser LocalStorage. Configure .env.local to enable cloud sync."}
            >
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
              {isSupabaseConfigured ? "Cloud Sync" : "Local Mode"}
            </div>
            <button 
              onClick={() => {
                localStorage.removeItem("sprint_authenticated");
                setIsAuthenticated(false);
              }} 
              className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 transition-all text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:scale-105 duration-200"
              title="Log Out & Lock"
            >
              <span>🔒</span>
              <span className="hidden sm:inline">Log Out</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30">
              <span className="text-blue-600 dark:text-blue-300 font-bold">{doneHrs}</span>
              <span className="text-slate-500 dark:text-slate-400">/ 100 hrs</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${daysLeft<=2?"bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-300":"bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300"}`}>{daysLeft}d left</div>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((t, idx)=>(
            <button 
              key={t} 
              onClick={()=>setTab(t)} 
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all cursor-pointer hover:scale-105 duration-200 animate-scale-up opacity-0 ${tab===t?"bg-blue-600 text-white":"text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-scale-up z-10 relative">

        {/* ── DASHBOARD ── */}
        {tab==="Dashboard" && <>
          <div className="text-center py-2 animate-scale-up opacity-0" style={{ animationDelay: "50ms" }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30 text-blue-600 dark:text-blue-300 text-sm font-semibold mb-2 animate-float">
              {motivation}
            </div>
          </div>
          {/* Main stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Hours Done" value={doneHrs} sub="of 100 hrs" accent="text-blue-600 dark:text-blue-400" delay={100}/>
            <StatCard label="Hours Left" value={remHrs} sub={estCompletion} delay={150}/>
            <StatCard label="Current Streak" value={`${streak}d`} sub="consecutive days" accent="text-green-600 dark:text-green-400" delay={200}/>
            <StatCard label="Days Left" value={daysLeft} sub="out of 10" delay={250}/>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Avg / Day" value={`${avgPerDay}h`} sub="so far" delay={300}/>
            <StatCard label="Required Pace" value={`${reqPace}h`} sub="per day needed" accent={reqPace>8?"text-red-600 dark:text-red-400":"text-green-600 dark:text-green-400"} delay={350}/>
            <StatCard label="Sessions" value={sessions.length} sub={`avg ${avgSession}h each`} delay={400}/>
          </div>

          {/* Progress section */}
          <div className={`${glassCard} p-6 flex flex-col sm:flex-row items-center gap-8 animate-scale-up opacity-0 hover:border-blue-500/20`} style={{ animationDelay: "450ms" }}>
            <CircleProgress pct={pct} darkMode={darkMode}/>
            <div className="flex-1 w-full space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">Overall Progress</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{doneHrs} / 100 hrs</span>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-[1000ms] ease-out bg-gradient-to-r from-blue-600 to-cyan-400" style={{width:`${pct}%`}}/>
                </div>
              </div>
              {/* Daily milestones */}
              {[10,25,50,75,100].map((m, index)=>(
                <div 
                  key={m} 
                  className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1 animate-slide-in-right opacity-0"
                  style={{ animationDelay: `${500 + index * 60}ms` }}
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-8">{m}h</span>
                  <div className="flex-1 h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width:`${Math.min(100,(doneHrs/m)*100)}%`,background:doneHrs>=m?"#10b981":"#3b82f6"}}/>
                  </div>
                  <span className="text-xs">{doneHrs>=m?"✅":"⬜"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timer widget */}
          <div 
            className={`${glassCard} p-6 animate-scale-up opacity-0 transition-all duration-500 ${timerRunning ? "ring-2 ring-blue-500/30 animate-glow-pulse" : pomRunning ? "ring-2 ring-orange-500/30 animate-glow-pulse-orange" : ""}`} 
            style={{ animationDelay: "500ms" }}
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                  {timerRunning && <span className="animate-spin-slow text-blue-500">⏱️</span>}
                  <span>Session Timer</span>
                </div>
                <div className="text-5xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">{fmtTime(timerSecs)}</div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button className={btnBlue} onClick={()=>{ if(!timerRunning&&timerSecs===0) setTimerStart(new Date()); setTimerRunning(r=>!r); }}>{timerRunning?"⏸ Pause":"▶ Start"}</button>
                <button className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={stopTimerAndFill}>⏹ Stop & Log</button>
                <button className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>{ setTimerRunning(false); setTimerSecs(0); setTimerStart(null); }}>Reset</button>
                <button className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>setFocusMode(true)}>🎯 Focus Mode</button>
              </div>
              {/* Pomodoro */}
              <div className="text-center border-l border-slate-200 dark:border-white/10 pl-6">
                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">
                  {pomRunning && <span className="animate-pulse text-orange-500">🍅</span>}
                  <span>Pomodoro</span>
                </div>
                <div className="text-3xl font-mono font-bold text-orange-600 dark:text-orange-400 tabular-nums">{fmtTime(pomSecs)}</div>
                <div className="flex gap-2 mt-2 justify-center">
                  <button className="bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>setPomRunning(r=>!r)}>{pomRunning?"Pause":"Start"}</button>
                  <button className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>{ setPomRunning(false); setPomSecs(25*60); }}>Reset</button>
                  <button className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-xs transition-all cursor-pointer hover:scale-105 duration-300" onClick={()=>{ setPomRunning(false); setPomSecs(5*60); }}>5m</button>
                </div>
              </div>
            </div>
          </div>

              <div className={`${glassCard} p-4 flex flex-wrap gap-3 items-center animate-scale-up opacity-0 hover:border-blue-500/20`} style={{ animationDelay: "550ms" }}>
                <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest">Data</span>
                <button className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={exportCSV}>📥 Export CSV</button>
                <button className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer hover:scale-105 duration-300" onClick={exportJSON}>📥 Export JSON</button>
                <label className="bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer hover:scale-105 duration-300">📤 Import JSON<input type="file" accept=".json" className="hidden" onChange={importJSON}/></label>
              </div>
            </>}

        {/* ── LOG ── */}
        {tab==="Log" && <>
          <div className={`${glassCard} p-6 space-y-4 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Log a Work Session</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Date</label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"/>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Category</label>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200" style={{background:"none"}}>
                  {CATEGORIES.map(c=><option key={c} className="bg-white dark:bg-neutral-900">{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Start Time</label>
                <input type="time" value={form.start} onChange={e=>setForm(f=>({...f,start:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500 dark:text-slate-400">End Time</label>
                <input type="time" value={form.end} onChange={e=>setForm(f=>({...f,end:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"/>
                <div className="flex gap-1.5 pt-0.5">
                  <button type="button" onClick={() => adjustEndTime(15)} className="bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer hover:scale-105 duration-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">+15m</button>
                  <button type="button" onClick={() => adjustEndTime(30)} className="bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer hover:scale-105 duration-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">+30m</button>
                  <button type="button" onClick={() => adjustEndTime(60)} className="bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer hover:scale-105 duration-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5">+1h</button>
                  <button type="button" onClick={setEndTimeNow} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer hover:scale-105 duration-200 border border-blue-500/20">Now</button>
                </div>
              </div>
              {form.start&&form.end&&<div className="sm:col-span-2 flex items-center gap-2 px-3 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl animate-scale-up">
                <span className="text-xs text-slate-500 dark:text-slate-400">Duration:</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{parseHrs(form.start,form.end).toFixed(2)} hours</span>
              </div>}
              <div className="space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Project Name</label>
                <input type="text" placeholder="e.g. Client Reel — Nike" value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 placeholder-slate-400 dark:placeholder-slate-600"/>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500 dark:text-slate-400">What did you work on?</label>
                  <button 
                    type="button"
                    onClick={() => toggleSpeech("desc", (v) => setForm(f => ({ ...f, desc: v })))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeListening.desc ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"}`}
                    title="Speak to type"
                  >
                    <VoiceWaveform active={activeListening.desc} />
                    <span>{activeListening.desc ? "Listening..." : "🎙️ Speak"}</span>
                  </button>
                </div>
                <textarea rows={3} placeholder="e.g. Edited intro sequence, color graded outdoor scenes, synced audio to b-roll…" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 placeholder-slate-400 dark:placeholder-slate-600 resize-none"/>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className={btnBlue+" px-6 py-2.5"} onClick={addSession}>+ Log Session</button>
              {formMsg && <span className={`text-sm ${formMsg.startsWith("✅")?"text-green-600 dark:text-green-400":"text-red-600 dark:text-red-400"} animate-pulse`}>{formMsg}</span>}
            </div>
          </div>

          {/* Recent sessions */}
          {sessions.length>0&&<div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "200ms" }}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Recent Sessions</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {[...sessions].reverse().map((s, index)=>(
                <div 
                  key={s.id} 
                  className="flex items-start gap-3 p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:scale-[1.01] hover:-translate-y-0.5 duration-300 transition-all animate-slide-in-right opacity-0"
                  style={{ animationDelay: `${250 + index * 60}ms` }}
                >
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 w-12 shrink-0">{s.start}–{s.end}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{s.cat}</span>
                      {s.project&&<span className="text-xs text-slate-500">· {s.project}</span>}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{s.desc}</p>
                  </div>
                  <div className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">{s.duration}h</div>
                  <button onClick={() => deleteSession(s.id)} className="text-slate-400 hover:text-red-600 text-xs transition-all cursor-pointer hover:scale-110">✕</button>
                </div>
              ))}
            </div>
          </div>}
        </>}

        {/* ── JOURNAL ── */}
        {tab==="Journal" && <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
          <h2 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Hour-by-Hour Journal</h2>
          {journalSessions.length===0&&<p className="text-slate-500 dark:text-slate-400 text-sm">No sessions logged yet. Start working and log sessions to see your journey here.</p>}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 dark:bg-blue-500/20"/>
            <div className="space-y-4">
              {journalSessions.map((s,i)=>{
                const cumHrs = journalSessions.slice(0,i+1).reduce((a,x)=>a+x.duration,0);
                return (
                  <div 
                    key={s.id} 
                    className="relative pl-14 transition-all duration-300 hover:translate-x-1.5 animate-slide-up opacity-0"
                    style={{ animationDelay: `${150 + i * 50}ms` }}
                  >
                    <div className="absolute left-4 top-3 w-4 h-4 rounded-full border-2 border-blue-500 bg-slate-50 dark:bg-black flex items-center justify-center transition-all duration-300 hover:scale-125">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"/>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 hover:border-blue-500/30 dark:hover:border-blue-500/30 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Hour {Math.ceil(cumHrs)}</span>
                          <span className="text-xs text-slate-500">{s.date} · {s.start}–{s.end}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400">{s.cat}</span>
                        </div>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">+{s.duration}h</span>
                      </div>
                      {s.project&&<div className="text-xs text-slate-500 mb-1">📁 {s.project}</div>}
                      <p className="text-sm text-slate-700 dark:text-slate-300">→ {s.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>}

        {/* ── DAILY REVIEW ── */}
        {tab==="Daily Review" && (() => {
          const selDate = form.date;
          const dayHrs = sessions.filter(s=>s.date===selDate).reduce((a,s)=>a+s.duration,0);
          const dayTasks = sessions.filter(s=>s.date===selDate).length;
          const rev = dailyReviews[selDate]||{win:"",distraction:"",energy:7,notes:""};
          const setRev = async <K extends keyof DailyReview>(k: K, v: DailyReview[K]) => {
            const updatedReview = { ...rev, [k]: v };
            setDailyReviews(prev => ({ ...prev, [selDate]: updatedReview }));
            if (isSupabaseConfigured) {
              try {
                const { error } = await supabase.from("daily_reviews").upsert({
                  date: selDate,
                  ...updatedReview
                });
                if (error) throw error;
              } catch (err) {
                console.error("Error upserting daily review to Supabase:", err);
              }
            }
          };
          return (
            <div className="space-y-4">
              <div className={`${glassCard} p-4 flex items-center gap-4 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
                <label className="text-xs text-slate-500 dark:text-slate-400">Select Day</label>
                <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"/>
                <div className="ml-auto flex gap-4 text-sm">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{dayHrs.toFixed(2)}h</span>
                  <span className="text-slate-500 dark:text-slate-400">{dayTasks} tasks</span>
                </div>
              </div>
              <div className={`${glassCard} p-6 space-y-5 animate-scale-up opacity-0`} style={{ animationDelay: "180ms" }}>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daily Review — {selDate}</h2>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 dark:text-slate-400">🏆 Biggest Win Today</label>
                    <button 
                      type="button"
                      onClick={() => toggleSpeech("win", (v) => setRev("win", v))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeListening.win ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.win} />
                      <span>{activeListening.win ? "Listening..." : "🎙️ Speak"}</span>
                    </button>
                  </div>
                  <input type="text" placeholder="What went really well?" value={rev.win} onChange={e=>setRev("win",e.target.value)} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600"/>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 dark:text-slate-400">⚠️ Biggest Distraction</label>
                    <button 
                      type="button"
                      onClick={() => toggleSpeech("distraction", (v) => setRev("distraction", v))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeListening.distraction ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.distraction} />
                      <span>{activeListening.distraction ? "Listening..." : "🎙️ Speak"}</span>
                    </button>
                  </div>
                  <input type="text" placeholder="What got in the way?" value={rev.distraction} onChange={e=>setRev("distraction",e.target.value)} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600"/>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">⚡ Energy Level: <span className="text-blue-600 dark:text-blue-400 font-bold">{rev.energy}/10</span></label>
                  <input type="range" min="1" max="10" value={rev.energy} onChange={e=>setRev("energy",+e.target.value)} className="w-full accent-blue-500 cursor-pointer"/>
                  <div className="flex justify-between text-xs text-slate-400 dark:text-slate-600"><span>Exhausted</span><span>Peak Energy</span></div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-500 dark:text-slate-400">📝 Notes & Reflections</label>
                    <button 
                      type="button"
                      onClick={() => toggleSpeech("notes", (v) => setRev("notes", v))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${activeListening.notes ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/5"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.notes} />
                      <span>{activeListening.notes ? "Listening..." : "🎙️ Speak"}</span>
                    </button>
                  </div>
                  <textarea rows={4} placeholder="Reflect on your work, learnings, ideas…" value={rev.notes} onChange={e=>setRev("notes",e.target.value)} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 resize-none"/>
                </div>
              </div>
              {/* All reviews list */}
              {Object.keys(dailyReviews).length>0&&<div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "260ms" }}>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Past Reviews</h3>
                <div className="space-y-3">
                  {Object.entries(dailyReviews).filter(([,v])=>v.win||v.notes).sort((a,b)=>b[0].localeCompare(a[0])).map(([d,v], idx)=>(
                    <div 
                      key={d} 
                      className="p-3 bg-slate-100 dark:bg-white/3 rounded-xl border border-slate-200 dark:border-white/5 transition-all hover:scale-[1.01] hover:border-blue-500/20 duration-300 animate-slide-in-right opacity-0"
                      style={{ animationDelay: `${320 + idx * 60}ms` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{d}</span>
                        <span className="text-xs text-slate-500">Energy: {v.energy}/10</span>
                      </div>
                      {v.win&&<p className="text-xs text-green-600 dark:text-green-400 font-semibold">🏆 {v.win}</p>}
                      {v.distraction&&<p className="text-xs text-red-600 dark:text-red-400">⚠️ {v.distraction}</p>}
                      {v.notes&&<p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{v.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>}
            </div>
          );
        })()}

        {/* ── ANALYTICS ── */}
        {tab==="Analytics" && <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Most Productive" value={mostProductiveDay||"—"} sub="day" delay={100}/>
            <StatCard label="Longest Session" value={`${longestSession.toFixed(2)}h`} accent="text-purple-600 dark:text-purple-400" delay={150}/>
            <StatCard label="Avg Session" value={`${avgSession}h`} delay={200}/>
            <StatCard label="Total Sessions" value={sessions.length} delay={250}/>
          </div>

          {dayData.length>0&&<div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "300ms" }}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Hours per Day</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#ffffff08" : "#00000008"}/>
                <XAxis dataKey="day" tick={{fill: darkMode ? "#94a3b8" : "#475569", fontSize:11}}/>
                <YAxis tick={{fill: darkMode ? "#94a3b8" : "#475569", fontSize:11}}/>
                <Tooltip 
                  contentStyle={darkMode ? {background:"#0f172a",border:"1px solid #1e293b",borderRadius:12} : {background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12}} 
                  labelStyle={darkMode ? {color:"#94a3b8"} : {color:"#64748b"}} 
                  itemStyle={darkMode ? {color:"#3b82f6"} : {color:"#2563eb"}}
                />
                <Bar dataKey="hrs" fill="url(#barGrad)" radius={[6,6,0,0]}/>
                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs>
              </BarChart>
            </ResponsiveContainer>
          </div>}

          {catData.length>0&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "350ms" }}>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Hours by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={catData} dataKey="hrs" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3} animationDuration={800}>
                    {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i%CAT_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip 
                    contentStyle={darkMode ? {background:"#0f172a",border:"1px solid #1e293b",borderRadius:12} : {background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:12}} 
                    itemStyle={darkMode ? {color:"#e2e8f0"} : {color:"#0f172a"}}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "400ms" }}>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {catData.sort((a,b)=>b.hrs-a.hrs).map((c, index)=>(
                  <div 
                    key={c.name} 
                    className="flex items-center gap-3 transition-all duration-300 hover:translate-x-1 animate-slide-in-right opacity-0"
                    style={{ animationDelay: `${450 + index * 60}ms` }}
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{background:CAT_COLORS[CATEGORIES.indexOf(c.name)%CAT_COLORS.length]}}/>
                    <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">{c.name}</span>
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-[1000ms] ease-out" style={{width:`${(c.hrs/doneHrs)*100}%`,background:CAT_COLORS[CATEGORIES.indexOf(c.name)%CAT_COLORS.length]}}/>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 text-right">{c.hrs}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>}

          {/* Heatmap */}
          {dayData.length>0&&<div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "480ms" }}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Productivity Heatmap (10-day sprint)</h3>
            <div className="flex gap-2 flex-wrap">
              {Array.from({length:10},(_,i)=>{
                const d=new Date(startDate); d.setDate(d.getDate()+i);
                const ds=d.toISOString().slice(0,10);
                const hrs=dayMap[ds]?.hrs||0;
                const alpha=Math.min(1,hrs/10);
                return (
                  <div 
                    key={ds} 
                    className="flex flex-col items-center gap-1 transition-all duration-300 hover:scale-110 animate-scale-up opacity-0"
                    style={{ animationDelay: `${520 + i * 40}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all text-slate-900 dark:text-white hover:border-blue-500/40" style={{background:`rgba(59,130,246,${0.05+alpha*0.95})`,border: darkMode ? `1px solid rgba(59,130,246,${0.1+alpha*0.4})` : `1px solid rgba(59,130,246,${0.2+alpha*0.4})`}}>
                      {hrs>0?`${hrs.toFixed(1)}`:"—"}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-600 font-semibold">D{i+1}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-3 animate-scale-up opacity-0" style={{ animationDelay: "900ms" }}>
              <span className="text-xs text-slate-500 dark:text-slate-500">Less</span>
              {[0.1,0.3,0.5,0.7,0.9].map(a=><div key={a} className="w-4 h-4 rounded" style={{background:`rgba(59,130,246,${a})`}}/>)}
              <span className="text-xs text-slate-500 dark:text-slate-500">More</span>
            </div>
          </div>}

          {sessions.length===0&&<div className="text-center py-12 text-slate-500 animate-scale-up opacity-0" style={{ animationDelay: "200ms" }}>Log sessions to see your analytics.</div>}
        </div>}

        {/* ── ACHIEVEMENTS ── */}
        {tab==="Achievements" && <div className="space-y-6">
          <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
            <h2 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Achievement Badges</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Unlock badges as you complete your 100-hour sprint.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {BADGES.map((b, index)=>{
                const earned=doneHrs>=b.req;
                return (
                  <div 
                    key={b.id} 
                    className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 hover:scale-[1.06] hover:shadow-lg animate-scale-up opacity-0 ${earned?"bg-blue-600/10 border-blue-500/30 hover:border-blue-500/40":"bg-slate-100 dark:bg-white/3 border-slate-200 dark:border-white/5 opacity-50"}`}
                    style={{ animationDelay: `${150 + index * 70}ms` }}
                  >
                    <span className="text-4xl animate-float" style={{ animationDelay: `${index * 200}ms` }}>{b.icon}</span>
                    <span className={`text-sm font-bold ${earned?"text-slate-900 dark:text-white":"text-slate-400 dark:text-slate-500"}`}>{b.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{b.req} hours</span>
                    {earned
                      ?<span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 font-bold">Unlocked ✓</span>
                      :<span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/5 text-slate-500">{(b.req-doneHrs).toFixed(1)}h to go</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "500ms" }}>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Your Journey So Far</h3>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-blue-600 dark:text-blue-400 animate-pulse">{doneHrs}</div>
              <div>
                <div className="text-slate-700 dark:text-slate-300 font-bold text-sm">hours invested</div>
                <div className="text-xs text-slate-500 dark:text-slate-500 font-semibold">{sessions.length} total sessions · {streak} day streak</div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-semibold">{earnedBadges.length} / {BADGES.length} badges earned</div>
              </div>
            </div>
          </div>
        </div>}

      </div>
    </div>
  );
}
