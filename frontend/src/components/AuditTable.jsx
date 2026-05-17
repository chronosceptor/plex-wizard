import { useState } from 'react'

export default function AuditTable({ columns, data, emptyMessage = 'Sin resultados' }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filter, setFilter] = useState('')

  function handleSort(key) {
    if (sortCol === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }

  const filtered = data.filter((row) => {
    if (!filter) return true
    return columns.some((col) => {
      const val = row[col.key]
      return String(val ?? '').toLowerCase().includes(filter.toLowerCase())
    })
  })

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol] ?? ''
        const bv = b[sortCol] ?? ''
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : filtered

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          placeholder="Filtrar..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-plex-card border border-plex-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-plex-orange w-64"
        />
        <span className="text-plex-muted text-sm">{sorted.length} resultados</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-plex-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-plex-card border-b border-plex-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`text-left px-4 py-2.5 text-plex-muted font-medium select-none ${
                    col.sortable !== false ? 'cursor-pointer hover:text-white' : ''
                  }`}
                >
                  {col.label}
                  {sortCol === col.key && (
                    <span className="ml-1 text-plex-orange">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-plex-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={row.ratingKey ?? i}
                  className="border-b border-plex-border last:border-0 hover:bg-plex-card/50 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
