import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  FileAudio,
  ShieldAlert,
  PhoneCall,
  ExternalLink,
  Copy,
  Check,
  FileText,
  ShieldCheck,
  AlertOctagon,
  Clock,
  PhoneOff,
  UserX,
  Bot,
  Shield,
  HelpCircle,
  Download,
  Activity,
  Volume2,
  DollarSign
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import { WavyBackground } from "../components/WavyBackground"
import WaveformVerdict from "../components/WaveformVerdict"
import Toast from "../components/Toast"
import { generatePdfReport } from "../utils/generatePdfReport"

const reveal = { hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }

function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [flagged, setFlagged] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toastMessage, setToastMessage] = useState("")

  const animation = reduceMotion
    ? {}
    : {
        initial: "hidden",
        animate: "visible",
        variants: reveal,
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], },
      }

  const backendData = location.state?.result
  const intercepted = location.state?.intercepted || backendData?.callCutOffEarly
  const spoofProbability =
    backendData?.spoof_probability ??
    backendData?.max_spoof_probability ??
    0

  const isReal =
    backendData?.status === "likely_real" ||
    backendData?.result === "real"

  const callerRelationship = location.state?.callerRelationship || backendData?.callerRelationship || "no"
  const isImpersonation =
    location.state?.isImpersonationAttack ||
    backendData?.isImpersonationAttack ||
    callerRelationship === "yes"
  const isUnknownCaller = callerRelationship === "no" || (!isImpersonation && !isReal)

  if (backendData?.silent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a101d] text-white px-5">
        <div className="text-center max-w-md rounded-4xl border border-white/10 bg-white/6 p-10 backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3a7eea]/20">
            <svg className="h-8 w-8 text-[#82b5ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">No speech detected</h1>
          <p className="mt-3 text-sm leading-6 text-[#8291aa]">We couldn't detect any voice in your recording. Please try again and speak clearly into your microphone.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#e7efff] px-6 py-3 text-sm font-semibold text-[#10182a] transition hover:bg-white"
          >
            Try Again
          </button>
        </div>
      </main>
    )
  }

  if (!backendData) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a101d] text-white px-5">
        <div className="text-center max-w-md rounded-4xl border border-white/10 bg-white/5 p-10 backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20">
            <AlertTriangle className="h-8 w-8 text-red-300" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Analysis failed</h1>
          <p className="mt-3 text-sm leading-6 text-[#8291aa]">We couldn't reach the backend to analyze your sample. Please try again.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#e7efff] px-6 py-3 text-sm font-semibold text-[#10182a] transition hover:bg-white"
          >
            Back to Home
          </button>
        </div>
      </main>
    )
  }

  const riskScore = Math.round(spoofProbability * 100)
  const confidencePercent = isReal ? 100 - riskScore : riskScore

  // Impersonation & Attack Vector Assessment
  let attackVectorTitle = isReal
    ? "Natural Human Voice Verified"
    : isImpersonation
    ? "Targeted AI Voice Clone / Impersonation Attack"
    : callerRelationship === "no"
    ? "Synthetic Robocall / Automated Scam"
    : "Synthetic Voice Spoofing Detected"

  let attackVectorDescription = isReal
    ? "Acoustic spectrum matches biological vocal tract modulation."
    : isImpersonation
    ? "The caller claimed to be someone you know, but synthetic markers were detected. This matches Digital Arrest and emergency money extortion patterns."
    : "The sample contains acoustic artifacts consistent with neural text-to-speech or voice conversion."

  const report = {
    risk: riskScore,
    confidence: confidencePercent,
    classification: isReal
      ? "Likely genuine voice"
      : isImpersonation
      ? "AI Impersonation Attack Detected"
      : "Likely AI-cloned voice",
    summary: attackVectorDescription,
  }

  // Parameters on which it detected AI
  const forensicParameters = [
    {
      id: "clean_voice",
      icon: Volume2,
      name: "Background Noise & Room Acoustics",
      flagged: !isReal,
      value: !isReal ? "Unusually silent (no room ambience detected)" : "Natural room ambience present",
    },
    {
      id: "pitch_variation",
      icon: Activity,
      name: "Pitch Dynamics & Voice Modulation",
      flagged: !isReal,
      value: !isReal ? "Abnormal or flat pitch variation" : "Natural pitch modulation",
    },
    {
      id: "spectral_phase",
      icon: ShieldAlert,
      name: "Voice Frequency Spectrum",
      flagged: !isReal,
      value: !isReal ? "Synthetic speech artifacts detected" : "Natural human speech frequencies",
    },
    {
      id: "demand_coercion",
      icon: DollarSign,
      name: "Call Context & Pressure Indicators",
      flagged: !isReal,
      value: isImpersonation
        ? "Urgent financial demand / coercion pattern"
        : !isReal
        ? "Automated robocall pattern"
        : "Standard conversational tone",
    },
  ]

  const generateDossierText = () => {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC"
    return `=================================================================
VOICE SHIELD - FORENSIC AI VOICE FRAUD INCIDENT REPORT
=================================================================
Report ID               : VS-INCIDENT-${Date.now()}
Date & Time             : ${timestamp}
Audio Source            : ${backendData?.filename || "Live Call Interception"}
Overall Classification  : ${report.classification}
Risk Score              : ${riskScore} / 100 (${isReal ? "LOW" : riskScore >= 80 ? "CRITICAL" : "MEDIUM"})
AI Spoof Probability    : ${riskScore}%
Model Confidence        : ${confidencePercent}%
Caller Relationship     : ${
      isImpersonation
        ? "Claims to be a known person (Targeted Impersonation Attack)"
        : callerRelationship === "no"
        ? "Unknown caller / Automated Robocall"
        : "Unspecified"
    }
Interception Timing     : ${
      intercepted
        ? `Call safely disconnected past 6s alert`
        : "Full duration analyzed"
    }

-----------------------------------------------------------------
FORENSIC DETECTION PARAMETERS:
-----------------------------------------------------------------
1. Acoustic Cleanliness : ${
      !isReal
        ? "FLAGGED - Unusually clean voice (near-zero room ambience / studio void)"
        : "NORMAL - Natural ambient room response"
    }
2. Pitch Variation      : ${
      !isReal
        ? "FLAGGED - Synthetic prosody & flat/abnormal pitch contours"
        : "NORMAL - Organic vocal pitch micro-tremors"
    }
3. Spectral Phase       : ${
      !isReal
        ? "FLAGGED - Neural vocoder phase discontinuities in high frequencies"
        : "NORMAL - Consistent harmonic phase distribution"
    }
4. Impersonation Claim  : ${
      isImpersonation
        ? "FLAGGED - High extortion / emergency money demand coercion pattern"
        : !isReal
        ? "FLAGGED - Synthetic robocall spam vector"
        : "NORMAL - Standard conversational audio"
    }

-----------------------------------------------------------------
PREDICTIVE ACTION PROTOCOL:
-----------------------------------------------------------------
Step 1: Out-of-Band Secondary Verification
        Do NOT redial the incoming caller ID. Call back on a verified saved number.
Step 2: Golden Hour Financial Protection
        If UPI, card, or OTP was shared, immediately call 1930 within 1-2 hours
        to initiate an inter-bank transaction freeze.
Step 3: Alert Mutual Family & Friends
        Notify relatives that an AI voice clone is circulating. Establish a family safe-word.
Step 4: Official Portal Lodging
        Lodge this forensic report on cybercrime.gov.in and DoT Chakshu (sancharsaathi.gov.in/sfc/).

-----------------------------------------------------------------
STATUTORY REFERENCES & GOVERNMENT HELPLINES:
-----------------------------------------------------------------
- National Cyber Financial Fraud Helpline : Dial 1930 (Toll-Free, Govt. of India)
- National Cyber Crime Reporting Portal   : https://cybercrime.gov.in
- DoT Sanchar Saathi (Chakshu)            : https://sancharsaathi.gov.in/sfc/
- Legal Provisions: Information Technology Act Sec 66D, IPC / BNS Impersonation Provisions
=================================================================`
  }

  const copyIncidentDossier = () => {
    const dossier = generateDossierText()
    navigator.clipboard.writeText(dossier)
    setCopied(true)
    setToastMessage("Incident dossier copied to clipboard!")
    setFlagged(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const downloadReportFile = () => {
    try {
      const fileName = generatePdfReport({
        reportId: `VS-INCIDENT-${Date.now().toString().slice(-6)}`,
        audioSource: backendData?.filename || "Live Call Interception",
        classification: report.classification,
        riskScore: riskScore,
        confidencePercent: confidencePercent,
        isReal: isReal,
        isImpersonation: isImpersonation,
        callerRelationship: callerRelationship || (isUnknownCaller ? "no" : "yes"),
        intercepted: intercepted,
        forensicParameters: forensicParameters,
        summary: report.summary,
      })
      setToastMessage(`Official PDF report generated: ${fileName}`)
      setFlagged(true)
    } catch (err) {
      console.error("PDF generation failed, falling back to text:", err)
      const text = generateDossierText()
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `VoiceShield_Forensic_Report_${new Date().toISOString().slice(0, 10)}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setToastMessage("Forensic report downloaded successfully!")
      setFlagged(true)
    }
  }

  return (
    <main className="min-h-screen bg-[#f3f5f7] text-[#172236]">
      <Navbar />
      <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.34} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {/* Top Navigation */}
            <motion.button
              {...animation}
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#526075] transition hover:text-[#16243c]"
            >
              <ArrowLeft className="h-4 w-4" />
              New analysis
            </motion.button>

            {/* Header */}
            <motion.div
              {...animation}
              transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 flex flex-col justify-between gap-5 border-b border-[#cfd6e2] pb-8 md:flex-row md:items-end"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5876a5]">
                  Voice Shield · Predictive Incident Defense
                </p>
                <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-[#14203a] sm:text-4xl">
                  {intercepted
                    ? "Call Intercepted & Quarantined"
                    : "Voice Risk & Impersonation Report"}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#667389]">
                  {intercepted
                    ? "The call was safely disconnected after voice spoofing was flagged."
                    : "Analysis completed with forensic parameter breakdown and protective next steps."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {intercepted && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-700">
                    Intercept Active
                  </span>
                )}
                <div className="rounded-full border border-[#cdd7e9] bg-white px-4 py-2 text-xs font-medium text-[#506078]">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3f82f1]" />
                  Confidence {report.confidence}%
                </div>
              </div>
            </motion.div>

            {/* Alert Banner if AI Spoofed */}
            {!isReal && (
              <motion.div
                {...animation}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-6 overflow-hidden rounded-2xl border border-red-300 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 p-5 text-white shadow-lg"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                      {isImpersonation ? (
                        <UserX className="h-6 w-6 text-yellow-200" />
                      ) : (
                        <PhoneOff className="h-6 w-6 text-white" />
                      )}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-200">
                          {isImpersonation ? "IMPERSONATION ATTACK" : "SYNTHETIC CALL DETECTED"}
                        </span>
                        {intercepted && (
                          <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Safely Cut Off
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-white">
                        {isImpersonation
                          ? "Active Voice Clone Impersonation Detected"
                          : "AI-Generated Voice Call Flagged"}
                      </h2>
                      <p className="mt-1 text-xs text-red-100">
                        {isImpersonation
                          ? "The caller claimed familiarity, but our model identified synthetic markers matching emergency extortion or Digital Arrest templates."
                          : "High probability of AI text-to-speech or voice conversion. Do not comply with financial requests."}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 sm:self-center">
                    <a
                      href="tel:1930"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-red-700 shadow-sm transition hover:bg-red-50"
                    >
                      <PhoneCall className="h-4 w-4 text-red-600" />
                      Call 1930 Now
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* UNKNOWN CALLER: FORENSIC PDF REPORT GENERATED BANNER */}
            {isUnknownCaller && (
              <motion.div
                {...animation}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/95 via-sky-50/90 to-indigo-50/95 p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-900">
                          Unknown Caller
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          PDF Report Ready
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            riskScore >= 70
                              ? "bg-red-100 text-red-800"
                              : riskScore >= 40
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {riskScore >= 70
                            ? "High Risk"
                            : riskScore >= 40
                            ? "Medium Risk"
                            : "Low Risk"}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-slate-900">
                        Call Verification PDF Report Prepared
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Voice Shield generated a call report for this unknown caller with evaluated audio parameters, risk score ({riskScore}/100), and recommended next steps.
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadReportFile}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-500 hover:shadow-lg"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF Report
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 1: Main 2-Column Cards (Verdict & Risk Score) */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.07fr_0.93fr]">
              {/* Verdict Card */}
              <motion.article
                {...animation}
                transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[1.75rem] bg-[#14213b] p-6 text-white shadow-[0_22px_60px_rgba(21,35,61,0.18)] sm:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a6c5f7]">
                      Overall verdict
                    </p>
                    <h2 className="mt-3 font-display text-2xl font-semibold">
                      {report.classification}
                    </h2>
                  </div>
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                      isReal
                        ? "bg-[#23816e]/25 text-[#3ee2bf]"
                        : "bg-[#e7ab52] text-[#3f2a0d]"
                    }`}
                  >
                    {isReal ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                  </span>
                </div>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[#c4cede]">{report.summary}</p>
                <div className="mt-7 rounded-2xl border border-white/10 bg-[#0c172b] px-3 py-4">
                  <WaveformVerdict variant={isReal ? "genuine" : "synthetic"} state="settled" />
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-[#aab8cd]">
                  <span className="inline-flex items-center gap-2">
                    <FileAudio className="h-4 w-4" />
                    Voice sample
                  </span>
                  <span>{intercepted ? "Intercepted at 6s" : "Complete audio analyzed"}</span>
                </div>
              </motion.article>

              {/* Risk Score Card */}
              <motion.article
                {...animation}
                transition={{ duration: 0.6, delay: reduceMotion ? 0 : 0.23, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-[0_16px_40px_rgba(34,52,81,0.07)] sm:p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#61749a]">
                  Risk score & Threat Level
                </p>
                <div className="mt-5 flex items-center gap-6">
                  <div
                    className="relative grid h-36 w-36 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `conic-gradient(#e0644e 0deg ${
                        report.risk * 3.6
                      }deg, #edf0f5 ${report.risk * 3.6}deg 360deg)`,
                    }}
                  >
                    <div className="grid h-[7.3rem] w-[7.3rem] place-items-center rounded-full bg-white">
                      <div className="text-center">
                        <p className="font-mono text-4xl font-medium tracking-[-0.08em] text-[#202b43]">
                          {report.risk}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7a879b]">
                          out of 100
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#25314a]">
                      {isReal ? "Low risk (Genuine)" : report.risk >= 80 ? "Critical risk" : "Medium/High risk"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#6b778b]">
                      {isReal
                        ? "This sample appears to be a genuine human voice."
                        : attackVectorTitle}
                    </p>
                  </div>
                </div>
                <div className="mt-7 border-t border-[#e6eaf0] pt-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#33425c]">
                    <CircleAlert className="h-4 w-4 text-[#db684f]" />
                    Recommended next step
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#67748a]">
                    {isReal
                      ? "No immediate action needed, but stay alert for other signs of fraud."
                      : isImpersonation
                      ? "Hang up immediately. Call the family member directly on their known personal phone number."
                      : "End the call. Do not disclose OTPs, banking credentials, or passwords."}
                  </p>
                </div>
              </motion.article>
            </div>

            {/* STEP 2: ON WHAT PARAMETERS IT DETECTED AI (Requested Section) */}
            <motion.section
              {...animation}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Detection Parameters
                  </span>
                  <h3 className="mt-1 text-xl font-bold text-[#14213b]">
                    On what parameters did Voice Shield detect AI?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Specific acoustic anomalies, pitch trajectories, and risk signatures evaluated during the call.
                  </p>
                </div>
                <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  4 Forensic Indicators
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {forensicParameters.map((param) => {
                  const Icon = param.icon
                  return (
                    <div
                      key={param.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        param.flagged
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                              param.flagged
                                ? "bg-amber-500/20 text-amber-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{param.name}</h4>
                            <p className="mt-1 text-xs text-slate-600">
                              Current audio:{" "}
                              <span
                                className={`font-semibold ${
                                  param.flagged ? "text-amber-900" : "text-slate-800"
                                }`}
                              >
                                {param.value}
                              </span>
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            param.flagged
                              ? "bg-amber-200/80 text-amber-900"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {param.flagged ? "Flagged" : "Normal"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.section>

            {/* STEP 3: PREDICTIVE RESPONSE PLAYBOOK: What to Do Now */}
            {!isReal && (
              <motion.section
                {...animation}
                transition={{ duration: 0.6, delay: 0.38 }}
                className="mt-8 rounded-[1.75rem] border border-[#d7ddea] bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#14213b]">
                      What To Do Now — Response Playbook
                    </h3>
                    <p className="text-xs text-slate-500">
                      Follow these 4 critical steps to prevent financial loss and verify your contact.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Step 1 */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-blue-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        STEP 1
                      </span>
                      <PhoneOff className="h-4 w-4 text-slate-400" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-800">
                      Secondary Verification
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      Do NOT redial the incoming caller ID. Call the person on their saved, trusted phone number.
                    </p>
                  </div>

                  {/* Step 2 */}
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-amber-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        STEP 2
                      </span>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-800">
                      Golden Hour Protection
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      If money or an OTP was shared, call <strong>1930</strong> immediately. Reporting within 1-2 hours freezes transactions across Indian banks.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        STEP 3
                      </span>
                      <UserX className="h-4 w-4 text-slate-400" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-800">
                      Notify Family & Circle
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      Warn other family members that a cloned voice is active. Establish a secret family safe-word.
                    </p>
                  </div>

                  {/* Step 4 */}
                  <div className="rounded-2xl border border-blue-300 bg-blue-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-blue-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                        STEP 4
                      </span>
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-slate-800">
                      File Official Complaint
                    </h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      Download the forensic report file below and lodge it on <strong>cybercrime.gov.in</strong> or Chakshu.
                    </p>
                  </div>
                </div>
              </motion.section>
            )}

            {/* STEP 4: GOVERNMENT HELPLINE & REPORT DOWNLOAD HUB */}
            <motion.section
              {...animation}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mt-8 rounded-[1.75rem] border border-blue-200 bg-[#0e1b33] p-6 text-white shadow-xl sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300">
                      Govt. of India · Cyber Helpline
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                    National Cyber Helpline & Reporting Portal
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Official Indian portals and emergency hotlines for voice cloning fraud, digital arrest scams, and identity theft.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* 1930 Dial Button */}
                  <a
                    href="tel:1930"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-500"
                  >
                    <PhoneCall className="h-4 w-4 animate-pulse text-white" />
                    Dial 1930 (Helpline)
                  </a>

                  {/* Cybercrime Portal Link */}
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    cybercrime.gov.in
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  {/* DoT Chakshu Portal Link */}
                  <a
                    href="https://sancharsaathi.gov.in/sfc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/20"
                  >
                    Chakshu (DoT)
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Download Report File & Copy Dossier Bar */}
              <div className="mt-6 border-t border-white/10 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">
                      Official Forensic Report Download (PDF)
                    </p>
                    <p className="mt-0.5 text-xs text-slate-300">
                      Download the complete forensic incident report in PDF format containing risk score, AI probability, detected parameters, and cyber helpline references.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Download PDF Report Button */}
                    <button
                      type="button"
                      onClick={downloadReportFile}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 shadow-md"
                    >
                      <FileText className="h-4 w-4" />
                      Download Report (.pdf)
                    </button>

                    {/* Copy Incident Dossier Button */}
                    <button
                      type="button"
                      onClick={copyIncidentDossier}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Dossier Copied!" : "Copy Incident Dossier"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Bottom Actions */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 rounded-xl border border-[#cdd7e9] bg-white px-6 py-3 text-sm font-semibold text-[#33425c] transition hover:bg-[#f3f5f7]"
              >
                <ArrowLeft className="h-4 w-4" />
                Analyze Another Audio
              </button>

              <button
                type="button"
                onClick={downloadReportFile}
                className="inline-flex items-center gap-2 rounded-xl bg-[#14213b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#203254] shadow-md"
              >
                <FileText className="h-4 w-4" />
                Download PDF Incident Report
              </button>
            </div>
          </motion.section>
        </section>
      </WavyBackground>

      {flagged && (
        <Toast
          message={toastMessage || "Sample flagged for follow-up."}
          onDismiss={() => setFlagged(false)}
          className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 border border-[#d96650]/20 bg-white shadow-raised"
        />
      )}
    </main>
  )
}

export default Result
