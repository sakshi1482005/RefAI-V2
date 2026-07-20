import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyErrorMessage, withRequestTimeout } from '../lib/requestSafety'

type Role = 'student' | 'employee'
const ROLE_KEY = 'refai_role'

export default function AuthCallback() {
  const navigate = useNavigate()
  const completed = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const flow = params.get('flow')
    const providerError = params.get('error_description')

    const complete = async () => {
      if (completed.current) return
      const { data, error: sessionError } = await withRequestTimeout(supabase.auth.getSession())
      if (sessionError) throw sessionError
      const user = data.session?.user
      if (!user) return
      completed.current = true

      if (flow === 'signup') {
        await withRequestTimeout(supabase.auth.signOut({ scope: 'local' }))
        navigate('/auth?verified=1', { replace: true })
        return
      }

      const storedRole = localStorage.getItem(ROLE_KEY)
      const metadataRole = user.user_metadata?.role
      const role: Role = metadataRole === 'employee' || metadataRole === 'student'
        ? metadataRole
        : storedRole === 'employee' ? 'employee' : 'student'

      if (metadataRole !== 'employee' && metadataRole !== 'student') {
        const { error: roleError } = await withRequestTimeout(supabase.auth.updateUser({ data: { role } }))
        if (roleError) throw roleError
      }
      localStorage.setItem(ROLE_KEY, role)
      navigate(role === 'employee' ? '/employee/dashboard' : '/dashboard', { replace: true })
    }

    if (providerError) {
      setError(decodeURIComponent(providerError.replace(/\+/g, ' ')))
      return
    }

    void complete().catch((callbackError) => {
      if (active) setError(friendlyErrorMessage(callbackError, 'RefAI could not finish authentication. Return to login and try again.'))
    })
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void complete().catch((callbackError) => {
        if (active) setError(friendlyErrorMessage(callbackError, 'RefAI could not finish authentication. Return to login and try again.'))
      })
    })

    const timeout = window.setTimeout(() => {
      if (active && !completed.current) setError('Authentication took too long. Return to login and try again.')
    }, 15_000)

    return () => {
      active = false
      window.clearTimeout(timeout)
      listener.subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="status">
        <div className={`mx-auto size-10 rounded-full border-4 border-slate-200 ${error ? 'border-rose-300' : 'animate-spin border-t-slate-900'}`} />
        <h1 className="mt-5 text-xl font-semibold">{error ? 'Authentication could not be completed' : 'Finishing authentication'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{error || 'RefAI is confirming your session and account role.'}</p>
        {error ? <button type="button" onClick={() => navigate('/auth', { replace: true })} className="mt-5 inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white">Return to login</button> : null}
      </div>
    </main>
  )
}
