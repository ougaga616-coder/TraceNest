import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Blocks,
  Clipboard,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Link2,
  Menu,
  Moon,
  MousePointer2,
  Network,
  Send,
  Sparkles,
  Sun,
  Tag,
  X,
} from "lucide-react";
import traceNestLogo from "./assets/tracenest-logo.png";

const DOWNLOAD_URL = "#download-placeholder";
const FONTKEEPER_URL = "#fontkeeper-download-placeholder";

const navItems = [
  { label: "首页", href: "#home" },
  { label: "功能", href: "#features" },
  { label: "FAQ", href: "#faq" },
  { label: "联系我们", href: "#contact" },
  { label: "下载", href: "#download" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
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
  // 推荐链路：官网表单 -> 自己的后端 / serverless 接口 -> 飞书多维表格或飞书文档 -> 自动新增反馈记录。
}

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [themeSplit, setThemeSplit] = useState(50);

  const showToast = (message: string) => {
    const nextToast = { id: Date.now(), message };
    setToast(nextToast);
    window.setTimeout(() => {
      setToast((current) => (current?.id === nextToast.id ? null : current));
    }, 2600);
  };

  const onDownload = () => {
    showToast("Windows 内测试用版下载即将开始。");
  };

  const onFeedbackSubmit = (formData: FeedbackData) => {
    submitFeedback(formData);
    setContactOpen(false);
    showToast("感谢反馈，我们已收到你的信息。");
  };

  return (
    <div className="site-shell text-ink-900">
      <AmbientBackground />
      <Header mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main>
        <Hero onDownload={onDownload} />
        <Features />
        <ThemeShowcase themeSplit={themeSplit} setThemeSplit={setThemeSplit} />
        <FAQ />
        <Contact onOpen={() => setContactOpen(true)} />
        <DownloadSection onDownload={onDownload} />
      </main>

      <Footer
        aboutOpen={aboutOpen}
        setAboutOpen={setAboutOpen}
        onCredits={() => setCreditsOpen(true)}
        onPrivacy={() => setPrivacyOpen(true)}
      />

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} onSubmit={onFeedbackSubmit} />
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <InfoModal open={privacyOpen} title="隐私说明" onClose={() => setPrivacyOpen(false)}>
        TraceNest 当前为本地工具，不会主动上传图片、Prompt、垫图和创作复迹。用户内容默认保存在本机。
      </InfoModal>
      <Toast toast={toast} />
    </div>
  );
}

function Header({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const handleNav = () => setMobileOpen(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-4">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-white/70 bg-white/74 px-4 py-3 shadow-[0_12px_34px_rgba(73,116,156,0.10)] backdrop-blur-xl md:px-6">
        <a href="#home" className="flex items-center gap-3" onClick={handleNav}>
          <span className="brand-mark">
            <TraceNestLogo className="brand-logo" />
          </span>
          <span className="text-sm font-semibold tracking-[0.02em] text-ink-900 md:text-base">
            图迹 TraceNest
          </span>
        </a>

        <div className="hidden items-center gap-7 text-sm text-ink-700 md:flex">
          {navItems.map((item) => (
            <a key={item.href} className="nav-link" href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <button
          className="icon-button md:hidden"
          aria-label="打开导航"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-2 grid max-w-6xl gap-1 rounded-3xl border border-white/70 bg-white/88 p-3 shadow-panel backdrop-blur-xl md:hidden"
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"
                href={item.href}
                onClick={handleNav}
              >
                {item.label}
              </a>
            ))}
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
    <section id="home" className="hero-section section-pad relative overflow-visible">
      <div className="hero-orbs" aria-hidden="true">
        <span className="hero-blob hero-blob-blue" />
        <span className="hero-blob hero-blob-warm" />
        <span className="hero-blob hero-blob-purple" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
        <motion.h1
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.02 }}
          className="max-w-4xl text-balance text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl md:text-6xl"
        >
          整理 <span className="accent-text">AI 视觉创作</span>过程
          <span className="block">让生成<span className="accent-text">有迹可循</span></span>
        </motion.h1>
        <motion.p
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-3xl text-pretty text-base leading-8 text-ink-500 md:text-lg"
        >
          图迹 TraceNest 帮助你整理主图、垫图、Prompt、模型标签和创作复盘内容，让 AI
          视觉生成过程更清晰，更容易回看与分享。
        </motion.p>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.6, delay: 0.16 }}
          className="mt-8 flex flex-col items-center"
        >
          <DownloadButton onClick={onDownload}>下载 Windows 版</DownloadButton>
          <p className="mt-3 text-sm text-ink-500">当前为内测试用版，欢迎体验并反馈问题</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.72, delay: 0.24, ease: "easeOut" }}
          className="relative mt-10 w-full"
        >
          <div className="demo-glow" />
          <AppDemo />
        </motion.div>
      </div>
    </section>
  );
}

function DownloadButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <a
      href={DOWNLOAD_URL}
      className="glow-download-button"
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      <span className="glow-download-button__edge" aria-hidden="true" />
      <span className="glow-download-button__core">
        <Download size={18} strokeWidth={2.2} />
        <span className="glow-download-button__label">{children}</span>
      </span>
    </a>
  );
}

function AppDemo() {
  return (
    <div className="app-demo mx-auto max-w-6xl">
      <div className="app-topbar">
        <div className="traffic">
          <span />
          <span />
          <span />
        </div>
        <div className="top-search">搜索作品、Prompt、模型标签</div>
        <div className="top-chip">资源库 · Local</div>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[210px_minmax(0,1fr)_260px] md:p-5">
        <aside className="demo-panel hidden md:block">
          <div className="panel-title">
            <FolderOpen size={15} />
            素材库
          </div>
          {["广告主图", "角色设定", "垫图参考", "产品视觉", "复盘节点"].map((item, index) => (
            <div key={item} className={`library-row ${index === 0 ? "active" : ""}`}>
              <span />
              {item}
            </div>
          ))}
          <div className="mt-5 rounded-2xl bg-brand-50/80 p-3">
            <p className="text-xs font-medium text-ink-700">模型标签</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["MJ", "SDXL", "FLUX"].map((tag) => (
                <span key={tag} className="mini-tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <section className="demo-panel min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <div className="panel-title">
              <ImageIcon size={15} />
              作品卡片
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs text-ink-500 shadow-sm">
              12 张图
            </span>
          </div>
          <div className="work-grid">
            <VisualTile tone="blue" title="透明耳机主视觉" />
            <VisualTile tone="pink" title="玻璃香水海报" />
            <VisualTile tone="violet" title="冷光材质测试" />
            <VisualTile tone="warm" title="暖色空间草图" />
          </div>
        </section>

        <aside className="demo-panel">
          <div className="panel-title">
            <Blocks size={15} />
            详情面板
          </div>
          <div className="mt-4 aspect-[4/3] rounded-2xl bg-[linear-gradient(135deg,#dff5ff,#f5e7ff_55%,#fff1df)] p-3 shadow-inner">
            <div className="h-full rounded-xl border border-white/70 bg-white/35" />
          </div>
          <div className="mt-4 space-y-3">
            <DetailLine icon={<ImageIcon size={14} />} label="主图" value="hero-final.png" />
            <DetailLine icon={<Layers size={14} />} label="垫图" value="3 张参考图" />
            <DetailLine icon={<Tag size={14} />} label="模型" value="FLUX · Realistic" />
            <DetailLine icon={<Link2 size={14} />} label="来源" value="collection / campaign" />
          </div>
          <div className="mt-4 rounded-2xl bg-white/72 p-3 text-left text-xs leading-5 text-ink-500">
            Prompt: soft translucent material, clean product image, airy daylight, refined blue reflections
          </div>
        </aside>
      </div>
    </div>
  );
}

function VisualTile({ tone, title }: { tone: "blue" | "pink" | "violet" | "warm"; title: string }) {
  return (
    <div className="visual-tile">
      <div className={`visual-art ${tone}`}>
        <span className="floating-plate" />
      </div>
      <p>{title}</p>
    </div>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-brand-600">{icon}</span>
      <span className="w-10 text-ink-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-ink-700">{value}</span>
    </div>
  );
}

function Features() {
  const features = [
    {
      title: "完整记录 AI 生图流程",
      desc: "把主图、垫图、Prompt、模型标签和来源链接整理在同一个作品记录中，让每一次生成过程都能被回看。",
      demo: <RecordDemo />,
      reverse: false,
    },
    {
      title: "智能粘贴",
      desc: "复制 Prompt 文本或图片后回到 TraceNest，系统提供对应的整理入口，减少手动导入和重复复制操作。",
      demo: <PasteDemo />,
      reverse: true,
    },
    {
      title: "AI 视觉生成卡",
      desc: "将当前作品的主图、垫图、Prompt 和模型信息整理成一张图片，便于分享该图制作过程中所包含的完整内容。",
      demo: <ShareCardDemo />,
      reverse: false,
    },
    {
      title: "创作复迹",
      desc: "用节点画布整理生成思路、Prompt 调整、垫图关系和多轮生成过程，方便复盘 AI 视觉创作路径。",
      demo: <TraceCanvasDemo />,
      reverse: true,
    },
  ];

  return (
    <section id="features" className="section-pad section-tight relative">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-5xl text-center"
        >
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            让每一次 <span className="accent-text">AI 生成</span>，都能被
            <span className="accent-text">整理、回看与分享</span>
          </h2>
        </motion.div>

        <div className="feature-list mt-12">
          {features.map((feature, index) => (
            <FeatureBlock key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({
  feature,
  index,
}: {
  feature: { title: string; desc: string; demo: React.ReactNode; reverse: boolean };
  index: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.32 }}
      variants={fadeUp}
      transition={{ duration: 0.52, delay: index * 0.03 }}
      className={`feature-block ${feature.reverse ? "md:[&>.feature-demo]:order-first" : ""}`}
    >
      <div className="feature-copy">
        <span className="feature-number">{String(index + 1).padStart(2, "0")}</span>
        <h3>{renderFeatureTitle(index, feature.title)}</h3>
        <p>{feature.desc}</p>
      </div>
      <div className="feature-demo">{feature.demo}</div>
    </motion.div>
  );
}

function renderFeatureTitle(index: number, fallback: string) {
  if (index === 0) {
    return (
      <>
        完整记录 <span className="accent-text">AI 生图流程</span>
      </>
    );
  }

  if (index === 1) {
    return (
      <>
        <span className="accent-text">智能</span>粘贴
      </>
    );
  }

  if (index === 2) {
    return (
      <>
        <span className="accent-text">AI 视觉</span>生成卡
      </>
    );
  }

  if (index === 3) {
    return (
      <>
        创作<span className="accent-text">复迹</span>
      </>
    );
  }

  return fallback;
}

function RecordDemo() {
  return (
    <div className="feature-ui">
      <div className="record-layout">
        <div className="record-main" />
        <div className="record-side">
          <div className="small-preview" />
          <div className="small-preview warm" />
        </div>
      </div>
      <div className="prompt-box">
        soft daylight, refined blue-white material, transparent edges, studio composition
      </div>
      <div className="tag-row">
        {["FLUX", "产品主图", "透明材质", "来源链接"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function PasteDemo() {
  return (
    <div className="feature-ui paste-ui">
      <div className="clipboard-bubble">
        <Clipboard size={22} />
        <div>
          <p>检测到剪贴板内容</p>
          <span>Prompt 文本 · 421 字</span>
        </div>
      </div>
      <div className="paste-actions">
        <button>新建作品</button>
        <button>添加为垫图</button>
        <button>忽略</button>
      </div>
      <div className="paste-preview">
        <span />
        cinematic product photo, translucent acrylic, clean background...
      </div>
    </div>
  );
}

function ShareCardDemo() {
  return (
    <div className="feature-ui share-ui">
      <div className="share-dialog">
        <div className="share-preview">
          <div className="share-main" />
          <div className="share-meta">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="share-buttons">
          <button>复制为图片</button>
          <button>导出 PNG</button>
        </div>
      </div>
    </div>
  );
}

function TraceCanvasDemo() {
  return (
    <div className="feature-ui trace-ui">
      <svg className="node-lines" viewBox="0 0 520 280" aria-hidden="true">
        <path d="M120 80 C190 70 210 140 265 140" />
        <path d="M265 140 C330 140 330 72 405 88" />
        <path d="M265 140 C330 165 336 218 420 214" />
        <path d="M120 205 C185 196 212 165 265 140" />
      </svg>
      <NodeCard className="left-8 top-10" icon={<MousePointer2 size={15} />} title="思路节点" />
      <NodeCard className="left-[42%] top-[40%]" icon={<Clipboard size={15} />} title="Prompt 调整" />
      <NodeCard className="right-8 top-12" icon={<ImageIcon size={15} />} title="垫图关系" />
      <NodeCard className="bottom-9 right-6" icon={<Sparkles size={15} />} title="作品节点" />
      <NodeCard className="bottom-11 left-10" icon={<Network size={15} />} title="复盘记录" />
    </div>
  );
}

function NodeCard({
  className,
  icon,
  title,
}: {
  className: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className={`node-card ${className}`}>
      {icon}
      <span>{title}</span>
    </div>
  );
}

function ThemeShowcase({
  themeSplit,
  setThemeSplit,
}: {
  themeSplit: number;
  setThemeSplit: (value: number) => void;
}) {
  const handlePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const next = ((event.clientX - rect.left) / rect.width) * 100;
    setThemeSplit(Math.min(78, Math.max(22, next)));
  };

  return (
    <section className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
          className="mx-auto max-w-3xl text-center"
        >
          <h2 className="text-3xl font-semibold leading-tight md:text-5xl">
            <span className="accent-text">浅色与深色模式</span>，适应不同
            <span className="accent-text">创作场景</span>
          </h2>
          <p className="mt-5 text-base leading-8 text-ink-500">
            在明亮整理和沉浸复盘之间自由切换，让素材管理保持舒适清晰。
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="theme-comparison mt-10"
          onPointerMove={(event) => {
            if (event.buttons === 1) handlePointer(event);
          }}
          onClick={handlePointer}
        >
          <ThemeMock mode="dark" />
          <div className="theme-light-clip" style={{ width: `${themeSplit}%` }}>
            <ThemeMock mode="light" />
          </div>
          <div className="split-handle" style={{ left: `${themeSplit}%` }}>
            <span />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ThemeMock({ mode }: { mode: "light" | "dark" }) {
  const isDark = mode === "dark";
  return (
    <div className={`theme-mock ${isDark ? "dark-mode" : "light-mode"}`}>
      <div className="theme-header">
        <div className="flex items-center gap-2">
          {isDark ? <Moon size={17} /> : <Sun size={17} />}
          <span>{isDark ? "沉浸复盘" : "明亮整理"}</span>
        </div>
        <span>TraceNest</span>
      </div>
      <div className="theme-body">
        <div className="theme-sidebar">
          <span />
          <span />
          <span />
        </div>
        <div className="theme-board">
          <div />
          <div />
          <div />
        </div>
        <div className="theme-inspector">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  return (
    <section id="faq" className="section-pad faq-section relative">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[0.78fr_1.42fr]">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="text-4xl font-semibold">FAQ</h2>
          <p className="mt-5 max-w-sm leading-8 text-ink-500">
            关于本地存储、资源库迁移和系统支持的常见问题。
          </p>
        </motion.div>
        <div className="faq-thread">
          <FAQPair question="资源库可以迁移吗？">
            可以。更换电脑时，完整拷贝 TraceNest 本地资源库即可继续使用之前整理过的图片、Prompt、垫图和创作复迹。当前版本暂时不提供云端同步，内容默认保存在本机。
          </FAQPair>
          <FAQPair question="当前支持什么系统？">
            当前优先提供 Windows 内测试用版，macOS 版本计划中。
          </FAQPair>
          <FAQPair question="OMG Design Lab 还有其他工具吗？">
            除了图迹 TraceNest，OMG Design Lab 也提供面向设计师的本地字体管理与字体搭配工具「字仓 FontKeeper」。
            <a href={FONTKEEPER_URL} className="fontkeeper-link">
              字仓 FontKeeper · Windows 版下载
              <ArrowRight size={15} />
            </a>
          </FAQPair>
        </div>
      </div>
    </section>
  );
}

function FAQPair({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      variants={fadeUp}
      transition={{ duration: 0.48 }}
      className="faq-pair"
    >
      <div className="faq-message faq-question">
        <span>Q</span>
        <p>{question}</p>
      </div>
      <div className="faq-message faq-answer">
        <span>A</span>
        <p>{children}</p>
      </div>
    </motion.div>
  );
}

function Contact({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="contact" className="section-pad contact-section relative">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={fadeUp}
        transition={{ duration: 0.55 }}
        className="contact-band mx-auto max-w-6xl"
      >
        <div>
          <h2 className="text-3xl font-semibold md:text-4xl">联系<span className="accent-text">我们</span></h2>
          <p className="mt-4 max-w-2xl leading-8 text-ink-500">
            遇到问题、想提建议，或者希望收到回复，都可以通过表单联系。
          </p>
        </div>
        <button className="secondary-button" onClick={onOpen}>
          <Send size={17} />
          提交反馈
        </button>
      </motion.div>
    </section>
  );
}

function DownloadSection({ onDownload }: { onDownload: () => void }) {
  return (
    <section id="download" className="section-pad download-section relative">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={fadeUp}
        transition={{ duration: 0.55 }}
        className="download-band mx-auto max-w-6xl"
      >
        <DownloadIllustration />
        <div className="relative z-10 text-center">
          <h2 className="text-4xl font-semibold md:text-5xl">下载 <span className="accent-text">TraceNest</span></h2>
          <p className="mx-auto mt-5 max-w-2xl leading-8 text-ink-500">
            当前版本为 Windows 内测试用版，适合体验 TraceNest 的核心整理与复盘流程。
          </p>
          <div className="mt-8 flex flex-col items-center">
            <DownloadButton onClick={onDownload}>下载 Windows 版</DownloadButton>
            <p className="mt-3 text-sm text-ink-500">macOS 版本计划中</p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function DownloadIllustration() {
  return (
    <div className="download-illustration" aria-hidden="true">
      <div className="app-icon">
        <TraceNestLogo className="download-logo" />
      </div>
      <div className="illus-card image-card">
        <ImageIcon size={19} />
      </div>
      <div className="illus-card prompt-card">
        <Clipboard size={18} />
        <span />
        <span />
      </div>
      <svg viewBox="0 0 560 280">
        <path d="M160 110 C225 50 315 60 386 112" />
        <path d="M173 183 C250 230 329 224 412 172" />
      </svg>
    </div>
  );
}

function Footer({
  aboutOpen,
  setAboutOpen,
  onCredits,
  onPrivacy,
}: {
  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;
  onCredits: () => void;
  onPrivacy: () => void;
}) {
  return (
    <footer className="site-footer relative border-t border-brand-100/70 bg-white/62 px-5 py-12 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl">
        <div className="footer-grid">
          <div className="footer-brand">
            <h3 className="text-lg font-semibold">图迹 TraceNest</h3>
            <p className="mt-4 text-sm text-ink-500">AI 视觉创作整理工具</p>
          </div>
          <div className="footer-column">
            <button className="footer-link" onClick={() => setAboutOpen(!aboutOpen)}>
              关于我们
            </button>
            <button className="footer-link" onClick={onCredits}>
              特别鸣谢
            </button>
            <button className="footer-link" onClick={onPrivacy}>
              隐私说明
            </button>
            <AnimatePresence>
              {aboutOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="about-popover"
                >
                  <p>
                    OMG Design Lab 是一个由 AIGC 视觉设计师发起的设计实验室，持续关注前沿 AI
                    设计趋势、AIGC 创作流程、设计工具化与创作效率问题。
                  </p>
                  <p>
                    我们尝试从真实的 AI 视觉创作过程出发，用 AI 与轻量工具，解决设计师在素材整理、Prompt
                    管理、生成复盘和经验沉淀中的真实问题。
                  </p>
                  <p>
                    目前 OMG Design Lab 有两款设计师工具：图迹 TraceNest 和字仓 FontKeeper。图迹用于整理 AI
                    视觉创作过程，字仓用于本地字体管理与字体搭配，目前处于内测阶段。
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
        <div className="footer-bottom">© 2026 OMG Design Lab</div>
      </div>
    </footer>
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
        <ModalClose onClose={onClose} />
        <h3>提交反馈</h3>
        <p className="modal-desc">告诉我们你遇到的问题或建议，联系方式可选。</p>
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
          <textarea name="description" rows={5} placeholder="请描述你的问题或建议" required />
        </label>
        <label>
          系统版本
          <input name="systemVersion" placeholder="例如 Windows 11 23H2" />
        </label>
        <label>
          联系方式，可选
          <input name="contact" placeholder="邮箱、微信或其他联系方式" />
        </label>
        <button className="modal-submit" type="submit">
          发送反馈
        </button>
      </form>
    </ModalFrame>
  );
}

function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = [
    { title: "内测反馈", names: ["Aster", "Lightsea", "Mia", "Zero"] },
    { title: "体验建议", names: ["Harper", "Nora", "Cyan", "Theo"] },
    { title: "设计与产品建议", names: ["Lin", "River", "Yuki", "Orbit"] },
  ];

  return (
    <ModalFrame open={open} onClose={onClose}>
      <div className="modal-card credits-card">
        <ModalClose onClose={onClose} />
        <h3>特别鸣谢</h3>
        <p className="modal-desc">
          TraceNest 从内测试用版开始，收到了许多朋友的测试、反馈与建议。这些反馈帮助我们不断优化素材整理、Prompt
          管理、创作复迹和导出体验。在这里特别感谢所有参与测试与提出建议的朋友。
        </p>
        <div className="credits-grid">
          {groups.map((group) => (
            <div key={group.title}>
              <h4>{group.title}</h4>
              <div>
                {group.names.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
      <div className="modal-card">
        <ModalClose onClose={onClose} />
        <h3>{title}</h3>
        <p className="modal-desc">{children}</p>
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
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ModalClose({ onClose }: { onClose: () => void }) {
  return (
    <button className="modal-close" type="button" aria-label="关闭" onClick={onClose}>
      <X size={18} />
    </button>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          key={toast.id}
          className="toast"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          {toast.message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <span className="orb orb-blue" />
      <span className="orb orb-cyan" />
      <span className="orb orb-violet" />
      <span className="orb orb-pink" />
      <span className="orb orb-warm" />
      <span className="orb orb-peach" />
    </div>
  );
}

export default App;
