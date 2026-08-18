import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToast } from "../components/feedback/ToastProvider";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Copy,
  FileSearch,
  FileText,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  Menu,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Avatar, Badge, Card, EmptyState, IconButton, InlineFeedback, Logo, PrimaryButton, ProgressBar, ScoreExplanation, SecondaryButton, SectionHeading, Skeleton } from "../components/dashboard/primitives";
import { useAnalysisSessionResource } from "../hooks/useAnalysisSession";
import { useTrustCardResource } from "../hooks/useTrustCardResource";
import StudentNavigation from "../components/dashboard/StudentNavigation";
import { useAuthSession } from "../context/AuthSessionContext";
import NetworkStatusBanner from "../components/feedback/NetworkStatusBanner";
import { useSectionReveal } from "../hooks/useSectionReveal";
import ProfileMenu from "../components/dashboard/ProfileMenu";
import ConfettiBurst from "../components/feedback/ConfettiBurst";
import { getStudentWorkflowState } from "../lib/studentWorkflow";
import { api } from "../lib/apiClient";
import { friendlyErrorMessage } from "../lib/requestSafety";
import type { EmployeeDirectoryItem, EmployeeDiscoveryRecommendation, EmployeeReliabilityBadge as EmployeeReliabilityBadgeData, ReferralCompatibility, ReferralMessageAction, ReferralMessageResult, ReferralMessageTone, ReferralQuality, ReferralRequestSummary, ReferralStatus } from "../types";
import ReferralJourneyTimeline from "../components/dashboard/ReferralJourneyTimeline";
import ReferralReadinessGate from "../components/dashboard/ReferralReadinessGate";
import { calculateReferralReadiness } from "../lib/referralReadiness";
import NotificationCentre from "../components/dashboard/NotificationCentre";
import EmployeeReliabilityBadge from "../components/dashboard/EmployeeReliabilityBadge";
import CandidateIntelligencePanel from "../components/dashboard/CandidateIntelligencePanel";
import MoreInformationResponsePanel from "../components/dashboard/MoreInformationResponsePanel";
import { educationLines } from "../lib/education";

