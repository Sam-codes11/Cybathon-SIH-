import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  PhoneOff,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  PhoneCall,
  UserX,
  Bot,
  CheckCircle2,
  ChevronRight,
  Shield,
  Activity,
  Mic,
  Volume2,
  DollarSign
} from "lucide-react"

export default function ImpersonationAlertModal({
  isOpen,
  spoofProbability = 0.85,
  risk = "HIGH",
  elapsedSeconds = 6,
  onCutCall,
  onContinue,
  onDismiss,
}) {
  const [knowsCaller, setKnowsCaller] = useState(null)

  if (!isOpen) return null

  const spoofPercent = Math.round((spoofProbability || 0) * 100)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={onDismiss}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-red-500/30 bg-[#0c1424] text-white shadow-[0_25px_70px_rgba(239,68,68,0.28)]"
        >
          {/* Top Alert Banner */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-6 py-3.5 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <AlertTriangle className="h-4 w-4 animate-bounce text-yellow-200" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-yellow-200">
                    Voice Risk Alert (Past {elapsedSeconds}s)
                  </p>
                  <p className="text-sm font-semibold">
                    {risk === "HIGH" ? "Critical Risk" : "Elevated Risk"} · Voice Spoof Probability Detected
                  </p>
                </div>
              </div>
              <div className="rounded-full bg-black/30 px-3 py-1 font-mono text-xs font-bold tracking-tight text-white backdrop-blur">
                {spoofPercent}% AI Probability
              </div>
            </div>
          </div>

          <div className="max-h-[82vh] overflow-y-auto p-6 sm:p-7">
            {/* Step 1: Caller Identity Check */}
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#93b4e6]">
                <HelpCircle className="h-4 w-4 text-[#60a5fa]" />
                Step 1: Caller Verification
              </label>
              <h3 className="mt-1 text-base font-semibold text-white">
                Do you personally know this caller, or who they claim to be?
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Are they claiming to be a family member, child, friend, police officer, CBI, or bank manager?
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {/* Option 1: Yes */}
                <button
                  type="button"
                  onClick={() => setKnowsCaller("yes")}
                  className={`group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                    knowsCaller === "yes"
                      ? "border-red-500 bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                      <UserX className="h-5 w-5" />
                    </div>
                    {knowsCaller === "yes" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    Yes, claims to be someone I know
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Claims familiarity (e.g. relative, authority, bank manager).
                  </p>
                </button>

                {/* Option 2: No */}
                <button
                  type="button"
                  onClick={() => setKnowsCaller("no")}
                  className={`group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
                    knowsCaller === "no"
                      ? "border-amber-500 bg-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                      <Bot className="h-5 w-5" />
                    </div>
                    {knowsCaller === "no" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">
                    No, unknown caller / unsolicited
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Automated robocall or unknown unsolicited voice sample.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: Assessment & Detected Parameters (Reveals on selection) */}
            {knowsCaller && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
              >
                {/* Impersonation Diagnosis Card */}
                <div
                  className={`rounded-2xl border p-4 ${
                    knowsCaller === "yes"
                      ? "border-red-500/40 bg-red-950/40"
                      : "border-amber-500/40 bg-amber-950/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert
                      className={`h-5 w-5 ${
                        knowsCaller === "yes" ? "text-red-400" : "text-amber-400"
                      }`}
                    />
                    <h4 className="text-sm font-bold text-white">
                      {knowsCaller === "yes"
                        ? "🚨 AI Impersonation Attack Likely Detected"
                        : "🤖 Automated Synthetic Voice Scam Detected"}
                    </h4>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300">
                    {knowsCaller === "yes"
                      ? "The caller claims to be a known person, but spectral AI detection identified synthetic neural markers. This pattern matches active voice-clone extortion (Digital Arrest or Virtual Kidnapping)."
                      : "The audio contains synthetic voice generation artifacts typical of automated spam and fraudulent voice phishing bots."}
                  </p>

                  {/* Metrics Bar */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-black/30 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">AI Voice Probability</p>
                      <p className="mt-0.5 font-mono text-base font-bold text-red-300">{spoofPercent}%</p>
                    </div>
                    <div className="rounded-xl bg-black/30 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Risk Score</p>
                      <p className="mt-0.5 font-mono text-base font-bold text-amber-300">{spoofPercent} / 100</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-black/30 p-2.5 sm:col-span-1">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">Threat Diagnosis</p>
                      <p className="mt-0.5 text-xs font-bold text-white">
                        {knowsCaller === "yes" ? "Targeted Impersonation" : "Synthetic Bot"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detected Parameters Section */}
                <div className="mt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#93b4e6]">
                    <Activity className="h-4 w-4 text-[#60a5fa]" />
                    Detected Forensic Parameters
                  </label>

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {/* Parameter 1 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-semibold text-white">Unusually Clean Voice</span>
                        </div>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">FLAGGED</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Current audio: Synthetic void (no room ambience)
                      </p>
                    </div>

                    {/* Parameter 2 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-semibold text-white">Pitch Variation</span>
                        </div>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">FLAGGED</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Current audio: Abnormal flat / synthetic pitch
                      </p>
                    </div>

                    {/* Parameter 3 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-red-400" />
                          <span className="text-xs font-semibold text-white">Spectral Phase</span>
                        </div>
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">FLAGGED</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Current audio: Vocoder phase discontinuities
                      </p>
                    </div>

                    {/* Parameter 4 */}
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-red-400" />
                          <span className="text-xs font-semibold text-white">Money Demand / Urgency</span>
                        </div>
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">FLAGGED</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        Current audio: Emergency coercion pattern
                      </p>
                    </div>
                  </div>
                </div>

                {/* Decision & Next Step Actions */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Do you want to continue or cut the call?
                  </h4>

                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                    {/* Cut Call Button */}
                    <button
                      type="button"
                      onClick={() => onCutCall?.(knowsCaller)}
                      className="flex items-center justify-between rounded-2xl border border-red-500 bg-red-600 p-3.5 text-left font-semibold text-white shadow-lg transition-all hover:bg-red-500"
                    >
                      <div>
                        <p className="text-sm font-bold">Cut the Call Now</p>
                        <p className="text-[11px] font-normal text-red-100">
                          Recommended measure: Disconnect to stop extortion.
                        </p>
                      </div>
                      <PhoneOff className="h-5 w-5 shrink-0 text-white ml-2" />
                    </button>

                    {/* Continue Button */}
                    <button
                      type="button"
                      onClick={() => onContinue?.(knowsCaller)}
                      className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 p-3.5 text-left text-white transition-all hover:border-amber-400/50 hover:bg-white/15"
                    >
                      <div>
                        <p className="text-sm font-bold">Continue with Caution</p>
                        <p className="text-[11px] text-slate-300">
                          Challenge caller with secret family safe-word.
                        </p>
                      </div>
                      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400 ml-2" />
                    </button>
                  </div>
                </div>

                {/* Quick Helpline Hotline */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-500/20 bg-[#0e1b33] p-3">
                  <div className="flex items-center gap-2.5">
                    <PhoneCall className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-slate-300">
                      National Cyber Helpline: <strong>Dial 1930</strong> (Golden Hour Fund Freeze)
                    </span>
                  </div>
                  <a
                    href="tel:1930"
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500"
                  >
                    Call 1930
                  </a>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
