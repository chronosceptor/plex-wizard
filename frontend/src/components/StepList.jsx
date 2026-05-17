export default function StepList({ steps = [], compact = false }) {
  if (compact) {
    return (
      <div className="space-y-1">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="flex-shrink-0 w-3 text-center">
                {step.status === 'done'    && <span className="text-green-400">✓</span>}
                {step.status === 'running' && <span className="text-plex-orange animate-pulse">›</span>}
                {step.status === 'pending' && <span className="text-plex-border">·</span>}
              </span>
              <span className={`truncate ${
                step.status === 'done'    ? 'text-white/60' :
                step.status === 'running' ? 'text-white' :
                'text-plex-border'
              }`}>
                {step.label}
              </span>
            </div>
            <span className="flex-shrink-0 ml-2 font-mono text-plex-muted">
              {step.status === 'done'    && `${step.duration}s`}
              {step.status === 'running' && <span className="text-plex-orange">…</span>}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.key} className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 w-4 text-center">
              {step.status === 'done'    && <span className="text-green-400 text-sm">✓</span>}
              {step.status === 'running' && <span className="text-plex-orange animate-pulse">›</span>}
              {step.status === 'pending' && <span className="text-plex-border text-sm">·</span>}
            </span>
            <span className={`text-sm truncate ${
              step.status === 'done'    ? 'text-white/60' :
              step.status === 'running' ? 'text-white font-medium' :
              'text-plex-border'
            }`}>
              {step.label}
            </span>
          </div>
          <span className="flex-shrink-0 ml-4 text-sm font-mono text-plex-muted tabular-nums">
            {step.status === 'done'    && `${step.duration}s`}
            {step.status === 'running' && <span className="text-plex-orange animate-pulse">corriendo</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
