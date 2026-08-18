import { useParams } from 'react-router-dom'
import AuthenticatedResumeViewer from '../components/dashboard/AuthenticatedResumeViewer'

export default function ResumeViewer() {
  const { requestId } = useParams()
  return requestId ? <AuthenticatedResumeViewer requestId={requestId} /> : null
}
