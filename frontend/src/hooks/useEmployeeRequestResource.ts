import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/apiClient'

export function useEmployeeRequestResource<T>(endpoint: string | null, parse: (value: unknown) => T) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(Boolean(endpoint))
  const [version, setVersion] = useState(0)
  const retry = useCallback(() => setVersion((value) => value + 1), [])

  useEffect(() => {
    if (!endpoint) { setData(null); setError(null); setLoading(false); return }
    let active = true
    setLoading(true); setError(null)
    api.get<unknown>(endpoint).then((response) => { if (active) setData(parse(response.data)) })
      .catch((resourceError) => { if (active) { setData(null); setError(resourceError) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [endpoint, parse, version])

  return { data, error, loading, retry }
}
