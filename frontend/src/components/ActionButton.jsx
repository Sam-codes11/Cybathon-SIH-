import { motion } from "framer-motion"

const VARIANTS = {
  primary: {
    base: 'bg-ink-900 text-paper-50',
    hover: 'hover:bg-ink-900/90',
    active: 'active:bg-ink-900/80',
  },
  secondary: {
    base: 'bg-transparent text-ink-900 border border-ink-slate-600/20',
    hover: 'hover:bg-ink-slate-600/5',
    active: 'active:bg-ink-slate-600/10',
  },
  destructive: {
    base: 'bg-alert-600 text-paper-50',
    hover: 'hover:bg-alert-600/90',
    active: 'active:bg-alert-600/80',
  },
}

function ActionButton({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
}) {
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const config = VARIANTS[variant]
  const isDisabled = disabled || loading

  const classes = [
    'inline-flex items-center justify-center gap-2',
    'rounded-md px-5 py-2.5',
    'font-body text-sm font-medium',
    'transition-colors duration-150',
    'disabled:cursor-not-allowed disabled:opacity-40',
    config.base,
    !isDisabled ? config.hover : '',
    !isDisabled ? config.active : '',
  ].join(' ')

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={classes}
      whileHover={prefersReducedMotion ? {} : { y: -2 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      transition={prefersReducedMotion ? {} : { type: "spring", stiffness: 400, damping: 25 }}
      initial={prefersReducedMotion ? false : undefined}
      animate={prefersReducedMotion ? false : undefined}
    >
      {loading ? (
        <>
          <span
            className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
          <span>Working…</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  )
}

export default ActionButton