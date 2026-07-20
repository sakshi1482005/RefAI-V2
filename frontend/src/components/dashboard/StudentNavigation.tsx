import {
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

type StudentNavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const studentNavItems: StudentNavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Resume', href: '/dashboard/resume', icon: FileText },
  { label: 'Trust Card', href: '/dashboard/trust-card', icon: ShieldCheck },
  { label: 'Employees', href: '/dashboard#find-referrers', icon: Building2 },
  { label: 'Referral Requests', href: '/dashboard#referral-requests', icon: ShieldCheck },
  { label: 'Settings', href: '/settings', icon: Settings },
]

const destination = (href: string) => {
  const [pathname, hash = ''] = href.split('#')
  return { pathname, hash: hash ? `#${hash}` : '' }
}

function isActive(pathname: string, hash: string, href: string) {
  const target = destination(href)

  if (target.pathname === '/dashboard') {
    return pathname === '/dashboard' && (target.hash ? hash === target.hash : !hash)
  }

  return pathname === target.pathname
}

export default function StudentNavigation({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()

  return (
    <nav aria-label="Student navigation" className={mobile ? 'grid gap-1' : 'flex items-center'}>
      {studentNavItems.map((item) => {
        const Icon = item.icon
        const active = isActive(location.pathname, location.hash, item.href)

        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center rounded-lg text-sm font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 ${
              mobile ? 'h-11 px-3' : 'h-9 whitespace-nowrap px-1.5 text-xs'
            } ${
              active
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
            }`}
          >
            <Icon className={`${mobile ? 'mr-2 size-4' : 'mr-1 size-3.5'} shrink-0`} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
