import { X } from 'lucide-react';

export type ClipboardPromptRequest = {
  workId: string;
  text: string;
  hasExistingPrompt: boolean;
};

type ClipboardPromptConfirmProps = {
  request: ClipboardPromptRequest;
  onCancel: () => void;
  onConfirm: () => void;
};

function previewText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 110 ? `${normalized.slice(0, 110)}...` : normalized;
}

export function ClipboardPromptConfirm({ request, onCancel, onConfirm }: ClipboardPromptConfirmProps): JSX.Element {
  const title = request.hasExistingPrompt
    ? '\u5f53\u524d\u4f5c\u54c1\u5df2\u6709 Prompt\uff0c\u662f\u5426\u7528\u526a\u8d34\u677f\u6587\u672c\u66ff\u6362\uff1f'
    : '\u68c0\u6d4b\u5230\u526a\u8d34\u677f\u6587\u672c\uff0c\u662f\u5426\u586b\u5165\u5f53\u524d\u4f5c\u54c1\u7684 Prompt\uff1f';
  const confirmLabel = request.hasExistingPrompt ? '\u66ff\u6362' : '\u586b\u5165 Prompt';
  const cancelLabel = request.hasExistingPrompt ? '\u53d6\u6d88' : '\u5ffd\u7565';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/35 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      data-smart-clipboard-modal="true"
    >
      <div className="w-full max-w-md rounded-[18px] border border-[#d8ddd7] bg-[#fbfbf8] p-5 shadow-[0_24px_70px_rgba(23,32,28,0.18)] dark:border-[#484848] dark:bg-[#333] dark:text-neutral-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold leading-6">{title}</h2>
            <p className="mt-3 max-h-24 overflow-hidden rounded-[12px] border border-[#dbe1da] bg-white/70 px-3 py-2 text-sm leading-6 text-stone-600 dark:border-[#494949] dark:bg-[#2d2d2d] dark:text-neutral-300">
              {previewText(request.text)}
            </p>
          </div>
          <button className="flex h-9 w-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 dark:text-neutral-400 dark:hover:bg-neutral-800" onClick={onCancel} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="tool-button" onClick={onCancel}>{cancelLabel}</button>
          <button className="primary-button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
