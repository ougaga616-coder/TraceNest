import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  GitBranch,
  Heart,
  HelpCircle,
  ImagePlus,
  Inbox,
  Link,
  Database,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { ClipboardEvent as ReactClipboardEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, WheelEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppTitlebar } from './components/AppTitlebar';
import { ClipboardPromptConfirm } from './components/ClipboardPromptConfirm';
import { PostImportInfoModal, type PostImportInfoPayload } from './components/PostImportInfoModal';
import { ShareCardModal } from './components/ShareCardModal';
import { Toast } from './components/Toast';
import { TraceNestLogo } from './components/TraceNestLogo';
import { TraceCanvas } from './features/traces/TraceCanvas';
import { TraceList } from './features/traces/TraceList';
import { fallbackTraceApi } from './features/traces/traceStorage';
import { createImageNode, createTextNode, createTrace, createTraceEdge, createWorkNode, deleteTraceEdge, deleteTraceNode, emptyTraceData, moveTraceNode, nextDefaultTraceTitle, renameTrace, toggleTraceTextNodeCollapsed, updateTraceTextNode, type CreativeTrace, type ImageTraceNode, type TextTraceNode, type TraceData } from './features/traces/traceTypes';
import { useSmartClipboard } from './hooks/useSmartClipboard';
import type { PicFlowCase, PicFlowClipboardApi, PicFlowCollection, PicFlowData, PicFlowImage, PicFlowLibraryApi, PicFlowLibraryState } from './types';
import { resolveWorkImageSrc } from './utils/imageDisplay';
import { buildWorkSummaryText, copyTextToClipboard, formatModelTagsForCopy } from './utils/workCopy';
import { filterWorksByQuery } from './utils/workSearch';
import { updateWork } from './utils/workUpdates';

type ViewKey = 'all' | 'pending' | 'favorites' | 'trash' | 'traces' | `collection:${string}`;
type TraceHistory = {
  undo: CreativeTrace[];
  redo: CreativeTrace[];
};
type ClipboardImageRequest = {
  dataUrl: string;
  hash: string;
  width: number;
  height: number;
};
type ConfirmState =
  | { type: 'case'; id: string; title: string }
  | { type: 'collection'; id: string; name: string; hasContents?: boolean }
  | { type: 'permanent-case'; id: string; title: string }
  | { type: 'permanent-collection'; id: string; name: string }
  | { type: 'trace'; id: string; title: string }
  | { type: 'clear-guides'; caseId: string; title: string }
  | { type: 'replace-main'; caseId: string; images: PicFlowImage[] }
  | { type: 'move-work'; workId: string; fromCollectionName: string; toCollectionId?: string; toCollectionName: string }
  | { type: 'reset-test-data' }
  | null;

const emptyData: PicFlowData = { version: 1, cases: [], collections: [], settings: { theme: 'light', cardScale: 1.12 } };
const modelPresets = ['Nano banana', 'Nano banana Pro', 'GPT Image', 'Midjourney', 'Stable Diffusion', '即梦', '可灵', 'Libli'];
const minCardScale = 0.78;
const maxCardScale = 1.45;
const traceHistoryLimit = 50;
const emptyLibraryState: PicFlowLibraryState = { ready: false, setupRequired: true, missing: false, recentLibraries: [] };
const reservedSidebarCollectionNames = new Set(['回收站']);
const buildChannel = import.meta.env.VITE_TRACENEST_BUILD_CHANNEL;
const mentorPreviewBuild = buildChannel === 'mentor-preview';
const mentorPreviewExpiresAt = new Date(2026, 6, 22, 23, 59, 0).getTime();
const expiredPreviewMessage = '内测试用版已到期，如需继续体验，请联系提供者获取新的试用版本。';

