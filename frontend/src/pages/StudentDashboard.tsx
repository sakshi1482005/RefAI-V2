import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToast } from "../components/feedback/ToastProvider";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
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
import { Avatar, Badge, Card, EmptyState, IconButton, Logo, PrimaryButton, ProgressBar, ScoreExplanation, SecondaryButton, SectionHeading, Skeleton } from "../components/dashboard/primitives";
import { useAnalysisSession } from "../hooks/useAnalysisSession";
import StudentNavigation from "../components/dashboard/StudentNavigation";
import { buildScoreReasons } from "../lib/aiInsights";
import { hasReachedDemoStage, useDemoMode } from "../context/DemoModeContext";
import DemoModeBanner from "../components/dashboard/DemoModeBanner";
import { DEMO_ATS_SCORE, demoEmployee, demoReferral, demoReferralRequestNote } from "../lib/demoData";
import NetworkStatusBanner from "../components/feedback/NetworkStatusBanner";
import { useSectionReveal } from "../hooks/useSectionReveal";
import ProfileMenu from "../components/dashboard/ProfileMenu";
import ConfettiBurst from "../components/feedback/ConfettiBurst";
import { getStudentWorkflowState } from "../lib/studentWorkflow";
import { api } from "../lib/apiClient";
import { friendlyErrorMessage } from "../lib/requestSafety";
import type { EmployeeDirectoryItem, ReferralRequestSummary, ReferralStatus } from "../types";

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

type BadgeTone =
  | "neutral"
  | "dark"
  | "success"
  | "warning"
  | "danger"
  | "info";

type Status = "Pending" | "Under Review" | "Approved" | "Declined" | "More Info Requested" | "Referred";

interface Employee {
  id: string;
  name: string;
  initials: string;
  company: string;
  designation: string;
  avatarClass: string;
}

interface ReferralRequest {
  id: string;
  employee: string;
  initials: string;
  company: string;
  role: string;
  date: string;
  status: Status;
}

