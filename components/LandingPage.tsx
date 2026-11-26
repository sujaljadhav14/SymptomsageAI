import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignInButton, SignedIn, SignedOut } from '@clerk/clerk-react';
import {
    ArrowRight,
    ArrowDown,
    ShieldCheck,
    WifiOff,
    FileText,
    MapPin,
    Camera,
    Brain,
    Siren,
    Plus,
    Languages,
    Stethoscope,
    type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import ChatSymptomChecker from './assessment/ChatSymptomChecker';
import HeroArt from './HeroArt';
import Logo from './Logo';

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const SectionLabel: React.FC<{ n: string; children: React.ReactNode; light?: boolean }> = ({ n, children, light }) => (
    <p className={`label-mono mb-4 ${light ? '!text-paper/70' : ''}`}>
        <span className="mr-2">{n}</span>— {children}
    </p>
);

const URGENCY = [
    {
        tone: 'bg-signal text-white',
        tag: 'Emergency',
        action: 'Call 112 or 108 now',
        eg: 'Chest pain with sweating, trouble breathing, face drooping, heavy bleeding.',
    },
    {
        tone: 'bg-orange-400 text-ink',
        tag: 'Within 24 hours',
        action: 'See a doctor today or tomorrow',
        eg: 'High fever that will not settle, persistent vomiting, severe pain that is new.',
    },
    {
        tone: 'bg-caution text-ink',
        tag: 'This week',
        action: 'Book a regular appointment',
        eg: 'Symptoms lasting more than a few days, or that keep coming back.',
    },
    {
        tone: 'bg-leaf text-ink',
        tag: 'Home care',
        action: 'Rest, fluids, watch for change',
        eg: 'Mild cold, a short-lived headache, minor aches that are improving.',
    },
];

const TRY_POINTS: { icon: LucideIcon; text: string }[] = [
    { icon: ShieldCheck, text: 'Private: processed in your browser' },
    { icon: WifiOff, text: 'Works without a good network' },
    { icon: Stethoscope, text: 'Ends with a clear next step, not a wall of text' },
];

const STEPS = [
    {
        n: '1',
        title: 'Describe it your way',
        body: 'Type what you feel in plain words, like "bad stomach pain and vomiting since last night". No forms to wade through.',
    },
    {
        n: '2',
        title: 'Red flags are checked first',
        body: 'Before anything else, a fixed set of rules looks for emergency signs. This step never depends on an AI guessing.',
    },
    {
        n: '3',
        title: 'Get a clear next step',
        body: 'You see how urgent it is, why, which tests a doctor may suggest, and where to go. Save or share it as a report.',
    },
];

const FEATURES = [
    {
        icon: Siren,
        title: 'Emergency rules first',
        body: 'Deterministic red-flag checks run before everything else.',
        span: 'md:col-span-2',
        bg: 'bg-white',
    },
    {
        icon: WifiOff,
        title: 'Works offline',
        body: 'The symptom checker runs on your device. Weak network? Still works.',
        span: '',
        bg: 'bg-caution-soft',
    },
    {
        icon: Brain,
        title: 'Explains its reasoning',
        body: 'Every result lists the symptoms that led to it. No black box.',
        span: '',
        bg: 'bg-white',
    },
    {
        icon: Camera,
        title: 'Photo check',
        body: 'Signed-in users can add a photo of a rash or wound for an AI-assisted look.',
        span: '',
        bg: 'bg-white',
    },
    {
        icon: MapPin,
        title: 'Care nearby',
        body: 'Hospitals, clinics, labs and pharmacies near you, matched to what you may need.',
        span: '',
        bg: 'bg-leaf/60',
    },
    {
        icon: FileText,
        title: 'Reports you can share',
        body: 'Download a PDF or email yourself a summary to show your doctor.',
        span: 'md:col-span-2',
        bg: 'bg-white',
    },
];

const FAQ = [
    {
        q: 'Is this a diagnosis?',
        a: 'No. SymptomSage helps you judge how urgent your symptoms are and what to do next. Only a qualified doctor can diagnose. If you feel something is seriously wrong, do not wait for a result: call 112.',
    },
    {
        q: 'Where does my data go?',
        a: 'The free symptom checker runs entirely in your browser; what you type there is not sent anywhere. If you sign in and use the assistant or photo check, your messages are processed by our AI provider and your report is saved to your account so you can find it later.',
    },
    {
        q: 'How does it decide?',
        a: 'Emergency signs are matched by fixed rules. Possible conditions are ranked by an explainable scoring table that you can read in the report. The rules are a work in progress and have not yet been reviewed by a clinician, which is why the result is guidance, not a verdict.',
    },
    {
        q: 'Which languages are supported?',
        a: 'English today. Hindi, Marathi and Hinglish are on the way; most people in India describe symptoms in their own language, and so should this.',
    },
];

const LandingPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen overflow-x-hidden bg-paper text-ink">
            {/* Emergency strip */}
            <div className="bg-ink px-4 py-2 text-center text-xs font-semibold text-paper">
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-signal align-middle" />
                In an emergency call{' '}
                <a href="tel:112" className="underline decoration-2 underline-offset-2">112</a>
                {' '}· ambulance{' '}
                <a href="tel:108" className="underline decoration-2 underline-offset-2">108</a>
                {' '}— don't use an app.
            </div>

            {/* Nav */}
            <nav className="sticky top-0 z-50 border-b-2 border-ink bg-paper/90 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="SymptomSage home">
                        <Logo />
                    </button>
                    <div className="hidden items-center gap-7 text-sm font-bold md:flex">
                        <button onClick={() => scrollToId('how')} className="hover:underline underline-offset-4 decoration-2">How it works</button>
                        <button onClick={() => scrollToId('try')} className="hover:underline underline-offset-4 decoration-2">Try it free</button>
                        <button onClick={() => scrollToId('clinics')} className="hover:underline underline-offset-4 decoration-2">For clinics</button>
                        <button onClick={() => scrollToId('faq')} className="hover:underline underline-offset-4 decoration-2">FAQ</button>
                    </div>
                    <div className="flex items-center gap-3">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="hidden text-sm font-bold hover:underline underline-offset-4 decoration-2 sm:block">Sign in</button>
                            </SignInButton>
                            <SignInButton mode="modal">
                                <button className="btn-dark !px-4 !py-2">Get started</button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <button onClick={() => navigate('/app')} className="btn-dark !px-4 !py-2">
                                Open app <ArrowRight className="h-4 w-4" />
                            </button>
                        </SignedIn>
                    </div>
                </div>
            </nav>

            {/* 01 Hero */}
            <header className="relative overflow-hidden border-b-2 border-ink bg-brand-600 text-white">
                <div className="halftone-light pointer-events-none absolute inset-0 opacity-70" />
                <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <SectionLabel n="01" light>Symptom triage for India</SectionLabel>
                        <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]">
                            Know how urgent it is,{' '}
                            <span className="font-serif font-normal italic text-caution">before</span> it gets worse.
                        </h1>
                        <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-white/85">
                            Tell SymptomSage what you're feeling. Get a clear answer: emergency, see a doctor soon, or rest
                            at home. Plus tests to ask about and care nearby. Free to try, no sign-up.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <button onClick={() => scrollToId('try')} className="btn-dark !bg-paper !text-ink !px-6 !py-3.5 text-base !shadow-[4px_4px_0_#0b0b0b]">
                                Check my symptoms <ArrowDown className="h-4 w-4" />
                            </button>
                            <SignedOut>
                                <SignInButton mode="modal">
                                    <button className="text-sm font-bold underline decoration-2 underline-offset-4">Or sign in to save reports</button>
                                </SignInButton>
                            </SignedOut>
                            <SignedIn>
                                <button onClick={() => navigate('/app')} className="text-sm font-bold underline decoration-2 underline-offset-4">
                                    Go to your dashboard
                                </button>
                            </SignedIn>
                        </div>
                        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-white/70">
                            <span>Explainable rules</span>
                            <span>Works offline</span>
                            <span>Not a diagnosis</span>
                        </p>
                    </motion.div>
                    <HeroArt />
                </div>
            </header>

            {/* Ticker */}
            <div className="overflow-hidden border-b-2 border-ink bg-caution py-3">
                <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-8 gap-y-1 px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {['Chest pain', 'Breathing trouble', 'Stroke signs', 'Severe bleeding', 'Seizure', 'Overdose', 'Thoughts of self-harm'].map((t) => (
                        <span key={t} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                            {t}
                        </span>
                    ))}
                    <span className="w-full text-center opacity-70 sm:w-auto">← emergency signs we check first</span>
                </div>
            </div>

            {/* 02 How it works */}
            <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
                <SectionLabel n="02">How it works</SectionLabel>
                <h2 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                    Three steps. <span className="font-serif font-normal italic">No jargon.</span>
                </h2>
                <div className="mt-12 grid gap-6 md:grid-cols-3">
                    {STEPS.map((s) => (
                        <div key={s.n} className="card p-7">
                            <span className="font-display text-6xl font-extrabold leading-none text-brand-600">{s.n}</span>
                            <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                            <p className="mt-2 leading-relaxed text-slate-600">{s.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 03 Try it */}
            <section id="try" className="scroll-mt-16 border-y-2 border-ink bg-paper-2 py-24">
                <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[1fr_1.1fr]">
                    <div>
                        <SectionLabel n="03">Try it now</SectionLabel>
                        <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                            Free symptom check.{' '}
                            <span className="font-serif font-normal italic">Nothing to install.</span>
                        </h2>
                        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
                            Type your symptoms like you'd tell a friend. This checker runs on your device, so what you type
                            stays with you. It works on a slow or patchy connection too.
                        </p>
                        <ul className="mt-8 space-y-3 text-sm font-semibold">
                            {TRY_POINTS.map(({ icon: Icon, text }) => (
                                <li key={text} className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink bg-white">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <ChatSymptomChecker compact />
                </div>
            </section>

            {/* 04 Urgency scale */}
            <section className="mx-auto max-w-7xl px-5 py-24">
                <SectionLabel n="04">The urgency scale</SectionLabel>
                <h2 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                    Colour means <span className="font-serif font-normal italic">how soon.</span>
                </h2>
                <p className="mt-4 max-w-2xl text-lg text-slate-600">
                    Every result lands on one of four levels, so you can see at a glance what to do.
                </p>
                <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {URGENCY.map((u) => (
                        <div key={u.tag} className="card flex flex-col overflow-hidden">
                            <div className={`${u.tone} border-b-2 border-ink px-5 py-4`}>
                                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">Level</p>
                                <p className="font-display text-2xl font-extrabold">{u.tag}</p>
                            </div>
                            <div className="flex flex-1 flex-col gap-3 p-5">
                                <p className="font-bold">{u.action}</p>
                                <p className="text-sm leading-relaxed text-slate-600">{u.eg}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-slate-500">Examples are illustrative, not a complete list.</p>
            </section>

            {/* 05 Features */}
            <section className="border-t-2 border-ink bg-ink py-24 text-paper">
                <div className="mx-auto max-w-7xl px-5">
                    <SectionLabel n="05" light>What's inside</SectionLabel>
                    <h2 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                        Built to be <span className="font-serif font-normal italic text-caution">careful</span>, not clever.
                    </h2>
                    <div className="mt-12 grid gap-5 md:grid-cols-3">
                        {FEATURES.map((f) => {
                            const Icon = f.icon;
                            return (
                                <div
                                    key={f.title}
                                    className={`${f.span} ${f.bg} rounded-2xl border-2 border-paper/90 p-6 text-ink shadow-[4px_4px_0_#ffcc2e]`}
                                >
                                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border-2 border-ink bg-white">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <h3 className="font-display text-xl font-bold">{f.title}</h3>
                                    <p className="mt-1.5 leading-relaxed text-slate-600">{f.body}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 06 Clinics */}
            <section id="clinics" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24">
                <div className="card grid items-center gap-10 overflow-hidden bg-caution-soft p-8 md:grid-cols-[1.2fr_1fr] md:p-12">
                    <div>
                        <SectionLabel n="06">For clinics &amp; labs</SectionLabel>
                        <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                            Patients arrive <span className="font-serif font-normal italic">already explained.</span>
                        </h2>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700">
                            We're building a doctor-ready intake summary: symptoms, duration, red flags and history,
                            collected before the visit, in the patient's own language.
                        </p>
                        <p className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider">
                            <Languages className="h-4 w-4" /> In development · Hindi · Marathi · Hinglish
                        </p>
                    </div>
                    <div className="rounded-2xl border-2 border-ink bg-white p-5 shadow-hard">
                        <p className="label-mono !text-[10px]">Illustrative intake summary</p>
                        <dl className="mt-3 space-y-2 text-sm">
                            {[
                                ['Complaint', 'Cough and fever'],
                                ['Duration', '3 days, worse at night'],
                                ['Red flags', 'None reported'],
                                ['Urgency', 'This week'],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4 border-b border-rule pb-2 last:border-0">
                                    <dt className="font-semibold text-slate-500">{k}</dt>
                                    <dd className="text-right font-bold">{v}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            </section>

            {/* 07 FAQ */}
            <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-5 pb-24">
                <SectionLabel n="07">Questions</SectionLabel>
                <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
                    Before you <span className="font-serif font-normal italic">trust us.</span>
                </h2>
                <div className="mt-10 space-y-4">
                    {FAQ.map((f) => (
                        <details key={f.q} className="group card open:shadow-hard-brand">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-display text-lg font-bold">
                                {f.q}
                                <Plus className="h-5 w-5 shrink-0 transition-transform group-open:rotate-45" />
                            </summary>
                            <p className="px-6 pb-6 leading-relaxed text-slate-600">{f.a}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="border-t-2 border-ink bg-brand-600 py-20 text-center text-white">
                <div className="mx-auto max-w-3xl px-5">
                    <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
                        When in doubt, <span className="font-serif font-normal italic text-caution">get checked.</span>
                    </h2>
                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                        <button onClick={() => scrollToId('try')} className="btn !bg-paper text-ink shadow-[4px_4px_0_#0b0b0b]">
                            Start a free check <ArrowRight className="h-4 w-4" />
                        </button>
                        <a href="tel:112" className="btn-signal">Call 112</a>
                    </div>
                </div>
            </section>

            <footer className="border-t-2 border-ink bg-paper px-5 py-10">
                <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <Logo />
                    <p className="max-w-xl text-xs leading-relaxed text-slate-500">
                        &copy; {new Date().getFullYear()} SymptomSage. Guidance only, not a medical diagnosis or a substitute
                        for a doctor. In an emergency call 112 or 108.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
