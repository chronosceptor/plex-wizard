import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const ScanContext = createContext(null)

export function useScan() {
  return useContext(ScanContext)
}

const KEY_TO_ENDPOINT = {
  albums_no_artwork:   'albums-no-artwork',
  artists_no_genre:    'artists-no-genre',
  artists_no_photo:    'artists-no-photo',
  artists_no_country:  'artists-no-country',
  listening_stats:     'listening-stats',
  artists_no_match:    'artists-no-match',
  albums_no_match:     'albums-no-match',
  tracks_incomplete:   'tracks-incomplete',
}

export function ScanProvider({ children }) {
  const [library, setLibraryState] = useState('')
  const [status, setStatus] = useState({ status: 'idle' })
  const [results, setResults] = useState(null)
  const pollRef = useRef(null)
  const prevStepsRef = useRef([])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchStepResult = useCallback(async (lib, key) => {
    const endpoint = KEY_TO_ENDPOINT[key]
    if (!endpoint) return
    try {
      const res = await fetch(`/api/audit/${endpoint}?library=${encodeURIComponent(lib)}`)
      if (!res.ok) return
      const data = await res.json()
      setResults(prev => ({ ...(prev ?? {}), [key]: data }))
    } catch {}
  }, [])

  const startScan = useCallback(async (lib) => {
    if (!lib) return
    stopPolling()
    setResults(null)
    prevStepsRef.current = []
    setStatus({ status: 'scanning', totalSteps: 6, steps: [] })

    await fetch(`/api/scan/start?library=${encodeURIComponent(lib)}`, { method: 'POST' })

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/status?library=${encodeURIComponent(lib)}`)
        const data = await res.json()
        setStatus(data)

        // Fetch result for each newly completed step
        const steps = data.steps ?? []
        const prev = prevStepsRef.current
        for (let i = 0; i < steps.length; i++) {
          if (steps[i].status === 'done' && prev[i]?.status !== 'done') {
            fetchStepResult(lib, steps[i].key)
          }
        }
        prevStepsRef.current = steps

        if (data.status === 'done') stopPolling()
        else if (data.status === 'error') stopPolling()
      } catch {}
    }, 1000)
  }, [stopPolling, fetchStepResult])

  const setLibrary = useCallback((lib) => {
    setLibraryState(lib)
    if (lib) startScan(lib)
  }, [startScan])

  const rescan = useCallback(() => {
    if (library) startScan(library)
  }, [library, startScan])

  useEffect(() => () => stopPolling(), [stopPolling])

  return (
    <ScanContext.Provider value={{ library, setLibrary, status, results, rescan }}>
      {children}
    </ScanContext.Provider>
  )
}
