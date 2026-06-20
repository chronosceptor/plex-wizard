import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Albums from './pages/Albums'
import AlbumDetail from './pages/AlbumDetail'
import TrackAudit from './pages/TrackAudit'
import ListeningStats from './pages/ListeningStats'
import PlaylistGenerator from './pages/PlaylistGenerator'
import Artists from './pages/Artists'
import ArtistDetail from './pages/ArtistDetail'
import GenreManager from './pages/GenreManager'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="albums" element={<Albums />} />
          <Route path="albums/:ratingKey" element={<AlbumDetail />} />
          <Route path="tracks" element={<TrackAudit />} />
          <Route path="listening" element={<ListeningStats />} />
          <Route path="playlists" element={<PlaylistGenerator />} />
          <Route path="artists" element={<Artists />} />
          <Route path="artists/:ratingKey" element={<ArtistDetail />} />
          <Route path="genres" element={<GenreManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
