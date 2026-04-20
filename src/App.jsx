/**
 * Smart Job Tracker Dashboard — Monochrome Editorial Edition
 * Packages used: react-hook-form, @hookform/resolvers/yup, yup, axios, react-router-dom
 */
import { useState, useEffect, useCallback, useContext, createContext } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as Yup from "yup";
import axios from "axios";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";

// ─────────────────────── MOCK DATA ────────────────────────────
const MOCK_JOBS = [
  { id: "1", company: "Google", role: "Frontend Engineer", location: "Remote", salary: 180000, platform: "LinkedIn", status: "Interview Scheduled", appliedDate: "2025-03-01", interviewDate: "2025-03-20", notes: "Great culture fit", bookmarked: true, domain: "google.com" },
  { id: "2", company: "Meta", role: "React Developer", location: "On-site", salary: 200000, platform: "Company Site", status: "Applied", appliedDate: "2025-03-05", interviewDate: "", notes: "Applied via referral", bookmarked: false, domain: "meta.com" },
  { id: "3", company: "Amazon", role: "SDE II", location: "Hybrid", salary: 160000, platform: "LinkedIn", status: "Rejected", appliedDate: "2025-02-15", interviewDate: "", notes: "OA failed", bookmarked: false, domain: "amazon.com" },
  { id: "4", company: "Netflix", role: "Senior Engineer", location: "Remote", salary: 250000, platform: "Referral", status: "Offer Received", appliedDate: "2025-02-10", interviewDate: "2025-03-01", notes: "Best offer so far!", bookmarked: true, domain: "netflix.com" },
  { id: "5", company: "Stripe", role: "Full Stack Dev", location: "Remote", salary: 190000, platform: "AngelList", status: "Applied", appliedDate: "2025-03-10", interviewDate: "", notes: "Exciting fintech product", bookmarked: false, domain: "stripe.com" },
  { id: "6", company: "Airbnb", role: "UI Engineer", location: "Hybrid", salary: 170000, platform: "LinkedIn", status: "Interview Scheduled", appliedDate: "2025-03-08", interviewDate: "2025-03-25", notes: "Loved the design challenge", bookmarked: true, domain: "airbnb.com" },
  { id: "7", company: "Figma", role: "Product Engineer", location: "On-site", salary: 155000, platform: "Company Site", status: "Applied", appliedDate: "2025-03-12", interviewDate: "", notes: "Dream company", bookmarked: false, domain: "figma.com" },
  { id: "8", company: "Notion", role: "Frontend Dev", location: "Remote", salary: 145000, platform: "Job Board", status: "Rejected", appliedDate: "2025-02-20", interviewDate: "", notes: "No response after 2 weeks", bookmarked: false, domain: "notion.so" },
];

const STATUSES = ["Applied", "Interview Scheduled", "Offer Received", "Rejected"];
const PLATFORMS = ["LinkedIn", "Company Site", "Referral", "AngelList", "Job Board", "Other"];
const LOCATIONS = ["Remote", "On-site", "Hybrid"];

// ─────────────────────── YUP SCHEMA ───────────────────────────
const jobSchema = Yup.object().shape({
  company:       Yup.string().trim().required("Company name is required"),
  role:          Yup.string().trim().required("Job role is required"),
  appliedDate:   Yup.string().required("Applied date is required"),
  domain:        Yup.string().trim(),
  location:      Yup.string().required(),
  salary:        Yup.number().transform(v => (isNaN(v) ? 0 : v)).min(0).default(0),
  platform:      Yup.string().required(),
  status:        Yup.string().required(),
  interviewDate: Yup.string(),
  notes:         Yup.string().trim(),
});

// ─────────────────────── API SERVICE ──────────────────────────
const DUMMYJSON_URL = "https://dummyjson.com/products?limit=8&skip=0";
const PLATFORM_POOL = ["LinkedIn", "Company Site", "Referral", "AngelList", "Job Board"];
const STATUS_POOL   = ["Applied", "Applied", "Interview Scheduled", "Offer Received", "Rejected"];
const LOCATION_POOL = ["Remote", "On-site", "Hybrid"];
const DOMAIN_MAP    = ["apple.com","microsoft.com","amazon.com","google.com","meta.com","netflix.com","stripe.com","airbnb.com"];

function mapProductToJob(product, index) {
  const today = new Date();
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  return {
    id: `api-${product.id}`,
    company: product.brand || product.title.split(" ")[0] || "Unknown Co.",
    role: `${product.category.charAt(0).toUpperCase() + product.category.slice(1)} Engineer`,
    location: LOCATION_POOL[index % LOCATION_POOL.length],
    salary: Math.round((product.price * 800) / 1000) * 1000,
    platform: PLATFORM_POOL[index % PLATFORM_POOL.length],
    status: STATUS_POOL[index % STATUS_POOL.length],
    appliedDate: daysAgo(30 - index * 3),
    interviewDate: index % 3 === 1 ? daysAgo(-(index * 2)) : "",
    notes: product.description.slice(0, 80),
    bookmarked: index % 4 === 0,
    domain: DOMAIN_MAP[index % DOMAIN_MAP.length],
  };
}

