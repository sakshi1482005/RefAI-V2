export interface MatchScore {
  overall: number
  roleFit: number
  proof: number
  gaps: number
}

export interface TrustCard {
  id: string
  candidateName: string
  role: string
  matchScore: MatchScore
  topSkills: string[]
  aiSummary: string
  status: 'draft' | 'ready' | 'sent'
}

export interface ReferralRequest {
  id: string
  trustCardId: string
  employeeId: string
  message: string
  status: 'pending' | 'approved' | 'declined'
  createdAt: string
}
