import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLibraries } from '../api/plex'
import { useScan } from '../context/ScanContext'
const navItems = [
  { to: '/', label: 'Dashboard' },
  { divider: true },
  { to: '/artists', label: 'Artists' },
  { to: '/genres', label: 'Genres' },
  { to: '/albums-no-match', label: 'Albums without match' },
  { to: '/albums', label: 'Albums without artwork' },
  { to: '/tracks', label: 'Incomplete tracks' },
  { to: '/listening', label: 'Listening stats' },
  { divider: true },
  { to: '/playlists', label: 'Generate playlist' },
]

function ScanProgress({ steps = [] }) {
  const done = steps.filter(s => s.status === 'done').length
  const total = steps.length || 6
  const current = steps.find(s => s.status === 'running')
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="p-3 border-b border-plex-border">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-plex-muted">Scanning...</span>
        <span className="text-xs text-plex-orange font-mono">{done}/{total}</span>
      </div>
      <div className="w-full bg-plex-dark rounded-full h-1.5 mb-1.5">
        <div
          className="bg-plex-orange h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      {current && (
        <p className="text-xs text-plex-muted truncate">
          <span className="text-white/60">›</span> {current.label}
        </p>
      )}
    </div>
  )
}

export default function Layout() {
  const { library, setLibrary, status, rescan } = useScan()
  const navigate = useNavigate()

  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: fetchLibraries,
  })

  // Auto-select if only one music library exists
  useEffect(() => {
    if (libraries.length === 1 && !library) {
      setLibrary(libraries[0].name)
    }
  }, [libraries, library, setLibrary])

  function handleLibraryChange(e) {
    const lib = e.target.value
    setLibrary(lib)
    navigate('/')
  }

  const isScanning = status.status === 'scanning'
  const isDone = status.status === 'done'
  const isError = status.status === 'error'

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-plex-card border-r border-plex-border flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-plex-border">
          <div className="flex items-center gap-2">
            <span className="text-plex-orange text-xl font-bold">⬡</span>
            <span className="font-bold text-lg">Plex Wizard</span>
          </div>
        </div>

        {/* Library selector */}
        <div className="p-3 border-b border-plex-border">
          <label className="block text-xs text-plex-muted mb-1">Library</label>
          <select
            value={library}
            onChange={handleLibraryChange}
            className="w-full bg-plex-dark border border-plex-border rounded px-2 py-1 text-sm focus:outline-none focus:border-plex-orange"
          >
            <option value="">Select...</option>
            {libraries.map((lib) => (
              <option key={lib.name} value={lib.name}>
                {lib.name}
              </option>
            ))}
          </select>
        </div>

        {/* Scan progress / status */}
        {isScanning && <ScanProgress steps={status.steps ?? []} />}

        {isDone && (
          <div className="p-3 border-b border-plex-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">Scan complete ✓</span>
              <button
                onClick={rescan}
                className="text-xs text-plex-muted hover:text-white underline"
              >
                Re-scan
              </button>
            </div>
            {status.scannedAt && (
              <p className="text-xs text-plex-muted mt-0.5">
                {new Date(status.scannedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {isError && (
          <div className="p-3 border-b border-plex-border">
            <p className="text-xs text-red-400 mb-1">Scan error</p>
            <button
              onClick={rescan}
              className="text-xs text-plex-orange underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-2">
          {navItems.map((item) =>
            item.divider ? (
              <div key="divider" className="border-t border-plex-border my-2" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded text-sm mb-1 transition-colors ${
                    isActive
                      ? 'bg-plex-orange text-plex-dark font-semibold'
                      : 'text-gray-300 hover:bg-plex-border'
                  }`
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        {!library ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-plex-muted text-lg">Select a music library to get started.</p>
          </div>
        ) : (
          <Outlet context={{ library, status, results: null }} />
        )}
      </main>
    </div>
  )
}
