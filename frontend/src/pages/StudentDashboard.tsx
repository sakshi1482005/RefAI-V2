import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useToast } from "../components/feedback/ToastProvider";
import {
  Activity,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  FileSearch,
  FileText,
  GitBranch,
  GraduationCap,
  LockKeyhole,
  Menu,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AnimatedNumber, Avatar, Badge, Card, EmptyState, IconButton, Logo, PrimaryButton, ProgressBar, ScoreExplanation, SecondaryButton, SectionHeading, Skeleton } from "../components/dashboard/primitives";
import { cn as classNames } from "../lib/utils";
import { useAnalysisSession } from "../hooks/useAnalysisSession";
import StudentNavigation from "../components/dashboard/StudentNavigation";
import { buildResumeInsights, buildScoreReasons } from "../lib/aiInsights";
import { hasReachedDemoStage, useDemoMode } from "../context/DemoModeContext";
import DemoModeBanner from "../components/dashboard/DemoModeBanner";
import { DEMO_ATS_SCORE, demoEmployee, demoReferral, demoReferralRequestNote } from "../lib/demoData";
import NetworkStatusBanner from "../components/feedback/NetworkStatusBanner";
import { useSectionReveal } from "../hooks/useSectionReveal";
import ProfileMenu from "../components/dashboard/ProfileMenu";
import AITransparencyPanel from "../components/dashboard/AITransparencyPanel";
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
type Priority = "High" | "Medium" | "Low";

interface Metric {
  label: string;
  value: string;
  description: string;
  score: number;
  icon: LucideIcon;
}

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

const ScoreRing = memo(function ScoreRing({
  score,
  size = 176,
  strokeWidth = 12,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score ?? 0;
  const offset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={score === null ? "Score not available" : `${score} out of 100`}
    >
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-black"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight">{score === null ? "—" : <AnimatedNumber value={score} />}</span>
        <span className="mt-1 text-sm font-medium text-slate-500">out of 100</span>
      </div>
    </div>
  );
})

