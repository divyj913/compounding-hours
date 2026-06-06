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

const CATEGORIES = ["Video Editing", "Content Curation", "Motion Graphics", "Color Grading", "Sound Design", "Learning", "Outreach", "Other"];
const CAT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#10b981", "#f97316", "#6b7280"];

const BADGES = [
  { id: "first", label: "First Hour", req: 1 },
  { id: "ten", label: "10 Hours", req: 10 },
  { id: "quarter", label: "25 Hours", req: 25 },
  { id: "half", label: "50 Hours", req: 50 },
  { id: "seventy", label: "75 Hours", req: 75 },
  { id: "century", label: "100 Hours", req: 100 },
];

const TABS = ["Dashboard", "Log", "Journal", "Daily Review", "Analytics", "Achievements"];

const fmtTime = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const today = () => new Date().toISOString().slice(0, 10);
const parseHrs = (start: string | undefined | null, end: string | undefined | null) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number), [eh, em] = end.split(":").map(Number);
  const startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) {
    endM += 24 * 60; // Rollover to the next day
  }
  return Math.max(0, (endM - startM) / 60);
};

const getNextDate = (dateStr: string): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};


// Premium design tokens
const glassCard = "bg-white dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-xs dark:shadow-none transition-all duration-200 noise-bg relative overflow-hidden hover:border-slate-300 dark:hover:border-zinc-700/80";
const btnBlue = "bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "bg-slate-100 hover:bg-slate-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer border border-slate-200 dark:border-zinc-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500";
const btnDanger = "bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer border border-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500";
const inputClass = "w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-zinc-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 placeholder-slate-400 dark:placeholder-zinc-600";

// SVG Icons Dictionary
const Icons = {
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  LockOpen: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  Sun: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21m8.966-8.966h-2.25m-13.5 0h-2.25m15.364-7.864-1.591 1.591M6.3 17.7l-1.591 1.591m12.728 0-1.591-1.591M6.3 6.3 4.71 4.71M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
    </svg>
  ),
  Moon: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  ),
  CloudSync: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
    </svg>
  ),
  LocalMode: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
  ),
  Timer: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  Pomodoro: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.773-1.591 1.591M3 12h2.25m.386-6.364 1.591 1.591M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
    </svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  Export: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  Import: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  ),
  Voice: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  Trophy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3-3h.375a3 3 0 0 0 3-3v-.375a3 3 0 0 0-3-3h-.375a3.01 3.01 0 0 1-3-3V3.75m9 15h-9M12 18.75v3m-3 0h6m-9-2.25H6.75a3 3 0 0 1-3-3v-.375a3 3 0 0 1 3-3h.375a3.01 3.01 0 0 0 3-3V3.75m3 15V3.75" />
    </svg>
  ),
  Flame: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
    </svg>
  ),
  Lightning: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  ),
  TrophyLarge: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3-3h.375a3 3 0 0 0 3-3v-.375a3 3 0 0 0-3-3h-.375a3.01 3.01 0 0 1-3-3V3.75m9 15h-9M12 18.75v3m-3 0h6m-9-2.25H6.75a3 3 0 0 1-3-3v-.375a3 3 0 0 1 3-3h.375a3.01 3.01 0 0 0 3-3V3.75m3 15V3.75" />
    </svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.187L15 15l-5.187.904zM18 5.25L17.25 8.25L14.25 9l3 1.5l.75 3l1.5-3l3-.75l-3-.75l-.75-3.75z" />
    </svg>
  ),
  Activity: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
    </svg>
  ),
  Calendar: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  ),
  Star: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.172-.468.828-.468.999 0l1.834 5.007 5.388.788c.5.072.7.69.333 1.043l-3.9 3.8 1.05 5.378c.09.462-.394.815-.81.6L12 17.654l-4.81 2.527c-.416.215-.898-.138-.81-.6l1.05-5.378-3.9-3.8c-.367-.353-.166-.97.333-1.043l5.388-.788 1.834-5.007Z" />
    </svg>
  ),
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  ),
  SignOut: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  ),
  Clock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
};

const getBadgeIcon = (id: string, earned: boolean) => {
  const colorClass = earned ? "text-blue-500" : "text-slate-300 dark:text-zinc-700";
  switch (id) {
    case "first":
      return <div className={colorClass}><Icons.Lightning /></div>;
    case "ten":
      return <div className={colorClass}><Icons.Flame /></div>;
    case "quarter":
      return <div className={colorClass}><Icons.Sparkles /></div>;
    case "half":
      return <div className={colorClass}><Icons.Star /></div>;
    case "seventy":
      return <div className={colorClass}><Icons.Lightning /></div>;
    case "century":
      return <div className={colorClass}><Icons.Trophy /></div>;
    default:
      return <div className={colorClass}><Icons.Sparkles /></div>;
  }
};

function CircleProgress({ pct, darkMode }: { pct: number; darkMode: boolean }) {
  const r = 54, c = 2 * Math.PI * r, dash = (pct / 100) * c;
  return (
    <svg width="140" height="140" className="drop-shadow-sm transition-transform duration-300">
      <circle cx="70" cy="70" r={r} fill="none" stroke={darkMode ? "#27272a" : "#e2e8f0"} strokeWidth="10" />
      <circle cx="70" cy="70" r={r} fill="none" stroke="url(#blueGrad)" strokeWidth="10"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 70 70)" style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <defs>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
      <text x="70" y="65" textAnchor="middle" fill="currentColor" className="text-slate-900 dark:text-zinc-100 font-bold" fontSize="22">{pct}%</text>
      <text x="70" y="83" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-zinc-400" fontSize="11">complete</text>
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
      className={`${glassCard} p-5 flex flex-col gap-1.5 animate-scale-up opacity-0`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold tracking-tight ${accent || "text-slate-900 dark:text-zinc-100"}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500 dark:text-zinc-400">{sub}</span>}
    </div>
  );
}

