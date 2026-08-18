import { ArrowRight, CheckCircle2, FileText, Sparkles, Upload, ShieldCheck, BriefcaseBusiness } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/dashboard/PageShell'
import { Card, InlineFeedback, PrimaryButton, SecondaryButton } from '../components/dashboard/primitives'
import { api } from '../lib/apiClient'
import { useToast } from '../components/feedback/ToastProvider'
import { useAuthSession } from '../context/AuthSessionContext'
import { friendlyErrorMessage, requireOnline } from '../lib/requestSafety'
import { parseResumeAnalysisResponse, parseResumeUploadResponse } from '../lib/resumeContract'
import { refreshAuthenticatedAnalysisSession, setAuthenticatedAnalysisSession, useAnalysisSession } from '../hooks/useAnalysisSession'
import { useCurrentUser } from '../hooks/useCurrentUser'
import type { AnalysisSession, ResumeUploadResult } from '../lib/analysisSession'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MIN_JOB_DESCRIPTION_CHARS = 80
const MAX_JOB_DESCRIPTION_CHARS = 50_000

function validateJobDescription(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length < MIN_JOB_DESCRIPTION_CHARS || trimmed.split(/\s+/).length < 12) {
    return 'Paste a fuller job description with specific skills, responsibilities, or experience expectations.'
  }
  if (trimmed.length > MAX_JOB_DESCRIPTION_CHARS) {
    return `Job descriptions must be ${MAX_JOB_DESCRIPTION_CHARS.toLocaleString()} characters or fewer.`
  }
  return null
}

