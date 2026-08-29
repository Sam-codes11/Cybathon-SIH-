import { useParams } from "react-router-dom"
import Navbar from "../components/Navbar"
import RiskBadge from "../components/RiskBadge"
import EvidenceCard from "../components/EvidenceCard"
import WaveformVerdict from "../components/WaveformVerdict"
import ActionButton from "../components/ActionButton"
import { motion, useReducedMotion } from "framer-motion"
import { WavyBackground } from "../components/WavyBackground"

function CallDetail() {
  const { id } = useParams()
  const reduceMotion = useReducedMotion()

  return (
    <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.3} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
    <main className="min-h-screen text-ink-slate-600">
      <Navbar />
      <motion.section initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-2xl px-6 pt-16 pb-24">
        <p className="font-mono text-xs text-ink-slate-600/60">Call #{id}</p>
        <div className="mt-3"><RiskBadge variant="synthetic" /></div>
        <WaveformVerdict className="mt-6" variant="synthetic" state="settled" />
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.18 }} className="mt-6 grid gap-4 sm:grid-cols-2"><EvidenceCard type="synthetic" score={87} /><EvidenceCard type="speakerMatch" noData /></motion.div>
        <div className="mt-8 flex gap-3"><ActionButton>Mark reviewed</ActionButton><ActionButton variant="destructive">Escalate</ActionButton></div>
      </motion.section>
    </main>
    </WavyBackground>
  )
}

export default CallDetail
