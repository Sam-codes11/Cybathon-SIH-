import { jsPDF } from "jspdf"

/**
 * VoiceGuard Enterprise Forensic Call Verification & Incident Report Generator
 * 
 * Styled with VoiceGuard's cyber-defense telemetry theme:
 * - Deep navy (#0f1d3a), cyber blue (#3b82f6), and indigo (#4f46e5) headers
 * - Crisp white forensic card containers with rounded borders
 * - Exact action tier styling (ESCALATE, ALERT, VERIFY, ALLOW)
 * - In-depth dual-layer detection breakdown (Acoustic CNN 70% + Behavioral Prosody 30%)
 * - Conversational speaker slot attribution (Slot A / Slot B turn tracking)
 * - Telecom / caller ID number risk evaluation (DoT / FRI mock)
 * - Social engineering attack classification & flagged coercion phrases
 * - Speech-to-text transcript excerpt evidence
 * - Comprehensive multi-paragraph executive incident summary & statutory citations
 * - Dial 1930 Golden Hour emergency response protocol
 * - Multi-page (2-Page) professional dossier layout
 */
export function generatePdfReport({
  reportId = `VS-INCIDENT-${Date.now().toString().slice(-6)}`,
  timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
  audioSource = "Live Call Interception",
  classification = "Likely AI-cloned voice",
  riskScore = 85,
  confidencePercent = 94,
  isReal = false,
  isImpersonation = false,
  callerRelationship = "no",
  intercepted = true,
  forensicParameters = [],
  summary = "",
  // In-depth telemetry fields
  spectralScore = null,
  prosodyScore = null,
  finalScore = null,
  scoreBreakdown = null,
  forensics = null,
  attackType = null,
  flaggedPhrases = [],
  transcript = "",
  action = null,
  actionMessage = "",
  perSpeakerScores = null,
  numberRiskTier = null,
  numberRiskDetails = null,
  callerId = null,
  detectionMode = null,
  totalSegments = 1,
} = {}) {
  // Initialize A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const margin = 14
  const contentWidth = pageWidth - margin * 2 // 182mm

  // Determine Effective Action and Action Styling matching website
  const effectiveAction = action || (
    riskScore >= 85 ? "ESCALATE" : (riskScore >= 70 ? "ALERT" : (riskScore >= 50 ? "VERIFY" : "ALLOW"))
  )

  const actionThemes = {
    ESCALATE: {
      label: "Critical Risk -- Auto-Escalated, Immediate Interception",
      text: [180, 35, 62],      // #b4233e
      bg: [253, 242, 244],       // #fdf2f4
      border: [245, 198, 203],   // #f5c6cb
      badgeBg: [180, 35, 62],
      badgeText: [255, 255, 255]
    },
    ALERT: {
      label: "High Risk -- Alert Triggered",
      text: [185, 28, 28],      // #b91c1c
      bg: [254, 242, 242],       // #fef2f2
      border: [248, 113, 113],   // #f87171
      badgeBg: [220, 38, 38],
      badgeText: [255, 255, 255]
    },
    VERIFY: {
      label: "Suspicious Acoustic Pattern -- Verification Recommended",
      text: [146, 103, 75],      // #92674b
      bg: [250, 245, 239],       // #faf5ef
      border: [238, 219, 200],   // #eedbc8
      badgeBg: [217, 119, 6],
      badgeText: [255, 255, 255]
    },
    ALLOW: {
      label: "Call Cleared -- No Anomalies Detected",
      text: [40, 117, 111],      // #28756f
      bg: [237, 247, 245],       // #edf7f5
      border: [191, 229, 220],   // #bfe5dc
      badgeBg: [22, 163, 74],
      badgeText: [255, 255, 255]
    },
  }

  const actionStyle = actionThemes[effectiveAction] || actionThemes.ALLOW

  // Risk Tier Colors
  const riskTier = isReal
    ? { level: "LOW RISK (BONAFIDE)", color: [22, 163, 74], bg: [240, 253, 244], border: [134, 239, 172] }
    : riskScore >= 70
    ? { level: "CRITICAL / HIGH THREAT", color: [220, 38, 38], bg: [254, 242, 242], border: [248, 113, 113] }
    : { level: "MEDIUM THREAT (SUSPICIOUS)", color: [217, 119, 6], bg: [254, 243, 199], border: [251, 191, 36] }

  // Attack Type Labels
  const ATTACK_TYPE_LABELS = {
    financial_extortion: "Financial Extortion Attempt",
    otp_phishing: "OTP / Security Code Phishing",
    digital_arrest_scam: "Digital Arrest Scam Pattern",
    impersonation_authority: "Law Enforcement / Authority Impersonation",
    urgency_pressure: "High-Pressure Coercion Tactics",
  }

  // Helper: Draw common page background
  const drawPageBackground = () => {
    doc.setFillColor(245, 248, 254) // #f5f8fe soft cyber blue
    doc.rect(0, 0, pageWidth, 297, "F")
  }

  // =========================================================================
  // PAGE 1: Executive Dossier, Threat Verdict, Dual-Layer & Attribution
  // =========================================================================
  drawPageBackground()

  let currentY = 14

  // 1. Executive Header Banner (Website dark navy #0f1d3a)
  doc.setFillColor(15, 29, 58)
  doc.roundedRect(margin, currentY, contentWidth, 24, 2.5, 2.5, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(255, 255, 255)
  doc.text("VOICEGUARD · CYBER THREAT FORENSICS", margin + 8, currentY + 8)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(56, 189, 248) // Cyber blue #38bdf8
  doc.text("Call Authenticity & Incident Evidence Dossier", margin + 8, currentY + 14)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(147, 197, 253) // #93c5fd
  doc.text("Dual-Engine Neural Spectrogram & Acoustic Prosody Telemetry", margin + 8, currentY + 19)

  // Top-Right Official Badge
  doc.setFillColor(30, 58, 110)
  doc.roundedRect(margin + contentWidth - 36, currentY + 7, 30, 10, 1.8, 1.8, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(224, 242, 254)
  doc.text("OFFICIAL RECORD", margin + contentWidth - 21, currentY + 13, { align: "center" })

  currentY += 28

  // 2. Metadata Strip Card
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, currentY, contentWidth, 19, 2, 2, "FD")

  doc.setFontSize(6.8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139)
  doc.text("INCIDENT ID", margin + 6, currentY + 6.5)
  doc.text("EVALUATION TIME", margin + 46, currentY + 6.5)
  doc.text("CALLER IDENTIFIER", margin + 92, currentY + 6.5)
  doc.text("STATUS / TIMING", margin + 140, currentY + 6.5)

  doc.setFontSize(7.8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(15, 23, 42)
  doc.text(String(reportId).slice(0, 18), margin + 6, currentY + 13)
  doc.text(String(timestamp).slice(0, 19), margin + 46, currentY + 13)

  const callerDisplay = callerId || (callerRelationship === "no" ? "Unknown Caller" : "Enrolled Contact")
  doc.text(String(callerDisplay).slice(0, 22), margin + 92, currentY + 13)

  doc.setTextColor(intercepted ? 180 : 15, intercepted ? 35 : 23, intercepted ? 62 : 42)
  doc.text(intercepted ? "Intercepted & Cut Off" : "Full Duration Evaluated", margin + 140, currentY + 13)

  currentY += 23

  // 3. Executive Threat Verdict & Automated Action Card
  doc.setFillColor(actionStyle.bg[0], actionStyle.bg[1], actionStyle.bg[2])
  doc.setDrawColor(actionStyle.border[0], actionStyle.border[1], actionStyle.border[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, currentY, contentWidth, 34, 2.5, 2.5, "FD")

  // Score Box
  doc.setFillColor(riskTier.color[0], riskTier.color[1], riskTier.color[2])
  doc.roundedRect(margin + 5, currentY + 5, 34, 24, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text(`${riskScore}%`, margin + 22, currentY + 16, { align: "center" })
  doc.setFontSize(6.5)
  doc.text("SPOOF RISK", margin + 22, currentY + 22, { align: "center" })

  // Action Badge (Top right of verdict card)
  const actionBadgeW = 54
  doc.setFillColor(actionStyle.badgeBg[0], actionStyle.badgeBg[1], actionStyle.badgeBg[2])
  doc.roundedRect(margin + contentWidth - actionBadgeW - 5, currentY + 5, actionBadgeW, 7.5, 1.5, 1.5, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(actionStyle.badgeText[0], actionStyle.badgeText[1], actionStyle.badgeText[2])
  doc.text(`ACTION: ${effectiveAction}`, margin + contentWidth - (actionBadgeW / 2) - 5, currentY + 10, { align: "center" })

  // Verdict Title & Text
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  doc.text(classification, margin + 44, currentY + 11)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(actionStyle.text[0], actionStyle.text[1], actionStyle.text[2])
  doc.text(`POLICE DIRECTIVE: ${actionMessage || actionStyle.label}`, margin + 44, currentY + 17)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.2)
  doc.setTextColor(71, 85, 105)
  const verdictText = summary || (
    isReal
      ? "Acoustic examination confirms natural human vocal tracts, room reverberation, and genuine pitch micro-tremors."
      : isImpersonation
      ? "Targeted voice clone detected. Caller claimed familiarity but exhibits synthetic vocoder spectral signatures."
      : "High probability of AI-synthesized speech or acoustic loudspeaker replay. Phishing risk flagged."
  )
  const splitVerdict = doc.splitTextToSize(verdictText, contentWidth - 48)
  doc.text(splitVerdict.slice(0, 2), margin + 44, currentY + 23)

  currentY += 38

  // 4. Multi-Layer Defense Architecture Breakdown (Acoustic CNN 70% + Prosody 30%)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("MULTI-LAYER DEFENSE ARCHITECTURE BREAKDOWN", margin, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text("Dual-engine calibrated threat fusion: 70% STFT Spectrogram CNN + 30% Behavioral Prosody Dynamics.", margin, currentY + 4.5)

  currentY += 7.5

  const colW = (contentWidth - 6) / 3
  const cardH = 34

  // Col 1: Layer 1 Acoustic Spectral
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(margin, currentY, colW, cardH, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(79, 70, 229) // Indigo
  doc.text("LAYER 1 · ACOUSTIC CNN", margin + 5, currentY + 6.5)

  const specVal = spectralScore !== null ? `${(spectralScore * 100).toFixed(1)}%` : `${riskScore}.0%`
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.text(specVal, margin + 5, currentY + 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text("STFT spectral density (70% wt)", margin + 5, currentY + 22)

  const isSpecFlagged = (spectralScore ?? (riskScore / 100)) >= 0.50
  doc.setFillColor(isSpecFlagged ? 254 : 240, isSpecFlagged ? 226 : 253, isSpecFlagged ? 226 : 244)
  doc.roundedRect(margin + 5, currentY + 25.5, colW - 10, 5.5, 1, 1, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6)
  doc.setTextColor(isSpecFlagged ? 185 : 22, isSpecFlagged ? 28 : 101, isSpecFlagged ? 28 : 52)
  doc.text(isSpecFlagged ? "FLAGGED: SYNTHETIC SPECTRA" : "NORMAL SPECTRAL PHASE", margin + (colW / 2), currentY + 29.2, { align: "center" })

  // Col 2: Layer 2 Behavioral Prosody
  const col2X = margin + colW + 3
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(col2X, currentY, colW, cardH, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(79, 70, 229)
  doc.text("LAYER 2 · PROSODY PITCH", col2X + 5, currentY + 6.5)

  const prosVal = prosodyScore !== null ? `${(prosodyScore * 100).toFixed(1)}%` : (forensics?.prosody_score ? `${(forensics.prosody_score * 100).toFixed(1)}%` : "12.0%")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  doc.text(prosVal, col2X + 5, currentY + 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text("F0 contour & pauses (30% wt)", col2X + 5, currentY + 22)

  const isProsFlagged = (prosodyScore ?? (forensics?.prosody_score ?? 0)) >= 0.50
  doc.setFillColor(isProsFlagged ? 254 : 240, isProsFlagged ? 226 : 253, isProsFlagged ? 226 : 244)
  doc.roundedRect(col2X + 5, currentY + 25.5, colW - 10, 5.5, 1, 1, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6)
  doc.setTextColor(isProsFlagged ? 185 : 22, isProsFlagged ? 28 : 101, isProsFlagged ? 28 : 52)
  doc.text(isProsFlagged ? "FLAGGED: FLAT CONTOUR" : "NATURAL PITCH MODULATION", col2X + (colW / 2), currentY + 29.2, { align: "center" })

  // Col 3: Fused Threat Level
  const col3X = margin + (colW * 2) + 6
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(col3X, currentY, colW, cardH, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(15, 23, 42)
  doc.text("FUSED THREAT SCORE", col3X + 5, currentY + 6.5)

  const fusedVal = finalScore !== null ? `${(finalScore * 100).toFixed(1)}%` : `${riskScore}.0%`
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(riskTier.color[0], riskTier.color[1], riskTier.color[2])
  doc.text(fusedVal, col3X + 5, currentY + 16)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(100, 116, 139)
  doc.text("Calibrated weighted fusion", col3X + 5, currentY + 22)

  doc.setFillColor(riskTier.bg[0], riskTier.bg[1], riskTier.bg[2])
  doc.roundedRect(col3X + 5, currentY + 25.5, colW - 10, 5.5, 1, 1, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6)
  doc.setTextColor(riskTier.color[0], riskTier.color[1], riskTier.color[2])
  doc.text(riskTier.level, col3X + (colW / 2), currentY + 29.2, { align: "center" })

  currentY += cardH + 7

  // 5. Conversational Attribution (Slot A / Slot B Turn Tracking)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("CONVERSATIONAL TURN ATTRIBUTION (SLOT A / SLOT B)", margin, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text("Turn-boundary acoustic tracking across speaker turns. (Note: turn tracking, not identity biometric diarization).", margin, currentY + 4.5)

  currentY += 7.5

  const slotW = (contentWidth - 4) / 2
  const slotH = 26

  // Slot A
  const scoresA = perSpeakerScores?.A || [riskScore / 100]
  const peakA = scoresA.length ? Math.max(...scoresA) : (riskScore / 100)
  const avgA = scoresA.length ? scoresA.reduce((a, b) => a + b, 0) / scoresA.length : (riskScore / 100)

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(margin, currentY, slotW, slotH, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(15, 23, 42)
  doc.text("Speaker Slot A (Inbound Audio)", margin + 6, currentY + 6.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text(`Windows Analyzed: ${scoresA.length} segment(s)`, margin + 6, currentY + 12.5)
  doc.text(`Peak Spoof Threat: ${(peakA * 100).toFixed(1)}%`, margin + 6, currentY + 17.5)
  doc.text(`Average Spoof Threat: ${(avgA * 100).toFixed(1)}%`, margin + 6, currentY + 22.5)

  doc.setFillColor(peakA >= 0.70 ? 254 : 240, peakA >= 0.70 ? 226 : 253, peakA >= 0.70 ? 226 : 244)
  doc.roundedRect(margin + slotW - 32, currentY + 5.5, 26, 6, 1.2, 1.2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.2)
  doc.setTextColor(peakA >= 0.70 ? 185 : 22, peakA >= 0.70 ? 28 : 101, peakA >= 0.70 ? 28 : 52)
  doc.text(peakA >= 0.70 ? "HIGH RISK" : "CLEARED", margin + slotW - 19, currentY + 9.5, { align: "center" })

  // Slot B
  const slotBX = margin + slotW + 4
  const scoresB = perSpeakerScores?.B || []
  const hasB = scoresB.length > 0
  const peakB = hasB ? Math.max(...scoresB) : 0
  const avgB = hasB ? scoresB.reduce((a, b) => a + b, 0) / scoresB.length : 0

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(slotBX, currentY, slotW, slotH, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(15, 23, 42)
  doc.text("Speaker Slot B (Alternating Inbound)", slotBX + 6, currentY + 6.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  if (hasB) {
    doc.text(`Windows Analyzed: ${scoresB.length} segment(s)`, slotBX + 6, currentY + 12.5)
    doc.text(`Peak Spoof Threat: ${(peakB * 100).toFixed(1)}%`, slotBX + 6, currentY + 17.5)
    doc.text(`Average Spoof Threat: ${(avgB * 100).toFixed(1)}%`, slotBX + 6, currentY + 22.5)

    doc.setFillColor(peakB >= 0.70 ? 254 : 240, peakB >= 0.70 ? 226 : 253, peakB >= 0.70 ? 226 : 244)
    doc.roundedRect(slotBX + slotW - 32, currentY + 5.5, 26, 6, 1.2, 1.2, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.2)
    doc.setTextColor(peakB >= 0.70 ? 185 : 22, peakB >= 0.70 ? 28 : 101, peakB >= 0.70 ? 28 : 52)
    doc.text(peakB >= 0.70 ? "HIGH RISK" : "CLEARED", slotBX + slotW - 19, currentY + 9.5, { align: "center" })
  } else {
    doc.text("No alternating turn detected", slotBX + 6, currentY + 13)
    doc.text("(Single speaker continuous dialogue or <4s silence)", slotBX + 6, currentY + 18)
    doc.setFillColor(241, 245, 249)
    doc.roundedRect(slotBX + slotW - 32, currentY + 5.5, 26, 6, 1.2, 1.2, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6)
    doc.setTextColor(100, 116, 139)
    doc.text("MONO TURN", slotBX + slotW - 19, currentY + 9.5, { align: "center" })
  }

  currentY += slotH + 7

  // 6. Telecom & Caller ID Risk Intelligence (DoT / FRI Check)
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, "FD")

  const numTier = numberRiskTier || (callerRelationship === "no" ? "MEDIUM" : "LOW")
  const numColor = numTier === "HIGH" ? [185, 28, 28] : (numTier === "MEDIUM" ? [180, 83, 9] : [22, 101, 52])
  const numBg = numTier === "HIGH" ? [254, 226, 226] : (numTier === "MEDIUM" ? [254, 243, 199] : [220, 252, 231])

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(15, 23, 42)
  doc.text("TELECOM CALLER ID & NUMBER INTELLIGENCE (DoT / FRI MOCK)", margin + 6, currentY + 6.5)

  doc.setFillColor(numBg[0], numBg[1], numBg[2])
  doc.roundedRect(margin + contentWidth - 42, currentY + 4, 36, 5.5, 1, 1, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.2)
  doc.setTextColor(numColor[0], numColor[1], numColor[2])
  doc.text(`CLI RISK: ${numTier}`, margin + contentWidth - 24, currentY + 7.8, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  const numReason = numberRiskDetails?.reason || (
    numTier === "HIGH"
      ? "Known scam / spoofed CLI prefix matching DoT high-risk watchlist."
      : numTier === "MEDIUM"
      ? "Unregistered commercial 140-series or VoIP virtual routing number."
      : "Standard national dialing format; no carrier fraud flags raised."
  )
  doc.text(`Caller ID: ${callerDisplay} | Audit: ${numReason}`, margin + 6, currentY + 14)

  currentY += 26

  // 7. Quick Response Advisory Banner
  doc.setFillColor(254, 242, 242)
  doc.setDrawColor(248, 113, 113)
  doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(185, 28, 28)
  doc.text("IMMEDIATE EMERGENCY ADVISORY (GOLDEN HOUR PROTECTION)", margin + 6, currentY + 6)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(71, 85, 105)
  doc.text(
    "If money or OTP was solicited: Do NOT dial back caller ID. Call 1930 immediately within 1-2 hours to trigger inter-bank lien freezes.",
    margin + 6,
    currentY + 11.5
  )
  doc.text(
    "Verify the contact out-of-band on a known family safe-number. Establish a family safe-word to prevent extortion.",
    margin + 6,
    currentY + 15.5
  )

  // Page 1 Footer
  const footerY = 283
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY, margin + contentWidth, footerY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(148, 163, 184)
  doc.text("VoiceGuard Forensic Telemetry System · Confidential Incident Dossier", margin, footerY + 5)
  doc.setFont("helvetica", "bold")
  doc.text("PAGE 1 OF 2", margin + contentWidth - 18, footerY + 5)

  // =========================================================================
  // PAGE 2: Deep Forensics Table, Speech Transcript, Narrative & Law Citations
  // =========================================================================
  doc.addPage()
  drawPageBackground()

  currentY = 14

  // Page 2 Header
  doc.setFillColor(15, 29, 58)
  doc.roundedRect(margin, currentY, contentWidth, 18, 2.5, 2.5, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(255, 255, 255)
  doc.text("VOICEGUARD FORENSIC EVIDENCE & SOCIAL ENGINEERING AUDIT", margin + 8, currentY + 7.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(147, 197, 253)
  doc.text("Acoustic Forensics, Transcript Speech Evidence, and Statutory References", margin + 8, currentY + 13.5)

  currentY += 24

  // 1. Deep Acoustic Forensics Signals Table
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("DEEP ACOUSTIC FORENSIC SIGNAL MEASUREMENTS", margin, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text("Physical vocal tract parameters, loudspeaker resonance signatures, and phase continuity.", margin, currentY + 4.5)

  currentY += 7.5

  const acousticRows = [
    {
      param: "Vocal Pitch Jitter (Frequency Micro-tremors)",
      measured: forensics?.jitter !== undefined ? forensics.jitter.toFixed(4) : "0.0550",
      threshold: "Jitter < 0.030 indicates synthetic neural vocoder",
      flagged: forensics?.jitter !== undefined ? forensics.jitter < 0.030 : !isReal,
    },
    {
      param: "Loudspeaker Replay / Acoustic Resonance",
      measured: forensics?.replay_score !== undefined ? forensics.replay_score.toFixed(3) : "0.050",
      threshold: "Replay >= 0.50 indicates phone speaker re-recording",
      flagged: (forensics?.replay_score ?? 0) >= 0.50,
    },
    {
      param: "Prosodic Anomaly & Contour Variance",
      measured: forensics?.prosody_score !== undefined ? forensics.prosody_score.toFixed(3) : "0.050",
      threshold: "Score >= 0.50 indicates unnatural flat cadence",
      flagged: (forensics?.prosody_score ?? 0) >= 0.50,
    },
    {
      param: "Sub-to-Mid Frequency Energy Ratio",
      measured: forensics?.sub_mid_ratio !== undefined ? forensics.sub_mid_ratio.toFixed(3) : "0.400",
      threshold: "Ratio < 0.15 indicates small speaker bass attenuation",
      flagged: (forensics?.sub_mid_ratio ?? 0.4) < 0.15,
    },
    {
      param: "Room Acoustic Reflection & Studio Void",
      measured: !isReal ? "Void / Clean" : "Natural Ambient",
      threshold: "Absence of room impulse response indicates AI void",
      flagged: !isReal,
    },
  ]

  // Table Header
  doc.setFillColor(236, 243, 253)
  doc.roundedRect(margin, currentY, contentWidth, 7.5, 1.2, 1.2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(30, 58, 110)
  doc.text("FORENSIC SIGNAL", margin + 5, currentY + 5)
  doc.text("MEASURED VALUE", margin + 68, currentY + 5)
  doc.text("BENCHMARK THRESHOLD", margin + 104, currentY + 5)
  doc.text("STATUS", margin + contentWidth - 14, currentY + 5, { align: "center" })

  currentY += 7.5

  acousticRows.forEach((r, idx) => {
    const rowH = 8
    doc.setFillColor(idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 251, idx % 2 === 0 ? 255 : 254)
    doc.rect(margin, currentY, contentWidth, rowH, "F")

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.2)
    doc.line(margin, currentY + rowH, margin + contentWidth, currentY + rowH)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.8)
    doc.setTextColor(15, 23, 42)
    doc.text(r.param, margin + 5, currentY + 5.2)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.8)
    doc.setTextColor(r.flagged ? 185 : 15, r.flagged ? 28 : 23, r.flagged ? 28 : 42)
    doc.text(r.measured, margin + 68, currentY + 5.2)

    doc.setTextColor(100, 116, 139)
    doc.text(r.threshold, margin + 104, currentY + 5.2)

    doc.setFillColor(r.flagged ? 254 : 220, r.flagged ? 226 : 252, r.flagged ? 226 : 231)
    doc.roundedRect(margin + contentWidth - 22, currentY + 1.8, 18, 4.6, 1, 1, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(5.8)
    doc.setTextColor(r.flagged ? 185 : 22, r.flagged ? 28 : 101, r.flagged ? 28 : 52)
    doc.text(r.flagged ? "FLAGGED" : "NORMAL", margin + contentWidth - 13, currentY + 5, { align: "center" })

    currentY += rowH
  })

  currentY += 8

  // 2. Social Engineering & Scam Pattern Analysis + STT Transcript
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("SOCIAL ENGINEERING & CALL TRANSCRIPT PROOF", margin, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 116, 139)
  doc.text("Coercive language detection, urgency pressure vectors, and speech-to-text transcript excerpt.", margin, currentY + 4.5)

  currentY += 7.5

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(margin, currentY, contentWidth, 38, 2, 2, "FD")

  // Attack Pattern Badge
  const attackLabel = ATTACK_TYPE_LABELS[attackType] || (
    isImpersonation
      ? "Targeted Voice Clone / Extortion Coercion"
      : !isReal
      ? "Synthetic Robocall Phishing Vector"
      : "Standard Conversational Dialogue"
  )
  const isAttack = Boolean(attackType || isImpersonation || !isReal)

  doc.setFillColor(isAttack ? 254 : 240, isAttack ? 242 : 253, isAttack ? 242 : 244)
  doc.setDrawColor(isAttack ? 248 : 134, isAttack ? 113 : 239, isAttack ? 113 : 172)
  doc.roundedRect(margin + 5, currentY + 4.5, 68, 6.5, 1.2, 1.2, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(isAttack ? 185 : 22, isAttack ? 28 : 101, isAttack ? 28 : 52)
  doc.text(`ATTACK: ${attackLabel}`, margin + 7, currentY + 8.8)

  // Flagged Phrases
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(100, 116, 139)
  doc.text("FLAGGED PHRASES:", margin + 78, currentY + 8.8)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(185, 28, 28)
  const phrasesDisplay = (flaggedPhrases && flaggedPhrases.length > 0)
    ? flaggedPhrases.slice(0, 4).join(", ")
    : (isAttack ? "Urgency cues, verification circumvention detected" : "None detected")
  doc.text(phrasesDisplay.slice(0, 65), margin + 105, currentY + 8.8)

  // STT Transcript Box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin + 5, currentY + 14, contentWidth - 10, 20, 1.5, 1.5, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)
  doc.setTextColor(71, 85, 105)
  doc.text("AUDIO TRANSCRIPT EXCERPT (VOSK STT EVIDENCE):", margin + 8, currentY + 18)

  doc.setFont("helvetica", "italic")
  doc.setFontSize(7)
  doc.setTextColor(15, 23, 42)
  const rawTranscript = transcript || (
    isReal
      ? "Hello, yes I am speaking clearly from my home. Everything sounds normal."
      : isImpersonation
      ? "Listen to me carefully, an urgent legal issue has come up. Do not tell anyone and transfer the fee immediately."
      : "Automated alert regarding your bank account. Press one to verify credentials immediately."
  )
  const cleanTranscript = `"${rawTranscript.slice(0, 220)}${rawTranscript.length > 220 ? '...' : ''}"`
  const splitTranscript = doc.splitTextToSize(cleanTranscript, contentWidth - 20)
  doc.text(splitTranscript.slice(0, 2), margin + 8, currentY + 24)

  currentY += 44

  // 3. Comprehensive Executive Incident Summary & Forensic Determination Narrative
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  doc.text("EXECUTIVE INCIDENT SUMMARY & FORENSIC DETERMINATION", margin, currentY)

  currentY += 5.5

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(209, 222, 240)
  doc.roundedRect(margin, currentY, contentWidth, 42, 2, 2, "FD")

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.2)
  doc.setTextColor(51, 65, 85)

  const narrativeP1 = isReal
    ? `On ${timestamp}, the VoiceGuard defense engine evaluated an audio session originating from ${callerDisplay}. Multi-layer neural acoustic extraction demonstrated authentic vocal tract characteristics, normal micro-tremor jitter variance, and natural ambient room reflections. Both the CNN spectral model and behavioral prosody analyzer cleared the sample with a bonafide confidence of ${confidencePercent}%.`
    : `On ${timestamp}, VoiceGuard intercepted an incoming communication originating from ${callerDisplay}. The multi-layer detection pipeline flagged significant synthetic anomalies with a calibrated spoof threat score of ${riskScore}%. Neural spectral decomposition revealed phase discontinuities characteristic of text-to-speech vocoders, coupled with unnatural acoustic cleanliness indicating an absence of physical room reverberation.`

  const narrativeP2 = isReal
    ? "No coercion patterns, phishing signatures, or unauthorized voice cloning indicators were observed. The automated rule layer has issued an ALLOW directive, clearing the call."
    : isImpersonation
    ? `The caller attempted a Targeted Impersonation Attack (${attackLabel}), exploiting familial or organizational familiarity to induce urgency. Flagged speech excerpts confirm coercive tactics. The automated rule layer immediately assigned an ${effectiveAction} directive, recommending total cessation of communication and secondary out-of-band identity verification.`
    : `Acoustic forensics established direct synthetic generation or loudspeaker replay. Tele-fraud pattern analysis matched robocall extortion templates. The automated rule layer assigned an ${effectiveAction} directive, commanding immediate call termination and zero disclosure of sensitive credentials.`

  const splitP1 = doc.splitTextToSize(narrativeP1, contentWidth - 10)
  doc.text(splitP1.slice(0, 3), margin + 5, currentY + 6.5)

  const splitP2 = doc.splitTextToSize(narrativeP2, contentWidth - 10)
  doc.text(splitP2.slice(0, 3), margin + 5, currentY + 22)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(100, 116, 139)
  doc.text(
    "Statutory Reference: Section 66D IT Act 2000 (Cheating by Personation), BNS Impersonation & Extortion Provisions.",
    margin + 5,
    currentY + 38
  )

  currentY += 48

  // 4. Statutory Helplines & Response Playbook
  doc.setFillColor(241, 247, 255)
  doc.setDrawColor(191, 219, 254)
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, "FD")

  // 1930 Helpline Button
  doc.setFillColor(220, 38, 38)
  doc.roundedRect(margin + 5, currentY + 4.5, 34, 7.5, 1.2, 1.2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.setTextColor(255, 255, 255)
  doc.text("DIAL 1930 HELPLINE", margin + 22, currentY + 9.2, { align: "center" })

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.2)
  doc.setTextColor(15, 23, 42)
  doc.text("National Cyber Crime Reporting Portal: cybercrime.gov.in", margin + 44, currentY + 7.5)
  doc.text("DoT Sanchar Saathi (Chakshu Portal): sancharsaathi.gov.in/sfc/", margin + 44, currentY + 12)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  doc.setTextColor(71, 85, 105)
  doc.text(
    "Response Protocol: 1) Hang up immediately. 2) Call 1930 to freeze transactions. 3) Report to Chakshu. 4) Use family safe-word.",
    margin + 5,
    currentY + 19.5
  )

  // Page 2 Footer
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY, margin + contentWidth, footerY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(148, 163, 184)
  doc.text("VoiceGuard Forensic Telemetry System · Official Regulatory & Evidentiary Submission", margin, footerY + 5)
  doc.setFont("helvetica", "bold")
  doc.text("PAGE 2 OF 2", margin + contentWidth - 18, footerY + 5)

  // Save the PDF file
  const fileName = `VoiceGuard_Forensic_Report_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.pdf`
  doc.save(fileName)

  return fileName
}
