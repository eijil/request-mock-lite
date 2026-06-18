import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import Braces from "lucide-react/dist/esm/icons/braces.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import Download from "lucide-react/dist/esm/icons/download.mjs";
import FileJson from "lucide-react/dist/esm/icons/file-json.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import Network from "lucide-react/dist/esm/icons/network.mjs";
import PlugZap from "lucide-react/dist/esm/icons/plug-zap.mjs";
import Radar from "lucide-react/dist/esm/icons/radar.mjs";
import Route from "lucide-react/dist/esm/icons/route.mjs";
import ScanLine from "lucide-react/dist/esm/icons/scan-line.mjs";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.mjs";
import Terminal from "lucide-react/dist/esm/icons/terminal.mjs";
import ToggleRight from "lucide-react/dist/esm/icons/toggle-right.mjs";
import Workflow from "lucide-react/dist/esm/icons/workflow.mjs";

import iconUrl from "../../icons/icon-128.png";
import panelShot from "../../store-assets/screenshots/01-panel.png";
import editorShot from "../../store-assets/screenshots/02-rule-editor.png";
import badgeShot from "../../store-assets/screenshots/03-page-badge.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const heroTextReveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const heroTextStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.08,
    },
  },
};

const navItems = ["Capture", "Mock", "Rules", "Export"];

const stats = [
  ["fetch/XHR", "response mocking"],
  ["local-first", "Chrome extension"],
  ["JSON", "import and export"],
];

const requestSignals = [
  ["GET", "/api/cart/summary", "200"],
  ["POST", "/api/coupons/apply", "201"],
  ["PUT", "/api/user/profile", "200"],
];

const features = [
  {
    icon: ScanLine,
    title: "Capture live requests",
    text: "Inspect traffic from the active tab, then promote any useful request into a reusable mock rule.",
  },
  {
    icon: Route,
    title: "Match the right surface",
    text: "Target origin + path, exact URLs, substrings, or regex patterns without leaving the browser.",
  },
  {
    icon: FileJson,
    title: "Edit real responses",
    text: "Shape status codes, headers, delay, and JSON bodies in a focused rule editor.",
  },
  {
    icon: ToggleRight,
    title: "Switch states fast",
    text: "Enable groups or single rules when you need a specific API state, then turn them off cleanly.",
  },
];

const workflow = [
  {
    icon: Radar,
    title: "Listen",
    text: "Open the DevTools panel and refresh the page you are testing.",
  },
  {
    icon: PlugZap,
    title: "Promote",
    text: "Use a captured request as the starting point for a mock rule.",
  },
  {
    icon: SlidersHorizontal,
    title: "Tune",
    text: "Adjust matching, status, headers, body, and delay until the state is exact.",
  },
  {
    icon: ListChecks,
    title: "Replay",
    text: "Keep the rule enabled and repeat the frontend flow with stable responses.",
  },
];

const gallery = [
  {
    src: panelShot,
    alt: "Request Mock Lite DevTools panel showing captured network requests and mock controls",
    title: "Capture panel",
    eyebrow: "DevTools signal",
  },
  {
    src: editorShot,
    alt: "Request Mock Lite rule editor with JSON response body and matching options",
    title: "Rule editor",
    eyebrow: "Response lab",
  },
  {
    src: badgeShot,
    alt: "A browser page showing the Request Mock Lite in-page mock badge",
    title: "Page badge",
    eyebrow: "Runtime feedback",
  },
];

function MotionSection({ children, className = "", ...sectionProps }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.section
      className={className}
      {...sectionProps}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
    >
      {children}
    </m.section>
  );
}