const picflowApi = window.picflow ?? {
  loadData: async () => {
    const raw = localStorage.getItem('picflow-browser-preview');
    return raw ? (JSON.parse(raw) as PicFlowData) : emptyData;
  },
  saveData: async (data: PicFlowData) => {
    localStorage.setItem('picflow-browser-preview', JSON.stringify(data));
    return data;
  },
  loadTraces: fallbackTraceApi.loadTraces,
  saveTraces: fallbackTraceApi.saveTraces,
  saveTraceImagePaths: async () => [],
  saveTraceDataUrlImage: async (dataUrl: string, name?: string) => ({ imagePath: dataUrl, name }),
  getStorageInfo: async () => ({ dataPath: 'Electron 模式下保存到 LOCALAPPDATA', imageDir: 'Electron 模式下保存图片' }),
  selectImages: async () => [],
  getPathForFile: () => '',
  importImagePaths: async () => [],
  saveDataUrlImage: async (dataUrl: string, name?: string) => ({
    id: newId(),
    url: dataUrl,
    name: name ?? 'clipboard-image.png',
    type: 'screenshot' as const,
    addedAt: nowIso()
  }),
  saveUrlImage: async (url: string) => ({
    id: newId(),
    url,
    name: 'image-url',
    type: 'cover' as const,
    addedAt: nowIso()
  }),
  copyImage: async (image: PicFlowImage) => {
    const src = image.url ?? (image.localPath ? `file:///${image.localPath.replace(/\\/g, '/')}` : '');
    if (!src || !navigator.clipboard || !('ClipboardItem' in window)) return false;
    const response = await fetch(src);
    const blob = await response.blob();
    await navigator.clipboard.write([new (window as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem({ [blob.type]: blob })]);
    return true;
  },
  exportShareCardPng: async (dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'tracenest-share-card.png';
    link.click();
    return true;
  },
  copyShareCardPng: async (dataUrl: string) => {
    if (!navigator.clipboard || !('ClipboardItem' in window)) return false;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([new (window as unknown as { ClipboardItem: typeof ClipboardItem }).ClipboardItem({ [blob.type]: blob })]);
    return true;
  },
  openExternal: async (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

const picflowWindow = window.picflowWindow ?? {
  minimize: async () => undefined,
  toggleMaximize: async () => undefined,
  close: async () => undefined
};

const picflowClipboard: PicFlowClipboardApi | undefined = window.picflowClipboard ?? (
  navigator.clipboard
    ? {
        readText: () => navigator.clipboard.readText()
      }
    : undefined
);

const fallbackPicflowLibrary: PicFlowLibraryApi = {
  loadCurrentData: async () => {
    const data = await picflowApi.loadData();
    const state = await fallbackPicflowLibrary.getCurrentLibrary();
    return {
      ok: true,
      state,
      data,
      debug: {
        currentLibraryPath: '',
        worksPath: 'browser-preview/works.json',
        collectionsPath: 'browser-preview/collections.json',
        settingsPath: 'browser-preview/settings.json',
        worksCount: data.cases.length,
        collectionsCount: data.collections.length
      }
    };
  },
  getCurrentLibrary: async () => ({ ready: true, setupRequired: false, missing: false, currentLibrary: { name: '浏览器预览', path: '', lastOpenedAt: nowIso() }, recentLibraries: [] }),
  setupDefaultLibrary: async () => ({ ok: true, message: '已创建默认资源库' }),
  chooseCustomLibrary: async () => ({ ok: false, message: '桌面应用中可选择自定义位置' }),
  createLibrary: async () => ({ ok: false, message: '创建资源库功能开发中' }),
  addLibrary: async () => ({ ok: false, message: '添加资源库功能开发中' }),
  openLibraryLocation: async () => ({ ok: false, message: '暂未找到资源库位置' }),
  switchLibrary: async () => ({ ok: false, message: '资源库不存在或无效' }),
  resetTestData: async () => ({ ok: false, message: '桌面应用中可重置测试数据' })
};

const picflowLibrary = window.picflowLibrary ?? fallbackPicflowLibrary;

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function createCase(partial: Partial<PicFlowCase> = {}): PicFlowCase {
  const timestamp = nowIso();
  const images = partial.images ?? [];
  return {
    id: partial.id ?? newId(),
    title: partial.title ?? '',
    status: partial.status ?? 'pending',
    images,
    referenceImages: partial.referenceImages ?? [],
    coverImageId: partial.coverImageId ?? images[0]?.id,
    favorite: partial.favorite ?? false,
    hidden: partial.hidden ?? false,
    collectionId: partial.collectionId,
    modelTags: partial.modelTags ?? [],
    sourceUrl: partial.sourceUrl ?? '',
    captureMethod: partial.captureMethod ?? 'manual',
    capturedAt: partial.capturedAt ?? timestamp,
    createdAt: partial.createdAt ?? timestamp,
    updatedAt: partial.updatedAt ?? timestamp,
    prompt: partial.prompt ?? '',
    deletedAt: partial.deletedAt ?? null,
    deletedFromCollectionId: partial.deletedFromCollectionId ?? null
  };
}

function normalizeAppData(data: PicFlowData): PicFlowData {
  return {
    ...data,
    cases: (data.cases ?? []).map((item) => ({
      ...item,
      referenceImages: item.referenceImages ?? [],
      favorite: item.favorite ?? false,
      hidden: item.hidden ?? false,
      deletedAt: item.deletedAt ?? null,
      deletedFromCollectionId: item.deletedFromCollectionId ?? null
    })),
    collections: (data.collections ?? []).map((item) => ({
      ...item,
      parentId: item.parentId ?? null,
      deletedAt: item.deletedAt ?? null,
      deletedParentId: item.deletedParentId ?? null
    })),
    settings: { ...emptyData.settings, ...data.settings }
  };
}

function normalizeTraceDataForApp(data: TraceData): TraceData {
  return {
    traces: (data.traces ?? []).map((trace) => ({
      ...trace,
      nodes: (trace.nodes ?? []).map((node) => (node.type === 'text' ? { ...node, collapsed: node.collapsed ?? false } : node)),
      edges: trace.edges ?? []
    }))
  };
}

function imageSrc(image?: PicFlowImage, libraryPath?: string): string {
  return resolveWorkImageSrc(image, libraryPath);
}

function coverImage(item: PicFlowCase): PicFlowImage | undefined {
  return item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
}

function displayTitle(item: PicFlowCase): string {
  return item.title.trim() || '未命名作品';
}

function formatTime(value?: string): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function viewTitle(view: ViewKey, collections: PicFlowCollection[]): string {
  if (view === 'all') return '全部作品';
  if (view === 'pending') return '\u5f85\u6574\u7406';
  if (view === 'favorites') return '我的收藏';
  if (view === 'trash') return '回收站';
  if (view === 'traces') return '创作复迹';
  const collection = collections.find((item) => item.id === view.replace('collection:', ''));
  return collection?.name ?? '灵感图集';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
}

function isImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return /\.(png|jpe?g|webp|gif|bmp|avif)(\?.*)?$/i.test(trimmed);
}

function nextAfterDelete(cases: PicFlowCase[], deletedId: string): string | null {
  const index = cases.findIndex((item) => item.id === deletedId);
  const next = cases[index + 1] ?? cases[index - 1];
  return next?.id ?? null;
}

function cloneTrace(trace: CreativeTrace): CreativeTrace {
  return JSON.parse(JSON.stringify(trace)) as CreativeTrace;
}

function hashClipboardImage(dataUrl: string, width: number, height: number): string {
  return `${width}x${height}:${dataUrl.length}:${dataUrl.slice(0, 96)}:${dataUrl.slice(-96)}`;
}

export default function App(): JSX.Element {
  const [data, setData] = useState<PicFlowData>(emptyData);
  const [traceData, setTraceData] = useState<TraceData>(emptyTraceData);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [editingTraceId, setEditingTraceId] = useState<string | null>(null);
  const [editingTraceTitle, setEditingTraceTitle] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>('all');
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editingCollectionName, setEditingCollectionName] = useState('');
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<string[]>([]);
  const [collectionMenu, setCollectionMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [modelDraft, setModelDraft] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [cardScale, setCardScale] = useState(1.12);
  const [galleryDragging, setGalleryDragging] = useState(false);
  const [sidePanelsCollapsed, setSidePanelsCollapsed] = useState(() => localStorage.getItem('picflow.sidePanelsCollapsed') === 'true');
  const [libraryMenuOpen, setLibraryMenuOpen] = useState(false);
  const [libraryMenuPosition, setLibraryMenuPosition] = useState({ top: 0, right: 12 });
  const [libraryState, setLibraryState] = useState<PicFlowLibraryState>(emptyLibraryState);
  const [libraryRefreshing, setLibraryRefreshing] = useState(false);
  const [cutWorkId, setCutWorkId] = useState<string | null>(null);
  const [postImportCaseId, setPostImportCaseId] = useState<string | null>(null);
  const [clipboardImportDraft, setClipboardImportDraft] = useState<PicFlowCase | null>(null);
  const [shareCardCaseId, setShareCardCaseId] = useState<string | null>(null);
  const [clipboardImageRequest, setClipboardImageRequest] = useState<ClipboardImageRequest | null>(null);
  const [expiryDialogOpen, setExpiryDialogOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const libraryButtonRef = useRef<HTMLButtonElement | null>(null);
  const suppressSaveRef = useRef(false);
  const traceHistoryRef = useRef(new Map<string, TraceHistory>());
  const dismissedClipboardImageHashRef = useRef<string | null>(null);
  const handledClipboardImageHashRef = useRef<string | null>(null);
  const suggestedClipboardImageHashRef = useRef<string | null>(null);
  const readingClipboardImageRef = useRef(false);
  const previewReadOnly = mentorPreviewBuild && nowTick > mentorPreviewExpiresAt;

  function isPreviewExpiredNow(): boolean {
    return mentorPreviewBuild && Date.now() > mentorPreviewExpiresAt;
  }

  function canUseWriteFeatures(): boolean {
    if (!isPreviewExpiredNow()) return true;
    setNowTick(Date.now());
    setExpiryDialogOpen(true);
    return false;
  }

  useEffect(() => {
    void loadCurrentLibraryDataAndApply('startup');
  }, []);

  useEffect(() => {
    if (!mentorPreviewBuild) return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!previewReadOnly) return;
    setShareCardCaseId(null);
    setClipboardImageRequest(null);
    setCutWorkId(null);
  }, [previewReadOnly]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    if (!loaded) return;
    setData((current) => ({ ...current, settings: { ...current.settings, theme: darkMode ? 'dark' : 'light' } }));
  }, [darkMode]);

  useEffect(() => {
    if (!loaded) return;
    setData((current) => ({ ...current, settings: { ...current.settings, cardScale } }));
  }, [cardScale]);

  useEffect(() => {
    localStorage.setItem('picflow.sidePanelsCollapsed', String(sidePanelsCollapsed));
  }, [sidePanelsCollapsed]);

  useEffect(() => {
    traceHistoryRef.current.clear();
  }, [libraryState.currentLibrary?.path]);

  useEffect(() => {
    if (!libraryMenuOpen) return;
    const updatePosition = () => updateLibraryMenuPosition();
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [libraryMenuOpen]);

  useEffect(() => {
    if (!loaded) return;
    if (!libraryState.ready) return;
    if (suppressSaveRef.current) return;
    const timer = window.setTimeout(() => {
      void picflowApi.saveData(data);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data, loaded, libraryState.ready]);

  useEffect(() => {
    if (!loaded) return;
    if (!libraryState.ready) return;
    if (suppressSaveRef.current) return;
    const timer = window.setTimeout(() => {
      void picflowApi.saveTraces(traceData);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [traceData, loaded, libraryState.ready]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!loaded || !libraryState.ready || previewReadOnly || activeView === 'traces' || !picflowClipboard?.readImage) {
      setClipboardImageRequest(null);
      return;
    }
    if (confirmState || postImportCaseId || clipboardImportDraft || shareCardCaseId || libraryMenuOpen || cutWorkId) return;

    let timer = 0;
    let disposed = false;
    const detectImageClipboard = async () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (disposed || readingClipboardImageRef.current) return;
        if (isTextEditingTarget(document.activeElement)) return;
        readingClipboardImageRef.current = true;
        try {
          const image = await picflowClipboard.readImage?.();
          if (!image) {
            setClipboardImageRequest(null);
            return;
          }
          const hash = hashClipboardImage(image.dataUrl, image.width, image.height);
          if (
            hash === dismissedClipboardImageHashRef.current ||
            hash === handledClipboardImageHashRef.current
          ) {
            return;
          }
          suggestedClipboardImageHashRef.current = hash;
          setClipboardImageRequest({ ...image, hash });
        } finally {
          readingClipboardImageRef.current = false;
        }
      }, 120);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void detectImageClipboard();
    };
    const removeAppFocusListener = picflowClipboard.onAppFocus?.(() => void detectImageClipboard());
    window.addEventListener('focus', detectImageClipboard);
    document.addEventListener('visibilitychange', onVisibilityChange);
    void detectImageClipboard();

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', detectImageClipboard);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      removeAppFocusListener?.();
    };
  }, [activeView, clipboardImportDraft, confirmState, cutWorkId, libraryMenuOpen, libraryState.ready, loaded, postImportCaseId, previewReadOnly, shareCardCaseId]);

  useEffect(() => {
    const onPaste = async (event: globalThis.ClipboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      if (activeView === 'traces') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-guide-dropzone="true"]')) return;
      if (postImportCaseId || clipboardImportDraft) return;
      if (cutWorkId) {
        event.preventDefault();
        if (!canUseWriteFeatures()) return;
        pasteCutWorkToCurrentCollection();
        return;
      }
      const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
      if (!imageFile) return;
      if (!canUseWriteFeatures()) {
        event.preventDefault();
        return;
      }
      if (!ensureLibraryReady()) return;
      event.preventDefault();
      try {
      const dataUrl = await fileToDataUrl(imageFile);
        const image = await picflowApi.saveDataUrlImage(dataUrl, imageFile.name || 'clipboard-image.png');
        appendWork(createCase({ images: [image], captureMethod: 'clipboard-paste' }), { openPostImportModal: true });
        void markCurrentClipboardImageHandled();
        setToast('\u5df2\u4ece\u526a\u8d34\u677f\u5bfc\u5165\u56fe\u7247');
      } catch {
        setToast('\u56fe\u7247\u4fdd\u5b58\u5931\u8d25');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeView, clipboardImportDraft, cutWorkId, data.cases, data.collections, libraryState.ready, postImportCaseId, previewReadOnly]);

  const selectedCase = data.cases.find((item) => item.id === selectedId) ?? null;
  const smartClipboard = useSmartClipboard({
    enabled: libraryState.ready && !previewReadOnly,
    selectedWork: selectedCase,
    modalOpen: Boolean(confirmState || postImportCaseId || clipboardImportDraft || shareCardCaseId || libraryMenuOpen || clipboardImageRequest),
    movingWork: Boolean(cutWorkId),
    clipboardApi: picflowClipboard,
    onReadError: () => setToast('\u65e0\u6cd5\u8bfb\u53d6\u526a\u8d34\u677f')
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target)) return;
      if (postImportCaseId || clipboardImportDraft) return;
      if (event.ctrlKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        if (!canUseWriteFeatures()) return;
        if (!selectedCase) {
          setToast('\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u4f5c\u54c1');
          return;
        }
        setCutWorkId(selectedCase.id);
        setToast('\u5df2\u526a\u5207\u4f5c\u54c1\uff0c\u8bf7\u8fdb\u5165\u76ee\u6807\u56fe\u96c6\u540e\u7c98\u8d34');
        return;
      }
      if (event.key !== 'Delete' || !selectedCase) return;
      event.preventDefault();
      if (!canUseWriteFeatures()) return;
      requestConfirm({ type: 'case', id: selectedCase.id, title: displayTitle(selectedCase) });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clipboardImportDraft, postImportCaseId, previewReadOnly, selectedCase]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-model-combobox="true"]')) setModelOpen(false);
      if (!target?.closest('[data-library-menu="true"]')) setLibraryMenuOpen(false);
      if (!target?.closest('[data-collection-menu="true"]')) setCollectionMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const counts = useMemo(
    () => ({
      all: data.cases.filter((item) => !item.deletedAt).length,
      pending: data.cases.filter((item) => !item.deletedAt && item.status === 'pending').length,
      favorites: data.cases.filter((item) => !item.deletedAt && item.favorite).length
    }),
    [data.cases]
  );

  const visibleCases = useMemo(() => {
    let scoped = activeView === 'trash' ? data.cases.filter((item) => item.deletedAt) : data.cases.filter((item) => !item.deletedAt);
    if (activeView === 'pending') scoped = scoped.filter((item) => item.status === 'pending');
    if (activeView === 'favorites') scoped = scoped.filter((item) => item.favorite);
    if (activeView === 'all') scoped = data.cases.filter((item) => !item.deletedAt);
    if (activeView.startsWith('collection:')) {
      const collectionId = activeView.replace('collection:', '');
      scoped = scoped.filter((item) => item.collectionId === collectionId);
    }
    if (search.trim()) return filterWorksByQuery(scoped, search);
    return scoped;
  }, [activeView, data.cases, search]);

  useEffect(() => {
    if (!selectedId) return;
    if (!visibleCases.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [selectedId, visibleCases]);

  const visibleSelectedCase = selectedId ? visibleCases.find((item) => item.id === selectedId) ?? null : null;
  const postImportCase = postImportCaseId ? data.cases.find((item) => item.id === postImportCaseId) ?? null : null;
  const shareCardCase = shareCardCaseId ? data.cases.find((item) => item.id === shareCardCaseId) ?? null : null;
  const visibleRecentLibraries = useMemo(() => {
    const seen = new Set<string>();
    const currentPath = libraryState.currentLibrary?.path;
    return libraryState.recentLibraries.filter((item) => {
      if (!item.path || item.path === currentPath || seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    });
  }, [libraryState.currentLibrary?.path, libraryState.recentLibraries]);
  const selectedTrace = selectedTraceId ? traceData.traces.find((trace) => trace.id === selectedTraceId) ?? null : null;

  function isTextEditingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    return Boolean(
      element?.matches('input, textarea, select') ||
        element?.closest('[contenteditable="true"]') ||
        element?.closest('[role="dialog"]')
    );
  }

  function ensureLibraryReady(): boolean {
    if (libraryState.ready) return true;
    setToast('请先设置资源库');
    return false;
  }

  async function loadCurrentLibraryDataAndApply(
    reason: 'startup' | 'switch' | 'refresh',
    options: { resetView?: boolean; keepSelection?: boolean } = { resetView: true }
  ): Promise<boolean> {
    if (reason === 'refresh') console.info('[library refresh] clicked');

    const result = await picflowLibrary.loadCurrentData();
    const debug = result.debug;
    const prefix = reason === 'switch' ? '[library switch]' : reason === 'refresh' ? '[library refresh]' : '[library startup]';

    if (debug) {
      console.info(`${prefix} currentLibraryPath:`, debug.currentLibraryPath);
      if (reason === 'refresh') {
        console.info('[library refresh] works path:', debug.worksPath);
        console.info('[library refresh] collections path:', debug.collectionsPath);
      }
      console.info(`${prefix} works count:`, debug.worksCount);
      console.info(`${prefix} collections count:`, debug.collectionsCount);
    }

    setLibraryState(result.state);
    if (!result.ok || !result.state.ready || !result.data) {
      if (reason !== 'startup') setToast(result.message ?? '资源库数据读取失败');
      if (!result.state.ready) {
        suppressSaveRef.current = true;
        setData(emptyData);
        setTraceData(emptyTraceData);
        setSelectedTraceId(null);
        setSelectedId(null);
        window.setTimeout(() => {
          suppressSaveRef.current = false;
        }, 300);
      }
      setLoaded(true);
      return false;
    }

    if (reason === 'refresh') console.info('[library refresh] applying state...');
    suppressSaveRef.current = true;
    const nextData = normalizeAppData(result.data);
    const nextTraceData = normalizeTraceDataForApp(await picflowApi.loadTraces());
    setData(nextData);
    setTraceData(nextTraceData);
    setDarkMode(nextData.settings?.theme === 'dark');
    setCardScale(nextData.settings?.cardScale ?? 1.12);
    setSelectedId((current) => {
      if (options.keepSelection && current && nextData.cases.some((item) => item.id === current)) return current;
      return null;
    });
    if (options.resetView !== false) {
      setActiveView('all');
      setSearch('');
      setSelectedTraceId(null);
    } else {
      setActiveView((current) => {
        if (!current.startsWith('collection:')) return current;
        const collectionId = current.replace('collection:', '');
        return nextData.collections.some((item) => item.id === collectionId && !item.deletedAt) ? current : 'all';
      });
    }
    setLoaded(true);
    window.setTimeout(() => {
      suppressSaveRef.current = false;
    }, 300);
    if (reason === 'refresh') console.info('[library refresh] done');
    if (reason === 'switch') console.info('[library switch] state applied');
    return true;
  }

  function persist(nextData: PicFlowData): void {
    setData(nextData);
    void picflowApi.saveData(nextData);
  }

  function persistTraces(nextData: TraceData): void {
    setTraceData(nextData);
    void picflowApi.saveTraces(nextData);
  }

  function traceHistory(traceId: string): TraceHistory {
    const existing = traceHistoryRef.current.get(traceId);
    if (existing) return existing;
    const next = { undo: [], redo: [] };
    traceHistoryRef.current.set(traceId, next);
    return next;
  }

  function pushTraceUndo(trace: CreativeTrace): void {
    const history = traceHistory(trace.id);
    history.undo.push(cloneTrace(trace));
    if (history.undo.length > traceHistoryLimit) history.undo.shift();
    history.redo = [];
  }

  function commitSelectedTraceChange(updater: (trace: CreativeTrace) => CreativeTrace, options: { recordHistory?: boolean } = {}): CreativeTrace | null {
    if (!canUseWriteFeatures()) return null;
    if (!selectedTraceId) return null;
    const currentTrace = traceData.traces.find((trace) => trace.id === selectedTraceId);
    if (!currentTrace) return null;
    const nextTrace = updater(currentTrace);
    if (nextTrace === currentTrace || JSON.stringify(nextTrace) === JSON.stringify(currentTrace)) return currentTrace;
    if (options.recordHistory !== false) pushTraceUndo(currentTrace);
    persistTraces({
      traces: traceData.traces.map((trace) => (trace.id === selectedTraceId ? nextTrace : trace))
    });
    return nextTrace;
  }

  function restoreTraceSnapshot(traceId: string, snapshot: CreativeTrace): void {
    if (!canUseWriteFeatures()) return;
    persistTraces({
      traces: traceData.traces.map((trace) => (trace.id === traceId ? cloneTrace(snapshot) : trace))
    });
  }

  function undoSelectedTrace(): boolean {
    if (!canUseWriteFeatures()) return false;
    if (!selectedTraceId) return false;
    const currentTrace = traceData.traces.find((trace) => trace.id === selectedTraceId);
    if (!currentTrace) return false;
    const history = traceHistory(selectedTraceId);
    const previousTrace = history.undo.pop();
    if (!previousTrace) return false;
    history.redo.push(cloneTrace(currentTrace));
    if (history.redo.length > traceHistoryLimit) history.redo.shift();
    restoreTraceSnapshot(selectedTraceId, previousTrace);
    setToast('已撤回');
    return true;
  }

  function redoSelectedTrace(): boolean {
    if (!canUseWriteFeatures()) return false;
    if (!selectedTraceId) return false;
    const currentTrace = traceData.traces.find((trace) => trace.id === selectedTraceId);
    if (!currentTrace) return false;
    const history = traceHistory(selectedTraceId);
    const nextTrace = history.redo.pop();
    if (!nextTrace) return false;
    history.undo.push(cloneTrace(currentTrace));
    if (history.undo.length > traceHistoryLimit) history.undo.shift();
    restoreTraceSnapshot(selectedTraceId, nextTrace);
    setToast('已恢复');
    return true;
  }

  function openTraceModule(): void {
    setActiveView('traces');
    setSearch('');
    setSelectedId(null);
  }

  function createNewTrace(): void {
    if (!canUseWriteFeatures()) return;
    if (!ensureLibraryReady()) return;
    const trace = createTrace(nextDefaultTraceTitle(traceData.traces));
    const nextData = { traces: [trace, ...traceData.traces] };
    persistTraces(nextData);
    setSelectedTraceId(trace.id);
    setActiveView('traces');
    setToast('已新建');
  }

  function openTrace(id: string): void {
    setSelectedTraceId(id);
  }

  function backToTraceList(): void {
    setSelectedTraceId(null);
  }

  function startRenameTrace(trace: CreativeTrace): void {
    setEditingTraceId(trace.id);
    setEditingTraceTitle(trace.title);
  }

  function finishRenameTrace(id: string): void {
    if (!canUseWriteFeatures()) {
      cancelRenameTrace();
      return;
    }
    if (!editingTraceTitle.trim()) {
      cancelRenameTrace();
      return;
    }
    const nextData = {
      traces: traceData.traces.map((trace) => (trace.id === id ? renameTrace(trace, editingTraceTitle) : trace))
    };
    persistTraces(nextData);
    setEditingTraceId(null);
    setEditingTraceTitle('');
    setToast('已重命名');
  }

  function cancelRenameTrace(): void {
    setEditingTraceId(null);
    setEditingTraceTitle('');
  }

  function requestConfirm(state: NonNullable<ConfirmState>): void {
    if (!canUseWriteFeatures()) return;
    setConfirmState(state);
  }

  function renameSelectedTrace(title: string): void {
    if (!canUseWriteFeatures()) return;
    if (!selectedTraceId || !title.trim()) return;
    const nextData = {
      traces: traceData.traces.map((trace) => (trace.id === selectedTraceId ? renameTrace(trace, title) : trace))
    };
    persistTraces(nextData);
    setToast('已重命名');
  }

  function createTextNodeInSelectedTrace(x: number, y: number, text = '', width = 240, height = 120): string {
    if (!canUseWriteFeatures()) return '';
    const node = createTextNode(x, y, text, width, height);
    commitSelectedTraceChange((trace) => ({ ...trace, updatedAt: nowIso(), nodes: [...trace.nodes, node] }));
    return node.id;
  }

  function pasteTextNodeInSelectedTrace(source: Pick<TextTraceNode, 'text' | 'width' | 'height'>, x: number, y: number): string {
    if (!canUseWriteFeatures()) return '';
    const nodeId = createTextNodeInSelectedTrace(x, y, source.text, source.width, source.height);
    setToast('已粘贴');
    return nodeId;
  }

  function createImageNodeInSelectedTrace(asset: { imagePath: string; name?: string }, x: number, y: number): string {
    if (!canUseWriteFeatures()) return '';
    const node = createImageNode(x, y, asset.imagePath, asset.name);
    commitSelectedTraceChange((trace) => ({ ...trace, updatedAt: nowIso(), nodes: [...trace.nodes, node] }));
    return node.id;
  }

  function createWorkNodeInSelectedTrace(workId: string, x: number, y: number): string {
    if (!canUseWriteFeatures()) return '';
    const node = createWorkNode(x, y, workId);
    commitSelectedTraceChange((trace) => ({ ...trace, updatedAt: nowIso(), nodes: [...trace.nodes, node] }));
    setToast('已插入作品');
    return node.id;
  }

  async function createImageNodesInSelectedTrace(files: File[], x: number, y: number): Promise<string[]> {
    if (!canUseWriteFeatures()) return [];
    if (!selectedTraceId) return [];
    const imageFiles = files.filter(isImageFile);
    if (!imageFiles.length) {
      setToast('仅支持图片');
      return [];
    }

    const paths = imageFiles
      .map((file) => (picflowApi.getPathForFile?.(file) || (file as File & { path?: string }).path || '').trim())
      .filter((path): path is string => Boolean(path));

    try {
      const assets = paths.length === imageFiles.length
        ? await picflowApi.saveTraceImagePaths(paths)
        : await Promise.all(imageFiles.map(async (file) => picflowApi.saveTraceDataUrlImage(await fileToDataUrl(file), file.name || 'trace-image.png')));
      const nodes = assets.map((asset, index) => createImageNode(x + index * 28, y + index * 28, asset.imagePath, asset.name));
      commitSelectedTraceChange((trace) => ({ ...trace, updatedAt: nowIso(), nodes: [...trace.nodes, ...nodes] }));
      const ids = nodes.map((node) => node.id);
      setToast(assets.length > 1 ? `已添加 ${assets.length} 张图片` : '已添加图片');
      return ids;
    } catch {
      setToast('图片保存失败');
      return [];
    }
  }

  async function pasteImageNodeInSelectedTrace(file: File, x: number, y: number): Promise<string | null> {
    if (!canUseWriteFeatures()) return null;
    if (!selectedTraceId) return null;
    if (!isImageFile(file)) {
      setToast('仅支持图片');
      return null;
    }
    try {
      const asset = await picflowApi.saveTraceDataUrlImage(await fileToDataUrl(file), file.name || 'trace-image.png');
      const nodeId = createImageNodeInSelectedTrace(asset, x, y);
      setToast('已添加图片');
      return nodeId;
    } catch {
      setToast('图片保存失败');
      return null;
    }
  }

  function updateTextNodeInSelectedTrace(nodeId: string, text: string, options: { removeIfEmpty?: boolean } = {}): void {
    if (!canUseWriteFeatures()) return;
    commitSelectedTraceChange((trace) => {
        const currentNode = trace.nodes.find((node) => node.id === nodeId);
        if (!currentNode) return trace;
        if (options.removeIfEmpty && !text.trim()) {
          return { ...trace, updatedAt: nowIso(), nodes: trace.nodes.filter((node) => node.id !== nodeId) };
        }
        if (currentNode.type === 'text' && currentNode.text === text) return trace;
        return updateTraceTextNode(trace, nodeId, text);
      });
  }

  function toggleTextNodeCollapsedInSelectedTrace(nodeId: string): void {
    if (!canUseWriteFeatures()) return;
    commitSelectedTraceChange((trace) => toggleTraceTextNodeCollapsed(trace, nodeId));
  }

  function moveNodeInSelectedTrace(nodeId: string, x: number, y: number): void {
    if (!canUseWriteFeatures()) return;
    commitSelectedTraceChange((trace) => {
      const node = trace.nodes.find((item) => item.id === nodeId);
      if (!node || (node.x === x && node.y === y)) return trace;
      return moveTraceNode(trace, nodeId, x, y);
    });
  }

  function resizeTraceNodeInSelectedTrace(nodeId: string, width: number, height: number): void {
    if (!canUseWriteFeatures()) return;
    commitSelectedTraceChange((trace) => {
      const node = trace.nodes.find((item) => item.id === nodeId);
      if (!node || (node.type !== 'text' && node.type !== 'image' && node.type !== 'work') || (node.width === width && 'height' in node && node.height === height)) return trace;
      const timestamp = nowIso();
      return {
        ...trace,
        updatedAt: timestamp,
        nodes: trace.nodes.map((item) =>
          item.id === nodeId && (item.type === 'text' || item.type === 'image' || item.type === 'work')
            ? { ...item, width, height, updatedAt: timestamp }
            : item
        )
      };
    });
  }

  function deleteNodeInSelectedTrace(nodeId: string): void {
    if (!canUseWriteFeatures()) return;
    const nextTrace = commitSelectedTraceChange((trace) => (trace.nodes.some((node) => node.id === nodeId) ? deleteTraceNode(trace, nodeId) : trace));
    if (!nextTrace) return;
    setToast('已删除');
  }

  function moveNodesInSelectedTrace(positions: Array<{ id: string; x: number; y: number }>): void {
    if (!canUseWriteFeatures()) return;
    if (positions.length === 0) return;
    const nextPositions = new Map(positions.map((position) => [position.id, position]));
    commitSelectedTraceChange((trace) => {
      let changed = false;
      const timestamp = nowIso();
      const nodes = trace.nodes.map((node) => {
        const next = nextPositions.get(node.id);
        if (!next || (node.x === next.x && node.y === next.y)) return node;
        changed = true;
        return node.type === 'text' || node.type === 'image' || node.type === 'work'
          ? { ...node, x: next.x, y: next.y, updatedAt: timestamp }
          : { ...node, x: next.x, y: next.y };
      });
      return changed ? { ...trace, updatedAt: timestamp, nodes } : trace;
    });
  }

  function deleteNodesInSelectedTrace(nodeIds: string[]): void {
    if (!canUseWriteFeatures()) return;
    if (nodeIds.length === 0) return;
    const nodeIdSet = new Set(nodeIds);
    const nextTrace = commitSelectedTraceChange((trace) => {
      if (!trace.nodes.some((node) => nodeIdSet.has(node.id))) return trace;
      const timestamp = nowIso();
      return {
        ...trace,
        updatedAt: timestamp,
        nodes: trace.nodes.filter((node) => !nodeIdSet.has(node.id)),
        edges: trace.edges.filter((edge) => !nodeIdSet.has(edge.fromNodeId) && !nodeIdSet.has(edge.toNodeId))
      };
    });
    if (!nextTrace) return;
    setToast('已删除');
  }

  function createEdgeInSelectedTrace(fromNodeId: string, toNodeId: string): void {
    if (!canUseWriteFeatures()) return;
    commitSelectedTraceChange((trace) => createTraceEdge(trace, fromNodeId, toNodeId));
  }

  function deleteEdgeInSelectedTrace(edgeId: string): void {
    if (!canUseWriteFeatures()) return;
    const nextTrace = commitSelectedTraceChange((trace) => (trace.edges.some((edge) => edge.id === edgeId) ? deleteTraceEdge(trace, edgeId) : trace));
    if (!nextTrace) return;
    setToast('已删除');
  }

  async function exportTracePng(dataUrl: string, fileName: string): Promise<boolean> {
    if (!canUseWriteFeatures()) return false;
    if (!dataUrl) {
      setToast('导出失败');
      return false;
    }
    try {
      const ok = await picflowApi.exportShareCardPng(dataUrl, fileName);
      setToast(ok ? '已导出为 PNG' : '导出失败');
      return ok;
    } catch {
      setToast('导出失败');
      return false;
    }
  }

  function updateCase(id: string, patch: Partial<PicFlowCase>): void {
    if (!canUseWriteFeatures()) return;
    setData((current) => ({
      ...current,
      cases: updateWork(current.cases, id, patch, nowIso())
    }));
  }

  function fillPromptFromSmartClipboard(): void {
    if (!canUseWriteFeatures()) return;
    const request = smartClipboard.completeRequest();
    if (!request) return;
    setData((current) => {
      const nextData = {
        ...current,
        cases: updateWork(current.cases, request.workId, { prompt: request.text }, nowIso())
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
    setToast('\u5df2\u586b\u5165 Prompt');
  }

  function dismissClipboardImageRequest(): void {
    if (clipboardImageRequest) dismissedClipboardImageHashRef.current = clipboardImageRequest.hash;
    setClipboardImageRequest(null);
  }

  function completeClipboardImageRequest(): ClipboardImageRequest | null {
    const request = clipboardImageRequest;
    if (request) {
      handledClipboardImageHashRef.current = request.hash;
      dismissedClipboardImageHashRef.current = null;
      suggestedClipboardImageHashRef.current = request.hash;
    }
    setClipboardImageRequest(null);
    return request;
  }

  async function markCurrentClipboardImageHandled(): Promise<void> {
    const image = await picflowClipboard?.readImage?.();
    if (!image) return;
    const hash = hashClipboardImage(image.dataUrl, image.width, image.height);
    handledClipboardImageHashRef.current = hash;
    suggestedClipboardImageHashRef.current = hash;
    dismissedClipboardImageHashRef.current = null;
    setClipboardImageRequest((current) => (current?.hash === hash ? null : current));
  }

  async function createWorkFromClipboardImage(): Promise<void> {
    if (!canUseWriteFeatures()) return;
    const request = completeClipboardImageRequest();
    if (!request || !ensureLibraryReady()) return;
    try {
      const image = await picflowApi.saveDataUrlImage(request.dataUrl, 'clipboard-image.png');
      setClipboardImportDraft(createCase({ images: [image], captureMethod: 'clipboard-paste' }));
    } catch {
      setToast('图片保存失败');
    }
  }

  async function addClipboardImageAsGuide(): Promise<void> {
    if (!canUseWriteFeatures()) return;
    const request = completeClipboardImageRequest();
    if (!request || !selectedCase || !ensureLibraryReady()) return;
    try {
      const image = await picflowApi.saveDataUrlImage(request.dataUrl, 'clipboard-image.png', 'reference');
      addGuideImagesToCase(selectedCase.id, [image]);
      setToast('已添加垫图');
    } catch {
      setToast('图片保存失败');
    }
  }

  function appendWork(item: PicFlowCase, options: { openPostImportModal?: boolean } = {}): void {
    if (!canUseWriteFeatures()) return;
    setData((current) => {
      const nextData = { ...current, cases: [item, ...current.cases] };
      void picflowApi.saveData(nextData);
      return nextData;
    });
    setSelectedId(item.id);
    setActiveView(item.status === 'pending' ? 'pending' : 'all');
    if (options.openPostImportModal) setPostImportCaseId(item.id);
  }

  function appendWorks(items: PicFlowCase[]): void {
    if (!canUseWriteFeatures()) return;
    if (!items.length) return;
    setData((current) => {
      const nextData = { ...current, cases: [...items, ...current.cases] };
      void picflowApi.saveData(nextData);
      return nextData;
    });
    setSelectedId(items[0].id);
    setActiveView(items[0].status === 'pending' ? 'pending' : 'all');
  }

  function addMainImagesToCase(caseId: string, images: PicFlowImage[]): void {
    if (!canUseWriteFeatures()) return;
    setData((current) => {
      const nextData = {
        ...current,
        cases: current.cases.map((item) => {
        if (item.id !== caseId) return item;
        const nextImages = [...images, ...item.images];
        return { ...item, images: nextImages, coverImageId: images[0]?.id ?? item.coverImageId, updatedAt: nowIso() };
        })
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
  }

  function addGuideImagesToCase(caseId: string, images: PicFlowImage[]): void {
    if (!canUseWriteFeatures()) return;
    setData((current) => {
      const nextData = {
        ...current,
        cases: current.cases.map((item) => {
        if (item.id !== caseId) return item;
        return { ...item, referenceImages: [...(item.referenceImages ?? []), ...images], updatedAt: nowIso() };
        })
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
  }

  function removeGuideImage(caseId: string, imageId: string): void {
    if (!canUseWriteFeatures()) return;
    setData((current) => {
      const nextData = {
        ...current,
        cases: current.cases.map((item) =>
          item.id === caseId
            ? { ...item, referenceImages: (item.referenceImages ?? []).filter((image) => image.id !== imageId), updatedAt: nowIso() }
            : item
        )
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
  }

  function clearGuideImages(caseId: string): void {
    if (!canUseWriteFeatures()) return;
    updateCase(caseId, { referenceImages: [] });
    setToast('已清空垫图');
  }

  async function importImages(status: PicFlowCase['status'] = 'pending'): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!ensureLibraryReady()) return;
    try {
      const images = await picflowApi.selectImages();
      if (!images.length) return;
      const works = images.map((image) => createCase({ images: [image], status, captureMethod: 'local-import' }));
      if (works.length === 1) {
        appendWork(works[0], { openPostImportModal: true });
        setToast('\u5df2\u5bfc\u5165\u56fe\u7247');
        return;
      }
      appendWorks(works);
      setToast(`\u5df2\u5bfc\u5165 ${works.length} \u5f20\u56fe\u7247`);
    } catch {
      setToast('\u56fe\u7247\u5bfc\u5165\u5931\u8d25');
    }
  }

  async function addMainImagesToSelected(): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!selectedCase) return;
    if (!ensureLibraryReady()) return;
    const images = await picflowApi.selectImages();
    if (!images.length) return;
    addMainImagesToCase(selectedCase.id, images);
    setToast('已更新主图');
  }

  async function addGuideImagesToSelected(): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!selectedCase) return;
    if (!ensureLibraryReady()) return;
    const images = await picflowApi.selectImages('reference');
    if (!images.length) return;
    addGuideImagesToCase(selectedCase.id, images);
    setToast('已添加垫图');
  }

  async function addGuideImagesToImportedCase(caseId: string): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!ensureLibraryReady()) return;
    try {
      const images = await picflowApi.selectImages('reference');
      if (!images.length) return;
      addGuideImagesToCase(caseId, images);
      setToast('\u5df2\u6dfb\u52a0\u57ab\u56fe');
    } catch {
      setToast('\u57ab\u56fe\u6dfb\u52a0\u5931\u8d25');
    }
  }

  async function importDroppedImages(event: DragEvent<HTMLElement>, target: 'asset' | 'reference' = 'asset'): Promise<PicFlowImage[]> {
    event.preventDefault();
    event.stopPropagation();
    if (!canUseWriteFeatures()) return [];
    if (!ensureLibraryReady()) return [];

    const files = Array.from(event.dataTransfer.files ?? []);
    const imageFiles = files.filter(isImageFile);
    if (!imageFiles.length) {
      if (files.length) setToast('不支持该文件类型');
      return [];
    }

    const paths = imageFiles
      .map((file) => (picflowApi.getPathForFile?.(file) || (file as File & { path?: string }).path || '').trim())
      .filter((path): path is string => Boolean(path));
    if (!paths.length) {
      setToast('不支持该文件类型');
      return [];
    }
    try {
      return await picflowApi.importImagePaths(paths, target);
    } catch {
      setToast(target === 'reference' ? '\u56fe\u7247\u4fdd\u5b58\u5931\u8d25' : '\u56fe\u7247\u5bfc\u5165\u5931\u8d25');
      return [];
    }
  }

  async function handleGalleryDrop(event: DragEvent<HTMLElement>): Promise<void> {
    setGalleryDragging(false);
    const images = await importDroppedImages(event, 'asset');
    if (!images.length) return;
    const works = images.map((image) => createCase({ images: [image], captureMethod: 'drag-drop' }));
    if (works.length === 1) {
      appendWork(works[0], { openPostImportModal: true });
      setToast('\u5df2\u5bfc\u5165\u56fe\u7247');
      return;
    }
    appendWorks(works);
    setToast(`\u5df2\u5bfc\u5165 ${works.length} \u5f20\u56fe\u7247`);
  }

  async function handleGuideDrop(event: DragEvent<HTMLElement>, caseId: string): Promise<void> {
    const images = await importDroppedImages(event, 'reference');
    if (!images.length) return;
    addGuideImagesToCase(caseId, images);
    setToast('已添加垫图');
  }

  async function handleMainImageDrop(event: DragEvent<HTMLElement>, item: PicFlowCase): Promise<void> {
    const images = await importDroppedImages(event, 'asset');
    if (!images.length) return;
    if (item.images.length > 0) {
      requestConfirm({ type: 'replace-main', caseId: item.id, images });
      return;
    }
    addMainImagesToCase(item.id, images);
    setToast('已更新主图');
  }

  async function handleGuidePaste(event: ReactClipboardEvent<HTMLElement>, caseId: string): Promise<void> {
    event.stopPropagation();
    const imageFile = Array.from(event.clipboardData.files ?? []).find((file) => file.type.startsWith('image/'));
    if (!imageFile) return;
    if (!canUseWriteFeatures()) {
      event.preventDefault();
      return;
    }
    if (!ensureLibraryReady()) return;
    event.preventDefault();
    try {
      const dataUrl = await fileToDataUrl(imageFile);
      const image = await picflowApi.saveDataUrlImage(dataUrl, imageFile.name || 'guide-image.png', 'reference');
      addGuideImagesToCase(caseId, [image]);
      void markCurrentClipboardImageHandled();
      setToast('\u5df2\u6dfb\u52a0\u57ab\u56fe');
    } catch {
      setToast('\u56fe\u7247\u4fdd\u5b58\u5931\u8d25');
    }
  }

  async function addUrlImage(urlValue: string): Promise<void> {
    if (!canUseWriteFeatures()) return;
    const url = urlValue.trim();
    if (!url) return;
    if (!ensureLibraryReady()) return;
    try {
      const image = await picflowApi.saveUrlImage(url);
      appendWork(createCase({ images: [image], captureMethod: 'url-paste', sourceUrl: url }), { openPostImportModal: true });
      setSearch('');
      setToast('\u5df2\u901a\u8fc7\u94fe\u63a5\u6dfb\u52a0\u4f5c\u54c1');
    } catch {
      setToast('\u6682\u4e0d\u652f\u6301\u8be5\u94fe\u63a5');
    }
  }

  function handleSmartInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Enter') return;
    const value = search.trim();
    if (!value) return;
    if (!/^https?:\/\//i.test(value)) return;
    if (!isImageUrl(value)) {
      setToast('不支持的图片链接');
      return;
    }
    event.preventDefault();
    void addUrlImage(value);
  }

  function toggleOrganizedStatus(id: string): void {
    if (!canUseWriteFeatures()) return;
    const item = data.cases.find((work) => work.id === id);
    if (!item) return;
    const nextStatus: PicFlowCase['status'] = item.status === 'pending' ? 'confirmed' : 'pending';
    updateCase(id, { status: nextStatus });
    setToast(nextStatus === 'confirmed' ? '\u5df2\u6574\u7406\u5b8c\u6210' : '\u5df2\u6807\u8bb0\u4e3a\u5f85\u6574\u7406');
  }

  async function savePostImportInfo(caseId: string, payload: PostImportInfoPayload): Promise<void> {
    if (!canUseWriteFeatures()) return;
    const nextData = {
      ...data,
      cases: data.cases.map((item) =>
        item.id === caseId
          ? {
              ...item,
              prompt: payload.prompt,
              modelTags: payload.modelTags,
              collectionId: payload.collectionId,
              status: 'confirmed' as const,
              updatedAt: nowIso()
            }
          : item
      )
    };
    try {
      await picflowApi.saveData(nextData);
      setData(nextData);
      setPostImportCaseId(null);
      setToast('\u5df2\u4fdd\u5b58\u4f5c\u54c1\u4fe1\u606f');
    } catch {
      setToast('\u4fdd\u5b58\u5931\u8d25');
    }
  }

  function saveClipboardImportDraft(payload: PostImportInfoPayload): void {
    if (!canUseWriteFeatures()) return;
    if (!clipboardImportDraft) return;
    appendWork({
      ...clipboardImportDraft,
      prompt: payload.prompt,
      modelTags: payload.modelTags,
      collectionId: payload.collectionId,
      status: 'confirmed',
      updatedAt: nowIso()
    });
    setClipboardImportDraft(null);
    setToast('\u5df2\u4fdd\u5b58\u4f5c\u54c1\u4fe1\u606f');
  }

  function skipPostImportInfo(): void {
    setPostImportCaseId(null);
    setToast('\u5df2\u8df3\u8fc7\uff0c\u53ef\u7a0d\u540e\u6574\u7406');
  }

  function skipClipboardImportDraft(): void {
    if (!clipboardImportDraft) return;
    if (!canUseWriteFeatures()) return;
    appendWork(clipboardImportDraft);
    setClipboardImportDraft(null);
    setToast('\u5df2\u8df3\u8fc7\uff0c\u53ef\u7a0d\u540e\u6574\u7406');
  }

  async function addGuideImagesToClipboardDraft(): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!clipboardImportDraft) return;
    if (!ensureLibraryReady()) return;
    try {
      const images = await picflowApi.selectImages('reference');
      if (!images.length) return;
      setClipboardImportDraft((current) =>
        current
          ? { ...current, referenceImages: [...(current.referenceImages ?? []), ...images], updatedAt: nowIso() }
          : current
      );
      setToast('\u5df2\u6dfb\u52a0\u57ab\u56fe');
    } catch {
      setToast('\u57ab\u56fe\u6dfb\u52a0\u5931\u8d25');
    }
  }

  async function handleClipboardDraftGuidePaste(event: ReactClipboardEvent<HTMLElement>): Promise<void> {
    event.stopPropagation();
    const imageFile = Array.from(event.clipboardData.files ?? []).find((file) => file.type.startsWith('image/'));
    if (!imageFile || !clipboardImportDraft) return;
    if (!canUseWriteFeatures()) {
      event.preventDefault();
      return;
    }
    if (!ensureLibraryReady()) return;
    event.preventDefault();
    try {
      const dataUrl = await fileToDataUrl(imageFile);
      const image = await picflowApi.saveDataUrlImage(dataUrl, imageFile.name || 'guide-image.png', 'reference');
      setClipboardImportDraft((current) =>
        current
          ? { ...current, referenceImages: [...(current.referenceImages ?? []), image], updatedAt: nowIso() }
          : current
      );
      void markCurrentClipboardImageHandled();
      setToast('\u5df2\u6dfb\u52a0\u57ab\u56fe');
    } catch {
      setToast('\u56fe\u7247\u4fdd\u5b58\u5931\u8d25');
    }
  }

  async function handleClipboardDraftGuideDrop(event: DragEvent<HTMLElement>): Promise<void> {
    if (!clipboardImportDraft) return;
    const images = await importDroppedImages(event, 'reference');
    if (!images.length) return;
    setClipboardImportDraft((current) =>
      current
        ? { ...current, referenceImages: [...(current.referenceImages ?? []), ...images], updatedAt: nowIso() }
        : current
    );
    setToast('已添加垫图');
  }

  function removeClipboardDraftGuideImage(_caseId: string, imageId: string): void {
    if (!canUseWriteFeatures()) return;
    setClipboardImportDraft((current) =>
      current
        ? {
            ...current,
            referenceImages: (current.referenceImages ?? []).filter((image) => image.id !== imageId),
            updatedAt: nowIso()
          }
        : current
    );
  }

  function copyText(value: string | undefined, label: string): void {
    const text = value?.trim();
    if (!text) {
      if (label === 'Prompt') setToast('\u6682\u65e0 Prompt \u53ef\u590d\u5236');
      else if (label === '\u6a21\u578b\u6807\u7b7e') setToast('\u6682\u65e0\u6a21\u578b\u6807\u7b7e\u53ef\u590d\u5236');
      else setToast(`${label}\u4e3a\u7a7a`);
      return;
    }
    void copyTextToClipboard(text).then(() => setToast(`\u5df2\u590d\u5236${label}`)).catch(() => setToast('\u590d\u5236\u5931\u8d25'));
  }

  async function copyImage(image?: PicFlowImage, label = '\u56fe\u7247'): Promise<void> {
    if (!canUseWriteFeatures()) return;
    if (!image) {
      setToast(`\u590d\u5236${label}\u5931\u8d25`);
      return;
    }
    try {
      const copied = await picflowApi.copyImage(image);
      setToast(copied ? `\u5df2\u590d\u5236${label}` : `\u590d\u5236${label}\u5931\u8d25`);
    } catch {
      setToast(`\u590d\u5236${label}\u5931\u8d25`);
    }
  }

  function copyModelTags(item: PicFlowCase): void {
    copyText(formatModelTagsForCopy(item), '\u6a21\u578b\u6807\u7b7e');
  }

  function copyWorkSummary(item: PicFlowCase): void {
    const summary = buildWorkSummaryText(item);
    void copyTextToClipboard(summary).then(() => setToast('\u5df2\u590d\u5236\u4f5c\u54c1\u4fe1\u606f')).catch(() => setToast('\u590d\u5236\u5931\u8d25'));
  }

  function toggleFavorite(id: string): void {
    if (!canUseWriteFeatures()) return;
    const item = data.cases.find((work) => work.id === id);
    if (!item) return;
    setData((current) => {
      const nextData = {
        ...current,
        cases: current.cases.map((work) => (work.id === id ? { ...work, favorite: !item.favorite, updatedAt: nowIso() } : work))
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
    setToast(item.favorite ? '\u5df2\u53d6\u6d88\u6536\u85cf' : '\u5df2\u6536\u85cf');
  }

  function collectionName(collectionId?: string): string {
    if (!collectionId) return '\u672a\u5206\u7c7b';
    return data.collections.find((collection) => collection.id === collectionId)?.name ?? '\u672a\u77e5\u56fe\u96c6';
  }

  function applyWorkCollectionMove(workId: string, targetCollectionId?: string): void {
    if (!canUseWriteFeatures()) return;
    const targetName = collectionName(targetCollectionId);
    setData((current) => {
      const nextData = {
        ...current,
        cases: current.cases.map((work) =>
          work.id === workId ? { ...work, collectionId: targetCollectionId || undefined, updatedAt: nowIso() } : work
        )
      };
      void picflowApi.saveData(nextData);
      return nextData;
    });
    setCutWorkId((current) => (current === workId ? null : current));
    setToast(targetCollectionId ? `\u5df2\u79fb\u52a8\u5230\u300c${targetName}\u300d` : '\u5df2\u79fb\u51fa\u56fe\u96c6');
  }

  function requestMoveWorkToCollection(workId: string, targetCollectionId?: string): void {
    if (!canUseWriteFeatures()) return;
    const work = data.cases.find((item) => item.id === workId);
    if (!work) {
      setToast('\u79fb\u52a8\u5931\u8d25');
      return;
    }
    if (targetCollectionId && !data.collections.some((collection) => collection.id === targetCollectionId)) {
      setToast('\u79fb\u52a8\u5931\u8d25');
      return;
    }
    const currentCollectionId = work.collectionId || undefined;
    if ((currentCollectionId ?? '') === (targetCollectionId ?? '')) {
      setToast(targetCollectionId ? '\u8be5\u4f5c\u54c1\u5df2\u5728\u5f53\u524d\u56fe\u96c6\u4e2d' : '\u5df2\u79fb\u51fa\u56fe\u96c6');
      return;
    }
    if (currentCollectionId && targetCollectionId) {
      requestConfirm({
        type: 'move-work',
        workId,
        fromCollectionName: collectionName(currentCollectionId),
        toCollectionId: targetCollectionId,
        toCollectionName: collectionName(targetCollectionId)
      });
      return;
    }
    applyWorkCollectionMove(workId, targetCollectionId);
  }

  function pasteCutWorkToCurrentCollection(): void {
    if (!canUseWriteFeatures()) return;
    if (!cutWorkId) return;
    if (!activeView.startsWith('collection:')) {
      setToast('\u8bf7\u5148\u6253\u5f00\u4e00\u4e2a\u56fe\u96c6\u540e\u518d\u7c98\u8d34\u4f5c\u54c1');
      return;
    }
    const targetCollectionId = activeView.replace('collection:', '');
    requestMoveWorkToCollection(cutWorkId, targetCollectionId);
  }

  function handleWorkCardDragStart(event: DragEvent<HTMLElement>, workId: string): void {
    if (!canUseWriteFeatures()) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-picflow-work-id', workId);
    setSelectedId(workId);
  }

  function handleCollectionDragOver(event: DragEvent<HTMLElement>): void {
    if (!Array.from(event.dataTransfer.types).includes('application/x-picflow-work-id')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
  }

  function isWorkCardDrag(event: DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types).includes('application/x-picflow-work-id');
  }

  function handleCollectionDrop(event: DragEvent<HTMLElement>, collection: PicFlowCollection): void {
    const workId = event.dataTransfer.getData('application/x-picflow-work-id');
    if (!workId) return;
    event.preventDefault();
    event.stopPropagation();
    if (!canUseWriteFeatures()) return;
    requestMoveWorkToCollection(workId, collection.id);
  }

  function addCollection(parentId: string | null = null): void {
    if (!canUseWriteFeatures()) return;
    const timestamp = nowIso();
    const collection: PicFlowCollection = { id: newId(), name: '新建图集', parentId, deletedAt: null, deletedParentId: null, createdAt: timestamp, updatedAt: timestamp };
    setData((current) => ({ ...current, collections: [...current.collections, collection] }));
    setActiveView(`collection:${collection.id}`);
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
    if (parentId) setExpandedCollectionIds((current) => (current.includes(parentId) ? current : [...current, parentId]));
    setCollectionMenu(null);
    setToast(parentId ? '已新建子文件夹' : '已新建图集');
  }

  function collectionDescendantIds(collectionId: string, collections = data.collections): string[] {
    const children = collections.filter((item) => !item.deletedAt && item.parentId === collectionId);
    return children.flatMap((child) => [child.id, ...collectionDescendantIds(child.id, collections)]);
  }

  function allCollectionDescendantIds(collectionId: string, collections = data.collections): string[] {
    const children = collections.filter((item) => item.parentId === collectionId || item.deletedParentId === collectionId);
    return children.flatMap((child) => [child.id, ...allCollectionDescendantIds(child.id, collections)]);
  }

  function collectionHasChildrenOrWorks(collectionId: string): boolean {
    const ids = new Set([collectionId, ...collectionDescendantIds(collectionId)]);
    return data.collections.some((item) => !item.deletedAt && item.parentId === collectionId) ||
      data.cases.some((item) => !item.deletedAt && item.collectionId && ids.has(item.collectionId));
  }

  function toggleCollectionExpanded(collectionId: string): void {
    setExpandedCollectionIds((current) =>
      current.includes(collectionId) ? current.filter((id) => id !== collectionId) : [...current, collectionId]
    );
  }

  function openCollectionMenu(event: ReactMouseEvent<HTMLElement>, collection: PicFlowCollection): void {
    event.preventDefault();
    event.stopPropagation();
    setCollectionMenu({ id: collection.id, x: event.clientX, y: event.clientY });
  }

  function startRenameCollection(collection: PicFlowCollection): void {
    if (!canUseWriteFeatures()) return;
    setEditingCollectionId(collection.id);
    setEditingCollectionName(collection.name);
  }

  function finishRenameCollection(id: string): void {
    if (!canUseWriteFeatures()) {
      cancelRenameCollection();
      return;
    }
    const name = editingCollectionName.trim() || '新建图集';
    setData((current) => ({
      ...current,
      collections: current.collections.map((item) => (item.id === id ? { ...item, name, updatedAt: nowIso() } : item))
    }));
    setEditingCollectionId(null);
    setEditingCollectionName('');
  }

  function cancelRenameCollection(): void {
    setEditingCollectionId(null);
    setEditingCollectionName('');
  }

  function moveCaseToTrash(caseId: string): void {
    const timestamp = nowIso();
    const nextData = {
      ...data,
      cases: data.cases.map((item) =>
        item.id === caseId
          ? { ...item, deletedAt: timestamp, deletedFromCollectionId: item.collectionId ?? null, updatedAt: timestamp }
          : item
      )
    };
    const activeCases = data.cases.filter((item) => !item.deletedAt);
    persist(nextData);
    setSelectedId(selectedId === caseId ? nextAfterDelete(activeCases, caseId) : selectedId);
    setToast('已移入回收站');
  }

  function moveCollectionToTrash(collectionId: string): void {
    const timestamp = nowIso();
    const trashedIds = new Set([collectionId, ...collectionDescendantIds(collectionId)]);
    const nextData = {
      ...data,
      collections: data.collections.map((item) =>
        trashedIds.has(item.id)
          ? { ...item, deletedAt: timestamp, deletedParentId: item.parentId ?? null, updatedAt: timestamp }
          : item
      ),
      cases: data.cases.map((item) =>
        item.collectionId && trashedIds.has(item.collectionId) && !item.deletedAt
          ? { ...item, deletedAt: timestamp, deletedFromCollectionId: item.collectionId, updatedAt: timestamp }
          : item
      )
    };
    persist(nextData);
    if (activeView === `collection:${collectionId}` || (activeView.startsWith('collection:') && trashedIds.has(activeView.replace('collection:', '')))) {
      setActiveView('all');
    }
    setSelectedId(null);
    setCollectionMenu(null);
    setToast('已移入回收站');
  }

  function restoreCase(caseId: string): void {
    const work = data.cases.find((item) => item.id === caseId);
    if (!work) return;
    const originalCollectionId = work.deletedFromCollectionId ?? work.collectionId;
    const collectionExists = originalCollectionId ? data.collections.some((item) => item.id === originalCollectionId && !item.deletedAt) : false;
    const timestamp = nowIso();
    const nextCollectionId = collectionExists ? originalCollectionId ?? undefined : undefined;
    persist({
      ...data,
      cases: data.cases.map((item) =>
        item.id === caseId
          ? { ...item, deletedAt: null, deletedFromCollectionId: null, collectionId: nextCollectionId, updatedAt: timestamp }
          : item
      )
    });
    setToast(collectionExists || !originalCollectionId ? '已恢复作品' : '已恢复作品，原文件夹不存在，已放入未分类');
  }

  function restoreCollection(collectionId: string): void {
    const timestamp = nowIso();
    const ids = new Set([collectionId, ...data.collections.filter((item) => item.deletedAt).flatMap((item) => {
      const chain: string[] = [];
      let parentId = item.deletedParentId ?? item.parentId ?? null;
      while (parentId) {
        chain.push(parentId);
        parentId = data.collections.find((candidate) => candidate.id === parentId)?.deletedParentId ?? null;
      }
      return chain.includes(collectionId) ? [item.id] : [];
    })]);
    const nextData = {
      ...data,
      collections: data.collections.map((item) => {
        if (!ids.has(item.id)) return item;
        const parentId = item.deletedParentId ?? item.parentId ?? null;
        const parentAvailable = !parentId || data.collections.some((candidate) => candidate.id === parentId && !candidate.deletedAt);
        return { ...item, deletedAt: null, deletedParentId: null, parentId: parentAvailable ? parentId : null, updatedAt: timestamp };
      }),
      cases: data.cases.map((item) =>
        item.deletedAt && item.deletedFromCollectionId && ids.has(item.deletedFromCollectionId)
          ? { ...item, deletedAt: null, deletedFromCollectionId: null, collectionId: item.deletedFromCollectionId, updatedAt: timestamp }
          : item
      )
    };
    persist(nextData);
    setToast('已恢复文件夹');
  }

  function permanentlyDeleteCase(caseId: string): void {
    persist({ ...data, cases: data.cases.filter((item) => item.id !== caseId) });
    if (selectedId === caseId) setSelectedId(null);
    setToast('已永久删除');
  }

  function permanentlyDeleteCollection(collectionId: string): void {
    const ids = new Set([collectionId, ...allCollectionDescendantIds(collectionId)]);
    persist({
      ...data,
      collections: data.collections.filter((item) => !ids.has(item.id)),
      cases: data.cases.filter((item) => !(item.deletedAt && item.deletedFromCollectionId && ids.has(item.deletedFromCollectionId)))
    });
    setToast('已永久删除');
  }

  async function deleteConfirmed(): Promise<void> {
    if (!confirmState) return;
    if (!canUseWriteFeatures()) {
      setConfirmState(null);
      return;
    }
    if (confirmState.type === 'case') {
      moveCaseToTrash(confirmState.id);
      setConfirmState(null);
      return;
    }
    if (confirmState.type === 'permanent-case') {
      permanentlyDeleteCase(confirmState.id);
      setConfirmState(null);
      return;
    }
    if (confirmState.type === 'permanent-collection') {
      permanentlyDeleteCollection(confirmState.id);
      setConfirmState(null);
      return;
    }
    if (confirmState.type === 'collection') {
      moveCollectionToTrash(confirmState.id);
      setConfirmState(null);
      return;
    }
    if (confirmState.type === 'trace') {
      const nextData = { traces: traceData.traces.filter((trace) => trace.id !== confirmState.id) };
      persistTraces(nextData);
      if (selectedTraceId === confirmState.id) setSelectedTraceId(null);
      setToast('已删除复迹');
    }
    if (confirmState.type === 'clear-guides') {
      clearGuideImages(confirmState.caseId);
    }
    if (confirmState.type === 'replace-main') {
      addMainImagesToCase(confirmState.caseId, confirmState.images);
      setToast('已更新主图');
    }
    if (confirmState.type === 'move-work') {
      applyWorkCollectionMove(confirmState.workId, confirmState.toCollectionId);
    }
    if (confirmState.type === 'reset-test-data') {
      const result = await picflowLibrary.resetTestData();
      setToast(result.backupPath ? `${result.message}，备份已保存` : result.message);
      if (result.state) setLibraryState(result.state);
      if (result.ok) {
        setData(emptyData);
        setTraceData(emptyTraceData);
        setSelectedTraceId(null);
        setSelectedId(null);
      }
    }
    setConfirmState(null);
  }

  function addModelTag(nextTag?: string): void {
    if (!canUseWriteFeatures()) return;
    if (!selectedCase) return;
    const tag = (nextTag ?? modelDraft).trim();
    if (!tag) return;
    const current = selectedCase.modelTags ?? [];
    if (!current.includes(tag)) updateCase(selectedCase.id, { modelTags: [...current, tag] });
    setModelDraft('');
  }

  function removeModelTag(tag: string): void {
    if (!canUseWriteFeatures()) return;
    if (!selectedCase) return;
    updateCase(selectedCase.id, { modelTags: (selectedCase.modelTags ?? []).filter((item) => item !== tag) });
  }

  function handleGalleryWheel(event: WheelEvent<HTMLElement>): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setCardScale((current) => {
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      return Math.min(maxCardScale, Math.max(minCardScale, Number((current + delta).toFixed(2))));
    });
  }

  function updateLibraryMenuPosition(): void {
    const rect = libraryButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLibraryMenuPosition({
      top: Math.min(rect.bottom + 8, window.innerHeight - 190),
      right: Math.max(12, window.innerWidth - rect.right)
    });
  }

  function toggleLibraryMenu(): void {
    if (!libraryMenuOpen) updateLibraryMenuPosition();
    setLibraryMenuOpen((value) => !value);
  }

  async function runLibraryAction(action: 'create' | 'add' | 'open'): Promise<void> {
    setLibraryMenuOpen(false);
    if (action !== 'open' && !canUseWriteFeatures()) return;
    const result =
      action === 'create'
        ? await picflowLibrary.createLibrary()
        : action === 'add'
          ? await picflowLibrary.addLibrary()
          : await picflowLibrary.openLibraryLocation();
    setToast(result.message);
    if (result.state) setLibraryState(result.state);
    if (result.ok && action !== 'open') await loadCurrentLibraryDataAndApply('switch', { resetView: true });
  }

  async function switchRecentLibrary(path: string): Promise<void> {
    setLibraryMenuOpen(false);
    console.info('[library switch] target path:', path);
    const result = await picflowLibrary.switchLibrary(path);
    setToast(result.message);
    if (result.state) setLibraryState(result.state);
    if (result.ok) {
      console.info('[library switch] switch success');
      await loadCurrentLibraryDataAndApply('switch', { resetView: true });
    }
  }

  async function refreshCurrentLibrary(): Promise<void> {
    if (libraryRefreshing) return;
    setLibraryRefreshing(true);
    try {
      const ok = await loadCurrentLibraryDataAndApply('refresh', { resetView: false, keepSelection: true });
      if (ok) setToast('已刷新资源库');
    } catch {
      setToast('资源库刷新失败');
    } finally {
      window.setTimeout(() => setLibraryRefreshing(false), 500);
    }
  }

  async function setupLibrary(action: 'default' | 'custom' | 'add' | 'create'): Promise<void> {
    if (!canUseWriteFeatures()) return;
    const result =
      action === 'default'
        ? await picflowLibrary.setupDefaultLibrary()
        : action === 'custom'
          ? await picflowLibrary.chooseCustomLibrary()
          : action === 'add'
            ? await picflowLibrary.addLibrary()
            : await picflowLibrary.createLibrary();
    setToast(result.message);
    if (result.state) setLibraryState(result.state);
    if (result.ok) await loadCurrentLibraryDataAndApply('switch', { resetView: true });
  }

  const cardWidth = Math.round(200 * cardScale);
  const cardHeight = Math.round(260 * cardScale);
  const cardGap = Math.round(18 * cardScale);
  const getImageDisplaySrc = (image?: PicFlowImage) => imageSrc(image, libraryState.currentLibrary?.path);
  const getReferenceImageDisplaySrc = (image?: PicFlowImage) => imageSrc(image, libraryState.currentLibrary?.path);
  const isTraceModule = activeView === 'traces';
  const activeCollections = data.collections.filter((collection) => !collection.deletedAt);
  const trashedCollections = data.collections.filter((collection) => collection.deletedAt);
  const collectionRows = useMemo(() => {
    const rows: Array<{ collection: PicFlowCollection; depth: number; hasChildren: boolean; expanded: boolean }> = [];
    const visit = (parentId: string | null, depth: number) => {
      activeCollections
        .filter((collection) => (collection.parentId ?? null) === parentId)
        .filter((collection) => !reservedSidebarCollectionNames.has(collection.name.trim()))
        .forEach((collection) => {
          const hasChildren = activeCollections.some((item) => (item.parentId ?? null) === collection.id);
          const expanded = expandedCollectionIds.includes(collection.id);
          rows.push({ collection, depth, hasChildren, expanded });
          if (hasChildren && expanded) visit(collection.id, depth + 1);
        });
    };
    visit(null, 0);
    return rows;
  }, [activeCollections, expandedCollectionIds]);
  const trashCount = data.cases.filter((item) => item.deletedAt).length + data.collections.filter((item) => item.deletedAt).length;
  const currentViewTitle = isTraceModule ? '创作复迹' : search.trim() ? '\u641c\u7d22\u7ed3\u679c' : viewTitle(activeView, data.collections);

  return (
    <div
      className="flex h-screen flex-col bg-[#edf4f8] text-ink dark:bg-[#242424] dark:text-neutral-100"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      <AppTitlebar
        currentViewTitle={currentViewTitle}
        search={search}
        sidePanelsCollapsed={sidePanelsCollapsed}
        darkMode={darkMode}
        libraryRefreshing={libraryRefreshing}
        libraryButtonRef={libraryButtonRef}
        windowApi={picflowWindow}
        onSearchChange={setSearch}
        onSearchKeyDown={handleSmartInputKeyDown}
        onToggleSidePanels={() => setSidePanelsCollapsed((value) => !value)}
        onToggleLibraryMenu={toggleLibraryMenu}
        onRefreshLibrary={() => void refreshCurrentLibrary()}
        onToggleDarkMode={() => setDarkMode((value) => !value)}
      />

      <main
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: sidePanelsCollapsed ? 'minmax(620px, 1fr)' : isTraceModule ? 'var(--app-sidebar-width) minmax(620px, 1fr)' : 'var(--app-sidebar-width) minmax(620px, 1fr) var(--app-detail-panel-width)' }}
      >
        {!sidePanelsCollapsed && (
        <aside className="flex min-h-0 flex-col bg-[#f5f9fc] dark:bg-[#2b2b2b]">
          <BrandHeader />
          <div className="sidebar-navigation">
          <section className="sidebar-section">
          <nav className="sidebar-menu-list">
            <SidebarRow active={activeView === 'all'} icon={<MoreHorizontal />} label="全部作品" count={counts.all} onClick={() => setActiveView('all')} />
            <SidebarRow active={activeView === 'pending'} icon={<Inbox />} label={'\u5f85\u6574\u7406'} count={counts.pending} onClick={() => setActiveView('pending')} />
          </nav>
          </section>

          <section className="sidebar-section sidebar-collection-section">
            <SidebarSectionHeader title="灵感图集" onAction={addCollection} />
            <div className="sidebar-menu-list sidebar-collection-list">
              <SidebarRow active={activeView === 'favorites'} icon={<Heart />} label="我的收藏" count={counts.favorites} onClick={() => setActiveView('favorites')} />
              {collectionRows.map(({ collection, depth, hasChildren, expanded }) => {
                const collectionCount = data.cases.filter((item) => !item.deletedAt && item.collectionId === collection.id).length;
                return (
                <div
                  key={collection.id}
                  className="sidebar-collection-row group relative"
                  style={{ paddingLeft: depth * 14 }}
                  onDragOver={handleCollectionDragOver}
                  onDrop={(event) => handleCollectionDrop(event, collection)}
                  onContextMenu={(event) => openCollectionMenu(event, collection)}
                >
                  {editingCollectionId === collection.id ? (
                    <input
                      className="field-input h-9 min-w-0 flex-1 px-2"
                      autoFocus
                      value={editingCollectionName}
                      onChange={(event) => setEditingCollectionName(event.target.value)}
                      onBlur={() => finishRenameCollection(collection.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') finishRenameCollection(collection.id);
                        if (event.key === 'Escape') cancelRenameCollection();
                      }}
                    />
                  ) : (
                    <div className="relative">
                      {hasChildren && (
                        <button
                          type="button"
                          className="absolute left-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-transparent text-stone-400 transition hover:text-stone-600 dark:text-neutral-500 dark:hover:text-neutral-200"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCollectionExpanded(collection.id);
                          }}
                          aria-label={expanded ? '收起子文件夹' : '展开子文件夹'}
                          title={expanded ? '收起子文件夹' : '展开子文件夹'}
                        >
                          <ChevronRight className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                      <SidebarRow
                        active={activeView === `collection:${collection.id}`}
                        icon={<Folder />}
                        label={collection.name}
                        count={collectionCount}
                        onClick={() => setActiveView(`collection:${collection.id}`)}
                        onDoubleClick={() => startRenameCollection(collection)}
                        title="双击重命名"
                      />
                    </div>
                  )}
                  <button
                    className="sidebar-row-action"
                    onClick={() => requestConfirm({ type: 'collection', id: collection.id, name: collection.name, hasContents: collectionHasChildrenOrWorks(collection.id) })}
                    aria-label={`删除图集 ${collection.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                );
              })}
            </div>
          </section>

          <section className="sidebar-section">
            <nav className="sidebar-menu-list">
              <SidebarRow active={activeView === 'traces'} icon={<GitBranch />} label="创作复迹" count={traceData.traces.length} onClick={openTraceModule} />
            </nav>
          </section>

          <section className="sidebar-section sidebar-section-last">
            <nav className="sidebar-menu-list">
              <SidebarRow active={activeView === 'trash'} icon={<Trash2 />} label="回收站" count={trashCount} onClick={() => setActiveView('trash')} />
            </nav>
          </section>
          </div>
          <div className="sidebar-footer">@ OMG Design Lab</div>
        </aside>
        )}

        {isTraceModule ? (
          selectedTrace ? (
            <TraceCanvas
              trace={selectedTrace}
              works={data.cases}
              onBack={backToTraceList}
              onRename={renameSelectedTrace}
              onCreateTextNode={createTextNodeInSelectedTrace}
              onPasteTextNode={pasteTextNodeInSelectedTrace}
              onCreateImageNodes={createImageNodesInSelectedTrace}
              onPasteImageNode={pasteImageNodeInSelectedTrace}
              onCreateWorkNode={createWorkNodeInSelectedTrace}
              onUpdateTextNode={updateTextNodeInSelectedTrace}
              onToggleTextNodeCollapsed={toggleTextNodeCollapsedInSelectedTrace}
              onMoveNode={moveNodeInSelectedTrace}
              onMoveNodes={moveNodesInSelectedTrace}
              onResizeNode={resizeTraceNodeInSelectedTrace}
              onDeleteNode={deleteNodeInSelectedTrace}
              onDeleteNodes={deleteNodesInSelectedTrace}
              onCreateEdge={createEdgeInSelectedTrace}
              onDeleteEdge={deleteEdgeInSelectedTrace}
              onUndo={undoSelectedTrace}
              onRedo={redoSelectedTrace}
              onExportPng={exportTracePng}
              readOnly={previewReadOnly}
              onReadOnlyAttempt={() => setExpiryDialogOpen(true)}
              libraryPath={libraryState.currentLibrary?.path}
            />
          ) : (
            <TraceList
              traces={traceData.traces}
              editingTraceId={editingTraceId}
              editingTitle={editingTraceTitle}
              onCreateTrace={createNewTrace}
              onOpenTrace={openTrace}
              onStartRename={startRenameTrace}
              onEditingTitleChange={setEditingTraceTitle}
              onFinishRename={finishRenameTrace}
              onCancelRename={cancelRenameTrace}
              onDeleteTrace={(trace) => requestConfirm({ type: 'trace', id: trace.id, title: trace.title })}
            />
          )
        ) : (
        <section
          className={`min-h-0 overflow-y-auto bg-[#edf4f8] pb-7 pt-5 transition dark:bg-[#252525] ${galleryDragging ? 'bg-[#dcefff] dark:bg-[#2d2b33]' : ''}`}
          style={{ paddingLeft: 'var(--app-content-gutter)', paddingRight: 'var(--app-content-gutter)' }}
          onWheel={handleGalleryWheel}
          onDragEnter={(event) => {
            if (isWorkCardDrag(event)) return;
            event.preventDefault();
            setGalleryDragging(true);
          }}
          onDragOver={(event) => {
            if (isWorkCardDrag(event)) return;
            event.preventDefault();
            setGalleryDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setGalleryDragging(false);
          }}
          onDrop={handleGalleryDrop}
        >
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.005em] text-stone-700 dark:text-neutral-200">{search.trim() ? '搜索结果' : viewTitle(activeView, data.collections)}</h2>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-neutral-500">
                {search.trim() ? '搜索作品、Prompt、模型和来源。' : `${visibleCases.length} 个作品`}
              </p>
            </div>
          </div>

          {clipboardImageRequest && (
            <div className="sticky top-3 z-40 mx-auto mb-4 w-full max-w-[520px]">
              <ClipboardImageConfirm
                hasSelectedWork={Boolean(selectedCase)}
                onCreateWork={() => void createWorkFromClipboardImage()}
                onAddGuide={() => void addClipboardImageAsGuide()}
                onDismiss={dismissClipboardImageRequest}
              />
            </div>
          )}

          {activeView === 'trash' && trashedCollections.length > 0 && (
            <div className="mb-4 rounded-[14px] border border-[#d7e5ef] bg-[#fbfbfa]/70 p-3 dark:border-[#444] dark:bg-[#303030]/70">
              <div className="mb-2 text-xs font-semibold text-stone-600 dark:text-neutral-400">已删除文件夹</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                {trashedCollections.map((collection) => (
                  <div key={collection.id} className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[#d9e7f1] bg-white px-3 py-2 dark:border-[#494949] dark:bg-[#353535]">
                    <Folder className="h-4 w-4 shrink-0 text-stone-400 dark:text-neutral-500" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-stone-700 dark:text-neutral-100">{collection.name}</div>
                      <div className="text-[11px] text-stone-400 dark:text-neutral-500">删除于 {formatTime(collection.deletedAt ?? undefined)}</div>
                    </div>
                    <button className="icon-button h-8 w-8" onClick={() => restoreCollection(collection.id)} aria-label="恢复文件夹" title="恢复文件夹">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button className="icon-button h-8 w-8 text-[#a24f43] dark:text-[#d9a19a]" onClick={() => requestConfirm({ type: 'permanent-collection', id: collection.id, name: collection.name })} aria-label="永久删除文件夹" title="永久删除文件夹">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleCases.length === 0 && !(activeView === 'trash' && trashedCollections.length > 0) ? (
            <EmptyState
              dragging={galleryDragging}
              onImport={() => importImages()}
              title={search.trim() ? '\u6ca1\u6709\u627e\u5230\u76f8\u5173\u4f5c\u54c1' : undefined}
              description={search.trim() ? '\u8bd5\u8bd5\u66f4\u6362\u5173\u952e\u8bcd\uff0c\u6216\u6e05\u7a7a\u641c\u7d22\u540e\u67e5\u770b\u5f53\u524d\u89c6\u56fe\u3002' : undefined}
            />
          ) : activeView === 'pending' && !search.trim() ? (
            <div className="grid items-start" style={{ gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`, gap: cardGap }}>
              {visibleCases.map((item) => (
                <PendingCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                  onCopy={() => copyImage(coverImage(item))}
                  onFavorite={() => toggleFavorite(item.id)}
                  onDelete={() => requestConfirm({ type: 'case', id: item.id, title: displayTitle(item) })}
                  onDragStart={(event) => handleWorkCardDragStart(event, item.id)}
                  cardHeight={cardHeight}
                  getImageSrc={getImageDisplaySrc}
                />
              ))}
            </div>
          ) : (
            <div className="grid items-start" style={{ gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`, gap: cardGap }}>
              {visibleCases.map((item) => (
                <CaseCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                  onCopy={() => copyImage(coverImage(item))}
                  onFavorite={() => toggleFavorite(item.id)}
                  onDelete={() => requestConfirm({ type: 'case', id: item.id, title: displayTitle(item) })}
                  onRestore={() => restoreCase(item.id)}
                  onPermanentDelete={() => requestConfirm({ type: 'permanent-case', id: item.id, title: displayTitle(item) })}
                  onDragStart={(event) => handleWorkCardDragStart(event, item.id)}
                  cardHeight={cardHeight}
                  getImageSrc={getImageDisplaySrc}
                />
              ))}
            </div>
          )}
        </section>
        )}

        {!sidePanelsCollapsed && !isTraceModule && (
        <div className="min-h-0 bg-[#edf4f8] py-4 pr-4 dark:bg-[#282828]">
        <DetailPanel
          item={visibleSelectedCase}
          collections={data.collections}
          modelDraft={modelDraft}
          modelOpen={modelOpen}
          onModelDraftChange={setModelDraft}
          onModelOpenChange={setModelOpen}
          onAddModelTag={addModelTag}
          onRemoveModelTag={removeModelTag}
          onUpdate={updateCase}
          onCollectionChange={(item, collectionId) => requestMoveWorkToCollection(item.id, collectionId)}
          onMainImageDrop={handleMainImageDrop}
          onAddGuideImages={addGuideImagesToSelected}
          onGuideDrop={handleGuideDrop}
          onGuidePaste={handleGuidePaste}
          onRemoveGuideImage={removeGuideImage}
          onClearGuideImages={(item) => requestConfirm({ type: 'clear-guides', caseId: item.id, title: displayTitle(item) })}
          onCopyGuideImage={(image) => copyImage(image, '\u57ab\u56fe')}
          onCopyMainImage={(image) => copyImage(image, '\u4e3b\u56fe')}
          onToggleOrganized={toggleOrganizedStatus}
          onOpenShareCard={(item) => {
            if (!canUseWriteFeatures()) return;
            setShareCardCaseId(item.id);
          }}
          onCopy={copyText}
          clipboardRequest={smartClipboard.request}
          onSmartClipboardDismiss={smartClipboard.dismissRequest}
          onSmartClipboardFill={fillPromptFromSmartClipboard}
          getImageSrc={getImageDisplaySrc}
        />
        </div>
        )}
      </main>

      {libraryMenuOpen && (
        <div
          className="library-menu"
          data-library-menu="true"
          style={{ top: libraryMenuPosition.top, right: libraryMenuPosition.right }}
        >
          <div className="library-menu-current">当前资源库：{libraryState.currentLibrary?.name ?? '未设置'}</div>
          {visibleRecentLibraries.length > 0 && (
            <>
              <div className="library-menu-section">最近使用</div>
              {visibleRecentLibraries.map((library) => (
                <button key={library.path} type="button" className="library-menu-item" title={library.path} onClick={() => void switchRecentLibrary(library.path)}>
                  {library.name}
                </button>
              ))}
            </>
          )}
          <button type="button" className="library-menu-item" onClick={() => void runLibraryAction('create')}>
            创建新资源库...
          </button>
          <button type="button" className="library-menu-item" onClick={() => void runLibraryAction('add')}>
            添加已有资源库...
          </button>
          <button type="button" className="library-menu-item" onClick={() => void runLibraryAction('open')}>
            打开资源库位置
          </button>
          <button
            type="button"
            className="library-menu-item is-danger"
            onClick={() => {
              setLibraryMenuOpen(false);
              requestConfirm({ type: 'reset-test-data' });
            }}
          >
            重置测试数据（开发用）
          </button>
        </div>
      )}

      {collectionMenu && (
        <div
          className="collection-context-menu"
          data-collection-menu="true"
          style={{ left: collectionMenu.x, top: collectionMenu.y }}
        >
          <button type="button" onClick={() => addCollection(collectionMenu.id)}>
            新建子文件夹
          </button>
          <button
            type="button"
            onClick={() => {
              const collection = data.collections.find((item) => item.id === collectionMenu.id);
              if (collection) startRenameCollection(collection);
              setCollectionMenu(null);
            }}
          >
            重命名
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() => {
              const collection = data.collections.find((item) => item.id === collectionMenu.id);
              if (!collection) return;
              setCollectionMenu(null);
              requestConfirm({ type: 'collection', id: collection.id, name: collection.name, hasContents: collectionHasChildrenOrWorks(collection.id) });
            }}
          >
            删除
          </button>
        </div>
      )}

      {!libraryState.ready && loaded && (
        <LibraryGateDialog
          missing={libraryState.missing}
          onSetupDefault={() => void setupLibrary('default')}
          onChooseCustom={() => void setupLibrary('custom')}
          onAddExisting={() => void setupLibrary('add')}
          onCreateNew={() => void setupLibrary('create')}
        />
      )}

      {postImportCase && (
        <PostImportInfoModal
          item={postImportCase}
          collections={data.collections}
          modelPresets={modelPresets}
          coverSrc={getImageDisplaySrc(coverImage(postImportCase))}
          getImageSrc={getImageDisplaySrc}
          onSkip={skipPostImportInfo}
          onSave={(payload) => savePostImportInfo(postImportCase.id, payload)}
          onAddGuideImages={() => addGuideImagesToImportedCase(postImportCase.id)}
          onGuideDrop={(event) => handleGuideDrop(event, postImportCase.id)}
          onGuidePaste={(event) => handleGuidePaste(event, postImportCase.id)}
          onRemoveGuideImage={removeGuideImage}
        />
      )}

      {clipboardImportDraft && (
        <PostImportInfoModal
          item={clipboardImportDraft}
          collections={data.collections}
          modelPresets={modelPresets}
          coverSrc={getImageDisplaySrc(coverImage(clipboardImportDraft))}
          getImageSrc={getImageDisplaySrc}
          onSkip={skipClipboardImportDraft}
          onSave={saveClipboardImportDraft}
          onAddGuideImages={addGuideImagesToClipboardDraft}
          onGuideDrop={handleClipboardDraftGuideDrop}
          onGuidePaste={handleClipboardDraftGuidePaste}
          onRemoveGuideImage={removeClipboardDraftGuideImage}
        />
      )}

      {shareCardCase && (
        <ShareCardModal
          item={shareCardCase}
          api={picflowApi}
          getWorkImageSrc={getImageDisplaySrc}
          getReferenceImageSrc={getReferenceImageDisplaySrc}
          onClose={() => setShareCardCaseId(null)}
          onToast={setToast}
        />
      )}

      <Toast message={toast} />

      {expiryDialogOpen && <PreviewExpiredDialog onClose={() => setExpiryDialogOpen(false)} />}

      {confirmState && <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} onConfirm={deleteConfirmed} />}
    </div>
  );
}

function BrandHeader(): JSX.Element {
  return (
    <div className="brand-header">
      <div className="brand-identity">
        <div className="brand-logo">
          <TraceNestLogo className="brand-logo-image" />
        </div>
        <div className="brand-name-block">
          <div className="brand-title">图迹</div>
          <div className="brand-en">TraceNest</div>
        </div>
      </div>
    </div>
  );
}

function ClipboardImageConfirm({
  hasSelectedWork,
  onCreateWork,
  onAddGuide,
  onDismiss
}: {
  hasSelectedWork: boolean;
  onCreateWork: () => void;
  onAddGuide: () => void;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/80 bg-white/[0.96] px-3 py-2.5 shadow-[0_14px_34px_rgba(23,32,28,0.14)] dark:border-white/10 dark:bg-[#2f2f2f] dark:shadow-[0_16px_38px_rgba(0,0,0,0.34)]">
      <div>
        <div className="text-xs font-semibold text-stone-900 dark:text-neutral-50">检测到剪贴板图片</div>
        <div className="mt-0.5 text-xs text-stone-700 dark:text-neutral-300">选择如何使用这张图片</div>
      </div>
      <div className="flex items-center gap-2">
        <button className="h-8 rounded-[9px] bg-[#2f2f2f] px-3 text-xs font-medium text-white transition hover:bg-[#222] dark:bg-[#dedede] dark:text-[#222] dark:hover:bg-[#f0f0f0]" onClick={onCreateWork}>
          新建作品
        </button>
        {hasSelectedWork && (
          <button className="h-8 rounded-[9px] border border-black/10 bg-white/70 px-3 text-xs font-medium text-stone-700 transition hover:bg-white dark:border-white/18 dark:bg-[#444] dark:text-neutral-50 dark:hover:bg-[#505050]" onClick={onAddGuide}>
            添加为垫图
          </button>
        )}
        <button className="h-8 rounded-[9px] px-3 text-xs font-medium text-stone-500 transition hover:bg-black/5 hover:text-stone-700 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-200" onClick={onDismiss}>
          忽略
        </button>
      </div>
    </div>
  );
}

function LibraryGateDialog({
  missing,
  onSetupDefault,
  onChooseCustom,
  onAddExisting,
  onCreateNew
}: {
  missing: boolean;
  onSetupDefault: () => void;
  onChooseCustom: () => void;
  onAddExisting: () => void;
  onCreateNew: () => void;
}): JSX.Element {
  return (
    <div className="library-gate">
      <div className="library-gate-panel">
        <div className="library-gate-icon">
          <Database className="h-5 w-5" />
        </div>
        <h2>{missing ? '未找到当前资源库' : '设置你的 TraceNest 资源库'}</h2>
        <p>
          {missing
            ? '可能是资源库文件夹被移动、重命名或删除。你可以重新添加已有资源库，或创建一个新的资源库。'
            : '资源库用于保存你的图片、垫图、Prompt、图集和收藏信息。你可以使用默认位置，也可以选择一个自定义文件夹，方便备份和迁移。'}
        </p>
        {missing ? (
          <div className="library-gate-actions">
            <button className="primary-button" onClick={onAddExisting}>添加已有资源库</button>
            <button className="tool-button" onClick={onCreateNew}>创建新资源库</button>
            <button className="tool-button" onClick={onSetupDefault}>使用默认位置</button>
          </div>
        ) : (
          <div className="library-gate-actions">
            <button className="primary-button" onClick={onSetupDefault}>使用默认位置</button>
            <button className="tool-button" onClick={onChooseCustom}>选择自定义位置</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarSectionHeader({ title, onAction }: { title: string; onAction: () => void }): JSX.Element {
  return (
    <div className="sidebar-section-header">
      <span className="sidebar-section-title">{title}</span>
      <button className="sidebar-section-add" onClick={onAction} aria-label="新建图集" title="新建图集">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function SidebarRow({
  active,
  icon,
  label,
  count,
  onClick,
  onDoubleClick,
  title
}: {
  active: boolean;
  icon: JSX.Element;
  label: string;
  count?: number;
  onClick: () => void;
  onDoubleClick?: () => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      className={`sidebar-row ${active ? 'is-active' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      <span className="sidebar-row-icon">{icon}</span>
      <span className="sidebar-row-label">{label}</span>
      <span className="sidebar-row-count">
        {typeof count === 'number' ? count : ''}
      </span>
    </button>
  );
}

function EmptyState({ dragging, onImport, title, description }: { dragging: boolean; onImport: () => void; title?: string; description?: string }): JSX.Element {
  const defaultTitle = dragging ? '\u677e\u5f00\u4ee5\u5bfc\u5165\u56fe\u7247' : '\u62d6\u5165\u56fe\u7247\uff0c\u5f00\u59cb\u521b\u5efa\u4f60\u7684\u7b2c\u4e00\u4e2a\u4f5c\u54c1';
  const defaultDescription = '\u652f\u6301\u5bfc\u5165\u56fe\u7247\u3001\u62d6\u62fd\u56fe\u7247\u3001\u7c98\u8d34\u622a\u56fe\u3001\u7c98\u8d34\u56fe\u7247\u94fe\u63a5';

  return (
    <div className="flex min-h-[520px] items-center justify-center p-6">
      <div className="w-full max-w-lg px-8 py-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[16px] bg-[#eaf4ff] text-[#2f6f9f] dark:bg-[#383838] dark:text-neutral-300">
          <ImagePlus className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold tracking-[-0.01em]">{title ?? defaultTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-neutral-400">{description ?? defaultDescription}</p>
        <div className="mt-5 flex justify-center">
          <button className="primary-button" onClick={onImport}>
            <Upload className="h-4 w-4" />
            {'\u5bfc\u5165\u56fe\u7247'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CaseCard({
  item,
  selected,
  onSelect,
  onCopy,
  onFavorite,
  onDelete,
  onRestore,
  onPermanentDelete,
  onDragStart,
  cardHeight,
  getImageSrc
}: {
  item: PicFlowCase;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  cardHeight: number;
  getImageSrc: (image?: PicFlowImage) => string;
}): JSX.Element {
  const cover = item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
  return (
    <article
      className={`group relative overflow-hidden rounded-[16px] border bg-white shadow-[0_14px_34px_rgba(31,56,75,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[#b8d9ef] hover:shadow-[0_18px_42px_rgba(31,56,75,0.11)] dark:bg-[#303030] ${
        selected ? 'border-[#9ecdea] ring-1 ring-[#6eb4e9]/20 dark:border-white/35 dark:ring-white/10' : 'border-[#dce9f2] dark:border-[#444]'
      } ${selected ? 'is-selected' : ''}`}
      style={{ height: cardHeight }}
      draggable={!item.deletedAt}
      onDragStart={(event) => {
        if (item.deletedAt) {
          event.preventDefault();
          return;
        }
        onDragStart(event);
      }}
    >
      <button className="block h-full w-full text-left" onClick={onSelect}>
        <div className="relative h-full bg-[#f7fbff] p-1.5 dark:bg-[#383838]">
          {cover ? (
            <CardCoverImage src={getImageSrc(cover)} alt={displayTitle(item)} />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-400 dark:text-neutral-500">
              <ImagePlus className="h-9 w-9" />
            </div>
          )}
        </div>
      </button>
      {item.deletedAt && (
        <div className="absolute left-2 right-2 top-2 z-10 rounded-[8px] bg-stone-950/56 px-2 py-1 text-[11px] text-white backdrop-blur">
          删除于 {formatTime(item.deletedAt)}
        </div>
      )}
      <div className="card-actions">
        {item.deletedAt ? (
          <>
            <IconButton label={'恢复'} onClick={onRestore ?? (() => undefined)}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
            <IconButton label={'永久删除'} subtleDanger onClick={onPermanentDelete ?? (() => undefined)}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        ) : (
          <>
        <IconButton active={item.favorite} label={'\u6536\u85cf'} onClick={onFavorite}>
          <Heart className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton label={'\u590d\u5236\u56fe\u7247'} onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </IconButton>
          </>
        )}
      </div>
      {!item.deletedAt && <div className="card-delete-action">
        <IconButton label={'\u5220\u9664\u4f5c\u54c1'} subtleDanger onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>}
    </article>
  );
}

function PendingCard({
  item,
  selected,
  onSelect,
  onCopy,
  onFavorite,
  onDelete,
  onDragStart,
  cardHeight,
  getImageSrc
}: {
  item: PicFlowCase;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  cardHeight: number;
  getImageSrc: (image?: PicFlowImage) => string;
}): JSX.Element {
  const cover = item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
  return (
    <article
      className={`group relative overflow-hidden rounded-[16px] border bg-white shadow-[0_14px_34px_rgba(31,56,75,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[#b8d9ef] hover:shadow-[0_18px_42px_rgba(31,56,75,0.11)] dark:bg-[#303030] ${selected ? 'is-selected border-[#9ecdea] ring-1 ring-[#6eb4e9]/20 dark:border-white/35 dark:ring-white/10' : 'border-[#dce9f2] dark:border-[#444]'}`}
      style={{ height: cardHeight }}
      draggable
      onDragStart={onDragStart}
    >
      <button className="block h-full w-full text-left" onClick={onSelect}>
        <div className="relative h-full bg-[#f7fbff] p-1.5 dark:bg-neutral-800">
          {cover ? <CardCoverImage src={getImageSrc(cover)} alt={displayTitle(item)} /> : <div className="flex h-full items-center justify-center text-stone-400 dark:text-neutral-500"><ImagePlus className="h-9 w-9" /></div>}
        </div>
      </button>
      <div className="card-actions">
        <IconButton active={item.favorite} label={'\u6536\u85cf'} onClick={onFavorite}>
          <Heart className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton label={'\u590d\u5236\u56fe\u7247'} onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </IconButton>
      </div>
      <div className="card-delete-action">
        <IconButton label={'\u5220\u9664\u4f5c\u54c1'} subtleDanger onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </article>
  );
}

function CardCoverImage({ src, alt }: { src: string; alt: string }): JSX.Element {
  const [orientation, setOrientation] = useState<'landscape' | 'portraitOrSquare' | null>(null);
  const isLandscape = orientation === 'landscape';

  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[11px] ${isLandscape ? 'flex items-center justify-center bg-[#f4f9fd] dark:bg-[#343434]' : 'bg-[#f7fbff] dark:bg-[#383838]'}`}>
      <img
        className={isLandscape ? 'h-full w-full object-contain p-2' : 'h-full w-full object-cover object-top'}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={(event) => {
          const image = event.currentTarget;
          setOrientation(image.naturalWidth > image.naturalHeight ? 'landscape' : 'portraitOrSquare');
        }}
      />
    </div>
  );
}

function DetailPanel({
  item,
  collections,
  modelDraft,
  modelOpen,
  onModelDraftChange,
  onModelOpenChange,
  onAddModelTag,
  onRemoveModelTag,
  onUpdate,
  onCollectionChange,
  onMainImageDrop,
  onAddGuideImages,
  onGuideDrop,
  onGuidePaste,
  onRemoveGuideImage,
  onClearGuideImages,
  onCopyGuideImage,
  onCopyMainImage,
  onToggleOrganized,
  onOpenShareCard,
  onCopy,
  clipboardRequest,
  onSmartClipboardDismiss,
  onSmartClipboardFill,
  getImageSrc
}: {
  item: PicFlowCase | null;
  collections: PicFlowCollection[];
  modelDraft: string;
  modelOpen: boolean;
  onModelDraftChange: (value: string) => void;
  onModelOpenChange: (value: boolean) => void;
  onAddModelTag: (tag?: string) => void;
  onRemoveModelTag: (tag: string) => void;
  onUpdate: (id: string, patch: Partial<PicFlowCase>) => void;
  onCollectionChange: (item: PicFlowCase, collectionId?: string) => void;
  onMainImageDrop: (event: DragEvent<HTMLElement>, item: PicFlowCase) => void;
  onAddGuideImages: () => void;
  onGuideDrop: (event: DragEvent<HTMLElement>, caseId: string) => void;
  onGuidePaste: (event: ReactClipboardEvent<HTMLElement>, caseId: string) => void;
  onRemoveGuideImage: (caseId: string, imageId: string) => void;
  onClearGuideImages: (item: PicFlowCase) => void;
  onCopyGuideImage: (image: PicFlowImage) => void;
  onCopyMainImage: (image?: PicFlowImage) => void;
  onToggleOrganized: (id: string) => void;
  onOpenShareCard: (item: PicFlowCase) => void;
  onCopy: (value: string | undefined, label: string) => void;
  clipboardRequest: { workId: string; text: string; hasExistingPrompt: boolean } | null;
  onSmartClipboardDismiss: () => void;
  onSmartClipboardFill: () => void;
  getImageSrc: (image?: PicFlowImage) => string;
}): JSX.Element {
  if (!item) {
    return (
    <aside className="detail-panel-empty">
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#eaf4ff] text-[#2f6f9f] dark:bg-[#383838] dark:text-neutral-300">
            <MoreHorizontal className="h-6 w-6" />
          </div>
          <h2 className="text-base font-semibold">选择一个作品</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-neutral-400">点击卡片后，可在这里整理主图、垫图、Prompt、模型和来源。</p>
        </div>
      </aside>
    );
  }

  const cover = item.images.find((image) => image.id === item.coverImageId) ?? item.images[0];
  const promptClipboardRequest = clipboardRequest?.workId === item.id ? clipboardRequest : null;

  return (
    <aside className="detail-panel">
      <div className="detail-panel-header">
        <div className="min-w-0">
          <p className="detail-panel-title">作品信息</p>
          <p className="detail-panel-subtitle">{item.status === 'pending' ? '\u5f85\u6574\u7406\u4f5c\u54c1' : '\u5df2\u6574\u7406\u4f5c\u54c1'}</p>
        </div>
      </div>

      <div className="detail-panel-scroll">
        <section className="detail-image-section">
          <div className="detail-section-heading">
            <span>主图</span>
            <div className="flex items-center gap-1">
              <button className="detail-copy-button" onClick={() => onCopyMainImage(cover)} aria-label="复制主图" title="复制主图">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div
            className="group relative h-[244px] overflow-hidden rounded-[10px] bg-[#dfeffc] dark:bg-[#343434]"
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => onMainImageDrop(event, item)}
          >
            {cover ? (
              <img className="h-full w-full object-contain" src={getImageSrc(cover)} alt={displayTitle(item)} />
            ) : (
              <div className="flex h-full items-center justify-center text-stone-400 dark:text-neutral-500">
                <ImagePlus className="h-10 w-10" />
              </div>
            )}
          </div>

          <div
            className="mt-4 outline-none"
            data-guide-dropzone="true"
            tabIndex={0}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onDrop={(event) => onGuideDrop(event, item.id)}
            onPaste={(event) => onGuidePaste(event, item.id)}
          >
            <div className="detail-section-heading mb-2">
              <span>垫图</span>
                {(item.referenceImages ?? []).length > 0 && (
                  <button className="h-7 rounded-lg px-2 text-xs text-stone-400 transition hover:bg-[#eaf4ff] hover:text-[#9d5147] dark:text-neutral-500 dark:hover:bg-[#383838] dark:hover:text-[#d9a19a]" onClick={() => onClearGuideImages(item)}>
                    清空
                  </button>
                )}
            </div>
            {(item.referenceImages ?? []).length === 0 && (
              <button
                type="button"
                className="detail-guide-empty"
                onClick={onAddGuideImages}
              >
                {'\u70b9\u51fb\u3001\u62d6\u62fd\u6216 Ctrl+V \u6dfb\u52a0\u57ab\u56fe'}
              </button>
            )}
            {(item.referenceImages ?? []).length > 0 && (
              <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2.5">
                {(item.referenceImages ?? []).map((image) => (
                  <div key={image.id} className="group relative aspect-square min-w-0 overflow-hidden rounded-[12px] border border-[#dce9f2] bg-white dark:border-[#494949] dark:bg-[#383838]">
                    <img className="h-full w-full object-cover" src={getImageSrc(image)} alt={image.name ?? '垫图'} />
                    <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <button className="icon-button h-7 w-7" onClick={() => onCopyGuideImage(image)} aria-label="复制垫图" title="复制垫图">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button className="icon-button h-7 w-7 text-[#a24f43] dark:text-[#d9a19a]" onClick={() => onRemoveGuideImage(item.id, image.id)} aria-label="删除垫图" title="删除垫图">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="detail-form-section">
          <div className="detail-section-heading mb-2">
            <span>Prompt</span>
            <button className="detail-copy-button" onClick={() => onCopy(item.prompt, 'Prompt')} aria-label={'\u590d\u5236 Prompt'} title={'\u590d\u5236 Prompt'}>
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {promptClipboardRequest && (
            <ClipboardPromptConfirm
              request={promptClipboardRequest}
              onCancel={onSmartClipboardDismiss}
              onConfirm={onSmartClipboardFill}
            />
          )}
          <textarea
            className="field-input min-h-[184px] resize-y leading-6"
            value={item.prompt ?? ''}
            onChange={(event) => onUpdate(item.id, { prompt: event.target.value })}
          />
        </section>

        <section className="detail-form-section detail-meta-section">
          <div className="detail-fields-section">
          <Field label="模型标签">
            <div className="relative" data-model-combobox="true">
              <div className="detail-select-control">
                <input
                  className="detail-select-input"
                  value={modelDraft}
                  onFocus={() => onModelOpenChange(true)}
                  onChange={(event) => {
                    onModelDraftChange(event.target.value);
                    onModelOpenChange(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onAddModelTag();
                    if (event.key === 'Escape') onModelOpenChange(false);
                  }}
                  placeholder="选择或输入模型标签"
                />
                <button className="detail-select-trigger" onClick={() => onModelOpenChange(!modelOpen)} aria-label="展开模型标签" title="展开模型标签">
                  <ChevronDown className={`detail-select-chevron transition ${modelOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                </button>
              </div>
              {modelOpen && (
                <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-md border border-[#d7e5ef] bg-white p-1 shadow-soft dark:border-[#494949] dark:bg-[#363636]">
                  {modelPresets
                    .filter((tag) => tag.toLowerCase().includes(modelDraft.trim().toLowerCase()))
                    .map((tag) => (
                      <button
                        key={tag}
                        className="flex h-9 w-full items-center rounded px-2 text-left text-sm text-stone-700 hover:bg-[#eaf4ff] dark:text-neutral-200 dark:hover:bg-[#444]"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onAddModelTag(tag);
                          onModelOpenChange(false);
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  {modelDraft.trim() && !modelPresets.includes(modelDraft.trim()) && (
                    <button
                      className="flex h-9 w-full items-center rounded px-2 text-left text-sm text-[#2f6f9f] hover:bg-[#eaf4ff] dark:text-[#c7c1b6] dark:hover:bg-[#444]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onAddModelTag();
                        onModelOpenChange(false);
                      }}
                    >
                      添加「{modelDraft.trim()}」
                    </button>
                  )}
                </div>
              )}
            </div>
            {(item.modelTags ?? []).length > 0 && (
            <div className="detail-model-tags">
              {(item.modelTags ?? []).map((tag) => (
                <button
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-xs text-stone-700 hover:border-stone-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                  onClick={() => onRemoveModelTag(tag)}
                  title="点击移除"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
            )}
          </Field>
          <Field label="所属图集">
            <div className="detail-native-select-wrap">
              <select className="detail-native-select" value={item.collectionId ?? ''} onChange={(event) => onCollectionChange(item, event.target.value || undefined)}>
                <option value="">未分类</option>
                {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
              <ChevronDown className="detail-select-chevron detail-native-select-icon" strokeWidth={1.5} />
            </div>
          </Field>
          <Field label="来源链接">
            <div className="detail-source-row">
              <input className="field-input detail-source-input" value={item.sourceUrl ?? ''} onChange={(event) => onUpdate(item.id, { sourceUrl: event.target.value })} placeholder="https://" />
              <button className="detail-source-icon-button" onClick={() => item.sourceUrl && picflowApi.openExternal(item.sourceUrl)} aria-label="打开来源链接" title="打开来源链接">
                <Link className="h-3.5 w-3.5" />
              </button>
              <button className="detail-source-icon-button" onClick={() => onCopy(item.sourceUrl, '来源链接')} aria-label="复制来源链接" title="复制来源链接">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </Field>
          </div>
          <div className="detail-created-time">创建时间：{formatTime(item.createdAt)}</div>
        </section>
      </div>
      <div className="detail-panel-actions">
        <div className="mb-2 flex items-center gap-2">
          <button className="share-card-primary-button min-w-0 flex-1 justify-center" onClick={() => onOpenShareCard(item)}>
            生成分享卡
          </button>
          <div className="group relative shrink-0">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-stone-400 transition hover:bg-[#eaf4ff] hover:text-stone-600 focus:bg-[#eaf4ff] focus:text-stone-600 focus:outline-none dark:text-neutral-500 dark:hover:bg-[#3a3a3a] dark:hover:text-neutral-200 dark:focus:bg-[#3a3a3a] dark:focus:text-neutral-200"
              aria-label="查看分享卡说明"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute bottom-11 right-0 z-30 w-[280px] rounded-[12px] border border-[#d7e5ef] bg-[#fbfbfa] p-3 text-left text-xs leading-6 text-stone-600 opacity-0 shadow-[0_18px_42px_rgba(23,32,28,0.13)] transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-[#464646] dark:bg-[#303030] dark:text-neutral-300 dark:shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
              <p>分享卡会把当前作品的主图、垫图、Prompt 和模型信息整理成一张图片。</p>
              <p className="mt-2">适合用于复盘、分享 AI 生成过程，或整理作品集素材。</p>
              <p className="mt-2">你可以复制为图片，也可以导出为 PNG。</p>
            </div>
          </div>
        </div>
        <button className="organize-secondary-button w-full" onClick={() => onToggleOrganized(item.id)}>
          <Check className="h-4 w-4" />
          {item.status === 'pending' ? '\u6574\u7406\u5b8c\u6210' : '\u6807\u8bb0\u4e3a\u5f85\u6574\u7406'}
        </button>
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="field-group">
      <span className="field-label dark:text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

function PreviewExpiredDialog({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[18px] border border-[#d7e5ef] bg-[#fbfbf8] p-5 shadow-[0_24px_70px_rgba(23,32,28,0.18)] dark:border-[#484848] dark:bg-[#333] dark:text-neutral-100">
        <p className="text-sm leading-6 text-stone-700 dark:text-neutral-200">{expiredPreviewMessage}</p>
        <div className="mt-5 flex justify-end">
          <button className="primary-button" onClick={onClose}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  active,
  label,
  children,
  subtleDanger,
  onClick
}: {
  active?: boolean;
  label: string;
  children: ReactNode;
  subtleDanger?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`card-action-button ${active ? 'is-active' : ''} ${subtleDanger ? 'is-danger' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({ state, onCancel, onConfirm }: { state: NonNullable<ConfirmState>; onCancel: () => void; onConfirm: () => void | Promise<void> }): JSX.Element {
  if (state.type === 'move-work') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-[18px] border border-[#d7e5ef] bg-[#fbfbf8] p-5 shadow-[0_24px_70px_rgba(23,32,28,0.18)] dark:border-[#484848] dark:bg-[#333] dark:text-neutral-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">{'\u79fb\u52a8\u4f5c\u54c1\uff1f'}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-stone-600 dark:text-neutral-300">
                {`\u8be5\u4f5c\u54c1\u5df2\u5b58\u653e\u4e8e\u300c${state.fromCollectionName}\u300d\u56fe\u96c6\u4e2d\u3002\n\n\u6bcf\u4e2a\u4f5c\u54c1\u53ea\u80fd\u5c5e\u4e8e\u4e00\u4e2a\u56fe\u96c6\u3002\n\u662f\u5426\u5c06\u5b83\u79fb\u52a8\u5230\u300c${state.toCollectionName}\u300d\uff1f`}
              </p>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 dark:text-neutral-400 dark:hover:bg-neutral-800" onClick={onCancel} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="tool-button" onClick={onCancel}>{'\u53d6\u6d88'}</button>
            <button className="primary-button" onClick={() => void onConfirm()}>
              {'\u79fb\u52a8'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (state.type === 'trace') {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-[2px]">
        <div className="w-full max-w-md rounded-[18px] border border-[#d7e5ef] bg-[#fbfbf8] p-5 shadow-[0_24px_70px_rgba(23,32,28,0.18)] dark:border-[#484848] dark:bg-[#333] dark:text-neutral-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">确认删除复迹？</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-neutral-300">删除后该复迹会从当前资源库的 traces.json 中移除，不会影响作品库。</p>
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 dark:text-neutral-400 dark:hover:bg-neutral-800" onClick={onCancel} aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="tool-button" onClick={onCancel}>取消</button>
            <button className="danger-button" onClick={() => void onConfirm()}>
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCollection = state.type === 'collection';
  const isPermanentDelete = state.type === 'permanent-case' || state.type === 'permanent-collection';
  const isClearGuides = state.type === 'clear-guides';
  const isReplaceMain = state.type === 'replace-main';
  const isResetTestData = state.type === 'reset-test-data';
  const title = isResetTestData
    ? '确认重置测试数据？'
    : isPermanentDelete
      ? '确认永久删除？'
    : isReplaceMain
      ? '确认替换主图？'
      : isClearGuides
        ? '确认清空垫图？'
        : isCollection
          ? '确认删除图集？'
          : '确认删除作品？';
  const description = isResetTestData
    ? '这会清空当前 TraceNest 的本地测试数据，并让应用下次启动时重新进入资源库初始化流程。此操作仅用于开发测试。'
    : isPermanentDelete
      ? '该操作会从本地数据中真正移除，无法从回收站恢复。'
    : isReplaceMain
      ? '当前作品已有主图。确认后将使用拖入的图片作为新的主图。'
      : isClearGuides
        ? '将移除当前作品的全部垫图，此操作无法撤销。'
        : isCollection
          ? state.hasContents
            ? '该文件夹包含子文件夹或作品，删除后可在回收站恢复。'
            : '该文件夹会移入回收站，之后可在回收站恢复。'
          : '删除后该作品会移入回收站，可在 30 天内恢复。';
  const actionLabel = isReplaceMain ? '替换' : isResetTestData ? '重置' : isClearGuides ? '清空' : isPermanentDelete ? '永久删除' : '删除';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[18px] border border-[#d7e5ef] bg-[#fbfbf8] p-5 shadow-[0_24px_70px_rgba(23,32,28,0.18)] dark:border-[#484848] dark:bg-[#333] dark:text-neutral-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600 dark:text-neutral-300">{description}</p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 dark:text-neutral-400 dark:hover:bg-neutral-800" onClick={onCancel} aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="tool-button" onClick={onCancel}>取消</button>
          <button className="danger-button" onClick={() => void onConfirm()}>
            {!isReplaceMain && <Trash2 className="h-4 w-4" />}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
