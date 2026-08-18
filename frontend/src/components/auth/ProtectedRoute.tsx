import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession, type AuthenticatedRole } from '../../context/AuthSessionContext'

function ProtectedRouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4" role="status" aria-label="Checking access">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="skeleton-shimmer h-5 w-32 rounded-lg" />
        <div className="skeleton-shimmer mt-4 h-3 w-full rounded-lg" />
        <div className="skeleton-shimmer mt-2 h-3 w-2/3 rounded-lg" />
        <span className="sr-only">Checking your session and account role…</span>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ requiredRole }: { requiredRole: AuthenticatedRole }) {
  const location = useLocation()
  const { authLoading, hasAuthenticatedUser, authenticatedRole } = useAuthSession()

  if (authLoading) return <ProtectedRouteLoader />
  if (!hasAuthenticatedUser) {
    return <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
  }

  if (!authenticatedRole) {
    return <Navigate to="/auth" replace state={{ roleRequired: true }} />
  }

  if (authenticatedRole !== requiredRole) {
    return <Navigate to={authenticatedRole === 'employee' ? '/employee/dashboard' : '/dashboard'} replace />
  }

  return <Outlet />
}
