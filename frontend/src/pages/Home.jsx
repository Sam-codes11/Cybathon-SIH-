import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  AudioLines,
  BarChart3,
  Check,
  Clock3,
  Fingerprint,
  LockKeyhole,
  Mic,
  RadioTower,
  ShieldCheck,
  Upload,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import { WavyBackground } from "../components/WavyBackground"

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

  return rms < 0.01
}

const details = [
  ["Voice classification", "Human, cloned, converted, or synthesized."],
  ["Risk assessment", "A clear score with the evidence behind it."],
  ["Attack indicators", "Replay, TTS, AI clone, and conversion signals."],
]

const processSteps = [
  ["01", "Capture", "Record a short clip or upload audio from a call.", Mic],
  ["02", "Inspect", "Check voice texture, timing, and synthesis artifacts.", Fingerprint],
  ["03", "Respond", "Get a practical risk report and a safer next step.", ShieldCheck],
]

const protectionPoints = [
  ["Fast prototype analysis", "A clear report in moments, designed for high-pressure calls.", Clock3],
  ["Signal-led assessment", "See the factors behind a result instead of a black-box verdict.", BarChart3],
  ["Private by design", "Audio is used for the current session and not retained by this demo.", LockKeyhole],
]

function Home() {
  const navigate = useNavigate()
  const uploadRef = useRef(null)
  const [recording, setRecording] = useState(false)

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks = []

  recorder.ondataavailable = (e) => chunks.push(e.data)

  recorder.onstop = () => {
    const audioBlob = new Blob(chunks, { type: "audio/webm" })
    navigate("/analyzing", { state: { source: "Microphone sample", audioBlob } })
  }

  recorder.start()
  setRecording(true)

  setTimeout(() => {
    recorder.stop()
    setRecording(false)
  }, 10000) // 5 second recording — yahi number badalna hai duration ke liye
}

  const reduceMotion = useReducedMotion()

  const enter = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.65,
          ease: [0.22, 1, 0.36, 1],
        },
      }

  const uploadSample = (event) => {
    const file = event.target.files?.[0]

    if (file) {
      navigate("/analyzing", {
        state: { source: file.name, audioBlob: file },
      })
    }

    event.target.value = ""
  }

  return (
    <WavyBackground
      backgroundFill="#070b14"
      colors={[
        "#22d3ee",
        "#38bdf8",
        "#60a5fa",
        "#818cf8",
        "#a78bfa",
      ]}
      waveWidth={55}
      blur={12}
      speed="fast"
      waveOpacity={0.58}
      containerClassName="min-h-screen"
    >
      <main className="min-h-screen overflow-hidden text-white">
        <Navbar />

        {/* HERO SECTION */}
        <section className="relative isolate border-b border-white/8 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:pb-28">
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_0.9fr]">

            {/* LEFT SIDE */}
            <motion.div {...enter}>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#6da3ff]/30 bg-[#16294d]/40 px-3 py-1.5 text-xs font-semibold tracking-[0.13em] text-[#a9c7ff]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#72a2ff] shadow-[0_0_12px_#72a2ff]" />
                VOICE AUTHENTICITY PROTOTYPE
              </div>

              <h1 className="mt-7 max-w-2xl font-display text-5xl font-semibold leading-[0.98] tracking-[-0.06em] text-[#f4f7ff] sm:text-6xl lg:text-7xl">
                Verify the voice behind the call.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-[#a8b3c8] sm:text-lg">
                Submit one voice sample. Voice Shield checks for synthetic-speech
                patterns and returns the type of voice, risk score, and likely
                attack method.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <motion.button
                  type="button"
                  onClick={startRecording}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#e7efff] px-5 py-3.5 text-sm font-semibold text-[#10182a] transition hover:-translate-y-0.5 hover:bg-white"
                  whileHover={reduceMotion ? {} : { y: -2 }}
                  whileTap={reduceMotion ? {} : { scale: 0.98 }}
                >
                  <Mic className="h-4 w-4" />
                  Record voice sample
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => uploadRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-[#d8e2f5] transition hover:border-[#7eaaff]/60 hover:bg-[#13223e]"
                  whileHover={reduceMotion ? {} : { y: -2 }}
                  whileTap={reduceMotion ? {} : { scale: 0.98 }}
                >
                  <Upload className="h-4 w-4" />
                  Upload audio
                </motion.button>
              </div>

              <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#8090aa]">
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#76baff]" />
                  Single-sample analysis
                </span>

                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#76baff]" />
                  No account needed
                </span>

                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#76baff]" />
                  Prototype report
                </span>
              </div>
            </motion.div>

            {/* RIGHT SIDE */}
            <motion.div
              {...enter}
              transition={{
                duration: 0.75,
                delay: reduceMotion ? 0 : 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative mx-auto w-full max-w-md"
            >
              <div className="signal-card rounded-[2rem] border border-white/10 bg-[#0c1322]/85 p-6 shadow-[0_30px_90px_rgba(1,5,17,0.65)] backdrop-blur sm:p-8">

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#80a9ef]">
                      Signal capture
                    </p>

                    <p className="mt-2 font-display text-xl font-semibold text-white">
                      Ready for a sample
                    </p>
                  </div>

                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#6c9af5]/25 bg-[#234273]/35 text-[#a4c7ff]">
                    <AudioLines className="h-5 w-5" />
                  </span>
                </div>

                <div className="orb-stage mt-7">
                  <div className="signal-orb" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>

                  <p className="relative z-10 mt-5 text-sm font-medium text-[#d7e5ff]">
                    Listening for voice characteristics
                  </p>

                  <p className="relative z-10 mt-1 text-xs text-[#8291aa]">
                    Tap record or add a voice sample to begin
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/[0.045] px-2 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#71829e]">
                      Input
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#d7e5ff]">
                      Audio
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.045] px-2 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#71829e]">
                      Model
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#d7e5ff]">
                      Detect
                    </p>
                  </div>

                  <div className="rounded-xl bg-white/[0.045] px-2 py-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#71829e]">
                      Output
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#d7e5ff]">
                      Report
                    </p>
                  </div>
                </div>

              </div>
            </motion.div>

          </div>
        </section>

        {/* INFORMATION SECTION */}
        <section className="bg-[#0a101d]/78 px-5 py-20 backdrop-blur-[2px] sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">

            <motion.div
              {...enter}
              whileInView={
                reduceMotion
                  ? undefined
                  : { opacity: 1, y: 0 }
              }
              viewport={{ once: true, amount: 0.2 }}
              className="max-w-2xl"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7fa9f3]">
                One sample. A useful report.
              </p>

              <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-[#edf3ff] sm:text-4xl">
                Only the signals that help you decide what to do next.
              </h2>
            </motion.div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {details.map(([title, copy], index) => (
                <motion.article
                  key={title}
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 18 }
                  }
                  whileInView={
                    reduceMotion
                      ? undefined
                      : { opacity: 1, y: 0 }
                  }
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{
                    duration: 0.5,
                    delay: reduceMotion ? 0 : index * 0.1,
                  }}
                  className="spotlight-panel rounded-2xl border border-white/10 bg-[#0e1728] p-6"
                >
                  <span className="text-xs font-mono text-[#7fa9f3]">
                    0{index + 1}
                  </span>

                  <h3 className="mt-10 font-display text-xl font-semibold text-[#edf3ff]">
                    {title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-[#96a4bc]">
                    {copy}
                  </p>
                </motion.article>
              ))}
            </div>

            <div className="mt-12 flex items-center gap-3 rounded-2xl border border-[#3b69b9]/25 bg-[#111f38] px-5 py-4 text-sm text-[#b7caf0]">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#79b9ff]" />
              Results are shown as a clear assessment, not a vague confidence
              label.
            </div>

          </div>
        </section>

        <section className="relative border-y border-white/8 bg-[#070d18]/78 px-5 py-20 backdrop-blur-[2px] sm:px-8 lg:py-28">
          <div className="cyber-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-between gap-5 md:flex-row md:items-end"
            >
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7fa9f3]">A calmer way to check a call</p>
                <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-[#edf3ff] sm:text-4xl">From an unfamiliar voice to a clear next move.</h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[#95a4bc]">Voice Shield turns technical signals into a simple, usable decision path for suspicious calls.</p>
            </motion.div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {processSteps.map(([number, title, copy, Icon], index) => (
                <motion.article
                  key={title}
                  initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.1 }}
                  whileHover={reduceMotion ? {} : { y: -5 }}
                  className="rounded-2xl border border-white/10 bg-[#0d1728]/90 p-6 shadow-[0_18px_45px_rgba(1,5,17,0.22)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#78abf7]">{number}</span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-[#669bf2]/20 bg-[#1a345d]/45 text-[#9cc6ff]"><Icon className="h-5 w-5" /></span>
                  </div>
                  <h3 className="mt-10 font-display text-xl font-semibold text-[#edf3ff]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#96a4bc]">{copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0a101d]/78 px-5 py-20 backdrop-blur-[2px] sm:px-8 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, x: -18 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#6da3ff]/25 bg-[#132546] px-3 py-1.5 text-xs font-semibold tracking-[0.13em] text-[#a9c7ff]"><RadioTower className="h-3.5 w-3.5" /> BUILT FOR THE MOMENT</div>
              <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.04em] text-[#edf3ff] sm:text-4xl">Useful information, when hesitation matters.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#9ba9c0]">A convincing voice should not force an instant decision. Review the evidence, then verify through a contact channel you already trust.</p>
              <motion.button
                type="button"
                onClick={() => navigate("/analyzing", { state: { source: "Quick prototype check" } })}
                whileHover={reduceMotion ? {} : { y: -2 }}
                whileTap={reduceMotion ? {} : { scale: 0.98 }}
                className="mt-8 inline-flex items-center gap-2 rounded-xl border border-[#83b3ff]/35 bg-[#142a4e] px-5 py-3 text-sm font-semibold text-[#e7f0ff] transition hover:bg-[#1a3968]"
              >
                Try a prototype check <ArrowRight className="h-4 w-4" />
              </motion.button>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {protectionPoints.map(([title, copy, Icon], index) => (
                <motion.article
                  key={title}
                  initial={reduceMotion ? false : { opacity: 0, x: 18 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.09 }}
                  className="flex gap-4 rounded-2xl border border-white/9 bg-white/[0.035] p-5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#18335d] text-[#9ac6ff]"><Icon className="h-5 w-5" /></span>
                  <div><h3 className="font-display text-base font-semibold text-[#e7efff]">{title}</h3><p className="mt-1.5 text-sm leading-6 text-[#96a4bc]">{copy}</p></div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/8 bg-[#070b14]/78 px-5 py-16 backdrop-blur-[2px] sm:px-8">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="mx-auto flex max-w-6xl flex-col gap-6 rounded-3xl border border-[#5d91e7]/20 bg-[linear-gradient(115deg,rgba(25,54,98,0.72),rgba(11,21,38,0.9))] p-7 sm:p-10 md:flex-row md:items-center md:justify-between"
          >
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a3c5ff]">Voice Shield prototype</p><h2 className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Start with the voice. Decide with confidence.</h2></div>
            <motion.button type="button" onClick={() => uploadRef.current?.click()} whileHover={reduceMotion ? {} : { y: -2 }} whileTap={reduceMotion ? {} : { scale: 0.98 }} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-[#12203b] transition hover:bg-[#e7efff]">Upload a sample <Upload className="h-4 w-4" /></motion.button>
          </motion.div>
        </section>

        {/* HIDDEN FILE INPUT */}
        <input
          ref={uploadRef}
          type="file"
          accept="audio/*"
          onChange={uploadSample}
          className="sr-only"
        />
      </main>
    </WavyBackground>
  )
}

export default Home