function VoiceWaveform({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex items-center gap-0.5 h-3 px-1">
      <div className="w-0.5 h-2.5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.1s" }} />
      <div className="w-0.5 h-3.5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.3s" }} />
      <div className="w-0.5 h-1.5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.5s" }} />
      <div className="w-0.5 h-4.5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.2s" }} />
      <div className="w-0.5 h-2.5 bg-red-500 dark:bg-red-400 rounded-full animate-wave-bar origin-bottom" style={{ animationDelay: "0.4s" }} />
    </div>
  );
}
function TiltContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Max rotation 12 degrees
    const rX = -(mouseY / (height / 2)) * 12;
    const rY = (mouseX / (width / 2)) * 12;
    
    setTilt({ x: rX, y: rY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  const style: React.CSSProperties = {
    transform: isHovered
      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.02, 1.02, 1.02)`
      : `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transition: isHovered ? "transform 0.05s ease-out" : "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
    transformStyle: "preserve-3d",
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={style}
      className={className}
    >
      {children}
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
    try { return JSON.parse(localStorage.getItem("sprint_sessions") || "[]"); } catch { return []; }
  });
  const [dailyReviews, setDailyReviews] = useState<DailyReviews>(() => {
    try { return JSON.parse(localStorage.getItem("sprint_reviews") || "{}"); } catch { return {}; }
  });
  const [startDate] = useState(() => localStorage.getItem("sprint_start") || (() => { const d = today(); localStorage.setItem("sprint_start", d); return d; })());

  // Session form
  const [form, setForm] = useState<Omit<Session, "id" | "duration">>({ date: today(), start: "", end: "", project: "", desc: "", cat: "Video Editing" });
  const [formMsg, setFormMsg] = useState("");

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSecs, setTimerSecs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sprint_timer_secs");
      return saved !== null ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [timerStart, setTimerStart] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem("sprint_timer_start");
      return saved !== null ? new Date(saved) : null;
    } catch {
      return null;
    }
  });
  const [pomSecs, setPomSecs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sprint_pom_secs");
      return saved !== null ? Number(saved) : 25 * 60;
    } catch {
      return 25 * 60;
    }
  });
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
        const { data: cloudSessions, error: sessError } = await supabase
          .from("sessions")
          .select("*")
          .order("id", { ascending: true });

        if (sessError) throw sessError;
        if (cloudSessions) {
          setSessions(cloudSessions as Session[]);
        }

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

  // Persist local storage as cache
  useEffect(() => { localStorage.setItem("sprint_sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("sprint_reviews", JSON.stringify(dailyReviews)); }, [dailyReviews]);

  // Timer and Pomodoro persistence
  useEffect(() => {
    localStorage.setItem("sprint_timer_secs", String(timerSecs));
  }, [timerSecs]);

  useEffect(() => {
    if (timerStart) {
      localStorage.setItem("sprint_timer_start", timerStart.toISOString());
    } else {
      localStorage.removeItem("sprint_timer_start");
    }
  }, [timerStart]);

  useEffect(() => {
    localStorage.setItem("sprint_pom_secs", String(pomSecs));
  }, [pomSecs]);


  // Timer tick
  useEffect(() => {
    if (timerRunning) { timerRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000); }
    else if (timerRef.current !== null) { clearInterval(timerRef.current); }
    return () => { if (timerRef.current !== null) clearInterval(timerRef.current); };
  }, [timerRunning]);

  // Pomodoro tick
  useEffect(() => {
    if (pomRunning) { pomRef.current = setInterval(() => setPomSecs(s => { if (s <= 1) { if (pomRef.current !== null) clearInterval(pomRef.current); setPomRunning(false); return 0; } return s - 1; }), 1000); }
    else if (pomRef.current !== null) { clearInterval(pomRef.current); }
    return () => { if (pomRef.current !== null) clearInterval(pomRef.current); };
  }, [pomRunning]);

  const totalHrs = sessions.reduce((a, s) => a + s.duration, 0);
  const doneHrs = +totalHrs.toFixed(2);
  const remHrs = +(100 - doneHrs).toFixed(2);
  const pct = Math.min(100, Math.round(doneHrs));

  const daysSince = Math.max(1, Math.ceil((Date.now() - new Date(startDate).getTime()) / (1000 * 86400)));
  const daysLeft = Math.max(0, 10 - daysSince + 1);
  const avgPerDay = +(doneHrs / Math.max(1, daysSince - 1 + (daysSince === 1 ? 0.5 : 0))).toFixed(2);
  const reqPace = daysLeft > 0 ? +(remHrs / daysLeft).toFixed(2) : 0;

  // streak
  const streak = (() => {
    const days = [...new Set(sessions.map(s => s.date))].sort().reverse();
    let str = 0, cur = new Date();
    for (const d of days) {
      const dd = new Date(d); dd.setHours(0, 0, 0, 0); cur.setHours(0, 0, 0, 0);
      const diff = Math.round((cur.getTime() - dd.getTime()) / 86400000);
      if (diff > 1) break; str++; cur = dd;
    }
    return str;
  })();

  const motivation = doneHrs === 0 ? "Start your first session — every hour compounds."
    : doneHrs >= 100 ? "MISSION COMPLETE! You did it!"
    : avgPerDay >= reqPace ? "You're ahead of schedule. Keep this pace!"
    : `You need ${reqPace} hrs/day to finish on time. Focus now!`;

  const estCompletion = reqPace > 0 ? `~${daysLeft} day${daysLeft !== 1 ? "s" : ""} at ${reqPace} hrs/day` : "Done!";

  // Per-day data
  const dayMap: { [key: string]: { hrs: number; tasks: number } } = {};
  sessions.forEach(s => {
    if (!dayMap[s.date]) dayMap[s.date] = { hrs: 0, tasks: 0 };
    dayMap[s.date].hrs += s.duration; dayMap[s.date].tasks++;
  });
  const dayData = Object.entries(dayMap).sort().map(([d, v]) => ({ day: d.slice(5), hrs: +v.hrs.toFixed(2) }));

  // Per-cat data
  const catMap: { [key: string]: number } = {};
  sessions.forEach(s => { catMap[s.cat] = (catMap[s.cat] || 0) + s.duration; });
  const catData = Object.entries(catMap).map(([n, v]) => ({ name: n, hrs: +v.toFixed(2) }));

  const longestSession = sessions.reduce((a, s) => s.duration > a ? s.duration : a, 0);
  const avgSession = sessions.length ? +(doneHrs / sessions.length).toFixed(2) : 0;
  const mostProductiveDay = dayData.reduce((a, b) => b.hrs > a.hrs ? b : a, { day: "—", hrs: 0 }).day;

  const earnedBadges = BADGES.filter(b => doneHrs >= b.req);

  const addSession = async () => {
    const dur = parseHrs(form.start, form.end);
    if (!form.date || !form.start || !form.end || dur <= 0) { setFormMsg("Please fill all fields with valid times."); return; }
    if (!form.desc.trim()) { setFormMsg("Add a task description."); return; }

    const [sh, sm] = form.start.split(":").map(Number);
    const [eh, em] = form.end.split(":").map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    const sessionsToAdd: Session[] = [];

    if (endM < startM) {
      // Midnight rollover - split into two sessions
      const dur1 = parseHrs(form.start, "00:00");
      if (dur1 > 0) {
        sessionsToAdd.push({
          ...form,
          id: Date.now(),
          end: "00:00",
          duration: +dur1.toFixed(2),
        });
      }

      const dur2 = parseHrs("00:00", form.end);
      if (dur2 > 0 && form.end !== "00:00") {
        sessionsToAdd.push({
          ...form,
          id: Date.now() + 1,
          date: getNextDate(form.date),
          start: "00:00",
          duration: +dur2.toFixed(2),
        });
      }
    } else {
      sessionsToAdd.push({
        ...form,
        id: Date.now(),
        duration: +dur.toFixed(2),
      });
    }

    setSessions(prev => [...prev, ...sessionsToAdd]);
    setForm(f => ({ ...f, start: "", end: "", project: "", desc: "", cat: "Video Editing" }));
    setFormMsg("✅ Session logged!");
    setTimeout(() => setFormMsg(""), 2500);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("sessions").insert(sessionsToAdd);
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
    if (timerStart) {
      const now = new Date(), s = new Date(timerStart);
      setForm(f => ({
        ...f,
        date: today(),
        start: `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
        end: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      }));
      setTab("Log");
    }
    setTimerSecs(0); setTimerStart(null);
  };

  const exportCSV = () => {
    const h = "Date,Start,End,Duration(hrs),Project,Category,Description";
    const rows = sessions.map(s => `${s.date},${s.start},${s.end},${s.duration},"${s.project}",${s.cat},"${s.desc}"`);
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent([h, ...rows].join("\n")); a.download = "sprint_log.csv"; a.click();
  };
  const exportJSON = () => {
    const a = document.createElement("a"); a.href = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify({sessions, dailyReviews, startDate}, null, 2)); a.download = "sprint_data.json"; a.click();
  };
  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const res = ev.target?.result;
        if (typeof res === "string") {
          const d = JSON.parse(res);
          if (d.sessions) setSessions(d.sessions);
          if (d.dailyReviews) setDailyReviews(d.dailyReviews);
        }
      } catch { }
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

  const journalSessions = [...sessions].sort((a, b) => new Date(a.date + ' ' + a.start).getTime() - new Date(b.date + ' ' + b.start).getTime());

  // Focus mode overlay
  if (focusMode) return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center z-50 gap-8">
      <div className="text-blue-600 dark:text-blue-400 text-xs font-semibold tracking-widest uppercase">Focus Mode</div>
      <div className="text-8xl font-mono font-bold text-slate-900 dark:text-zinc-50 tabular-nums select-none tracking-tight">{fmtTime(timerSecs)}</div>
      <div className="flex gap-3">
        <button className={btnBlue} onClick={() => { if (!timerRunning && timerSecs === 0) setTimerStart(new Date()); setTimerRunning(r => !r); }}>{timerRunning ? "Pause" : "Start"}</button>
        <button className={btnDanger} onClick={stopTimerAndFill}>Stop & Log</button>
        <button className={btnSecondary} onClick={() => setFocusMode(false)}>Exit</button>
      </div>
    </div>
  );

  // Passcode Lockscreen UI
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-300 px-4 py-8 flex items-center justify-center relative overflow-hidden">
        {/* Subtle centered top radial gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] pointer-events-none blur-[100px]" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 70%)" }} />

        {/* 3D Floating Elements Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {/* Cube 1 (top-left, small blue rotating) */}
          <div className="scene3d float3d-1 top-[15%] left-[8%] hidden lg:block">
            <div className="cube3d">
              <div className="face3d face3d-front" />
              <div className="face3d face3d-back" />
              <div className="face3d face3d-right" />
              <div className="face3d face3d-left" />
              <div className="face3d face3d-top" />
              <div className="face3d face3d-bottom" />
            </div>
          </div>

          {/* Cube 2 (bottom-right, large purple rotating) */}
          <div className="scene3d float3d-2 bottom-[10%] right-[5%] hidden md:block">
            <div className="cube3d cube3d-slow cube3d-large">
              <div className="face3d face3d-front" />
              <div className="face3d face3d-back" />
              <div className="face3d face3d-right" />
              <div className="face3d face3d-left" />
              <div className="face3d face3d-top" />
              <div className="face3d face3d-bottom" />
            </div>
          </div>

          {/* Cube 3 (middle-left, small rotating) */}
          <div className="scene3d float3d-3 bottom-[20%] left-[12%] hidden xl:block">
            <div className="cube3d">
              <div className="face3d face3d-front" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
              <div className="face3d face3d-back" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
              <div className="face3d face3d-right" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
              <div className="face3d face3d-left" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
              <div className="face3d face3d-top" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
              <div className="face3d face3d-bottom" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }} />
            </div>
          </div>
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 cursor-pointer z-50"
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Icons.Sun /> : <Icons.Moon />}
        </button>

        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start z-10">
          {/* Left Panel: Passcode Lock */}
          <div className="md:col-span-5 space-y-6 animate-scale-up opacity-0" style={{ animationDelay: "100ms" }}>
            <TiltContainer className="w-full">
              <div className={`w-full p-8 ${glassCard} text-center space-y-6 shadow-xs ${isShaking ? "animate-shake" : ""}`} style={{ transformStyle: "preserve-3d" }}>
                <div className="space-y-3" style={{ transform: "translateZ(25px)", transformStyle: "preserve-3d" }}>
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2" style={{ transform: "translateZ(35px)" }}>
                    <Icons.Lock />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-50" style={{ transform: "translateZ(20px)" }}>Welcome back, Divy</h1>
                  <p className="text-xs text-slate-500 dark:text-zinc-400" style={{ transform: "translateZ(12px)" }}>Enter your passcode to unlock full dashboard access.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: "translateZ(25px)", transformStyle: "preserve-3d" }}>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={passcode}
                    onChange={e => {
                      setPasscode(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    className="w-full text-center tracking-widest bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 placeholder-slate-300 dark:placeholder-zinc-700 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200"
                    autoFocus
                    style={{ transform: "translateZ(18px)" }}
                  />

                  {errorMsg && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium" style={{ transform: "translateZ(18px)" }}>{errorMsg}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold transition-all cursor-pointer shadow-xs"
                    style={{ transform: "translateZ(18px)" }}
                  >
                    Unlock Dashboard
                  </button>
                </form>

                {!import.meta.env.VITE_DASHBOARD_PASSCODE && (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium" style={{ transform: "translateZ(10px)" }}>Default passcode is <code className="bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 px-1.5 py-0.5 rounded font-bold">divy100</code></p>
                )}
              </div>
            </TiltContainer>
          </div>

          {/* Right Panel: Scout Challenge Progress Stream */}
          <div className="md:col-span-7 space-y-6 animate-scale-up opacity-0" style={{ animationDelay: "200ms" }}>
            <div className={`p-6 ${glassCard} space-y-6 shadow-xs`}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Icons.Sparkles />
                    <span>Challenge Tracker</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Scout view: Live progress of Divy's 100-hour sprint.</p>
                </div>
                <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-ring" />
                  <span>Live</span>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60">
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Done</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{doneHrs}h</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60">
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Remaining</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-zinc-200">{remHrs}h</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60">
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Streak</div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">{streak}d</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60">
                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider">Days Left</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-zinc-200">{daysLeft}d</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-zinc-400">Total Completion</span>
                  <span className="text-blue-600 dark:text-blue-400">{pct}%</span>
                </div>
                <div className="h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-[1000ms] ease-out bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* 10-Day Productivity Heatmap */}
              {dayData.length > 0 && (
                <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800/80 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Activity Heatmap</h3>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: 10 }, (_, i) => {
                      const d = new Date(startDate); d.setDate(d.getDate() + i);
                      const ds = d.toISOString().slice(0, 10);
                      const hrs = dayMap[ds]?.hrs || 0;
                      const alpha = Math.min(1, hrs / 10);
                      return (
                        <div key={ds} className="flex flex-col items-center gap-1 transition-all duration-300">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-900 dark:text-white" style={{ background: `rgba(59,130,246,${0.05 + alpha * 0.95})`, border: darkMode ? `1px solid rgba(59,130,246,${0.1 + alpha * 0.3})` : `1px solid rgba(59,130,246,${0.2 + alpha * 0.3})` }}>
                            {hrs > 0 ? `${hrs.toFixed(1)}` : "—"}
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-zinc-600 font-semibold">D{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Focus Breakdown */}
              {catData.length > 0 && (
                <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800/80 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Sprint Focus</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {catData.sort((a, b) => b.hrs - a.hrs).slice(0, 4).map((c) => (
                      <div key={c.name} className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60 flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span className="text-slate-600 dark:text-zinc-400 truncate">{c.name}</span>
                          <span className="text-blue-600 dark:text-blue-400">{c.hrs}h</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(c.hrs / doneHrs) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activities */}
              <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800/80 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Latest Activities</h3>
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No work logged yet. The challenge is just beginning!</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {[...sessions].reverse().slice(0, 4).map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800/60 flex items-start gap-3 transition-all duration-300"
                      >
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">{s.duration}h</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{s.cat}</span>
                            {s.project && <span className="text-[10px] text-slate-400 dark:text-zinc-500">· {s.project}</span>}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-zinc-400 truncate">{s.desc}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">{s.date.slice(5)}</span>
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-300 relative overflow-hidden">
      {/* Subtle radial background tint */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] pointer-events-none blur-[100px]" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, rgba(0,0,0,0) 70%)" }} />

      {/* Header */}
      <div className="border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Icons.Lightning />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-zinc-50 tracking-tight">Compound</div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500">100 Hours in 10 Days</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-all text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 cursor-pointer"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Icons.Sun /> : <Icons.Moon />}
            </button>

            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${isSupabaseConfigured ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"}`}
              title={isSupabaseConfigured ? "Syncing to Supabase Cloud Database" : "Saving locally to browser LocalStorage. Configure .env.local to enable cloud sync."}
            >
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="hidden sm:inline">{isSupabaseConfigured ? "Cloud Sync" : "Local Mode"}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <span className="text-xs text-slate-500 dark:text-zinc-400">Total:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-200">{doneHrs}h</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
              {daysLeft}d left
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("sprint_authenticated");
                setIsAuthenticated(false);
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-all text-slate-600 dark:text-zinc-400 hover:text-red-500 cursor-pointer"
              title="Log Out & Lock"
            >
              <Icons.SignOut />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Underline layout) */}
        <div className="border-t border-slate-200 dark:border-zinc-800/80">
          <div className="max-w-6xl mx-auto px-4 flex gap-6 overflow-x-auto pb-px scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3.5 text-xs font-semibold relative whitespace-nowrap transition-all cursor-pointer ${tab === t ? "text-blue-600 dark:text-blue-400" : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
              >
                {t}
                {tab === t && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-fade-in" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 z-10 relative">
        {/* ── DASHBOARD ── */}
        {tab === "Dashboard" && (
          <div className="space-y-6 animate-fade-in">
            {/* Top alert callout banner instead of floating message */}
            <div className="animate-scale-up opacity-0" style={{ animationDelay: "50ms" }}>
              <div className={`w-full p-4 rounded-xl text-sm font-medium border flex items-center gap-2.5 ${doneHrs === 0 ? "bg-blue-500/5 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300"
                : doneHrs >= 100 ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300"
                  : avgPerDay >= reqPace ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-500/5 dark:bg-red-500/10 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300"
                }`}>
                <div className="shrink-0">
                  {doneHrs >= 100 || avgPerDay >= reqPace ? <Icons.Check /> : doneHrs === 0 ? <Icons.Lightning /> : <Icons.AlertTriangle />}
                </div>
                <span>{motivation}</span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Hours Done" value={doneHrs} sub="of 100 hrs" accent="text-blue-600 dark:text-blue-400" delay={100} />
              <StatCard label="Hours Left" value={remHrs} sub={estCompletion} delay={150} />
              <StatCard label="Current Streak" value={`${streak}d`} sub="consecutive days" accent="text-green-600 dark:text-green-400" delay={200} />
              <StatCard label="Days Left" value={daysLeft} sub="out of 10" delay={250} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <StatCard label="Avg / Day" value={`${avgPerDay}h`} sub="so far" delay={300} />
              <StatCard label="Required Pace" value={`${reqPace}h`} sub="per day needed" accent={reqPace > 8 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"} delay={350} />
              <StatCard label="Sessions" value={sessions.length} sub={`avg ${avgSession}h each`} delay={400} />
            </div>

            {/* Circular progress and milestones */}
            <div className={`${glassCard} p-6 flex flex-col sm:flex-row items-center gap-8 animate-scale-up opacity-0`} style={{ animationDelay: "450ms" }}>
              <div className="shrink-0">
                <CircleProgress pct={pct} darkMode={darkMode} />
              </div>
              <div className="flex-1 w-full space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-slate-600 dark:text-zinc-400">Overall Progress</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{doneHrs} / 100 hrs</span>
                  </div>
                  <div className="h-2.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-[1000ms] ease-out bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="pt-2 space-y-2.5">
                  {[10, 25, 50, 75, 100].map((m) => {
                    const achieved = doneHrs >= m;
                    return (
                      <div key={m} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 w-8">{m}h</span>
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (doneHrs / m) * 100)}%`, background: achieved ? "#10b981" : "#3b82f6" }} />
                        </div>
                        <div className={`shrink-0 ${achieved ? "text-emerald-500" : "text-slate-300 dark:text-zinc-700"}`}>
                          <Icons.Check />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Timer card */}
            <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "500ms" }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                    <div className={timerRunning ? "animate-spin-slow text-blue-500" : ""}>
                      <Icons.Timer />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider mb-0.5">Session Timer</div>
                    <div className="text-4xl font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums select-none tracking-tight">{fmtTime(timerSecs)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className={btnBlue} onClick={() => { if (!timerRunning && timerSecs === 0) setTimerStart(new Date()); setTimerRunning(r => !r); }}>{timerRunning ? "Pause" : "Start"}</button>
                  <button className={btnDanger} onClick={stopTimerAndFill}>Stop & Log</button>
                  <button className={btnSecondary} onClick={() => { setTimerRunning(false); setTimerSecs(0); setTimerStart(null); }}>Reset</button>
                  <button className={btnSecondary} onClick={() => setFocusMode(true)}>Focus Mode</button>
                </div>

                <div className="border-t md:border-t-0 md:border-l border-slate-200 dark:border-zinc-800/80 pt-4 md:pt-0 md:pl-6 flex items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                    <div className={pomRunning ? "animate-pulse text-orange-500" : ""}>
                      <Icons.Clock />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold tracking-wider mb-0.5">Pomodoro</div>
                    <div className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-400 tabular-nums">{fmtTime(pomSecs)}</div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600/10 hover:bg-orange-600/20 border border-orange-500/20 text-orange-600 dark:text-orange-400 transition-all cursor-pointer" onClick={() => setPomRunning(r => !r)}>{pomRunning ? "Pause" : "Start"}</button>
                    <button className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 cursor-pointer border border-slate-200 dark:border-zinc-800/60" onClick={() => { setPomRunning(false); setPomSecs(25 * 60); }} title="Reset Pomodoro"><Icons.Trash /></button>
                    <button className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 cursor-pointer border border-slate-200 dark:border-zinc-800/60" onClick={() => { setPomRunning(false); setPomSecs(5 * 60); }}>5m</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Data management actions */}
            <div className={`${glassCard} p-4 flex flex-wrap gap-2 items-center justify-between animate-scale-up opacity-0`} style={{ animationDelay: "550ms" }}>
              <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Data Settings</span>
              <div className="flex flex-wrap gap-2">
                <button className={btnSecondary + " py-2 text-xs flex items-center gap-1.5"} onClick={exportCSV}>
                  <Icons.Export />
                  <span>Export CSV</span>
                </button>
                <button className={btnSecondary + " py-2 text-xs flex items-center gap-1.5"} onClick={exportJSON}>
                  <Icons.Export />
                  <span>Export JSON</span>
                </button>
                <label className={btnSecondary + " py-2 text-xs flex items-center gap-1.5"}>
                  <Icons.Import />
                  <span>Import JSON</span>
                  <input type="file" accept=".json" className="hidden" onChange={importJSON} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === "Log" && (
          <div className="space-y-6 animate-fade-in">
            <div className={`${glassCard} p-6 space-y-5 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-50">Log a Work Session</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Category</label>
                  <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))} className={inputClass} style={{ background: "none" }}>
                    {CATEGORIES.map(c => <option key={c} className="bg-white dark:bg-zinc-900">{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Start Time</label>
                  <input type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">End Time</label>
                  <input type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} className={inputClass} />
                  <div className="flex gap-1.5 pt-0.5">
                    <button type="button" onClick={() => adjustEndTime(15)} className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800/80">+15m</button>
                    <button type="button" onClick={() => adjustEndTime(30)} className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800/80">+30m</button>
                    <button type="button" onClick={() => adjustEndTime(60)} className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800/80">+1h</button>
                    <button type="button" onClick={setEndTimeNow} className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-blue-500/20">Now</button>
                  </div>
                </div>

                {form.start && form.end && (
                  <div className="sm:col-span-2 flex items-center gap-2 px-3.5 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <span className="text-xs text-slate-400 dark:text-zinc-500">Calculated duration:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{parseHrs(form.start, form.end).toFixed(2)} hours</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Project Name</label>
                  <input type="text" placeholder="e.g. Nike Brand Video" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} className={inputClass} />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Task Description</label>
                    <button
                      type="button"
                      onClick={() => toggleSpeech("desc", (v) => setForm(f => ({ ...f, desc: v })))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${activeListening.desc ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-slate-200 dark:border-zinc-800/80"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.desc} />
                      <Icons.Voice />
                      <span>{activeListening.desc ? "Listening..." : "Speak"}</span>
                    </button>
                  </div>
                  <textarea rows={3} placeholder="Edited intro sequence, color graded outdoor scenes, synced audio..." value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} className={inputClass + " resize-none"} />
                </div>
              </div>

              <div className="flex items-center gap-4 border-t border-slate-100 dark:border-zinc-800/60 pt-4">
                <button className={btnBlue + " px-6"} onClick={addSession}>Log Session</button>
                {formMsg && <span className={`text-xs font-medium ${formMsg.startsWith("✅") ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>{formMsg}</span>}
              </div>
            </div>

            {/* Recent sessions log */}
            {sessions.length > 0 && (
              <div className={`${glassCard} p-6 space-y-4 animate-scale-up opacity-0`} style={{ animationDelay: "200ms" }}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300">Logged Sessions History</h3>
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {[...sessions].reverse().map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/60 dark:border-zinc-800/60 rounded-xl hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all duration-150"
                    >
                      <div className="text-xs font-semibold text-slate-400 dark:text-zinc-500 mt-0.5 w-16 shrink-0 tabular-nums">{s.start}–{s.end}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{s.cat}</span>
                          {s.project && <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">· {s.project}</span>}
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">· {s.date}</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-zinc-300 truncate">{s.desc}</p>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-200 shrink-0 pr-1">{s.duration}h</div>
                      <button onClick={() => deleteSession(s.id)} className="text-slate-400 hover:text-red-500 transition-all cursor-pointer p-1 rounded-md hover:bg-red-500/5" title="Delete session"><Icons.Trash /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── JOURNAL ── */}
        {tab === "Journal" && (
          <div className={`${glassCard} p-6 animate-fade-in`}>
            <h2 className="text-base font-bold mb-6 text-slate-900 dark:text-zinc-50">Hour-by-Hour Journal</h2>
            {journalSessions.length === 0 ? (
              <p className="text-slate-500 dark:text-zinc-500 text-sm">No sessions logged yet. Your timeline will appear here once you log work.</p>
            ) : (
              <div className="relative">
                {/* Visual timeline guide line */}
                <div className="absolute left-6 top-1.5 bottom-1.5 w-px bg-slate-200 dark:bg-zinc-800" />
                <div className="space-y-4">
                  {journalSessions.map((s, i) => {
                    const cumHrs = journalSessions.slice(0, i + 1).reduce((a, x) => a + x.duration, 0);
                    return (
                      <div
                        key={s.id}
                        className="relative pl-14 transition-all duration-200"
                      >
                        {/* Timeline dot */}
                        <div className="absolute left-4 top-2.5 w-4 h-4 rounded-full border border-blue-500 bg-white dark:bg-zinc-950 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700/80 transition-all">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Hour {Math.ceil(cumHrs)}</span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">{s.date} · {s.start}–{s.end}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-medium">{s.cat}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-zinc-200">+{s.duration}h</span>
                          </div>
                          {s.project && <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium mb-1">Project: {s.project}</div>}
                          <p className="text-sm text-slate-700 dark:text-zinc-300">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DAILY REVIEW ── */}
        {tab === "Daily Review" && (() => {
          const selDate = form.date;
          const dayHrs = sessions.filter(s => s.date === selDate).reduce((a, s) => a + s.duration, 0);
          const dayTasks = sessions.filter(s => s.date === selDate).length;
          const rev = dailyReviews[selDate] || { win: "", distraction: "", energy: 7, notes: "" };
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
            <div className="space-y-6 animate-fade-in">
              <div className={`${glassCard} p-4 flex items-center gap-4 justify-between animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">Date</span>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-zinc-200 focus:outline-none" />
                </div>
                <div className="flex gap-4 text-xs font-semibold text-slate-500 dark:text-zinc-400 pr-1">
                  <span>Logged: <strong className="text-blue-600 dark:text-blue-400 font-bold">{dayHrs.toFixed(2)}h</strong></span>
                  <span>Tasks: <strong className="text-slate-800 dark:text-zinc-200 font-bold">{dayTasks}</strong></span>
                </div>
              </div>

              <div className={`${glassCard} p-6 space-y-6 animate-scale-up opacity-0`} style={{ animationDelay: "180ms" }}>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-50">Daily Reflection — {selDate}</h2>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Icons.Trophy />
                      <span>Biggest Win Today</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleSpeech("win", (v) => setRev("win", v))}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${activeListening.win ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-slate-200 dark:border-zinc-800/80"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.win} />
                      <Icons.Voice />
                      <span>{activeListening.win ? "Listening..." : "Speak"}</span>
                    </button>
                  </div>
                  <input type="text" placeholder="What was your main achievement?" value={rev.win} onChange={e => setRev("win", e.target.value)} className={inputClass} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Icons.AlertTriangle />
                      <span>Biggest Distraction</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleSpeech("distraction", (v) => setRev("distraction", v))}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${activeListening.distraction ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-slate-200 dark:border-zinc-800/80"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.distraction} />
                      <Icons.Voice />
                      <span>{activeListening.distraction ? "Listening..." : "Speak"}</span>
                    </button>
                  </div>
                  <input type="text" placeholder="What got in your way or broke focus?" value={rev.distraction} onChange={e => setRev("distraction", e.target.value)} className={inputClass} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                    <Icons.Lightning />
                    <span>Energy Level: <strong className="text-blue-600 dark:text-blue-400">{rev.energy}/10</strong></span>
                  </label>
                  <input type="range" min="1" max="10" value={rev.energy} onChange={e => setRev("energy", +e.target.value)} className="w-full accent-blue-500 cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-600 font-bold uppercase">
                    <span>Exhausted</span>
                    <span>Peak Energy</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-xs font-semibold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <Icons.FileText />
                      <span>Reflective Notes</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleSpeech("notes", (v) => setRev("notes", v))}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${activeListening.notes ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 animate-pulse" : "bg-slate-100 dark:bg-zinc-900 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-slate-200 dark:border-zinc-800/80"}`}
                      title="Speak to type"
                    >
                      <VoiceWaveform active={activeListening.notes} />
                      <Icons.Voice />
                      <span>{activeListening.notes ? "Listening..." : "Speak"}</span>
                    </button>
                  </div>
                  <textarea rows={4} placeholder="Reflections on speed, flow state, patterns or things to optimize tomorrow..." value={rev.notes} onChange={e => setRev("notes", e.target.value)} className={inputClass + " resize-none"} />
                </div>
              </div>

              {/* Past reviews list */}
              {Object.keys(dailyReviews).length > 0 && (
                <div className={`${glassCard} p-6 space-y-4 animate-scale-up opacity-0`} style={{ animationDelay: "260ms" }}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300">Past Daily Reviews</h3>
                  <div className="space-y-3">
                    {Object.entries(dailyReviews).filter(([, v]) => v.win || v.notes).sort((a, b) => b[0].localeCompare(a[0])).map(([d, v]) => (
                      <div
                        key={d}
                        className="p-4 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{d}</span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Energy: {v.energy}/10</span>
                        </div>
                        <div className="space-y-1.5">
                          {v.win && (
                            <div className="flex items-start gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                              <Icons.Check />
                              <span>Win: {v.win}</span>
                            </div>
                          )}
                          {v.distraction && (
                            <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                              <Icons.AlertTriangle />
                              <span>Distraction: {v.distraction}</span>
                            </div>
                          )}
                          {v.notes && (
                            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 border-t border-slate-200/40 dark:border-zinc-800/40 pt-2">{v.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ANALYTICS ── */}
        {tab === "Analytics" && (
          <div className="space-y-6 animate-fade-in">
            {/* Top Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Most Productive" value={mostProductiveDay || "—"} sub="day" delay={100} />
              <StatCard label="Longest Session" value={`${longestSession.toFixed(2)}h`} accent="text-blue-600 dark:text-blue-400" delay={150} />
              <StatCard label="Avg Session" value={`${avgSession}h`} delay={200} />
              <StatCard label="Total Sessions" value={sessions.length} delay={250} />
            </div>

            {dayData.length > 0 && (
              <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "300ms" }}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300 mb-4">Hours per Day</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dayData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#ffffff08" : "#00000008"} />
                    <XAxis dataKey="day" tick={{ fill: darkMode ? "#71717a" : "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: darkMode ? "#71717a" : "#64748b", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={darkMode ? { background: "#18181b", border: "1px solid #27272a", borderRadius: 12 } : { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                      labelStyle={darkMode ? { color: "#a1a1aa" } : { color: "#64748b" }}
                      itemStyle={darkMode ? { color: "#3b82f6" } : { color: "#2563eb" }}
                    />
                    <Bar dataKey="hrs" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {catData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "350ms" }}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300 mb-4">Hours by Category</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={catData} dataKey="hrs" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={3} animationDuration={800}>
                        {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={darkMode ? { background: "#18181b", border: "1px solid #27272a", borderRadius: 12 } : { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
                        itemStyle={darkMode ? { color: "#fafafa" } : { color: "#0f172a" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "400ms" }}>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300 mb-4">Category Breakdown</h3>
                  <div className="space-y-3">
                    {catData.sort((a, b) => b.hrs - a.hrs).map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-3"
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[CATEGORIES.indexOf(c.name) % CAT_COLORS.length] }} />
                        <span className="text-xs text-slate-600 dark:text-zinc-300 flex-1">{c.name}</span>
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-[1000ms] ease-out" style={{ width: `${(c.hrs / doneHrs) * 100}%`, background: CAT_COLORS[CATEGORIES.indexOf(c.name) % CAT_COLORS.length] }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-zinc-300 w-10 text-right">{c.hrs}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap */}
            {dayData.length > 0 && (
              <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "480ms" }}>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300 mb-4">Productivity Heatmap (10-day sprint)</h3>
                <div className="flex gap-2 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => {
                    const d = new Date(startDate); d.setDate(d.getDate() + i);
                    const ds = d.toISOString().slice(0, 10);
                    const hrs = dayMap[ds]?.hrs || 0;
                    const alpha = Math.min(1, hrs / 10);
                    return (
                      <div
                        key={ds}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all text-slate-900 dark:text-white" style={{ background: `rgba(59,130,246,${0.05 + alpha * 0.95})`, border: darkMode ? `1px solid rgba(59,130,246,${0.1 + alpha * 0.4})` : `1px solid rgba(59,130,246,${0.2 + alpha * 0.4})` }}>
                          {hrs > 0 ? `${hrs.toFixed(1)}` : "—"}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold">D{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Less</span>
                  {[0.1, 0.3, 0.5, 0.7, 0.9].map(a => <div key={a} className="w-4 h-4 rounded" style={{ background: `rgba(59,130,246,${a})` }} />)}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">More</span>
                </div>
              </div>
            )}

            {sessions.length === 0 && <div className="text-center py-12 text-slate-500">Log sessions to see your analytics.</div>}
          </div>
        )}

        {/* ── ACHIEVEMENTS ── */}
        {tab === "Achievements" && (
          <div className="space-y-6 animate-fade-in">
            <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "100ms" }}>
              <h2 className="text-base font-bold mb-1.5 text-slate-900 dark:text-zinc-50">Achievement Badges</h2>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mb-6">Unlock sprint milestones as you invest hours into your work.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {BADGES.map((b, index) => {
                  const earned = doneHrs >= b.req;
                  return (
                    <div
                      key={b.id}
                      className={`p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all duration-300 ${earned ? "bg-blue-500/5 border-blue-500/20 dark:bg-blue-500/5 dark:border-blue-900/40" : "bg-slate-50 dark:bg-zinc-900/20 border-slate-200 dark:border-zinc-900 opacity-60"}`}
                      style={{ animationDelay: `${150 + index * 70}ms` }}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${earned ? "bg-blue-500/10 border-blue-500/20" : "bg-slate-200/50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800"}`}>
                        {getBadgeIcon(b.id, earned)}
                      </div>
                      <div className="text-center space-y-0.5">
                        <span className={`text-sm font-bold block ${earned ? "text-slate-900 dark:text-zinc-50" : "text-slate-400 dark:text-zinc-500"}`}>{b.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold block">{b.req} hours req.</span>
                      </div>
                      {earned ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">Unlocked ✓</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 font-medium">{(b.req - doneHrs).toFixed(1)}h to go</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`${glassCard} p-6 animate-scale-up opacity-0`} style={{ animationDelay: "500ms" }}>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-300 mb-4">Sprint Journey Status</h3>
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-extrabold font-mono select-none">
                  {doneHrs}
                </div>
                <div>
                  <div className="text-slate-800 dark:text-zinc-200 font-bold text-sm">Hours Invested</div>
                  <div className="text-xs text-slate-400 dark:text-zinc-500 font-medium">{sessions.length} total sessions logged · {streak} day streak</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 font-bold">{earnedBadges.length} of {BADGES.length} badges earned</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
