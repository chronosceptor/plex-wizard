import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function serviceUrl(service, id) {
  if (service === 'discogs')     return `https://www.discogs.com/artist/${id}`
  if (service === 'lastfm')      return `https://www.last.fm/music/${encodeURIComponent(id)}`
  if (service === 'musicbrainz') return `https://musicbrainz.org/artist/${id}`
  return '#'
}

export default function CompoundLinksSection({ ratingKey, service, renderSearch, defaultComponent = '' }) {
  const qc = useQueryClient()
  const [newComponent, setNewComponent] = useState(defaultComponent)
  const [activeComponent, setActiveComponent] = useState(null)

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['compound-components', ratingKey],
    queryFn: async () => {
      const res = await fetch(`/api/artist/${ratingKey}/compound-components`)
      if (!res.ok) throw new Error('Failed to load components')
      return res.json()
    },
    staleTime: 0,
  })

  const serviceComponents = components.filter(c => c.service === service)

  const addLink = useMutation({
    mutationFn: async ({ component, service_id }) => {
      const res = await fetch(`/api/artist/${ratingKey}/compound-components`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component, service, service_id }),
      })
      if (!res.ok) throw new Error('Failed to save link')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compound-components', ratingKey] })
      setActiveComponent(null)
    },
  })

  const removeLink = useMutation({
    mutationFn: async ({ component }) => {
      const params = new URLSearchParams({ component, service })
      const res = await fetch(`/api/artist/${ratingKey}/compound-components?${params}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove link')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compound-components', ratingKey] }),
  })

  function handleAddComponent(e) {
    e.preventDefault()
    const name = newComponent.trim()
    if (name) {
      setActiveComponent(name)
      setNewComponent('')
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-plex-muted uppercase tracking-wider">Component artists</p>

      {isLoading && <p className="text-xs text-plex-muted animate-pulse">Loading...</p>}

      {/* Existing linked components */}
      {serviceComponents.length > 0 && (
        <div className="space-y-1.5">
          {serviceComponents.map(c => (
            <div key={c.component} className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-white">{c.component}</span>
                <span className="text-xs text-green-600">→</span>
                <a
                  href={serviceUrl(service, c.service_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-400 hover:text-green-300 font-mono truncate"
                >
                  {c.service_id} ↗
                </a>
              </div>
              <button
                onClick={() => removeLink.mutate({ component: c.component })}
                disabled={removeLink.isPending}
                className="text-green-400 hover:text-green-300 text-xs disabled:opacity-50 ml-3 flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search panel for the active component */}
      {activeComponent && (
        <div className="border border-plex-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-plex-muted">
              Linking: <span className="text-white font-medium">{activeComponent}</span>
            </p>
            <button
              onClick={() => setActiveComponent(null)}
              className="text-plex-muted hover:text-white text-sm leading-none"
            >
              ×
            </button>
          </div>
          {renderSearch(activeComponent, (service_id) =>
            addLink.mutate({ component: activeComponent, service_id })
          )}
          {addLink.isError && (
            <p className="text-red-400 text-xs">{addLink.error.message}</p>
          )}
        </div>
      )}

      {/* Add new component */}
      {!activeComponent && (
        <form onSubmit={handleAddComponent} className="flex gap-2">
          <input
            type="text"
            value={newComponent}
            onChange={e => setNewComponent(e.target.value)}
            placeholder="Add component artist name..."
            className="flex-1 bg-plex-dark border border-plex-border rounded-lg px-3 py-2 text-sm text-white placeholder-plex-muted focus:outline-none focus:border-plex-orange"
          />
          <button
            type="submit"
            disabled={!newComponent.trim()}
            className="px-3 py-2 bg-plex-dark border border-plex-border hover:border-plex-orange text-white text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            + Add
          </button>
        </form>
      )}
    </div>
  )
}
