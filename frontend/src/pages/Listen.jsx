import { useRef, useState } from "react"
import Navbar from "../components/Navbar"
import { WavyBackground } from "../components/WavyBackground"

const getListenUrl = (code) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const host = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
  return `${protocol}//${host}:8000/audio-listen?session_id=${encodeURIComponent(code)}`
}

function Listen() {
  const [code, setCode] = useState("")
  const [status, setStatus] = useState("idle") // idle | connecting | listening | error
  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const nextPlayTimeRef = useRef(0)

  const join = () => {
    if (!code.trim()) return
    setStatus("connecting")

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const context = new AudioContextClass({ sampleRate: 16000 })
    audioContextRef.current = context
    nextPlayTimeRef.current = context.currentTime + 0.15

    const socket = new WebSocket(getListenUrl(code.trim().toUpperCase()))
    socket.binaryType = "arraybuffer"
    socketRef.current = socket

    socket.onopen = () => setStatus("listening")
    socket.onerror = () => setStatus("error")
    socket.onclose = () => setStatus((current) => (current === "listening" ? "idle" : current))

    socket.onmessage = (event) => {
      const int16 = new Int16Array(event.data)
      const float32 = new Float32Array(int16.length)
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
      const buffer = context.createBuffer(1, float32.length, 16000)
      buffer.getChannelData(0).set(float32)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      const startAt = Math.max(context.currentTime, nextPlayTimeRef.current)
      source.start(startAt)
      nextPlayTimeRef.current = startAt + buffer.duration
    }
  }

  const leave = () => {
    socketRef.current?.close()
    audioContextRef.current?.close()
    setStatus("idle")
  }

  return (
    <main className="min-h-screen bg-[#101b2f] text-white">
      <WavyBackground backgroundFill="#101b2f" waveOpacity={0.4} colors={["#22d3ee", "#38bdf8", "#818cf8"]}>
        <Navbar />
        <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
          <h1 className="font-display text-2xl font-semibold">Listen to a live call</h1>
          <p className="text-sm text-[#8291aa]">Enter the code shown on the recording device to hear the call as it's analyzed.</p>

          {status !== "listening" ? (
            <>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. AB12CD"
                className="w-48 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center font-mono text-lg tracking-widest text-white outline-none"
                maxLength={6}
              />
              <button
                onClick={join}
                disabled={status === "connecting"}
                className="rounded-full bg-[#3a7eea] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {status === "connecting" ? "Connecting..." : "Join"}
              </button>
              {status === "error" && <p className="text-xs text-red-300">Couldn't connect — check the code and that the backend is reachable.</p>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-full bg-[#1a3a2a] px-4 py-2 text-sm text-[#7ee0b0]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#7ee0b0]" />
                Listening — code {code.toUpperCase()}
              </div>
              <button onClick={leave} className="rounded-full border border-white/20 px-5 py-2 text-sm text-white">
                Leave
              </button>
            </>
          )}
        </section>
      </WavyBackground>
    </main>
  )
}

export default Listen
