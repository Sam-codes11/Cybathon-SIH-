import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  AudioLines,
  Check,
  Mic,
  ScanLine,
  ShieldCheck,
  Terminal,
} from "lucide-react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion"

import Navbar from "../components/Navbar"
import WaveformVerdict from "../components/WaveformVerdict"
import { WavyBackground } from "../components/WavyBackground"


// ============================================================
// RECORDING SETTINGS
// ============================================================

// Total microphone recording duration.
const RECORDING_DURATION = 10

// Backend model uses a 4-second window.
const MODEL_WINDOW_SECONDS = 4

// After the first 4-second window,
// backend produces a new result every 2 seconds.
const MODEL_HOP_SECONDS = 2


// ============================================================
// SILENCE CHECK FOR UPLOADED AUDIO
// ============================================================

const checkSilence = async (blob) => {
  const context = new AudioContext()

  try {
    const audio = await context.decodeAudioData(
      await blob.arrayBuffer()
    )

    const samples = audio.getChannelData(0)

    const rms = Math.sqrt(
      samples.reduce(
        (sum, value) => sum + value * value,
        0
      ) / samples.length
    )

    return rms < 0.01
  } finally {
    await context.close()
  }
}


// ============================================================
// WEBSOCKET URL
// ============================================================

const getWebSocketUrl = () => {
  const protocol =
    window.location.protocol === "https:"
      ? "wss:"
      : "ws:"

  return (
    `${protocol}//${window.location.hostname}:8000/audio-stream`
  )
}


// ============================================================
// NORMALISE BACKEND REPORT
// ============================================================

const normaliseReport = (
  data,
  fallbackSeconds
) => {
  const spoofProbability = Number(
    data.spoof_probability ??
    data.max_spoof_probability ??
    0
  )

  const isSpoof = data.result
    ? data.result === "spoof"
    : spoofProbability >= 0.5

  const confidence = Number(
    data.confidence ??
    (
      isSpoof
        ? spoofProbability
        : 1 - spoofProbability
    )
  )

  const risk =
    data.risk ??
    (
      spoofProbability >= 0.8
        ? "HIGH"
        : spoofProbability >= 0.5
          ? "MEDIUM"
          : "LOW"
    )

  return {
    ...data,
    spoof_probability: spoofProbability,
    confidence,
    risk,
    result: isSpoof ? "spoof" : "real",
    elapsed_seconds:
      data.elapsed_seconds ?? fallbackSeconds,
  }
}


// ============================================================
// ANALYZING PAGE
// ============================================================

