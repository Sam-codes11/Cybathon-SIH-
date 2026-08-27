import { motion } from "framer-motion"
import { Activity, ArrowRight, Mic } from "lucide-react"
import Navbar from "../components/Navbar"
import VoiceWave from "../components/VoiceWave"

function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07080c] text-white">

      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-300px] h-[650px] w-[650px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[150px]" />

        <div className="absolute right-[-250px] top-[35%] h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-[160px]" />

        <div className="absolute bottom-[-300px] left-[-200px] h-[500px] w-[500px] rounded-full bg-blue-500/5 blur-[140px]" />
      </div>

      <Navbar />

      {/* Hero */}
      <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 pb-20 pt-32 text-center">

        {/* Status */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-4 py-2 text-xs text-cyan-200"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
          AI-POWERED VOICE SECURITY
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="max-w-5xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl md:text-8xl"
        >
          Your voice isn't
          <br />

          <span className="bg-gradient-to-r from-white via-cyan-200 to-white bg-clip-text text-transparent">
            always your voice.
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-7 max-w-2xl text-base leading-7 text-white/50 md:text-lg"
        >
          Detect AI-generated and cloned voices before they become
          impersonation threats. VoiceGuard combines voice analysis,
          identity verification and risk intelligence.
        </motion.p>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <button className="group flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3 font-medium text-black transition-transform hover:scale-[1.03]">
            Analyze a voice

            <ArrowRight
              size={17}
              className="transition-transform group-hover:translate-x-1"
            />
          </button>

          <button className="rounded-full border border-white/15 px-7 py-3 font-medium text-white transition-all hover:border-white/30 hover:bg-white/5">
            Explore technology
          </button>
        </motion.div>

        {/* Analysis visualization */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.65 }}
          className="relative mt-20 w-full max-w-4xl"
        >
          <div className="absolute inset-0 rounded-3xl bg-cyan-400/5 blur-3xl" />

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 backdrop-blur-xl">

            <div className="mb-6 flex items-center justify-between text-xs text-white/40">

              <div className="flex items-center gap-2">
                <Mic size={14} />
                LIVE VOICE ANALYSIS
              </div>

              <div className="flex items-center gap-2">
                <Activity size={14} className="text-cyan-300" />
                MONITORING
              </div>

            </div>

            <VoiceWave />

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/40">

              <span>Voice signal detected</span>

              <span className="text-cyan-300">
                Analyzing...
              </span>

            </div>

          </div>
        </motion.div>

        {/* Product capabilities */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-xs tracking-wider text-white/30"
        >
          <span>REAL-TIME ANALYSIS</span>
          <span>•</span>
          <span>VOICE AUTHENTICITY</span>
          <span>•</span>
          <span>IDENTITY VERIFICATION</span>
          <span>•</span>
          <span>RISK INTELLIGENCE</span>
        </motion.div>

      </section>
    </main>
  )
}

export default Home