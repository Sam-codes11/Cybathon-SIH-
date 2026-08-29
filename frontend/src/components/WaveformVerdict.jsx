import { motion } from "framer-motion"
import clsx from "clsx"

const variantConfig = {
  human: { dot: "bg-verified-500" },
  uncertain: { dot: "bg-caution-500" },
  synthetic: { dot: "bg-alert-600" },
}

function WaveformVerdict({ variant = "uncertain", state = "idle", size = "full", className }) {
  const config = variantConfig[variant] || variantConfig.human
  const barCount = size === "sparkline" ? 24 : 48
  const bars = Array.from({ length: barCount })
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <div className={clsx("overflow-hidden", className)}>
      <div className={clsx("flex items-center justify-center gap-1", size === "sparkline" ? "h-8" : "h-28")}>
        {bars.map((_, index) => {
          const baseHeight =
            20 +
            Math.abs(Math.sin(index * 0.55)) * 55 +
            (index % 7) * 3
          const settledHeight = state === "settled" ? 30 + (index % 5) * 8 : baseHeight

          if (prefersReducedMotion || state !== "analyzing") {
            return (
              <div
                key={index}
                className={clsx("w-1 rounded-pill", config.dot)}
                style={{ height: `${settledHeight}%`, opacity: 0.7 }}
              />
            )
          }

          return (
            <motion.div
              key={index}
              className={clsx("w-1 rounded-full", config.dot)}
              style={{ opacity: 0.7 }}
              animate={{ height: [`${baseHeight * 0.5}%`, `${baseHeight}%`, `${baseHeight * 0.6}%`] }}
              transition={{
                duration: 1.2 + (index % 5) * 0.1,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.02,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

export default WaveformVerdict
