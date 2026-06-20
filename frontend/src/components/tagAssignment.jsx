import { useState } from 'react'

// Suggested long-form text (bio) with a show more/less toggle instead of
// always truncating — lets the user read the full text before applying.
export function ExpandableText({ value }) {
  const [expanded, setExpanded] = useState(false)
  if (!value) return <p className="text-plex-muted text-sm">—</p>
  return (
    <div className="space-y-1">
      <p className={`text-sm text-gray-300 ${expanded ? '' : 'line-clamp-4'}`}>{value}</p>
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="text-xs text-plex-orange hover:underline">
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

// Exclusive per-tag destination assignment — each tag is Style, Mood, or
// unassigned, never both, so the same suggested tag can't be duplicated into
// both Plex fields. Clicking a tag cycles unassigned → style → mood → unassigned.
export function useTagAssignment() {
  const [assignment, setAssignment] = useState({})
  function cycle(tag) {
    setAssignment(prev => {
      const cur = prev[tag]
      const next = { ...prev }
      if (cur === undefined) next[tag] = 'style'
      else if (cur === 'style') next[tag] = 'mood'
      else delete next[tag]
      return next
    })
  }
  return [assignment, cycle]
}

export function TagAssignChips({ items, assignment, onCycle, existingStyles = [], existingMoods = [] }) {
  if (!items?.length) return <p className="text-plex-muted text-sm">—</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(tag => {
        const state = assignment[tag]
        const isExisting = state === 'style' ? existingStyles.includes(tag)
          : state === 'mood' ? existingMoods.includes(tag)
          : false
        const cls = state === 'style'
          ? 'bg-plex-orange/15 text-plex-orange border-plex-orange/40'
          : state === 'mood'
            ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
            : 'bg-transparent text-plex-muted/50 border-plex-border/40 hover:border-plex-muted'
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onCycle(tag)}
            title={state ? `Assigned as ${state}${isExisting ? ' (already in Plex)' : ''}` : 'Click to assign as style, click again for mood'}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs border transition-colors ${cls}`}
          >
            {isExisting && <span className="opacity-60">✓</span>}
            {tag}
            {state && <span className="text-[9px] uppercase opacity-70">{state === 'style' ? 'S' : 'M'}</span>}
          </button>
        )
      })}
    </div>
  )
}
