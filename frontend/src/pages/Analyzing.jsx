import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  AudioLines,
  Check,
  Mic,
  ScanLine,
  ShieldCheck,
} from "lucide-react"
import Navbar from "../components/Navbar"
import WaveformVerdict from "../components/WaveformVerdict"
import { motion } from "framer-motion"
import { WavyBackground } from "../components/WavyBackground"

const RECORDING_DURATION = 7

const checkSilence = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const channelData = audioBuffer.getChannelData(0)

  let sum = 0

  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i]
  }

  const rms = Math.sqrt(sum / channelData.length)

  await audioContext.close()

  return rms < 0.01
}

function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()

  const [stage, setStage] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_DURATION)
  const [errorMessage, setErrorMessage] = useState("")

  const mode = location.state?.mode
  const incomingAudioBlob = location.state?.audioBlob

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  const stages = [
    "Preparing audio",
    "Reading voice markers",
    "Checking attack patterns",
  ]

  useEffect(() => {
    let stream = null
    let recorder = null
    let countdownInterval = null
    let stopTimeout = null
    let startTimeout = null
    let cancelled = false

    const analyzeAudio = async (audioBlob) => {
      if (cancelled) return

      setIsRecording(false)
      setStage(1)

      if (audioBlob) {
        try {
          const isSilent = await checkSilence(audioBlob)

          if (cancelled) return

          if (isSilent) {
            navigate("/result", {
              replace: true,
              state: {
                result: {
                  silent: true,
                },
              },
            })

            return
          }
        } catch (error) {
          console.warn("Silence check failed:", error)
        }
      }

      const formData = new FormData()

      if (audioBlob) {
        formData.append("file", audioBlob, "recording.webm")
      }

      setStage(2)

      try {
        const response = await fetch("http://127.0.0.1:8000/analyze", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()

        if (cancelled) return

        navigate("/result", {
          replace: true,
          state: {
            result: data,
          },
        })
      } catch (error) {
        console.error("Backend error:", error)

        if (cancelled) return

        navigate("/result", {
          replace: true,
          state: {
            result: null,
          },
        })
      }
    }

    const recordAudio = async () => {
      try {
        setErrorMessage("")
        setStage(0)

        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        let recorderOptions

        if (
          MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus"
          )
        ) {
          recorderOptions = {
            mimeType: "audio/webm;codecs=opus",
          }
        }

        recorder = new MediaRecorder(
          stream,
          recorderOptions
        )

        const chunks = []

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        recorder.onerror = (event) => {
          console.error("MediaRecorder error:", event)

          setErrorMessage(
            "There was a problem recording your microphone."
          )
        }

        recorder.onstop = async () => {
          if (countdownInterval) {
            clearInterval(countdownInterval)
          }

          stream?.getTracks().forEach((track) => {
            track.stop()
          })

          setIsRecording(false)

          if (cancelled) return

          const audioBlob = new Blob(chunks, {
            type:
              recorder.mimeType ||
              "audio/webm",
          })

          await analyzeAudio(audioBlob)
        }

        setSecondsLeft(RECORDING_DURATION)
        setIsRecording(true)

        recorder.start()

        countdownInterval = setInterval(() => {
          setSecondsLeft((previous) => {
            if (previous <= 1) {
              clearInterval(countdownInterval)
              return 0
            }

            return previous - 1
          })
        }, 1000)

        stopTimeout = setTimeout(() => {
          if (
            recorder &&
            recorder.state !== "inactive"
          ) {
            recorder.stop()
          }
        }, RECORDING_DURATION * 1000)
      } catch (error) {
        console.error("Microphone error:", error)

        if (cancelled) return

        setIsRecording(false)

        if (
          error?.name === "NotAllowedError" ||
          error?.name === "PermissionDeniedError"
        ) {
          setErrorMessage(
            "Microphone permission was denied. Allow microphone access and try again."
          )
        } else {
          setErrorMessage(
            "Your microphone could not be accessed."
          )
        }
      }
    }

    /*
      Delay execution until the page has mounted.

      This also prevents React StrictMode in development
      from starting the microphone twice.
    */
    startTimeout = setTimeout(() => {
      if (mode === "record") {
        recordAudio()
      } else {
        analyzeAudio(incomingAudioBlob)
      }
    }, 0)

    return () => {
      cancelled = true

      if (startTimeout) {
        clearTimeout(startTimeout)
      }

      if (stopTimeout) {
        clearTimeout(stopTimeout)
      }

      if (countdownInterval) {
        clearInterval(countdownInterval)
      }

      if (
        recorder &&
        recorder.state !== "inactive"
      ) {
        recorder.stop()
      }

      stream?.getTracks().forEach((track) => {
        track.stop()
      })
    }
  }, [
    mode,
    incomingAudioBlob,
    navigate,
  ])

  return (
    <main className="min-h-screen bg-[#101b2f] text-white">
      <WavyBackground
        backgroundFill="#101b2f"
        waveOpacity={0.48}
        colors={[
          "#22d3ee",
          "#38bdf8",
          "#60a5fa",
          "#818cf8",
          "#a78bfa",
        ]}
      >
        <Navbar />

        <motion.section
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, y: 8 }
          }
          animate={
            prefersReducedMotion
              ? false
              : { opacity: 1, y: 0 }
          }
          transition={{
            duration: 0.4,
            ease: "easeOut",
          }}
          className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-2xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8"
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? false
                : {
                    scale: 0.9,
                    opacity: 0,
                  }
            }
            animate={
              prefersReducedMotion
                ? false
                : {
                    scale: 1,
                    opacity: 1,
                  }
            }
            transition={{ duration: 0.5 }}
            className="w-full rounded-4xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-9"
          >
            <div className="flex items-center justify-between text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#83b7ff]">
                  {isRecording
                    ? "Recording voice sample"
                    : "Analysis in progress"}
                </p>

                <h1 className="mt-2 font-display text-2xl font-semibold">
                  {isRecording
                    ? `Speak naturally — ${secondsLeft}s remaining`
                    : "Reading your voice sample"}
                </h1>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#3a7eea]/20 text-[#82b5ff]">
                {isRecording ? (
                  <Mic className="h-5 w-5 animate-pulse" />
                ) : (
                  <AudioLines className="h-5 w-5" />
                )}
              </span>
            </div>

            <div className="orb-stage mt-7">
              <div
                className="signal-orb"
                aria-hidden="true"
              >
                <span />
                <span />
                <span />
              </div>

              <p className="relative z-10 text-sm font-medium text-[#d7e5ff]">
                {isRecording
                  ? "Listening to your voice..."
                  : "Extracting voice markers"}
              </p>

              <p className="relative z-10 mt-1 text-xs text-[#8291aa]">
                {isRecording
                  ? "Keep speaking until the recording finishes"
                  : "Checking your sample for synthetic voice patterns"}
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#091324] px-3 py-3">
              <WaveformVerdict
                variant="uncertain"
                state="analyzing"
                size="sparkline"
              />
            </div>

            {errorMessage && (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                <p>{errorMessage}</p>

                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  Go back and try again
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between rounded-xl bg-white/6 px-4 py-3 text-left">
              <span className="truncate text-sm text-slate-300">
                {location.state?.source ??
                  "Voice sample"}
              </span>

              <span className="ml-4 shrink-0 text-xs font-medium text-[#8bc8ba]">
                {isRecording
                  ? "recording"
                  : "secured"}
              </span>
            </div>

            <div className="mt-8 space-y-3 text-left">
              {stages.map(
                (item, index) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      index === stage
                        ? "bg-[#3a7eea]/15"
                        : ""
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        index < stage
                          ? "bg-[#37a68f] text-white"
                          : index === stage
                            ? "bg-[#4e8cf2] text-white"
                            : "bg-white/10 text-slate-500"
                      }`}
                    >
                      {index < stage ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <ScanLine
                          className={`h-3.5 w-3.5 ${
                            index === stage
                              ? "animate-pulse"
                              : ""
                          }`}
                        />
                      )}
                    </span>

                    <span
                      className={`text-sm ${
                        index <= stage
                          ? "text-white"
                          : "text-slate-500"
                      }`}
                    >
                      {item}
                    </span>
                  </div>
                )
              )}
            </div>

            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4 text-[#8bc8ba]" />
              No audio is stored after this session.
            </div>
          </motion.div>
        </motion.section>
      </WavyBackground>
    </main>
  )
}

export default Analyzing