import type { CurrentUserProfile } from '../hooks/useCurrentUser'
import type { AnalysisSession } from './analysisSession'

export const DEMO_CANDIDATE_ID = 'demo-ananya-rao'
export const DEMO_TRUST_SCORE = 91
export const DEMO_RESUME_MATCH = 88
export const DEMO_ATS_SCORE = 93

export const demoStudent: CurrentUserProfile = {
  id: 'demo-student-ananya-rao', email: 'ananya.rao@demo.refai.app', fullName: 'Ananya Rao', role: 'Student', location: 'Bengaluru, India',
  headline: 'Final-year computer science student building reliable AI-powered products', college: 'PES University', degree: 'B.Tech', branch: 'Computer Science and Engineering', graduationYear: '2026',
  skills: ['React', 'TypeScript', 'FastAPI', 'Python', 'SQL', 'Team Collaboration'], bio: 'Product-minded engineer with internship and project experience across React, FastAPI, and data-driven applications.',
  linkedinUrl: 'https://www.linkedin.com/in/ananya-rao-demo', githubUrl: 'https://github.com/ananya-rao-demo', portfolioUrl: 'https://ananyarao.dev', preferredRole: 'Associate Software Engineer', preferredCompany: 'Atlassian',
  resumeVisibility: 'referral-only', avatarUrl: '', emailVerified: true, initials: 'AR',
}

export const demoActionPlan = [
  { requirement: 'System design', category: 'software engineering practice', priority: 'critical' as const, whyItMatters: 'System design is a critical practice in the target job description and the resume does not show scale or reliability decisions.', practicalAction: 'Apply system design to the existing FastAPI project and document the engineering decisions.', evidenceSuggestion: 'Add a project bullet describing scale, caching, reliability trade-offs, and the resulting outcome.', estimatedEffort: '4–6 hours', nextStep: 'Write the design brief, update the resume with truthful evidence, then rerun analysis.' },
  { requirement: 'Cloud deployment', category: 'cloud platform', priority: 'important' as const, whyItMatters: 'Cloud deployment is important for demonstrating that the service can be operated beyond local development.', practicalAction: 'Deploy the FastAPI service and add basic monitoring.', evidenceSuggestion: 'Add a project bullet naming the platform, deployment workflow, monitoring, and result.', estimatedEffort: '2–4 hours', nextStep: 'Complete the deployment, capture evidence, then rerun analysis.' },
]

