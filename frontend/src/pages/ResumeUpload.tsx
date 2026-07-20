import { ArrowRight, CheckCircle2, FileText, Sparkles, Upload, ShieldCheck, BriefcaseBusiness } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Card, InlineFeedback, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { api } from '../lib/apiClient'
import { useToast } from '../components/feedback/ToastProvider'
import { hasReachedDemoStage, useDemoMode } from '../context/DemoModeContext'
import { demoAnalysisSession } from '../lib/demoData'
import { friendlyErrorMessage, requireOnline } from '../lib/requestSafety'
import { parseResumeAnalysisResponse, parseResumeUploadResponse } from '../lib/resumeContract'
import { useAnalysisSession } from '../hooks/useAnalysisSession'
import { useCurrentUser } from '../hooks/useCurrentUser'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export default function ResumeUpload() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isDemoMode, demoJourneyStage, setDemoJourneyStage } = useDemoMode()
  const analysisSession = useAnalysisSession()
  const { profile } = useCurrentUser()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info')
  const [targetRole, setTargetRole] = useState(isDemoMode ? demoAnalysisSession.role ?? '' : analysisSession.role || profile?.preferredRole || '')
  const [targetCompany, setTargetCompany] = useState(isDemoMode ? demoAnalysisSession.company ?? '' : analysisSession.company || profile?.preferredCompany || '')
  const [jobDescription, setJobDescription] = useState(isDemoMode ? demoAnalysisSession.jobDescription ?? '' : analysisSession.jobDescription || '')

  const handleFileSelection = (file: File | null) => {
    if (!file) {
      setSelectedFile(null)
      setMessage(null)
      setMessageTone('info')
      setUploadProgress(0)
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setSelectedFile(null)
      setMessage('Please upload a PDF file only.')
      setMessageTone('error')
      toast({ title: 'Unsupported file', description: 'Choose a PDF resume to continue.', tone: 'error' })
      setUploadProgress(0)
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null)
      setMessage('Please upload a PDF smaller than 10 MB.')
      setMessageTone('error')
      toast({ title: 'File is too large', description: 'Resume PDFs must be smaller than 10 MB.', tone: 'error' })
      setUploadProgress(0)
      return
    }

    setSelectedFile(file)
    setMessage(`Ready to upload ${file.name}.`)
    setMessageTone('info')
    setUploadProgress(0)
  }

  const handleUpload = async () => {
    if (uploading) return
    if (isDemoMode) {
      if (!hasReachedDemoStage(demoJourneyStage, 'analyzed')) setDemoJourneyStage('analyzed')
      toast({ title: 'Demo resume analyzed', description: 'Ananya’s isolated sample resume and Atlassian role analysis are ready.', tone: 'success' })
      navigate('/dashboard/resume-analysis')
      return
    }
    if (!selectedFile) {
      setMessage('Please choose a PDF resume before uploading.')
      setMessageTone('error')
      toast({ title: 'Resume required', description: 'Choose a PDF resume before uploading.', tone: 'error' })
      return
    }
    if (!targetRole.trim()) {
      setMessage('Add the target role before starting the analysis.')
      setMessageTone('error')
      toast({ title: 'Target role required', description: 'Enter the position this resume should be compared with.', tone: 'error' })
      return
    }
    if (!targetCompany.trim()) {
      setMessage('Add the target company before starting the analysis.')
      setMessageTone('error')
      toast({ title: 'Target company required', description: 'Enter the company for this application so the analysis context stays clear.', tone: 'error' })
      return
    }
    if (jobDescription.trim().length < 80) {
      setMessage('Paste a fuller job description with specific skills and responsibilities before starting the analysis.')
      setMessageTone('error')
      toast({ title: 'More job details required', description: 'Include specific skills, tools, responsibilities, or experience requirements.', tone: 'error' })
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setMessage('Uploading your resume…')
    setMessageTone('info')

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      requireOnline()
      if (import.meta.env.DEV) console.debug('[RefAI resume upload payload]', {
        endpoint: '/resume/upload',
        method: 'POST',
        formDataFields: Array.from(formData.keys()),
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
      })
      const response = await api.post<unknown>('/resume/upload', formData, {
        timeout: 45_000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(percent)
          }
        }
      })
      const uploadResult = parseResumeUploadResponse(response.data, response.status)
      if (import.meta.env.DEV) console.debug('[RefAI resume upload response]', { endpoint: '/resume/upload', status: response.status, responseShape: Object.keys(uploadResult).sort() })

      setUploadProgress(100)
      setMessage('Resume uploaded. Comparing it with the target role…')
      const matchResponse = await api.post('/resume/analyze', {
        resumeText: uploadResult.preview,
        jobDescription: jobDescription.trim(),
        resumeId: uploadResult.resumeId,
        fileName: uploadResult.fileName,
        chunkCount: uploadResult.chunkCount,
        storagePath: uploadResult.storagePath,
        storageStatus: uploadResult.storageStatus,
        indexed: uploadResult.indexed,
        uploadProcessingTimeMs: uploadResult.processingTimeMs,
        targetRole: targetRole.trim(),
        targetCompany: targetCompany.trim(),
      }, { timeout: 30_000 })
      const analysisResult = parseResumeAnalysisResponse(matchResponse.data, matchResponse.status)
      if (import.meta.env.DEV) console.debug('[RefAI resume analysis response]', { endpoint: '/resume/analyze', status: matchResponse.status, responseShape: Object.keys(analysisResult).sort() })
      setMessage('Resume uploaded and analyzed successfully.')
      setMessageTone('success')
      toast({ title: 'Analysis ready', description: 'Review the role match and evidence before generating your Trust Card.', tone: 'success' })
      navigate('/dashboard/resume-analysis')
    } catch (error) {
      const errorMessage = friendlyErrorMessage(error, 'RefAI could not upload this resume. Check the PDF and try again.')

      setMessage(errorMessage)
      setMessageTone('error')
      toast({ title: 'Resume could not be processed', description: errorMessage, tone: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <PageShell
      eyebrow="Resume Workspace"
      title="Upload and analyze one resume"
      description="Choose one PDF, add its target role, and run the complete analysis from this workspace."
      action={
        <div className="flex flex-wrap gap-2"><SecondaryButton onClick={() => navigate('/settings#profile')}>Back to Profile</SecondaryButton><PrimaryButton onClick={handleUpload} disabled={!isDemoMode && !selectedFile} loading={uploading} disabledReason="Choose a PDF resume first">
          {uploading ? 'Uploading…' : (
            <>
              <Upload className="mr-2 size-4" />
              {isDemoMode ? 'Analyze Demo Resume' : 'Upload and analyze'}
            </>
          )}
        </PrimaryButton></div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100">
              <FileText className="size-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Choose the resume to analyze</h2>
              <p className="mt-1 text-sm text-slate-500">PDF only · Maximum 10 MB · Use the version intended for your target role</p>
            </div>
          </div>

          <label className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-slate-500">
            <div className="flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <Upload className="size-5 text-slate-700" />
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-900">Drag and drop or click to upload</p>
            <p className="mt-2 text-sm text-slate-500">Your resume will be checked for skills, evidence, and referral readiness.</p>
            <input type="file" className="sr-only" accept=".pdf" onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)} disabled={uploading} />
          </label>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedFile ? selectedFile.name : 'No file selected yet'}</p>
                <p className="text-xs text-slate-500">{selectedFile ? 'Ready to upload' : 'Choose a PDF to continue'}</p>
              </div>
            </div>
            {selectedFile ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
          </div>

          {message ? <div className="mt-4"><InlineFeedback tone={messageTone}>{message}</InlineFeedback></div> : null}

          {uploading ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Uploading…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-black transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-slate-700" />
              <p className="text-sm font-semibold">Target opportunity</p>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Role</span><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={isDemoMode || uploading} placeholder="Associate Software Engineer" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-100" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Company</span><input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} disabled={isDemoMode || uploading} placeholder="Atlassian" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-100" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Job description</span><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} disabled={isDemoMode || uploading} placeholder="Paste the responsibilities and requirements for the target role…" className="min-h-40 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-100" /><span className="mt-1 block text-xs text-slate-500">{jobDescription.trim().length} characters · Use the complete role description for a more useful comparison.</span></label>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">What happens next</h3>
                <p className="mt-1 text-sm text-slate-500">RefAI will compare your experience to the target role and generate a Trust Card.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                'We extract evidence from your resume and identify the strongest skills.',
                'We compare your background against the job description and score the fit.',
                'We build a candidate trust summary that employees can review quickly.'
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                  <p className="text-sm text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100">
                <BriefcaseBusiness className="size-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Target details</h3>
                <p className="mt-1 text-sm text-slate-500">This helps RefAI tailor the analysis and evidence summary.</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold">{targetRole.trim() || 'Target role not added'}</p>
              <p className="mt-2 text-sm text-slate-500">{isDemoMode ? 'This sample target and job description are isolated from authenticated analysis data.' : jobDescription.trim() ? 'The job description is ready for comparison.' : 'Add the role and job description in the resume workspace before continuing.'}</p>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <SecondaryButton className="flex-1" onClick={() => navigate('/dashboard')}>Back to dashboard</SecondaryButton>
              <SecondaryButton className="flex-1" onClick={() => navigate('/dashboard/resume-analysis')} disabled={!analysisSession.matchScore} disabledReason="Complete an analysis first">View latest analysis<ArrowRight className="ml-2 size-4" /></SecondaryButton>
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
