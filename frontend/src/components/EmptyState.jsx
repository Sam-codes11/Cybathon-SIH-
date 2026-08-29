import clsx from "clsx"
import ActionButton from "./ActionButton"

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  variant = "primary",
  className,
}) {
  return (
    <div
      className={clsx(
        "rounded-md border border-ink-slate-600/10 bg-paper-50 p-6 shadow-resting",
        className,
      )}
    >
      <h3 className="font-display text-lg font-semibold text-ink-900">
        {title}
      </h3>
      <p className="mt-1 font-body text-sm text-ink-slate-600">
        {description}
      </p>
      {onAction && (
        <div className="mt-4">
          <ActionButton variant={variant} onClick={onAction}>
            {actionLabel}
          </ActionButton>
        </div>
      )}
    </div>
  )
}

export default EmptyState