/*
 * RefAI Student Dashboard
 *
 * The UI primitives are intentionally defined in this file because this project
 * does not include every shadcn/ui component used by the dashboard. They follow
 * the same composable, Tailwind-based API without requiring additional files.
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Status = "Draft" | "Submitted" | "Under Review" | "More Info Requested" | "Approved for Referral" | "Referral Submitted" | "Declined" | "Withdrawn" | "Expired";

interface Employee {
  id: string;
  name: string;
  initials: string;
  company: string | null;
  designation: string | null;
  avatarClass: string;
  photoUrl: string | null;
  department: string | null;
  yearsExperience: number | null;
  verifiedEmployee: boolean;
  linkedinUrl: string | null;
  companyProfileUrl: string | null;
  portfolioUrl: string | null;
  supportedRoles: string[];
  supportedDepartments: string[];
  referralCategories: string[];
  referralGuidelines: string | null;
  acceptingRequests: boolean;
  activeRequestCount: number;
  maxActiveRequests: number;
  preferredCandidateLevels: string[];
  reliabilityBadge: EmployeeReliabilityBadgeData;
}

interface ReferralRequest {
  id: string;
  employee: string;
  initials: string;
  employeeCompany: string | null;
  company: string;
  role: string;
  date: string;
  status: Status;
  journeyStatus?: ReferralStatus;
  decisionMessage?: string | null;
  referralDate?: string | null;
  referralConfirmationNumber?: string | null;
  referralNoteToStudent?: string | null;
  updatedAt: string;
  moreInformationQuestion?: string | null;
  studentResponse?: string | null;
  studentResponseProofEntries?: import('../types').ProofEntry[];
}

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useCurrentUser();
  const { authLoading, authenticatedUserId } = useAuthSession();
  const analysisResource = useAnalysisSessionResource();
  const analysisSession = analysisResource.session;
  const { prefetch: prefetchTrustCard } = useTrustCardResource({ analysisId: analysisSession.analysisId, initialCard: analysisSession.trustCard, autoLoad: false });
  const initialStudentDataLoading = authLoading || profileLoading || analysisResource.loading;
  const [persistedEmployees, setPersistedEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [employeeRecommendations, setEmployeeRecommendations] = useState<EmployeeDiscoveryRecommendation[]>([]);
  const [persistedRequests, setPersistedRequests] = useState<ReferralRequestSummary[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [sendingReferral, setSendingReferral] = useState(false);
  const [readinessGateOpen, setReadinessGateOpen] = useState(false);
  const matchingSkills = analysisSession.analysis?.matchedSkills ?? [];
  const priorityActionPlan = analysisSession.trustCard?.actionPlan ?? analysisSession.analysis?.actionPlan ?? [];
  const referralSent = persistedRequests.length > 0;
  const workflow = useMemo(() => getStudentWorkflowState({ profile, session: analysisSession, hasReferralRequest: referralSent }), [analysisSession, profile, referralSent]);
  const employees: Employee[] = persistedEmployees.map((employee) => ({ id: employee.id, name: employee.name, initials: employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), photoUrl: employee.photoUrl, company: employee.company, designation: employee.designation, department: employee.department, yearsExperience: employee.yearsExperience, verifiedEmployee: employee.verifiedEmployee, linkedinUrl: employee.linkedinUrl, companyProfileUrl: employee.companyProfileUrl, portfolioUrl: employee.portfolioUrl, avatarClass: "bg-slate-950 text-white", supportedRoles: employee.supportedRoles, supportedDepartments: employee.supportedDepartments, referralCategories: employee.referralCategories, referralGuidelines: employee.referralGuidelines, acceptingRequests: employee.acceptingRequests, activeRequestCount: employee.activeRequestCount, maxActiveRequests: employee.maxActiveRequests, preferredCandidateLevels: employee.preferredCandidateLevels, reliabilityBadge: employee.reliabilityBadge }));
  const statusLabel = (status: ReferralStatus): Status => ({ draft: 'Draft', submitted: 'Submitted', pending: 'Submitted', under_review: 'Under Review', more_info_requested: 'More Info Requested', approved: 'Approved for Referral', declined: 'Declined', referred: 'Referral Submitted', withdrawn: 'Withdrawn', expired: 'Expired' })[status] as Status;
  const referralRequests: ReferralRequest[] = persistedRequests.map((request) => { const employee = employees.find((item) => item.id === request.employeeId); return { id: request.id, employee: employee?.name || 'Assigned employee', initials: employee?.initials || 'AE', employeeCompany: request.employeeCompanySnapshot || employee?.company || null, company: request.targetCompany, role: request.targetRole, date: new Date(request.createdAt).toLocaleDateString(), updatedAt: request.updatedAt, status: statusLabel(request.status), journeyStatus: request.status, decisionMessage: request.decisionMessage, referralDate: request.referralDate, referralConfirmationNumber: request.referralConfirmationNumber, referralNoteToStudent: request.referralNoteToStudent, moreInformationQuestion: request.moreInformationQuestion, studentResponse: request.studentResponse, studentResponseProofEntries: request.studentResponseProofEntries }; });
  const referralTrackerSummary = useMemo(() => {
    const statuses = persistedRequests.map((request) => request.status)
    const active = statuses.filter((status) => !['draft', 'referred', 'declined', 'withdrawn', 'expired'].includes(status)).length
    const approved = statuses.filter((status) => status === 'approved').length
    const awaitingResponse = statuses.filter((status) => status === 'submitted' || status === 'pending').length
    return [
      active ? `${active} Active` : null,
      approved ? `${approved} Approved` : null,
      awaitingResponse ? `${awaitingResponse} Awaiting response` : null,
    ].filter((item): item is string => Boolean(item))
  }, [persistedRequests])
  const readinessScore = analysisSession.trustCard?.trustScore ?? null;
  const referralReadiness = useMemo(() => analysisSession.trustCard ? calculateReferralReadiness(analysisSession.trustCard) : null, [analysisSession.trustCard]);
  const educationDetails = educationLines({
    college: analysisSession.trustCard?.education?.college || profile?.college || null,
    degree: analysisSession.trustCard?.education?.degree || profile?.degree || null,
    branch: analysisSession.trustCard?.education?.branch || profile?.branch || null,
    graduationYear: analysisSession.trustCard?.education?.graduationYear || profile?.graduationYear || null,
  });
  const profileSummary = [
    profile?.headline,
    profile?.bio,
    profile?.skills?.length ? profile.skills.slice(0, 3).join(" · ") : "",
    educationDetails[0],
    profile?.preferredRole && profile?.preferredCompany
      ? `${profile.preferredRole} at ${profile.preferredCompany}`
      : profile?.preferredRole || profile?.preferredCompany,
  ].find((detail) => detail?.trim());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [referralRequestNote, setReferralRequestNote] = useState("");
  const [referralCompany, setReferralCompany] = useState(analysisSession.company || "");
  const [referralRole, setReferralRole] = useState(analysisSession.role || "");
  const [referralJobDescription, setReferralJobDescription] = useState(analysisSession.jobDescription || "");
  const [referralWizardStep, setReferralWizardStep] = useState<1 | 2 | 3>(1);
  const [referralTone, setReferralTone] = useState<ReferralMessageTone>("professional_concise");
  const [messageGenerating, setMessageGenerating] = useState(false);
  const [messageGrounding, setMessageGrounding] = useState<ReferralMessageResult | null>(null);
  const [referralReviewed, setReferralReviewed] = useState(false);
  const [referralQuality, setReferralQuality] = useState<ReferralQuality | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<ReferralCompatibility | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [compatibilityReloadKey, setCompatibilityReloadKey] = useState(0);
  const [referralCelebration, setReferralCelebration] = useState(false);
  const [showReferralSuccess, setShowReferralSuccess] = useState(false);
  const employeeSearchRef = useRef<HTMLInputElement>(null);
  const referralMessageCache = useRef(new Map<string, ReferralMessageResult>());
  const messageRequestInFlight = useRef(false);
  useEffect(() => {
    referralMessageCache.current.clear();
    messageRequestInFlight.current = false;
  }, [authenticatedUserId]);
  useSectionReveal();
  useEffect(() => {
    setReferralCompany(analysisSession.company || "");
    setReferralRole(analysisSession.role || "");
    setReferralJobDescription(analysisSession.jobDescription || "");
  }, [analysisSession.company, analysisSession.jobDescription, analysisSession.role]);
  useEffect(() => {
    if (authenticatedUserId && !analysisResource.loading && analysisSession.analysisId && analysisSession.matchScore) {
      void prefetchTrustCard();
    }
  }, [analysisResource.loading, analysisSession.analysisId, analysisSession.matchScore, authenticatedUserId, prefetchTrustCard]);
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    Promise.all([
      api.get<EmployeeDirectoryItem[]>('/referral/employees'),
      api.get<ReferralRequestSummary[]>('/referral/requests'),
    ]).then(([employeeResponse, requestResponse]) => {
      if (!active) return;
      setPersistedEmployees(employeeResponse.data);
      setPersistedRequests(requestResponse.data);
    }).catch((error) => {
      if (active) toast({ title: 'Referral data unavailable', description: friendlyErrorMessage(error, 'Your saved referral data could not be loaded.'), tone: 'error' });
    });
    return () => { active = false; };
  }, [profile?.id, toast]);
  useEffect(() => {
    if (!analysisSession.trustCard?.id || !analysisSession.role?.trim() || !analysisSession.company?.trim()) { setEmployeeRecommendations([]); return; }
    let active = true;
    api.post<EmployeeDiscoveryRecommendation[]>('/referral/employees/recommendations', { trustCardId: analysisSession.trustCard.id, targetRole: analysisSession.role.trim(), targetCompany: analysisSession.company.trim(), jobDescription: analysisSession.jobDescription?.trim() || '' })
      .then(({ data }) => { if (active) setEmployeeRecommendations(data); })
      .catch(() => { if (active) setEmployeeRecommendations([]); });
    return () => { active = false; };
  }, [analysisSession.company, analysisSession.jobDescription, analysisSession.role, analysisSession.trustCard?.id]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (!typing && event.key === "/") { event.preventDefault(); employeeSearchRef.current?.focus(); }
      if (!typing && event.altKey && event.key.toLowerCase() === "u") { event.preventDefault(); navigate(workflow.uploadAction.href); }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate, workflow.uploadAction.href]);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  }, []);
  const firstName = profile?.fullName?.split(/\s+/)[0] || "there";
  const primaryNextAction = workflow.primaryAction;
  const isPrimaryWorkflowAction = (href: string) => href === primaryNextAction.href;
  const profileEvidenceCompleteness = useMemo(() => {
    const signals = [
      Boolean(profile?.fullName),
      Boolean(profile?.college && profile?.degree),
      Boolean(profile?.preferredRole),
      Boolean(profile?.skills?.length),
      Boolean(analysisSession.upload),
      Boolean(analysisSession.trustCard),
    ];
    return Math.round((signals.filter(Boolean).length / signals.length) * 100);
  }, [analysisSession.trustCard, analysisSession.upload, profile]);
  const activeRequestCount = referralRequests.filter((request) => !['Declined', 'Withdrawn', 'Expired', 'Referral Submitted'].includes(request.status)).length;

  const recommendationsByEmployee = useMemo(() => new Map(employeeRecommendations.map((item) => [item.employeeId, item])), [employeeRecommendations]);
  const filteredEmployees = useMemo(() => employees.filter((employee) =>
    `${employee.name} ${employee.company} ${employee.designation} ${employee.supportedRoles.join(' ')} ${employee.supportedDepartments.join(' ')}`
      .toLowerCase()
      .includes(employeeQuery.toLowerCase()),
  ).sort((left, right) => (employeeRecommendations.findIndex((item) => item.employeeId === left.id) < 0 ? Number.MAX_SAFE_INTEGER : employeeRecommendations.findIndex((item) => item.employeeId === left.id)) - (employeeRecommendations.findIndex((item) => item.employeeId === right.id) < 0 ? Number.MAX_SAFE_INTEGER : employeeRecommendations.findIndex((item) => item.employeeId === right.id))), [employeeQuery, employeeRecommendations, employees]);
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;

  useEffect(() => {
    if (!selectedEmployeeId || !analysisSession.trustCard?.id || !referralRole.trim() || !referralCompany.trim()) {
      setCompatibility(null);
      setCompatibilityError(null);
      setCompatibilityLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setCompatibilityLoading(true);
      setCompatibilityError(null);
      api.post<ReferralCompatibility>('/referral/compatibility', {
        employeeId: selectedEmployeeId,
        trustCardId: analysisSession.trustCard?.id,
        targetRole: referralRole.trim(),
        targetCompany: referralCompany.trim(),
        jobDescription: referralJobDescription.trim(),
        studentMessage: referralRequestNote.trim(),
      }).then(({ data }) => {
        if (active) setCompatibility(data);
      }).catch((error) => {
        if (!active) return;
        setCompatibility(null);
        setCompatibilityError(friendlyErrorMessage(error, 'Compatibility could not be calculated. Please retry.'));
      }).finally(() => {
        if (active) setCompatibilityLoading(false);
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [analysisSession.trustCard?.id, compatibilityReloadKey, referralCompany, referralJobDescription, referralRequestNote, referralRole, selectedEmployeeId]);

  const existingEmployeeRequest = persistedRequests.find((request) => request.employeeId === selectedEmployeeId);
  const followUpAvailable = Boolean(existingEmployeeRequest);
  const referralMessageWordCount = referralRequestNote.trim() ? referralRequestNote.trim().split(/\s+/).length : 0;
  const referralMessageCacheKey = useMemo(() => [
    authenticatedUserId || '',
    analysisSession.trustCard?.id || '',
    selectedEmployeeId || '',
    referralCompany.trim().toLocaleLowerCase(),
    referralRole.trim().toLocaleLowerCase(),
    referralJobDescription.trim(),
    referralTone,
  ].join('\u001f'), [analysisSession.trustCard?.id, authenticatedUserId, referralCompany, referralJobDescription, referralRole, referralTone, selectedEmployeeId]);
  const qualityPayload = (message: string) => ({
    employeeId: selectedEmployeeId,
    trustCardId: analysisSession.trustCard?.id,
    targetCompany: referralCompany.trim(),
    targetRole: referralRole.trim(),
    jobDescription: referralJobDescription.trim(),
    studentMessage: message.trim(),
  });
  const checkReferralQuality = async (message = referralRequestNote, silent = false): Promise<ReferralQuality | null> => {
    if (!selectedEmployeeId || !analysisSession.trustCard?.id || !referralCompany.trim() || !referralRole.trim() || !message.trim()) {
      setReferralQuality(null);
      return null;
    }
    if (!silent) setQualityLoading(true);
    setQualityError(null);
    try {
      const { data } = await api.post<ReferralQuality>('/referral/quality', qualityPayload(message));
      setReferralQuality(data);
      return data;
    } catch (error) {
      setQualityError(friendlyErrorMessage(error, 'Referral message quality could not be checked.'));
      return null;
    } finally {
      if (!silent) setQualityLoading(false);
    }
  };
  const generateReferralMessage = async (action: ReferralMessageAction) => {
    if (!selectedEmployeeId || !analysisSession.trustCard?.id || !referralCompany.trim() || !referralRole.trim() || messageGenerating || messageRequestInFlight.current) return;
    if (action === 'generate') {
      const cached = referralMessageCache.current.get(referralMessageCacheKey);
      if (cached) {
        setReferralRequestNote(cached.message);
        setReferralReviewed(false);
        setMessageGrounding(cached);
        setReferralWizardStep(3);
        await checkReferralQuality(cached.message);
        toast({ title: 'Saved AI draft reused', description: 'This grounded draft matches the selected opportunity and employee. Review it before sending.', tone: 'success' });
        return;
      }
    }
    messageRequestInFlight.current = true;
    setMessageGenerating(true);
    try {
      const { data } = await api.post<ReferralMessageResult>('/referral/message', {
        employeeId: selectedEmployeeId,
        trustCardId: analysisSession.trustCard.id,
        targetCompany: referralCompany.trim(),
        targetRole: referralRole.trim(),
        jobDescription: referralJobDescription.trim(),
        tone: referralTone,
        action,
        currentMessage: referralRequestNote.trim(),
        referralRequestId: referralTone === 'follow_up' ? existingEmployeeRequest?.id : undefined,
      });
      setReferralRequestNote(data.message);
      setReferralReviewed(false);
      setMessageGrounding(data);
      setReferralWizardStep(3);
      referralMessageCache.current.set(referralMessageCacheKey, data);
      await checkReferralQuality(data.message);
      toast({ title: data.usedFallback ? 'Safe referral draft prepared' : 'AI referral draft prepared', description: 'Review and edit every claim before continuing.', tone: 'success' });
    } catch (error) {
      toast({ title: 'Could not prepare the message', description: friendlyErrorMessage(error, 'The grounded message generator is unavailable.'), tone: 'error' });
    } finally {
      setMessageGenerating(false);
      messageRequestInFlight.current = false;
    }
  };

  useEffect(() => {
    if (referralWizardStep !== 3 || !referralRequestNote.trim()) return;
    setReferralReviewed(false);
    const timer = window.setTimeout(() => { void checkReferralQuality(referralRequestNote, true); }, 450);
    return () => window.clearTimeout(timer);
  }, [analysisSession.trustCard?.id, referralCompany, referralJobDescription, referralRequestNote, referralRole, referralWizardStep, selectedEmployeeId]);

  useEffect(() => {
    setReadinessGateOpen(false);
  }, [analysisSession.trustCard?.id, referralCompany, referralJobDescription, referralRole, selectedEmployeeId]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(referralRequestNote);
      setCopied(true);
      toast({ title: "Request note copied", description: "Your note is ready to paste.", tone: "success" });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      toast({ title: "Copy failed", description: "Your browser did not allow clipboard access.", tone: "error" });
    }
  };

  const sendReferral = async (readinessConfirmed = false) => {
    const employee = selectedEmployee;
    if (!employee || !analysisSession.trustCard?.id || !referralRole.trim() || !referralCompany.trim() || !referralRequestNote.trim() || sendingReferral) return;
    if (!employee.acceptingRequests) {
      toast({ title: 'Employee unavailable', description: 'This employee is not currently accepting referral requests.', tone: 'error' });
      return;
    }
    setSendingReferral(true);
    try {
      const quality = await checkReferralQuality(referralRequestNote);
      if (!quality) {
        toast({ title: 'Quality check unavailable', description: 'Recheck the message before sending.', tone: 'error' });
        return;
      }
      setReferralReviewed(true);
      if (!quality.canSubmit) {
        toast({ title: 'Factual-integrity edits required', description: 'Remove the blocking unsupported claims, then recheck.', tone: 'error' });
        return;
      }
      if (!readinessConfirmed) {
        setReadinessGateOpen(true);
        return;
      }
      const { data } = await api.post<ReferralRequestSummary>('/referral/requests', {
        employeeId: employee.id,
        trustCardId: analysisSession.trustCard.id,
        targetRole: referralRole.trim(),
        targetCompany: referralCompany.trim(),
        jobDescription: referralJobDescription.trim(),
        studentMessage: referralRequestNote.trim(),
      });
      setPersistedRequests((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setReferralCelebration(true);
      setShowReferralSuccess(true);
      setReadinessGateOpen(false);
      toast({ title: 'Referral request sent', description: `Your submitted request is now available to ${employee.name}.`, tone: 'success' });
      window.requestAnimationFrame(() => scrollToSection('referral-requests'));
    } catch (error) {
      toast({ title: 'Referral request not sent', description: friendlyErrorMessage(error, 'The request could not be saved. Please retry.'), tone: 'error' });
    } finally {
      setSendingReferral(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const sectionId = location.hash.replace(/^#/, "");
    if (sectionId) {
      window.requestAnimationFrame(() => scrollToSection(sectionId));
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-950">
      <ConfettiBurst active={referralCelebration} onComplete={() => setReferralCelebration(false)} />
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 2xl:gap-8">
            <Logo />

            <div className="hidden xl:block">
              <StudentNavigation />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <NotificationCentre />
            <ProfileMenu portal="student" />
            <div className="xl:hidden">
              <IconButton
                label="Toggle navigation"
                onClick={() => setMobileMenuOpen((current) => !current)}
                expanded={mobileMenuOpen}
                controls="student-mobile-navigation"
              >
                {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </IconButton>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="student-mobile-navigation" className="border-t border-slate-200 bg-white px-4 py-4 xl:hidden">
            <div className="mx-auto max-w-[1440px]">
              <StudentNavigation mobile onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}
      </header>
      <NetworkStatusBanner />

      <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8">
        {/* Compact dashboard strip */}
        <section className="order-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              {profileLoading ? <Skeleton className="h-8 w-64" /> : <h1 className="truncate text-2xl font-semibold tracking-tight">{greeting}, {firstName}</h1>}
              <p className="mt-1 text-sm text-slate-500">Your referral workspace at a glance.</p>
            </div>
            <PrimaryButton className="w-full shrink-0 sm:w-auto" onClick={() => navigate('/dashboard/resume')}>
              Analyse New Opportunity<ArrowRight className="ml-2 size-4" />
            </PrimaryButton>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {initialStudentDataLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />) : [
              { label: 'Candidate Trust Score', value: analysisSession.trustCard ? `${analysisSession.trustCard.trustScore}/100` : 'Not ready' },
              { label: 'Referral Readiness', value: referralReadiness?.label || analysisSession.trustCard?.referralReadiness || 'Not assessed' },
              { label: 'Active Requests', value: String(activeRequestCount) },
              { label: 'Profile Evidence', value: `${profileEvidenceCompleteness}% complete` },
            ].map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{metric.label}</p><p className="mt-2 text-base font-semibold text-slate-950 sm:text-lg">{metric.value}</p></div>)}
          </div>
        </section>

        {/* Dashboard overview */}
        <section aria-labelledby="dashboard-overview-title" className="order-1">
          <SectionHeading
            eyebrow="1 · Current Target Role"
            title={analysisSession.role || profile?.preferredRole || "No target role selected"}
            description={analysisSession.company || profile?.preferredCompany ? `Target company: ${analysisSession.company || profile?.preferredCompany}` : "Analyse an opportunity to set your current target role and company."}
          />

          <div>
            <Card className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><h3 className="text-xl font-semibold">Latest resume analysis</h3><FileText className="size-5 text-slate-400" /></div>
              {initialStudentDataLoading ? <div className="mt-6 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-4 w-2/3" /></div> : analysisResource.error ? <div className="mt-6"><InlineFeedback tone="error">{friendlyErrorMessage(analysisResource.error, 'Your latest analysis could not be loaded.')} <button type="button" className="font-semibold underline" onClick={analysisResource.retry}>Retry</button></InlineFeedback></div> : analysisSession.upload && analysisSession.matchScore ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{analysisSession.upload.fileName}</p><p className="mt-1 text-xs text-slate-500">{analysisSession.role || "Target role not saved"}</p></div><Badge tone="success">Analysis complete</Badge></div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{analysisSession.analyzedAt ? new Date(analysisSession.analyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Current session"}</span><button type="button" onClick={() => navigate("/dashboard/resume-analysis")} className="cursor-pointer font-semibold text-slate-900 hover:underline">View analysis</button></div>
              </div> : <EmptyState className="mt-6" icon={FileSearch} title="No analyzed resumes yet" description="Upload a PDF resume, choose a target role and company, and RefAI will calculate role fit, proof strength, and skill gaps." />}
            </Card>

          </div>
        </section>

        {/* Candidate Trust Card */}
        {workflow.hasTrustCard ? <section className="order-2">
          <SectionHeading
            eyebrow="2 · Candidate Trust Card"
            title="Preview what an employee will review"
            description="Check how RefAI summarizes your role fit, supporting proof, and gaps before you send a referral request."
          />

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
            <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
              <aside className="border-b border-slate-800 bg-slate-950 p-6 text-white sm:p-7 lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between gap-3"><Logo inverse /><Badge className="border-white/10 bg-white/10 text-white">Candidate credential</Badge></div>
                <div className="mt-8 flex items-center gap-3"><Avatar initials={profile?.initials ?? "—"} size="md" className="border-2 border-white/10 bg-white text-black" /><div className="min-w-0"><h3 className="truncate text-lg font-semibold">{analysisSession.trustCard?.candidateName || profile?.fullName || "Candidate"}</h3><p className="mt-0.5 truncate text-xs text-slate-400">{analysisSession.trustCard?.role || analysisSession.role || "Target role not available"}</p></div></div>
                <div className="mt-7 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Candidate Trust Score</p><p className="mt-1 text-5xl font-semibold tracking-[-0.05em] tabular-nums">{analysisSession.trustCard?.trustScore ?? "—"}<span className="ml-1 text-base font-medium text-slate-500">/100</span></p></div><div className="flex size-10 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10"><ShieldCheck className="size-5 text-emerald-300" /></div></div>
                <div className="mt-6 space-y-3 border-t border-white/10 pt-5"><div className="flex items-center gap-2 text-xs text-slate-300"><BriefcaseBusiness className="size-3.5 text-slate-500" /><span className="truncate">{analysisSession.company || "Target company not recorded"}</span></div><div className="flex items-start gap-2 text-xs leading-5 text-slate-400"><GraduationCap className="mt-0.5 size-3.5 shrink-0 text-slate-500" /><span>{profileLoading ? "Loading profile details…" : educationDetails[0] || profileSummary || "Profile details not available"}</span></div></div>
                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.045] p-3"><p className="text-[11px] font-semibold text-white">Evidence status</p><p className="mt-1 text-xs leading-5 text-slate-400">{analysisSession.trustCard?.analysisReliability?.label || "Reliability not recorded"}</p></div>
              </aside>

              <div className="min-w-0 p-6 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Employee-ready summary</p><h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Evidence at a glance</h3></div><div className="flex flex-wrap gap-2"><Badge tone={analysisSession.trustCard?.referralReadiness === 'Ready to request referral' ? 'success' : 'warning'}>{analysisSession.trustCard?.referralReadiness || 'Readiness not recorded'}</Badge><Badge tone="neutral">{analysisSession.trustCard?.analysisReliability?.label || 'Evidence status unavailable'}</Badge></div></div>
                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_14rem]"><div><div className="space-y-2">{(analysisSession.trustCard?.scoreBreakdown ?? []).map((factor) => { const maximum = factor.maximumScore ?? factor.weight; const progress = maximum > 0 ? (factor.contribution / maximum) * 100 : 0; return <div key={factor.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3"><div className="min-w-0"><div className="flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{factor.label}</span><span className="shrink-0 text-slate-500">{factor.contribution}/{maximum}</span></div><div className="mt-1.5"><ProgressBar value={progress} /></div></div></div> })}</div>
                    <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Top skills</p><div className="mt-2 flex flex-wrap gap-1.5">{matchingSkills.slice(0, 6).map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}{matchingSkills.length === 0 ? <span className="text-xs text-slate-500">No structured skills recorded.</span> : null}</div></div>
                  </div><div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4"><p className="text-xs font-semibold text-slate-800">Strongest evidence</p><div className="mt-3 space-y-2">{(analysisSession.trustCard?.strengths?.length ? analysisSession.trustCard.strengths : analysisSession.trustCard?.evidence ?? []).slice(0, 2).map((item) => <p key={item} className="text-xs leading-5 text-slate-600">✓ {item}</p>)}{!(analysisSession.trustCard?.strengths?.length || analysisSession.trustCard?.evidence?.length) ? <p className="text-xs leading-5 text-slate-500">No structured evidence summary recorded.</p> : null}</div><div className="mt-4 border-t border-slate-200 pt-3"><p className="text-xs font-semibold text-slate-800">Next evidence</p>{priorityActionPlan.slice(0, 2).map((item) => <p key={item.requirement} className="mt-1.5 text-xs leading-5 text-slate-600">• {item.requirement}</p>)}{priorityActionPlan.length === 0 ? <p className="mt-1.5 text-xs text-slate-500">No priority improvement recorded.</p> : null}</div></div></div>
                {(analysisSession.trustCard?.scoreBreakdown ?? []).length > 0 ? <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-inset">How this score was calculated</summary><ScoreExplanation className="mt-4" title="Candidate Trust Score details" points={analysisSession.trustCard!.scoreBreakdown.map((factor) => factor.reason)} /></details> : null}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row"><SecondaryButton onClick={() => navigate(workflow.trustCardAction.href)} onMouseEnter={() => { void prefetchTrustCard() }} onFocus={() => { void prefetchTrustCard() }}>{workflow.trustCardAction.label}<ArrowRight className="ml-2 size-4" /></SecondaryButton><SecondaryButton onClick={() => navigate(workflow.evidenceAction.href)}><GitBranch className="mr-2 size-4" />{workflow.evidenceAction.label}</SecondaryButton></div>
              </div>
            </div>
          </div>
        </section> : null}

        {workflow.hasTrustCard ? <div className="order-3"><CandidateIntelligencePanel analysisId={analysisSession.analysisId} enabled={workflow.hasTrustCard} /></div> : null}

        {workflow.hasAnalysis ? <section className="order-4">
          <SectionHeading
            eyebrow="4 · Highest-Priority Improvements"
            title="What would improve your evidence most"
            description="Focused actions from your current deterministic analysis. Potential points are not guaranteed."
          />
          <Card className="p-5 sm:p-6">
            {priorityActionPlan.length ? <div className="grid gap-3 lg:grid-cols-3">{priorityActionPlan.slice(0, 3).map((item) => <div key={item.requirement} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{item.requirement}</p><Badge tone={item.priority === 'critical' ? 'danger' : item.priority === 'important' ? 'warning' : 'neutral'}>{item.priority}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-600">{item.practicalAction}</p><p className="mt-2 text-xs text-slate-500">Estimated effort: {item.estimatedEffort}</p></div>)}</div> : <EmptyState icon={Sparkles} title="No priority improvements yet" description="Analyse an opportunity to receive evidence-backed improvement actions." />}
            {priorityActionPlan.length ? <div className="mt-4"><SecondaryButton onClick={() => navigate('/dashboard/action-plan')}>View full Action Plan</SecondaryButton></div> : null}
          </Card>
        </section> : null}

        {/* Employee discovery */}
        {workflow.hasTrustCard ? <section id="find-referrers" className="order-5 scroll-mt-24">
          <SectionHeading
            eyebrow="5 · Recommended Appropriate Employees"
            title="Choose an appropriate employee"
            description="Review the employee's role and company, then send a request backed by your current Trust Card."
          />

          <div className="relative mb-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={employeeSearchRef}
              aria-label="Search employees by name, company, or role"
              aria-keyshortcuts="/"
              value={employeeQuery}
              onChange={(event) => setEmployeeQuery(event.target.value)}
              placeholder="Search employees by company..."
              className="h-12 w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-16 text-sm shadow-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500 sm:block">/</kbd>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const selected = selectedEmployeeId === employee.id
              const signals = employeeSelectionSignals(employee)
              const recommendation = recommendationsByEmployee.get(employee.id)
              return <Card key={employee.id} className={`p-4 transition-all hover:-translate-y-0.5 ${selected ? 'border-slate-900 ring-1 ring-slate-900' : ''}`}>
                <div className="flex items-start gap-3"><Avatar initials={employee.initials} photoUrl={employee.photoUrl} size="sm" className={employee.avatarClass} /><div className="min-w-0 flex-1"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{employee.name}</h3><p className="mt-0.5 truncate text-xs text-slate-600">{employeeDirectoryIdentity(employee)}</p>{employee.department ? <p className="mt-1 text-[11px] text-slate-500">{employee.department}</p> : null}</div></div>{recommendation ? <Badge tone={recommendation.compatibility.label === 'Strong fit' || recommendation.compatibility.label === 'Good fit' ? 'success' : 'warning'}>{recommendation.compatibility.score}/100 · {recommendation.compatibility.label}</Badge> : null}</div>
                {selected ? <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">{compatibilityLoading ? <div className="space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /></div> : compatibility ? <><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-800">Referral compatibility</p><span className="text-xs font-semibold tabular-nums text-slate-900">{compatibility.score}/100 · {compatibility.label}</span></div><div className="mt-2 space-y-1">{compatibility.positiveFactors.slice(0, 3).map((reason) => <p key={reason} className="text-xs leading-5 text-slate-600">✓ {reason}</p>)}{compatibility.missingOrConflictingFactors.slice(0, 1).map((reason) => <p key={reason} className="text-xs leading-5 text-amber-800">Caution: {reason}</p>)}</div></> : compatibilityError ? <p className="text-xs text-red-700">{compatibilityError}</p> : <p className="text-xs text-slate-500">Compatibility will appear when the current opportunity details are available.</p>}</div> : null}
                <details className="mt-3 rounded-lg border border-slate-200 bg-white/70 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-black">View details</summary><div className="mt-3 space-y-2"><div className={`flex items-center gap-2 text-xs font-semibold ${employee.acceptingRequests ? 'text-emerald-900' : 'text-slate-600'}`}><UserCheck className={`size-3.5 ${employee.acceptingRequests ? 'text-emerald-700' : 'text-slate-400'}`} />{employee.acceptingRequests ? 'Accepting referral requests' : 'Not accepting requests'}</div><EmployeeReliabilityBadge badge={employee.reliabilityBadge} /><div className="flex flex-wrap gap-1.5">{signals.map((signal) => <Badge key={signal} tone="neutral">{signal}</Badge>)}</div>{recommendation ? <div className="border-t border-slate-200 pt-2"><p className="text-xs font-semibold text-slate-800">Why this employee?</p>{recommendation.matchReasons.slice(0, 3).map((reason) => <p key={reason} className="mt-1 text-xs leading-5 text-slate-600">✓ {reason}</p>)}{recommendation.concern ? <p className="mt-1 text-xs leading-5 text-amber-800">Caution: {recommendation.concern}</p> : null}</div> : null}<p className="text-xs leading-5 text-slate-600">{employee.reliabilityBadge.basis}</p>{employee.referralGuidelines ? <p className="text-xs leading-5 text-slate-600"><span className="font-semibold">Guideline:</span> {employee.referralGuidelines}</p> : null}{employee.preferredCandidateLevels.length ? <p className="text-xs leading-5 text-slate-600"><span className="font-semibold">Preferred levels:</span> {employee.preferredCandidateLevels.map((item) => item.replace(/_/g, ' ')).join(' · ')}</p> : null}{employee.reliabilityBadge.limitations.slice(0, 1).map((limitation) => <p key={limitation} className="text-[11px] leading-4 text-slate-500">Limit: {limitation}</p>)}</div></details>
                <PrimaryButton className="mt-3 w-full" disabled={!employee.acceptingRequests} disabledReason="This employee is not currently accepting requests" onClick={() => { if (selected) scrollToSection("referral-message"); else setSelectedEmployeeId(employee.id) }}>
                  {selected ? 'Continue with selected employee' : 'Select employee'}<ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
              </Card>
            })}
          </div>

          {filteredEmployees.length === 0 && <EmptyState className="mt-4" icon={Users} title={employees.length === 0 ? "Prepare for employee discovery" : "No employees match your search"} description={employees.length === 0 ? "Build a Trust Card while the employee-directory integration is being connected." : "Adjust the name, company, or role, or clear the current search."} action={<div className="flex flex-wrap justify-center gap-2">{!isPrimaryWorkflowAction(workflow.findEmployeesAction.href) ? <PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton> : null}{employeeQuery ? <SecondaryButton onClick={() => setEmployeeQuery("")}>Clear Search</SecondaryButton> : <SecondaryButton onClick={() => navigate('/dashboard#referral-requests')}>Referral Requests</SecondaryButton>}</div>} />}
        </section> : null}

        {/* Referral gate and message generator */}
        {workflow.hasTrustCard && selectedEmployeeId ? <section id="referral-message" className="order-5 grid scroll-mt-24 gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <Card className="border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <LockKeyhole className="size-5" />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.17em] text-emerald-700">
              Referral Readiness Gate
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950">
              {analysisSession.trustCard?.referralReadiness || 'Generate a Trust Card to calculate readiness'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-emerald-800">
              {analysisSession.trustCard ? `This result uses the backend Trust Score of ${analysisSession.trustCard.trustScore}. Ready begins at 75; scores from 55–74 should improve first.` : 'Complete resume analysis and generate the Trust Card before requesting a referral.'}
            </p>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-white/75 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-950">
                  Trust Score
                </span>
                <span className="text-sm font-semibold text-emerald-950">
                  {readinessScore ?? "—"}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={readinessScore ?? 0} tone="success" />
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold text-emerald-950">Highest-priority actions</p>
            <div className="mt-3 space-y-3">
              {priorityActionPlan.slice(0, 3).map((item) => <div key={item.requirement} className="rounded-lg border border-emerald-200 bg-white/75 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-emerald-950">{item.requirement}</p><Badge tone={item.priority === 'critical' ? 'danger' : item.priority === 'important' ? 'warning' : 'neutral'}>{item.priority}</Badge></div><p className="mt-2 text-sm leading-6 text-emerald-900">{item.practicalAction}</p><p className="mt-2 text-xs text-emerald-700">Estimated effort: {item.estimatedEffort}</p></div>)}
              {priorityActionPlan.length === 0 ? <p className="text-sm leading-6 text-emerald-900">{analysisSession.analysis ? 'No priority requirement gaps were identified.' : 'Complete resume analysis to generate a ranked Action Plan.'}</p> : null}
            </div>
            {priorityActionPlan.length > 0 ? <SecondaryButton className="mt-4" onClick={() => navigate('/dashboard/action-plan')}>View full Action Plan</SecondaryButton> : null}
            {selectedEmployee ? <div className="mt-6 space-y-3 border-t border-emerald-200 pt-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-emerald-950">Employee Reliability</p><EmployeeReliabilityBadge badge={selectedEmployee.reliabilityBadge} /></div><p className="text-xs leading-5 text-emerald-800">{selectedEmployee.reliabilityBadge.basis}</p></div> : null}
            <div className="mt-5 rounded-xl border border-emerald-200 bg-white/75 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-emerald-950">Referral Compatibility</p><p className="mt-1 text-xs text-emerald-700">Is this request appropriate for this employee?</p></div>{compatibility ? <div className="text-right"><p className="text-lg font-semibold text-emerald-950">{compatibility.score}/100</p><Badge tone={compatibility.label === 'Strong fit' || compatibility.label === 'Good fit' ? 'success' : 'warning'}>{compatibility.label}</Badge></div> : null}</div>
              {compatibilityLoading ? <div className="mt-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div> : null}
              {compatibilityError ? <div className="mt-4"><InlineFeedback tone="error">{compatibilityError}<SecondaryButton className="ml-3" onClick={() => setCompatibilityReloadKey((value) => value + 1)}>Retry</SecondaryButton></InlineFeedback></div> : null}
              {compatibility ? <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-emerald-900">View compatibility details</summary><div className="mt-3 space-y-3"><div className="grid gap-2 sm:grid-cols-2">{compatibility.components.map((component) => <div key={component.key} className="rounded-lg bg-emerald-50 p-3"><div className="flex justify-between gap-2 text-xs font-semibold text-emerald-950"><span>{component.label}</span><span>{component.score}/{component.maximumScore}</span></div></div>)}</div>{compatibility.positiveFactors.slice(0, 3).map((factor) => <p key={factor} className="text-xs leading-5 text-emerald-800">✓ {factor}</p>)}{compatibility.missingOrConflictingFactors.slice(0, 3).map((factor) => <p key={factor} className="text-xs leading-5 text-amber-800">Caution: {factor}</p>)}{compatibility.suggestedImprovements.slice(0, 2).map((item) => <p key={item} className="text-xs leading-5 text-slate-600">Improve: {item}</p>)}{compatibility.limitations.map((item) => <p key={item} className="text-[11px] leading-4 text-slate-500">{item}</p>)}</div></details> : null}
              {compatibility && compatibility.score < 45 ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><p className="font-semibold">Low compatibility warning</p><p>This does not predict rejection. You can reconsider the employee or improve the request, and you may still continue.</p><SecondaryButton className="mt-2" onClick={() => scrollToSection('find-referrers')}>Reconsider employee</SecondaryButton></div> : null}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-500">
                  Referral message · Step {referralWizardStep} of 3
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {referralWizardStep === 1 ? 'Opportunity' : referralWizardStep === 2 ? 'Employee and tone' : 'Generate and review'}
                </h2>
              </div>
              <Badge>{selectedEmployee?.name || 'Select employee'}</Badge>
            </div>

            {referralWizardStep === 1 ? <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Company<input value={referralCompany} onChange={(event) => setReferralCompany(event.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-black" /></label>
                <label className="text-sm font-semibold">Target role<input value={referralRole} onChange={(event) => setReferralRole(event.target.value)} maxLength={200} className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-black" /></label>
              </div>
              <label className="block text-sm font-semibold">Job Description <span className="font-normal text-slate-500">(Optional)</span><textarea value={referralJobDescription} onChange={(event) => setReferralJobDescription(event.target.value)} maxLength={100000} rows={4} className="mt-2 w-full resize-y rounded-xl border border-slate-300 p-3 text-sm font-normal leading-6 outline-none focus:border-black" placeholder="Paste a real Job Description when available." /></label>
              <p className="text-xs leading-5 text-slate-500">Without a Job Description, RefAI creates a general role-focused request and does not invent opening-specific responsibilities.</p>
              <PrimaryButton onClick={() => setReferralWizardStep(2)} disabled={!referralCompany.trim() || !referralRole.trim()} disabledReason="Company and target role are required">Continue</PrimaryButton>
            </div> : null}

            {referralWizardStep === 2 ? <div className="mt-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold">{selectedEmployee?.name}</p><p className="mt-1 text-xs text-slate-500">{selectedEmployee ? employeeDirectoryIdentity(selectedEmployee) : 'Profile details not provided'}</p></div>{selectedEmployee ? <EmployeeReliabilityBadge badge={selectedEmployee.reliabilityBadge} /> : null}</div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {([
                  ['professional_concise', 'Professional and concise'],
                  ['friendly', 'Friendly'],
                  ['first_time_outreach', 'First-time outreach'],
                  ...(followUpAvailable ? [['follow_up', 'Follow-up']] : []),
                ] as [ReferralMessageTone, string][]).map(([value, label]) => <button key={value} type="button" onClick={() => setReferralTone(value)} className={`rounded-xl border p-3 text-left text-sm font-semibold ${referralTone === value ? 'border-black bg-slate-950 text-white' : 'border-slate-200 bg-white'}`}>{label}</button>)}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Alumni connection is unavailable because RefAI has no verified shared-connection record for this employee. Follow-up appears only for an existing owned interaction.</p>
              <div className="mt-5 flex gap-3"><SecondaryButton onClick={() => setReferralWizardStep(1)}>Back</SecondaryButton><PrimaryButton onClick={() => setReferralWizardStep(3)}>Continue</PrimaryButton></div>
            </div> : null}

            {referralWizardStep === 3 ? <>
              <label htmlFor="referral-request-note" className="sr-only">Referral request note</label>
              <textarea id="referral-request-note" value={referralRequestNote} onChange={(event) => { setReferralRequestNote(event.target.value); setReferralReviewed(false); setReadinessGateOpen(false); }} maxLength={1000} disabled={!workflow.hasTrustCard} className="mt-6 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500" placeholder="Generate a grounded draft or write your own message." />
              <div className={`mt-2 flex items-center justify-between gap-3 text-xs ${referralMessageWordCount > 120 ? 'text-amber-700' : 'text-slate-500'}`}><span>{referralMessageWordCount > 120 ? 'Consider shortening this message; length is a non-blocking quality warning.' : 'Review every claim. RefAI never sends automatically.'}</span><span className="shrink-0">{referralMessageWordCount}/120 words</span></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => generateReferralMessage(referralRequestNote ? 'regenerate' : 'generate')} loading={messageGenerating} disabled={messageGenerating} disabledReason="Preparing your grounded draft"><Sparkles className="mr-2 size-4" />{referralRequestNote ? 'Regenerate' : 'Generate with AI'}</PrimaryButton>
                <SecondaryButton onClick={() => generateReferralMessage('shorter')} disabled={messageGenerating || !referralRequestNote.trim()} disabledReason={messageGenerating ? 'Preparing your grounded draft' : 'Generate or write a message first'}>Make shorter</SecondaryButton>
                <SecondaryButton onClick={() => generateReferralMessage('more_formal')} disabled={messageGenerating || !referralRequestNote.trim()} disabledReason={messageGenerating ? 'Preparing your grounded draft' : 'Generate or write a message first'}>More professional</SecondaryButton>
                <SecondaryButton onClick={() => generateReferralMessage('add_strongest_project')} disabled={messageGenerating} disabledReason="Preparing your grounded draft">Add strongest verified project</SecondaryButton>
                <SecondaryButton onClick={() => generateReferralMessage('remove_weak_claims')} disabled={messageGenerating || !referralRequestNote.trim()} disabledReason={messageGenerating ? 'Preparing your grounded draft' : 'Generate or write a message first'}>Remove weak claims</SecondaryButton>
              </div>
              {messageGenerating ? <p className="mt-3 text-xs text-slate-500" role="status">Preparing a grounded draft from your saved profile and selected opportunity…</p> : null}
              {messageGrounding ? <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer text-xs font-semibold">Grounding details · {messageGrounding.usedFacts.length} facts used</summary><div className="mt-3 space-y-2">{messageGrounding.usedFallback ? <p className="text-xs text-amber-700">Deterministic fallback used.</p> : null}{messageGrounding.groundingLimitations.map((item) => <p key={item} className="text-xs leading-5 text-slate-600">{item}</p>)}{messageGrounding.usedFacts.slice(0, 6).map((fact) => <p key={fact.id} className="text-xs leading-5 text-slate-600"><span className="font-semibold">{fact.sourceType}:</span> {fact.value}</p>)}</div></details> : null}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">Referral Message Quality Score</p><p className="mt-1 text-xs text-slate-500">Separate from Referral Compatibility and Candidate Trust Score.</p></div>{referralQuality ? <div className="text-right"><p className="text-xl font-semibold">{referralQuality.score}/100</p><Badge tone={referralQuality.canSubmit ? 'success' : 'danger'}>{referralQuality.label}</Badge></div> : null}</div>
                {qualityLoading ? <div className="mt-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div> : null}
                {qualityError ? <div className="mt-4"><InlineFeedback tone="error">{qualityError}</InlineFeedback></div> : null}
                {referralQuality ? <div className="mt-4 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">{referralQuality.checks.map((item) => <div key={item.key} className="rounded-lg bg-slate-50 p-3"><div className="flex justify-between gap-2 text-xs font-semibold"><span>{item.label}</span><span>{item.score}/{item.maximumScore}</span></div><p className="mt-1 text-[11px] leading-4 text-slate-500">{item.basis}</p></div>)}</div>
                  {referralQuality.blockingErrors.length ? <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-xs font-semibold text-red-900">Blocking factual-integrity errors</p>{referralQuality.blockingErrors.map((item) => <p key={item} className="mt-1 text-xs leading-5 text-red-800">• {item}</p>)}</div> : <p className="text-xs font-semibold text-emerald-700">No blocking factual-integrity errors detected.</p>}
                  {referralQuality.warnings.length ? <details><summary className="cursor-pointer text-xs font-semibold text-amber-800">Warnings ({referralQuality.warnings.length})</summary>{referralQuality.warnings.map((item) => <p key={item} className="mt-1 text-xs leading-5 text-amber-800">• {item}</p>)}</details> : null}
                  {referralQuality.passedChecks.length ? <details><summary className="cursor-pointer text-xs font-semibold text-emerald-800">Passed checks ({referralQuality.passedChecks.length})</summary>{referralQuality.passedChecks.map((item) => <p key={item} className="mt-1 text-xs leading-5 text-emerald-800">✓ {item}</p>)}</details> : null}
                  {referralQuality.recommendedEdits.length ? <details open={referralQuality.blockingErrors.length > 0}><summary className="cursor-pointer text-xs font-semibold">Recommended edits</summary>{referralQuality.recommendedEdits.map((item) => <p key={item} className="mt-1 text-xs leading-5 text-slate-600">• {item}</p>)}</details> : null}
                  <SecondaryButton onClick={() => { void checkReferralQuality(); }}>Recheck message</SecondaryButton>
                </div> : <p className="mt-4 text-xs leading-5 text-slate-500">Generate or write a message to run the deterministic quality check.</p>}
              </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <SecondaryButton onClick={() => setReferralWizardStep(2)}>Back</SecondaryButton>
              <SecondaryButton onClick={copyMessage} disabled={!referralRequestNote.trim()} disabledReason="Write a request note first">
                {copied ? (
                  <Check className="mr-2 size-4 text-emerald-600" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </SecondaryButton>

              <SecondaryButton onClick={() => scrollToSection('referral-requests')}>
                Track Referral Status
              </SecondaryButton>

              {!referralReviewed ? <PrimaryButton className="sm:ml-auto" onClick={async () => { const result = await checkReferralQuality(); if (result) { setReferralReviewed(true); toast({ title: 'Quality check ready', description: result.canSubmit ? 'Review the score and warnings before sending.' : 'Resolve the blocking factual-integrity errors before sending.', tone: result.canSubmit ? 'success' : 'error' }); } }} loading={qualityLoading} disabled={!referralRequestNote.trim()}>Continue to quality check</PrimaryButton> : null}
              {referralReviewed ? <PrimaryButton className="sm:ml-auto" onClick={() => { void sendReferral(); }} loading={sendingReferral && !readinessGateOpen} disabled={!referralRequestNote.trim() || !workflow.hasTrustCard || !selectedEmployeeId || !referralQuality || !referralQuality.canSubmit} disabledReason={!workflow.hasTrustCard ? "Generate a Trust Card first" : referralQuality?.blockingErrors.length ? "Remove blocking factual-integrity errors and recheck" : !selectedEmployeeId ? "Select an employee first" : "Review your request note before sending"}>
                <Send className="mr-2 size-4" />
                Review referral readiness
              </PrimaryButton> : null}
            </div>
            {readinessGateOpen && referralReadiness ? <ReferralReadinessGate readiness={referralReadiness} submitting={sendingReferral} onImprove={() => navigate('/dashboard/action-plan')} onContinue={() => { void sendReferral(true); }} /> : null}
            {showReferralSuccess ? <div role="status" className="toast-enter mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div><p className="font-semibold text-emerald-950">Referral request sent</p><p className="mt-1 text-sm leading-6 text-emerald-800">The request is saved as Submitted and is available in the assigned employee’s review queue.</p></div></div></div> : null}
            </> : null}
          </Card>
        </section> : null}

        {/* Referral requests */}
        <section id="referral-requests" className="order-4 scroll-mt-24">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">4 · Referral Requests</p><h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-950">Track every referral in one place</h2></div>
            {referralTrackerSummary.length ? <div className="flex flex-wrap gap-1.5" aria-label="Referral request summary">{referralTrackerSummary.map((item) => <Badge key={item} tone="neutral">{item}</Badge>)}</div> : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.38)] sm:p-3">
            <div className="space-y-2">
              {referralRequests.map((request) => {
                const statusMessage = referralTrackerStatusMessage(request.journeyStatus)
                const persistedRequest = persistedRequests.find((item) => item.id === request.id)
                return (
                <article key={request.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_5px_14px_-14px_rgba(15,23,42,0.35)] transition-colors hover:border-slate-300 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{request.company} <span className="font-normal text-slate-300">·</span> {request.role}</p><p className="mt-1 truncate text-xs text-slate-500">{request.employee}</p></div>
                    <div className="flex items-center gap-2"><time dateTime={request.updatedAt} className="text-xs text-slate-500">{formatReferralUpdate(request.updatedAt)}</time><Badge tone={referralTrackerBadgeTone(request.status)}>{request.status}</Badge></div>
                  </div>
                  {statusMessage ? <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600"><span className="font-medium text-slate-800">{statusMessage}</span></p> : request.journeyStatus ? <div className="mt-3 border-t border-slate-100 pt-2.5"><ReferralInlineProgress status={request.journeyStatus} /></div> : null}
                  <details className="group mt-2.5"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"><span>Details</span><span aria-hidden="true" className="transition group-open:rotate-180">⌄</span></summary><div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5"><ReferralJourneyTimeline requestId={request.id} currentStatus={request.journeyStatus || 'submitted'} />{request.decisionMessage ? <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-700">{request.decisionMessage}</p> : null}{persistedRequest ? <MoreInformationResponsePanel request={persistedRequest} onSubmitted={(updated) => setPersistedRequests((current) => current.map((item) => item.id === updated.id ? updated : item))} /> : null}{request.status === "Referral Submitted" ? <div className="mt-3 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-700"><p><span className="font-semibold">Submitted by {request.employee}</span>{request.referralDate ? ` on ${new Date(`${request.referralDate}T00:00:00`).toLocaleDateString()}` : ''}.</p>{request.referralConfirmationNumber ? <p className="mt-1">Confirmation: {request.referralConfirmationNumber}</p> : null}{request.referralNoteToStudent ? <p className="mt-1">{request.referralNoteToStudent}</p> : <p className="mt-1">Next step: monitor your email or application portal for updates from {request.company}.</p>}</div> : null}</div></details>
                </article>
                )
              })}
              {referralRequests.length === 0 ? <EmptyState className="border-slate-200 bg-white py-7" icon={Activity} title="No referral requests yet" description="Requests appear here after you choose an employee and submit an evidence-backed message." action={!isPrimaryWorkflowAction(workflow.findEmployeesAction.href) ? <PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton> : undefined} /> : null}
            </div>
          </div>
        </section>

        {analysisSession.analyzedAt || referralRequests.length > 0 ? <section className="order-6">
          <SectionHeading eyebrow="6 · Recent Activity" title="Latest workspace activity" description="Recent persisted analysis and referral events." />
          <Card className="p-5 sm:p-6">
            <div className="space-y-3">
              {analysisSession.analyzedAt ? <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><FileSearch className="size-4" /></div><div><p className="text-sm font-semibold">Resume analysis completed</p><p className="mt-1 text-xs text-slate-500">{new Date(analysisSession.analyzedAt).toLocaleString()} · {analysisSession.role || 'Target role'}</p></div></div> : null}
              {referralRequests.slice(0, 3).map((request) => <div key={request.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100"><Activity className="size-4" /></div><div><p className="text-sm font-semibold">Referral request · {request.status}</p><p className="mt-1 text-xs text-slate-500">{request.employee} · {request.company} · {request.date}</p></div></div>)}
            </div>
          </Card>
        </section> : null}

      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 py-7 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p className="text-sm text-slate-500">
            Built with <span className="text-rose-500">♥</span> by RefAI
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ShieldCheck className="size-4" />
            Trust Before Referrals
          </div>
        </div>
      </footer>
    </div>
  );
}

function ReferralInlineProgress({ status }: { status: ReferralStatus }) {
  const stages = [
    { label: 'Requested', state: status === 'draft' ? 'current' : 'complete' },
    { label: 'Review', state: ['submitted', 'pending', 'under_review'].includes(status) ? 'current' : ['approved', 'referred'].includes(status) ? 'complete' : 'pending' },
    { label: 'Approved', state: status === 'approved' ? 'current' : status === 'referred' ? 'complete' : 'pending' },
    { label: 'Submitted', state: status === 'referred' ? 'current' : 'pending' },
  ] as const
  return <ol aria-label={`Referral progress. Current stage: ${stages.find((stage) => stage.state === 'current')?.label ?? 'Pending'}`} className="grid grid-cols-4 gap-2">{stages.map((stage) => <li key={stage.label} className="min-w-0"><div className={`h-px ${stage.state === 'current' ? 'bg-blue-600' : stage.state === 'complete' ? 'bg-slate-400' : 'bg-slate-100'}`} /> <p className={`mt-1.5 flex items-center gap-1 truncate text-[10px] font-medium ${stage.state === 'current' ? 'text-blue-700' : stage.state === 'complete' ? 'text-slate-600' : 'text-slate-400'}`}>{stage.state === 'complete' ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}{stage.label}</p></li>)}</ol>
}

function referralTrackerBadgeTone(status: Status): 'neutral' | 'info' {
  return ['Declined', 'Withdrawn', 'Expired', 'Referral Submitted'].includes(status) ? 'neutral' : 'info'
}

function referralTrackerStatusMessage(status: ReferralStatus | undefined) {
  if (status === 'more_info_requested') return 'Additional information requested'
  if (status === 'declined') return 'Request declined'
  if (status === 'withdrawn') return 'Request withdrawn'
  if (status === 'expired') return 'Request expired'
  return null
}

function formatReferralUpdate(value: string) {
  const updated = new Date(value)
  return Number.isNaN(updated.getTime()) ? 'Latest update' : `Updated ${updated.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function employeeSelectionSignals(employee: Employee) {
  const signals = [
    employee.supportedRoles.length ? `Roles: ${employee.supportedRoles.slice(0, 2).join(' · ')}` : null,
    employee.department ? `Department: ${employee.department}` : null,
    employee.preferredCandidateLevels.length ? `Levels: ${employee.preferredCandidateLevels.slice(0, 2).map((item) => item.replace(/_/g, ' ')).join(' · ')}` : null,
    employee.reliabilityBadge.label,
  ].filter((item): item is string => Boolean(item))
  return signals.slice(0, 3)
}

function employeeDirectoryIdentity(employee: Employee) {
  return [employee.designation, employee.company].filter((value): value is string => Boolean(value?.trim())).join(' · ') || 'Profile details not provided'
}
