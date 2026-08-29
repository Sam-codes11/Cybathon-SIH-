const LABELS = {
  synthetic: {
    title: 'Synthetic likelihood',
    description: 'How closely this clip matches known AI-generated speech patterns.',
  },
  speakerMatch: {
    title: 'Speaker match',
    description: 'How closely this voice matches an enrolled trusted contact.',
  },
}

function scoreColor(score) {
  if (score >= 70) return 'text-alert-600'
  if (score >= 40) return 'text-caution-500'
  return 'text-verified-500'
}

function EvidenceCard({ type, score, noData = false }) {
  const config = LABELS[type]

  if (!config) return null

  const scoreClasses = [
    'mt-4 font-mono text-2xl font-medium tabular-nums',
    scoreColor(score),
  ].join(' ')

  return (
    <div className="rounded-md border border-ink-slate-600/10 bg-white p-5 shadow-resting">
      <p className="font-body text-sm font-medium text-ink-900">{config.title}</p>
      <p className="mt-1 font-body text-xs text-ink-slate-600/70">{config.description}</p>

      {noData ? (
        <p className="mt-4 font-body text-sm text-ink-slate-600/60">
          No reference voice on file.
        </p>
      ) : (
        <p className={scoreClasses}>{score}%</p>
      )}
    </div>
  )
}

export default EvidenceCard