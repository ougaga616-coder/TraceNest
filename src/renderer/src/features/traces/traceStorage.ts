import type { TraceData } from './traceTypes';
import { emptyTraceData } from './traceTypes';

export type TraceApi = {
  loadTraces: () => Promise<TraceData>;
  saveTraces: (data: TraceData) => Promise<TraceData>;
};

const browserStorageKey = 'picflow-browser-preview-traces';

export const fallbackTraceApi: TraceApi = {
  loadTraces: async () => {
    const raw = localStorage.getItem(browserStorageKey);
    return raw ? (JSON.parse(raw) as TraceData) : emptyTraceData;
  },
  saveTraces: async (data: TraceData) => {
    localStorage.setItem(browserStorageKey, JSON.stringify(data));
    return data;
  }
};