async function fetchDemoJobsFromAPI() {
  try {
    const { data } = await axios.get(DUMMYJSON_URL);
    return (data.products || []).map(mapProductToJob);
  } catch (err) {
    return MOCK_JOBS;
  }
}

// ─────────────────────── CONTEXT ──────────────────────────────
const AppCtx = createContext(null);
function useAppCtx() { return useContext(AppCtx); }

function useDebounce(value, delay) {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
}

function useLocalStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; } catch { return init; }
  });
  const setStored = useCallback(v => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key]);
  return [val, setStored];
}

function AppProvider({ children }) {
  const [applications, setApplications] = useLocalStorage("sjtd_apps_mono", null);
  const [apiLoading, setApiLoading] = useState(false);
  useEffect(() => {
    if (applications === null) {
      setApiLoading(true);
      fetchDemoJobsFromAPI().then(jobs => { setApplications(jobs); setApiLoading(false); });
    }
  }, []);
  const safeApps = applications || [];
  const addApplication = (app) => setApplications([...safeApps, { ...app, id: Date.now().toString(), bookmarked: false }]);
  const updateApplication = (id, updated) => setApplications(safeApps.map(a => a.id === id ? { ...a, ...updated } : a));
  const deleteApplication = (id) => setApplications(safeApps.filter(a => a.id !== id));
  const toggleBookmark = (id) => setApplications(safeApps.map(a => a.id === id ? { ...a, bookmarked: !a.bookmarked } : a));
  return (
    <AppCtx.Provider value={{ applications: safeApps, apiLoading, addApplication, updateApplication, deleteApplication, toggleBookmark }}>
      {children}
    </AppCtx.Provider>
  );
}

