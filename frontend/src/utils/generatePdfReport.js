import { jsPDF } from "jspdf"

/**
 * Generates an official Voice Shield Call Verification & Incident Report.
 * Clean, spacious, uncrowded layout with consistent light blue theme,
 * bold black headings, dynamic risk-tier color coding, and no redundant next-steps.
 */
export function generatePdfReport({
  reportId = `VS-REP-${Date.now().toString().slice(-6)}`,
  timestamp = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
  audioSource = "Incoming Call Audio",
  classification = "Likely AI-cloned voice",
  riskScore = 85,
  confidencePercent = 94,
  isReal = false,
  isImpersonation = false,
  callerRelationship = "no",
  intercepted = true,
  forensicParameters = [],
  summary = "",
} = {}) {
  // Initialize A4 portrait document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const margin = 16
  const contentWidth = pageWidth - margin * 2 // 178mm

  // Determine Risk Tier and Colors
  const isHighRisk = !isReal && (riskScore >= 70 || riskScore >= 60)
  const isMediumRisk = !isReal && !isHighRisk

  const riskTier = isReal
    ? { level: "LOW RISK", color: [22, 163, 74], bg: [240, 253, 244], border: [134, 239, 172] }
    : isHighRisk
    ? { level: "HIGH RISK", color: [220, 38, 38], bg: [254, 242, 242], border: [248, 113, 113] }
    : { level: "MEDIUM RISK", color: [217, 119, 6], bg: [254, 243, 199], border: [251, 191, 36] }

  // 1. Consistent Subtle Light Blue Background for entire page
  doc.setFillColor(245, 248, 254) // #f5f8fe
  doc.rect(0, 0, pageWidth, 297, "F")

  let currentY = 16

  // 2. Clean Executive Header Banner
  doc.setFillColor(15, 29, 58) // #0f1d3a
  doc.roundedRect(margin, currentY, contentWidth, 24, 2.5, 2.5, "F")

  // Brand Name
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text("VOICE SHIELD", margin + 8, currentY + 8.5)

  // Report Title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.setTextColor(224, 242, 254) // #e0f2fe
  doc.text("Call Verification & Security Report", margin + 8, currentY + 14)

  // Subtitle
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(147, 197, 253) // #93c5fd
  doc.text(
    "Automated Audio Authenticity Analysis & Fraud Advisory",
    margin + 8,
    currentY + 19
  )

  // Badge on top right
  doc.setFillColor(30, 58, 110)
  doc.roundedRect(margin + contentWidth - 34, currentY + 7.5, 28, 9, 1.8, 1.8, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(224, 242, 254)
  doc.text("OFFICIAL REPORT", margin + contentWidth - 20, currentY + 13.5, { align: "center" })

  currentY += 32

  // 3. Call & Incident Metadata Block (Spacious, clean white card)
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(219, 234, 254) // #dbeafe
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, currentY, contentWidth, 19, 2.5, 2.5, "FD")

  // Metadata Labels
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(100, 116, 139) // Slate-500
  doc.text("REPORT ID", margin + 6, currentY + 6.5)
  doc.text("DATE & TIME", margin + 50, currentY + 6.5)
  doc.text("CALLER STATUS", margin + 100, currentY + 6.5)
  doc.text("CALL DURATION / STATUS", margin + 140, currentY + 6.5)

  // Metadata Values in Bold
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(15, 23, 42) // Deep Black
  doc.text(String(reportId).slice(0, 20), margin + 6, currentY + 13.5)
  doc.text(String(timestamp).slice(0, 20), margin + 50, currentY + 13.5)

  const isUnknownCaller = callerRelationship === "no" || (!isImpersonation && !isReal)
  if (isUnknownCaller) {
    doc.setTextColor(220, 38, 38)
    doc.text("UNKNOWN CALLER", margin + 100, currentY + 13.5)
  } else if (isImpersonation) {
    doc.setTextColor(220, 38, 38)
    doc.text("IMPERSONATION ATTEMPT", margin + 100, currentY + 13.5)
  } else {
    doc.setTextColor(22, 163, 74)
    doc.text("VERIFIED CONTACT", margin + 100, currentY + 13.5)
  }

  doc.setTextColor(15, 23, 42)
  doc.text(intercepted ? "Intercepted at 6s" : "Complete Call Analyzed", margin + 140, currentY + 13.5)

  currentY += 27

  // 4. Executive Threat Verdict & Risk Score Card (Spacious, breathing room)
  doc.setFillColor(riskTier.bg[0], riskTier.bg[1], riskTier.bg[2])
  doc.setDrawColor(riskTier.border[0], riskTier.border[1], riskTier.border[2])
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, currentY, contentWidth, 32, 3, 3, "FD")

  // Risk Score Badge on Left
  doc.setFillColor(riskTier.color[0], riskTier.color[1], riskTier.color[2])
  doc.roundedRect(margin + 6, currentY + 5, 38, 22, 2.5, 2.5, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(`${riskScore}/100`, margin + 25, currentY + 16, { align: "center" })
  doc.setFontSize(7)
  doc.text("RISK SCORE", margin + 25, currentY + 22, { align: "center" })

  // Classification & Threat Level in Bold Black
  doc.setTextColor(15, 23, 42) // Bold black
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.text(classification, margin + 50, currentY + 11)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(riskTier.color[0], riskTier.color[1], riskTier.color[2])
  doc.text(`THREAT LEVEL: ${riskTier.level}`, margin + 50, currentY + 17.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.8)
  doc.setTextColor(71, 85, 105)
  const summarySnippet =
    summary ||
    (isReal
      ? "The voice sample exhibits natural human vocal acoustics and normal background room sound."
      : isImpersonation
      ? "The caller claims familiarity, but synthetic voice generation patterns were detected with high urgency indicators."
      : "The audio exhibits synthetic speech characteristics with an unnaturally quiet background noise floor.")
  doc.text(doc.splitTextToSize(summarySnippet, contentWidth - 56).slice(0, 2), margin + 50, currentY + 24)

  currentY += 42

  // 5. Section: Evaluated Call Parameters (Clean, spacious table format)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text("EVALUATED CALL PARAMETERS", margin, currentY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  doc.text("Acoustic, frequency, and conversational parameters analyzed for this audio sample.", margin, currentY + 5)

  currentY += 8.5

  // Table Container (Clean white card with light blue border)
  const params =
    forensicParameters.length > 0
      ? forensicParameters
      : [
          {
            name: "Background Noise & Room Acoustics",
            value: !isReal ? "Unusually silent (no room ambience detected)" : "Normal background room ambience present",
            flagged: !isReal,
          },
          {
            name: "Pitch Dynamics & Voice Modulation",
            value: !isReal ? "Abnormal or flat pitch variation" : "Natural pitch modulation",
            flagged: !isReal,
          },
          {
            name: "Voice Frequency Spectrum",
            value: !isReal ? "Synthetic speech artifacts detected" : "Natural human speech frequencies",
            flagged: !isReal,
          },
          {
            name: "Call Context & Pressure Indicators",
            value: isImpersonation
              ? "Urgent financial demand / coercion pattern"
              : !isReal
              ? "Automated robocall pattern"
              : "Standard conversational tone",
            flagged: !isReal,
          },
        ]

  // Table Header Row
  doc.setFillColor(236, 243, 253) // Soft blue
  doc.roundedRect(margin, currentY, contentWidth, 9, 1.5, 1.5, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(30, 58, 110)
  doc.text("PARAMETER", margin + 6, currentY + 6)
  doc.text("FINDING FOR THIS AUDIO", margin + 66, currentY + 6)
  doc.text("EVALUATION", margin + contentWidth - 16, currentY + 6, { align: "center" })

  currentY += 9

  // Table Data Rows (Spacious 14mm height each)
  const rowHeight = 14
  params.forEach((p, idx) => {
    // Alternating clean row background
    doc.setFillColor(idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 251, idx % 2 === 0 ? 255 : 254)
    doc.rect(margin, currentY, contentWidth, rowHeight, "F")

    // Subtle divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.2)
    doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight)

    // Parameter Name in Bold Black
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(15, 23, 42)
    doc.text(p.name, margin + 6, currentY + 8)

    // Finding
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(p.flagged ? 185 : 71, p.flagged ? 28 : 85, p.flagged ? 28 : 105)
    const splitFinding = doc.splitTextToSize(p.value, 76)
    doc.text(splitFinding.slice(0, 2), margin + 66, currentY + (splitFinding.length > 1 ? 6 : 8))

    // Evaluation Badge
    if (p.flagged) {
      doc.setFillColor(254, 226, 226) // Soft Red
      doc.setDrawColor(248, 113, 113)
      doc.roundedRect(margin + contentWidth - 25, currentY + 4.2, 20, 5.8, 1.2, 1.2, "FD")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(6.5)
      doc.setTextColor(185, 28, 28) // Red
      doc.text("FLAGGED", margin + contentWidth - 15, currentY + 8.1, { align: "center" })
    } else {
      doc.setFillColor(220, 252, 231) // Soft Green
      doc.setDrawColor(134, 239, 172)
      doc.roundedRect(margin + contentWidth - 25, currentY + 4.2, 20, 5.8, 1.2, 1.2, "FD")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(6.5)
      doc.setTextColor(22, 101, 52) // Green
      doc.text("NORMAL", margin + contentWidth - 15, currentY + 8.1, { align: "center" })
    }

    currentY += rowHeight
  })

  currentY += 18

  // 6. Section: Official Assistance & Legal Notice (Spacious, clean box)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text("OFFICIAL ASSISTANCE & REGULATORY REFERENCES", margin, currentY)

  currentY += 5.5

  doc.setFillColor(241, 247, 255) // #f1f7ff light blue
  doc.setDrawColor(191, 219, 254) // #bfdbfe
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, currentY, contentWidth, 27, 2.5, 2.5, "FD")

  // Dial 1930 Helpline Badge
  doc.setFillColor(220, 38, 38) // Red
  doc.roundedRect(margin + 6, currentY + 5.5, 36, 8, 1.5, 1.5, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(255, 255, 255)
  doc.text("DIAL 1930 HELPLINE", margin + 24, currentY + 10.8, { align: "center" })

  // Portal texts
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(15, 23, 42)
  doc.text("National Cyber Crime Reporting Portal: cybercrime.gov.in", margin + 48, currentY + 8.5)
  doc.text("Department of Telecommunications (DoT) Chakshu Portal: sancharsaathi.gov.in/sfc/", margin + 48, currentY + 13)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.8)
  doc.setTextColor(71, 85, 105)
  doc.text(
    "Legal Reference: Information Technology Act 2000 (Section 66D - Cheating by Personation using Computer Resource),",
    margin + 6,
    currentY + 19.5
  )
  doc.text(
    "and applicable provisions under Indian law governing unauthorized voice synthesis and fraudulent calls.",
    margin + 6,
    currentY + 23.5
  )

  // 7. Clean Footer Bar (Pinned near bottom)
  const footerY = 282
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY, margin + contentWidth, footerY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(148, 163, 184)
  doc.text(
    "Voice Shield Call Verification System · Confidential User Incident Report",
    margin,
    footerY + 5
  )
  doc.setFont("helvetica", "bold")
  doc.text("PAGE 1 OF 1", margin + contentWidth - 16, footerY + 5)

  // Save the PDF file
  const fileName = `VoiceShield_Call_Report_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.pdf`
  doc.save(fileName)

  return fileName
}
