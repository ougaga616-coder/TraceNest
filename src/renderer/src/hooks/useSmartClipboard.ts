import { useEffect, useRef, useState } from 'react';
import type { ClipboardPromptRequest } from '../components/ClipboardPromptConfirm';
import type { PicFlowCase, PicFlowClipboardApi } from '../types';
import { isClipboardSafeTarget } from '../utils/clipboardSafeTarget';

type UseSmartClipboardOptions = {
  enabled: boolean;
  selectedWork: PicFlowCase | null;
  modalOpen: boolean;
  movingWork: boolean;
  clipboardApi?: PicFlowClipboardApi;
  onReadError: () => void;
};

type UseSmartClipboardResult = {
  request: ClipboardPromptRequest | null;
  dismissRequest: () => void;
  completeRequest: () => ClipboardPromptRequest | null;
};

export function useSmartClipboard({
  enabled,
  selectedWork,
  modalOpen,
  movingWork,
  clipboardApi,
  onReadError
}: UseSmartClipboardOptions): UseSmartClipboardResult {
  const [request, setRequest] = useState<ClipboardPromptRequest | null>(null);
  const lastDismissedTextRef = useRef('');
  const readingRef = useRef(false);

  useEffect(() => {
    if (!enabled) setRequest(null);
  }, [enabled]);

  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      if (!enabled || !selectedWork || modalOpen || movingWork || request) return;
      if (!isClipboardSafeTarget(event.target)) return;
      if (!clipboardApi?.readText || readingRef.current) return;

      readingRef.current = true;
      try {
        const rawText = await clipboardApi.readText();
        const text = rawText.trim();
        if (!text) return;
        if (text === (selectedWork.prompt ?? '').trim()) return;
        if (text === lastDismissedTextRef.current) return;
        setRequest({
          workId: selectedWork.id,
          text,
          hasExistingPrompt: Boolean((selectedWork.prompt ?? '').trim())
        });
      } catch {
        onReadError();
      } finally {
        readingRef.current = false;
      }
    };

    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [clipboardApi, enabled, modalOpen, movingWork, onReadError, request, selectedWork]);

  const dismissRequest = () => {
    if (request) lastDismissedTextRef.current = request.text;
    setRequest(null);
  };

  const completeRequest = () => {
    const current = request;
    if (current) lastDismissedTextRef.current = '';
    setRequest(null);
    return current;
  };

  return { request, dismissRequest, completeRequest };
}
