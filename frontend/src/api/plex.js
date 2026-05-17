const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const fetchLibraries = () => get('/libraries')

export const fetchSummary = (library) =>
  get(`/audit/summary?library=${encodeURIComponent(library)}`)

export const fetchAlbumsNoArtwork = (library) =>
  get(`/audit/albums-no-artwork?library=${encodeURIComponent(library)}`)

export const fetchArtistsNoGenre = (library) =>
  get(`/audit/artists-no-genre?library=${encodeURIComponent(library)}`)

export const fetchArtistsNoPhoto = (library) =>
  get(`/audit/artists-no-photo?library=${encodeURIComponent(library)}`)

export const fetchTracksIncomplete = (library) =>
  get(`/audit/tracks-incomplete?library=${encodeURIComponent(library)}`)

export const fetchArtistsNoCountry = (library) =>
  get(`/audit/artists-no-country?library=${encodeURIComponent(library)}`)

export const fetchListeningStats = (library) =>
  get(`/audit/listening-stats?library=${encodeURIComponent(library)}`)
