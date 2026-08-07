import type { CurrentUserProfile } from '../hooks/useCurrentUser'
import type { AnalysisSession } from './analysisSession'
import type { ClaimVerificationResult } from '../types'

export const DEMO_CANDIDATE_ID = 'demo-ananya-rao'
export const DEMO_TRUST_SCORE = 91
export const DEMO_RESUME_MATCH = 88

export const demoClaimVerification: ClaimVerificationResult = {
  statusVersion: 'claim-verification-v2-significant-claims',
  interpretationSource: 'deterministic',
  claims: [
    {
      id: 'CL-DEMO-IMPACT', claim: 'Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.', category: 'quantified_impact', status: 'Evidence supported',
      reason: 'The resume provides a concrete action plus observable scope and outcome for this claim.',
      resumeEvidence: ['Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.'], supportingEvidenceSnippets: ['Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.'], resumeSection: 'Experience', resumeContext: 'Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.', missingSupport: null, suggestedClarificationQuestion: null, proofEvidence: [],
    },
    {
      id: 'CL-DEMO-PROJECT', claim: 'Built and maintained a FastAPI service used by 240 students.', category: 'quantified_impact', status: 'Partially supported',
      reason: 'The resume states implementation and usage, but does not explain how the usage figure was measured.',
      resumeEvidence: ['Built and maintained a FastAPI service used by 240 students.'], supportingEvidenceSnippets: ['Built and maintained a FastAPI service used by 240 students.'], resumeSection: 'Projects', resumeContext: 'Campus Services Platform — Built and maintained a FastAPI service used by 240 students.', missingSupport: 'The measurement period and source for the 240-student usage figure are not stated.', suggestedClarificationQuestion: 'How was the 240-student usage measured, over what period, and what part of the service did you personally implement?', proofEvidence: [],
    },
    {
      id: 'CL-DEMO-LEADERSHIP', claim: 'Led a team of 10.', category: 'leadership', status: 'Needs clarification',
      reason: 'This is a meaningful self-declared claim, but the resume does not state enough scope, individual contribution, or outcome to evaluate its support.',
      resumeEvidence: ['Led a team of 10.'], supportingEvidenceSnippets: [], resumeSection: 'Leadership', resumeContext: 'Led a team of 10.', missingSupport: 'The project, team responsibilities, individual contribution, duration, and observable outcome are not stated.', suggestedClarificationQuestion: 'What was your individual responsibility, the team context, and the observable outcome for this leadership claim?', proofEvidence: [],
    },
  ],
  limitation: 'Statuses describe support visible in fictional demo resume records. They do not make misconduct judgments, independently verify evidence, or prove that a claim is accurate.',
}

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
    analysisReliability: { label: 'High reliability', basis: 'The demo resume parsed successfully and contains multiple structured, evidence-backed claims.', limitations: 'This is isolated fictional demo data and does not verify the underlying claims.' },
    scoreReasons: ['Role Fit is 94% from weighted requirement coverage.', 'Proof is 82% from repeated evidence.', 'Gap Score is 6% from unsupported requirements.', 'Overall Match is the rounded average of Role Fit and Proof.'],
    atsGuidance: [{ title: 'Preserve supported terminology', description: 'Keep React, FastAPI, and SQL attached to measurable project evidence.' }, { title: 'Close remaining gaps', description: 'Add truthful system-design and cloud-deployment evidence.' }],
    interviewReadiness: { title: 'Evidence is ready for interview follow-up', description: 'Prepare concise examples for React, FastAPI, and SQL.' },
    processingTimeMs: 1840,
  },
  trustCard: {
    candidateName: 'Ananya Rao', role: 'Associate Software Engineer', overallMatch: DEMO_RESUME_MATCH, roleFit: 94, proofScore: 82, gapScore: 6, confidence: 95, analysisReliability: { label: 'High reliability', basis: 'The demo resume parsed successfully and contains multiple structured, evidence-backed claims.', limitations: 'This is isolated fictional demo data and does not verify the underlying claims.' }, trustScore: DEMO_TRUST_SCORE, scoreVersion: 'demo-trust-score-v2',
    referralReadiness: 'Ready to request referral', recommendation: 'Ready for referral',
    strengths: ['Strong React and TypeScript delivery evidence', 'FastAPI ownership supported by a measurable 240-user outcome'],
    weaknesses: ['System-design depth is not yet supported by detailed evidence.', 'Cloud deployment remains a documented gap.'],
    missingSkills: ['System design', 'Cloud deployment'],
    missingRequirements: demoActionPlan,
    actionPlan: demoActionPlan,
    evidence: ['React and TypeScript workflow improved completion by 18%.', 'FastAPI service supported 240 student users.', 'SQL reporting automated a weekly operations review.'],
    riskSignals: ['Cloud deployment experience is not evidenced.', 'System-design depth should be reviewed.'],
    scoreFormula: 'Role Requirement Match 30 + Evidence Strength 25 + Project and Experience Relevance 20 + Skill Depth 15 + Resume Evidence Completeness 10',
    scoreBreakdown: [
      { key: 'roleRequirementMatch', label: 'Role Requirement Match', weight: 30, score: 28, maximumScore: 30, basisPercentage: 93, contribution: 28, reason: 'Required and preferred JD requirements are covered by resume evidence.', formulaOrBasis: '(94% required x 70%) + (91% preferred x 30%) = 93%; weighted to 28/30.', evidenceFound: ['Resume: Improved completion of a React and TypeScript workflow by 18%.'], evidenceMissing: ['Required evidence missing: System design'], improvementAction: 'Add truthful system-design evidence from a completed project.', potentialImprovementPoints: 2, limitation: 'Requirement matching uses extracted terminology and may miss equivalent wording.', evidenceItems: [{ id: 'EV-DEMO-ROLE-01', status: 'Resume supported', factLabel: 'React and TypeScript delivery', snippet: 'Improved completion of a React and TypeScript workflow by 18%.', resumeSection: 'Experience', whyItAffectsScore: 'This line supports required frontend delivery requirements in the weighted coverage calculation.', sourceType: 'resume' }, { id: 'EV-DEMO-ROLE-02', status: 'Missing evidence', factLabel: 'System design', snippet: null, resumeSection: null, whyItAffectsScore: 'No resume line demonstrates system-design decisions.', sourceType: 'missing' }] },
      { key: 'evidenceStrength', label: 'Evidence Strength', weight: 25, score: 23, maximumScore: 25, basisPercentage: 92, contribution: 23, reason: 'Skills are supported by projects, internship use, and measurable outcomes.', formulaOrBasis: 'Deterministic evidence tiers are averaged and weighted to 23/25.', evidenceFound: ['Resume: Built a FastAPI service used by 240 students.'], evidenceMissing: [], improvementAction: 'Preserve measurable results beside each core skill.', potentialImprovementPoints: 2, limitation: 'Resume outcomes are student-provided and are not independently verified.', evidenceItems: [{ id: 'EV-DEMO-STRENGTH-01', status: 'Resume supported', factLabel: 'FastAPI implementation', snippet: 'Built a FastAPI service used by 240 students.', resumeSection: 'Projects', whyItAffectsScore: 'The implementation and measurable usage place FastAPI in a stronger evidence tier.', sourceType: 'resume' }] },
      { key: 'projectExperienceRelevance', label: 'Project and Experience Relevance', weight: 20, score: 18, maximumScore: 20, basisPercentage: 90, contribution: 18, reason: 'Project and internship descriptions align with the role responsibilities.', formulaOrBasis: 'Semantic relevance is combined with observable implementation evidence and weighted to 18/20.', evidenceFound: ['Resume: Built and maintained a FastAPI service used by 240 students.'], evidenceMissing: [], improvementAction: 'Add truthful deployment evidence to the existing project.', potentialImprovementPoints: 2, limitation: 'Similarity identifies related wording but does not verify implementation.', evidenceItems: [{ id: 'EV-DEMO-RELEVANCE-01', status: 'Resume supported', factLabel: 'Campus Services Platform', snippet: 'Built and maintained a FastAPI service used by 240 students.', resumeSection: 'Projects', whyItAffectsScore: 'This project was compared with the role responsibilities and contains implementation and outcome evidence.', sourceType: 'resume' }] },
      { key: 'skillDepth', label: 'Skill Depth', weight: 15, score: 14, maximumScore: 15, basisPercentage: 93, contribution: 14, reason: 'Core skills recur across role-connected project and internship evidence.', formulaOrBasis: 'Repeated role-connected skill evidence is averaged and weighted to 14/15.', evidenceFound: ['Resume: React and TypeScript were used across internship and project work.'], evidenceMissing: [], improvementAction: 'Keep repeated skills tied to specific responsibilities and results.', potentialImprovementPoints: 1, limitation: 'Repeated resume mentions do not independently assess proficiency.', evidenceItems: [{ id: 'EV-DEMO-DEPTH-01', status: 'Resume supported', factLabel: 'React and TypeScript depth', snippet: 'Improved completion of a React and TypeScript workflow by 18% during a software engineering internship.', resumeSection: 'Experience', whyItAffectsScore: 'The skills are demonstrated in role-connected experience with a measurable result.', sourceType: 'resume' }] },
      { key: 'resumeEvidenceCompleteness', label: 'Resume Evidence Completeness', weight: 10, score: 8, maximumScore: 10, basisPercentage: 80, contribution: 8, reason: 'Most observable evidence signals are present, with room for stronger chronology detail.', formulaOrBasis: 'Observable dates, education, project descriptions, links, chronology, quantified evidence, and consistency are weighted to 8/10.', evidenceFound: ['Resume: B.Tech, Computer Science and Engineering, 2022-2026.'], evidenceMissing: ['Chronology detail is incomplete.'], improvementAction: 'Add precise month-and-year ranges where they are known.', potentialImprovementPoints: 2, limitation: 'Completeness checks structure and internal consistency, not candidate honesty.', evidenceItems: [{ id: 'EV-DEMO-COMPLETE-01', status: 'Resume supported', factLabel: 'Education details', snippet: 'B.Tech, Computer Science and Engineering, 2022-2026.', resumeSection: 'Education', whyItAffectsScore: 'Education and date details are observable completeness signals.', sourceType: 'resume' }, { id: 'EV-DEMO-COMPLETE-02', status: 'Needs clarification', factLabel: 'Chronology detail', snippet: null, resumeSection: null, whyItAffectsScore: 'Some experience entries do not include precise date ranges.', sourceType: 'derived' }] },
    ],
    scoreReasons: ['Role Fit is 94% from weighted requirement coverage.', 'Proof is 82% from repeated evidence.', 'Gap Score is 6% from unsupported requirements.', 'Overall Match is the rounded average of Role Fit and Proof.'],
    aiSummary: 'Ananya is strongly prepared to request an employee review for Atlassian’s Associate Software Engineer role. Her React and TypeScript internship, FastAPI service used by 240 students, and SQL-backed analytics work support an 88% Resume Match. System-design depth and cloud deployment evidence remain the clearest areas to improve.',
    education: { college: demoStudent.college, degree: demoStudent.degree, branch: demoStudent.branch, graduationYear: demoStudent.graduationYear },
  },
  analyzedAt: '2026-07-16T10:30:00.000Z',
  processingTimeMs: 1840,
}