// ─────────────────────── TOAST ─────────────────────────────────
const ToastCtx = createContext(() => {});
const useToast = () => useContext(ToastCtx);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 300, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === "success" ? "#fff" : "#000",
            color: t.type === "success" ? "#000" : "#fff",
            border: "1px solid #000",
            padding: "10px 16px",
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "toastIn .2s ease",
            minWidth: 220,
          }}>
            <span>{t.type === "success" ? "✓" : "✗"}</span>{t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ─────────────────────── HELPERS ──────────────────────────────
const fmt = (n) => n ? `$${(n / 1000).toFixed(0)}k` : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const statusKey = (s) => {
  if (!s) return "Applied";
  if (s.includes("Interview")) return "Interview";
  if (s.includes("Offer")) return "Offer";
  if (s.includes("Reject")) return "Rejected";
  return "Applied";
};

// Status config — monochrome with weight + style differentiation
const STATUS_CONFIG = {
  Applied:   { label: "Applied",            bg: "#f5f5f5", color: "#000", border: "#ccc" },
  Interview: { label: "Interview",          bg: "#000",    color: "#fff", border: "#000" },
  Offer:     { label: "Offer",              bg: "#000",    color: "#fff", border: "#000" },
  Rejected:  { label: "Rejected",           bg: "#fff",    color: "#999", border: "#ddd" },
};

function StatusBadge({ status }) {
  const k = statusKey(status);
  const cfg = STATUS_CONFIG[k];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 9px",
      fontSize: 10,
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

function CompanyLogo({ domain, name }) {
  const [err, setErr] = useState(false);
  if (!domain || err) {
    return (
      <div style={{
        width: 28, height: 28, border: "1px solid #000",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace",
        flexShrink: 0, background: "#000", color: "#fff",
      }}>{name?.[0]?.toUpperCase() || "?"}</div>
    );
  }
  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      onError={() => setErr(true)}
      style={{ width: 28, height: 28, objectFit: "contain", border: "1px solid #e5e5e5", flexShrink: 0 }}
    />
  );
}

// ─────────────────────── GLOBAL STYLES ────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Editorial+New:ital,wght@0,200;0,400;1,200&family=Geist:wght@300;400;500;600&display=swap');

      /* Geist fallback stack */
      @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :root {
        --black: #000;
        --white: #fff;
        --gray-50:  #fafafa;
        --gray-100: #f5f5f5;
        --gray-200: #e8e8e8;
        --gray-300: #d4d4d4;
        --gray-400: #b0b0b0;
        --gray-500: #808080;
        --gray-600: #555;
        --gray-700: #333;
        --gray-800: #1a1a1a;
        --mono: 'IBM Plex Mono', monospace;
        --sans: 'Geist', 'DM Sans', system-ui, sans-serif;
        --display: 'Geist', 'DM Sans', system-ui, sans-serif;
        --border: 1px solid var(--gray-200);
        --border-dark: 1px solid var(--black);
      }

      body {
        background: var(--white);
        color: var(--black);
        font-family: var(--sans);
        font-weight: 400;
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
      }

      button { cursor: pointer; border: none; background: none; font-family: inherit; }
      input, select, textarea { font-family: inherit; }
      input:focus, select:focus, textarea:focus { outline: none; }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: var(--gray-100); }
      ::-webkit-scrollbar-thumb { background: var(--gray-400); }

      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(12px); }
        to   { opacity: 1; transform: translateX(0); }
      }

      /* ── Layout ── */
      .app-shell { display: flex; min-height: 100vh; }

      /* ── Sidebar ── */
      .sidebar {
        width: 200px;
        min-height: 100vh;
        border-right: var(--border);
        display: flex;
        flex-direction: column;
        position: fixed;
        top: 0; left: 0;
        background: var(--white);
        z-index: 100;
      }
      .sidebar-wordmark {
        padding: 20px 20px 18px;
        border-bottom: var(--border);
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--black);
      }
      .sidebar-wordmark span { color: var(--gray-400); font-weight: 400; }
      .sidebar-nav { padding: 12px 0; flex: 1; }
      .nav-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 20px;
        font-size: 12.5px;
        font-family: var(--sans);
        font-weight: 400;
        color: var(--gray-500);
        cursor: pointer;
        transition: color .15s, background .15s;
        letter-spacing: 0.01em;
        border-left: 2px solid transparent;
      }
      .nav-item:hover { color: var(--black); background: var(--gray-50); }
      .nav-item.active {
        color: var(--black);
        font-weight: 500;
        background: var(--gray-50);
        border-left: 2px solid var(--black);
      }
      .nav-badge {
        font-family: var(--mono);
        font-size: 9px;
        background: var(--black);
        color: var(--white);
        padding: 1px 5px;
        letter-spacing: 0;
      }
      .sidebar-footer {
        padding: 14px 20px;
        border-top: var(--border);
        font-family: var(--mono);
        font-size: 10px;
        color: var(--gray-400);
        line-height: 1.6;
      }

      /* ── Main ── */
      .main { margin-left: 200px; flex: 1; min-height: 100vh; }

      /* ── Page header ── */
      .page-header {
        padding: 28px 36px 0;
        border-bottom: var(--border);
        padding-bottom: 20px;
        margin-bottom: 0;
      }
      .page-header-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .page-title {
        font-family: var(--display);
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--black);
      }
      .page-sub {
        font-size: 12px;
        color: var(--gray-400);
        margin-top: 3px;
        font-family: var(--mono);
      }

      /* ── Page body ── */
      .page-body { padding: 24px 36px; }

      /* ── Buttons ── */
      .btn { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; padding: 8px 14px; transition: all .15s; }
      .btn-primary { background: var(--black); color: var(--white); border: 1px solid var(--black); }
      .btn-primary:hover { background: var(--gray-800); }
      .btn-ghost { background: var(--white); color: var(--black); border: 1px solid var(--gray-300); }
      .btn-ghost:hover { border-color: var(--black); }
      .btn-danger { background: var(--white); color: var(--gray-500); border: 1px solid var(--gray-200); }
      .btn-danger:hover { color: var(--black); border-color: var(--black); }

      /* ── Stat cards ── */
      .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: var(--border); }
      .stat-card { padding: 24px 28px; border-right: var(--border); }
      .stat-card:last-child { border-right: none; }
      .stat-num {
        font-family: var(--display);
        font-size: 40px;
        font-weight: 300;
        letter-spacing: -0.04em;
        line-height: 1;
        color: var(--black);
      }
      .stat-label {
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--gray-400);
        margin-top: 6px;
      }
      .stat-card.highlight .stat-num { font-weight: 600; }

      /* ── Controls ── */
      .controls {
        display: flex; gap: 0; border-bottom: var(--border);
        padding: 12px 36px; align-items: center; gap: 10px; flex-wrap: wrap;
      }
      .search-wrap { position: relative; }
      .search-wrap input {
        background: var(--gray-50);
        border: var(--border);
        color: var(--black);
        padding: 7px 12px 7px 32px;
        font-size: 12px;
        font-family: var(--mono);
        width: 220px;
        transition: border-color .15s;
      }
      .search-wrap input::placeholder { color: var(--gray-400); }
      .search-wrap input:focus { border-color: var(--black); background: var(--white); }
      .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 12px; pointer-events: none; }
      .filter-select {
        background: var(--gray-50);
        border: var(--border);
        color: var(--gray-600);
        padding: 7px 10px;
        font-size: 11px;
        font-family: var(--mono);
        cursor: pointer;
        transition: border-color .15s;
        letter-spacing: 0.02em;
      }
      .filter-select:focus { border-color: var(--black); }
      .filter-select option { background: var(--white); }

      /* ── Tabs ── */
      .tabs {
        display: flex;
        border-bottom: var(--border);
        padding: 0 36px;
        background: var(--white);
      }
      .tab {
        font-family: var(--mono);
        font-size: 10.5px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 12px 0;
        margin-right: 28px;
        color: var(--gray-400);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all .15s;
      }
      .tab:hover { color: var(--black); }
      .tab.active { color: var(--black); border-bottom: 2px solid var(--black); }
      .tab-count { opacity: 0.5; margin-left: 5px; }

      /* ── Table ── */
      .table-wrap { overflow-x: auto; }
      .job-table { width: 100%; border-collapse: collapse; }
      .job-table th {
        text-align: left;
        font-family: var(--mono);
        font-size: 9.5px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--gray-400);
        padding: 11px 16px;
        border-bottom: var(--border);
        font-weight: 500;
        white-space: nowrap;
        background: var(--gray-50);
        cursor: pointer;
        user-select: none;
        transition: color .1s;
      }
      .job-table th:hover { color: var(--black); }
      .job-table th:first-child { padding-left: 36px; }
      .job-table th:last-child { padding-right: 36px; }
      .job-table td {
        padding: 13px 16px;
        border-bottom: var(--border);
        font-size: 13px;
        vertical-align: middle;
      }
      .job-table td:first-child { padding-left: 36px; }
      .job-table td:last-child { padding-right: 36px; }
      .job-table tr:hover td { background: var(--gray-50); }
      .job-table tr:last-child td { border-bottom: none; }

      .company-cell { display: flex; align-items: center; gap: 10px; }
      .company-name { font-weight: 500; font-size: 13px; color: var(--black); }
      .company-role { font-size: 11px; color: var(--gray-400); font-family: var(--mono); margin-top: 1px; }
      .salary-val { font-family: var(--mono); font-size: 12px; color: var(--black); font-weight: 500; }

      .row-actions { display: flex; gap: 4px; }
      .icon-btn {
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        border: var(--border);
        font-size: 11px;
        color: var(--gray-400);
        cursor: pointer;
        transition: all .15s;
        background: var(--white);
      }
      .icon-btn:hover { border-color: var(--black); color: var(--black); }
      .icon-btn.bookmarked { background: var(--black); color: var(--white); border-color: var(--black); }

      /* ── Empty state ── */
      .empty {
        text-align: center; padding: 80px 20px;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--gray-400);
        letter-spacing: 0.06em;
      }
      .empty-title { font-size: 13px; color: var(--gray-600); margin-bottom: 6px; }

      /* ── Modal ── */
      .overlay {
        position: fixed; inset: 0;
        background: rgba(255,255,255,0.85);
        backdrop-filter: blur(4px);
        z-index: 200;
        display: flex; align-items: center; justify-content: center; padding: 20px;
      }
      .modal {
        background: var(--white);
        border: var(--border-dark);
        width: 100%; max-width: 560px;
        max-height: 90vh; overflow-y: auto;
        padding: 32px;
        animation: fadeUp .2s ease;
      }
      .modal-title {
        font-family: var(--display);
        font-size: 18px;
        font-weight: 600;
        letter-spacing: -0.02em;
        margin-bottom: 6px;
      }
      .modal-sub {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--gray-400);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: var(--border);
      }
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .form-group { display: flex; flex-direction: column; gap: 6px; }
      .form-group.full { grid-column: 1 / -1; }
      .form-label {
        font-family: var(--mono);
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--gray-500);
      }
      .form-input, .form-select, .form-textarea {
        background: var(--white);
        border: var(--border);
        color: var(--black);
        padding: 9px 11px;
        font-size: 13px;
        font-family: var(--sans);
        transition: border-color .15s;
        width: 100%;
      }
      .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--black); }
      .form-textarea { resize: vertical; }
      .form-select option { background: var(--white); }
      .form-error { font-family: var(--mono); font-size: 10px; color: #c00; margin-top: 2px; }
      .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; padding-top: 20px; border-top: var(--border); }

      /* ── Analytics / Charts ── */
      .analytics-body { padding: 24px 36px; }
      .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--gray-200); border: var(--border); margin-top: 24px; }
      .chart-card { background: var(--white); padding: 24px; }
      .chart-card.full { grid-column: 1 / -1; }
      .chart-title {
        font-family: var(--mono);
        font-size: 9.5px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--gray-400);
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: var(--border);
      }

      /* Pie / Legend */
      .pie-wrap { display: flex; align-items: center; gap: 32px; flex-wrap: wrap; }
      .legend { display: flex; flex-direction: column; gap: 10px; }
      .legend-item { display: flex; align-items: center; gap: 10px; font-size: 12px; }
      .legend-dot { width: 8px; height: 8px; flex-shrink: 0; }
      .legend-label { color: var(--gray-600); flex: 1; font-family: var(--mono); font-size: 11px; }
      .legend-val { font-weight: 600; font-family: var(--mono); font-size: 12px; color: var(--black); }

      /* Bar chart */
      .bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-top: 8px; }
      .bar-col { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
      .bar { width: 100%; min-height: 2px; transition: height .5s ease; background: var(--black); }
      .bar-label { font-size: 9.5px; color: var(--gray-400); text-align: center; font-family: var(--mono); }
      .bar-val { font-size: 10px; color: var(--black); font-weight: 600; font-family: var(--mono); }

      /* Platform bars */
      .platform-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
      .platform-name { font-family: var(--mono); font-size: 11px; color: var(--gray-600); width: 110px; text-align: right; flex-shrink: 0; }
      .platform-track { flex: 1; background: var(--gray-100); height: 6px; }
      .platform-fill { height: 100%; background: var(--black); transition: width .5s; }
      .platform-count { font-family: var(--mono); font-size: 10px; font-weight: 600; color: var(--black); width: 16px; }

      /* ── Bookmarks ── */
      .bm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1px; background: var(--gray-200); border: var(--border); margin-top: 24px; }
      .bm-card { background: var(--white); padding: 20px; transition: background .15s; }
      .bm-card:hover { background: var(--gray-50); }
      .bm-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
      .bm-title { font-weight: 600; font-size: 13.5px; color: var(--black); }
      .bm-role { font-size: 11px; color: var(--gray-400); font-family: var(--mono); margin-top: 2px; }
      .bm-row { display: flex; justify-content: space-between; font-size: 12px; padding: 5px 0; border-bottom: var(--border); }
      .bm-row:last-of-type { border-bottom: none; }
      .bm-key { color: var(--gray-400); font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; }
      .bm-val { color: var(--black); font-weight: 500; font-size: 12px; }
      .bm-actions { display: flex; gap: 6px; margin-top: 12px; }

      /* ── Dashboard cards ── */
      .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--gray-200); border: var(--border); margin-top: 24px; }
      .dash-card { background: var(--white); padding: 24px; }
      .dash-card-title {
        font-family: var(--mono);
        font-size: 9.5px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--gray-400);
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: var(--border);
      }

      .upcoming-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: var(--border); }
      .upcoming-row:last-child { border-bottom: none; }
      .upcoming-co { font-weight: 500; font-size: 13px; }
      .upcoming-role { font-size: 11px; color: var(--gray-400); font-family: var(--mono); }
      .upcoming-date { font-family: var(--mono); font-size: 10px; color: var(--gray-400); }

      .recent-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: var(--border); }
      .recent-row:last-child { border-bottom: none; }

      @media (max-width: 900px) {
        .sidebar { display: none; }
        .main { margin-left: 0; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .charts-grid { grid-template-columns: 1fr; }
        .dash-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 600px) {
        .stats-grid { grid-template-columns: 1fr 1fr; }
        .form-grid { grid-template-columns: 1fr; }
        .page-body { padding: 16px; }
        .analytics-body { padding: 16px; }
      }
    `}</style>
  );
}

// ─────────────────────── MODAL ─────────────────────────────────
function JobModal({ job, onClose, onSave }) {
  const defaultValues = {
    company: job?.company ?? "", role: job?.role ?? "", domain: job?.domain ?? "",
    location: job?.location ?? "Remote", salary: job?.salary ?? "",
    platform: job?.platform ?? "LinkedIn", status: job?.status ?? "Applied",
    appliedDate: job?.appliedDate ?? "", interviewDate: job?.interviewDate ?? "",
    notes: job?.notes ?? "",
  };
  const { register, handleSubmit, control, formState: { errors } } = useForm({ defaultValues, resolver: yupResolver(jobSchema), mode: "onTouched" });
  const onSubmit = (data) => onSave({ ...data, salary: Number(data.salary) || 0 });

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{job ? "Edit Application" : "New Application"}</div>
        <div className="modal-sub">{job ? "Modify application details" : "Track a new job application"}</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Company *</label>
            <input className="form-input" {...register("company")} placeholder="e.g. Google" />
            {errors.company && <span className="form-error">{errors.company.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <input className="form-input" {...register("role")} placeholder="e.g. Frontend Engineer" />
            {errors.role && <span className="form-error">{errors.role.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Domain</label>
            <input className="form-input" {...register("domain")} placeholder="e.g. google.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <Controller name="location" control={control} render={({ field }) => (
              <select className="form-select" {...field}>{LOCATIONS.map(l => <option key={l}>{l}</option>)}</select>
            )} />
          </div>
          <div className="form-group">
            <label className="form-label">Salary (Annual $)</label>
            <input className="form-input" type="number" {...register("salary")} placeholder="e.g. 120000" />
          </div>
          <div className="form-group">
            <label className="form-label">Platform</label>
            <Controller name="platform" control={control} render={({ field }) => (
              <select className="form-select" {...field}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</select>
            )} />
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <Controller name="status" control={control} render={({ field }) => (
              <select className="form-select" {...field}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
            )} />
          </div>
          <div className="form-group">
            <label className="form-label">Applied Date *</label>
            <input className="form-input" type="date" {...register("appliedDate")} />
            {errors.appliedDate && <span className="form-error">{errors.appliedDate.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Interview Date</label>
            <input className="form-input" type="date" {...register("interviewDate")} />
          </div>
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" rows={3} {...register("notes")} placeholder="Any notes about this application..." />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit(onSubmit)}>
            {job ? "Save Changes" : "Add Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── SIDEBAR ──────────────────────────────
const NAV = [
  { id: "dashboard",    label: "Dashboard",    path: "/dashboard" },
  { id: "applications", label: "Applications", path: "/applications" },
  { id: "analytics",    label: "Analytics",    path: "/analytics" },
  { id: "bookmarks",    label: "Bookmarks",    path: "/bookmarks" },
];

function Sidebar() {
  const { applications } = useAppCtx();
  const navigate = useNavigate();
  const location = useLocation();
  const bm = applications.filter(a => a.bookmarked).length;

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <aside className="sidebar">
      <div className="sidebar-wordmark">JobTrack <span>/ Pro</span></div>
      <nav className="sidebar-nav">
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item ${isActive(n.path) ? "active" : ""}`}
            onClick={() => navigate(n.path)}
          >
            <span>{n.label}</span>
            {n.id === "bookmarks" && bm > 0 && <span className="nav-badge">{bm}</span>}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        v1.0<br />
        {applications.length} applications
      </div>
    </aside>
  );
}