function App() {
  return (
    <LazyMotion features={domAnimation}>
      <main className="min-h-dvh overflow-hidden bg-[#081016] text-slate-100">
        <div className="site-grid" aria-hidden="true" />
        <div className="scanline" aria-hidden="true" />
        <Header />
        <Hero />
        <StatsBand />
        <FeatureBand />
        <WorkflowBand />
        <GalleryBand />
        <FinalCta />
      </main>
    </LazyMotion>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-cyan-300/15 bg-[#081016]/84 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <a className="group flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="#top">
          <img className="brand-mark h-9 w-9" src={iconUrl} alt="" />
          <span className="brand-wordmark text-sm leading-none text-cyan-100 sm:text-base">Request Mock Lite</span>
        </a>
        <div className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <a
              className="pixel-link min-h-11 px-3 py-3 text-xs uppercase tracking-normal text-slate-300 transition hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              href={`#${item.toLowerCase()}`}
              key={item}
            >
              {item}
            </a>
          ))}
        </div>
        <a
          className="pixel-button min-h-11 px-4 py-3 text-xs text-[#061015] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
          href="https://github.com/eijil/request-mock-lite/releases/latest"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Release
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="top" className="relative min-h-[86dvh] pt-20 sm:pt-24">
      <div className="hero-stage mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <m.div
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          variants={heroTextStagger}
          className="hero-copy"
        >
          <m.div className="terminal-chip mb-4 w-fit" variants={heroTextReveal} transition={{ duration: 0.28, ease: "easeOut" }}>
            <Terminal className="h-4 w-4" aria-hidden="true" />
            <span>mock runtime armed</span>
          </m.div>
          <h1 className="hero-title" aria-label="Request Mock Lite">
            <HeroTextLine delay={0}>Request</HeroTextLine>
            <HeroTextLine delay={0.05}>Mock</HeroTextLine>
            <HeroTextLine delay={0.1}>Lite</HeroTextLine>
          </h1>
          <m.p className="hero-subcopy mt-4 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl" variants={heroTextReveal} transition={{ duration: 0.34, ease: "easeOut" }}>
            A lightweight Chrome DevTools extension for capturing API requests and mocking
            <span className="text-cyan-200"> fetch</span> / <span className="text-fuchsia-200">XHR</span> responses locally.
          </m.p>
          <m.div className="mt-6 flex gap-3" variants={heroTextReveal} transition={{ duration: 0.34, ease: "easeOut" }}>
            <a className="pixel-button min-h-12 px-5 py-3 text-sm text-[#061015]" href="https://github.com/eijil/request-mock-lite/releases/latest">
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </a>
            <a className="pixel-button-secondary min-h-12 px-5 py-3 text-sm" href="#capture">
              <Network className="h-4 w-4" aria-hidden="true" />
              Workflow
            </a>
          </m.div>
        </m.div>

        <m.div
          className="hero-product-field"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
        >
          <div className="hero-signal-panel" aria-hidden="true">
            <span className="signal-kicker">live capture</span>
            <div className="signal-meter">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p>intercepting unstable API states</p>
          </div>
          <div className="hero-screen">
            <div className="screen-bar">
              <span />
              <span />
              <span />
              <p>mock-lite://capture</p>
            </div>
            <img
              className="aspect-[16/10] w-full object-cover"
              src={panelShot}
              width="1280"
              height="800"
              alt="Request Mock Lite panel with captured API requests and mocking controls"
            />
          </div>
          <div className="request-stream" aria-hidden="true">
            {requestSignals.map(([method, path, status], index) => (
              <RequestSignal index={index} key={path} method={method} path={path} status={status} />
            ))}
          </div>
        </m.div>
      </div>
    </section>
  );
}

function HeroTextLine({ children, delay }) {
  return (
    <m.span
      className="hero-title-line"
      data-text={children}
      variants={heroTextReveal}
      transition={{ duration: 0.38, delay, ease: "easeOut" }}
    >
      <span className="hero-title-core">{children}</span>
    </m.span>
  );
}

function RequestSignal({ index, method, path, status }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.div
      className="request-signal"
      initial={shouldReduceMotion ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay: 0.3 + index * 0.09, ease: "easeOut" }}
    >
      <strong>{method}</strong>
      <span>{path}</span>
      <em>{status}</em>
    </m.div>
  );
}

