import { useEffect, useState, useRef } from "react"
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
  const websocketRef = useRef(null)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)

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

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })

    if (cancelled) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    streamRef.current = stream

// Temporary local recording for debugging/testing
    const recordedChunks = []

     try {
      recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data)
    }
  }

  recorder.onstop = () => {
    const recordedBlob = new Blob(recordedChunks, {
      type: recorder.mimeType || "audio/webm",
    })

    const url = URL.createObjectURL(recordedBlob)
    const link = document.createElement("a")

    link.href = url
    link.download = `voice_test_${Date.now()}.webm`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)

    console.log(
      "💾 Test recording saved:",
      recordedBlob.size,
      "bytes"
    )
  }

  recorder.start()
  console.log("🎙️ Local test recording started")
} catch (error) {
  console.warn(
    "Local recording could not be started:",
    error
  )
}

    // Connect to live backend
    const websocket = new WebSocket(
      `${window.location.origin.replace("http", "ws").replace(":5173", ":8000")}/audio-stream`
    );

    websocket.binaryType = "arraybuffer"
    websocketRef.current = websocket

    websocket.onopen = () => {
      console.log("🎙️ Live detection connected")
      setStage(1)
    }

   websocket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data)

    console.log("LIVE BACKEND:", data)

    if (data.type === "prediction") {
      console.log(
        "🧠 Live prediction:",
        data.spoof_probability,
        data.status
      )

      setStage(2)

      // Show the result as soon as the backend
      // finishes the first live analysis.
      navigate("/result", {
        replace: true,
        state: {
          result: {
            max_spoof_probability:
              data.spoof_probability,
            status: data.status,
          },
        },
      })

      return
    }

    if (data.type === "error") {
      console.error(
        "Live prediction error:",
        data.message
      )
    }
  } catch (error) {
    console.error(
      "WebSocket message error:",
      error
    )
  }
}

 

    websocket.onerror = (error) => {
      console.error(
        "WebSocket error:",
        error
      )

      setErrorMessage(
        "Live voice detection could not connect to the backend."
      )
    }

    // Create browser audio context
    const audioContext = new AudioContext()

    audioContextRef.current = audioContext

    await audioContext.resume()

    console.log(
      "🎧 Browser sample rate:",
      audioContext.sampleRate
    )

    const source =
      audioContext.createMediaStreamSource(stream)

    sourceRef.current = source

    const processor =
      audioContext.createScriptProcessor(
        4096,
        1,
        1
      )

    processorRef.current = processor

    processor.onaudioprocess = (event) => {
      if (
        websocket.readyState !== WebSocket.OPEN
      ) {
        return
      }

      const input =
        event.inputBuffer.getChannelData(0)

      /*
        IMPORTANT:

        Your model expects 16 kHz.
        Browsers often give us 48 kHz.

        So we explicitly convert the
        microphone data to 16 kHz.
      */

      const targetSampleRate = 16000
      const inputSampleRate =
        audioContext.sampleRate

      const ratio =
        inputSampleRate / targetSampleRate

      const outputLength =
        Math.floor(input.length / ratio)

      const pcm =
        new Int16Array(outputLength)

      for (let i = 0; i < outputLength; i++) {
        const position = i * ratio

        const left = Math.floor(position)
        const right = Math.min(
          left + 1,
          input.length - 1
        )

        const fraction =
          position - left

        const sample =
          input[left] * (1 - fraction) +
          input[right] * fraction

        const clipped =
          Math.max(
            -1,
            Math.min(1, sample)
          )

        pcm[i] =
          clipped < 0
            ? clipped * 32768
            : clipped * 32767
      }

      websocket.send(
        pcm.buffer
      )
    }

    source.connect(processor)

    /*
      Keep ScriptProcessor alive without
      playing the microphone back to you.
    */
    const silentGain =
      audioContext.createGain()

    silentGain.gain.value = 0

    processor.connect(silentGain)
    silentGain.connect(
      audioContext.destination
    )

    console.log(
      "🎤 LIVE MICROPHONE DETECTION STARTED"
    )

    // Keep your existing 7-second UI
    setSecondsLeft(RECORDING_DURATION)
    setIsRecording(true)

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
    console.log(
    "🛑 7 seconds completed"
  )

      if (recorder && recorder.state !== "inactive") {
    recorder.stop()
    console.log("💾 Local test recording stopped")
  }

      if (countdownInterval) {
    clearInterval(countdownInterval)
  }

      if (countdownInterval) {
        clearInterval(countdownInterval)
      }

      if (processorRef.current) {
        processorRef.current.disconnect()
        processorRef.current = null
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect()
        sourceRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop())

        streamRef.current = null
      }

      if (
        websocketRef.current &&
        websocketRef.current.readyState ===
          WebSocket.OPEN
      ) {
        websocketRef.current.close()
      }

      websocketRef.current = null

      setIsRecording(false)
    }, RECORDING_DURATION * 1000)

  } catch (error) {
    console.error(
      "Microphone error:",
      error
    )

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

    if (processorRef.current) {
  processorRef.current.disconnect()
  processorRef.current = null
}

if (sourceRef.current) {
  sourceRef.current.disconnect()
  sourceRef.current = null
}

if (audioContextRef.current) {
  audioContextRef.current.close()
  audioContextRef.current = null
}

if (streamRef.current) {
  streamRef.current
    .getTracks()
    .forEach((track) => track.stop())

  streamRef.current = null
}

if (websocketRef.current) {
  websocketRef.current.close()
  websocketRef.current = null
}
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