const priorityTones: Record<Priority, BadgeTone> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

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
  const gapGroups = demoAnalysisReady ? [
    { title: "System design", subtitle: "Explain scale and trade-offs", icon: GitBranch, iconClass: "bg-amber-50 text-amber-700", items: ["Document API scaling choices", "Add caching and reliability decisions"] },
    { title: "Cloud delivery", subtitle: "Show production ownership", icon: Rocket, iconClass: "bg-blue-50 text-blue-700", items: ["Deploy one FastAPI service", "Add monitoring evidence"] },
  ] : [];
  const learningPlan = demoAnalysisReady ? [
    { week: "Week 1", focus: "System design evidence", duration: "4 hours", tasks: [{ title: "Write a design brief for the FastAPI project", hours: "2h", priority: "High" as Priority }, { title: "Add scale and reliability trade-offs", hours: "2h", priority: "Medium" as Priority }] },
    { week: "Week 2", focus: "Cloud delivery proof", duration: "3 hours", tasks: [{ title: "Deploy and monitor one API", hours: "3h", priority: "High" as Priority }] },
  ] : [];
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
  const resumeHealth = demoAnalysisReady ? [{ label: "ATS Score", score: DEMO_ATS_SCORE, icon: FileSearch }, { label: "Evidence strength", score: 82, icon: ShieldCheck }] : [];
  const readinessScore = analysisSession.trustCard?.trustScore ?? null;
  const analysisMetrics: Metric[] = useMemo(() => analysisSession.matchScore
    ? [
        { label: "Resume Match", value: `${analysisSession.matchScore.overall}%`, description: "Average of role fit and proof", score: analysisSession.matchScore.overall, icon: Target },
        { label: "Role Fit", value: `${analysisSession.matchScore.roleFit}%`, description: "Job terms found in the resume", score: analysisSession.matchScore.roleFit, icon: CheckCircle2 },
        { label: "Proof", value: `${analysisSession.matchScore.proof}%`, description: "Matched requirements supported repeatedly", score: analysisSession.matchScore.proof, icon: FileSearch },
        { label: "Gaps", value: `${analysisSession.matchScore.gaps}%`, description: "Job terms not covered by the resume", score: analysisSession.matchScore.gaps, icon: Zap },
      ]
    : [], [analysisSession.matchScore]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [referralRequestNote, setReferralRequestNote] = useState(() => isDemoMode ? demoReferralRequestNote : "");
  const [referralCelebration, setReferralCelebration] = useState(false);
  const [showReferralSuccess, setShowReferralSuccess] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
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
  const profileCompletionItems = useMemo(() => [
    Boolean(profile?.fullName),
    Boolean(profile?.headline),
    Boolean(profile?.college && profile?.degree),
    Boolean(profile?.branch && profile?.graduationYear),
    Boolean(profile?.skills.length),
    Boolean(profile?.bio),
    Boolean(profile?.preferredRole),
    Boolean(profile?.linkedinUrl || profile?.githubUrl || profile?.portfolioUrl),
    Boolean(analysisSession.upload),
    Boolean(analysisSession.matchScore),
  ], [analysisSession.matchScore, analysisSession.upload, profile]);
  const profileCompletion = Math.round((profileCompletionItems.filter(Boolean).length / profileCompletionItems.length) * 100);
  const profileDetailsCompletion = Math.round((profileCompletionItems.slice(0, 8).filter(Boolean).length / 8) * 100);
  const profileDetailsComplete = profileDetailsCompletion === 100;
  const analysisInsights = useMemo(() => analysisSession.matchScore ? buildResumeInsights(analysisSession.matchScore, analysisSession.role) : null, [analysisSession.matchScore, analysisSession.role]);
  const scoreReasons = useMemo(() => analysisSession.matchScore ? buildScoreReasons(analysisSession.matchScore, isDemoMode) : [], [analysisSession.matchScore, isDemoMode]);
  const suggestedImprovements = analysisInsights?.improvements ?? [];
  const upcomingActions = useMemo(() => {
    const actions: Array<{ title: string; description: string; href: string }> = [];
    if (!profileDetailsComplete) actions.push({ title: "Complete your profile", description: `${100 - profileDetailsCompletion}% remains before your personal and professional details are complete.`, href: "/settings#profile" });
    if (!workflow.hasResume) actions.push({ title: workflow.uploadAction.label, description: "A resume is required before RefAI can calculate role fit.", href: workflow.uploadAction.href });
    if (workflow.hasResume && !workflow.hasAnalysis) actions.push({ title: workflow.analysisAction.label, description: "Compare the uploaded resume with a target job description.", href: workflow.analysisAction.href });
    if (workflow.hasAnalysis && !workflow.hasTrustCard) actions.push({ title: workflow.trustCardAction.label, description: "Turn the completed match analysis into referral evidence.", href: workflow.trustCardAction.href });
    if (workflow.hasTrustCard) actions.push({ title: workflow.actionPlanAction.label, description: "Review improvements before continuing to employee matching.", href: workflow.actionPlanAction.href });
    return actions.slice(0, 3);
  }, [profileDetailsComplete, profileDetailsCompletion, workflow]);
  const primaryNextAction = workflow.primaryAction;

  const filteredEmployees = useMemo(() => employees.filter((employee) =>
    `${employee.name} ${employee.company} ${employee.designation}`
      .toLowerCase()
      .includes(employeeQuery.toLowerCase()),
  ), [employeeQuery, employees]);

  const toggleTask = (task: string) => {
    setCompletedTasks((current) =>
      current.includes(task)
        ? current.filter((item) => item !== task)
        : [...current, task],
    );
  };

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
            <IconButton label="Notifications" onClick={() => scrollToSection("referral-requests")}>
              <Bell className="size-[18px]" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
            </IconButton>
            <IconButton label="Settings" onClick={() => navigate("/settings")}>
              <Settings className="size-[18px]" />
            </IconButton>

            <div className="mx-3 h-7 w-px bg-slate-200" />

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
              <div className="flex">
                <IconButton label="Notifications" onClick={() => { setMobileMenuOpen(false); scrollToSection("referral-requests"); }}>
                  <Bell className="size-4" />
                </IconButton>
                <IconButton label="Settings" onClick={() => navigate("/settings")}>
                  <Settings className="size-4" />
                </IconButton>
              </div>
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

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resume completion</p><h3 id="dashboard-overview-title" className="mt-2 text-xl font-semibold">Profile readiness</h3></div>
                <span className="text-2xl font-semibold tracking-tight">{profileLoading ? "—" : `${profileCompletion}%`}</span>
              </div>
              {profileLoading ? <Skeleton className="mt-6 h-2.5 w-full" /> : <div className="mt-6"><ProgressBar value={profileCompletion} /></div>}
              <p className="mt-4 text-sm leading-6 text-slate-600">Completion reflects your Supabase profile, resume upload, and latest match analysis.</p>
              <SecondaryButton className="mt-5 w-full" onClick={() => navigate("/settings#profile")}>Review profile<ArrowRight className="ml-2 size-4" /></SecondaryButton>
            </Card>

            <Card className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recently analyzed resumes</p><h3 className="mt-2 text-xl font-semibold">Latest analysis</h3></div><FileText className="size-5 text-slate-400" /></div>
              {analysisSession.upload && analysisSession.matchScore ? <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{analysisSession.upload.fileName}</p><p className="mt-1 text-xs text-slate-500">{analysisSession.role || "Target role not saved"}</p></div><Badge tone="success">{analysisSession.matchScore.overall}% match</Badge></div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{analysisSession.analyzedAt ? new Date(analysisSession.analyzedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Current session"}</span><button type="button" onClick={() => navigate("/dashboard/resume-analysis")} className="cursor-pointer font-semibold text-slate-900 hover:underline">View analysis</button></div>
              </div> : <EmptyState className="mt-6" icon={FileSearch} title="No analyzed resumes yet" description="Upload a PDF resume, add a target job description, and RefAI will calculate role fit, proof strength, and skill gaps." action={<PrimaryButton onClick={() => navigate("/dashboard/resume")}>Open Resume Workspace</PrimaryButton>} />}
            </Card>

            <Card className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest Trust Card</p><h3 className="mt-2 text-xl font-semibold">Referral evidence</h3></div><ShieldCheck className="size-5 text-slate-400" /></div>
              {analysisSession.trustCard ? <div className="mt-6">
                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-4 text-white"><div><p className="text-xs text-slate-300">{analysisSession.trustCard.role}</p><p className="mt-1 text-sm font-semibold">{analysisSession.trustCard.candidateName}</p></div><div className="text-right"><span className="text-3xl font-semibold">{analysisSession.trustCard.trustScore}</span><p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Trust Score</p></div></div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{analysisSession.trustCard.aiSummary}</p>
                <SecondaryButton className="mt-5 w-full" onClick={() => navigate("/dashboard/trust-card")}>Open Trust Card<ArrowRight className="ml-2 size-4" /></SecondaryButton>
              </div> : <EmptyState className="mt-6" icon={ShieldCheck} title="Build your first Trust Card" description="A Trust Card turns resume evidence and job-match scores into a concise summary employees can review before referring you." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</PrimaryButton><SecondaryButton onClick={() => navigate("/dashboard/trust-card")}>Learn about Trust Cards</SecondaryButton></div>} />}
            </Card>

            <Card className="p-6 sm:p-7 xl:col-span-2">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI recommendations</p><h3 className="mt-2 text-xl font-semibold">Suggested improvements</h3></div><Sparkles className="size-5 text-slate-400" /></div>
              {suggestedImprovements.length > 0 ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{suggestedImprovements.map((suggestion, index) => <div key={suggestion.title} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold">{index + 1}</div><div><p className="text-sm font-semibold">{suggestion.title}</p><p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Why this recommendation?</p><p className="mt-1 text-sm leading-6 text-slate-500">{suggestion.description}</p></div></div></div>)}</div> : <EmptyState className="mt-6" icon={Sparkles} title="Unlock AI recommendations" description="Analyze a resume against a target role to receive evidence-based suggestions for role fit, proof, and skill gaps." action={<PrimaryButton onClick={() => navigate(workflow.analysisAction.href)}>{workflow.analysisAction.label}</PrimaryButton>} />}
            </Card>

            <Card className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upcoming actions</p><h3 className="mt-2 text-xl font-semibold">Next best steps</h3></div><Clock3 className="size-5 text-slate-400" /></div>
              <div className="mt-5 space-y-3">{upcomingActions.map((action) => <button key={action.title} type="button" onClick={() => navigate(action.href)} className="group flex w-full cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{action.title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{action.description}</span></span><ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" /></button>)}</div>
            </Card>

            <Card className="p-6 sm:p-7 xl:col-span-3">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent referral activity</p><h3 className="mt-2 text-xl font-semibold">Requests and decisions</h3></div><Activity className="size-5 text-slate-400" /></div>
              {referralRequests.length > 0 ? <div className="mt-6 grid gap-3 md:grid-cols-3">{referralRequests.slice(0, 3).map((request) => <div key={`${request.employee}-${request.date}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{request.employee}</p><Badge tone={statusTones[request.status]}>{request.status}</Badge></div><p className="mt-2 text-sm text-slate-500">{request.company} · {request.role}</p><p className="mt-3 text-xs text-slate-400">{request.date}</p></div>)}</div> : <EmptyState className="mt-6" icon={Activity} title="Start your referral workflow" description="Create a Trust Card, find a relevant employee, send a personalized request, and track the employee’s decision here." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton><SecondaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</SecondaryButton></div>} />}
            </Card>
          </div>
        </section>

        {/* Referral readiness */}
        <section>
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
              <div className="flex items-center justify-center border-b border-slate-200 bg-slate-50/70 p-8 sm:p-12 lg:border-b-0 lg:border-r">
                <div className="text-center">
                  <p className="mb-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Overall Match Score
                  </p>
                  <ScoreRing score={readinessScore} />
                  <Badge tone={readinessScore === null ? "neutral" : "success"} className="mt-6 px-3">
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                    {readinessScore === null ? "Score unavailable" : "Analysis available"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                <div className="flex size-11 items-center justify-center rounded-xl bg-black text-white">
                  <Sparkles className="size-5" />
                </div>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  AI Readiness Summary
                </p>

                <h2 className="mt-3 max-w-2xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {analysisSession.trustCard?.referralReadiness || "Generate a Trust Card to calculate readiness"}
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  {analysisSession.trustCard ? `Your backend-calculated Trust Score is ${analysisSession.trustCard.trustScore}. This readiness result is separate from the ${analysisSession.trustCard.overallMatch}% Overall Match and ${analysisSession.trustCard.confidence}% analysis confidence.` : "Complete resume analysis, then generate a Trust Card to receive a backend-calculated Trust Score and readiness result."}
                </p>

                {scoreReasons.length > 0 ? <ScoreExplanation className="mt-7" title="Why this match score?" points={scoreReasons} /> : null}

                <div className="mt-7 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-950">
                      {analysisSession.trustCard?.referralReadiness || 'Readiness calculation pending'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      {analysisSession.trustCard ? 'Thresholds: Ready at 75+, Improve before requesting at 55–74, and Not ready yet below 55.' : 'Generate the Trust Card after analysis to calculate readiness.'}
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
                  {[
                    { label: "Resume processed", available: Boolean(analysisSession.upload) },
                    { label: "Job description provided", available: Boolean(analysisSession.jobDescription) },
                    { label: "Match analyzed", available: Boolean(analysisSession.matchScore) },
                  ].map((item) => (
                    <Badge key={item.label} tone={item.available ? "success" : "neutral"}>
                      {item.available ? <Check className="mr-1.5 size-3" /> : null}
                      {item.label}: {item.available ? "Yes" : "No"}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Resume status — upload and analysis live in the single Resume workspace. */}
        <section id="resume-analyzer" className="scroll-mt-24">
          <SectionHeading
            eyebrow="Resume Status"
            title="One resume workflow, one clear next step"
            description="Upload the PDF, add the target role, and run analysis in the Resume workspace. This dashboard only summarizes the latest result."
          />
          <Card className="p-6 sm:p-8">
            {analysisMetrics.length > 0 ? <>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="text-xl font-semibold">Latest analysis</h3><p className="mt-1.5 text-sm text-slate-500">{analysisSession.upload?.fileName} · {analysisSession.role}</p></div><PrimaryButton onClick={() => navigate('/dashboard/resume-analysis')}>Review Analysis<ArrowRight className="ml-2 size-4" /></PrimaryButton></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{analysisMetrics.map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl border border-slate-200 p-5"><div className="flex items-start justify-between"><div className="flex size-9 items-center justify-center rounded-lg bg-slate-100"><Icon className="size-4" /></div><span className="text-2xl font-semibold">{metric.value}</span></div><p className="mt-5 text-sm font-semibold">{metric.label}</p><p className="mt-1 text-xs text-slate-500">{metric.description}</p><div className="mt-4"><ProgressBar value={metric.score} /></div></div> })}</div>
            </> : <EmptyState icon={FileText} title="No resume analysis yet" description="Open the Resume workspace to select one PDF, add the target role and job description, and run the complete analysis." action={<PrimaryButton onClick={() => navigate('/dashboard/resume')}>Open Resume Workspace<ArrowRight className="ml-2 size-4" /></PrimaryButton>} />}
          </Card>
        </section>

        {/* AI gap analysis */}
        <section id="ai-recommendations" className="scroll-mt-24">
          <SectionHeading
            eyebrow="AI Gap Analysis"
            title="See what is limiting your match"
            description="Review the missing skills or proof behind the score, then move the highest-impact gaps into your learning plan."
          />

          <AITransparencyPanel session={analysisSession} isDemoMode={isDemoMode} className="mb-6" />

          <Card className="p-6 sm:p-8">
            <div className="grid gap-5 lg:grid-cols-3">
              {gapGroups.map((group) => {
                const Icon = group.icon;

                return (
                  <div
                    key={group.title}
                    className="rounded-xl border border-slate-200 p-5 sm:p-6"
                  >
                    <div
                      className={classNames(
                        "flex size-10 items-center justify-center rounded-xl",
                        group.iconClass,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>

                    <h3 className="mt-5 text-lg font-semibold">{group.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {group.subtitle}
                    </p>

                    <ul className="mt-6 space-y-4">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <Check className="size-3" />
                          </div>
                          <span className="text-sm leading-5 text-slate-700">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {gapGroups.length === 0 ? <EmptyState className="lg:col-span-3" icon={Target} title="Discover your highest-impact gaps" description="Run a role analysis to identify missing evidence. Structured gap recommendations will appear when the analysis API provides them." action={<PrimaryButton onClick={() => navigate(workflow.analysisAction.href)}>{workflow.analysisAction.label}</PrimaryButton>} /> : null}
            </div>

            <div className="mt-5 rounded-xl bg-slate-950 p-6 text-white">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      Recommendation
                    </p>
                    <div className="mt-3 max-w-3xl space-y-3 text-sm leading-6 text-slate-300">
                      <p><span className="font-semibold text-white">Why?</span> {analysisInsights?.weakness.description || "Run a resume analysis to identify which score is limiting readiness and why."}</p>
                      <p><span className="font-semibold text-white">What evidence?</span> {analysisSession.matchScore ? `The match API returned ${analysisSession.matchScore.roleFit}% Role Fit, ${analysisSession.matchScore.proof}% repeated Proof, and ${analysisSession.matchScore.gaps}% unmatched terminology.` : "No match evidence has been returned."}</p>
                      <p><span className="font-semibold text-white">What can improve?</span> {suggestedImprovements[0]?.title || "Complete an analysis to receive an evidence-based improvement."}</p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => navigate(workflow.actionPlanAction.href)} className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10">{workflow.actionPlanAction.label}</button><button type="button" onClick={() => navigate(workflow.findEmployeesAction.href)} className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-slate-200">{workflow.findEmployeesAction.label}<ArrowRight className="ml-2 size-4" /></button></div>
              </div>
            </div>
          </Card>
        </section>

        {/* Learning plan */}
        <section id="learning-plan" className="scroll-mt-24">
          <SectionHeading
            eyebrow="2-Week Learning Plan"
            title="Turn resume gaps into a two-week plan"
            description="Complete the highest-impact tasks first, then update your resume evidence and regenerate the analysis."
            action={
              <Badge>
                <Clock3 className="mr-1.5 size-3.5" />
                Plan unavailable
              </Badge>
            }
          />

          <div className="grid gap-6 lg:grid-cols-2">
            {learningPlan.map((week) => (
              <Card key={week.week} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge tone="dark">{week.week}</Badge>
                    <h3 className="mt-3 text-xl font-semibold">{week.focus}</h3>
                  </div>
                  <span className="text-sm font-medium text-slate-500">
                    {week.duration}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {week.tasks.map((task) => {
                    const completed = completedTasks.includes(task.title);

                    return (
                      <label
                        key={task.title}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4"
                      >
                        <input
                          type="checkbox"
                          checked={completed}
                          onChange={() => toggleTask(task.title)}
                          className="size-4 rounded border-slate-400 accent-black"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className={classNames(
                              "text-sm font-semibold",
                              completed
                                ? "text-slate-400 line-through"
                                : "text-slate-900",
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                            <Clock3 className="size-3" />
                            {task.hours}
                          </p>
                        </div>

                        <Badge tone={priorityTones[task.priority]}>
                          {task.priority}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </Card>
            ))}
            {learningPlan.length === 0 ? <EmptyState className="lg:col-span-2" icon={GraduationCap} title="Create your AI learning plan" description="RefAI uses resume gaps and target-role evidence to prioritize skills, practical tasks, and a focused two-week improvement path." action={<PrimaryButton onClick={() => navigate(workflow.evidenceAction.href)}>{workflow.evidenceAction.label}</PrimaryButton>} /> : null}
          </div>
        </section>

        {/* Candidate Trust Card */}
        <section>
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
              {!analysisSession.trustCard ? <EmptyState className="mt-7" icon={ShieldCheck} title="Generate your Trust Card" description="Complete a resume analysis to turn match scores and supporting evidence into an employee-ready referral summary." action={<PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</PrimaryButton>} /> : null}

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

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <PrimaryButton onClick={() => navigate(workflow.trustCardAction.href)}>
                  {workflow.trustCardAction.label}
                  <ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
                <SecondaryButton onClick={() => navigate(workflow.evidenceAction.href)}>
                  <GitBranch className="mr-2 size-4" />
                  {workflow.evidenceAction.label}
                </SecondaryButton>
              </div>
            </div>
          </div>
        </section>

        {/* Employee discovery */}
        <section id="find-referrers" className="scroll-mt-24">
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

          {filteredEmployees.length === 0 && <EmptyState className="mt-4" icon={Users} title={employees.length === 0 ? "Prepare for employee discovery" : "No employees match your search"} description={employees.length === 0 ? "Build a Trust Card while the employee-directory integration is being connected." : "Adjust the name, company, or role, or clear the current search."} action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton>{employeeQuery ? <SecondaryButton onClick={() => setEmployeeQuery("")}>Clear Search</SecondaryButton> : <SecondaryButton onClick={() => navigate('/dashboard#referral-requests')}>Referral Requests</SecondaryButton>}</div>} />}
        </section>

        {/* Referral gate and message generator */}
        <section id="referral-message" className="grid scroll-mt-24 gap-6 xl:grid-cols-[0.75fr_1.25fr]">
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
        </section>

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
              {referralRequests.length === 0 ? <EmptyState className="m-5 md:m-6" icon={Activity} title="Send your first referral request" description="The workflow starts with a Trust Card, continues with employee discovery, and tracks pending, accepted, or declined decisions here." action={<div className="flex flex-wrap justify-center gap-2"><PrimaryButton onClick={() => navigate(workflow.findEmployeesAction.href)}>{workflow.findEmployeesAction.label}</PrimaryButton><SecondaryButton onClick={() => navigate(workflow.trustCardAction.href)}>{workflow.trustCardAction.label}</SecondaryButton></div>} /> : null}
            </div>
          </Card>
        </section>

        {/* Resume health */}
        <section>
          <SectionHeading
            eyebrow="Resume Health"
            title="Check resume clarity and evidence quality"
            description="Use these checks to identify formatting or proof issues, then update the resume before your next analysis."
            action={
              <PrimaryButton onClick={() => navigate(workflow.optimizeResumeAction.href)}>
                <WandSparkles className="mr-2 size-4" />
                {workflow.optimizeResumeAction.label}
              </PrimaryButton>
            }
          />

          <Card className="p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
              <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-7 text-center">
                <ScoreRing score={null} size={148} strokeWidth={10} />
                <h3 className="mt-5 text-lg font-semibold">
                  Overall Resume Health
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  No resume-health API is currently available.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {resumeHealth.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                            <Icon className="size-4" />
                          </div>
                          <span className="text-sm font-semibold">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold">
                          {item.score}%
                        </span>
                      </div>
                      <div className="mt-4">
                        <ProgressBar value={item.score} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        <span className="font-semibold text-slate-700">Why?</span>{" "}
                        {item.label === "ATS Score" ? "Ananya’s demo resume uses clear headings, readable text, and Atlassian role terminology without graphics-heavy formatting." : "Ananya’s demo includes quantified React delivery, FastAPI ownership, SQL outcomes, and collaboration evidence."}
                      </p>
                    </div>
                  );
                })}
                {resumeHealth.length === 0 ? <EmptyState className="sm:col-span-2" icon={FileSearch} title="Check your resume health" description="Upload your latest PDF and run an analysis to prepare ATS, evidence, and role-alignment insights when resume-health metrics become available." action={<PrimaryButton onClick={() => navigate(workflow.optimizeResumeAction.href)}>{workflow.optimizeResumeAction.label}</PrimaryButton>} /> : null}
              </div>
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
