import { useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  Copy,
  FileCheck2,
  FileSearch,
  FileText,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquareText,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  User,
  UserCheck,
  Users,
  WandSparkles,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

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

type Status = "Pending" | "Accepted" | "Declined";
type Priority = "High" | "Medium" | "Low";

interface Metric {
  label: string;
  value: string;
  description: string;
  score: number;
  icon: LucideIcon;
}

interface LearningTask {
  title: string;
  hours: string;
  priority: Priority;
}

interface Employee {
  name: string;
  initials: string;
  company: string;
  designation: string;
  avatarClass: string;
}

interface ReferralRequest {
  employee: string;
  initials: string;
  company: string;
  role: string;
  date: string;
  status: Status;
}

// -----------------------------------------------------------------------------
// Local UI primitives
// -----------------------------------------------------------------------------

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<BadgeTone, string> = {
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    dark: "border-black bg-black text-white",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={classNames(
        "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({
  value,
  tone = "dark",
}: {
  value: number;
  tone?: "dark" | "success";
}) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div
        className={classNames(
          "h-full rounded-full transition-all duration-700",
          tone === "success" ? "bg-emerald-600" : "bg-black",
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Avatar({
  initials,
  className,
  size = "md",
}: {
  initials: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-9 text-xs",
    md: "size-12 text-sm",
    lg: "size-20 text-xl",
  };

  return (
    <div
      className={classNames(
        "flex shrink-0 items-center justify-center rounded-full border border-slate-200 font-semibold",
        sizes[size],
        className ?? "bg-slate-100 text-slate-700",
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function PrimaryButton({
  children,
  className,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  className,
  onClick,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-black"
    >
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function ScoreRing({
  score,
  size = 176,
  strokeWidth = 12,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${score} out of 100`}
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
        <span className="text-4xl font-semibold tracking-tight">{score}</span>
        <span className="mt-1 text-sm font-medium text-slate-500">out of 100</span>
      </div>
    </div>
  );
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={classNames(
          "flex size-9 items-center justify-center rounded-xl",
          inverse ? "bg-white text-black" : "bg-black text-white",
        )}
      >
        <ShieldCheck className="size-5" />
      </div>
      <span
        className={classNames(
          "text-xl font-bold tracking-tight",
          inverse ? "text-white" : "text-slate-950",
        )}
      >
        RefAI
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Mock data
// -----------------------------------------------------------------------------

const readinessScore = 82;
const matchingSkills = [
  "React",
  "TypeScript",
  "Node.js",
  "PostgreSQL",
  "REST APIs",
  "Git",
];
const missingSkills = ["Docker", "AWS", "System Design"];

const analysisMetrics: Metric[] = [
  {
    label: "Resume Match",
    value: "82%",
    description: "Strong role alignment",
    score: 82,
    icon: Target,
  },
  {
    label: "Matching Skills",
    value: "6",
    description: "Core skills verified",
    score: 86,
    icon: CheckCircle2,
  },
  {
    label: "Missing Skills",
    value: "3",
    description: "High-impact gaps",
    score: 64,
    icon: FileSearch,
  },
  {
    label: "Skill Overlap",
    value: "78%",
    description: "Across required skills",
    score: 78,
    icon: Zap,
  },
  {
    label: "Project Relevance",
    value: "88%",
    description: "Excellent evidence",
    score: 88,
    icon: Code2,
  },
  {
    label: "Recency Score",
    value: "91%",
    description: "Skills used recently",
    score: 91,
    icon: Activity,
  },
];

const gapGroups = [
  {
    title: "Strengths",
    subtitle: "Evidence that builds trust",
    icon: CheckCircle2,
    iconClass: "bg-emerald-50 text-emerald-700",
    items: [
      "Strong React and TypeScript knowledge",
      "Relevant full-stack project portfolio",
      "Clear ownership across recent projects",
      "Consistent GitHub contribution history",
    ],
  },
  {
    title: "Weaknesses",
    subtitle: "Gaps reducing your score",
    icon: FileSearch,
    iconClass: "bg-rose-50 text-rose-700",
    items: [
      "Docker is absent from demonstrated experience",
      "Limited evidence of system design knowledge",
      "Project outcomes need stronger metrics",
    ],
  },
  {
    title: "Recommendations",
    subtitle: "Highest-impact improvements",
    icon: Rocket,
    iconClass: "bg-amber-50 text-amber-700",
    items: [
      "Containerize one full-stack project",
      "Add deployment experience with AWS",
      "Include measurable project outcomes",
    ],
  },
];

const learningPlan: Array<{
  week: string;
  focus: string;
  duration: string;
  tasks: LearningTask[];
}> = [
    {
      week: "Week 1",
      focus: "Close infrastructure gaps",
      duration: "11 hrs",
      tasks: [
        { title: "Docker fundamentals", hours: "4 hrs", priority: "High" },
        { title: "AWS cloud basics", hours: "5 hrs", priority: "High" },
        { title: "Resume impact improvements", hours: "2 hrs", priority: "Medium" },
      ],
    },
    {
      week: "Week 2",
      focus: "Strengthen interview evidence",
      duration: "10 hrs",
      tasks: [
        { title: "System design foundations", hours: "6 hrs", priority: "High" },
        { title: "Backend mock interview", hours: "2 hrs", priority: "Medium" },
        { title: "GitHub profile improvements", hours: "2 hrs", priority: "Low" },
      ],
    },
  ];

const employees: Employee[] = [
  {
    name: "Aarav Mehta",
    initials: "AM",
    company: "Google",
    designation: "Software Engineer II",
    avatarClass: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Naina Kapoor",
    initials: "NK",
    company: "Microsoft",
    designation: "Senior Software Engineer",
    avatarClass: "bg-blue-100 text-blue-700",
  },
  {
    name: "Rohan Malhotra",
    initials: "RM",
    company: "Amazon",
    designation: "Software Development Engineer",
    avatarClass: "bg-amber-100 text-amber-700",
  },
  {
    name: "Ishita Rao",
    initials: "IR",
    company: "Adobe",
    designation: "Computer Scientist",
    avatarClass: "bg-rose-100 text-rose-700",
  },
  {
    name: "Kabir Shah",
    initials: "KS",
    company: "Flipkart",
    designation: "Backend Engineer",
    avatarClass: "bg-violet-100 text-violet-700",
  },
  {
    name: "Meera Iyer",
    initials: "MI",
    company: "NVIDIA",
    designation: "Systems Software Engineer",
    avatarClass: "bg-lime-100 text-lime-700",
  },
];

const referralRequests: ReferralRequest[] = [
  {
    employee: "Naina Kapoor",
    initials: "NK",
    company: "Microsoft",
    role: "Software Engineer",
    date: "12 Jul 2026",
    status: "Accepted",
  },
  {
    employee: "Aarav Mehta",
    initials: "AM",
    company: "Google",
    role: "Backend Developer",
    date: "10 Jul 2026",
    status: "Pending",
  },
  {
    employee: "Ishita Rao",
    initials: "IR",
    company: "Adobe",
    role: "Product Engineer",
    date: "04 Jul 2026",
    status: "Declined",
  },
];

const resumeHealth = [
  { label: "ATS Compatibility", score: 92, icon: FileCheck2 },
  { label: "Projects", score: 86, icon: Code2 },
  { label: "Achievements", score: 72, icon: Award },
  { label: "Keywords", score: 81, icon: Search },
  { label: "Formatting", score: 95, icon: FileText },
];

const quickActions = [
  {
    label: "Upload Resume",
    description: "Replace your current resume",
    icon: Upload,
  },
  {
    label: "Generate Trust Card",
    description: "Create an employee-ready preview",
    icon: ShieldCheck,
  },
  {
    label: "Find Employees",
    description: "Discover verified referrers",
    icon: Users,
  },
  {
    label: "Track Requests",
    description: "Monitor referral progress",
    icon: Activity,
  },
  {
    label: "Edit Profile",
    description: "Update education and preferences",
    icon: User,
  },
  {
    label: "View Analytics",
    description: "Review your readiness trends",
    icon: LineChart,
  },
];

const upcomingFeatures = [
  { title: "Network-Ranked Referrals", icon: Users },
  { title: "LinkedIn Connection Ranking", icon: TrendingUp },
  { title: "AI Interview Prep", icon: MessageSquareText },
  { title: "Referral Heatmap", icon: Activity },
  { title: "Career Roadmap", icon: MapPin },
];

const referralMessage =
  "Hi Aarav, I’m Sakshi, a final-year CSE student at VIT. I’m applying for the Backend Developer role at Google, and my experience with Node.js, PostgreSQL, and scalable REST APIs aligns closely with the role. RefAI evaluated my profile at an 82% match and generated a Candidate Trust Card with supporting project evidence. If you feel my profile is a good fit, I’d be grateful if you considered referring me. Thank you for your time!";

const priorityTones: Record<Priority, BadgeTone> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

const statusTones: Record<Status, BadgeTone> = {
  Accepted: "success",
  Pending: "warning",
  Declined: "danger",
};

// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------

export default function StudentDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fileName, setFileName] = useState("Sakshi_Backend_Resume.pdf");
  const [isDragging, setIsDragging] = useState(false);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([
    "Resume impact improvements",
  ]);

  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.company} ${employee.designation}`
      .toLowerCase()
      .includes(employeeQuery.toLowerCase()),
  );

  const toggleTask = (task: string) => {
    setCompletedTasks((current) =>
      current.includes(task)
        ? current.filter((item) => item !== task)
        : [...current, task],
    );
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(referralMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const regenerateMessage = () => {
    setRegenerating(true);
    window.setTimeout(() => setRegenerating(false), 900);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-slate-950">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Logo />

            <nav className="hidden md:block">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-3 text-sm font-semibold"
              >
                <LayoutDashboard className="mr-2 size-4" />
                Dashboard
              </button>
            </nav>
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <IconButton label="Notifications">
              <Bell className="size-[18px]" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
            </IconButton>
            <IconButton label="Settings">
              <Settings className="size-[18px]" />
            </IconButton>

            <div className="mx-3 h-7 w-px bg-slate-200" />

            <div className="flex items-center gap-3">
              <Avatar
                initials="SG"
                size="sm"
                className="border-black bg-black text-white"
              />
              <div className="hidden lg:block">
                <p className="text-sm font-semibold">Sakshi Gupta</p>
                <p className="text-xs text-slate-500">Student</p>
              </div>
            </div>
          </div>

          <div className="sm:hidden">
            <IconButton
              label="Toggle navigation"
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </IconButton>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-4 sm:hidden">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <Avatar
                  initials="SG"
                  size="sm"
                  className="border-black bg-black text-white"
                />
                <div>
                  <p className="text-sm font-semibold">Sakshi Gupta</p>
                  <p className="text-xs text-slate-500">Student account</p>
                </div>
              </div>
              <div className="flex">
                <IconButton label="Notifications">
                  <Bell className="size-4" />
                </IconButton>
                <IconButton label="Settings">
                  <Settings className="size-4" />
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1440px] space-y-16 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Welcome hero */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-h-[290px] lg:grid-cols-[1.4fr_0.6fr]">
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <Badge className="mb-5">
                <Sparkles className="mr-1.5 size-3.5 text-slate-900" />
                AI-powered referral readiness
              </Badge>

              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                Welcome back, Sakshi <span aria-hidden="true">👋</span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Let&apos;s see how ready you are for your dream role.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryButton>
                  <Upload className="mr-2 size-4" />
                  Upload Resume
                </PrimaryButton>
                <SecondaryButton>
                  <WandSparkles className="mr-2 size-4" />
                  Analyze New Job
                </SecondaryButton>
              </div>
            </div>

            <div className="relative hidden items-center justify-center overflow-hidden border-l border-slate-100 bg-slate-50 lg:flex">
              <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]" />

              <div className="relative w-64 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-black text-white">
                    <ShieldCheck className="size-5" />
                  </div>
                  <Badge tone="success">Trust verified</Badge>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="h-2.5 w-3/4 rounded-full bg-slate-900" />
                  <div className="h-2 w-1/2 rounded-full bg-slate-200" />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[82, 88, 91].map((score) => (
                    <div
                      key={score}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-3 text-center"
                    >
                      <p className="text-lg font-semibold">{score}</p>
                      <p className="text-[10px] text-slate-500">Score</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-950 p-3 text-white">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span className="text-xs font-medium">Referral ready</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Referral readiness */}
        <section>
          <Card className="overflow-hidden">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
              <div className="flex items-center justify-center border-b border-slate-200 bg-slate-50/70 p-8 sm:p-12 lg:border-b-0 lg:border-r">
                <div className="text-center">
                  <p className="mb-6 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Referral Readiness Score
                  </p>
                  <ScoreRing score={readinessScore} />
                  <Badge tone="success" className="mt-6 px-3">
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                    Referral Ready
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
                  Your profile gives employees credible reasons to trust your
                  referral request.
                </h2>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Your resume is well aligned with Backend Developer roles.
                  Strengthening Docker and System Design can significantly improve
                  your referral success.
                </p>

                <div className="mt-7 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-950">
                      Eligible to request referrals
                    </p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Your score is above the required threshold of 70.
                    </p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
                  {["Resume verified", "JD analyzed", "Evidence mapped"].map(
                    (item) => (
                      <Badge key={item}>
                        <Check className="mr-1.5 size-3" />
                        {item}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Resume analyzer */}
        <section>
          <SectionHeading
            eyebrow="Resume Analyzer"
            title="Turn your resume into referral evidence"
            description="Compare your experience with a specific role and generate a trustworthy, evidence-backed analysis."
          />

          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="p-6">
              <h3 className="text-xl font-semibold">Analyze your fit</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Upload your latest resume and paste the complete job description.
              </p>

              <div className="mt-6">
                <label className="mb-2.5 block text-sm font-semibold">Resume</label>

                <label
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const file = event.dataTransfer.files[0];
                    if (file) setFileName(file.name);
                  }}
                  className={classNames(
                    "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors",
                    isDragging
                      ? "border-black bg-slate-100"
                      : "border-slate-300 bg-slate-50 hover:border-slate-500",
                  )}
                >
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setFileName(file.name);
                    }}
                  />

                  <div className="flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Upload className="size-5 text-slate-700" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">
                    Drag &amp; drop or click to upload
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500">
                    PDF or DOCX · Maximum 10 MB
                  </p>
                </label>

                <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fileName}</p>
                      <p className="text-xs text-slate-500">
                        Uploaded · Ready to analyze
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                </div>
              </div>

              <div className="mt-6">
                <label
                  htmlFor="job-description"
                  className="mb-2.5 block text-sm font-semibold"
                >
                  Job Description
                </label>
                <textarea
                  id="job-description"
                  defaultValue="We are looking for a Backend Developer with strong experience in Node.js, TypeScript, REST APIs, PostgreSQL, Docker, AWS, and scalable system design. The candidate should have built and deployed production-ready applications."
                  placeholder="Paste Job Description here..."
                  className="min-h-48 w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
                />
                <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500">
                  <span>AI extracts required skills and evidence automatically.</span>
                  <span className="shrink-0">248 words</span>
                </div>
              </div>

              <PrimaryButton className="mt-6 w-full">
                <WandSparkles className="mr-2 size-4" />
                Analyze Resume
              </PrimaryButton>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Analysis Results</h3>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Backend Developer · Google
                  </p>
                </div>
                <Badge className="hidden sm:inline-flex">
                  <Sparkles className="mr-1.5 size-3.5" />
                  AI analyzed
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {analysisMetrics.map((metric) => {
                  const Icon = metric.icon;

                  return (
                    <div
                      key={metric.label}
                      className="rounded-xl border border-slate-200 p-5 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100">
                          <Icon className="size-4" />
                        </div>
                        <span className="text-2xl font-semibold">
                          {metric.value}
                        </span>
                      </div>

                      <p className="mt-5 text-sm font-semibold">{metric.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {metric.description}
                      </p>
                      <div className="mt-4">
                        <ProgressBar value={metric.score} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <div>
                    <p className="text-sm font-semibold">
                      Skill evidence identified
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Based on projects, experience, and keywords.
                    </p>
                  </div>
                  <span className="text-sm font-semibold">6 of 9 skills</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {matchingSkills.map((skill) => (
                    <Badge key={skill} tone="success">
                      <Check className="mr-1 size-3" />
                      {skill}
                    </Badge>
                  ))}
                  {missingSkills.map((skill) => (
                    <Badge key={skill}>
                      <Circle className="mr-1 size-2.5" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* AI gap analysis */}
        <section>
          <SectionHeading
            eyebrow="AI Gap Analysis"
            title="Know exactly what stands between you and the role"
            description="RefAI converts a generic match score into specific evidence, gaps, and next actions."
          />

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
            </div>

            <div className="mt-5 rounded-xl bg-slate-950 p-6 text-white">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-300">
                      AI Recommendation
                    </p>
                    <p className="mt-2 max-w-3xl text-lg font-medium leading-7">
                      Prioritize Docker and deployment evidence first. These
                      additions could increase your score from 82 to an estimated 89.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black hover:bg-slate-200"
                >
                  View action plan
                  <ArrowRight className="ml-2 size-4" />
                </button>
              </div>
            </div>
          </Card>
        </section>

        {/* Learning plan */}
        <section>
          <SectionHeading
            eyebrow="2-Week Learning Plan"
            title="A focused plan to become more referral-ready"
            description="Complete the highest-impact tasks first and strengthen the evidence behind your Candidate Trust Card."
            action={
              <Badge>
                <Clock3 className="mr-1.5 size-3.5" />
                21 hours total
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
          </div>
        </section>

        {/* Candidate Trust Card */}
        <section>
          <SectionHeading
            eyebrow="Candidate Trust Card"
            title="The employee sees evidence—not another resume"
            description="RefAI summarizes role fit, verified signals, and referral risk so employees can make confident decisions faster."
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
                  initials="SG"
                  size="lg"
                  className="border-4 border-white/10 bg-white text-black"
                />
                <h3 className="mt-5 text-2xl font-semibold">Sakshi Gupta</h3>
                <p className="mt-1.5 text-sm text-slate-400">
                  B.Tech Computer Science · VIT Vellore
                </p>

                <div className="mt-6 flex items-center gap-2">
                  <BriefcaseBusiness className="size-4 text-slate-400" />
                  <span className="text-sm">Target: Backend Developer</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <GraduationCap className="size-4 text-slate-400" />
                  <span className="text-sm">Graduating in 2027</span>
                </div>
              </div>

              <div className="my-8 h-px bg-white/10" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                    Overall Match
                  </p>
                  <p className="mt-2 text-4xl font-semibold">82%</p>
                </div>
                <div className="flex size-14 items-center justify-center rounded-full border-4 border-emerald-400 text-emerald-300">
                  <Check className="size-6" />
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span className="text-sm font-semibold">
                    Identity &amp; resume verified
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Evidence was extracted from the candidate&apos;s uploaded resume
                  and the role requirements.
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

                <Badge tone="success">
                  <ShieldCheck className="mr-1.5 size-3.5" />
                  Low referral risk
                </Badge>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Project Quality", value: "Strong", score: 88 },
                  { label: "GitHub Activity", value: "Consistent", score: 84 },
                  { label: "Skill Evidence", value: "Verified", score: 86 },
                  { label: "Experience Fit", value: "Relevant", score: 80 },
                ].map((signal) => (
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

              <div className="mt-7">
                <p className="text-sm font-semibold">Top Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {matchingSkills.slice(0, 5).map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                </div>
              </div>

              <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  <p className="text-sm font-semibold">AI Trust Summary</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Sakshi demonstrates strong backend fundamentals through two
                  relevant full-stack projects, recent Node.js work, and consistent
                  GitHub activity. Her experience aligns with 82% of this
                  role&apos;s requirements. Docker and system design remain
                  development areas, but current evidence indicates a low-risk
                  referral for an early-career backend position.
                </p>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <PrimaryButton>
                  Preview Full Trust Card
                  <ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
                <SecondaryButton>
                  <GitBranch className="mr-2 size-4" />
                  View evidence
                </SecondaryButton>
              </div>
            </div>
          </div>
        </section>

        {/* Employee discovery */}
        <section>
          <SectionHeading
            eyebrow="Find Referrers"
            title="Connect with verified employees"
            description="Your Candidate Trust Card gives employees the context they need before deciding to refer you."
          />

          <div className="relative mb-6 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              value={employeeQuery}
              onChange={(event) => setEmployeeQuery(event.target.value)}
              placeholder="Search employees by company..."
              className="h-13 w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => (
              <Card
                key={`${employee.name}-${employee.company}`}
                className="p-5 transition-transform hover:-translate-y-0.5"
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

                <PrimaryButton className="mt-4 w-full">
                  Request Referral
                  <ArrowRight className="ml-2 size-4" />
                </PrimaryButton>
              </Card>
            ))}
          </div>

          {filteredEmployees.length === 0 && (
            <Card className="border-dashed py-12 text-center">
              <Search className="mx-auto size-6 text-slate-400" />
              <p className="mt-3 font-semibold">No employees found</p>
              <p className="mt-1 text-sm text-slate-500">
                Try searching for another company.
              </p>
            </Card>
          )}
        </section>

        {/* Referral gate and message generator */}
        <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <Card className="border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <LockKeyhole className="size-5" />
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.17em] text-emerald-700">
              Referral Readiness Gate
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-emerald-950">
              You are eligible to request referrals.
            </h2>
            <p className="mt-3 text-sm leading-6 text-emerald-800">
              Your score of 82 exceeds the minimum requirement of 70. You can now
              share your Candidate Trust Card with verified employees.
            </p>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-white/75 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-950">
                  Eligibility threshold
                </span>
                <span className="text-sm font-semibold text-emerald-950">
                  82 / 70
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar value={82} tone="success" />
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold text-emerald-950">
              Optional improvements
            </p>
            <div className="mt-3 space-y-2">
              {missingSkills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center gap-2 text-sm text-emerald-900"
                >
                  <Circle className="size-3.5" />
                  Add evidence for {skill}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.17em] text-slate-500">
                  AI Referral Message Generator
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  A natural, personalized request
                </h2>
              </div>

              <Badge>
                <Sparkles className="mr-1.5 size-3.5" />
                Based on Trust Card
              </Badge>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <p className="text-sm leading-7 text-slate-700">
                {referralMessage}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <SecondaryButton onClick={copyMessage}>
                {copied ? (
                  <Check className="mr-2 size-4 text-emerald-600" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </SecondaryButton>

              <SecondaryButton
                onClick={regenerateMessage}
                disabled={regenerating}
              >
                {regenerating ? (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Regenerate
              </SecondaryButton>

              <PrimaryButton className="sm:ml-auto">
                <Send className="mr-2 size-4" />
                Send Referral Request
              </PrimaryButton>
            </div>
          </Card>
        </section>

        {/* Referral requests */}
        <section>
          <SectionHeading
            eyebrow="My Referral Requests"
            title="Track every referral in one place"
            description="Stay informed from the moment you share your Trust Card."
            action={
              <SecondaryButton>
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
                  key={`${request.employee}-${request.date}`}
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
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Resume health */}
        <section>
          <SectionHeading
            eyebrow="Resume Health"
            title="A healthier resume creates a stronger trust signal"
            description="Monitor the details that shape both recruiter readability and referral confidence."
            action={
              <PrimaryButton>
                <WandSparkles className="mr-2 size-4" />
                Optimize Resume
              </PrimaryButton>
            }
          />

          <Card className="p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
              <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-7 text-center">
                <ScoreRing score={86} size={148} strokeWidth={10} />
                <h3 className="mt-5 text-lg font-semibold">
                  Overall Resume Health
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Your resume is strong and ready for most early-career software
                  roles.
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
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <SectionHeading
            eyebrow="Quick Actions"
            title="Keep moving forward"
            description="Everything you need to improve, verify, and share your profile."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.label}
                  type="button"
                  className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 transition-colors group-hover:bg-black group-hover:text-white">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{action.label}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {action.description}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />
                </button>
              );
            })}
          </div>
        </section>

        {/* Upcoming features */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone="dark">Coming Soon</Badge>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Phase 2
                </span>
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                The next layer of referral intelligence
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                New tools designed to make every connection, interview, and career
                decision more informed.
              </p>
            </div>

            <Rocket className="hidden size-8 text-slate-300 md:block" />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {upcomingFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <Icon className="size-5 text-slate-600" />
                  <p className="mt-4 text-sm font-semibold leading-5">
                    {feature.title}
                  </p>
                  <Badge className="mt-3 text-[10px] uppercase tracking-wider">
                    Phase 2
                  </Badge>
                </div>
              );
            })}
          </div>
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