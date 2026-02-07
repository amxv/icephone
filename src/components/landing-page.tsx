"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import {
	Bot,
	Phone,
	Rocket,
	TrendingUp,
	Search,
	BookOpen,
	GitBranch,
	LayoutDashboard,
	Users,
	Calendar,
	Headset,
	Landmark,
	UserPlus,
	RefreshCw,
	FileText,
	Globe,
	Megaphone,
	Database,
	MonitorPlay,
	Webhook,
	PhoneForwarded,
	Clock,
	ShieldCheck,
	ChevronDown,
	BarChart3,
	Gauge,
	Heart,
	Activity,
	Timer,
	Target,
	TrendingDown,
} from "lucide-react"
import { motion, type Variants } from "motion/react"

// ─── Animation helpers ─────────────────────────────────────────────

function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null)
	const [inView, setInView] = useState(false)

	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true)
					observer.unobserve(el)
				}
			},
			{ threshold }
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [threshold])

	return { ref, inView }
}

const fadeUp: Variants = {
	hidden: { opacity: 0, y: 32 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
	}),
}

function FadeUp({
	children,
	delay = 0,
	className = "",
}: {
	children: React.ReactNode
	delay?: number
	className?: string
}) {
	const { ref, inView } = useInView()
	return (
		<motion.div
			ref={ref}
			variants={fadeUp}
			initial="hidden"
			animate={inView ? "visible" : "hidden"}
			custom={delay}
			className={className}
		>
			{children}
		</motion.div>
	)
}

// ─── Integration logos via logo.dev ──────────────────────────────────

const INTEGRATIONS = [
	{ name: "Twilio", domain: "twilio.com" },
	{ name: "Telnyx", domain: "telnyx.com" },
	{ name: "Vonage", domain: "vonage.com" },
	{ name: "HubSpot", domain: "hubspot.com" },
	{ name: "Salesforce", domain: "salesforce.com" },
	{ name: "GoHighLevel", domain: "gohighlevel.com" },
	{ name: "Pipedrive", domain: "pipedrive.com" },
	{ name: "Cal.com", domain: "cal.com" },
]

function IntegrationLogo({ name, domain }: { name: string; domain: string }) {
	const [failed, setFailed] = useState(false)
	if (failed) {
		return (
			<span className="text-sm font-medium text-white/60 px-3 py-1.5 border border-white/10 rounded-lg">
				{name}
			</span>
		)
	}
	return (
		<img
			src={`https://img.logo.dev/${domain}?token=pk_a]JFGDjXQA2qCpF8t3Iz7w&size=60&format=png`}
			alt={name}
			width={28}
			height={28}
			className="h-7 w-7 rounded object-contain opacity-70 hover:opacity-100 transition-opacity"
			onError={() => setFailed(true)}
		/>
	)
}

// ─── FAQ Accordion ───────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="border-b border-white/10">
			<button
				onClick={() => setOpen(!open)}
				className="w-full flex items-center justify-between py-5 text-left cursor-pointer"
			>
				<span className="text-base font-medium text-white pr-4">{q}</span>
				<ChevronDown
					className={`h-5 w-5 text-amber-400/70 shrink-0 transition-transform duration-300 ${
						open ? "rotate-180" : ""
					}`}
				/>
			</button>
			<div
				className={`overflow-hidden transition-all duration-300 ${
					open ? "max-h-96 pb-5" : "max-h-0"
				}`}
			>
				<p className="text-sm leading-relaxed text-white/60">{a}</p>
			</div>
		</div>
	)
}

// ─── Sticky Nav ──────────────────────────────────────────────────────

