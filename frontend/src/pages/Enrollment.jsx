import { useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import Navbar from "../components/Navbar"
import ActionButton from "../components/ActionButton"
import EmptyState from "../components/EmptyState"
import { WavyBackground } from "../components/WavyBackground"

function Enrollment() {
  const [profiles, setProfiles] = useState([])
  const reduceMotion = useReducedMotion()
  const addProfile = () => setProfiles((current) => [...current, { id: crypto.randomUUID(), label: `Trusted voice ${current.length + 1}` }])

  return (
    <WavyBackground backgroundFill="#eef3fb" waveOpacity={0.3} speed="slow" colors={["#22d3ee", "#60a5fa", "#818cf8", "#a78bfa"]}>
    <main className="min-h-screen text-ink-slate-600">
      <Navbar />
      <motion.section initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mx-auto max-w-xl px-6 pt-16 pb-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">Add a trusted voice</h1>
        <p className="mt-3 text-sm">Add a 10-30 second reference clip and label it, such as “Dad” or “CEO”.</p>
        <div className="mt-8"><ActionButton onClick={addProfile}>Add a voice profile</ActionButton></div>
        <div className="mt-10 text-left">
          <h2 className="text-sm font-medium text-ink-900">Trusted voices</h2>
          {profiles.length === 0 ? (
            <EmptyState className="mt-3 text-center" title="No trusted voices added yet" description="Add a contact above to enroll their voice." />
          ) : (
            <motion.ul layout className="mt-3 space-y-2">{profiles.map((profile) => <motion.li layout key={profile.id} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={reduceMotion ? false : { opacity: 1, y: 0 }} className="rounded-md border border-ink-slate-600/10 bg-white px-4 py-3 text-sm text-ink-900 shadow-resting">{profile.label}</motion.li>)}</motion.ul>
          )}
        </div>
      </motion.section>
    </main>
    </WavyBackground>
  )
}

export default Enrollment
