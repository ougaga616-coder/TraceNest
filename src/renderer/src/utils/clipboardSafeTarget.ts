const blockedSelector = [
  'input',
  'textarea',
  'select',
  'button',
  'a',
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[data-library-menu="true"]',
  '[data-model-combobox="true"]',
  '[data-guide-dropzone="true"]',
  '[data-smart-clipboard-block="true"]',
  '[data-smart-clipboard-modal="true"]',
  '.toast'
].join(',');

export function isClipboardSafeTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  if (!element.closest('[data-smart-clipboard-safe="true"]')) return false;
  return !element.closest(blockedSelector);
}
