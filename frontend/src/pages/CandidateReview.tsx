import { useParams } from 'react-router-dom'
import AuthenticatedCandidateReview from '../components/dashboard/AuthenticatedCandidateReview'

export default function CandidateReview() {
  const { requestId } = useParams()
  return requestId ? <AuthenticatedCandidateReview requestId={requestId} /> : null
}