function StatsBand() {
  return (
    <section className="relative z-10 mx-auto grid max-w-7xl gap-3 px-4 pb-10 sm:grid-cols-3 sm:px-6 lg:px-8">
      {stats.map(([value, label]) => (
        <div className="stat-tile" key={value}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

function FeatureBand() {
  return (
    <MotionSection id="capture" className="relative border-t border-cyan-300/15 bg-[#0c1420]/80 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div className="section-heading" variants={fadeUp}>
          <span>Capture to mock to keep building</span>
          <h2>Fast API states without a backend detour.</h2>
        </m.div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <FeatureCard feature={feature} key={feature.title} />
          ))}
        </div>
      </div>
    </MotionSection>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;

  return (
    <m.article className="pixel-card" variants={fadeUp}>
      <div className="icon-shell">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.text}</p>
    </m.article>
  );
}

function WorkflowBand() {
  return (
    <MotionSection id="mock" className="relative py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <m.div className="section-heading lg:sticky lg:top-28 lg:self-start" variants={fadeUp}>
          <span>Low ceremony loop</span>
          <h2>Turn flaky API moments into repeatable test states.</h2>
          <p>
            The extension keeps mocking close to the page you are debugging, so you can
            work through loading, empty, error, and success paths on demand.
          </p>
        </m.div>
        <div className="grid gap-4 sm:grid-cols-2">
          {workflow.map((step, index) => (
            <WorkflowStep index={index + 1} key={step.title} step={step} />
          ))}
        </div>
      </div>
    </MotionSection>
  );
}

function WorkflowStep({ index, step }) {
  const Icon = step.icon;

  return (
    <m.article className="workflow-step" variants={fadeUp}>
      <div className="flex items-center justify-between gap-4">
        <div className="icon-shell">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="step-index">0{index}</span>
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
    </m.article>
  );
}

function GalleryBand() {
  return (
    <MotionSection id="rules" className="relative border-y border-cyan-300/15 bg-[#0e1622]/88 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div className="section-heading max-w-3xl" variants={fadeUp}>
          <span>Actual extension screens</span>
          <h2>Readable controls, a little neon pressure.</h2>
          <p>
            The visual system nods to terminals and pixel interfaces, but keeps the product
            screenshots large enough to inspect.
          </p>
        </m.div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {gallery.map((item) => (
            <GalleryItem item={item} key={item.title} />
          ))}
        </div>
      </div>
    </MotionSection>
  );
}

function GalleryItem({ item }) {
  return (
    <m.article className="gallery-item" variants={fadeUp}>
      <img className="aspect-[16/10] w-full object-cover" src={item.src} width="1280" height="800" alt={item.alt} loading="lazy" />
      <div className="gallery-caption">
        <span>{item.eyebrow}</span>
        <h3>{item.title}</h3>
      </div>
    </m.article>
  );
}

function FinalCta() {
  return (
    <MotionSection id="export" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <m.div variants={fadeUp}>
          <div className="terminal-chip mx-auto mb-6 w-fit">
            <Workflow className="h-4 w-4" aria-hidden="true" />
            <span>JSON rules in, JSON rules out</span>
          </div>
          <h2 className="final-cta-title">
            Mock the edge case. Ship the interface.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Import and export rule sets, group scenarios, and keep your frontend work moving
            even when the API is not ready to cooperate.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a className="pixel-button min-h-12 px-5 py-3 text-sm text-[#061015]" href="https://github.com/eijil/request-mock-lite/releases/latest">
              <Download className="h-4 w-4" aria-hidden="true" />
              Get release
            </a>
            <a className="pixel-button-secondary min-h-12 px-5 py-3 text-sm" href="https://github.com/eijil/request-mock-lite">
              <Braces className="h-4 w-4" aria-hidden="true" />
              View source
            </a>
          </div>
          <div className="mt-12 inline-flex items-center gap-3 border border-amber-300/25 bg-amber-300/8 px-4 py-3 text-left text-sm text-amber-100">
            <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Built for local Chrome extension workflows, not a hosted proxy.</span>
          </div>
        </m.div>
      </div>
    </MotionSection>
  );
}

export default App;
