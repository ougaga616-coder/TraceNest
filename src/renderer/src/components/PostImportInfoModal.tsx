import { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent, useEffect, useState } from 'react';
import { Check, ChevronDown, ImagePlus, X } from 'lucide-react';
import type { PicFlowCase, PicFlowCollection, PicFlowImage } from '../types';

export type PostImportInfoPayload = {
  prompt: string;
  modelTags: string[];
  collectionId?: string;
};

type PostImportInfoModalProps = {
  item: PicFlowCase;
  collections: PicFlowCollection[];
  modelPresets: string[];
  coverSrc: string;
  getImageSrc: (image?: PicFlowImage) => string;
  onSkip: () => void;
  onSave: (payload: PostImportInfoPayload) => void | Promise<void>;
  onAddGuideImages: () => void | Promise<void>;
  onGuideDrop: (event: ReactDragEvent<HTMLElement>) => void | Promise<void>;
  onGuidePaste: (event: ReactClipboardEvent<HTMLElement>) => void | Promise<void>;
  onRemoveGuideImage: (caseId: string, imageId: string) => void;
};

function isTextEditingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.matches('input, textarea, select') || element?.closest('[contenteditable="true"]'));
}

export function PostImportInfoModal({
  item,
  collections,
  modelPresets,
  coverSrc,
  getImageSrc,
  onSkip,
  onSave,
  onAddGuideImages,
  onGuideDrop,
  onGuidePaste,
  onRemoveGuideImage
}: PostImportInfoModalProps): JSX.Element {
  const [prompt, setPrompt] = useState(item.prompt ?? '');
  const [modelDraft, setModelDraft] = useState('');
  const [modelTags, setModelTags] = useState<string[]>(item.modelTags ?? []);
  const [collectionId, setCollectionId] = useState(item.collectionId ?? '');

  useEffect(() => {
    setPrompt(item.prompt ?? '');
    setModelTags(item.modelTags ?? []);
    setCollectionId(item.collectionId ?? '');
    setModelDraft('');
  }, [item.id, item.prompt, item.modelTags, item.collectionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  function addModelTag(value?: string): void {
    const tag = (value ?? modelDraft).trim();
    if (!tag || modelTags.includes(tag)) return;
    setModelTags((current) => [...current, tag]);
    setModelDraft('');
  }

  function removeModelTag(tag: string): void {
    setModelTags((current) => current.filter((item) => item !== tag));
  }

  function modelTagsForSave(): string[] {
    const draft = modelDraft.trim();
    if (!draft || modelTags.includes(draft)) return modelTags;
    return [...modelTags, draft];
  }

  async function handlePaste(event: ReactClipboardEvent<HTMLElement>): Promise<void> {
    if (isTextEditingTarget(event.target)) return;
    const imageFile = Array.from(event.clipboardData.files ?? []).find((file) => file.type.startsWith('image/'));
    if (!imageFile) return;
    event.preventDefault();
    event.stopPropagation();
    await onGuidePaste(event);
  }

  return (
    <div
      className="post-import-overlay"
      role="dialog"
      aria-modal="true"
      onPaste={(event) => void handlePaste(event)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onSkip();
      }}
    >
      <div className="post-import-modal">
        <div className="post-import-header">
          <div className="min-w-0">
            <h2 className="post-import-title">{'\u8865\u5145\u4f5c\u54c1\u4fe1\u606f'}</h2>
            <p className="post-import-description">
              {'\u4f60\u53ef\u4ee5\u73b0\u5728\u8865\u5145\u57ab\u56fe\u3001Prompt\u3001\u6a21\u578b\u548c\u56fe\u96c6\uff0c\u4e5f\u53ef\u4ee5\u8df3\u8fc7\u540e\u7a0d\u540e\u6574\u7406\u3002'}
            </p>
          </div>
          <button className="post-import-close-button" onClick={onSkip} aria-label="关闭" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="post-import-content">
          <section className="post-import-section">
            <div className="post-import-label">{'\u4e3b\u56fe\u9884\u89c8'}</div>
            <div className="post-import-main-preview">
              {coverSrc ? (
                <img className="post-import-main-image" src={coverSrc} alt="imported work" />
              ) : (
                <div className="flex h-full items-center justify-center text-stone-400">
                  <ImagePlus className="h-10 w-10" />
                </div>
              )}
            </div>
          </section>

          <section className="post-import-section">
            <div className="post-import-section-header">
              <span className="post-import-label">{'\u57ab\u56fe'}</span>
              <button className="post-import-add-guide-button" onClick={() => void onAddGuideImages()} aria-label="添加垫图" title="添加垫图">
                <ImagePlus className="h-3.5 w-3.5" />
              </button>
            </div>
            {(item.referenceImages ?? []).length === 0 ? (
              <button
                type="button"
                className="post-import-guide-empty"
                onClick={() => void onAddGuideImages()}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => void onGuideDrop(event)}
              >
                {'拖拽图片到这里，或复制图片后粘贴添加'}
              </button>
            ) : (
              <div
                className="post-import-guide-grid"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => void onGuideDrop(event)}
              >
                {(item.referenceImages ?? []).map((image) => (
                  <div key={image.id} className="group relative h-24 w-24 overflow-hidden rounded-[12px] border border-[#d7e5ef] bg-white dark:border-[#494949] dark:bg-[#383838]">
                    <img className="h-full w-full object-cover" src={getImageSrc(image)} alt={image.name ?? 'guide'} />
                    <button
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-lg bg-stone-950/45 text-white opacity-0 transition hover:bg-[#8f3f39] group-hover:opacity-100"
                      onClick={() => onRemoveGuideImage(item.id, image.id)}
                      aria-label="删除垫图"
                      title="删除垫图"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="post-import-field-group">
            <label className="post-import-label">Prompt</label>
            <textarea
              className="field-input post-import-prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="输入或粘贴 Prompt"
            />
          </section>

          <section className="post-import-field-group">
            <label className="post-import-label">{'\u6a21\u578b\u6807\u7b7e'}</label>
            <div className="post-import-model-control">
              <div className="flex flex-wrap items-center gap-2">
                {modelTags.map((tag) => (
                  <button
                    key={tag}
                    className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-[#d7e5ef] bg-[#eaf4ff] px-2.5 text-xs font-medium text-stone-700 transition hover:border-[#a8d2f2] hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    onClick={() => removeModelTag(tag)}
                  >
                    {tag}
                    <X className="h-3 w-3" />
                  </button>
                ))}
                <input
                  className="post-import-model-input"
                  value={modelDraft}
                  onChange={(event) => setModelDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addModelTag();
                    }
                  }}
                  placeholder="选择或输入模型标签"
                  list="post-import-model-presets"
                />
                <datalist id="post-import-model-presets">
                  {modelPresets.map((tag) => <option key={tag} value={tag} />)}
                </datalist>
              </div>
            </div>
          </section>

          <section className="post-import-field-group">
            <label className="post-import-label">{'\u6240\u5c5e\u56fe\u96c6'}</label>
            <div className="post-import-select-wrap">
              <select className="post-import-select" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
                <option value="">{'\u672a\u5206\u7c7b'}</option>
                {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
              </select>
              <ChevronDown className="post-import-select-icon" strokeWidth={1.6} />
            </div>
          </section>
        </div>

        <div className="post-import-footer">
          <button className="tool-button post-import-secondary-button" onClick={onSkip}>{'\u8df3\u8fc7'}</button>
          <button className="primary-button post-import-primary-button" onClick={() => void onSave({ prompt, modelTags: modelTagsForSave(), collectionId: collectionId || undefined })}>
            <Check className="h-4 w-4" />
            {'\u4fdd\u5b58'}
          </button>
        </div>
      </div>
    </div>
  );
}