const statusTones: Record<Status, BadgeTone> = {
  Approved: "success",
  Referred: "success",
  Pending: "warning",
  "Under Review": "info",
  Declined: "danger",
  "More Info Requested": "info",
};

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export default function StudentDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile, loading: profileLoading } = useCurrentUser();
  const { isDemoMode, demoDecision, demoJourneyStage, setDemoJourneyStage } = useDemoMode();
  const analysisSession = useAnalysisSession();
  const [persistedEmployees, setPersistedEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [persistedRequests, setPersistedRequests] = useState<ReferralRequestSummary[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [sendingReferral, setSendingReferral] = useState(false);
  const demoAnalysisReady = isDemoMode && hasReachedDemoStage(demoJourneyStage, 'analyzed');
  const matchingSkills = demoAnalysisReady ? ["React", "TypeScript", "FastAPI", "SQL", "Problem Solving", "Team Collaboration"] : analysisSession.analysis?.matchedSkills ?? [];
  const priorityActionPlan = analysisSession.trustCard?.actionPlan ?? analysisSession.analysis?.actionPlan ?? [];
  const employeeDiscoveryReady = isDemoMode && hasReachedDemoStage(demoJourneyStage, 'trust-card-generated');
  const demoReferralSent = isDemoMode && hasReachedDemoStage(demoJourneyStage, 'referral-sent');
  const referralSent = isDemoMode ? demoReferralSent : persistedRequests.length > 0;
  const workflow = useMemo(() => getStudentWorkflowState({ profile, session: analysisSession, hasReferralRequest: referralSent }), [analysisSession, profile, referralSent]);
  const employees: Employee[] = isDemoMode
    ? (employeeDiscoveryReady ? [{ id: 'demo-employee', name: demoEmployee.name, initials: demoEmployee.initials, company: demoEmployee.company, designation: demoEmployee.designation, avatarClass: "bg-slate-950 text-white" }] : [])
    : persistedEmployees.map((employee) => ({ id: employee.id, name: employee.name, initials: employee.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(), company: employee.company || 'Company not listed', designation: employee.designation || 'Employee', avatarClass: "bg-slate-950 text-white" }));
  const statusLabel = (status: ReferralStatus): Status => ({ pending: 'Pending', under_review: 'Under Review', more_info_requested: 'More Info Requested', approved: 'Approved', declined: 'Declined', referred: 'Referred' })[status] as Status;
  const referralRequests: ReferralRequest[] = isDemoMode
    ? (demoReferralSent ? [{ id: 'demo-referral', employee: demoReferral.employee, initials: demoReferral.employeeInitials, company: demoReferral.company, role: demoReferral.role, date: demoReferral.requestedAt, status: demoDecision === 'pending' ? 'Pending' : demoDecision === 'approved' ? 'Approved' : demoDecision === 'more_info_requested' ? 'More Info Requested' : 'Declined' }] : [])
    : persistedRequests.map((request) => { const employee = employees.find((item) => item.id === request.employeeId); return { id: request.id, employee: employee?.name || 'Assigned employee', initials: employee?.initials || 'AE', company: request.targetCompany, role: request.targetRole, date: new Date(request.createdAt).toLocaleDateString(), status: statusLabel(request.status) }; });
  const readinessScore = analysisSession.trustCard?.trustScore ?? null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [referralRequestNote, setReferralRequestNote] = useState(() => isDemoMode ? demoReferralRequestNote : "");
  const [referralCelebration, setReferralCelebration] = useState(false);
  const [showReferralSuccess, setShowReferralSuccess] = useState(false);
  const employeeSearchRef = useRef<HTMLInputElement>(null);
  useSectionReveal();
  useEffect(() => {
    setReferralRequestNote(isDemoMode ? demoReferralRequestNote : "");
  }, [isDemoMode]);
  useEffect(() => {
    if (isDemoMode || !profile?.id) return;
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
  }, [isDemoMode, profile?.id, toast]);
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
  const scoreReasons = useMemo(() => analysisSession.matchScore ? buildScoreReasons(analysisSession.matchScore, isDemoMode) : [], [analysisSession.matchScore, isDemoMode]);
  const primaryNextAction = workflow.primaryAction;
  const isPrimaryWorkflowAction = (href: string) => href === primaryNextAction.href;

  const filteredEmployees = useMemo(() => employees.filter((employee) =>
    `${employee.name} ${employee.company} ${employee.designation}`
      .toLowerCase()
      .includes(employeeQuery.toLowerCase()),
  ), [employeeQuery, employees]);

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

  const reviewReferralNote = () => {
    if (!isDemoMode || !referralRequestNote.trim()) return;
    if (!hasReachedDemoStage(demoJourneyStage, 'message-reviewed')) setDemoJourneyStage('message-reviewed');
    toast({ title: "Request note reviewed", description: "Your referral request is ready to send.", tone: "success" });
  };

  const sendDemoReferral = () => {
    if (!isDemoMode || !hasReachedDemoStage(demoJourneyStage, 'message-reviewed') || !referralRequestNote.trim()) return;
    if (referralSent) {
      scrollToSection("referral-requests");
      return;
    }
    setDemoJourneyStage('referral-sent');
    setReferralCelebration(true);
    setShowReferralSuccess(true);
    toast({ title: "Referral request sent", description: "Referral history and Meera Shah’s employee queue were updated locally.", tone: "success" });
    window.requestAnimationFrame(() => scrollToSection("referral-requests"));
  };

  const sendReferral = async () => {
    if (isDemoMode) return sendDemoReferral();
    const employee = employees.find((item) => item.id === selectedEmployeeId);
    if (!employee || !analysisSession.trustCard?.id || !analysisSession.role || !analysisSession.company || !analysisSession.jobDescription || !referralRequestNote.trim() || sendingReferral) return;
    setSendingReferral(true);
    try {
      const { data } = await api.post<ReferralRequestSummary>('/referral/requests', {
        employeeId: employee.id,
        trustCardId: analysisSession.trustCard.id,
        targetRole: analysisSession.role,
        targetCompany: analysisSession.company,
        jobDescription: analysisSession.jobDescription,
        studentMessage: referralRequestNote.trim(),
      });
      setPersistedRequests((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setReferralCelebration(true);
      setShowReferralSuccess(true);
      toast({ title: 'Referral request sent', description: `Your pending request is now available to ${employee.name}.`, tone: 'success' });
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

          <div className="hidden items-center gap-1 sm:flex">
            <ProfileMenu portal="student" />
          </div>

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

        {mobileMenuOpen && (
          <div id="student-mobile-navigation" className="border-t border-slate-200 bg-white px-4 py-4 xl:hidden">
            <div className="mx-auto max-w-[1440px]">
              <StudentNavigation mobile onNavigate={() => setMobileMenuOpen(false)} />
            </div>
            <div className="mx-auto mt-3 flex max-w-[1440px] items-center justify-between rounded-xl bg-slate-50 p-3 sm:hidden">
              <ProfileMenu portal="student" showDetails onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        )}
      </header>
      <NetworkStatusBanner />
      <DemoModeBanner />

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1440px] space-y-12 px-4 py-6 outline-none sm:space-y-16 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        {/* Welcome hero */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-h-[290px] lg:grid-cols-[1.4fr_0.6fr]">
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
              <Badge className="mb-5">
                <Sparkles className="mr-1.5 size-3.5 text-slate-900" />
                AI-powered referral readiness
              </Badge>

              {profileLoading ? <div className="space-y-3"><Skeleton className="h-10 w-full max-w-lg" /><Skeleton className="h-10 w-2/3 max-w-sm" /></div> : <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">{greeting}, {firstName} <span aria-hidden="true">👋</span></h1>}

              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                {profile?.preferredRole
                  ? `This workspace tracks your profile, resume evidence, Trust Card, and referral progress for ${profile.preferredRole}${profile.preferredCompany ? ` opportunities at ${profile.preferredCompany}` : ""}. Continue with the next incomplete step.`
                  : "This workspace tracks the evidence behind your referral requests. Complete your profile first, then analyze a resume for a target role."}
              </p>

              <div className="mt-7 sm:mt-8">
                <PrimaryButton className="w-full sm:w-auto" onClick={() => navigate(primaryNextAction.href)}>
                  {primaryNextAction.label}<ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
              </div>
            </div>

            <div className="relative hidden items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 lg:flex">
              <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]" />

              <div className="relative w-64 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-black text-white">
                    <ShieldCheck className="size-5" />
                  </div>
                  <Badge tone={analysisSession.trustCard ? "success" : "neutral"}>{analysisSession.trustCard ? "Trust Card ready" : analysisSession.matchScore ? "Analysis ready" : "Setup needed"}</Badge>
                </div>

                {analysisSession.matchScore ? <>
                  <div className="mt-5 space-y-2"><div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${analysisSession.matchScore.overall}%` }} /><div className="h-2 w-1/2 rounded-full bg-slate-200" /></div>
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {[
                      { label: "Match", value: analysisSession.matchScore.overall },
                      { label: "Role fit", value: analysisSession.matchScore.roleFit },
                      { label: "Proof", value: analysisSession.matchScore.proof },
                    ].map((score) => <div key={score.label} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-center"><p className="text-lg font-semibold">{score.value}%</p><p className="text-[10px] text-slate-500">{score.label}</p></div>)}
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-950 p-3 text-white"><CheckCircle2 className="size-4 text-emerald-400" /><span className="text-xs font-medium">Latest analysis available</span></div>
                </> : <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="text-sm font-semibold">No resume analysis yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Upload a resume and add a target role to create your first readiness snapshot.</p></div>}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard overview */}
        <section aria-labelledby="dashboard-overview-title">
          <SectionHeading
            eyebrow="Your workspace"
            title="Your current referral readiness"
            description="See what is complete, what RefAI has analyzed, and which action will move your referral forward."
          />

          <div>
            <Card className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recently analyzed resumes</p><h3 className="mt-2 text-xl font-semibold">Latest analysis</h3></div><FileText className="size-5 text-slate-400" /></div>
              {analysisSession.upload && analysisSession.matchScore ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{analysisSession.upload.fileName}</p><p className="mt-1 text-xs text-slate-500">{analysisSession.role || "Target role not saved"}</p></div><Badge tone="success">{analysisSession.matchScore.overall}% match</Badge></div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{analysisSession.analyzedAt ? new Date(analysisSession.analyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Current session"}</span><button type="button" onClick={() => navigate("/dashboard/resume-analysis")} className="cursor-pointer font-semibold text-slate-900 hover:underline">View analysis</button></div>
              </div> : <EmptyState className="mt-6" icon={FileSearch} title="No analyzed resumes yet" description="Upload a PDF resume, choose a target role and company, and RefAI will calculate role fit, proof strength, and skill gaps." />}
            </Card>

          </div>
        </section>

        {/* Candidate Trust Card */}
        {workflow.hasTrustCard ? <section>
          <SectionHeading
            eyebrow="Candidate Trust Card"
            title="Preview what an employee will review"
            description="Check how RefAI summarizes your role fit, supporting proof, and gaps before you send a referral request."
          />

          <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[0.62fr_1.38fr]">
            <div className="border-b border-slate-800 bg-slate-950 p-7 text-white sm:p-9 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3">
                <Logo inverse />
                <Badge className="border-white/10 bg-white/10 text-white">
                  Employee view
                </Badge>
              </div>

              <div className="mt-10">
                <Avatar
                  initials={profile?.initials ?? "—"}
                  size="lg"
                  className="border-4 border-white/10 bg-white text-black"
                />
                <h3 className="mt-5 text-2xl font-semibold">{analysisSession.trustCard?.candidateName || profile?.fullName || "Candidate"}</h3>
                <p className="mt-1.5 text-sm text-slate-400">
                  Profile details not available
                </p>

                <div className="mt-6 flex items-center gap-2">
                  <BriefcaseBusiness className="size-4 text-slate-400" />
                  <span className="text-sm">Target: {analysisSession.trustCard?.role || analysisSession.role || "Not available"}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <GraduationCap className="size-4 text-slate-400" />
                  <span className="text-sm">Education data not available</span>
                </div>
              </div>

              <div className="my-8 h-px bg-white/10" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    Trust Score
                  </p>
                  <p className="mt-2 text-4xl font-semibold">{analysisSession.trustCard?.trustScore ?? "—"}</p>
                </div>
                <div className="flex size-14 items-center justify-center rounded-full border-4 border-emerald-400 text-emerald-300">
                  <Check className="size-6" />
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span className="text-sm font-semibold">
                    {analysisSession.trustCard ? "Trust Card generated" : "Trust Card unavailable"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {analysisSession.trustCard ? "Generated by the Trust Card API." : "Generate a Trust Card to view evidence."}
                </p>
              </div>
            </div>

            <div className="p-7 sm:p-9">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    AI-generated assessment
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    Referral confidence overview
                  </h3>
                </div>

                <Badge tone={analysisSession.trustCard ? "success" : "neutral"}>
                  <ShieldCheck className="mr-1.5 size-3.5" />
                  {analysisSession.trustCard?.referralReadiness || "Not generated"}
                </Badge>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {(analysisSession.trustCard ? [
                  { label: "Trust Score", value: String(analysisSession.trustCard.trustScore), score: analysisSession.trustCard.trustScore },
                  { label: "Overall Match", value: `${analysisSession.trustCard.overallMatch}%`, score: analysisSession.trustCard.overallMatch },
                  ...(isDemoMode ? [{ label: "ATS Score", value: String(DEMO_ATS_SCORE), score: DEMO_ATS_SCORE }] : []),
                  { label: "Role Fit", value: `${analysisSession.trustCard.roleFit}%`, score: analysisSession.trustCard.roleFit },
                  { label: "Proof", value: `${analysisSession.trustCard.proofScore}%`, score: analysisSession.trustCard.proofScore },
                  { label: "Confidence", value: `${analysisSession.trustCard.confidence}%`, score: analysisSession.trustCard.confidence },
                  { label: "Gaps", value: `${analysisSession.trustCard.gapScore}%`, score: analysisSession.trustCard.gapScore },
                ] : []).map((signal) => (
                  <div
                    key={signal.label}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        {signal.label}
                      </span>
                      <span className="text-sm font-semibold">{signal.value}</span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={signal.score} />
                    </div>
                  </div>
                ))}
              </div>
              {scoreReasons.length > 0 ? <ScoreExplanation className="mt-7" title="Why these Trust Card signals?" points={scoreReasons} /> : null}
              {!analysisSession.trustCard ? <EmptyState className="mt-7" icon={ShieldCheck} title="Generate your Trust Card" description="Complete a resume analysis to turn match scores and supporting evidence into an employee-ready referral summary." /> : null}

              <div className="mt-7">
                <p className="text-sm font-semibold">Top Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {matchingSkills.slice(0, 5).map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                  {matchingSkills.length === 0 ? <p className="text-sm text-slate-500">Verified skill evidence will appear when the analysis API returns structured skills.</p> : null}
                </div>
              </div>

              <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  <p className="text-sm font-semibold">AI Trust Summary</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {analysisSession.trustCard?.aiSummary || "No AI Trust Card summary is available."}
                </p>
              </div>

              {!isPrimaryWorkflowAction(workflow.trustCardAction.href) ? <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>
                  {workflow.trustCardAction.label}
                  <ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
                <SecondaryButton onClick={() => navigate(workflow.evidenceAction.href)}>
                  <GitBranch className="mr-2 size-4" />
                  {workflow.evidenceAction.label}
                </SecondaryButton>
              </div> : null}
            </div>
          </div>
        </section> : null}

        {/* Employee discovery */}
        {workflow.hasTrustCard ? <section id="find-referrers" className="scroll-mt-24">
          <SectionHeading
            eyebrow="Find Referrers"
            title="Choose an employee for your target company"
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
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className={`p-5 transition-transform hover:-translate-y-0.5 ${selectedEmployeeId === employee.id ? 'ring-2 ring-black' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <Avatar
                    initials={employee.initials}
                    className={employee.avatarClass}
                  />
                  <Badge tone="success">
                    <CheckCircle2 className="mr-1 size-3" />
                    Verified
                  </Badge>
                </div>

                <h3 className="mt-5 font-semibold">{employee.name}</h3>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {employee.company}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {employee.designation}
                </p>

                <div className="mt-5 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-600">
                  <UserCheck className="size-4 text-emerald-600" />
                  Open to Referrals
                </div>

                <PrimaryButton className="mt-4 w-full" onClick={() => { setSelectedEmployeeId(employee.id); if (isDemoMode && !hasReachedDemoStage(demoJourneyStage, 'employee-selected')) setDemoJourneyStage('employee-selected'); scrollToSection("referral-message"); }}>
                  {selectedEmployeeId === employee.id ? 'Selected' : 'Request Referral'}
                  <ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && <EmptyState className="mt-4" icon={Users} title={employees.length === 0 ? "Prepare for employee discovery" : "No employees match your search"} description={employees.length === 0 ? "Build a Trust Card while the employee-directory integration is being connected." : "Adjust the name, company, or role, or clear the current search."} action={<div className="flex flex-wrap justify-center gap-2">{!isPrimaryWorkflowAction(workflow.findEmployeesAction.href) ? <PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton> : null}{employeeQuery ? <SecondaryButton onClick={() => setEmployeeQuery("")}>Clear Search</SecondaryButton> : <SecondaryButton onClick={() => navigate('/dashboard#referral-requests')}>Referral Requests</SecondaryButton>}</div>} />}
        </section> : null}

        {/* Referral gate and message generator */}
        {workflow.hasTrustCard && selectedEmployeeId ? <section id="referral-message" className="grid scroll-mt-24 gap-6 xl:grid-cols-[0.75fr_1.25fr]">
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
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-500">
                  Referral Request Note
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Add a short note for the employee
                </h2>
              </div>

              <Badge>Applicant message</Badge>
            </div>

            <label htmlFor="referral-request-note" className="sr-only">Referral request note</label>
            <textarea
              id="referral-request-note"
              value={referralRequestNote}
              onChange={(event) => setReferralRequestNote(event.target.value)}
              maxLength={300}
              disabled={!workflow.hasTrustCard}
              className="mt-6 min-h-32 w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Hi, I’m applying for the Software Developer role and would appreciate it if you could review my profile and Trust Card."
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Write in your own voice. The employee will make the referral decision.</span>
              <span className="shrink-0">{referralRequestNote.length}/300</span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <SecondaryButton onClick={copyMessage} disabled={!referralRequestNote.trim()} disabledReason="Write a request note first">
                {copied ? (
                  <Check className="mr-2 size-4 text-emerald-600" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </SecondaryButton>

              {isDemoMode && referralRequestNote.trim() && !hasReachedDemoStage(demoJourneyStage, 'message-reviewed') ? <SecondaryButton onClick={reviewReferralNote}>Review Note</SecondaryButton> : null}

              <SecondaryButton onClick={() => scrollToSection('referral-requests')}>
                Track Referral Status
              </SecondaryButton>

              <PrimaryButton className="sm:ml-auto" onClick={sendReferral} loading={sendingReferral} disabled={!referralRequestNote.trim() || !workflow.hasTrustCard || (!isDemoMode && !selectedEmployeeId) || (isDemoMode && !hasReachedDemoStage(demoJourneyStage, 'message-reviewed'))} disabledReason={!workflow.hasTrustCard ? "Generate a Trust Card first" : !isDemoMode && !selectedEmployeeId ? "Select an employee first" : "Review your request note before sending"}>
                {isDemoMode ? <CheckCircle2 className="mr-2 size-4" /> : <Send className="mr-2 size-4" />}
                {isDemoMode ? referralSent ? "View Sent Request" : "Send Referral Request" : "Send Referral Request"}
              </PrimaryButton>
            </div>
            {showReferralSuccess ? <div role="status" className="toast-enter mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div><p className="font-semibold text-emerald-950">Referral request sent</p><p className="mt-1 text-sm leading-6 text-emerald-800">The request is saved as Pending and is available in the assigned employee’s review queue.</p></div></div></div> : null}
          </Card>
        </section> : null}

        {/* Referral requests */}
        <section id="referral-requests" className="scroll-mt-24">
          <SectionHeading
            eyebrow="My Referral Requests"
            title="Track every referral in one place"
            description="Stay informed from the moment you share your Trust Card."
            action={
              <SecondaryButton onClick={() => scrollToSection('referral-requests')}>
                View all requests
                <ChevronRight className="ml-1 size-4" />
              </SecondaryButton>
            }
          />

          <Card className="overflow-hidden">
            <div className="hidden grid-cols-[1.3fr_1fr_1.4fr_0.8fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
              <span>Employee</span>
              <span>Company</span>
              <span>Role</span>
              <span>Date</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-slate-200">
              {referralRequests.map((request) => (
                <div
                  key={request.id}
                  className="grid gap-4 px-5 py-5 hover:bg-slate-50 md:grid-cols-[1.3fr_1fr_1.4fr_0.8fr_0.7fr] md:items-center md:px-6"
                >
                  <div className="flex items-center gap-3">
                    <Avatar initials={request.initials} size="sm" />
                    <span className="text-sm font-semibold">
                      {request.employee}
                    </span>
                  </div>

                  <MobileTableCell label="Company">
                    {request.company}
                  </MobileTableCell>
                  <MobileTableCell label="Role">{request.role}</MobileTableCell>
                  <MobileTableCell label="Date">{request.date}</MobileTableCell>

                  <div className="flex items-center justify-between md:block">
                    <span className="text-xs text-slate-500 md:hidden">
                      Status
                    </span>
                    <Badge tone={statusTones[request.status]}>
                      {request.status}
                    </Badge>
                  </div>
                  <div className="md:col-span-5" role="img" aria-label={`Referral timeline: ${request.status}`}>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                      {["Requested", "Reviewed", request.status === "Declined" ? "Declined" : "Approved"].map((stage, index) => {
                        const complete = request.status === "Pending" ? index === 0 : true;
                        return <div key={stage} className="flex min-w-0 flex-1 items-center gap-2"><span className={`size-2 shrink-0 rounded-full transition-transform ${complete ? request.status === "Declined" && index === 2 ? "bg-rose-500" : "bg-emerald-500" : "bg-slate-200"}`} /> <span className={complete ? "text-slate-700" : "text-slate-400"}>{stage}</span>{index < 2 ? <span className={`h-px flex-1 ${complete ? "bg-emerald-200" : "bg-slate-200"}`} /> : null}</div>;
                      })}
                    </div>
                  </div>
                </div>
              ))}
              {referralRequests.length === 0 ? <EmptyState className="m-5 md:m-6" icon={Activity} title="Send your first referral request" description="The workflow starts with a Trust Card, continues with employee discovery, and tracks pending, accepted, or declined decisions here." action={!isPrimaryWorkflowAction(workflow.findEmployeesAction.href) ? <PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton> : undefined} /> : null}
            </div>
          </Card>
        </section>

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

function MobileTableCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between md:block">
      <span className="text-xs text-slate-500 md:hidden">{label}</span>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}
