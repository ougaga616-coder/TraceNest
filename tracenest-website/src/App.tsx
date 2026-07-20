import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clipboard,
  Download,
  FileImage,
  FolderOpen,
  Image as ImageIcon,
  Layers3,
  Link2,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import traceNestLogo from "./assets/tracenest-logo.png";
import mainScreenshot from "./assets/tracenest-main.png";
import detailScreenshot from "./assets/tracenest-detail.png";
import modalScreenshot from "./assets/tracenest-modal.png";
import toastScreenshot from "./assets/tracenest-toast.png";
import LiquidEther from "./components/LiquidEther";

const TRACENEST_BETA_DOWNLOAD_URL = "";
const FONTKEEPER_DOWNLOAD_URL = "";

const FEATURE_MEDIA_SOURCES = {
  generationRecord: { poster: detailScreenshot },
  smartPaste: { poster: toastScreenshot },
  generationCard: { poster: modalScreenshot },
  creationTrace: { poster: mainScreenshot },
} satisfies Record<string, MediaSource>;

const navItems = [
  { label: "首页", href: "#home" },
  { label: "功能", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "联系我们", href: "#contact" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

type ToastState = {
  id: number;
  message: string;
} | null;

type FeedbackData = {
  type: string;
  description: string;
  systemVersion: string;
  contact: string;
};

function submitFeedback(formData: FeedbackData) {
  console.log("TraceNest feedback", formData);
  // 后续这里可以接入后端接口 / serverless function，将用户反馈自动写入飞书多维表格或飞书文档。
  // 不要在前端暴露飞书 app_secret、tenant_access_token、webhook 密钥或任何敏感信息。
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [activeSection, setActiveSection] = useState("home");
  const [isScrolled, setIsScrolled] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("tracenest-website-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const sectionIds = ["home", "features", "faq", "contact"];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.08, 0.18, 0.32],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tracenest-website-theme", themeMode);
  }, [themeMode]);

  const showToast = (message: string) => {
    const nextToast = { id: Date.now(), message };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
    }, 2600);
  };

  const onDownload = () => {
    if (!TRACENEST_BETA_DOWNLOAD_URL) {
      showToast("Windows 内测版即将提供。");
      return;
    }

    showToast("Windows 内测版下载即将开始。");
  };

  const onFeedbackSubmit = (formData: FeedbackData) => {
    submitFeedback(formData);
    setContactOpen(false);
    showToast("感谢反馈，我们已收到你的信息。");
  };

  return (
    <div className="site-shell">
      <Header
        activeSection={activeSection}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onDownload={onDownload}
        isScrolled={isScrolled}
      />

      <main>
        <Hero onDownload={onDownload} />
        <div className="main-ambient">
          <Features />
          <LocalAndTheme themeMode={themeMode} setThemeMode={setThemeMode} />
          <FAQ />
          <ContactAndDownload onFeedback={() => setContactOpen(true)} onDownload={onDownload} />
        </div>
      </main>

      <Footer
        onPrivacy={() => setPrivacyOpen(true)}
        onUpdates={() => setUpdatesOpen(true)}
      />

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} onSubmit={onFeedbackSubmit} />
      <InfoModal open={privacyOpen} title="隐私说明" onClose={() => setPrivacyOpen(false)}>
        TraceNest 当前以本地整理为核心，不会主动上传图片、Prompt、参考图和创作复迹。用户内容默认保存在本机设备中。
      </InfoModal>
      <InfoModal open={updatesOpen} title="更新记录" onClose={() => setUpdatesOpen(false)}>
        当前官网展示的是 TraceNest Windows 版本的核心整理流程。后续更新将围绕采集、搜索、复迹画布和导出体验继续优化。
      </InfoModal>
      <Toast toast={toast} />
    </div>
  );
}

