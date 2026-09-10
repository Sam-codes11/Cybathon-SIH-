import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Navbar from "../components/Navbar"
import RiskBadge from "../components/RiskBadge"
import EvidenceCard from "../components/EvidenceCard"
import WaveformVerdict from "../components/WaveformVerdict"
import ActionButton from "../components/ActionButton"
import Toast from "../components/Toast"
import { motion, useReducedMotion } from "framer-motion"
import { WavyBackground } from "../components/WavyBackground"
import { PhoneCall, ExternalLink, ShieldAlert, ArrowLeft, Copy, Check, Download, FileText } from "lucide-react"
import { generatePdfReport } from "../utils/generatePdfReport"

function CallDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [toastMessage, setToastMessage] = useState("")
  const [showToast, setShowToast] = useState(false)

  const handleEscalate = () => {
    window.open("https://cybercrime.gov.in", "_blank")
    setToastMessage("Redirecting to National Cyber Crime Reporting Portal...")
    setShowToast(true)
  }

  const handleCopyDossier = () => {
    const dossier = `--- CYBERCRIME ESCALATION DOSSIER ---
Call Reference       : Call #${id}
Timestamp            : ${new Date().toISOString()}
Forensic Detection   : Synthetic Speech (87% confidence)
Threat Level         : CRITICAL (Voice Impersonation Vector)
Action Taken         : Escalated to Cyber Crime Cell
National Helpline    : Dial 1930
Reporting Portal     : cybercrime.gov.in
-------------------------------------`
    navigator.clipboard.writeText(dossier)
    setToastMessage("Incident dossier copied to clipboard!")
    setShowToast(true)
  }

  const handleDownloadPdf = () => {
    try {
      const fileName = generatePdfReport({
        reportId: `VS-CALL-${id}`,
        audioSource: `Call Recording #${id}`,
        classification: "AI Impersonation Attack Detected",
        riskScore: 87,
        confidencePercent: 91,
        isReal: false,
        isImpersonation: true,
        callerRelationship: "no",
        intercepted: true,
      })
      setToastMessage(`Downloaded PDF Report: ${fileName}`)
      setShowToast(true)
    } catch (err) {
      console.error(err)
      handleCopyDossier()
    }
  }

  return (
    <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.3} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
      <main className="min-h-screen text-ink-slate-600">
        <Navbar />
        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-2xl px-6 pt-16 pb-24">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
          </button>

          <p className="font-mono text-xs text-ink-slate-600/60">Call #{id}</p>
          <div className="mt-3"><RiskBadge variant="synthetic" /></div>
          <WaveformVerdict className="mt-6" variant="synthetic" state="settled" />
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.18 }} className="mt-6 grid gap-4 sm:grid-cols-2">
            <EvidenceCard type="synthetic" score={87} />
            <EvidenceCard type="speakerMatch" noData />
          </motion.div>

          {/* National Cyber Helpline Integration */}
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900">
            <div className="flex items-center gap-2 font-bold text-red-800">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              Suspected AI Voice Impersonation Scam
            </div>
            <p className="mt-1 text-slate-600">
              If the caller demanded funds, gift cards, or credentials, report immediately to the National Cybercrime Helpline <strong>1930</strong>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href="tel:1930"
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white transition hover:bg-red-500"
              >
                <PhoneCall className="h-3.5 w-3.5" /> Call 1930
              </a>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white transition hover:bg-blue-500 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF Report
              </button>
              <button
                type="button"
                onClick={handleCopyDossier}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" /> Copy Dossier
              </button>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <ActionButton onClick={() => navigate("/dashboard")}>Mark reviewed</ActionButton>
            <ActionButton variant="destructive" onClick={handleEscalate}>
              Escalate to Cyber Portal <ExternalLink className="ml-1 h-3.5 w-3.5 inline" />
            </ActionButton>
          </div>
        </motion.section>

        {showToast && (
          <Toast
            message={toastMessage}
            onDismiss={() => setShowToast(false)}
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 border border-red-500/20 bg-white shadow-raised"
          />
        )}
      </main>
    </WavyBackground>
  )
}

export default CallDetail
