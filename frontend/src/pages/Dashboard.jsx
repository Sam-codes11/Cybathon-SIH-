import { useState, useEffect } from "react"
import { ArrowUpRight, AudioLines, ShieldAlert, Radio } from "lucide-react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import EmptyState from "../components/EmptyState"
import { WavyBackground } from "../components/WavyBackground"

const sampleChecks = [["Unknown caller", "AI voice clone", "High", "84", "2 min ago"], ["Delivery confirmation", "Replay artifact", "Review", "42", "Today, 10:34"], ["Family voice sample", "No strong indicators", "Low", "12", "Yesterday"]]

// Same backend host convention as Analyzing.jsx's getWebSocketUrl().
const getApiBase = () => {
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
  return `http://${host}:8000`
}

function Dashboard() {
  const reduceMotion = useReducedMotion()
  const [activeSessions, setActiveSessions] = useState([])
  const [liveStats, setLiveStats] = useState(null)
  const [liveError, setLiveError] = useState(false)

  // Poll the backend for active call sessions and dashboard stats.
  // Open two browser tabs and run different audio in each to see two
  // independent session_id rows here -- that's the multi-call proof.
  useEffect(() => {
    let cancelled = false
    const base = getApiBase()

    const poll = async () => {
      try {
        const [sessionsRes, statsRes] = await Promise.all([
          fetch(`${base}/sessions/active`),
          fetch(`${base}/dashboard/stats`),
        ])
        const sessions = await sessionsRes.json()
        const stats = await statsRes.json()
        if (!cancelled) {
          setActiveSessions(Array.isArray(sessions) ? sessions : [])
          setLiveStats(stats)
          setLiveError(false)
        }
      } catch (err) {
        if (!cancelled) setLiveError(true)
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.3} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}><main className="min-h-screen text-ink-slate-600"><Navbar /><section className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="flex flex-col gap-5 border-b border-[#d4dbe7] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5876a5]">Prototype workspace</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-ink-900 sm:text-4xl">Call dashboard</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#647188]">Track recent checks and focus attention on the calls that need a safer follow-up.</p></div><div className="inline-flex items-center gap-2 self-start rounded-full border border-[#cfd9ea] bg-white/85 px-4 py-2 text-xs font-medium text-[#506078]"><span className="h-2 w-2 rounded-full bg-[#3f82f1]" />Demo activity</div></motion.div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3">{[[liveStats ? String(liveStats.total_calls) : "3", "Checks in this demo"], [liveStats ? String(liveStats.high_risk_calls) : "1", "High risk (all-time)"], [String(activeSessions.length), "Live sessions now"]].map(([value, label], index) => <motion.div key={label} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.08 + index * 0.08 }} className="rounded-2xl border border-[#d7ddea] bg-white/90 p-5 shadow-[0_10px_30px_rgba(34,52,81,0.05)]"><p className="font-mono text-3xl font-medium tracking-[-0.07em] text-[#20304c]">{value}</p><p className="mt-2 text-sm text-[#718097]">{label}</p></motion.div>)}</div>

    {/* LIVE ACTIVE CALLS PANEL -- proves independent multi-call session tracking */}
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.2 }} className="mt-7 overflow-hidden rounded-[1.5rem] border border-[#d7ddea] bg-white/90 shadow-[0_16px_40px_rgba(34,52,81,0.07)]">
      <div className="flex items-center justify-between border-b border-[#e6eaf0] px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#24324b]">Active calls</h2>
          <p className="mt-1 text-xs text-[#718097]">{liveError ? "Couldn't reach the backend -- is it running on :8000?" : "Live from /sessions/active, refreshed every 3s."}</p>
        </div>
        <Radio className={`h-5 w-5 ${activeSessions.length ? "text-[#c85b49] animate-pulse" : "text-[#5c8ee0]"}`} />
      </div>
      {activeSessions.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[#718097] sm:px-6">
          No active calls right now. Start analyzing audio in another tab to see it appear here.
        </div>
      ) : (
        <div className="divide-y divide-[#e9edf3]">
          {activeSessions.map((s) => (
            <div key={s.session_id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="font-mono text-xs font-semibold text-[#2f3d57]">{s.session_id}</p>
                <p className="mt-1 text-xs text-[#758197]">{s.segments} segment{s.segments === 1 ? "" : "s"} evaluated</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.current_risk === "HIGH" ? "bg-[#fff0ea] text-[#c75d49]" : s.current_risk === "MEDIUM" ? "bg-[#fff6e8] text-[#b97928]" : "bg-[#eaf8f4] text-[#23816e]"}`}>
                  {s.current_risk}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {s.current_action}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>

    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.28 }} className="mt-7 overflow-hidden rounded-[1.5rem] border border-[#d7ddea] bg-white/90 shadow-[0_16px_40px_rgba(34,52,81,0.07)]"><div className="flex items-center justify-between border-b border-[#e6eaf0] px-5 py-5 sm:px-6"><div><h2 className="font-display text-lg font-semibold text-[#24324b]">Recent checks</h2><p className="mt-1 text-xs text-[#718097]">Prototype data while backend integration is in progress.</p></div><AudioLines className="h-5 w-5 text-[#5c8ee0]" /></div><div className="divide-y divide-[#e9edf3]">{sampleChecks.map(([caller, classification, risk, score, time], index) => <motion.div key={caller} whileHover={reduceMotion ? {} : { backgroundColor: "rgba(241, 246, 255, 0.9)" }} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${index === 0 ? "bg-[#fff0ea] text-[#c85b49]" : "bg-[#edf4ff] text-[#4a7ed3]"}`}>{index === 0 ? <ShieldAlert className="h-5 w-5" /> : <AudioLines className="h-5 w-5" />}</span><div><p className="text-sm font-semibold text-[#2f3d57]">{caller}</p><p className="mt-1 text-xs text-[#758197]">{classification} · {time}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${risk === "High" ? "bg-[#fff0ea] text-[#c75d49]" : risk === "Low" ? "bg-[#eaf8f4] text-[#23816e]" : "bg-[#fff6e8] text-[#b97928]"}`}>{risk} · {score}</span><Link to={`/call/${index + 1}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#4e79bd] transition hover:text-[#1f4e96]">View <ArrowUpRight className="h-3.5 w-3.5" /></Link></div></motion.div>)}</div></motion.div>
    <motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? false : { opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 0.42 }}><EmptyState className="mt-8 bg-white/70" title="More call history will appear here" description="Connect the analysis backend to replace this demonstration activity with live results." /></motion.div>
  </section></main></WavyBackground>
}

export default Dashboard