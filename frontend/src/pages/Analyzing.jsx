import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AudioLines, Check, ScanLine, ShieldCheck } from "lucide-react"
import Navbar from "../components/Navbar"
import WaveformVerdict from "../components/WaveformVerdict"
import { motion } from "framer-motion"
import { WavyBackground } from "../components/WavyBackground"

function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const [stage, setStage] = useState(0)
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const stages = ["Preparing audio", "Reading voice markers", "Checking attack patterns"]

  useEffect(() => {
    const sendToBackend = async () => {
      setStage(1)

      const formData = new FormData()
      const audioBlob = location.state?.audioBlob

      if (audioBlob) {
        formData.append("file", audioBlob, "recording.webm")
      }

      setStage(2)

      try {
        const response = await fetch("http://127.0.0.1:8000/analyze", {
          method: "POST",
          body: formData,
        })
        const data = await response.json()

        navigate("/result", { replace: true, state: { result: data } })
      } catch (error) {
        console.error("Backend error:", error)
        navigate("/result", { replace: true, state: { result: null } })
      }
    }

    sendToBackend()
  }, [navigate, location.state])

  return (
    <main className="min-h-screen bg-[#101b2f] text-white">
      <WavyBackground backgroundFill="#101b2f" waveOpacity={0.48} colors={["#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa"]}>
        <Navbar />
        <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={prefersReducedMotion ? false : { opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-2xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8"
      >
        <motion.div initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }} animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="w-full rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-9">
          <div className="flex items-center justify-between text-left"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83b7ff]">Analysis in progress</p><h1 className="mt-2 font-display text-2xl font-semibold">Reading your voice sample</h1></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3a7eea]/20 text-[#82b5ff]"><AudioLines className="h-5 w-5" /></span></div>
          <div className="orb-stage mt-7"><div className="signal-orb" aria-hidden="true"><span /><span /><span /></div><p className="relative z-10 text-sm font-medium text-[#d7e5ff]">Extracting voice markers</p><p className="relative z-10 mt-1 text-xs text-[#8291aa]">This prototype simulates a secure analysis pass</p></div>
          <div className="mt-4 rounded-xl border border-white/10 bg-[#091324] px-3 py-3"><WaveformVerdict variant="uncertain" state="analyzing" size="sparkline" /></div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-white/[0.06] px-4 py-3 text-left"><span className="truncate text-sm text-slate-300">{location.state?.source ?? "Voice sample"}</span><span className="ml-4 shrink-0 text-xs font-medium text-[#8bc8ba]">secured</span></div>
          <div className="mt-8 space-y-3 text-left">{stages.map((item, index) => <div key={item} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${index === stage ? "bg-[#3a7eea]/15" : ""}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index < stage ? "bg-[#37a68f] text-white" : index === stage ? "bg-[#4e8cf2] text-white" : "bg-white/10 text-slate-500"}`}>{index < stage ? <Check className="h-3.5 w-3.5" /> : <ScanLine className={`h-3.5 w-3.5 ${index === stage ? "animate-pulse" : ""}`} />}</span><span className={`text-sm ${index <= stage ? "text-white" : "text-slate-500"}`}>{item}</span></div>)}</div>
          <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-[#8bc8ba]" />No audio is stored after this session.</div>
        </motion.div>
      </motion.section>
      </WavyBackground>
    </main>
  )
}

export default Analyzing