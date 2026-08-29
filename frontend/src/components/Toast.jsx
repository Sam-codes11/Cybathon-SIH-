import clsx from "clsx"

const variantConfig = {
  success: {
    dot: "bg-verified-500",
  },
  warning: {
    dot: "bg-caution-500",
  },
  error: {
    dot: "bg-alert-600",
  },
}

function Toast({ message, variant = "success", onDismiss, className }) {
  const config = variantConfig[variant] || variantConfig.success

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex items-start gap-3 rounded-md bg-paper-50 px-4 py-3 shadow-resting",
        className,
      )}
    >
      <span
        className={clsx("mt-1 h-2 w-2 shrink-0 rounded-pill", config.dot)}
        aria-hidden="true"
      />
      <p className="flex-1 font-body text-sm text-ink-900">
        {message}
      </p>
      {onDismiss && (
        <button
          type="button"
          className="shrink-0 rounded-sm p-1 text-ink-slate-600 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verified-500"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default Toast
