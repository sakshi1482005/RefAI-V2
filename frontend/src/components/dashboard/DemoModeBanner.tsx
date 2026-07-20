import { Gavel } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDemoMode } from '../../context/DemoModeContext'
import { Badge } from './primitives'

export default function DemoModeBanner() {
  const navigate = useNavigate()
  const { isJudgeMode, canUseJudgeMode, authLoading, setJudgeMode } = useDemoMode()
  if (authLoading || !canUseJudgeMode) return null

  const toggleJudgeMode = () => {
    setJudgeMode(!isJudgeMode)
    if (isJudgeMode) navigate('/dashboard')
  }

  return (
    <div className={`border-b ${isJudgeMode ? 'border-amber-200 bg-amber-50/80' : 'border-slate-200 bg-slate-50/80'}`} role="status">
      <div className="mx-auto flex min-h-11 max-w-[1440px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Gavel className={`size-4 shrink-0 ${isJudgeMode ? 'text-amber-700' : 'text-slate-500'}`} aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900">Judge Mode</span>
          {isJudgeMode ? <Badge tone="warning">Demo Data</Badge> : null}
          <span className="hidden truncate text-xs text-slate-500 sm:inline">Isolated student-to-employee walkthrough</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isJudgeMode}
          aria-label={`${isJudgeMode ? 'Disable' : 'Enable'} Judge Mode`}
          onClick={toggleJudgeMode}
          className="group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
          <span className="text-xs font-semibold text-slate-600">{isJudgeMode ? 'On' : 'Off'}</span>
          <span className={`relative h-6 w-11 rounded-full border transition-colors ${isJudgeMode ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
            <span className={`absolute top-0.5 size-[18px] rounded-full bg-white shadow-sm transition-transform ${isJudgeMode ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
          </span>
        </button>
      </div>
    </div>
  )
}
