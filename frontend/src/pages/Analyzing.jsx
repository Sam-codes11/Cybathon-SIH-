import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { AudioLines, Check, Mic, ScanLine, ShieldCheck, Terminal, AlertTriangle, ShieldAlert, PhoneOff, PhoneCall } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import WaveformVerdict from "../components/WaveformVerdict"
import { WavyBackground } from "../components/WavyBackground"
import ImpersonationAlertModal from "../components/ImpersonationAlertModal"

// Change this one value when the desired microphone capture duration changes.
const RECORDING_DURATION = 10

const checkSilence = async (blob) => {
  const context = new AudioContext()
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer())
    const samples = audio.getChannelData(0)
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
    return rms < 0.01
  } finally {
    await context.close()
  }
}

const getWebSocketUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
  return `${protocol}//${host}:8000/audio-stream`
}

const normaliseReport = (data, fallbackSeconds) => {
  const spoofProbability = Number(data.spoof_probability ?? data.max_spoof_probability ?? 0)
  const isSpoof = data.result ? data.result === "spoof" : spoofProbability >= 0.50
  const confidence = Number(data.confidence ?? (isSpoof ? spoofProbability : 1 - spoofProbability))
  const risk = data.risk ?? (spoofProbability >= 0.70 ? "HIGH" : spoofProbability >= 0.50 ? "MEDIUM" : "LOW")

  return {
    ...data,
    spoof_probability: spoofProbability,
    confidence,
    risk,
    result: isSpoof ? "spoof" : "real",
    elapsed_seconds: data.elapsed_seconds ?? fallbackSeconds,
    forensics: data.forensics || { replay_score: 0.05, prosody_score: 0.05 },
    attack_type: data.attack_type ?? null,
    flagged_phrases: data.flagged_phrases ?? [],
  }
}

