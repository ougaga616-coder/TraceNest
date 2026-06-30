export type TraceNodeType = 'center';

export type TraceNode = {
  id: string;
  type: TraceNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
};

export type TraceEdge = Record<string, never>;

export type CreativeTrace = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
};

export type TraceData = {
  traces: CreativeTrace[];
};

export const emptyTraceData: TraceData = { traces: [] };

export function createCenterNode(title: string): TraceNode {
  return {
    id: crypto.randomUUID(),
    type: 'center',
    x: 0,
    y: 0,
    width: 220,
    height: 96,
    title
  };
}

export function createTrace(title = '未命名复迹'): CreativeTrace {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes: [createCenterNode(title)],
    edges: []
  };
}

export function normalizeTraceTitle(value: string): string {
  return value.trim() || '未命名复迹';
}

export function renameTrace(trace: CreativeTrace, titleValue: string): CreativeTrace {
  const title = normalizeTraceTitle(titleValue);
  return {
    ...trace,
    title,
    updatedAt: new Date().toISOString(),
    nodes: trace.nodes.map((node) => (node.type === 'center' ? { ...node, title } : node))
  };
}
