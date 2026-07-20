import { ArrowRight, Sparkles } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasReachedDemoStage, useDemoMode, type DemoJourneyStage } from '../../context/DemoModeContext'
import { Card, PrimaryButton } from './primitives'
import { useAnalysisSession } from '../../hooks/useAnalysisSession'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { getStudentWorkflowState, type StudentWorkflowState } from '../../lib/studentWorkflow'

type Recommendation = { title: string; description: string; href: string; cta: string }

function recommendationFor(pathname: string, hash: string, decision: string, stage: DemoJourneyStage, workflow: StudentWorkflowState): Recommendation | null {
  if (pathname === '/dashboard') {
    if (hash === '#ai-recommendations') return { title: workflow.findEmployeesAction.label, description: 'Continue from the completed analysis toward employee matching.', href: workflow.findEmployeesAction.href, cta: workflow.findEmployeesAction.label }
    if (hash === '#find-referrers' && !workflow.hasTrustCard) return { title: workflow.trustCardAction.label, description: 'Complete the Trust Card before choosing an employee for referral outreach.', href: workflow.trustCardAction.href, cta: workflow.trustCardAction.label }
    if (hash === '#find-referrers') return hasReachedDemoStage(stage, 'referral-sent') ? { title: 'Track the referral request', description: 'Ananya’s request to Meera Shah is now pending.', href: '/dashboard#referral-requests', cta: 'View Referral Status' } : { title: 'Select Meera Shah', description: 'Choose Meera as the Atlassian reviewer, then write Ananya’s short request note.', href: '/dashboard#find-referrers', cta: 'Find Meera' }
    if (hash === '#referral-requests') return hasReachedDemoStage(stage, 'referral-sent') ? { title: decision === 'pending' ? 'Continue as the employee' : 'Review the completed employee decision', description: decision === 'pending' ? 'Switch to Meera’s workspace to review Ananya’s resume, Trust Card, and referral request.' : 'The employee decision is complete. Open the employee workspace to review the recorded outcome.', href: '/employee/dashboard', cta: 'Open Employee Dashboard' } : { title: 'Send the referral request', description: 'Review Ananya’s request note before referral history can update.', href: '/dashboard#referral-message', cta: 'Review Request Note' }
    if (hash === '#learning-plan') return { title: workflow.findEmployeesAction.label, description: 'The improvement plan is visible. Continue to employee matching when ready.', href: workflow.findEmployeesAction.href, cta: workflow.findEmployeesAction.label }
    if (!workflow.hasResume) return { title: workflow.uploadAction.label, description: 'Start in the single Resume workspace.', href: workflow.uploadAction.href, cta: workflow.uploadAction.label }
    if (!workflow.hasAnalysis) return { title: workflow.analysisAction.label, description: 'Complete the resume comparison against the target job description.', href: workflow.analysisAction.href, cta: workflow.analysisAction.label }
    if (!workflow.hasTrustCard) return { title: workflow.trustCardAction.label, description: 'Review the completed analysis and generate the Trust Card.', href: workflow.trustCardAction.href, cta: workflow.trustCardAction.label }
    if (!hasReachedDemoStage(stage, 'employee-selected')) return { title: workflow.findEmployeesAction.label, description: 'The Trust Card is ready. Continue to employee matching.', href: workflow.findEmployeesAction.href, cta: workflow.findEmployeesAction.label }
    if (!hasReachedDemoStage(stage, 'message-reviewed')) return { title: 'Prepare the referral request note', description: 'Review Ananya’s short applicant note to Meera before sending the request.', href: '/dashboard#referral-message', cta: 'Review Request Note' }
    return { title: 'Track the referral request', description: 'Ananya’s request is now visible in referral history and Meera’s employee queue.', href: '/dashboard#referral-requests', cta: 'View Referral Status' }
  }
  if (pathname === '/settings') return { title: workflow.uploadAction.label, description: 'Continue from the profile to the next incomplete resume step.', href: workflow.uploadAction.href, cta: workflow.uploadAction.label }
  if (pathname === '/dashboard/resume') {
    return workflow.hasAnalysis
      ? { title: workflow.analysisAction.label, description: 'The resume has already been compared with the target role. Continue without uploading it again.', href: workflow.analysisAction.href, cta: workflow.analysisAction.label }
      : null
  }
  if (pathname === '/dashboard/resume-analysis') {
    if (!workflow.hasAnalysis) return { title: workflow.analysisAction.label, description: 'Complete the resume comparison before reviewing results or generating a Trust Card.', href: workflow.analysisAction.href, cta: workflow.analysisAction.label }
    return workflow.hasTrustCard
      ? { title: workflow.trustCardAction.label, description: 'Review the employee-ready summary built from the resume evidence and match signals.', href: workflow.trustCardAction.href, cta: workflow.trustCardAction.label }
      : null
  }
  if (pathname === '/dashboard/trust-card') {
    return workflow.hasTrustCard
      ? { title: workflow.actionPlanAction.label, description: 'The Trust Card is ready. Review the improvement plan before employee matching.', href: workflow.actionPlanAction.href, cta: workflow.actionPlanAction.label }
      : { title: workflow.trustCardAction.label, description: 'Review the completed resume analysis, then generate the employee-ready evidence summary.', href: workflow.trustCardAction.href, cta: workflow.trustCardAction.label }
  }
  if (pathname === '/dashboard/action-plan') return { title: workflow.findEmployeesAction.label, description: 'The priority gaps and practical actions are visible. Continue to employee matching when ready.', href: workflow.findEmployeesAction.href, cta: workflow.findEmployeesAction.label }
  if (pathname === '/employee/dashboard') return hasReachedDemoStage(stage, 'referral-sent') ? { title: decision === 'pending' ? 'Review the waiting candidate' : 'Review the completed candidate decision', description: decision === 'pending' ? 'Ananya Rao is waiting for Meera Shah’s review with an 88% Resume Match and 91 Trust Score for Atlassian.' : 'Ananya’s Atlassian referral has been decided. Reopen the review evidence or confirmation.', href: '/employee/review/demo-ananya-rao', cta: 'Open Candidate Review' } : { title: 'Send the student referral first', description: 'The employee queue stays empty until Ananya reviews and sends her message to Meera.', href: '/dashboard#referral-message', cta: 'Continue Student Flow' }

  const requestId = pathname.split('/')[3] || 'demo-ananya-rao'
  if (pathname.startsWith('/employee/review/')) return { title: 'Inspect the resume evidence', description: 'Review the candidate’s projects and measurable outcomes before assessing trust signals.', href: `/employee/resume/${requestId}`, cta: 'Open Resume' }
  if (pathname.startsWith('/employee/resume/')) return { title: 'Review the Candidate Trust Card', description: 'The resume evidence is clear. Continue to the summarized match and referral-readiness signals.', href: `/employee/trust-card/${requestId}`, cta: 'Open Trust Card' }
  if (pathname.startsWith('/employee/trust-card/')) return { title: 'Make the referral decision', description: 'Resume evidence and Trust Card signals are ready for a final employee decision.', href: `/employee/decision/${requestId}`, cta: 'Open Decision Panel' }
  if (pathname.endsWith('/confirmation')) return { title: 'Show the updated student status', description: 'Complete the demo loop by returning to the student referral timeline.', href: '/dashboard#referral-requests', cta: 'View Student Status' }
  if (pathname.startsWith('/employee/decision/')) return { title: decision === 'pending' ? 'Record the referral decision' : 'View the recorded confirmation', description: decision === 'pending' ? 'Add an evidence-based note below, then approve, decline, or request more information.' : 'The demo decision has been recorded and is ready to present.', href: decision === 'pending' ? `${pathname}#decision-panel` : `${pathname}/confirmation`, cta: decision === 'pending' ? 'Go to Decision' : 'View Confirmation' }
  return null
}

export default function RecommendedNextStep() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDemoMode, demoDecision, demoJourneyStage } = useDemoMode()
  const analysisSession = useAnalysisSession()
  const { profile } = useCurrentUser()
  const workflow = getStudentWorkflowState({ profile, session: analysisSession, hasReferralRequest: hasReachedDemoStage(demoJourneyStage, 'referral-sent') })
  if (!isDemoMode) return null
  const recommendation = recommendationFor(location.pathname, location.hash, demoDecision, demoJourneyStage, workflow)
  if (!recommendation) return null
  return <Card className="border-slate-300 bg-slate-50/70 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-black text-white"><Sparkles className="size-4" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What to do next</p><h2 className="mt-1 text-lg font-semibold tracking-tight">{recommendation.title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{recommendation.description}</p></div></div><PrimaryButton className="shrink-0" onClick={() => navigate(recommendation.href)}>{recommendation.cta}<ArrowRight className="ml-2 size-4" /></PrimaryButton></div></Card>
}