function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_DURATION)
  const [errorMessage, setErrorMessage] = useState("")
  const [reports, setReports] = useState([])
  const [liveReport, setLiveReport] = useState(null)
  
  // Early 4-second Interceptor State
  const [earlyAlertOpen, setEarlyAlertOpen] = useState(false)
  const [earlyAlertData, setEarlyAlertData] = useState(null)
  const [callerRelationship, setCallerRelationship] = useState(null)
  const [challengeModeActive, setChallengeModeActive] = useState(false)

  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const latestReportRef = useRef(null)
  const reportsRef = useRef([])
  const consoleRef = useRef(null)
  const earlyAlertTriggeredRef = useRef(false)
  const earlyAlertOpenRef = useRef(false)
  const callerRelationshipRef = useRef(null)
  const disposeAudioRef = useRef(null)
  const handleCutCallRef = useRef(null)
  const handleContinueRef = useRef(null)
  const handleDismissRef = useRef(null)
  const recordedBlobRef = useRef(null)
  const hasStreamCompletedRef = useRef(false)

  const incomingAudioBlob = location.state?.audioBlob
  const mode = location.state?.mode || (incomingAudioBlob ? "upload" : "record")
  const stages = ["Preparing audio", "Reading voice markers", "Checking attack patterns"]

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }, [reports])

  useEffect(() => {
    let cancelled = false
    let countdownId
    let stopId
    let finishId
    let recorder

    const disposeAudio = () => {
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()
      if (audioContextRef.current?.state !== "closed") audioContextRef.current?.close()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      processorRef.current = null
      sourceRef.current = null
      audioContextRef.current = null
      streamRef.current = null
    }
    disposeAudioRef.current = disposeAudio

    const handleCutCall = (relationship) => {
      setEarlyAlertOpen(false)
      earlyAlertOpenRef.current = false
      callerRelationshipRef.current = relationship
      cancelled = true
      window.clearInterval(countdownId)
      window.clearTimeout(stopId)
      window.clearTimeout(finishId)
      if (recorder?.state === "recording") recorder.stop()
      disposeAudio()
      socketRef.current?.close()
      socketRef.current = null
      setIsRecording(false)

      const allReports = reportsRef.current || []
      const bestSpoof = earlyAlertData?.spoof_probability ?? (allReports.length > 0 ? Math.max(...allReports.map((r) => r.spoof_probability)) : 0.85)
      const isSpoof = bestSpoof >= 0.50
      const finalRisk = bestSpoof >= 0.70 ? "HIGH" : bestSpoof >= 0.50 ? "MEDIUM" : "LOW"

      const detectedAttackReport = allReports.slice().reverse().find((r) => r.attack_type)
      const reportWithForensics = allReports.slice().reverse().find((r) => r.forensics && (r.forensics.replay_score !== undefined || r.forensics.prosody_score !== undefined))
      const finalForensics = earlyAlertData?.forensics || reportWithForensics?.forensics || { replay_score: 0.05, prosody_score: 0.05 }
      const finalAttackType = earlyAlertData?.attack_type || detectedAttackReport?.attack_type || null
      const finalFlaggedPhrases = earlyAlertData?.flagged_phrases?.length ? earlyAlertData.flagged_phrases : (detectedAttackReport?.flagged_phrases || [])

      const cutResult = {
        result: isSpoof ? "spoof" : "real",
        status: isSpoof ? (bestSpoof >= 0.70 ? "high_risk" : "suspicious") : "likely_real",
        spoof_probability: bestSpoof,
        max_spoof_probability: bestSpoof,
        average_spoof_probability: bestSpoof,
        confidence: isSpoof ? bestSpoof : (1.0 - bestSpoof),
        risk: finalRisk,
        callCutOffEarly: true,
        interceptedAtSecond: earlyAlertData?.elapsed_seconds ?? 4,
        callerRelationship: relationship,
        isImpersonationAttack: relationship === "yes" || Boolean(finalAttackType),
        early_4s_flagged: true,
        total_segments: allReports.length || 1,
        suspicious_segments: Math.max(1, allReports.filter((r) => r.spoof_probability >= 0.50).length),
        spectrogram: earlyAlertData?.spectrogram,
        forensics: finalForensics,
        attack_type: finalAttackType,
        flagged_phrases: finalFlaggedPhrases,
        transcript: earlyAlertData?.transcript,
        detection_mode: earlyAlertData?.detection_mode,
        action: earlyAlertData?.action,
        action_message: earlyAlertData?.action_message,
        segments:
          allReports.length > 0
            ? allReports.map((r, i) => ({
                segment: i + 1,
                start_time: Math.max(0, (r.elapsed_seconds ?? (i + 1) * 2) - 4),
                end_time: r.elapsed_seconds ?? (i + 1) * 2,
                spoof_probability: r.spoof_probability,
                bonafide_probability: 1.0 - r.spoof_probability,
                result: r.result,
              }))
            : [
                {
                  segment: 1,
                  start_time: 0,
                  end_time: earlyAlertData?.elapsed_seconds ?? 4,
                  spoof_probability: bestSpoof,
                  bonafide_probability: 1.0 - bestSpoof,
                  result: isSpoof ? "spoof" : "real",
                },
              ],
      }

      navigate("/result", {
        replace: true,
        state: {
          result: cutResult,
          intercepted: true,
          callerRelationship: relationship,
        },
      })
    }
    handleCutCallRef.current = handleCutCall

    const handleDismiss = () => {
      setEarlyAlertOpen(false)
      earlyAlertOpenRef.current = false
      if (hasStreamCompletedRef.current) {
        finish()
      }
    }
    handleDismissRef.current = handleDismiss

    const handleContinue = (relationship) => {
      setEarlyAlertOpen(false)
      earlyAlertOpenRef.current = false
      callerRelationshipRef.current = relationship
      setCallerRelationship(relationship)
      setChallengeModeActive(true)
      if (hasStreamCompletedRef.current) {
        finish()
        return
      }
      if (mode === "record") {
        stopId = window.setTimeout(() => {
          if (recorder?.state !== "inactive") {
            try { recorder.stop() } catch {}
          }
          disposeAudio()
          finishId = window.setTimeout(finish, 800)
        }, Math.max(1500, secondsLeft * 1000))
      }
    }
    handleContinueRef.current = handleContinue

    const finish = async () => {
      if (cancelled) return
      if (earlyAlertOpenRef.current) {
        hasStreamCompletedRef.current = true
        return
      }
      disposeAudio()
      if (recorder?.state === "recording") {
        try { recorder.stop() } catch {}
      }
      socketRef.current?.close()
      socketRef.current = null
      setIsRecording(false)
      setStage(2)

      const allReports = reportsRef.current
      if (allReports && allReports.length > 0) {
        // Filter for windows where actual speech was detected, or use all
        const speechReports = allReports.filter((r) => r.is_speech !== false)
        const targetReports = speechReports.length > 0 ? speechReports : allReports

        const maxSpoofProb = Math.max(...targetReports.map((r) => r.spoof_probability))
        const avgSpoofProb = targetReports.reduce((s, r) => s + r.spoof_probability, 0) / targetReports.length
        const hasReplayThreat = targetReports.some((r) => r.detection_mode === "PHONE_REPLAY_AI" || r.risk === "HIGH" || r.spoof_probability >= 0.65)
        const overallScore = targetReports.length > 1
          ? (hasReplayThreat ? (0.70 * maxSpoofProb + 0.30 * avgSpoofProb) : (0.40 * maxSpoofProb + 0.60 * avgSpoofProb))
          : maxSpoofProb
        const isSpoof = overallScore >= 0.50
        const finalConfidence = isSpoof ? overallScore : (1.0 - overallScore)
        const finalRisk = overallScore >= 0.70 ? "HIGH" : overallScore >= 0.50 ? "MEDIUM" : "LOW"
        const suspiciousCount = targetReports.filter((r) => r.spoof_probability >= 0.50).length
        const primaryMode = targetReports.find((r) => r.detection_mode === "PHONE_REPLAY_AI")?.detection_mode || (isSpoof ? "DIRECT_AI" : "LIVE_HUMAN")

        const lastReport = targetReports[targetReports.length - 1] || latestReportRef.current || {}
        const detectedAttackReport = allReports.slice().reverse().find((r) => r.attack_type)
        const reportWithForensics = allReports.slice().reverse().find((r) => r.forensics && (r.forensics.replay_score !== undefined || r.forensics.prosody_score !== undefined))
        const fullTranscript = allReports
          .map((r) => r.transcript)
          .filter(Boolean)
          .join(" ")

        const aggregatedResult = {
          result: isSpoof ? "spoof" : "real",
          status: isSpoof ? (overallScore >= 0.70 ? "high_risk" : "suspicious") : "likely_real",
          spoof_probability: overallScore,
          max_spoof_probability: maxSpoofProb,
          average_spoof_probability: avgSpoofProb,
          confidence: finalConfidence,
          risk: detectedAttackReport && finalRisk === "LOW" ? "MEDIUM" : finalRisk,
          detection_mode: primaryMode,
          total_segments: allReports.length,
          suspicious_segments: suspiciousCount,
          callerRelationship: callerRelationshipRef.current || "no",
          isImpersonationAttack: callerRelationshipRef.current === "yes" || Boolean(detectedAttackReport),
          early_4s_flagged: earlyAlertTriggeredRef.current,
          spectrogram: lastReport.spectrogram,
          forensics: reportWithForensics?.forensics || lastReport.forensics || { replay_score: 0.05, prosody_score: 0.05 },
          action: lastReport.action,
          action_message: lastReport.action_message,
          repeated_suspicious: lastReport.repeated_suspicious,
          transcript: fullTranscript || lastReport.transcript,
          attack_type: detectedAttackReport?.attack_type || lastReport.attack_type || null,
          flagged_phrases: detectedAttackReport?.flagged_phrases || lastReport.flagged_phrases || [],
          segments: allReports.map((r, i) => ({
            segment: i + 1,
            start_time: Math.max(0, (r.elapsed_seconds ?? (i + 1) * 2) - 4),
            end_time: r.elapsed_seconds ?? (i + 1) * 2,
            spoof_probability: r.spoof_probability,
            bonafide_probability: 1.0 - r.spoof_probability,
            result: r.result,
            detection_mode: r.detection_mode,
          })),
        }
        navigate("/result", { replace: true, state: { result: aggregatedResult } })
        return
      }

      if (latestReportRef.current) {
        navigate("/result", { replace: true, state: { result: latestReportRef.current } })
        return
      }

      // If reportsRef is empty and audio blob exists, fetch HTTP /analyze directly!
      const fallbackBlob = incomingAudioBlob || recordedBlobRef.current
      if (fallbackBlob) {
        try {
          const formData = new FormData()
          formData.append("file", fallbackBlob, fallbackBlob.name || "recording.wav")
          const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
          const response = await fetch(`http://${host}:8000/analyze`, { method: "POST", body: formData })
          if (response.ok) {
            const result = await response.json()
            if (!cancelled) {
              navigate("/result", { replace: true, state: { result } })
              return
            }
          }
        } catch (postErr) {
          console.error("HTTP /analyze fallback error:", postErr)
        }
      }

      // If mic recording had no speech detected or was silent:
      navigate("/result", { replace: true, state: { result: { silent: true } } })
    }

    let uploadStreamIntervalId = null

    const analyseUpload = async (blob) => {
      if (!blob) return
      setStage(0)
      try {
        if (await checkSilence(blob)) {
          navigate("/result", { replace: true, state: { result: { silent: true } } })
          return
        }

        const arrayBuffer = await blob.arrayBuffer()
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        let context
        try {
          context = new AudioContextClass({ sampleRate: 16000 })
        } catch {
          context = new AudioContextClass()
        }
        audioContextRef.current = context
        await context.resume()

        const decodedBuffer = await context.decodeAudioData(arrayBuffer)
        const channelData = decodedBuffer.getChannelData(0)

        // Resample channelData to 16000 Hz 16-bit PCM mono
        let pcm
        if (decodedBuffer.sampleRate === 16000) {
          pcm = new Int16Array(channelData.length)
          for (let i = 0; i < channelData.length; i++) {
            const s = Math.max(-1, Math.min(1, channelData[i]))
            pcm[i] = s < 0 ? s * 32768 : s * 32767
          }
        } else {
          const ratio = decodedBuffer.sampleRate / 16000
          const outLength = Math.floor(channelData.length / ratio)
          pcm = new Int16Array(outLength)
          for (let i = 0; i < outLength; i++) {
            const pos = i * ratio
            const idx = Math.floor(pos)
            const frac = pos - idx
            const s = idx + 1 < channelData.length
              ? channelData[idx] * (1 - frac) + channelData[idx + 1] * frac
              : channelData[idx]
            const clipped = Math.max(-1, Math.min(1, s))
            pcm[i] = clipped < 0 ? clipped * 32768 : clipped * 32767
          }
        }

        const totalSeconds = Math.max(2, Math.ceil(pcm.length / 16000))
        setSecondsLeft(totalSeconds)
        setIsRecording(true)
        reportsRef.current = []

        const socket = new WebSocket(getWebSocketUrl())
        socket.binaryType = "arraybuffer"
        socketRef.current = socket

        socket.onopen = () => {
          setStage(1)
          let offset = 0
          const chunkSize = 4096 // 4096 samples = 256ms

          uploadStreamIntervalId = window.setInterval(() => {
            if (cancelled || socket.readyState !== WebSocket.OPEN) {
              window.clearInterval(uploadStreamIntervalId)
              if (!cancelled) {
                if (!earlyAlertOpenRef.current) finish()
                else hasStreamCompletedRef.current = true
              }
              return
            }

            // Pause playback/streaming while the threat alert is being reviewed by the user during the call!
            if (earlyAlertOpenRef.current) {
              return
            }

            if (offset >= pcm.length) {
              window.clearInterval(uploadStreamIntervalId)
              setIsRecording(false)
              finishId = window.setTimeout(finish, 1200)
              return
            }

            const nextOffset = Math.min(offset + chunkSize, pcm.length)
            const chunk = pcm.subarray(offset, nextOffset)
            socket.send(chunk.buffer)
            offset = nextOffset
            const remaining = Math.max(0, Math.ceil((pcm.length - offset) / 16000))
            setSecondsLeft(remaining)
          }, 200)
        }

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === "error") throw new Error(data.message)
            if (data.type !== "prediction" || cancelled) return
            const report = normaliseReport(data, (latestReportRef.current?.elapsed_seconds ?? 0) + 2)
            latestReportRef.current = report
            reportsRef.current = [...reportsRef.current, report]
            setLiveReport(report)
            setReports((current) => [...current, report])
            setStage(2)

            const hasRisk = (report.risk && report.risk !== "LOW") || Boolean(data.attack_type) || Boolean(report.attack_type)

            if (!earlyAlertTriggeredRef.current && hasRisk) {
              earlyAlertTriggeredRef.current = true
              earlyAlertOpenRef.current = true
              setEarlyAlertData(report)
              setEarlyAlertOpen(true)
            } else if (earlyAlertTriggeredRef.current && (data.attack_type || data.forensics)) {
              setEarlyAlertData((prev) => ({
                ...prev,
                ...report,
                forensics: report.forensics || prev?.forensics,
                attack_type: report.attack_type || prev?.attack_type,
                flagged_phrases: report.flagged_phrases?.length ? report.flagged_phrases : prev?.flagged_phrases,
              }))
            }
          } catch (error) {
            console.error("Live prediction error:", error)
          }
        }

        socket.onerror = async () => {
          console.warn("WebSocket upload stream connection error, running HTTP /analyze fallback")
          try {
            const formData = new FormData()
            formData.append("file", blob, blob.name || "recording.wav")
            const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
            const response = await fetch(`http://${host}:8000/analyze`, { method: "POST", body: formData })
            if (response.ok) {
              const result = await response.json()
              if (!cancelled) {
                navigate("/result", { replace: true, state: { result } })
                return
              }
            }
          } catch (postErr) {
            console.error("HTTP /analyze fallback error:", postErr)
          }
          setErrorMessage("Live voice detection could not connect to the backend.")
        }
        socket.onclose = () => {
          if (cancelled) return
          window.clearInterval(uploadStreamIntervalId)
          if (!earlyAlertOpenRef.current) {
            finish()
          } else {
            hasStreamCompletedRef.current = true
          }
        }
      } catch (error) {
        console.error("Upload streaming error, falling back to HTTP analyze:", error)
        try {
          const formData = new FormData()
          formData.append("file", blob, blob.name || "recording.webm")
          const response = await fetch("http://127.0.0.1:8000/analyze", { method: "POST", body: formData })
          if (!response.ok) throw new Error(`Backend returned ${response.status}`)
          const result = await response.json()
          if (!cancelled) navigate("/result", { replace: true, state: { result } })
        } catch (postErr) {
          console.error("Upload analysis fallback error:", postErr)
          if (!cancelled) navigate("/result", { replace: true, state: { result: null } })
        }
      }
    }

    const startRecording = async () => {
      try {
        setErrorMessage("")
        setStage(0)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: true,
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        recorder = new MediaRecorder(stream)
        const audioChunks = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.push(e.data)
        }
        recorder.onstop = () => {
          if (audioChunks.length > 0) {
            recordedBlobRef.current = new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" })
          }
        }
        recorder.start(500)

        reportsRef.current = []
        const socket = new WebSocket(getWebSocketUrl())
        socket.binaryType = "arraybuffer"
        socketRef.current = socket
        socket.onopen = () => setStage(1)
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === "error") throw new Error(data.message)
            if (data.type !== "prediction" || cancelled) return
            const report = normaliseReport(data, (latestReportRef.current?.elapsed_seconds ?? 0) + 2)
            latestReportRef.current = report
            reportsRef.current = [...reportsRef.current, report]
            setLiveReport(report)
            setReports((current) => [...current, report])
            setStage(2)

            // Trigger during call: The moment a WebSocket message arrives with risk != "LOW" OR attack_type is set
            const hasRisk = (report.risk && report.risk !== "LOW") || Boolean(data.attack_type) || Boolean(report.attack_type)

            if (!earlyAlertTriggeredRef.current && hasRisk) {
              earlyAlertTriggeredRef.current = true
              earlyAlertOpenRef.current = true
              setEarlyAlertData(report)
              setEarlyAlertOpen(true)
              // Clear auto-stop timers so call remains intercepted while user reviews options!
              if (stopId) window.clearTimeout(stopId)
              if (finishId) window.clearTimeout(finishId)
            } else if (earlyAlertTriggeredRef.current && (data.attack_type || data.forensics)) {
              setEarlyAlertData((prev) => ({
                ...prev,
                ...report,
                forensics: report.forensics || prev?.forensics,
                attack_type: report.attack_type || prev?.attack_type,
                flagged_phrases: report.flagged_phrases?.length ? report.flagged_phrases : prev?.flagged_phrases,
              }))
            }
          } catch (error) {
            console.error("Live prediction error:", error)
          }
        }
        socket.onerror = () => setErrorMessage("Live voice detection could not connect to the backend.")
        socket.onclose = () => {
          if (cancelled) return
          if (!earlyAlertOpenRef.current) {
            finish()
          } else {
            hasStreamCompletedRef.current = true
          }
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        let context
        try {
          context = new AudioContextClass({ sampleRate: 16000 })
        } catch {
          context = new AudioContextClass()
        }
        audioContextRef.current = context
        await context.resume()
        const source = context.createMediaStreamSource(stream)
        sourceRef.current = source
        const processor = context.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        processor.onaudioprocess = (event) => {
          if (socket.readyState !== WebSocket.OPEN) return
          const input = event.inputBuffer.getChannelData(0)

          if (context.sampleRate === 16000) {
            const pcm = new Int16Array(input.length)
            for (let index = 0; index < input.length; index += 1) {
              const sample = Math.max(-1, Math.min(1, input[index]))
              pcm[index] = sample < 0 ? sample * 32768 : sample * 32767
            }
            socket.send(pcm.buffer)
            return
          }

          // Linear interpolation downsampler (preserves high-frequency vocoder phase transitions)
          const ratio = context.sampleRate / 16000
          const outLength = Math.floor(input.length / ratio)
          const pcm = new Int16Array(outLength)
          for (let i = 0; i < outLength; i += 1) {
            const pos = i * ratio
            const idx = Math.floor(pos)
            const frac = pos - idx
            const sample = idx + 1 < input.length
              ? input[idx] * (1 - frac) + input[idx + 1] * frac
              : input[idx]
            const clipped = Math.max(-1, Math.min(1, sample))
            pcm[i] = clipped < 0 ? clipped * 32768 : clipped * 32767
          }
          socket.send(pcm.buffer)
        }
        const silentGain = context.createGain()
        silentGain.gain.value = 0
        source.connect(processor)
        processor.connect(silentGain)
        silentGain.connect(context.destination)

        setSecondsLeft(RECORDING_DURATION)
        setIsRecording(true)
        countdownId = window.setInterval(() => {
          if (!earlyAlertOpenRef.current) {
            setSecondsLeft((current) => Math.max(0, current - 1))
          }
        }, 1000)

        stopId = window.setTimeout(() => {
          if (earlyAlertOpenRef.current) return
          window.clearInterval(countdownId)
          if (recorder?.state !== "inactive") recorder.stop()
          disposeAudio()
          // Let the last two-second model window return before opening the final report.
          finishId = window.setTimeout(finish, 900)
        }, RECORDING_DURATION * 1000)
      } catch (error) {
        console.error("Microphone error:", error)
        setErrorMessage(error?.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access and try again." : "Your microphone could not be accessed.")
      }
    }

    if (mode === "record") startRecording()
    else analyseUpload(incomingAudioBlob)

    return () => {
      cancelled = true
      window.clearInterval(countdownId)
      window.clearInterval(uploadStreamIntervalId)
      window.clearTimeout(stopId)
      window.clearTimeout(finishId)
      if (recorder?.state === "recording") recorder.stop()
      disposeAudio()
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [incomingAudioBlob, mode, navigate])

  const reportValue = (value) => `${Math.round(value * 100)}%`

  return (
    <main className="min-h-screen bg-[#101b2f] text-white">
      <WavyBackground backgroundFill="#101b2f" waveOpacity={0.48} colors={["#22d3ee", "#38bdf8", "#60a5fa", "#818cf8", "#a78bfa"]}>
        <Navbar />
        <motion.section initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-5 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] sm:px-8">
          <motion.div initial={reduceMotion ? false : { scale: 0.97, opacity: 0 }} animate={reduceMotion ? false : { scale: 1, opacity: 1 }} transition={{ duration: 0.5 }} className="rounded-4xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-8">
            <div className="flex items-center justify-between text-left"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83b7ff]">{isRecording ? (mode === "upload" ? "Simulating incoming call" : "Recording voice sample") : "Analysis in progress"}</p><h1 className="mt-2 font-display text-2xl font-semibold">{isRecording ? (mode === "upload" ? `Call active — ${secondsLeft}s remaining` : `Speak naturally — ${secondsLeft}s remaining`) : "Reading voice sample"}</h1></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3a7eea]/20 text-[#82b5ff]">{isRecording ? <Mic className="h-5 w-5 animate-pulse" /> : <AudioLines className="h-5 w-5" />}</span></div>
            <div className="orb-stage mt-7"><div className="signal-orb" aria-hidden="true"><span /><span /><span /></div><p className="relative z-10 text-sm font-medium text-[#d7e5ff]">{isRecording ? (mode === "upload" ? "Streaming incoming call audio..." : "Listening to your voice...") : "Extracting voice markers"}</p><p className="relative z-10 mt-1 text-xs text-[#8291aa]">{isRecording ? "Live model updates appear beside your call" : "Checking your sample for synthetic voice patterns"}</p></div>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#091324] px-3 py-3"><WaveformVerdict variant="uncertain" state="analyzing" size="sparkline" /></div>
            {errorMessage && <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div>}
            <div className="mt-5 flex items-center justify-between rounded-xl bg-white/6 px-4 py-3 text-left"><span className="truncate text-sm text-slate-300">{location.state?.source ?? "Voice sample"}</span><span className="ml-4 shrink-0 text-xs font-medium text-[#8bc8ba]">{isRecording ? "recording" : "secured"}</span></div>
            <div className="mt-6 space-y-2 text-left">{stages.map((item, index) => <div key={item} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${index === stage ? "bg-[#3a7eea]/15" : ""}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${index < stage ? "bg-[#37a68f] text-white" : index === stage ? "bg-[#4e8cf2] text-white" : "bg-white/10 text-slate-500"}`}>{index < stage ? <Check className="h-3.5 w-3.5" /> : <ScanLine className={`h-3.5 w-3.5 ${index === stage ? "animate-pulse" : ""}`} />}</span><span className={`text-sm ${index <= stage ? "text-white" : "text-slate-500"}`}>{item}</span></div>)}</div>
            {challengeModeActive && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/15 p-4 text-xs text-amber-200 shadow-md text-left"
              >
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <span className="font-bold text-amber-100 uppercase tracking-wide">
                      Active Scam Countermeasures Enabled:
                    </span>
                    <p className="mt-1 text-slate-200">
                      Challenge the caller: <span className="font-semibold text-white">"What was our family safe-word?"</span> or <span className="font-semibold text-white">"I will hang up and call your personal number."</span>
                    </p>
                    <p className="mt-1 font-semibold text-red-300">
                      ⚠️ Never share OTPs or transfer money under urgent pressure.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-4 w-4 text-[#8bc8ba]" />No audio is stored after this session.</div>
          </motion.div>

          <motion.aside initial={reduceMotion ? false : { opacity: 0, x: 14 }} animate={reduceMotion ? false : { opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: reduceMotion ? 0 : 0.12 }} className="overflow-hidden rounded-4xl border border-[#75a9ff]/20 bg-[#07101d]/90 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9caff]"><Terminal className="h-4 w-4" />Live model console</div><span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#77e4c0]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#50d3a8]" />STREAMING</span></div>
            <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/10">{[["Spoof", liveReport ? reportValue(liveReport.spoof_probability) : "--"], ["Confidence", liveReport ? reportValue(liveReport.confidence) : "--"], ["Risk", liveReport?.risk ?? "--"]].map(([label, value]) => <div key={label} className="bg-[#0a1525] px-4 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7185a7]">{label}</p><p className="mt-1 font-mono text-lg font-semibold text-[#deebff]">{value}</p></div>)}</div>
            <div ref={consoleRef} className="h-76 overflow-y-auto p-4 font-mono text-xs leading-6 sm:h-88"><p className="text-[#6d84a7]">$ voice-shield --live --window 2s</p><p className="text-[#6d84a7]">Waiting for model windows…</p><AnimatePresence initial={false}>{reports.map((report, index) => <motion.div key={`${report.elapsed_seconds}-${index}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2"><span className="text-[#79e0be]">[{String(report.elapsed_seconds).padStart(2, "0")}s]</span><span className="ml-2 text-[#7db6ff]">SPOOF {reportValue(report.spoof_probability)}</span><span className="ml-2 text-[#c3b5ff]">CONF {reportValue(report.confidence)}</span><span className={`ml-2 ${report.risk === "HIGH" ? "text-[#ff9d8c]" : report.risk === "MEDIUM" ? "text-[#ffd17a]" : "text-[#79e0be]"}`}>{report.risk} RISK</span></motion.div>)}</AnimatePresence>{reports.length === 0 && <p className="mt-4 text-[#879ab8]">Capturing speech before the first analysis window.</p>}</div>
            <div className="border-t border-white/10 px-5 py-3 text-[11px] text-[#7890af]">A fresh backend report is added every 2 seconds during capture.</div>
          </motion.aside>
        </motion.section>
      </WavyBackground>

      {/* Early 4-Second Impersonation Interceptor Modal */}
      <ImpersonationAlertModal
        isOpen={earlyAlertOpen}
        spoofProbability={earlyAlertData?.spoof_probability ?? 0.85}
        risk={earlyAlertData?.risk ?? "HIGH"}
        elapsedSeconds={earlyAlertData?.elapsed_seconds ?? 4}
        forensics={earlyAlertData?.forensics}
        attackType={earlyAlertData?.attack_type}
        flaggedPhrases={earlyAlertData?.flagged_phrases}
        transcript={earlyAlertData?.transcript}
        detectionMode={earlyAlertData?.detection_mode}
        onCutCall={(rel) => handleCutCallRef.current?.(rel)}
        onContinue={(rel) => handleContinueRef.current?.(rel)}
        onDismiss={() => handleDismissRef.current?.()}
      />
    </main>
  )
}

export default Analyzing