export default function ResumeUpload() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { authenticatedUserId } = useAuthSession()
  const analysisSession = useAnalysisSession()
  const { profile } = useCurrentUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedResume, setUploadedResume] = useState<ResumeUploadResult | undefined>(analysisSession.upload)
  const [uploadedAt, setUploadedAt] = useState<string | undefined>(analysisSession.analyzedAt)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info')
  const [targetRole, setTargetRole] = useState(analysisSession.role || profile?.preferredRole || '')
  const [targetCompany, setTargetCompany] = useState(analysisSession.company || profile?.preferredCompany || '')
  const [jobDescription, setJobDescription] = useState(analysisSession.usedGeneralRoleExpectations ? '' : analysisSession.jobDescription || '')
  const [jobDescriptionTouched, setJobDescriptionTouched] = useState(false)
  const jobDescriptionError = validateJobDescription(jobDescription)

  useEffect(() => {
    if (analysisSession.upload && !selectedFile && !uploading) {
      setUploadedResume(analysisSession.upload)
      setUploadedAt(analysisSession.analyzedAt)
    }
  }, [analysisSession.analyzedAt, analysisSession.upload, selectedFile, uploading])

  useEffect(() => {
    if (!targetRole && (analysisSession.role || profile?.preferredRole)) setTargetRole(analysisSession.role || profile?.preferredRole || '')
    if (!targetCompany && (analysisSession.company || profile?.preferredCompany)) setTargetCompany(analysisSession.company || profile?.preferredCompany || '')
    if (!jobDescriptionTouched && !jobDescription && !analysisSession.usedGeneralRoleExpectations && analysisSession.jobDescription) setJobDescription(analysisSession.jobDescription)
  }, [analysisSession.company, analysisSession.jobDescription, analysisSession.role, analysisSession.usedGeneralRoleExpectations, jobDescription, jobDescriptionTouched, profile?.preferredCompany, profile?.preferredRole, targetCompany, targetRole])

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

  const openFilePicker = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    fileInputRef.current?.click()
  }

  const cancelReplacement = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    handleFileSelection(null)
  }

  const handleUpload = async () => {
    if (uploading) return
    if (!selectedFile) {
      setMessage('Please choose a PDF resume before uploading.')
      setMessageTone('error')
      toast({ title: 'Resume required', description: 'Choose a PDF resume before uploading.', tone: 'error' })
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
      setUploadedResume(uploadResult)
      const completedAt = new Date().toISOString()
      setUploadedAt(completedAt)
      if (authenticatedUserId) {
        setAuthenticatedAnalysisSession(authenticatedUserId, {
          upload: uploadResult,
          role: targetRole.trim(),
          company: targetCompany.trim(),
          jobDescription: jobDescription.trim(),
          analyzedAt: completedAt,
        })
      }
      setSelectedFile(null)
      setMessage('Resume uploaded successfully.')
      setMessageTone('success')
      toast({ title: 'Resume uploaded', description: 'Add the target details, then analyze this resume.', tone: 'success' })
    } catch (error) {
      const errorMessage = friendlyErrorMessage(error, 'RefAI could not upload this resume. Check the PDF and try again.')

      setMessage(errorMessage)
      setMessageTone('error')
      toast({ title: 'Resume could not be uploaded', description: errorMessage, tone: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleAnalyze = async () => {
    if (analyzing || !uploadedResume) return
    setJobDescriptionTouched(true)
    if (!targetRole.trim() || !targetCompany.trim() || jobDescriptionError) return

    setAnalyzing(true)
    setMessage('Comparing your resume with the target role…')
    setMessageTone('info')
    try {
      const exactJobDescription = jobDescription.trim()
      const matchResponse = await api.post('/resume/analyze', {
        resumeText: uploadedResume.preview,
        jobDescription: exactJobDescription,
        resumeId: uploadedResume.resumeId,
        fileName: uploadedResume.fileName,
        chunkCount: uploadedResume.chunkCount,
        storagePath: uploadedResume.storagePath,
        storageStatus: uploadedResume.storageStatus,
        indexed: uploadedResume.indexed,
        uploadProcessingTimeMs: uploadedResume.processingTimeMs,
        targetRole: targetRole.trim(),
        targetCompany: targetCompany.trim(),
      }, { timeout: 30_000 })
      const analysisResult = parseResumeAnalysisResponse(matchResponse.data, matchResponse.status)
      if (import.meta.env.DEV) console.debug('[RefAI resume analysis response]', { endpoint: '/resume/analyze', status: matchResponse.status, responseShape: Object.keys(analysisResult).sort() })
      const freshSession: AnalysisSession = {
        analysisId: analysisResult.analysisId,
        upload: uploadedResume,
        matchScore: {
          overall: analysisResult.overall,
          roleFit: analysisResult.roleFit,
          proof: analysisResult.proof,
          gaps: analysisResult.gaps,
        },
        analysis: analysisResult,
        jobDescription: exactJobDescription,
        role: targetRole.trim(),
        company: targetCompany.trim(),
        jobDescriptionClassification: analysisResult.jobDescriptionClassification,
        usedGeneralRoleExpectations: analysisResult.usedGeneralRoleExpectations,
        analyzedAt: new Date().toISOString(),
        processingTimeMs: uploadedResume.processingTimeMs + analysisResult.processingTimeMs,
      }
      if (authenticatedUserId) {
        setAuthenticatedAnalysisSession(authenticatedUserId, freshSession)
        void refreshAuthenticatedAnalysisSession(authenticatedUserId)
      }
      setMessage('Resume uploaded and analyzed successfully.')
      setMessageTone('success')
      toast({ title: 'Analysis ready', description: 'Review the role match and evidence before generating your Trust Card.', tone: 'success' })
      navigate('/dashboard/resume-analysis', { state: { analysisSession: freshSession } })
    } catch (error) {
      const errorMessage = friendlyErrorMessage(error, 'RefAI could not analyze this resume. Please try again.')

      setMessage(errorMessage)
      setMessageTone('error')
      toast({ title: 'Resume could not be analyzed', description: errorMessage, tone: 'error' })
    } finally {
      setAnalyzing(false)
    }
  }

  const canAnalyze = Boolean(uploadedResume && targetRole.trim() && targetCompany.trim() && !jobDescriptionError && !selectedFile)

  return (
    <PageShell
      eyebrow="Resume Workspace"
      title="Upload and analyze one resume"
      description="Choose one PDF, add its target role, and run the complete analysis from this workspace."
      action={<SecondaryButton onClick={() => navigate('/settings#profile')}>Back to Profile</SecondaryButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100">
              <FileText className="size-5 text-slate-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Step 1 · Upload Resume</h2>
              <p className="mt-1 text-sm text-slate-500">PDF only · Maximum 10 MB · Use the version intended for your target role</p>
            </div>
          </div>

          {!uploadedResume ? <label className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-slate-500">
            <div className="flex size-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <Upload className="size-5 text-slate-700" />
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-900">Drag and drop or click to upload</p>
            <p className="mt-2 text-sm text-slate-500">Your resume will be checked for skills, evidence, and referral readiness.</p>
            <input ref={fileInputRef} type="file" className="sr-only" accept=".pdf" onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)} disabled={uploading || analyzing} />
          </label> : <input ref={fileInputRef} type="file" className="sr-only" accept=".pdf" onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)} disabled={uploading || analyzing} />}
          {!uploadedResume && !selectedFile ? <PrimaryButton className="mt-4 w-full" onClick={handleUpload} disabled disabledReason="Choose a PDF resume first"><Upload className="mr-2 size-4" />Upload Resume</PrimaryButton> : null}

          {uploadedResume ? <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-white text-emerald-700">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950">Resume uploaded successfully</p>
                <p className="mt-1 text-xs text-emerald-800">{uploadedResume.fileName}{uploadedAt ? ` · Updated ${new Date(uploadedAt).toLocaleString()}` : ''}</p>
              </div>
            </div>
            {!selectedFile ? <SecondaryButton onClick={openFilePicker} disabled={uploading || analyzing}>Replace Resume</SecondaryButton> : null}
          </div> : null}

          {selectedFile ? <div className="mt-5 rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-lg bg-slate-100"><FileText className="size-4" /></div><div><p className="text-sm font-semibold">{selectedFile.name}</p><p className="text-xs text-slate-500">Ready to upload</p></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{uploadedResume ? <SecondaryButton onClick={cancelReplacement} disabled={uploading}>Cancel replacement</SecondaryButton> : null}<PrimaryButton onClick={handleUpload} loading={uploading}><Upload className="mr-2 size-4" />Upload Resume</PrimaryButton></div></div> : null}

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
              <p className="text-sm font-semibold">Step 2 · Target opportunity</p>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Role</span><input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={uploading || analyzing || !uploadedResume || Boolean(selectedFile)} placeholder="Associate Software Engineer" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-100" /></label>
                <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Company</span><input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} disabled={uploading || analyzing || !uploadedResume || Boolean(selectedFile)} placeholder="Atlassian" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:bg-slate-100" /></label>
              </div>
              <label className="block"><span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"><span>Job Description (Optional)</span><span className="font-normal normal-case tracking-normal">{jobDescription.length.toLocaleString()}/{MAX_JOB_DESCRIPTION_CHARS.toLocaleString()}</span></span><p className="mb-3 text-xs leading-5 text-slate-500">Paste the job description if you have one. This helps RefAI compare your resume against the specific role and generate a more accurate Trust Card. You can skip this if you're only exploring opportunities.</p><textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} onBlur={() => setJobDescriptionTouched(true)} disabled={uploading || analyzing || !uploadedResume || Boolean(selectedFile)} maxLength={MAX_JOB_DESCRIPTION_CHARS + 1} rows={6} placeholder="Paste the employer’s job description here." className={`w-full resize-y rounded-xl border bg-white p-3 text-sm leading-6 outline-none transition focus:ring-2 disabled:bg-slate-100 ${jobDescriptionTouched && jobDescriptionError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300 focus:border-black focus:ring-black/10'}`} />{jobDescriptionTouched && jobDescriptionError ? <p className="mt-2 text-xs font-medium text-rose-700">{jobDescriptionError}</p> : null}</label>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold">Step 3 · Analyze Resume</p>
            <p className="mt-1 text-sm text-slate-500">Analysis becomes available after the resume and target opportunity are ready.</p>
            {uploadedResume && !selectedFile ? <PrimaryButton className="mt-4 w-full" onClick={handleAnalyze} disabled={!canAnalyze} loading={analyzing} disabledReason={jobDescriptionError || 'Add the target company and role'}><Sparkles className="mr-2 size-4" />Analyze Resume</PrimaryButton> : <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Upload the resume in Step 1 to unlock analysis.</p>}
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
              <p className="mt-2 text-sm text-slate-500">{targetRole.trim() && targetCompany.trim() ? `RefAI will analyze your resume for this role at ${targetCompany.trim()}.` : 'Add the target role and company before continuing.'}</p>
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
