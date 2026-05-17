import { useScan } from '../context/ScanContext'

export function useAuditData(key) {
  const { status, results } = useScan()

  const isScanning = status.status === 'scanning' || status.status === 'idle'
  const isError = status.status === 'error'
  const data = results?.[key] ?? null

  return { data, isScanning, isError, error: status.error }
}
