import { Navigate, useParams } from 'react-router-dom'

export default function ReferralDecision() {
  const { requestId } = useParams()
  return requestId ? <Navigate to={`/employee/review/${requestId}`} replace /> : <Navigate to="/employee/dashboard" replace />
}