function Header({
  activeSection,
  mobileOpen,
  setMobileOpen,
  onDownload,
  isScrolled,
}: {
  activeSection: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onDownload: () => void;
  isScrolled: boolean;
}) {
  const handleNav = () => setMobileOpen(false);

  return (
    <header className={`site-header ${isScrolled ? "is-scrolled" : ""}`}>
      <nav className="site-nav container-wide">
        <a href="#home" className="nav-brand" onClick={handleNav}>
          <span className="brand-mark">
            <TraceNestLogo className="brand-logo" />
          </span>
          <span>图迹 TraceNest</span>
        </a>

        <div className="nav-links">
          {navItems.map((item) => (
            <a
              key={item.href}
              className={`nav-link ${activeSection === item.href.slice(1) ? "active" : ""}`}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          <DownloadButton onClick={onDownload} compact ariaLabel="下载 TraceNest Windows 内测版">
            下载 Windows 版
          </DownloadButton>
          <button
            className="menu-button"
            aria-label="打开导航"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mobile-menu container-wide"
          >
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={handleNav}>
                {item.label}
              </a>
            ))}
            <button onClick={onDownload}>下载 Windows 版</button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function TraceNestLogo({ className = "" }: { className?: string }) {
  return <img className={className} src={traceNestLogo} alt="图迹 TraceNest" />;
}

function Hero({ onDownload }: { onDownload: () => void }) {
  return (
    <section id="home" className="hero-section section">
      <HeroFluidBackground />
      <div className="container-wide hero-layout">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="hero-copy"
        >
          <p className="hero-kicker">Windows 内测版</p>
          <h1>
            整理 <span className="brand-gradient-text">AI 视觉创作</span>过程
            <br />
            让<span className="brand-gradient-text">生成有迹可循</span>
          </h1>
          <p className="hero-desc">从灵感素材到生成结果，把每一次 AI 视觉创作整理成可回看、可分享的完整过程。</p>
          <div className="hero-actions">
            <HeroDownloadButton onClick={onDownload} ariaLabel="下载 TraceNest Windows 内测版">
              下载 Windows 版
            </HeroDownloadButton>
            <a className="secondary-link" href="#features">
              查看核心功能
              <ArrowRight size={17} />
            </a>
          </div>
          <p className="beta-note">当前为内测版本，欢迎使用。</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: 0.08 }}
          className="hero-product"
        >
        <ProductFrame src={mainScreenshot} alt="TraceNest 主界面截图" priority />
          <div className="hero-callout callout-prompt">
            <Clipboard size={16} />
            <span>Prompt 与参考图一起保存</span>
          </div>
          <div className="hero-callout callout-tags">
            <Layers3 size={16} />
            <span>模型标签、来源信息可追溯</span>
          </div>
          <div className="hero-callout callout-inbox">
            <FileImage size={16} />
            <span>待整理内容先收进来</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HeroFluidBackground() {
  const [cursorSize, setCursorSize] = useState(() => getHeroCursorSize());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const updateCursorSize = () => setCursorSize(getHeroCursorSize());

    updateCursorSize();
    window.addEventListener("resize", updateCursorSize);

    return () => window.removeEventListener("resize", updateCursorSize);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  if (prefersReducedMotion) {
    return <div className="hero-fluid-background hero-fluid-background--static" aria-hidden="true" />;
  }

  return (
    <div className="hero-fluid-background" aria-hidden="true">
      <LiquidEther
        colors={["#A3F2FF", "#79ACFF", "#8E7CFF", "#9C83FF"]}
        mouseForce={20}
        cursorSize={cursorSize}
        isViscous={false}
        viscous={30}
        iterationsViscous={32}
        iterationsPoisson={32}
        resolution={0.6}
        isBounce={false}
        autoDemo
        autoSpeed={0.72}
        autoIntensity={2.2}
        takeoverDuration={0.25}
        autoResumeDelay={1500}
        autoRampDuration={0.45}
        maxAlpha={0.38}
      />
    </div>
  );
}

function getHeroCursorSize() {
  if (typeof window === "undefined") {
    return 220;
  }

  if (window.innerWidth < 768) {
    return 130;
  }

  if (window.innerWidth < 1440) {
    return 170;
  }

  return 220;
}

function HeroDownloadButton({
  children,
  onClick,
  ariaLabel = "下载 TraceNest Windows 内测版",
  className = "",
  disabled = false,
  href = TRACENEST_BETA_DOWNLOAD_URL,
}: {
  children: string;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  href?: string;
}) {
  const isAvailable = Boolean(href) && !disabled;

  return (
    <a
      href={isAvailable ? href : undefined}
      className={`hero-radial-download-button ${className}`}
      role={!isAvailable ? "button" : undefined}
      tabIndex={!isAvailable ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={!isAvailable}
      onClick={(event) => {
        if (!isAvailable) event.preventDefault();
        onClick();
      }}
      onKeyDown={(event) => {
        if (isAvailable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="hero-radial-download-button__content">
        <Download size={18} strokeWidth={2.2} />
        <span>{children}</span>
      </span>
    </a>
  );
}

function DownloadButton({
  children,
  onClick,
  compact = false,
  ariaLabel = "下载 TraceNest Windows 内测版",
}: {
  children: string;
  onClick: () => void;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const isAvailable = Boolean(TRACENEST_BETA_DOWNLOAD_URL);

  return (
    <a
      href={isAvailable ? TRACENEST_BETA_DOWNLOAD_URL : undefined}
      className={`glow-download-button ${compact ? "compact" : ""}`}
      role={!isAvailable ? "button" : undefined}
      tabIndex={!isAvailable ? 0 : undefined}
      aria-label={ariaLabel}
      aria-disabled={!isAvailable}
      onClick={(event) => {
        if (!isAvailable) event.preventDefault();
        onClick();
      }}
      onKeyDown={(event) => {
        if (isAvailable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <svg className="glow-download-button__orbit" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true">
        <rect className="orbit-tail" x="3" y="3" width="114" height="42" rx="21" pathLength="1" />
        <rect className="orbit-head" x="3" y="3" width="114" height="42" rx="21" pathLength="1" />
      </svg>
      <span className="glow-download-button__core">
        <Download size={compact ? 15 : 18} strokeWidth={2.2} />
        <span>{children}</span>
      </span>
    </a>
  );
}

function ProductFrame({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <figure className="product-frame">
      <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} />
    </figure>
  );
}

type MediaSource = {
  poster: string;
  gif?: string;
};

function FeatureMedia({
  source,
  alt,
  label,
}: {
  source: MediaSource;
  alt: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "120px 0px", threshold: 0.28 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shouldPlay = visible && !reducedMotion && !failed && Boolean(source.gif);
  const src = shouldPlay && source.gif ? source.gif : source.poster;

  return (
    <div className="replaceable-media" ref={ref}>
      <div className="media-toolbar">
        <span>{label}</span>
        <span>{source.gif ? "GIF ready" : "Poster"}</span>
      </div>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function Features() {
  const features = useMemo(
    () => [
      {
        eyebrow: "01",
        title: <>完整记录 <span className="brand-gradient-text">AI生图流程</span></>,
        label: "完整记录 AI 生图流程",
        desc: "将参考素材、Prompt、模型参数与生成结果整理在同一条记录中，完整保留每一次生图过程。",
        media: FEATURE_MEDIA_SOURCES.generationRecord,
        alt: "TraceNest 完整记录 AI 生图流程临时预览",
        chips: ["参考素材", "Prompt", "模型参数", "生成结果"],
        icon: <Layers3 size={19} />,
      },
      {
        eyebrow: "02",
        title: (
          <>
            <span>智能</span>粘贴
          </>
        ),
        label: "智能粘贴",
        desc: "复制图片或 Prompt，智能识别内容并快速填入对应位置。",
        media: FEATURE_MEDIA_SOURCES.smartPaste,
        alt: "TraceNest 智能粘贴临时预览",
        chips: ["精准识别", "快速填入"],
        icon: <Clipboard size={19} />,
      },
      {
        eyebrow: "03",
        title: (
          <>
            <span className="brand-gradient-text">AI视觉</span>生成卡
          </>
        ),
        label: "AI 视觉生成卡",
        desc: "将生成结果、参考素材与 Prompt 汇成一张生成卡，清晰呈现并分享完整的生图过程。",
        media: FEATURE_MEDIA_SOURCES.generationCard,
        alt: "TraceNest AI 视觉生成卡临时预览",
        chips: ["卡片形式分享"],
        icon: <FileImage size={19} />,
      },
      {
        eyebrow: "04",
        title: (
          <>
            创作<span className="brand-gradient-text">复迹</span>
          </>
        ),
        label: "创作复迹",
        desc: "以思维导图串联创作节点，清晰复盘生成过程；支持导出与分享，让工作流更易交流。",
        media: FEATURE_MEDIA_SOURCES.creationTrace,
        alt: "TraceNest 创作复迹临时预览",
        chips: ["思维导图", "过程复盘", "导出分享"],
        icon: <Sparkles size={19} />,
      },
    ],
    [],
  );

  return (
    <section id="features" className="section features-section">
      <div className="container-wide">
        <SectionIntro
          title={
            <span className="semantic-title semantic-title-features">
              <span>
                让每一次 <span className="brand-gradient-text">AI 生成</span>，
              </span>
              <span>
                都能被<span className="brand-gradient-text">整理、回看与分享</span>
              </span>
            </span>
          }
          desc="把分散的素材、Prompt 与生成结果串联起来，形成清晰、可回看的创作过程。"
        />
        <div className="feature-list">
          {features.map((feature, index) => (
            <FeatureBlock key={feature.eyebrow} feature={feature} reverse={index % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({
  feature,
  reverse,
}: {
  feature: {
    eyebrow: string;
    title: React.ReactNode;
    label: string;
    desc: string;
    media: MediaSource;
    alt: string;
    chips: string[];
    icon: React.ReactNode;
  };
  reverse: boolean;
}) {
  return (
    <motion.article
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.22 }}
      variants={fadeUp}
      transition={{ duration: 0.5 }}
      className={`feature-block ${reverse ? "reverse" : ""}`}
    >
      <div className="feature-copy">
        <span className="feature-index">
          {feature.icon}
          {feature.eyebrow}
        </span>
        <h3>{feature.title}</h3>
        <p>{feature.desc}</p>
        <div className="feature-chip-row">
          {feature.chips.map((chip) => (
            <FeatureTag key={chip}>{chip}</FeatureTag>
          ))}
        </div>
      </div>
      <div className="feature-media">
        <FeatureMedia source={feature.media} alt={feature.alt} label={`${feature.eyebrow} ${feature.label}`} />
      </div>
    </motion.article>
  );
}

function SectionIntro({ title, desc }: { title: React.ReactNode; desc: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.35 }}
      variants={fadeUp}
      transition={{ duration: 0.5 }}
      className="section-intro"
    >
      <h2>{title}</h2>
      <p>{desc}</p>
    </motion.div>
  );
}

function FeatureTag({ children }: { children: React.ReactNode }) {
  return <span className="feature-tag">{children}</span>;
}

function LocalAndTheme({
  themeMode,
  setThemeMode,
}: {
  themeMode: "light" | "dark";
  setThemeMode: (mode: "light" | "dark") => void;
}) {
  const tags = ["界面色彩", "偏好记忆"];

  return (
    <section className="section local-theme-section">
      <div className="container-wide">
        <div className="local-theme-grid">
          <div className="local-theme-copy">
            <SectionIntro
              title="深浅模式，随工作习惯切换"
              desc="在浅色与深色界面间随时切换，并自动记住你的选择。"
            />
            <div className="trust-card-grid">
              {tags.map((tag) => (
                <FeatureTag key={tag}>
                  <Check size={16} />
                  {tag}
                </FeatureTag>
              ))}
            </div>
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className={`theme-panel ${themeMode}`}
          >
            <div className="theme-toggle" role="tablist" aria-label="选择主题展示">
              <button
                className={themeMode === "light" ? "active" : ""}
                onClick={() => setThemeMode("light")}
                role="tab"
                aria-selected={themeMode === "light"}
              >
                <Sun size={16} />
                浅色
              </button>
              <button
                className={themeMode === "dark" ? "active" : ""}
                onClick={() => setThemeMode("dark")}
                role="tab"
                aria-selected={themeMode === "dark"}
              >
                <Moon size={16} />
                深色
              </button>
            </div>
            <FeatureMedia
              source={{ poster: themeMode === "dark" ? detailScreenshot : mainScreenshot }}
              alt={`TraceNest ${themeMode === "dark" ? "深色" : "浅色"}模式临时展示`}
              label={themeMode === "dark" ? "深色模式预留媒体" : "浅色模式预留媒体"}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const items = [
    {
      q: "资源库可以迁移吗？",
      a: "可以。TraceNest 的资源库保存在本地，可以通过备份和迁移应用数据带到其他设备。目前暂不提供云端同步，迁移需要手动完成。",
    },
    {
      q: "当前支持什么系统？",
      a: "TraceNest 当前提供 Windows 版本，macOS 版本仍在规划中。",
    },
    {
      q: "OMG Design Lab 还有其他工具吗？",
      a: "除了 TraceNest，OMG Design Lab 还推出了字体管理工具「字仓 FontKeeper」，用于本地字体浏览、分类、版权标记与字体方案管理。",
      fontKeeperDownload: true,
    },
  ];

  return (
    <section id="faq" className="section faq-section">
      <div className="container-wide faq-grid">
        <SectionIntro title="FAQ" desc="关于资源库迁移、系统支持和 OMG Design Lab 其他工具的常见问题。" />
        <div className="faq-chat-list">
          {items.map((item, index) => (
            <article className={`faq-dialog ${index % 2 === 1 ? "shifted" : ""}`} key={item.q}>
              <div className="chat-bubble question">
                <span>Q</span>
                <p>{item.q}</p>
              </div>
              <div className="chat-bubble answer">
                <span>A</span>
                <div className="answer-content">
                  <p>{item.a}</p>
                  {item.fontKeeperDownload ? (
                    <a
                      className={`fontkeeper-download ${FONTKEEPER_DOWNLOAD_URL ? "" : "disabled"}`}
                      href={FONTKEEPER_DOWNLOAD_URL || undefined}
                      aria-label="下载字仓 FontKeeper Windows 版"
                      aria-disabled={!FONTKEEPER_DOWNLOAD_URL}
                      onClick={(event) => {
                        if (!FONTKEEPER_DOWNLOAD_URL) event.preventDefault();
                      }}
                    >
                      <Download size={15} />
                      <span>
                        {FONTKEEPER_DOWNLOAD_URL ? "下载字仓 Windows 版" : "下载字仓 Windows 版（即将提供）"}
                      </span>
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactAndDownload({
  onFeedback,
  onDownload,
}: {
  onFeedback: () => void;
  onDownload: () => void;
}) {
  return (
    <>
      <section id="contact" className="contact-strip-section">
        <div className="container-wide contact-strip">
          <div className="contact-strip-copy">
            <h2 className="contact-title">
              <span className="brand-gradient-text">联系</span>
              <span>我们</span>
            </h2>
            <p>TraceNest 正处于内测阶段。遇到使用问题、有功能建议，或想分享你的创作流程，都欢迎告诉我们。每一条反馈都会帮助我们持续完善产品。</p>
          </div>
          <div className="contact-action-panel">
            <button className="secondary-button contact-feedback-button" onClick={onFeedback}>
              <SendIcon />
              提交反馈
            </button>
          </div>
        </div>
      </section>

      <section id="download" className="download-section">
        <div className="container-wide final-cta">
          <div className="final-cta-copy">
            <h2>TraceNest Windows 内测版</h2>
            <p className="beta-note cta-note">当前为内测版本，欢迎使用。</p>
          </div>
          <a
            href={TRACENEST_BETA_DOWNLOAD_URL || undefined}
            className="secondary-download-button"
            role={!TRACENEST_BETA_DOWNLOAD_URL ? "button" : undefined}
            tabIndex={!TRACENEST_BETA_DOWNLOAD_URL ? 0 : undefined}
            aria-label="下载 TraceNest Windows 内测版"
            aria-disabled={!TRACENEST_BETA_DOWNLOAD_URL}
            onClick={(event) => {
              if (!TRACENEST_BETA_DOWNLOAD_URL) event.preventDefault();
              onDownload();
            }}
            onKeyDown={(event) => {
              if (TRACENEST_BETA_DOWNLOAD_URL) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onDownload();
              }
            }}
          >
            <Download size={17} strokeWidth={2.2} />
            <span>下载 Windows 版</span>
          </a>
        </div>
      </section>
    </>
  );
}

function SendIcon() {
  return <MessageCircle size={22} />;
}

function Footer({
  onPrivacy,
  onUpdates,
}: {
  onPrivacy: () => void;
  onUpdates: () => void;
}) {
  return (
    <footer className="site-footer">
      <div className="container-wide footer-grid">
        <div>
          <h3>图迹 TraceNest</h3>
          <p>AI 视觉创作整理工具</p>
        </div>
        <FooterColumn title="产品" links={[["首页", "#home"], ["功能", "#features"], ["下载", "#download"]]} />
        <FooterColumn
          title="支持"
          links={[["FAQ", "#faq"], ["联系我们", "#contact"]]}
        />
        <FooterColumn
          title="关于"
          links={[["关于我们", "#about"], ["隐私说明", onPrivacy], ["更新记录", onUpdates]]}
        />
      </div>
      <div className="footer-bottom">© 2026 OMG Design Lab. All rights reserved.</div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string | (() => void)]>;
}) {
  return (
    <div className="footer-column">
      <h4 className="footer-column__title">{title}</h4>
      <div className="footer-column__links">
        {links.map(([label, target]) =>
          typeof target === "string" ? (
            <a className="footer-column__link" key={label} href={target}>
              {label}
            </a>
          ) : (
            <button className="footer-column__link" key={label} onClick={target}>
              {label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function ContactModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FeedbackData) => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    onSubmit({
      type: String(formData.get("type") || "使用问题"),
      description: String(formData.get("description") || ""),
      systemVersion: String(formData.get("systemVersion") || ""),
      contact: String(formData.get("contact") || ""),
    });

    form.reset();
  };

  return (
    <ModalFrame open={open} onClose={onClose}>
      <form className="modal-card" onSubmit={handleSubmit}>
        <div className="modal-head">
          <div>
            <h2>提交反馈</h2>
            <p>告诉我们你遇到的问题或建议，联系方式可选。</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <label>
          问题类型
          <select name="type">
            <option>使用问题</option>
            <option>功能建议</option>
            <option>其他</option>
          </select>
        </label>
        <label>
          问题描述
          <textarea name="description" rows={4} required placeholder="描述采集、整理或复迹中遇到的问题" />
        </label>
        <label>
          系统版本
          <input name="systemVersion" placeholder="例如 Windows 11" />
        </label>
        <label>
          联系方式，可选
          <input name="contact" placeholder="邮箱或微信" />
        </label>
        <button className="modal-submit" type="submit">
          发送反馈
        </button>
      </form>
    </ModalFrame>
  );
}

function InfoModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <ModalFrame open={open} onClose={onClose}>
      <div className="modal-card info-modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <p>{children}</p>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({
  open,
  children,
  onClose,
}: {
  open: boolean;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="modal-backdrop" onClick={onClose} aria-label="关闭弹窗" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="modal-positioner"
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="toast"
        >
          <ShieldCheck size={17} />
          {toast.message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default App;
