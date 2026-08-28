import { motion } from "framer-motion"

function VoiceWave() {
  const bars = Array.from({ length: 70 })

  return (
    <div className="flex h-28 items-center justify-center gap-[3px] overflow-hidden">
      {bars.map((_, index) => {
        const height =
          20 +
          Math.abs(Math.sin(index * 0.55)) * 55 +
          (index % 7) * 3

        return (
          <motion.div
            key={index}
            className="w-[3px] rounded-full bg-cyan-300/60"
            style={{ height: `${height}%` }}
            animate={{
              scaleY: [0.5, 1, 0.65, 0.9, 0.5],
            }}
            transition={{
              duration: 1.5 + (index % 5) * 0.15,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.015,
            }}
          />
        )
      })}
    </div>
  )
}

export default VoiceWave