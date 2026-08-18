import { useParams } from 'react-router-dom'
import AuthenticatedTrustCardDetails from '../components/dashboard/AuthenticatedTrustCardDetails'

export default function TrustCardDetails() {
  const { requestId } = useParams()
  return requestId ? <AuthenticatedTrustCardDetails requestId={requestId} /> : null
}
