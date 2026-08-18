import React, { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'

import { ToastProvider } from './components/feedback/ToastProvider'
import { AuthSessionProvider } from './context/AuthSessionContext'
import ProtectedRoute from './components/auth/ProtectedRoute'

import './index.css'

const App = lazy(() => import('./App'))
const Login = lazy(() => import('./pages/auth'))
const AuthCallback = lazy(() => import('./pages/AuthCallback'))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'))
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'))
const CandidateReview = lazy(() => import('./pages/CandidateReview'))
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'))
const ReferralDecision = lazy(() => import('./pages/ReferralDecision'))
const ResumeAnalysisResult = lazy(() => import('./pages/ResumeAnalysisResult'))
const ResumeUpload = lazy(() => import('./pages/ResumeUpload'))
const ResumeViewer = lazy(() => import('./pages/ResumeViewer'))
const TrustCard = lazy(() => import('./pages/TrustCard'))
const ActionPlan = lazy(() => import('./pages/ActionPlan'))
const TrustCardDetails = lazy(() => import('./pages/TrustCardDetails'))
const DecisionConfirmation = lazy(() => import('./pages/DecisionConfirmation'))
const AIOpportunityRecommendations = lazy(() => import('./pages/AIOpportunityRecommendations'))
const TrustPassport = lazy(() => import('./pages/TrustPassport'))
const IntelligenceLab = lazy(() => import('./pages/IntelligenceLab'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#f7f7f8]" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page…</span>
      <div className="h-16 border-b border-slate-200 bg-white"><div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8"><div className="skeleton-shimmer h-9 w-28 rounded-xl" /><div className="skeleton-shimmer size-9 rounded-full" /></div></div>
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"><div className="skeleton-shimmer h-44 rounded-2xl border border-slate-200" /><div className="grid gap-6 md:grid-cols-3"><div className="skeleton-shimmer h-48 rounded-2xl border border-slate-200" /><div className="skeleton-shimmer h-48 rounded-2xl border border-slate-200" /><div className="skeleton-shimmer h-48 rounded-2xl border border-slate-200" /></div></div>
    </div>
  )
}

function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'auto' })
    window.requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }))
  }, [location.pathname])

  return <div key={location.pathname} ref={containerRef} tabIndex={-1} className="route-transition focus:outline-none">{children}</div>
}

class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] px-4 text-center" role="alert">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-950">This page could not be loaded</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Refresh the page to retry loading the application.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">Try again</button><button type="button" onClick={() => window.history.back()} className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-all hover:-translate-y-0.5 hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">Go back</button></div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function LegacyReviewRedirect() {
  const { requestId } = useParams()
  return requestId ? <Navigate to={`/employee/review/${requestId}`} replace /> : <Navigate to="/employee/dashboard" replace />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthSessionProvider>
        <PageErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <RouteTransition>
            <Routes>
          <Route path="/" element={<App />} />
          <Route path="/auth" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/passport/:token" element={<TrustPassport />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />

        {/* Student routes require a student account. */}
        <Route element={<ProtectedRoute requiredRole="student" />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/dashboard/student" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard/resume" element={<ResumeUpload />} />
          <Route path="/dashboard/resume-upload" element={<Navigate to="/dashboard/resume" replace />} />
          <Route path="/dashboard/resume-analysis" element={<ResumeAnalysisResult />} />
          <Route path="/dashboard/trust-card" element={<TrustCard />} />
          <Route path="/dashboard/action-plan" element={<ActionPlan />} />
          <Route path="/dashboard/opportunities" element={<AIOpportunityRecommendations />} />
          <Route path="/dashboard/intelligence-lab" element={<IntelligenceLab />} />
          <Route path="/settings" element={<ProfileSettings />} />
          <Route path="/profile" element={<Navigate to="/settings#profile" replace />} />
        </Route>

        {/* Employee routes require an employee account. */}
        <Route element={<ProtectedRoute requiredRole="employee" />}>
          <Route path="/dashboard/employee" element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/review/:requestId" element={<CandidateReview />} />
          <Route path="/employee/resume/:requestId" element={<ResumeViewer />} />
          <Route path="/employee/trust-card/:requestId" element={<TrustCardDetails />} />
          <Route path="/employee/decision/:requestId" element={<ReferralDecision />} />
          <Route path="/employee/decision/:requestId/confirmation" element={<DecisionConfirmation />} />
          {/* Preserve old review links without maintaining a duplicate review page. */}
          <Route path="/review/:requestId" element={<LegacyReviewRedirect />} />
        </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </RouteTransition>
          </Suspense>
        </PageErrorBoundary>
        </AuthSessionProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
