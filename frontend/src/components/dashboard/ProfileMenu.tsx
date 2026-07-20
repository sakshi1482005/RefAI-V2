import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LayoutDashboard, LoaderCircle, LogOut, Settings, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useDemoMode } from '../../context/DemoModeContext'
import { demoEmployee } from '../../lib/demoData'
import { supabase } from '../../lib/supabase'
import { clearTemporaryUserState } from '../../lib/sessionCleanup'
import { friendlyErrorMessage, withRequestTimeout } from '../../lib/requestSafety'
import { useToast } from '../feedback/ToastProvider'
import { Avatar, Skeleton } from './primitives'

type ProfileMenuProps = {
  portal: 'student' | 'employee'
  showDetails?: boolean
  onNavigate?: () => void
}

export default function ProfileMenu({ portal, showDetails = false, onNavigate }: ProfileMenuProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profile, loading } = useCurrentUser()
  const { isDemoMode, exitDemoMode } = useDemoMode()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isDemoEmployee = isDemoMode && portal === 'employee'
  const initials = isDemoEmployee ? demoEmployee.initials : profile?.initials ?? '—'
  const name = isDemoEmployee ? demoEmployee.name : profile?.fullName || profile?.email || 'Signed-in user'
  const role = isDemoEmployee
    ? `${demoEmployee.designation} · Demo`
    : isDemoMode
      ? 'Demo student'
      : profile?.role || (portal === 'employee' ? 'Employee' : 'Student')

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const closeMenu = () => {
    setOpen(false)
    onNavigate?.()
  }

  const handleLogout = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      const { error } = await withRequestTimeout(supabase.auth.signOut())
      if (error) throw error

      exitDemoMode()
      clearTemporaryUserState()
      setOpen(false)
      toast({
        title: 'Signed out successfully',
        description: 'Your session and temporary RefAI data were cleared.',
        tone: 'success',
      })
      onNavigate?.()
      navigate('/auth', { replace: true })
    } catch (error) {
      toast({
        title: 'Unable to sign out',
        description: friendlyErrorMessage(error, 'RefAI could not sign you out. Please try again.'),
        tone: 'error',
      })
      setSigningOut(false)
    }
  }

  const menuItemClass = 'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-black'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading || signingOut}
        className="flex cursor-pointer items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        {loading ? <Skeleton className="size-9 rounded-full" /> : <Avatar initials={initials} size="sm" className="border-black bg-black text-white" />}
        <div className={showDetails ? 'block min-w-0' : 'hidden min-w-0 2xl:block'}>
          {loading ? (
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ) : (
            <>
              <p className="max-w-36 truncate text-sm font-semibold">{name}</p>
              <p className="max-w-36 truncate text-xs text-slate-500">{role}</p>
            </>
          )}
        </div>
        <ChevronDown className={`size-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open ? (
        <div role="menu" aria-label="Profile menu" className="absolute right-0 top-full z-[70] mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{role}</p>
          </div>
          <div className="py-1.5">
            {portal === 'student' ? (
              <>
                <Link role="menuitem" to="/settings#profile" onClick={closeMenu} className={menuItemClass}>
                  <User className="size-4" /> Profile
                </Link>
                <Link role="menuitem" to="/settings" onClick={closeMenu} className={menuItemClass}>
                  <Settings className="size-4" /> Settings
                </Link>
              </>
            ) : (
              <Link role="menuitem" to="/employee/dashboard" onClick={closeMenu} className={menuItemClass}>
                <LayoutDashboard className="size-4" /> Employee dashboard
              </Link>
            )}
          </div>
          <div className="border-t border-slate-100 pt-1.5">
            <button role="menuitem" type="button" onClick={handleLogout} disabled={signingOut} className={`${menuItemClass} text-rose-700 hover:bg-rose-50 hover:text-rose-800 disabled:cursor-wait disabled:opacity-60`}>
              {signingOut ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              {signingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
