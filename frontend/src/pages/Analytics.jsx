import { useState, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowLeft, BarChart3, ShieldCheck, ShieldAlert, PhoneCall, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import Navbar from "../components/Navbar"
import { WavyBackground } from "../components/WavyBackground"

const getApiBase = () => {
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
  return `http://${host}:8000`
}

export default function Analytics() {
  const reduceMotion = useReducedMotion()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${getApiBase()}/analytics/summary`)
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
      setError(false)
    } catch (err) {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    const interval = setInterval(fetchSummary, 5000)
    return () => clearInterval(interval)
  }, [])

  const totalCalls = data?.total_calls || 0
  const aiFlagged = data?.ai_flagged || 0
  const realCalls = data?.real_calls || 0
  const aiPct = totalCalls > 0 ? Math.round((aiFlagged / totalCalls) * 100) : 0
  const realPct = totalCalls > 0 ? Math.round((realCalls / totalCalls) * 100) : 0

  const detectionModes = data?.detection_basis_breakdown
    ? Object.entries(data.detection_basis_breakdown)
    : []

  const attackTypes = data?.attack_type_breakdown
    ? Object.entries(data.attack_type_breakdown)
    : []

  const maxDetectionCount = Math.max(...detectionModes.map(([, c]) => c), 1)
  const maxAttackCount = Math.max(...attackTypes.map(([, c]) => c), 1)

  return (
    <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.3} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
      <main className="min-h-screen text-ink-slate-600">
        <Navbar />

        <section className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-16">
          {/* Header */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-5 border-b border-[#d4dbe7] pb-8 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5876a5] transition hover:text-[#1e3a8a]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
                </Link>
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-ink-900 sm:text-4xl">
                Threat Intelligence Analytics
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#647188]">
                Real-time forensic telemetry across multi-channel calls, deepfake detection modes, and attack vectors.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchSummary}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#cfd9ea] bg-white px-4 py-2 text-xs font-medium text-[#506078] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#cfd9ea] bg-white/85 px-4 py-2 text-xs font-medium text-[#506078]">
                <span className={`h-2 w-2 rounded-full ${error ? "bg-[#e53e3e]" : "bg-[#38a169]"}`} />
                {error ? "Backend offline" : "Live synced (:8000)"}
              </div>
            </div>
          </motion.div>

          {/* Stat Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="rounded-2xl border border-[#d7ddea] bg-white/90 p-5 shadow-[0_10px_30px_rgba(34,52,81,0.05)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Calls Screened</span>
                <PhoneCall className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-3 font-mono text-4xl font-medium tracking-tight text-[#20304c]">
                {totalCalls}
              </p>
              <p className="mt-2 text-xs text-[#718097]">
                Logged across all active & historical sessions
              </p>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              className="rounded-2xl border border-[#f5c6cb] bg-white/90 p-5 shadow-[0_10px_30px_rgba(34,52,81,0.05)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#b4233e]">AI Spoof / Flagged</span>
                <ShieldAlert className="h-4 w-4 text-[#b4233e]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-mono text-4xl font-medium tracking-tight text-[#b4233e]">
                  {aiFlagged}
                </p>
                <span className="text-sm font-semibold text-[#b4233e]">({aiPct}%)</span>
              </div>
              <p className="mt-2 text-xs text-[#718097]">
                Triggered Medium / High risk acoustic anomalies
              </p>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.19 }}
              className="rounded-2xl border border-[#c3e6cb] bg-white/90 p-5 shadow-[0_10px_30px_rgba(34,52,81,0.05)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#28756f]">Verified Bonafide</span>
                <ShieldCheck className="h-4 w-4 text-[#28756f]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <p className="font-mono text-4xl font-medium tracking-tight text-[#28756f]">
                  {realCalls}
                </p>
                <span className="text-sm font-semibold text-[#28756f]">({realPct}%)</span>
              </div>
              <p className="mt-2 text-xs text-[#718097]">
                Genuine human prosody & natural acoustic resonance
              </p>
            </motion.div>
          </div>

          {/* Breakdown Charts Grid */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Detection Basis Breakdown */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="rounded-[1.5rem] border border-[#d7ddea] bg-white/90 p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)]"
            >
              <div className="flex items-center justify-between border-b border-[#e6eaf0] pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#24324b]">
                    Detection Mode Breakdown
                  </h2>
                  <p className="mt-0.5 text-xs text-[#718097]">
                    Distribution of acoustic engine classification modes
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-[#5c8ee0]" />
              </div>

              <div className="mt-5 space-y-4">
                {detectionModes.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No detection events recorded yet.</p>
                ) : (
                  detectionModes.map(([mode, count]) => {
                    const pct = Math.round((count / maxDetectionCount) * 100)
                    const isAi = mode.includes("AI") || mode.includes("REPLAY")
                    return (
                      <div key={mode} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="font-mono text-slate-700">{mode}</span>
                          <span className="font-semibold text-slate-900">{count} calls</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isAi ? "bg-[#d9534f]" : "bg-[#28756f]"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>

            {/* Attack Type Breakdown */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="rounded-[1.5rem] border border-[#d7ddea] bg-white/90 p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)]"
            >
              <div className="flex items-center justify-between border-b border-[#e6eaf0] pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#24324b]">
                    Attack Type / Vector Breakdown
                  </h2>
                  <p className="mt-0.5 text-xs text-[#718097]">
                    Content pattern & impersonation vectors detected
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-[#c85b49]" />
              </div>

              <div className="mt-5 space-y-4">
                {attackTypes.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs font-semibold text-slate-500">No attack vectors currently classified</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Phase 3 content-risk scanning logs scam patterns (financial extortion, digital arrest, OTP phishing) here.
                    </p>
                  </div>
                ) : (
                  attackTypes.map(([atk, count]) => {
                    const pct = Math.round((count / maxAttackCount) * 100)
                    return (
                      <div key={atk} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="capitalize text-slate-700">{atk.replace(/_/g, " ")}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#c85b49] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </WavyBackground>
  )
}
