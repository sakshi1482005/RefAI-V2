import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionPlanPanel from '../components/dashboard/ActionPlanPanel'
import PageShell from '../components/dashboard/PageShell'
import { PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { useAnalysisSession } from '../hooks/useAnalysisSession'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { getStudentWorkflowState } from '../lib/studentWorkflow'

export default function ActionPlan() {
  const navigate = useNavigate()
  const session = useAnalysisSession()
  const { profile } = useCurrentUser()
  const workflow = getStudentWorkflowState({ profile, session })
  const plan = session.trustCard?.actionPlan ?? session.analysis?.actionPlan ?? []
  const allGaps = session.trustCard?.missingRequirements ?? session.analysis?.missingRequirements ?? []

  const nextAction = workflow.hasTrustCard ? workflow.findEmployeesAction : workflow.trustCardAction

  return <PageShell eyebrow="Action Plan" title="Turn missing requirements into credible evidence" description="Work through the highest-priority gaps, update your resume with truthful evidence, then continue from your current workflow stage." action={<div className="flex flex-wrap gap-3"><SecondaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Back to Analysis</SecondaryButton><PrimaryButton onClick={() => navigate(nextAction.href)}>{nextAction.label}<ArrowRight className="ml-2 size-4" /></PrimaryButton></div>}>
    <ActionPlanPanel plan={plan} allGaps={allGaps} />
  </PageShell>
}
