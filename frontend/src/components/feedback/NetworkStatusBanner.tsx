import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])
  if (online) return null
  return <div role="alert" className="border-b border-amber-200 bg-amber-50"><div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-900 sm:px-6 lg:px-8"><WifiOff className="size-4 shrink-0" />You’re offline. Reconnect before uploading, analyzing, or saving changes.</div></div>
}
