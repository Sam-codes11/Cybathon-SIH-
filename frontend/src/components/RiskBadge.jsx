import { motion } from "framer-motion"

const VARIANTS = {
  human: {
    label: 'Likely Human',
    bg: 'bg-verified-500/10',
    text: 'text-verified-500',
    dot: 'bg-verified-500',
  },
  uncertain: {
    label: 'Uncertain',
    bg: 'bg-caution-500/10',
    text: 'text-caution-500',
    dot: 'bg-caution-500',
  },
  synthetic: {
    label: 'Likely AI-Generated',
    bg: 'bg-alert-600/10',
    text: 'text-alert-600',
    dot: 'bg-alert-600',
  },
}

function RiskBadge({ variant, tooltip }) {
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const config = VARIANTS[variant]

  if (!config) return null

  return (
    <motion.span
      role="status"
      aria-label={config.label}
      title={tooltip}
      className={`inline-flex items-center gap-2 rounded-pill px-3 py-1.5 ${config.bg}`}
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={prefersReducedMotion ? false : { opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? {} : { duration: 0.3, ease: "easeOut" }}
    >
      <span className={`h-2 w-2 rounded-pill ${config.dot}`} aria-hidden="true" />
      <span className={`font-body text-sm font-medium ${config.text}`}>
        {config.label}
      </span>
    </motion.span>
  )
}

export default RiskBadge