function Analyzing() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  const [stage, setStage] = useState(0)
  const [isRecording, setIsRecording] =
    useState(false)

  const [secondsLeft, setSecondsLeft] =
    useState(RECORDING_DURATION)

  const [errorMessage, setErrorMessage] =
    useState("")

  const [reports, setReports] = useState([])
  const [liveReport, setLiveReport] =
    useState(null)

  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)

  const latestReportRef = useRef(null)
  const reportsRef = useRef([])
  const consoleRef = useRef(null)

  const mode = location.state?.mode
  const incomingAudioBlob =
    location.state?.audioBlob

  const stages = [
    "Preparing audio",
    "Reading voice markers",
    "Checking attack patterns",
  ]


  // ==========================================================
  // AUTO-SCROLL LIVE CONSOLE
  // ==========================================================

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop =
        consoleRef.current.scrollHeight
    }
  }, [reports])


  // ==========================================================
  // MAIN ANALYSIS EFFECT
  // ==========================================================

  useEffect(() => {
    let cancelled = false

    let countdownId
    let stopId
    let finishId
    let recorder


    // --------------------------------------------------------
    // CLEAN UP AUDIO RESOURCES
    // --------------------------------------------------------

    const disposeAudio = () => {
      processorRef.current?.disconnect()
      sourceRef.current?.disconnect()

      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close()
      }

      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop())

      processorRef.current = null
      sourceRef.current = null
      audioContextRef.current = null
      streamRef.current = null
    }


    // --------------------------------------------------------
    // FINISH LIVE RECORDING
    // --------------------------------------------------------

    const finish = () => {
      if (cancelled) return

      socketRef.current?.close()
      socketRef.current = null

      setIsRecording(false)
      setStage(2)

      const allReports =
        reportsRef.current


      // ------------------------------------------------------
      // AGGREGATE LIVE WINDOWS
      // ------------------------------------------------------

      if (
        allReports &&
        allReports.length > 0
      ) {
        // Prefer windows containing actual speech.
        const speechReports =
          allReports.filter(
            (report) =>
              report.is_speech !== false
          )

        const targetReports =
          speechReports.length > 0
            ? speechReports
            : allReports


        const maxSpoofProb =
          Math.max(
            ...targetReports.map(
              (report) =>
                report.spoof_probability
            )
          )


        const avgSpoofProb =
          targetReports.reduce(
            (sum, report) =>
              sum +
              report.spoof_probability,
            0
          ) / targetReports.length


        const isSpoof =
          maxSpoofProb >= 0.5


        const finalConfidence =
          isSpoof
            ? maxSpoofProb
            : 1.0 - maxSpoofProb


        const finalRisk =
          maxSpoofProb >= 0.8
            ? "HIGH"
            : maxSpoofProb >= 0.5
              ? "MEDIUM"
              : "LOW"


        const suspiciousCount =
          targetReports.filter(
            (report) =>
              report.spoof_probability >= 0.5
          ).length


        // ----------------------------------------------------
        // BUILD FINAL RESULT
        // ----------------------------------------------------

        const aggregatedResult = {
          result:
            isSpoof
              ? "spoof"
              : "real",

          status:
            isSpoof
              ? (
                  maxSpoofProb >= 0.8
                    ? "high_risk"
                    : "suspicious"
                )
              : "likely_real",

          spoof_probability:
            maxSpoofProb,

          max_spoof_probability:
            maxSpoofProb,

          average_spoof_probability:
            avgSpoofProb,

          confidence:
            finalConfidence,

          risk:
            finalRisk,

          total_segments:
            allReports.length,

          suspicious_segments:
            suspiciousCount,


          // --------------------------------------------------
          // Window timing:
          //
          // Prediction 1 = 0–4 sec
          // Prediction 2 = 2–6 sec
          // Prediction 3 = 4–8 sec
          // Prediction 4 = 6–10 sec
          // --------------------------------------------------

          segments:
            allReports.map(
              (report, index) => {
                const fallbackEnd =
                  MODEL_WINDOW_SECONDS +
                  (
                    index *
                    MODEL_HOP_SECONDS
                  )

                const endTime =
                  report.elapsed_seconds ??
                  fallbackEnd

                return {
                  segment:
                    index + 1,

                  start_time:
                    Math.max(
                      0,
                      endTime -
                      MODEL_WINDOW_SECONDS
                    ),

                  end_time:
                    endTime,

                  spoof_probability:
                    report.spoof_probability,

                  bonafide_probability:
                    1.0 -
                    report.spoof_probability,

                  result:
                    report.result,
                }
              }
            ),
        }


        navigate(
          "/result",
          {
            replace: true,
            state: {
              result:
                aggregatedResult,
            },
          }
        )
      } else {
        navigate(
          "/result",
          {
            replace: true,
            state: {
              result:
                latestReportRef.current,
            },
          }
        )
      }
    }


    // ========================================================
    // UPLOADED FILE ANALYSIS
    // ========================================================

    const analyseUpload = async (
      blob
    ) => {
      if (!blob) return

      setStage(1)

      try {
        if (
          await checkSilence(blob)
        ) {
          navigate(
            "/result",
            {
              replace: true,
              state: {
                result: {
                  silent: true,
                },
              },
            }
          )

          return
        }


        setStage(2)


        const formData =
          new FormData()

        formData.append(
          "file",
          blob,
          blob.name ||
          "recording.webm"
        )


        const response =
          await fetch(
            "http://127.0.0.1:8000/analyze",
            {
              method: "POST",
              body: formData,
            }
          )


        if (!response.ok) {
          throw new Error(
            `Backend returned ${response.status}`
          )
        }


        const result =
          await response.json()


        if (!cancelled) {
          navigate(
            "/result",
            {
              replace: true,
              state: {
                result,
              },
            }
          )
        }
      } catch (error) {
        console.error(
          "Upload analysis error:",
          error
        )

        if (!cancelled) {
          navigate(
            "/result",
            {
              replace: true,
              state: {
                result: null,
              },
            }
          )
        }
      }
    }


    // ========================================================
    // LIVE MICROPHONE RECORDING
    // ========================================================

    const startRecording =
      async () => {
        try {
          setErrorMessage("")
          setStage(0)

          const stream =
            await navigator.mediaDevices
              .getUserMedia({
                audio: {
                  channelCount: 1,

                  echoCancellation:
                    false,

                  noiseSuppression:
                    false,

                  autoGainControl:
                    false,
                },
              })


          if (cancelled) {
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              )

            return
          }


          streamRef.current =
            stream


          recorder =
            new MediaRecorder(
              stream
            )

          recorder.start()


          // Clear old reports
          reportsRef.current = []
          latestReportRef.current =
            null

          setReports([])
          setLiveReport(null)


          // ==================================================
          // OPEN WEBSOCKET
          // ==================================================

          const socket =
            new WebSocket(
              getWebSocketUrl()
            )

          socket.binaryType =
            "arraybuffer"

          socketRef.current =
            socket


          socket.onopen = () => {
            setStage(1)
          }


          // ==================================================
          // RECEIVE BACKEND PREDICTIONS
          // ==================================================

          socket.onmessage =
            (event) => {
              try {
                const data =
                  JSON.parse(
                    event.data
                  )


                if (
                  data.type ===
                  "error"
                ) {
                  throw new Error(
                    data.message
                  )
                }


                if (
                  data.type !==
                    "prediction" ||
                  cancelled
                ) {
                  return
                }


                // --------------------------------------------
                // First expected report:
                // 4 seconds.
                //
                // Then:
                // 6, 8, 10...
                // --------------------------------------------

                const fallbackSeconds =
                  latestReportRef.current
                    ? (
                        latestReportRef
                          .current
                          .elapsed_seconds +
                        MODEL_HOP_SECONDS
                      )
                    : MODEL_WINDOW_SECONDS


                const report =
                  normaliseReport(
                    data,
                    fallbackSeconds
                  )


                latestReportRef.current =
                  report


                reportsRef.current = [
                  ...reportsRef.current,
                  report,
                ]


                setLiveReport(
                  report
                )


                setReports(
                  (current) => [
                    ...current,
                    report,
                  ]
                )


                setStage(2)
              } catch (error) {
                console.error(
                  "Live prediction error:",
                  error
                )
              }
            }


          socket.onerror = () => {
            setErrorMessage(
              "Live voice detection could not connect to the backend."
            )
          }


          // ==================================================
          // AUDIO CONTEXT
          // ==================================================

          const context =
            new AudioContext()

          audioContextRef.current =
            context

          await context.resume()


          const source =
            context.createMediaStreamSource(
              stream
            )

          sourceRef.current =
            source


          const processor =
            context.createScriptProcessor(
              4096,
              1,
              1
            )

          processorRef.current =
            processor


          // ==================================================
          // SEND PCM AUDIO TO BACKEND
          // ==================================================

          processor.onaudioprocess =
            (event) => {
              if (
                socket.readyState !==
                WebSocket.OPEN
              ) {
                return
              }


              const input =
                event.inputBuffer
                  .getChannelData(0)


              // Convert browser sample rate
              // to 16 kHz.
              const ratio =
                context.sampleRate /
                16000


              const pcm =
                new Int16Array(
                  Math.floor(
                    input.length /
                    ratio
                  )
                )


              for (
                let index = 0;
                index < pcm.length;
                index += 1
              ) {
                const position =
                  index * ratio

                const left =
                  Math.floor(
                    position
                  )

                const right =
                  Math.min(
                    left + 1,
                    input.length - 1
                  )

                const sample =
                  input[left] *
                    (
                      1 -
                      (
                        position -
                        left
                      )
                    ) +
                  input[right] *
                    (
                      position -
                      left
                    )


                const clipped =
                  Math.max(
                    -1,
                    Math.min(
                      1,
                      sample
                    )
                  )


                pcm[index] =
                  clipped < 0
                    ? clipped *
                      32768
                    : clipped *
                      32767
              }


              socket.send(
                pcm.buffer
              )
            }


          // ==================================================
          // KEEP SCRIPT PROCESSOR ACTIVE
          // ==================================================

          const silentGain =
            context.createGain()

          silentGain.gain.value =
            0

          source.connect(
            processor
          )

          processor.connect(
            silentGain
          )

          silentGain.connect(
            context.destination
          )


          // ==================================================
          // RECORDING TIMER
          // ==================================================

          setSecondsLeft(
            RECORDING_DURATION
          )

          setIsRecording(true)


          countdownId =
            window.setInterval(
              () => {
                setSecondsLeft(
                  (current) =>
                    Math.max(
                      0,
                      current - 1
                    )
                )
              },
              1000
            )


          // ==================================================
          // STOP AFTER 10 SECONDS
          // ==================================================

          stopId =
            window.setTimeout(
              () => {
                window.clearInterval(
                  countdownId
                )


                if (
                  recorder?.state !==
                  "inactive"
                ) {
                  recorder.stop()
                }


                disposeAudio()


                // Give backend a moment to return
                // the final overlapping 4-second window.
                finishId =
                  window.setTimeout(
                    finish,
                    900
                  )
              },
              RECORDING_DURATION *
                1000
            )
        } catch (error) {
          console.error(
            "Microphone error:",
            error
          )


          setErrorMessage(
            error?.name ===
              "NotAllowedError"
              ? "Microphone permission was denied. Allow microphone access and try again."
              : "Your microphone could not be accessed."
          )
        }
      }


    // ========================================================
    // SELECT ANALYSIS MODE
    // ========================================================

    if (mode === "record") {
      startRecording()
    } else {
      analyseUpload(
        incomingAudioBlob
      )
    }


    // ========================================================
    // CLEANUP
    // ========================================================

    return () => {
      cancelled = true

      window.clearInterval(
        countdownId
      )

      window.clearTimeout(
        stopId
      )

      window.clearTimeout(
        finishId
      )


      if (
        recorder?.state ===
        "recording"
      ) {
        recorder.stop()
      }


      disposeAudio()


      socketRef.current?.close()
      socketRef.current =
        null
    }
  }, [
    incomingAudioBlob,
    mode,
    navigate,
  ])


  // =========================================================
  // FORMAT PERCENTAGE
  // =========================================================

  const reportValue = (
    value
  ) =>
    `${Math.round(
      value * 100
    )}%`


  // =========================================================
  // UI
  // =========================================================

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
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 10,
                }
          }

          animate={
            reduceMotion
              ? false
              : {
                  opacity: 1,
                  y: 0,
                }
          }

          transition={{
            duration: 0.45,
          }}

          className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-5 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] sm:px-8"
        >

          {/* =================================================
              LEFT PANEL
          ================================================= */}

          <motion.div
            initial={
              reduceMotion
                ? false
                : {
                    scale: 0.97,
                    opacity: 0,
                  }
            }

            animate={
              reduceMotion
                ? false
                : {
                    scale: 1,
                    opacity: 1,
                  }
            }

            transition={{
              duration: 0.5,
            }}

            className="rounded-4xl border border-white/10 bg-white/6 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.24)] backdrop-blur sm:p-8"
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

                {isRecording
                  ? (
                    <Mic className="h-5 w-5 animate-pulse" />
                  )
                  : (
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
                  ? "Live model updates appear every 2 seconds after the first 4-second window"
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
                {errorMessage}
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


            <div className="mt-6 space-y-2 text-left">

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

                      {index < stage
                        ? (
                          <Check className="h-3.5 w-3.5" />
                        )
                        : (
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


            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">

              <ShieldCheck className="h-4 w-4 text-[#8bc8ba]" />

              No audio is stored after this session.

            </div>

          </motion.div>


          {/* =================================================
              LIVE MODEL CONSOLE
          ================================================= */}

          <motion.aside
            initial={
              reduceMotion
                ? false
                : {
                    opacity: 0,
                    x: 14,
                  }
            }

            animate={
              reduceMotion
                ? false
                : {
                    opacity: 1,
                    x: 0,
                  }
            }

            transition={{
              duration: 0.5,
              delay: reduceMotion
                ? 0
                : 0.12,
            }}

            className="overflow-hidden rounded-4xl border border-[#75a9ff]/20 bg-[#07101d]/90 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur"
          >

            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">

              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#a9caff]">

                <Terminal className="h-4 w-4" />

                Live model console

              </div>


              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#77e4c0]">

                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#50d3a8]" />

                STREAMING

              </span>

            </div>


            {/* =================================================
                CURRENT VALUES
            ================================================= */}

            <div className="grid grid-cols-3 gap-px border-b border-white/10 bg-white/10">

              {[
                [
                  "Spoof",
                  liveReport
                    ? reportValue(
                        liveReport.spoof_probability
                      )
                    : "--",
                ],

                [
                  "Confidence",
                  liveReport
                    ? reportValue(
                        liveReport.confidence
                      )
                    : "--",
                ],

                [
                  "Risk",
                  liveReport?.risk ??
                    "--",
                ],
              ].map(
                ([label, value]) => (

                  <div
                    key={label}
                    className="bg-[#0a1525] px-4 py-4"
                  >

                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#7185a7]">
                      {label}
                    </p>

                    <p className="mt-1 font-mono text-lg font-semibold text-[#deebff]">
                      {value}
                    </p>

                  </div>

                )
              )}

            </div>


            {/* =================================================
                CONSOLE REPORTS
            ================================================= */}

            <div
              ref={consoleRef}
              className="h-76 overflow-y-auto p-4 font-mono text-xs leading-6 sm:h-88"
            >

              <p className="text-[#6d84a7]">
                $ voice-shield --live --window 4s --hop 2s
              </p>

              <p className="text-[#6d84a7]">
                Waiting for first 4-second model window…
              </p>


              <AnimatePresence initial={false}>

                {reports.map(
                  (report, index) => (

                    <motion.div
                      key={`${report.elapsed_seconds}-${index}`}

                      initial={
                        reduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 8,
                            }
                      }

                      animate={{
                        opacity: 1,
                        y: 0,
                      }}

                      className="mt-3 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2"
                    >

                      <span className="text-[#79e0be]">

                        [
                        {String(
                          report.elapsed_seconds
                        ).padStart(
                          2,
                          "0"
                        )}
                        s]

                      </span>


                      <span className="ml-2 text-[#7db6ff]">

                        SPOOF{" "}
                        {reportValue(
                          report.spoof_probability
                        )}

                      </span>


                      <span className="ml-2 text-[#c3b5ff]">

                        CONF{" "}
                        {reportValue(
                          report.confidence
                        )}

                      </span>


                      <span
                        className={`ml-2 ${
                          report.risk === "HIGH"
                            ? "text-[#ff9d8c]"
                            : report.risk === "MEDIUM"
                              ? "text-[#ffd17a]"
                              : "text-[#79e0be]"
                        }`}
                      >

                        {report.risk} RISK

                      </span>

                    </motion.div>

                  )
                )}

              </AnimatePresence>


              {reports.length === 0 && (

                <p className="mt-4 text-[#879ab8]">
                  Capturing speech before the first 4-second analysis window.
                </p>

              )}

            </div>


            {/* =================================================
                FOOTER
            ================================================= */}

            <div className="border-t border-white/10 px-5 py-3 text-[11px] text-[#7890af]">

              4-second analysis window · new backend report every 2 seconds after the first result.

            </div>

          </motion.aside>

        </motion.section>

      </WavyBackground>

    </main>
  )
}


export default Analyzing