export const demoAnalysisSession: AnalysisSession = {
  company: demoStudent.preferredCompany,
  upload: { resumeId: 'demo-resume-ananya-2026', chunkCount: 14, fileName: 'Ananya_Rao_Atlassian_Resume.pdf', preview: 'Demo resume for Ananya Rao’s Associate Software Engineer application at Atlassian: React and TypeScript internship, FastAPI services, SQL analytics, and measurable project outcomes.', extractionStatus: 'complete', analysisStatus: 'pending', storagePath: null, storageStatus: 'demo', indexed: true, processingTimeMs: 960 },
  role: 'Associate Software Engineer',
  jobDescription: 'Build reliable web experiences with React and TypeScript, develop APIs, work with SQL, collaborate across product teams, and communicate engineering trade-offs.',
  matchScore: { overall: DEMO_RESUME_MATCH, roleFit: 94, proof: 82, gaps: 6 },
  analysis: {
    overall: DEMO_RESUME_MATCH, roleFit: 94, proof: 82, gaps: 6, analysisStatus: 'complete',
    matchedSkills: ['React', 'TypeScript', 'FastAPI', 'SQL', 'Cross-functional collaboration'],
    missingSkills: ['System design', 'Cloud deployment'],
    missingRequirements: demoActionPlan, actionPlan: demoActionPlan,
    strengths: ['94% of weighted job requirements have supporting resume evidence.', '82% of weighted requirements are reinforced by repeated evidence.'],
    weaknesses: ['System design evidence is incomplete.', 'Cloud deployment evidence is incomplete.'],
    evidence: ['React is supported by quantified internship delivery.', 'FastAPI is supported by a service used by 240 students.', 'SQL is supported by an automated operations report.'],
    resumeSectionsUsed: ['Experience', 'Projects', 'Skills', 'Education'], readinessSummary: 'The resume demonstrates strong weighted requirement coverage and repeated evidence.',
    learningRecommendations: ['Apply system design to the existing FastAPI project and document the engineering decisions.', 'Deploy the FastAPI service and add basic monitoring.'],
    confidence: 95,
    scoreReasons: ['Role Fit is 94% from weighted requirement coverage.', 'Proof is 82% from repeated evidence.', 'Gap Score is 6% from unsupported requirements.', 'Overall Match is the rounded average of Role Fit and Proof.'],
    atsGuidance: [{ title: 'Preserve supported terminology', description: 'Keep React, FastAPI, and SQL attached to measurable project evidence.' }, { title: 'Close remaining gaps', description: 'Add truthful system-design and cloud-deployment evidence.' }],
    interviewReadiness: { title: 'Evidence is ready for interview follow-up', description: 'Prepare concise examples for React, FastAPI, and SQL.' },
    processingTimeMs: 1840,
  },
  trustCard: {
    candidateName: 'Ananya Rao', role: 'Associate Software Engineer', overallMatch: DEMO_RESUME_MATCH, roleFit: 94, proofScore: 82, gapScore: 6, confidence: 95, trustScore: DEMO_TRUST_SCORE,
    referralReadiness: 'Ready to request referral', recommendation: 'Ready for referral',
    strengths: ['Strong React and TypeScript delivery evidence', 'FastAPI ownership supported by a measurable 240-user outcome'],
    weaknesses: ['System-design depth is not yet supported by detailed evidence.', 'Cloud deployment remains a documented gap.'],
    missingSkills: ['System design', 'Cloud deployment'],
    missingRequirements: demoActionPlan,
    actionPlan: demoActionPlan,
    evidence: ['React and TypeScript workflow improved completion by 18%.', 'FastAPI service supported 240 student users.', 'SQL reporting automated a weekly operations review.'],
    riskSignals: ['Cloud deployment experience is not evidenced.', 'System-design depth should be reviewed.'],
    scoreFormula: '30% Overall Match + 25% Role Fit + 15% Proof Score + 15% Confidence + 10% Completeness + 5% Gap Resilience',
    scoreBreakdown: [
      { key: 'overallMatch', label: 'Overall Match', weight: 30, score: 88, contribution: 26.4, reason: 'Combined role alignment and repeated evidence.' },
      { key: 'roleFit', label: 'Role Fit', weight: 25, score: 94, contribution: 23.5, reason: 'Meaningful job requirements represented in the resume.' },
      { key: 'proofScore', label: 'Proof Score', weight: 15, score: 82, contribution: 12.3, reason: 'Matched requirements reinforced by repeated resume evidence.' },
      { key: 'confidence', label: 'Analysis Confidence', weight: 15, score: 95, contribution: 14.25, reason: 'Confidence based on resume and job-description input coverage.' },
      { key: 'completeness', label: 'Required-field Completeness', weight: 10, score: 100, contribution: 10, reason: 'Candidate, role, resume, and job description inputs supplied.' },
      { key: 'gapResilience', label: 'Gap Resilience', weight: 5, score: 94, contribution: 4.7, reason: 'Inverse of the missing-requirement Gap Score.' },
    ],
    scoreReasons: ['Role Fit is 94% from weighted requirement coverage.', 'Proof is 82% from repeated evidence.', 'Gap Score is 6% from unsupported requirements.', 'Overall Match is the rounded average of Role Fit and Proof.'],
    aiSummary: 'Ananya is strongly prepared to request an employee review for Atlassian’s Associate Software Engineer role. Her React and TypeScript internship, FastAPI service used by 240 students, and SQL-backed analytics work support an 88% Resume Match. System-design depth and cloud deployment evidence remain the clearest areas to improve.',
    education: { college: demoStudent.college, degree: demoStudent.degree, branch: demoStudent.branch, graduationYear: demoStudent.graduationYear },
  },
  analyzedAt: '2026-07-16T10:30:00.000Z',
  processingTimeMs: 1840,
}

