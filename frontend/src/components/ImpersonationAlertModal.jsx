import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  PhoneOff,
  ShieldAlert,
  HelpCircle,
  PhoneCall,
  UserX,
  Bot,
  Radio,
  Activity,
  DollarSign,
  Info,
  ChevronRight,
  ArrowLeft,
} from "lucide-react"

const ATTACK_TYPE_LABELS = {
  financial_extortion: "Financial Extortion Attempt",
  otp_phishing: "OTP / Code Phishing",
  digital_arrest_scam: "Digital Arrest Scam Pattern",
  impersonation_authority: "Authority Impersonation Claim",
  urgency_pressure: "High-Pressure Urgency Tactics",
}

export default function ImpersonationAlertModal({
  isOpen,
  spoofProbability = 0.85,
  risk = "HIGH",
  elapsedSeconds = 2,
  forensics = null,
  attackType = null,
  flaggedPhrases = [],
  transcript = "",
  detectionMode = null,
  onCutCall,
  onContinue,
  onDismiss,
}) {
  // Stage management: "question" (alert + identity options) -> "known_contact" | "breakdown"
  const [stage, setStage] = useState("question")

  useEffect(() => {
    if (isOpen) {
      setStage("question")
    }
  }, [isOpen])

  if (!isOpen) return null

  const spoofPercent = Math.round((spoofProbability || 0) * 100)

  // Forensic checks for Breakdown
  const replayScore = forensics?.replay_score !== undefined ? Number(forensics.replay_score) : 0.05
  const prosodyScore = forensics?.prosody_score !== undefined ? Number(forensics.prosody_score) : 0.05
  const isReplay = replayScore >= 0.5
  const isSynthetic = prosodyScore >= 0.5
  const hasContentRisk = Boolean(attackType && ATTACK_TYPE_LABELS[attackType])
  const contentLabel = attackType ? (ATTACK_TYPE_LABELS[attackType] || attackType) : null
  const noneFlagged = !isReplay && !isSynthetic && !hasContentRisk

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Translucent backdrop so live analysis, waveform, and streaming console remain visible */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-colors duration-300"
          onClick={onDismiss}
        />

        {/* STAGE: Question & Alert Combined (Immediate Alert + Identity Check) */}
        {stage === "question" && (
          <motion.div
            key="stage-question"
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border-2 border-red-500/70 bg-[#0c1424] text-white shadow-[0_0_60px_rgba(239,68,68,0.45)]"
          >
            {/* Pulsing Risk Banner Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400" />
                </span>
                <span className="font-mono text-xs font-black tracking-wider uppercase text-yellow-200">
                  ⚠ RISK DETECTED DURING CALL ({elapsedSeconds}s)
                </span>
              </div>
              <span className="rounded-full bg-black/40 px-2.5 py-0.5 font-mono text-xs font-bold text-yellow-300">
                {spoofPercent}% AI PROBABILITY
              </span>
            </div>

            <div className="p-5 sm:p-6">
              {/* Threat Sub-Banner */}
              <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/30 text-red-400">
                    <AlertTriangle className="h-6 w-6 text-yellow-300 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                        {risk} RISK
                      </span>
                      <span className="text-xs font-bold text-red-300">
                        {hasContentRisk ? contentLabel : (risk === "HIGH" ? "Critical AI Voice Threat" : "Elevated Risk Detected")}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                      Scam or synthetic acoustic markers were identified during live call analysis. Choose an option to respond immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Caller Identity Question */}
              <div className="mt-5">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Caller Identity Check &bull; Do you know this caller?
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Did the caller claim to be a family member, child, friend, police officer, or bank manager?
                </p>

                <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                  {/* Option 1: Yes */}
                  <button
                    type="button"
                    onClick={() => setStage("known_contact")}
                    className="group relative flex flex-col items-start rounded-2xl border border-red-500/40 bg-red-950/25 p-4 text-left transition-all hover:border-red-500 hover:bg-red-950/50 hover:shadow-lg"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/25 text-red-400">
                      <UserX className="h-5 w-5" />
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-white group-hover:text-red-200">
                      Yes, claims to be someone I know
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Claims familiarity (child, relative, bank manager, police).
                    </p>
                    <span className="mt-3 inline-flex items-center text-[11px] font-semibold text-red-400 group-hover:translate-x-1 transition-transform">
                      Check impersonation defense <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </button>

                  {/* Option 2: No / Unknown */}
                  <button
                    type="button"
                    onClick={() => setStage("breakdown")}
                    className="group relative flex flex-col items-start rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 text-left transition-all hover:border-amber-500 hover:bg-amber-950/50 hover:shadow-lg"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/25 text-amber-400">
                      <Bot className="h-5 w-5" />
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-white group-hover:text-amber-200">
                      No / Unknown Caller
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Unsolicited incoming call or automated robocall sample.
                    </p>
                    <span className="mt-3 inline-flex items-center text-[11px] font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                      View threat breakdown <ChevronRight className="h-3 w-3 ml-0.5" />
                    </span>
                  </button>
                </div>
              </div>

              {/* Immediate Emergency Action */}
              <div className="mt-5 border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-400">Unsure or feel threatened?</span>
                <button
                  type="button"
                  onClick={() => onCutCall?.("no")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-red-500"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  Cut Call Immediately
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE: Known Contact Impersonation View */}
        {stage === "known_contact" && (
          <motion.div
            key="stage-known"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-red-500/50 bg-[#0c1424] text-white shadow-[0_25px_70px_rgba(239,68,68,0.35)]"
          >
            {/* Top Red Bar */}
            <div className="bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStage("question")}
                  className="rounded-lg bg-black/30 p-1 text-white hover:bg-black/50 transition mr-1"
                  title="Back to caller check"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <UserX className="h-4 w-4 text-red-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Targeted Impersonation Threat
                </span>
              </div>
              <span className="rounded-full bg-black/40 px-2.5 py-0.5 font-mono text-xs font-bold text-red-200">
                Critical Alert
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-400" />
                  <h4 className="text-sm font-bold text-white">
                    Suspected Impersonation of Known Contact
                  </h4>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  The caller claimed familiarity (family member, child, friend, police officer, or bank manager), but neural detection flagged synthetic voice markers. Scammers use cloned voices to simulate emergencies or conduct Digital Arrest scams.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-red-200">
                  <span className="rounded-lg bg-black/30 px-2.5 py-1 border border-red-500/30">
                    🛑 Never transfer emergency funds
                  </span>
                  <span className="rounded-lg bg-black/30 px-2.5 py-1 border border-red-500/30">
                    🔒 Challenge with family safe-word
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCutCall?.("yes")}
                  className="flex items-center justify-between rounded-xl border border-red-500 bg-red-600 p-3.5 text-left font-bold text-white shadow-lg transition-all hover:bg-red-500"
                >
                  <div>
                    <p className="text-xs font-bold">Cut Call Immediately</p>
                    <p className="text-[10px] font-normal text-red-100">
                      Disconnect to stop extortion.
                    </p>
                  </div>
                  <PhoneOff className="h-4 w-4 shrink-0 text-white ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => onContinue?.("yes")}
                  className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 p-3.5 text-left text-white transition-all hover:border-amber-400/50 hover:bg-white/15"
                >
                  <div>
                    <p className="text-xs font-bold">Continue with Challenge</p>
                    <p className="text-[10px] text-slate-300">
                      Ask for secret family safe-word.
                    </p>
                  </div>
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 ml-2" />
                </button>
              </div>

              {/* Helpline Hotline & Back Button */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-500/20 bg-[#0e1b33] p-3 text-xs">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300">
                    National Cyber Helpline: <strong>Dial 1930</strong> (Fund Freeze)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("question")}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Change answer
                  </button>
                  <a
                    href="tel:1930"
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500"
                  >
                    Call 1930
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE: Unknown Caller Threat Breakdown View */}
        {stage === "breakdown" && (
          <motion.div
            key="stage-breakdown"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-3xl border border-amber-500/40 bg-[#0c1424] text-white shadow-[0_25px_70px_rgba(245,158,11,0.25)]"
          >
            {/* Top Amber Bar */}
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 px-5 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStage("question")}
                  className="rounded-lg bg-black/30 p-1 text-white hover:bg-black/50 transition mr-1"
                  title="Back to caller check"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <Bot className="h-4 w-4 text-yellow-200" />
                <span className="text-xs font-bold uppercase tracking-wider text-yellow-200">
                  Unknown Caller Threat Breakdown
                </span>
              </div>
              <span className="rounded-full bg-black/40 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-200">
                {spoofPercent}% AI Probability
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              <div className="space-y-2.5">
                {/* 1. Replay/loudspeaker attack detected */}
                <div className="flex items-start justify-between rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start gap-2.5">
                    <Radio className={`h-4 w-4 mt-0.5 ${isReplay ? "text-red-400" : "text-emerald-400"}`} />
                    <div>
                      <p className="text-xs font-bold text-white">
                        Replay / loudspeaker attack {isReplay ? "detected" : "not detected"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Score: {replayScore.toFixed(2)} {isReplay ? "(Threshold >= 0.50 exceeded)" : "(Below 0.50 threshold)"}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    isReplay ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {isReplay ? "FLAGGED" : "CLEARED"}
                  </span>
                </div>

                {/* 2. Synthetic voice pattern detected */}
                <div className="flex items-start justify-between rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start gap-2.5">
                    <Activity className={`h-4 w-4 mt-0.5 ${isSynthetic ? "text-red-400" : "text-emerald-400"}`} />
                    <div>
                      <p className="text-xs font-bold text-white">
                        Synthetic voice pattern {isSynthetic ? "detected" : "not detected"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Score: {prosodyScore.toFixed(2)} {isSynthetic ? "(Threshold >= 0.50 exceeded)" : "(Below 0.50 threshold)"}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    isSynthetic ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {isSynthetic ? "FLAGGED" : "CLEARED"}
                  </span>
                </div>

                {/* 3. Content risk pattern matched */}
                <div className="flex items-start justify-between rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start gap-2.5">
                    <DollarSign className={`h-4 w-4 mt-0.5 ${hasContentRisk ? "text-red-400" : "text-emerald-400"}`} />
                    <div>
                      <p className="text-xs font-bold text-white">
                        Content risk pattern {hasContentRisk ? `matched: ${contentLabel}` : "not matched"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {hasContentRisk ? `Scam vector: ${attackType}` : "No extortion or phishing keywords detected"}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    hasContentRisk ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {hasContentRisk ? "FLAGGED" : "CLEARED"}
                  </span>
                </div>

                {/* Fallback message if none of the above are flagged */}
                {noneFlagged && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <Info className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      No specific acoustic replay, synthetic prosody, or scam keywords detected above individual thresholds; overall risk flagged by multi-layer neural baseline.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                <button
                  type="button"
                  onClick={() => onCutCall?.("no")}
                  className="flex items-center justify-between rounded-xl border border-red-500 bg-red-600 p-3.5 text-left font-bold text-white shadow-lg transition-all hover:bg-red-500"
                >
                  <div>
                    <p className="text-xs font-bold">Cut Call Immediately</p>
                    <p className="text-[10px] font-normal text-red-100">
                      Safely terminate unsolicited call.
                    </p>
                  </div>
                  <PhoneOff className="h-4 w-4 shrink-0 text-white ml-2" />
                </button>

                <button
                  type="button"
                  onClick={() => onContinue?.("no")}
                  className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 p-3.5 text-left text-white transition-all hover:border-amber-400/50 hover:bg-white/15"
                >
                  <div>
                    <p className="text-xs font-bold">Continue with Caution</p>
                    <p className="text-[10px] text-slate-300">
                      Do not share OTPs or passwords.
                    </p>
                  </div>
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 ml-2" />
                </button>
              </div>

              {/* Helpline & Change Answer */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-500/20 bg-[#0e1b33] p-3 text-xs">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-blue-400" />
                  <span className="text-slate-300">
                    National Cyber Helpline: <strong>Dial 1930</strong> (Fund Freeze)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStage("question")}
                    className="text-[11px] text-slate-400 hover:text-white underline"
                  >
                    Change answer
                  </button>
                  <a
                    href="tel:1930"
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500"
                  >
                    Call 1930
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  )
}
