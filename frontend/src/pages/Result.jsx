import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, ArrowLeft, ChevronRight, CircleAlert, FileAudio, ShieldAlert } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import { WavyBackground } from "../components/WavyBackground"
import WaveformVerdict from "../components/WaveformVerdict"
import Toast from "../components/Toast"

const report = {
  risk: 84,
  confidence: 92,
  classification: "Likely AI-cloned voice",
  summary: "The sample contains multiple patterns associated with synthesized or converted speech.",
  attacks: [
    ["AI voice clone", 84],
    ["Text-to-speech", 61],
    ["Voice conversion", 39],
    ["Replay artifact", 27],
  ],
}

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

function Result() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [flagged, setFlagged] = useState(false)
  const animation = reduceMotion ? {} : { variants: reveal, initial: "hidden", animate: "visible", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } }

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#172236]">
      <Navbar />
      <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.34} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 sm:pt-14">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.button {...animation} type="button" onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-sm font-medium text-[#526075] transition hover:text-[#16243c]"><ArrowLeft className="h-4 w-4" />New analysis</motion.button>
            <motion.div {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }} className="mt-6 flex flex-col justify-between gap-5 border-b border-[#cfd6e2] pb-8 md:flex-row md:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5876a5]">Voice risk report</p><h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-[#14203a] sm:text-4xl">Analysis complete</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#667389]">A prototype assessment based on the submitted voice sample. Connect the backend to replace these demonstration values.</p></div>
          <div className="rounded-full border border-[#cdd7e9] bg-white px-4 py-2 text-xs font-medium text-[#506078]"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3f82f1]" />Confidence {report.confidence}%</div>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.07fr_0.93fr]">
          <motion.article {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }} className="rounded-[1.75rem] bg-[#14213b] p-6 text-white shadow-[0_22px_60px_rgba(21,35,61,0.18)] sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a6c5f7]">Overall verdict</p><h2 className="mt-3 font-display text-2xl font-semibold">{report.classification}</h2></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7ab52] text-[#3f2a0d]"><ShieldAlert className="h-5 w-5" /></span></div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#c4cede]">{report.summary}</p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-[#0c172b] px-3 py-4"><WaveformVerdict variant="synthetic" state="settled" /></div>
            <div className="mt-5 flex items-center justify-between text-xs text-[#aab8cd]"><span className="inline-flex items-center gap-2"><FileAudio className="h-4 w-4" />Voice sample</span><span>00:18</span></div>
          </motion.article>

          <motion.article {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.23, ease: [0.22, 1, 0.36, 1] }} className="rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#61749a]">Risk score</p>
            <div className="mt-5 flex items-center gap-6"><div className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#e0644e 0deg ${report.risk * 3.6}deg, #edf0f5 ${report.risk * 3.6}deg 360deg)` }}><div className="grid h-[7.3rem] w-[7.3rem] place-items-center rounded-full bg-white"><div className="text-center"><p className="font-mono text-4xl font-medium tracking-[-0.08em] text-[#202b43]">{report.risk}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a879b]">out of 100</p></div></div></div><div><p className="text-lg font-semibold text-[#25314a]">High risk</p><p className="mt-2 text-sm leading-6 text-[#6b778b]">Treat the request as suspicious until verified through a known channel.</p></div></div>
            <div className="mt-7 border-t border-[#e6eaf0] pt-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#33425c]"><CircleAlert className="h-4 w-4 text-[#db684f]" />Recommended next step</p><p className="mt-2 text-sm leading-6 text-[#67748a]">End the call. Call the person back using a number you already trust.</p></div>
          </motion.article>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.93fr_1.07fr]">
          <motion.article {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }} className="rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#61749a]">Signals observed</p><div className="mt-6 space-y-4">{[["Pitch variation", "Low natural variation", "Detected"], ["Spectral consistency", "Unusually uniform", "Detected"], ["Voice texture", "Synthetic markers present", "Detected"]].map(([label, detail, status], index) => <motion.div key={label} initial={reduceMotion ? false : { opacity: 0, x: -12 }} animate={reduceMotion ? false : { opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : 0.42 + index * 0.08 }} className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f8fb] px-4 py-3"><div><p className="text-sm font-medium text-[#2f3d57]">{label}</p><p className="mt-0.5 text-xs text-[#758197]">{detail}</p></div><span className="rounded-full bg-[#fff0e9] px-2.5 py-1 text-[11px] font-semibold text-[#c65e49]">{status}</span></motion.div>)}</div></motion.article>
          <motion.article {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }} className="rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)] sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#61749a]">Attack types detected</p><p className="mt-2 text-sm text-[#718097]">Potential synthesis methods found in this sample.</p></div><AlertTriangle className="h-5 w-5 text-[#d6654e]" /></div><div className="mt-8 space-y-5">{report.attacks.map(([label, value], index) => <motion.div key={label} initial={reduceMotion ? false : { opacity: 0 }} animate={reduceMotion ? false : { opacity: 1 }} transition={{ delay: reduceMotion ? 0 : 0.5 + index * 0.1 }}><div className="mb-2 flex justify-between text-sm"><span className="font-medium text-[#34425c]">{label}</span><span className="font-mono text-xs text-[#758197]">{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0f5]"><motion.div initial={reduceMotion ? false : { width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, delay: reduceMotion ? 0 : 0.55 + index * 0.1, ease: "easeOut" }} className={`h-full rounded-full ${index === 0 ? "bg-[#e0644e]" : index === 1 ? "bg-[#e5a34e]" : "bg-[#718fc0]"}`} /></div></motion.div>)}</div></motion.article>
        </div>

        <motion.div {...animation} transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }} className="mt-7 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#efd8cd] bg-[#fff9f6] p-5 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fde9e2] text-[#cf604a]"><AlertTriangle className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#49342e]">Do not share codes, money, or sensitive details.</p><p className="mt-1 text-sm text-[#785f58]">Use a trusted contact method to verify who called you.</p></div></div><motion.button type="button" onClick={() => setFlagged(true)} whileHover={reduceMotion ? {} : { y: -2 }} whileTap={reduceMotion ? {} : { scale: 0.98 }} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#c95745] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ad4435]">Flag this sample<ChevronRight className="h-4 w-4" /></motion.button></motion.div>
      </motion.section>
        </section>
      </WavyBackground>
      {flagged && <Toast message="Sample flagged for follow-up." onDismiss={() => setFlagged(false)} className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 border border-[#d96650]/20 bg-white shadow-raised" />}
    </main>
  )
}

export default Result