export const demoReferral = { id: 'demo-referral-001', employee: 'Meera Shah', employeeInitials: 'MS', company: 'Atlassian', role: 'Associate Software Engineer', requestedAt: 'Jul 16, 2026', status: 'Pending' as const, approvedAt: 'Jul 17, 2026', note: 'Approved by Meera Shah after reviewing Ananya Rao’s React delivery evidence, FastAPI project ownership, a strong resume-evidence review and a 91 Candidate Trust Score.' }
export const demoEmployee = { id: 'demo-employee-meera-shah', name: 'Meera Shah', initials: 'MS', company: 'Atlassian', designation: 'Senior Software Engineer' }
export const demoEmployeeReview = {
  candidateId: DEMO_CANDIDATE_ID, candidateName: demoStudent.fullName, initials: demoStudent.initials, role: demoAnalysisSession.role!, company: demoStudent.preferredCompany, status: 'Awaiting review', match: DEMO_RESUME_MATCH, submitted: '2 days ago',
  compatibilityScore: 88, compatibilityLabel: 'Good fit' as const,
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
  aiSummary: 'The strongest recorded evidence is measurable React and TypeScript delivery, ownership of a FastAPI service used by 240 students, and practical SQL reporting. Cloud deployment and system-design depth were not demonstrated and require manual verification. This advisory summary does not recommend approval or decline.',
}
export const demoReferralRequestNote = `Hi Meera, I’m applying for the Associate Software Engineer role at Atlassian and would appreciate it if you could review my profile and Trust Card. Thank you for taking a look.`
export const demoEmployeeReferralMessage = `I’m referring Ananya Rao for Atlassian’s Associate Software Engineer role. I reviewed her Candidate Trust Card and resume evidence, including an 88% Resume Match, measurable React and TypeScript delivery, ownership of a FastAPI service used by 240 students, and practical SQL work. Her cloud deployment and system-design depth should be explored during interviews.`