// ─────────────────────── DASHBOARD ────────────────────────────
function MiniPie({ applications }) {
  const counts = STATUSES.map(s => ({ label: s, count: applications.filter(a => a.status === s).length }));
  const colors = ["#000", "#555", "#999", "#ccc"];
  const total = applications.length || 1;
  let cumulative = 0;
  const segments = counts.map((c, i) => {
    const pct = (c.count / total) * 100;
    const seg = { ...c, pct, start: cumulative, color: colors[i] };
    cumulative += pct;
    return seg;
  }).filter(s => s.count > 0);
  const r = 56, cx = 72, cy = 72;
  const polarToCart = (cx, cy, r, deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  return (
    <div className="pie-wrap">
      <svg width={144} height={144} style={{ flex: "0 0 144px" }}>
        {segments.map((s, i) => {
          const startAngle = s.start * 3.6;
          const endAngle = (s.start + s.pct) * 3.6;
          const start = polarToCart(cx, cy, r, startAngle);
          const end = polarToCart(cx, cy, r, endAngle);
          const largeArc = s.pct > 50 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
          return <path key={i} d={path} fill={s.color} stroke="#fff" strokeWidth={2} />;
        })}
        <circle cx={cx} cy={cy} r={34} fill="#fff" stroke="#e8e8e8" strokeWidth={1} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#000" fontFamily="Geist,sans-serif" fontSize={18} fontWeight={600}>{applications.length}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#999" fontFamily="IBM Plex Mono,monospace" fontSize={8} letterSpacing={1}>TOTAL</text>
      </svg>
      <div className="legend">
        {counts.map((c, i) => (
          <div key={i} className="legend-item">
            <div className="legend-dot" style={{ background: colors[i], border: i === 3 ? "1px solid #ccc" : "none" }} />
            <span className="legend-label">{c.label}</span>
            <span className="legend-val">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { applications, apiLoading } = useAppCtx();
  const navigate = useNavigate();
  const stats = {
    total: applications.length,
    interviews: applications.filter(a => a.status === "Interview Scheduled").length,
    offers: applications.filter(a => a.status === "Offer Received").length,
    rejected: applications.filter(a => a.status === "Rejected").length,
  };
  const upcoming = applications.filter(a => a.interviewDate && new Date(a.interviewDate) >= new Date())
    .sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate)).slice(0, 4);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <div className="page-sub">
              Job search overview
              {apiLoading && <span style={{ marginLeft: 12, color: "#aaa" }}>— loading demo data…</span>}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/applications/new")}>+ Add Application</button>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: "Total Applied",          val: stats.total,      highlight: false },
          { label: "Interviews Scheduled",   val: stats.interviews, highlight: false },
          { label: "Offers Received",        val: stats.offers,     highlight: true  },
          { label: "Rejected",               val: stats.rejected,   highlight: false },
        ].map((s, i) => (
          <div key={i} className={`stat-card${s.highlight ? " highlight" : ""}`}>
            <div className="stat-num">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="page-body">
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-title">Application Pipeline</div>
            <MiniPie applications={applications} />
          </div>
          <div className="dash-card">
            <div className="dash-card-title">Upcoming Interviews</div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: 12, color: "#bbb", fontFamily: "IBM Plex Mono,monospace", padding: "20px 0" }}>No upcoming interviews</div>
            ) : upcoming.map(a => (
              <div key={a.id} className="upcoming-row">
                <CompanyLogo domain={a.domain} name={a.company} />
                <div style={{ flex: 1 }}>
                  <div className="upcoming-co">{a.company}</div>
                  <div className="upcoming-role">{a.role}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="upcoming-date">{fmtDate(a.interviewDate)}</div>
                  <StatusBadge status={a.status} />
                </div>
              </div>
            ))}
          </div>
          <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
            <div className="dash-card-title">Recent Applications</div>
            {applications.slice(-5).reverse().map(a => (
              <div key={a.id} className="recent-row">
                <CompanyLogo domain={a.domain} name={a.company} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{a.company}</div>
                  <div style={{ fontSize: 11, color: "#999", fontFamily: "IBM Plex Mono,monospace" }}>{a.role}</div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <StatusBadge status={a.status} />
                  <span style={{ fontSize: 10, color: "#bbb", fontFamily: "IBM Plex Mono,monospace" }}>{fmtDate(a.appliedDate)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── APPLICATIONS PAGE ────────────────────
function ApplicationsPage() {
  const { applications, deleteApplication, toggleBookmark } = useAppCtx();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPlatform, setFilterPlatform] = useState("All");
  const [filterLocation, setFilterLocation] = useState("All");
  const [sortBy, setSortBy] = useState("appliedDate");
  const [sortDir, setSortDir] = useState("desc");
  const [tab, setTab] = useState("All");
  const debSearch = useDebounce(search, 400);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const filtered = applications
    .filter(a => {
      const q = debSearch.toLowerCase();
      if (q && !a.company.toLowerCase().includes(q) && !a.role.toLowerCase().includes(q)) return false;
      if (filterStatus !== "All" && a.status !== filterStatus) return false;
      if (filterPlatform !== "All" && a.platform !== filterPlatform) return false;
      if (filterLocation !== "All" && a.location !== filterLocation) return false;
      if (tab !== "All" && a.status !== tab) return false;
      return true;
    })
    .sort((a, b) => {
      let va = a[sortBy], vb = b[sortBy];
      if (sortBy === "appliedDate") { va = new Date(va); vb = new Date(vb); }
      if (sortBy === "salary") { va = Number(va); vb = Number(vb); }
      if (sortBy === "company") { va = va?.toLowerCase(); vb = vb?.toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortInd = ({ col }) => (
    <span style={{ marginLeft: 3, opacity: sortBy === col ? 1 : 0.3 }}>
      {sortBy === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1 className="page-title">Applications</h1>
            <div className="page-sub">{applications.length} total</div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/applications/new")}>+ Add Application</button>
        </div>
      </div>

      <div className="tabs">
        {["All", ...STATUSES].map(t => (
          <div key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t}<span className="tab-count">({t === "All" ? applications.length : applications.filter(a => a.status === t).length})</span>
          </div>
        ))}
      </div>

      <div className="controls">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or role..." />
        </div>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="All">All Platforms</option>
          {PLATFORMS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="filter-select" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
          <option value="All">All Locations</option>
          {LOCATIONS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-title">No applications found</div>
            <div>Adjust your search or filters</div>
          </div>
        ) : (
          <table className="job-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("company")}>Company <SortInd col="company" /></th>
                <th>Status</th>
                <th>Platform</th>
                <th>Location</th>
                <th onClick={() => toggleSort("salary")}>Salary <SortInd col="salary" /></th>
                <th onClick={() => toggleSort("appliedDate")}>Applied <SortInd col="appliedDate" /></th>
                <th>Interview</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="company-cell">
                      <CompanyLogo domain={a.domain} name={a.company} />
                      <div>
                        <div className="company-name">{a.company}</div>
                        <div className="company-role">{a.role}</div>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ fontSize: 12, color: "#666", fontFamily: "IBM Plex Mono,monospace" }}>{a.platform}</td>
                  <td style={{ fontSize: 12, color: "#666" }}>{a.location}</td>
                  <td><span className="salary-val">{fmt(a.salary)}</span></td>
                  <td style={{ fontSize: 12, color: "#666", fontFamily: "IBM Plex Mono,monospace" }}>{fmtDate(a.appliedDate)}</td>
                  <td style={{ fontSize: 12, color: "#666", fontFamily: "IBM Plex Mono,monospace" }}>
                    {a.interviewDate ? fmtDate(a.interviewDate) : <span style={{ color: "#ccc" }}>—</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className={`icon-btn ${a.bookmarked ? "bookmarked" : ""}`} onClick={() => toggleBookmark(a.id)} title="Bookmark">⊡</button>
                      <button className="icon-btn" onClick={() => navigate(`/applications/${a.id}`)} title="Edit">✎</button>
                      <button className="icon-btn" onClick={() => { deleteApplication(a.id); toast("Deleted", "error"); }} title="Delete">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── NEW APPLICATION ROUTE ────────────────
function NewApplicationPage() {
  const { addApplication } = useAppCtx();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSave = (data) => {
    addApplication(data);
    toast("Application added");
    navigate("/applications");
  };

  const handleClose = () => navigate("/applications");

  return <JobModal job={null} onClose={handleClose} onSave={handleSave} />;
}

// ─────────────────────── EDIT APPLICATION ROUTE ───────────────
function EditApplicationPage() {
  const { id } = useParams();
  const { applications, updateApplication } = useAppCtx();
  const navigate = useNavigate();
  const toast = useToast();

  const job = applications.find(a => a.id === id);

  const handleSave = (data) => {
    updateApplication(id, data);
    toast("Application updated");
    navigate("/applications");
  };

  const handleClose = () => navigate("/applications");

  if (!job) {
    return (
      <div className="empty" style={{ marginTop: 80 }}>
        <div className="empty-title">Application not found</div>
        <div>The application with ID "{id}" does not exist.</div>
        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => navigate("/applications")}>
          ← Back to Applications
        </button>
      </div>
    );
  }

  return <JobModal job={job} onClose={handleClose} onSave={handleSave} />;
}

// ─────────────────────── ANALYTICS PAGE ───────────────────────
function AnalyticsPage() {
  const { applications } = useAppCtx();
  const byPlatform = PLATFORMS.map(p => ({ label: p, count: applications.filter(a => a.platform === p).length })).filter(x => x.count > 0);
  const maxP = Math.max(...byPlatform.map(x => x.count), 1);

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { label: d.toLocaleDateString("en-US", { month: "short" }), month: d.getMonth(), year: d.getFullYear() };
  });
  const monthData = months.map(m => ({
    label: m.label,
    count: applications.filter(a => { if (!a.appliedDate) return false; const d = new Date(a.appliedDate); return d.getMonth() === m.month && d.getFullYear() === m.year; }).length
  }));
  const maxM = Math.max(...monthData.map(m => m.count), 1);

  const avgSalary = applications.filter(a => a.salary > 0).reduce((s, a, _, arr) => s + a.salary / arr.length, 0);
  const responseRate = applications.length ? Math.round(((applications.filter(a => a.status !== "Applied").length) / applications.length) * 100) : 0;
  const offerRate = applications.length ? Math.round((applications.filter(a => a.status === "Offer Received").length / applications.length) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <div className="page-sub">Job search performance metrics</div>
      </div>

      <div className="stats-grid">
        {[
          { label: "Avg Salary",     val: avgSalary ? `$${(avgSalary / 1000).toFixed(0)}k` : "—" },
          { label: "Response Rate",  val: `${responseRate}%` },
          { label: "Offer Rate",     val: `${offerRate}%`, highlight: true },
          { label: "Bookmarked",     val: applications.filter(a => a.bookmarked).length },
        ].map((s, i) => (
          <div key={i} className={`stat-card${s.highlight ? " highlight" : ""}`}>
            <div className="stat-num">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="analytics-body">
        <div className="charts-grid">
          <div className="chart-card">
            <div className="chart-title">Status Breakdown</div>
            <MiniPie applications={applications} />
          </div>
          <div className="chart-card">
            <div className="chart-title">By Platform</div>
            {byPlatform.map((p, i) => (
              <div key={i} className="platform-row">
                <div className="platform-name">{p.label}</div>
                <div className="platform-track">
                  <div className="platform-fill" style={{ width: `${(p.count / maxP) * 100}%` }} />
                </div>
                <div className="platform-count">{p.count}</div>
              </div>
            ))}
          </div>
          <div className="chart-card full">
            <div className="chart-title">Monthly Applications — Last 6 Months</div>
            <div className="bar-chart">
              {monthData.map((m, i) => (
                <div key={i} className="bar-col">
                  <div className="bar-val">{m.count || ""}</div>
                  <div className="bar" style={{ height: `${(m.count / maxM) * 110}px` }} />
                  <div className="bar-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── BOOKMARKS PAGE ───────────────────────
function BookmarksPage() {
  const { applications, toggleBookmark, deleteApplication } = useAppCtx();
  const navigate = useNavigate();
  const toast = useToast();
  const bookmarked = applications.filter(a => a.bookmarked);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bookmarks</h1>
        <div className="page-sub">{bookmarked.length} saved applications</div>
      </div>

      <div className="page-body">
        {bookmarked.length === 0 ? (
          <div className="empty" style={{ marginTop: 40 }}>
            <div className="empty-title">No bookmarks yet</div>
            <div>Bookmark applications from the Applications page</div>
          </div>
        ) : (
          <div className="bm-grid">
            {bookmarked.map(a => (
              <div key={a.id} className="bm-card">
                <div className="bm-header">
                  <CompanyLogo domain={a.domain} name={a.company} />
                  <div style={{ flex: 1 }}>
                    <div className="bm-title">{a.company}</div>
                    <div className="bm-role">{a.role}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                <div>
                  <div className="bm-row"><span className="bm-key">Salary</span><span className="bm-val">{fmt(a.salary)}</span></div>
                  <div className="bm-row"><span className="bm-key">Platform</span><span className="bm-val">{a.platform}</span></div>
                  <div className="bm-row"><span className="bm-key">Location</span><span className="bm-val">{a.location}</span></div>
                  <div className="bm-row"><span className="bm-key">Applied</span><span className="bm-val">{fmtDate(a.appliedDate)}</span></div>
                  {a.interviewDate && <div className="bm-row"><span className="bm-key">Interview</span><span className="bm-val">{fmtDate(a.interviewDate)}</span></div>}
                </div>
                {a.notes && (
                  <div style={{ margin: "10px 0", padding: "8px 10px", background: "#f5f5f5", fontSize: 11.5, color: "#666", fontFamily: "IBM Plex Mono,monospace", lineHeight: 1.5 }}>
                    {a.notes}
                  </div>
                )}
                <div className="bm-actions">
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: 10 }} onClick={() => navigate(`/applications/${a.id}`)}>Edit</button>
                  <button className="btn btn-ghost" style={{ fontSize: 10 }} onClick={() => { toggleBookmark(a.id); toast("Removed from bookmarks"); }}>Remove</button>
                  <button className="btn btn-danger" style={{ fontSize: 10 }} onClick={() => { deleteApplication(a.id); toast("Deleted", "error"); }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── ROOT APP ─────────────────────────────
function InnerApp() {
  return (
    <div className="app-shell">
      <GlobalStyles />
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/applications/new" element={<><ApplicationsPage /><NewApplicationPage /></>} />
          <Route path="/applications/:id" element={<><ApplicationsPage /><EditApplicationPage /></>} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