export const demoReferral = { id: 'demo-referral-001', employee: 'Meera Shah', employeeInitials: 'MS', company: 'Atlassian', role: 'Associate Software Engineer', requestedAt: 'Jul 16, 2026', status: 'Pending' as const, approvedAt: 'Jul 17, 2026', note: 'Approved by Meera Shah after reviewing Ananya Rao’s React delivery evidence, FastAPI project ownership, 88% Resume Match, 93 ATS Score, and 91 Trust Score.' }
export const demoEmployee = { id: 'demo-employee-meera-shah', name: 'Meera Shah', initials: 'MS', company: 'Atlassian', designation: 'Senior Software Engineer' }
export const demoEmployeeReview = {
  candidateId: DEMO_CANDIDATE_ID, candidateName: demoStudent.fullName, initials: demoStudent.initials, role: demoAnalysisSession.role!, company: demoStudent.preferredCompany, status: 'Awaiting review', match: DEMO_RESUME_MATCH, submitted: '2 days ago',
  reviewNote: 'Strong product engineering foundation. The resume connects React and TypeScript delivery to measurable results, while the FastAPI project shows end-to-end ownership. Validate system-design depth in interview, but the evidence supports a referral.',
  resumeSummary: 'Final-year computer science student with a software engineering internship and three shipped projects. Improved a React workflow’s completion rate by 18%, built a FastAPI service for 240 student users, and designed SQL reporting used by a five-person operations team.',
  evidence: ['React and TypeScript workflow improved completion by 18%', 'FastAPI service supported 240 student users', 'SQL reporting automated a weekly operations review', 'Worked in a five-person cross-functional product team'],
  skills: ['React', 'TypeScript', 'FastAPI', 'Python', 'SQL', 'Problem Solving'],
  resumeHighlights: [
    'Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.',
    'Built and maintained a FastAPI service used by 240 students.',
    'Automated a weekly operations review with SQL reporting for a five-person team.',
  ],
  verifiedEvidence: [
    { claim: 'React and TypeScript delivery', source: 'Software Engineering Intern · Experience section', evidence: 'Improved workflow completion by 18%.' },
    { claim: 'Backend API ownership', source: 'Campus Services Platform · Projects section', evidence: 'Built a FastAPI service used by 240 students.' },
    { claim: 'SQL and operational impact', source: 'Operations Analytics · Projects section', evidence: 'Automated the team’s weekly reporting review.' },
  ],
  projects: [
    { name: 'Campus Services Platform', detail: 'FastAPI and SQL service supporting 240 student users; Ananya owned API delivery and data queries.' },
    { name: 'Operations Analytics Dashboard', detail: 'React reporting interface that automated a recurring review for a five-person operations team.' },
  ],
  education: { college: demoStudent.college, degree: `${demoStudent.degree} · ${demoStudent.branch}`, graduation: `Graduating ${demoStudent.graduationYear}` },
  roleFit: 'Strong alignment with Atlassian’s Associate Software Engineer role: direct React, TypeScript, API, SQL, and cross-functional product-team evidence covers the primary requirements.',
  reasonsToApprove: [
    'Core role skills are demonstrated through shipped work, not only listed in a skills section.',
    'Multiple claims include measurable outcomes: 18% workflow improvement and 240 active student users.',
    'The 91 Trust Score and 88% Resume Match are supported by evidence across experience and projects.',
  ],
  reasonsToReject: [
    'Reject if the referral requires demonstrated production-scale system design beyond the evidence available here.',
    'Reject if hands-on cloud deployment is a strict requirement that cannot be validated during review.',
  ],
  concerns: [
    'Cloud deployment experience is not evidenced in the resume.',
    'System-design depth is not measurable from the submitted projects and should be verified in interview.',
    'Communication evidence is credible but less specific than the technical delivery evidence.',
  ],
  aiSummary: 'Ananya is a referral-ready candidate for Atlassian’s Associate Software Engineer role. The strongest evidence is measurable React and TypeScript delivery, ownership of a FastAPI service used by 240 students, and practical SQL reporting. Approval is reasonable if Meera is comfortable treating cloud deployment and system-design depth as interview checks rather than referral blockers.',
}
export const demoReferralRequestNote = `Hi Meera, I’m applying for the Associate Software Engineer role at Atlassian and would appreciate it if you could review my profile and Trust Card. Thank you for taking a look.`
export const demoEmployeeReferralMessage = `I’m referring Ananya Rao for Atlassian’s Associate Software Engineer role. I reviewed her Candidate Trust Card and resume evidence, including an 88% Resume Match, measurable React and TypeScript delivery, ownership of a FastAPI service used by 240 students, and practical SQL work. Her cloud deployment and system-design depth should be explored during interviews.`
