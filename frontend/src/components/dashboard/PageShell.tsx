import { useEffect, useState, type ReactNode } from 'react'
import { LayoutDashboard, ShieldCheck, ArrowRight, Menu, X, type LucideIcon } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { IconButton, Logo } from './primitives'
import StudentNavigation from './StudentNavigation'
import NetworkStatusBanner from '../feedback/NetworkStatusBanner'
import { useSectionReveal } from '../../hooks/useSectionReveal'
import ProfileMenu from './ProfileMenu'
import NotificationCentre from './NotificationCentre'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

const employeeNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/employee/dashboard', icon: LayoutDashboard }
]

export default function PageShell({ title, description, eyebrow, action, children, compact = false }: { title: string; description: string; eyebrow?: string; action?: ReactNode; children: ReactNode; compact?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isEmployeePortal = location.pathname.startsWith('/employee')
  const dashboardHref = isEmployeePortal ? '/employee/dashboard' : '/dashboard'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useSectionReveal()

  useEffect(() => {
    const sectionId = location.hash.replace(/^#/, '')
    if (sectionId) {
      window.requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }))
    }
  }, [location.hash])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'd') { event.preventDefault(); navigate(dashboardHref) }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [dashboardHref, navigate])

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-950">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 2xl:gap-8">
            <Link to={dashboardHref} className="flex items-center">
              <Logo />
            </Link>
            {isEmployeePortal ? <nav className="hidden items-center gap-2 md:flex">
              {employeeNavItems.map((item) => {
                const Icon = item.icon
                const active = location.pathname === item.href
                return (
                  <Link key={item.href} to={item.href} className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${active ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                    <Icon className="mr-2 size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav> : <div className="hidden xl:block"><StudentNavigation /></div>}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NotificationCentre />
            <ProfileMenu portal={isEmployeePortal ? 'employee' : 'student'} />
            {!isEmployeePortal ? (
              <div className="xl:hidden">
                <IconButton label="Toggle navigation" onClick={() => setMobileMenuOpen((open) => !open)} expanded={mobileMenuOpen} controls="student-page-navigation">
                  {mobileMenuOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
                </IconButton>
              </div>
            ) : null}
          </div>
        </div>
        {!isEmployeePortal && mobileMenuOpen ? (
          <div id="student-page-navigation" className="border-t border-slate-200 bg-white px-4 py-3 xl:hidden">
            <div className="mx-auto max-w-[1440px]">
              <StudentNavigation mobile onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        ) : null}
      </header>
      <NetworkStatusBanner />

      <main id="main-content" tabIndex={-1} className={`mx-auto max-w-[1440px] px-4 outline-none sm:px-6 lg:px-8 ${compact ? 'space-y-6 py-6 sm:py-8' : 'space-y-8 py-7 sm:py-10'}`}>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className={`flex flex-col lg:flex-row lg:items-end lg:justify-between ${compact ? 'gap-4 p-5 sm:p-6 lg:p-7' : 'gap-6 p-7 sm:p-10 lg:p-12'}`}>
            <div>
              {eyebrow ? <p className={`${compact ? 'mb-2' : 'mb-3'} text-xs font-semibold uppercase tracking-[0.18em] text-slate-500`}>{eyebrow}</p> : null}
              <h1 className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-semibold tracking-[-0.035em] text-slate-950`}>{title}</h1>
              <p className={`${compact ? 'mt-2 text-sm leading-6' : 'mt-3 text-base leading-7'} max-w-2xl text-slate-600`}>{description}</p>
            </div>
            {action ? <div>{action}</div> : null}
          </div>
        </section>

        {children}
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p className="text-sm text-slate-500">Built with <span className="text-rose-500">♥</span> by RefAI</p>
          <Link to={isEmployeePortal ? '/employee/dashboard' : '/dashboard/trust-card'} className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ShieldCheck className="size-4" />
            Trust Before Referrals
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