function Nav() {
	const [scrolled, setScrolled] = useState(false)

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20)
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => window.removeEventListener("scroll", onScroll)
	}, [])

	return (
		<nav
			className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
				scrolled
					? "bg-[#0c0013]/80 backdrop-blur-xl border-b border-white/5"
					: "bg-transparent"
			}`}
		>
			<div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
				<Logo lightMode={false} width={80} height={32} />
				<Link
					href="/sign-in"
					className="text-sm font-medium text-amber-200/90 hover:text-amber-100 transition-colors"
				>
					Sign In
				</Link>
			</div>
		</nav>
	)
}

// ─── Main Landing Page ───────────────────────────────────────────────

export function LandingPage() {
	return (
		<div className="min-h-screen bg-[#0c0013] text-white overflow-x-hidden font-[family-name:var(--font-geist-sans)]">
			{/* Ambient glow */}
			<div className="fixed inset-0 pointer-events-none">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/[0.04] rounded-full blur-[120px]" />
				<div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-600/[0.03] rounded-full blur-[100px]" />
			</div>

			{/* Noise overlay */}
			<div
				className="fixed inset-0 pointer-events-none opacity-[0.03]"
				style={{
					backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
					backgroundRepeat: "repeat",
				}}
			/>

			<Nav />

			{/* ── Hero ────────────────────────────────────────────── */}
			<section className="relative pt-32 pb-20 px-6">
				<div className="max-w-4xl mx-auto text-center">
					<FadeUp>
						<h1 className="text-5xl sm:text-6xl md:text-7xl font-[family-name:var(--font-instrument-serif)] font-normal tracking-tight leading-[1.1] text-white">
							Your AI workforce
							<br />
							<span className="text-amber-300/90">for the phones.</span>
						</h1>
					</FadeUp>
					<FadeUp delay={1}>
						<p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
							Deploy voice agents that make and take real phone calls — qualifying leads, booking appointments, following up on payments, and handling support — so your team can focus on closing.
						</p>
					</FadeUp>
					<FadeUp delay={2}>
						<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
							<Link
								href="/sign-in"
								className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-amber-400/90 text-[#0c0013] font-semibold text-sm hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20"
							>
								Sign In
							</Link>
							<a
								href="#how-it-works"
								className="inline-flex items-center justify-center h-12 px-8 rounded-2xl border border-white/15 text-white/70 font-medium text-sm hover:border-white/30 hover:text-white/90 transition-all"
							>
								See IcePhone in Action
							</a>
						</div>
					</FadeUp>
				</div>
			</section>

			{/* ── Integration Trust Bar ───────────────────────────── */}
			<section className="py-12 px-6 border-y border-white/5">
				<div className="max-w-4xl mx-auto text-center">
					<FadeUp>
						<p className="text-xs uppercase tracking-widest text-white/30 mb-6">
							Works with the tools you already use
						</p>
					</FadeUp>
					<FadeUp delay={1}>
						<div className="flex flex-wrap items-center justify-center gap-6">
							{INTEGRATIONS.map((i) => (
								<div
									key={i.domain}
									className="flex items-center gap-2"
								>
									<IntegrationLogo {...i} />
									<span className="text-sm text-white/40">{i.name}</span>
								</div>
							))}
						</div>
					</FadeUp>
				</div>
			</section>

			{/* ── Problem Section ─────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-3xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] leading-tight text-white">
							Phones are still where deals happen.{" "}
							<span className="text-white/40">But nobody wants to work them.</span>
						</h2>
					</FadeUp>
					<FadeUp delay={1}>
						<p className="mt-6 text-base text-white/50 leading-relaxed">
							Your reps spend hours dialing through lead lists, leaving voicemails, and chasing callbacks. Inbound calls go to voicemail after hours. Follow-ups slip through the cracks.
						</p>
					</FadeUp>
					<FadeUp delay={2}>
						<p className="mt-4 text-base text-white/50 leading-relaxed">
							The result: cold leads, missed revenue, and a team that hates the phone.
						</p>
					</FadeUp>
					<FadeUp delay={3}>
						<p className="mt-4 text-base text-white/70 font-medium">
							You could hire more people. Or you could deploy agents that never miss a shift.
						</p>
					</FadeUp>
				</div>
			</section>

			{/* ── How It Works ────────────────────────────────────── */}
			<section id="how-it-works" className="py-24 px-6 scroll-mt-20">
				<div className="max-w-5xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-16">
							Three steps to a fully staffed phone operation.
						</h2>
					</FadeUp>
					<div className="grid md:grid-cols-3 gap-8">
						{[
							{
								num: "01",
								title: "Build your agent.",
								desc: "Pick a role template — cold calling, support, collections, appointment setting, onboarding, or retention — then customize the voice, personality, and conversation style. Test it live from your browser before a single call goes out.",
								icon: Bot,
							},
							{
								num: "02",
								title: "Connect your phones and CRM.",
								desc: "Bring your own numbers from Twilio, Telnyx, or Vonage. Sync leads from HubSpot, Salesforce, GoHighLevel, or Pipedrive. Link your Cal.com calendar so agents can book meetings in real time.",
								icon: Phone,
							},
							{
								num: "03",
								title: "Launch and monitor.",
								desc: "Start a campaign, set your calling schedule and retry rules, and let IcePhone work through the list. Every call is transcribed, summarized, and scored for sentiment — all visible from a single dashboard.",
								icon: Rocket,
							},
						].map((step, idx) => (
							<FadeUp key={step.num} delay={idx}>
								<div className="group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-400/20 hover:bg-white/[0.03] transition-all duration-300">
									<div className="flex items-center gap-3 mb-4">
										<span className="text-xs font-mono text-amber-400/60">
											{step.num}
										</span>
										<step.icon className="h-5 w-5 text-amber-400/50" />
									</div>
									<h3 className="text-lg font-semibold text-white mb-3">
										{step.title}
									</h3>
									<p className="text-sm text-white/45 leading-relaxed">
										{step.desc}
									</p>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── Key Benefits ─────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-5xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-4">
							What changes when your phones run themselves.
						</h2>
					</FadeUp>
					<div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								icon: TrendingUp,
								title: "Scale outreach without scaling headcount.",
								desc: "Run hundreds of outbound calls a day with a single campaign. Set daily caps, calling hours, retry logic, and priority levels — the system handles the rest.",
							},
							{
								icon: Search,
								title: "Every call becomes searchable data.",
								desc: "Every conversation is transcribed in real time, summarized by AI, and tagged with sentiment. Search across call history, filter by outcome, and export reports.",
							},
							{
								icon: BookOpen,
								title: "Your agents know your business.",
								desc: "Upload product docs, policy manuals, and FAQs to the knowledge base. During a live call, your voice agent searches that library and references specific answers.",
							},
							{
								icon: GitBranch,
								title: "Leads move through the pipeline on their own.",
								desc: "Calls trigger automatic status updates, follow-up scheduling, and score adjustments. Drag leads across deal stages on a visual pipeline board.",
							},
							{
								icon: LayoutDashboard,
								title: "One dashboard for everything.",
								desc: "Calls, leads, campaigns, appointments, agents, and analytics — all in one place. No more toggling between a dialer, a CRM, a calendar, and a spreadsheet.",
							},
						].map((b, idx) => (
							<FadeUp
								key={b.title}
								delay={idx}
								className={idx === 4 ? "sm:col-span-2 lg:col-span-1" : ""}
							>
								<div className="h-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-400/20 transition-colors duration-300">
									<b.icon className="h-5 w-5 text-amber-400/60 mb-4" />
									<h3 className="text-base font-semibold text-white mb-2">
										{b.title}
									</h3>
									<p className="text-sm text-white/45 leading-relaxed">
										{b.desc}
									</p>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── Use Cases ────────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-5xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-4">
							Built for teams that live on the phone.
						</h2>
					</FadeUp>
					<div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{[
							{
								icon: Users,
								title: "Sales Outreach",
								desc: "Deploy agents to work through lead lists, qualify prospects, and book meetings — at volume, with consistency, every day.",
							},
							{
								icon: Calendar,
								title: "Appointment Setting",
								desc: "Let your agent handle the back-and-forth of scheduling. It checks live calendar availability on Cal.com and confirms bookings during the call.",
							},
							{
								icon: Headset,
								title: "Inbound Support",
								desc: "Route incoming calls to agents that pull answers from your knowledge base, resolve common issues, and transfer to a human when needed.",
							},
							{
								icon: Landmark,
								title: "Collections",
								desc: "Run compliant follow-up calls with structured outcomes — intent-to-pay, promise-to-pay, callback requested — tracked and reported automatically.",
							},
							{
								icon: UserPlus,
								title: "Onboarding",
								desc: "Walk new customers through setup, activation, and first-value milestones with patient, step-by-step guidance.",
							},
							{
								icon: RefreshCw,
								title: "Retention",
								desc: "Reach customers before their contract expires. Review the value delivered, address concerns, and secure renewals proactively.",
							},
						].map((uc, idx) => (
							<FadeUp key={uc.title} delay={idx}>
								<div className="h-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-400/20 transition-colors duration-300">
									<uc.icon className="h-5 w-5 text-amber-400/60 mb-4" />
									<h3 className="text-base font-semibold text-white mb-2">
										{uc.title}
									</h3>
									<p className="text-sm text-white/45 leading-relaxed">
										{uc.desc}
									</p>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── Feature Highlights ───────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-5xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-16">
							The details that matter at scale.
						</h2>
					</FadeUp>
					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{ icon: FileText, label: "6 pre-built role templates" },
							{ icon: Globe, label: "10 languages, dozens of voices" },
							{ icon: Megaphone, label: "Campaign automation engine" },
							{ icon: Database, label: "Built-in CRM with pipeline board" },
							{ icon: MonitorPlay, label: "Live agent testing from the browser" },
							{ icon: Webhook, label: "Custom webhook functions" },
							{ icon: PhoneForwarded, label: "Call transfer to humans" },
							{ icon: Clock, label: "Business hours enforcement" },
							{ icon: ShieldCheck, label: "Audit logging" },
						].map((f, idx) => (
							<FadeUp key={f.label} delay={idx * 0.5}>
								<div className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.015] hover:border-amber-400/15 transition-colors duration-300">
									<f.icon className="h-4 w-4 text-amber-400/50 shrink-0" />
									<span className="text-sm text-white/70">{f.label}</span>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── Integrations Detail ─────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-5xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-4">
							Plugs into the stack you already run.
						</h2>
					</FadeUp>
					<FadeUp delay={1}>
						<p className="text-center text-white/45 max-w-2xl mx-auto mb-16">
							IcePhone connects to the telephony providers, CRMs, and calendar tools your team already depends on. No rip-and-replace. No migration headaches.
						</p>
					</FadeUp>
					<div className="grid md:grid-cols-3 gap-8">
						{[
							{
								title: "Telephony",
								names: "Twilio, Telnyx, Vonage",
								desc: "Bring your own numbers, keep your existing configuration. Inbound and outbound calls, status webhooks, and call recording all work out of the box.",
							},
							{
								title: "CRMs",
								names: "HubSpot, Salesforce, GoHighLevel, Pipedrive",
								desc: "Import leads, sync call outcomes, and maintain bidirectional record linkage so nothing falls out of sync.",
							},
							{
								title: "Calendar",
								names: "Cal.com",
								desc: "Your voice agents check real-time availability and book appointments during live calls. Bookings appear in Cal.com automatically.",
							},
						].map((cat, idx) => (
							<FadeUp key={cat.title} delay={idx}>
								<div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
									<h3 className="text-base font-semibold text-amber-300/80 mb-1">
										{cat.title}
									</h3>
									<p className="text-xs text-white/30 mb-4">{cat.names}</p>
									<p className="text-sm text-white/45 leading-relaxed">
										{cat.desc}
									</p>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── Analytics ────────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-4xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-4">
							See exactly what your agents are doing —{" "}
							<span className="text-white/40">and whether it&apos;s working.</span>
						</h2>
					</FadeUp>
					<FadeUp delay={1}>
						<p className="text-center text-white/45 mb-12">
							Every call generates data. IcePhone turns that data into decisions.
						</p>
					</FadeUp>
					<div className="grid sm:grid-cols-2 gap-4">
						{[
							{ icon: BarChart3, text: "Call volume and cost tracking — total calls, duration, cost per call, broken down by agent, direction, and time period." },
							{ icon: Heart, text: "Sentiment analysis — positive, negative, and neutral sentiment scored for every conversation." },
							{ icon: Gauge, text: "Agent performance comparison — rank agents by calls completed, appointments booked, and conversions." },
							{ icon: Target, text: "Lead funnel visualization — track how leads move from new to contacted to qualified to converted." },
							{ icon: Activity, text: "Hourly and daily trends — identify peak hours, spot anomalies, and adjust calling windows." },
							{ icon: Timer, text: "Campaign-level reporting — dedicated dashboards per campaign with health scoring and performance alerts." },
							{ icon: TrendingDown, text: "Collection signals — intent-to-pay rate, promise-to-pay rate, connected rate." },
						].map((item, idx) => (
							<FadeUp key={idx} delay={idx * 0.5}>
								<div className="flex items-start gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.015]">
									<item.icon className="h-4 w-4 text-amber-400/50 shrink-0 mt-0.5" />
									<p className="text-sm text-white/50 leading-relaxed">{item.text}</p>
								</div>
							</FadeUp>
						))}
					</div>
				</div>
			</section>

			{/* ── FAQ ──────────────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-3xl mx-auto">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-center text-white mb-12">
							Common questions.
						</h2>
					</FadeUp>
					<FadeUp delay={1}>
						<div className="border-t border-white/10">
							{[
								{
									q: "Do I need my own phone numbers?",
									a: "Yes. IcePhone connects to your existing Twilio, Telnyx, or Vonage account. You bring the phone numbers; IcePhone provides the AI agents that use them.",
								},
								{
									q: "Can agents handle both inbound and outbound calls?",
									a: "Yes. Configure agents for outbound campaigns, inbound support, or both. Each agent can be assigned to specific phone numbers and use cases.",
								},
								{
									q: "How does the knowledge base work?",
									a: "Upload documents — PDFs, web pages, Google Docs, Word files, text files, or images — and IcePhone processes them into a searchable library. During a call, your agent searches that library to find relevant answers and cites specific sources in its responses.",
								},
								{
									q: "Can agents book appointments during a call?",
									a: "Yes, with Cal.com integration. The agent checks real-time calendar availability, offers time slots, and confirms the booking — all within the conversation.",
								},
								{
									q: "What happens if the agent can't handle a call?",
									a: "You can configure call transfer rules with specific phone numbers and instructions. The agent will hand off to a human when it hits its limits.",
								},
								{
									q: "How many languages are supported?",
									a: "Voice agents are available in 10 languages: English, Spanish, French, German, Italian, Portuguese, Chinese, Hindi, Arabic, and Japanese.",
								},
								{
									q: "Is my data isolated from other teams?",
									a: "Yes. IcePhone uses a multi-tenant architecture with team-based data isolation. Your leads, agents, campaigns, knowledge bases, and call records are completely separated from other organizations.",
								},
								{
									q: "Can I test an agent before deploying it?",
									a: "Yes. The platform includes browser-based test calls where you can talk to your agent in real time, see the live transcription, and evaluate its performance — no phone line needed.",
								},
							].map((faq) => (
								<FAQItem key={faq.q} {...faq} />
							))}
						</div>
					</FadeUp>
				</div>
			</section>

			{/* ── Final CTA ───────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="max-w-3xl mx-auto text-center">
					<FadeUp>
						<h2 className="text-3xl sm:text-4xl font-[family-name:var(--font-instrument-serif)] text-white mb-6">
							Your phones should be working as hard as you are.
						</h2>
					</FadeUp>
					<FadeUp delay={1}>
						<p className="text-base text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
							IcePhone gives you AI voice agents that qualify leads, book meetings, handle support, and follow up on payments — around the clock, in 10 languages, across every phone line you operate.
						</p>
					</FadeUp>
					<FadeUp delay={2}>
						<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
							<Link
								href="/sign-in"
								className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-amber-400/90 text-[#0c0013] font-semibold text-sm hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20"
							>
								Sign In
							</Link>
							<a
								href="#how-it-works"
								className="inline-flex items-center justify-center h-12 px-8 rounded-2xl border border-white/15 text-white/70 font-medium text-sm hover:border-white/30 hover:text-white/90 transition-all"
							>
								See IcePhone in Action
							</a>
						</div>
					</FadeUp>
				</div>
			</section>

			{/* ── Footer ──────────────────────────────────────────── */}
			<footer className="border-t border-white/5 py-10 px-6">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
					<Logo lightMode={false} width={60} height={24} />
					<p className="text-xs text-white/25">
						&copy; {new Date().getFullYear()} IcePhone. All rights reserved.
					</p>
					<Link
						href="/sign-in"
						className="text-xs text-white/30 hover:text-white/60 transition-colors"
					>
						Sign In
					</Link>
				</div>
			</footer>
		</div>
	)
}
