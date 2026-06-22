import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import Braces from "lucide-react/dist/esm/icons/braces.mjs";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.mjs";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text.mjs";
import Download from "lucide-react/dist/esm/icons/download.mjs";
import FileJson from "lucide-react/dist/esm/icons/file-json.mjs";
import Route from "lucide-react/dist/esm/icons/route.mjs";
import ScanLine from "lucide-react/dist/esm/icons/scan-line.mjs";
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

const navItems = [
  { label: "Features", href: "#capture" },
  { label: "Screens", href: "#rules" },
  { label: "FAQ", href: "#faq" },
  { label: "Export", href: "#export" },
];

const stats = [
  ["fetch/XHR", "API capture"],
  ["3 modes", "Static / Merge / Dynamic"],
  ["scenarios", "grouped states"],
];

const requestSignals = [
  ["GET", "/api/cart/summary", "200"],
  ["POST", "/api/coupons/apply", "201"],
  ["PUT", "/api/user/profile", "200"],
];

const features = [
  {
    icon: ScanLine,
    title: "Capture real requests",
    text: "Record only API traffic from the active tab.",
  },
  {
    icon: Route,
    title: "Create from one hit",
    text: "Turn a captured request into a rule with URL, method, headers, and body filled in.",
  },
  {
    icon: FileJson,
    title: "Choose response mode",
    text: "Use Static, Merge, or Dynamic responses for different testing needs.",
  },
  {
    icon: ToggleRight,
    title: "Switch scenarios fast",
    text: "Group rules into states like empty cart, payment failed, or slow inventory.",
  },
];

const gallery = [
  {
    src: panelShot,
    alt: "Request Mock Lite DevTools panel showing captured network requests and mock controls",
    title: "Capture panel",
    eyebrow: "Captured APIs",
  },
  {
    src: editorShot,
    alt: "Request Mock Lite rule editor with JSON response body and matching options",
    title: "Rule editor",
    eyebrow: "Response modes",
  },
  {
    src: badgeShot,
    alt: "A browser page showing the Request Mock Lite in-page mock badge",
    title: "Page badge",
    eyebrow: "Mock feedback",
  },
];

const faqs = [
  {
    question: "How do I install the Chrome extension?",
    answer: "Download the latest release zip, unzip it, open chrome://extensions, enable Developer mode, and load the unzipped folder.",
  },
  {
    question: "How do I add a mock rule?",
    answer: "Paste a cURL command into the Add flow, or capture a real fetch/XHR request and turn it into a rule with Mock this.",
  },
  {
    question: "What response modes are supported?",
    answer: "Use Static for fixed responses, Merge to patch real API data, or Dynamic to compute a response from the request and real response.",
  },
  {
    question: "Can I move rules between projects or teammates?",
    answer: "Yes. Export rules as JSON, import them later, or keep scenario groups for repeatable local testing.",
  },
];

function MotionSection({ children, className = "", ...sectionProps }) {
  const shouldReduceMotion = useReducedMotion();
  const isPrerender = typeof window === "undefined";

  return (
    <m.section
      className={className}
      {...sectionProps}
      initial={isPrerender || shouldReduceMotion ? false : "hidden"}
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
        <GalleryBand />
        <FaqBand />
        <FinalCta />
        <Footer />
      </main>
    </LazyMotion>
  );
}

function Header() {
  return (
    <header className="site-header fixed inset-x-0 top-0 z-40">
      <nav className="site-nav mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <a className="brand-lockup group flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300" href="#top">
          <img className="brand-mark h-9 w-9" src={iconUrl} alt="" />
          <span className="brand-wordmark text-sm leading-none text-cyan-100 sm:text-base" data-text="Request Mock Lite" aria-label="Request Mock Lite">
            <span className="brand-wordmark-text" aria-hidden="true">Request Mock Lite</span>
          </span>
        </a>
        <div className="nav-cluster hidden items-center md:flex">
          {navItems.map((item) => (
            <a
              className="pixel-link min-h-10 px-3 py-3 text-xs uppercase tracking-normal text-slate-300 transition hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          className="pixel-button nav-release min-h-11 px-4 py-3 text-xs text-[#061015] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-300"
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
  const isPrerender = typeof window === "undefined";

  return (
    <section id="top" className="relative min-h-[86dvh] pt-20 sm:pt-24">
      <div className="hero-stage mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <m.div
          initial={isPrerender || shouldReduceMotion ? false : "hidden"}
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
            <a className="pixel-button-secondary min-h-12 px-5 py-3 text-sm" href="https://github.com/eijil/request-mock-lite/issues">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              Feedback
            </a>
          </m.div>
        </m.div>

        <m.div
          className="hero-product-field"
          initial={isPrerender || shouldReduceMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
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
  const isPrerender = typeof window === "undefined";

  return (
    <m.div
      className="request-signal"
      initial={isPrerender || shouldReduceMotion ? false : { opacity: 0, x: 18 }}
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
          <span>Scenario testing</span>
          <h2>Test every API state from the browser.</h2>
          <p>
            Capture real fetch/XHR requests, turn them into mocks, then switch
            success, empty, slow, and error states locally.
          </p>
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

function GalleryBand() {
  return (
    <MotionSection id="rules" className="relative border-y border-cyan-300/15 bg-[#0e1622]/88 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div className="section-heading max-w-3xl" variants={fadeUp}>
          <span>Product screens</span>
          <h2>Cyberpunk pixel UI, built for real debugging.</h2>
          <p>
            Capture requests, edit mock rules, and confirm active mocks directly on the page.
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

function FaqBand() {
  return (
    <MotionSection id="faq" className="relative border-t border-cyan-300/15 bg-[#09131c]/78 py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <m.div className="section-heading" variants={fadeUp}>
          <span>FAQ</span>
          <h2>Fast answers before you install.</h2>
          <p>
            The short version: it runs locally, focuses on API traffic, and keeps mock
            states easy to switch.
          </p>
        </m.div>
        <div className="faq-list">
          {faqs.map((item, index) => (
            <m.details className="faq-item" key={item.question} open={index === 0} variants={fadeUp}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </m.details>
          ))}
        </div>
      </div>
    </MotionSection>
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
            <span>Runs locally in Chrome. No proxy server required.</span>
          </div>
        </m.div>
      </div>
    </MotionSection>
  );
}

function Footer() {
  return (
    <footer className="site-footer relative overflow-hidden border-t border-cyan-300/15 bg-[#060c12]">
      <div className="footer-title-bg" aria-hidden="true">
        <span data-text="Request Mock Lite">Request Mock Lite</span>
      </div>
      <div className="footer-inner relative z-10 mx-auto flex max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <p className="footer-copy">
          © 2026 Request Mock Lite. Made by <span>@eijil</span> & AI agent.
        </p>
      </div>
    </footer>
  );
}

export default App;
