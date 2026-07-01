import { ArrowLeft } from 'lucide-react';
import {
  DragEvent as ReactDragEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { resolveWorkImageSrc } from '../../utils/imageDisplay';
import type { CreativeTrace, ImageTraceNode, TextTraceNode, TraceEdge } from './traceTypes';

type CanvasNode = TextTraceNode | ImageTraceNode;

type TraceCanvasProps = {
  trace: CreativeTrace;
  onBack: () => void;
  onRename: (title: string) => void;
  onCreateTextNode: (x: number, y: number) => string;
  onPasteTextNode: (source: Pick<TextTraceNode, 'text' | 'width'>, x: number, y: number) => string;
  onCreateImageNodes: (files: File[], x: number, y: number) => Promise<string[]>;
  onPasteImageNode: (file: File, x: number, y: number) => Promise<string | null>;
  onUpdateTextNode: (nodeId: string, text: string, options?: { removeIfEmpty?: boolean }) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onCreateEdge: (fromNodeId: string, toNodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onUndo: () => boolean;
  onRedo: () => boolean;
  libraryPath?: string;
};

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

type ConnectionState = {
  fromNodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetNodeId: string | null;
};

type PanState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

type NodeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const gridSize = 24;
const pasteOffset = 32;
const minScale = 0.4;
const maxScale = 2;
const scaleStep = 0.08;

export function TraceCanvas({
  trace,
  onBack,
  onRename,
  onCreateTextNode,
  onPasteTextNode,
  onCreateImageNodes,
  onPasteImageNode,
  onUpdateTextNode,
  onMoveNode,
  onDeleteNode,
  onCreateEdge,
  onDeleteEdge,
  onUndo,
  onRedo,
  libraryPath
}: TraceCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const skipTitleBlurSaveRef = useRef(false);
  const skipNodeBlurSaveRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);
  const suppressNextCanvasClickRef = useRef(false);
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(trace.title);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [nodeDraft, setNodeDraft] = useState('');
  const [editingOriginalText, setEditingOriginalText] = useState('');
  const [newEditingNodeId, setNewEditingNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [copiedNode, setCopiedNode] = useState<Pick<TextTraceNode, 'text' | 'width' | 'x' | 'y'> | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [viewport, setViewport] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const canvasNodes = useMemo(
    () => trace.nodes.filter((node): node is CanvasNode => node.type === 'text' || node.type === 'image'),
    [trace.nodes]
  );
  const nodeIds = useMemo(() => new Set(canvasNodes.map((node) => node.id)), [canvasNodes]);
  const validEdges = useMemo(
    () => trace.edges.filter((edge): edge is TraceEdge => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)),
    [nodeIds, trace.edges]
  );

  useEffect(() => {
    if (!isTitleEditing) setTitleDraft(trace.title);
  }, [isTitleEditing, trace.title]);

  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnection(null);
    setDragPreview(null);
  }, [trace.id]);

  useEffect(() => {
    if (!editingNodeId) return;
    const node = canvasNodes.find((item) => item.id === editingNodeId);
    if (!node || node.type !== 'text') {
      setEditingNodeId(null);
      setNodeDraft('');
      setEditingOriginalText('');
    }
  }, [canvasNodes, editingNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.closest('[contenteditable="true"]')) return;
      if (editingNodeId || isTitleEditing) return;

      const key = event.key.toLowerCase();
      const commandKey = event.ctrlKey || event.metaKey;

      if (commandKey && key === 'z') {
        event.preventDefault();
        const changed = event.shiftKey ? onRedo() : onUndo();
        if (changed) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setConnection(null);
          setDragPreview(null);
        }
        return;
      }

      if (commandKey && key === 'c') {
        if (!selectedNodeId) return;
        const node = canvasNodes.find((item) => item.id === selectedNodeId);
        if (!node || node.type !== 'text') return;
        event.preventDefault();
        setCopiedNode({ text: node.text, width: node.width, x: node.x, y: node.y });
        return;
      }

      if (event.key !== 'Delete') return;
      if (!selectedNodeId && !selectedEdgeId) return;
      event.preventDefault();
      if (selectedNodeId) {
        onDeleteNode(selectedNodeId);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        return;
      }
      if (selectedEdgeId) {
        onDeleteEdge(selectedEdgeId);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasNodes, editingNodeId, isTitleEditing, onDeleteEdge, onDeleteNode, onRedo, onUndo, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.closest('[contenteditable="true"]')) return;
      if (editingNodeId || isTitleEditing) return;
      if (event.code !== 'Space') return;
      event.preventDefault();
      setSpacePressed(true);
    };
    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpacePressed(false);
      if (panRef.current) {
        panRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [editingNodeId, isTitleEditing]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.closest('[contenteditable="true"]')) return;
      if (editingNodeId || isTitleEditing) return;
      const imageFile = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith('image/'));
      const point = pastePoint();
      if (imageFile) {
        event.preventDefault();
        void onPasteImageNode(imageFile, point.x, point.y).then((nodeId) => {
          if (nodeId) {
            setSelectedNodeId(nodeId);
            setSelectedEdgeId(null);
          }
        });
        return;
      }
      if (!copiedNode) return;
      event.preventDefault();
      const x = snapToGrid(copiedNode.x + pasteOffset);
      const y = snapToGrid(copiedNode.y + pasteOffset);
      const nodeId = onPasteTextNode(copiedNode, x, y);
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setCopiedNode({ ...copiedNode, x, y });
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [copiedNode, editingNodeId, isTitleEditing, onPasteImageNode, onPasteTextNode]);

  function snapToGrid(value: number): number {
    return Math.round(value / gridSize) * gridSize;
  }

  function clampScale(value: number): number {
    return Math.min(maxScale, Math.max(minScale, value));
  }

  function screenPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function canvasPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const point = screenPoint(clientX, clientY);
    if (!point) return null;
    return {
      x: (point.x - viewport.offsetX) / viewport.scale,
      y: (point.y - viewport.offsetY) / viewport.scale
    };
  }

  function pastePoint(): { x: number; y: number } {
    if (lastCanvasPointRef.current) return lastCanvasPointRef.current;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 120, y: 120 };
    return { x: Math.max(24, rect.width / 2 - 130), y: Math.max(24, rect.height / 2 - 90) };
  }

  function displayNode<T extends CanvasNode>(node: T): T {
    if (dragPreview?.nodeId !== node.id) return node;
    return { ...node, x: dragPreview.x, y: dragPreview.y };
  }

  function fallbackHeight(node: CanvasNode): number {
    return node.type === 'image' ? node.height : 96;
  }

  function nodeBox(node: CanvasNode): NodeBox {
    const display = displayNode(node);
    const element = nodeRefs.current.get(node.id);
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (element && canvasRect) {
      const rect = element.getBoundingClientRect();
      return {
        x: display.x,
        y: display.y,
        width: rect.width ? rect.width / viewport.scale : display.width,
        height: rect.height ? rect.height / viewport.scale : fallbackHeight(display)
      };
    }
    return { x: display.x, y: display.y, width: display.width, height: fallbackHeight(display) };
  }

  function anchorBetween(fromNode: CanvasNode, toNode: CanvasNode): { from: { x: number; y: number }; to: { x: number; y: number } } {
    const from = nodeBox(fromNode);
    const to = nodeBox(toNode);
    const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx >= 0) {
        return {
          from: { x: from.x + from.width, y: fromCenter.y },
          to: { x: to.x, y: toCenter.y }
        };
      }
      return {
        from: { x: from.x, y: fromCenter.y },
        to: { x: to.x + to.width, y: toCenter.y }
      };
    }

    if (dy >= 0) {
      return {
        from: { x: fromCenter.x, y: from.y + from.height },
        to: { x: toCenter.x, y: to.y }
      };
    }
    return {
      from: { x: fromCenter.x, y: from.y },
      to: { x: toCenter.x, y: to.y + to.height }
    };
  }

  function connectorAnchor(node: CanvasNode): { x: number; y: number } {
    const box = nodeBox(node);
    return { x: box.x + box.width, y: box.y + box.height / 2 };
  }

  function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const delta = Math.max(48, Math.abs(to.x - from.x) * 0.45);
    return `M ${from.x} ${from.y} C ${from.x + delta} ${from.y}, ${to.x - delta} ${to.y}, ${to.x} ${to.y}`;
  }

  function targetNodeFromPoint(clientX: number, clientY: number, fromNodeId: string): string | null {
    const target = document
      .elementsFromPoint(clientX, clientY)
      .map((element) => (element as HTMLElement).closest?.('[data-trace-node-id]') as HTMLElement | null)
      .find((element): element is HTMLElement => Boolean(element?.dataset.traceNodeId && element.dataset.traceNodeId !== fromNodeId));
    return target?.dataset.traceNodeId ?? null;
  }

  function startTitleEditing(): void {
    skipTitleBlurSaveRef.current = false;
    setTitleDraft(trace.title);
    setIsTitleEditing(true);
  }

  function saveTitle(): void {
    if (skipTitleBlurSaveRef.current) {
      skipTitleBlurSaveRef.current = false;
      return;
    }
    if (!isTitleEditing) return;
    const title = titleDraft.trim();
    setIsTitleEditing(false);
    if (!title || title === trace.title) {
      setTitleDraft(trace.title);
      return;
    }
    onRename(title);
  }

  function cancelTitleEditing(): void {
    skipTitleBlurSaveRef.current = true;
    setTitleDraft(trace.title);
    setIsTitleEditing(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTitle();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitleEditing();
    }
  }

  function startNodeEditing(node: TextTraceNode, isNew = false): void {
    skipNodeBlurSaveRef.current = false;
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setEditingNodeId(node.id);
    setNodeDraft(node.text);
    setEditingOriginalText(node.text);
    setNewEditingNodeId(isNew ? node.id : null);
  }

  function saveNodeEditing(): void {
    if (skipNodeBlurSaveRef.current) {
      skipNodeBlurSaveRef.current = false;
      return;
    }
    if (!editingNodeId) return;
    const text = nodeDraft.trim();
    const shouldRemove = newEditingNodeId === editingNodeId && !text;
    if (shouldRemove) {
      onUpdateTextNode(editingNodeId, '', { removeIfEmpty: true });
    } else if (text) {
      onUpdateTextNode(editingNodeId, text);
    } else {
      setNodeDraft(editingOriginalText);
    }
    setEditingNodeId(null);
    setEditingOriginalText('');
    setNewEditingNodeId(null);
  }

  function cancelNodeEditing(): void {
    if (!editingNodeId) return;
    skipNodeBlurSaveRef.current = true;
    if (newEditingNodeId === editingNodeId && !editingOriginalText.trim()) {
      onUpdateTextNode(editingNodeId, '', { removeIfEmpty: true });
    }
    setNodeDraft(editingOriginalText);
    setEditingNodeId(null);
    setEditingOriginalText('');
    setNewEditingNodeId(null);
  }

  function handleNodeKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveNodeEditing();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelNodeEditing();
    }
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const pan = panRef.current;
    if (pan) {
      event.preventDefault();
      const offsetX = pan.offsetX + event.clientX - pan.startX;
      const offsetY = pan.offsetY + event.clientY - pan.startY;
      pan.moved = pan.moved || Math.abs(event.clientX - pan.startX) > 3 || Math.abs(event.clientY - pan.startY) > 3;
      setViewport((current) => ({ ...current, offsetX, offsetY }));
      return;
    }
    lastCanvasPointRef.current = canvasPoint(event.clientX, event.clientY);
  }

  function handleCanvasPointerDownCapture(event: PointerEvent<HTMLDivElement>): void {
    if (!spacePressed || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
      moved: false
    };
    setIsPanning(true);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleCanvasPointerUp(event: PointerEvent<HTMLDivElement>): void {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (pan.moved) suppressNextCanvasClickRef.current = true;
    panRef.current = null;
    setIsPanning(false);
  }

  function handleCanvasDoubleClick(event: MouseEvent<HTMLDivElement>): void {
    if (spacePressed || isPanning) return;
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-trace-node="true"]')) return;
    if (target.closest('button, input, textarea, select')) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const width = 240;
    const x = point.x - width / 2;
    const y = point.y - 28;
    const nodeId = onCreateTextNode(x, y);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setEditingNodeId(nodeId);
    setNodeDraft('');
    setEditingOriginalText('');
    setNewEditingNodeId(nodeId);
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>): void {
    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target || target.closest('[data-trace-node="true"]')) return;
    if (target.closest('button, input, textarea, select')) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }

  function handleCanvasDragOver(event: ReactDragEvent<HTMLDivElement>): void {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleCanvasDrop(event: ReactDragEvent<HTMLDivElement>): void {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const x = point.x - 130;
    const y = point.y - 90;
    void onCreateImageNodes(Array.from(event.dataTransfer.files ?? []), x, y).then((ids) => {
      const lastId = ids[ids.length - 1];
      if (lastId) {
        setSelectedNodeId(lastId);
        setSelectedEdgeId(null);
      }
    });
  }

  function handleNodePointerDown(event: PointerEvent<HTMLDivElement>, node: CanvasNode): void {
    if (spacePressed || isPanning) return;
    if (editingNodeId === node.id) return;
    if ((event.target as HTMLElement | null)?.closest('textarea, input, button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const display = displayNode(node);
    dragRef.current = {
      nodeId: node.id,
      offsetX: point.x - display.x,
      offsetY: point.y - display.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false
    };
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setDragPreview({ nodeId: node.id, x: display.x, y: display.y });
  }

  function handleNodePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag) return;
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const x = snapToGrid(point.x - drag.offsetX);
    const y = snapToGrid(point.y - drag.offsetY);
    drag.moved = drag.moved || Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3;
    setDragPreview({ nodeId: drag.nodeId, x, y });
  }

  function handleNodePointerUp(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const point = canvasPoint(event.clientX, event.clientY);
    dragRef.current = null;
    setDragPreview(null);
    if (!drag.moved || !point) return;
    const x = snapToGrid(point.x - drag.offsetX);
    const y = snapToGrid(point.y - drag.offsetY);
    onMoveNode(drag.nodeId, x, y);
  }

  function handleConnectorPointerDown(event: PointerEvent<HTMLButtonElement>, node: CanvasNode): void {
    if (spacePressed || isPanning) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const anchor = connectorAnchor(node);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setConnection({
      fromNodeId: node.id,
      startX: anchor.x,
      startY: anchor.y,
      currentX: point.x,
      currentY: point.y,
      targetNodeId: null
    });
  }

  function handleConnectorPointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (!connection) return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const targetNodeId = targetNodeFromPoint(event.clientX, event.clientY, connection.fromNodeId);
    const fromNode = canvasNodes.find((node) => node.id === connection.fromNodeId);
    const targetNode = targetNodeId ? canvasNodes.find((node) => node.id === targetNodeId) : null;
    const targetAnchor = fromNode && targetNode ? anchorBetween(fromNode, targetNode).to : null;
    setConnection((current) =>
      current
        ? {
            ...current,
            currentX: targetAnchor?.x ?? point.x,
            currentY: targetAnchor?.y ?? point.y,
            targetNodeId
          }
        : current
    );
  }

  function handleConnectorPointerUp(event: PointerEvent<HTMLButtonElement>): void {
    if (!connection) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    const targetNodeId = connection.targetNodeId ?? targetNodeFromPoint(event.clientX, event.clientY, connection.fromNodeId);
    if (targetNodeId && targetNodeId !== connection.fromNodeId) onCreateEdge(connection.fromNodeId, targetNodeId);
    setConnection(null);
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const point = screenPoint(event.clientX, event.clientY);
    if (!point) return;
    setViewport((current) => {
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextScale = clampScale(Number((current.scale + direction * scaleStep).toFixed(2)));
      if (nextScale === current.scale) return current;
      const logicalX = (point.x - current.offsetX) / current.scale;
      const logicalY = (point.y - current.offsetY) / current.scale;
      return {
        scale: nextScale,
        offsetX: point.x - logicalX * nextScale,
        offsetY: point.y - logicalY * nextScale
      };
    });
  }

  const displayedNodes = canvasNodes.map((node) => displayNode(node));
  const displayedNodeMap = new Map(displayedNodes.map((node) => [node.id, node]));

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#e6eae5] dark:bg-[#252525]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d8ddd7]/80 bg-[#f7f8f5]/82 px-6 backdrop-blur dark:border-[#3b3b3b] dark:bg-[#2d2d2d]/88">
        <div className="flex min-w-0 items-center gap-3">
          <button className="tool-button h-9 px-2.5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="min-w-0">
            {isTitleEditing ? (
              <input
                className="field-input h-8 w-[260px] max-w-full px-2 py-1 text-sm font-semibold"
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={handleTitleKeyDown}
              />
            ) : (
              <button className="max-w-full text-left" onDoubleClick={startTitleEditing} title="双击重命名">
                <h2 className="truncate text-sm font-semibold text-stone-800 dark:text-neutral-100">{trace.title}</h2>
              </button>
            )}
            <p className="mt-0.5 text-xs text-stone-500 dark:text-neutral-500">{canvasNodes.length} 个节点</p>
          </div>
        </div>
      </header>

      <div
        ref={canvasRef}
        className={`trace-canvas-grid relative min-h-0 flex-1 overflow-hidden ${isPanning ? 'cursor-grabbing' : spacePressed ? 'cursor-grab' : ''}`}
        style={{
          backgroundSize: `${gridSize * viewport.scale}px ${gridSize * viewport.scale}px`,
          backgroundPosition: `${viewport.offsetX}px ${viewport.offsetY}px`
        }}
        onPointerMove={handleCanvasPointerMove}
        onPointerDownCapture={handleCanvasPointerDownCapture}
        onPointerUp={handleCanvasPointerUp}
        onWheel={handleCanvasWheel}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div
          className="absolute left-0 top-0 z-0"
          style={{
            width: `${100 / viewport.scale}%`,
            height: `${100 / viewport.scale}%`,
            transform: `translate(${viewport.offsetX}px, ${viewport.offsetY}px) scale(${viewport.scale})`,
            transformOrigin: '0 0'
          }}
        >
        <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible">
          {validEdges.map((edge) => {
            const fromNode = displayedNodeMap.get(edge.fromNodeId);
            const toNode = displayedNodeMap.get(edge.toNodeId);
            if (!fromNode || !toNode) return null;
            const anchors = anchorBetween(fromNode, toNode);
            const path = edgePath(anchors.from, anchors.to);
            const selected = selectedEdgeId === edge.id;
            return (
              <g key={edge.id} className="pointer-events-auto">
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="14"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }}
                />
                <path
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth={selected ? 2.5 : 2}
                  className={selected ? 'text-stone-500/60 dark:text-neutral-200/50' : 'text-stone-700/20 dark:text-neutral-100/25'}
                />
              </g>
            );
          })}
          {connection && (
            <path
              d={edgePath({ x: connection.startX, y: connection.startY }, { x: connection.currentX, y: connection.currentY })}
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth="2"
              className="text-stone-700/28 dark:text-neutral-100/32"
            />
          )}
        </svg>

        {canvasNodes.length === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="text-sm font-medium text-stone-500 dark:text-neutral-300">双击空白处新建文字节点</p>
            <p className="mt-2 text-xs leading-5 text-stone-400 dark:text-neutral-500">之后可拖拽图片进来，整理你的创作路径</p>
          </div>
        )}

        {canvasNodes.map((node) => {
          const display = displayNode(node);
          const isEditing = editingNodeId === node.id && node.type === 'text';
          const isSelected = selectedNodeId === node.id || isEditing;
          const imageSrc =
            node.type === 'image'
              ? resolveWorkImageSrc({ id: node.id, localPath: node.imagePath, name: node.name, addedAt: node.createdAt }, libraryPath)
              : '';
          return (
            <div
              key={node.id}
              ref={(element) => {
                if (element) nodeRefs.current.set(node.id, element);
                else nodeRefs.current.delete(node.id);
              }}
              data-trace-node="true"
              data-trace-node-id={node.id}
              className={`group absolute z-10 select-none rounded-[8px] border bg-[#fbfbfa] p-3 text-sm leading-6 transition-colors dark:bg-[#333] ${
                connection?.targetNodeId === node.id
                  ? 'border-[rgba(0,0,0,0.34)] shadow-[0_18px_36px_rgba(23,32,28,0.15)] ring-2 ring-[rgba(0,0,0,0.10)] dark:border-[rgba(255,255,255,0.48)] dark:shadow-[0_18px_36px_rgba(0,0,0,0.3)] dark:ring-2 dark:ring-[rgba(255,255,255,0.10)]'
                  : isSelected
                    ? 'border-[rgba(0,0,0,0.28)] shadow-[0_16px_34px_rgba(23,32,28,0.14)] ring-1 ring-[rgba(0,0,0,0.12)] dark:border-[rgba(255,255,255,0.38)] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)] dark:ring-1 dark:ring-[rgba(255,255,255,0.08)]'
                    : 'border-[#d3d8d1] shadow-[0_12px_28px_rgba(23,32,28,0.08)] dark:border-[#505050] dark:shadow-[0_12px_28px_rgba(0,0,0,0.22)]'
              } ${node.type === 'image' ? 'trace-image-node p-1.5' : ''}`}
              style={{ left: display.x, top: display.y, width: display.width }}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
              onPointerMove={handleNodePointerMove}
              onPointerUp={handleNodePointerUp}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(node.id);
                setSelectedEdgeId(null);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (node.type === 'text') startNodeEditing(node);
              }}
            >
              {node.type === 'text' && isEditing ? (
                <textarea
                  className="min-h-[72px] w-full resize-none border-0 bg-transparent text-sm leading-6 text-stone-800 outline-none placeholder:text-stone-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  autoFocus
                  value={nodeDraft}
                  placeholder="输入内容"
                  onChange={(event) => setNodeDraft(event.target.value)}
                  onBlur={saveNodeEditing}
                  onKeyDown={handleNodeKeyDown}
                />
              ) : (
                <>
                  {node.type === 'text' ? (
                    <div className="whitespace-pre-wrap break-words text-stone-800 dark:text-neutral-100">
                      {node.text || '新节点'}
                    </div>
                  ) : (
                    <div className="trace-image-frame">
                      <img src={imageSrc} alt={node.name ?? 'trace image'} draggable={false} />
                    </div>
                  )}
                  <button
                    type="button"
                    className={`absolute -right-3 top-1/2 z-20 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[rgba(0,0,0,0.18)] bg-[#f4f4f4] text-stone-600 shadow-[0_6px_16px_rgba(23,32,28,0.12)] transition hover:bg-white dark:border-[rgba(255,255,255,0.22)] dark:bg-[#dedede] dark:text-[#222] dark:shadow-[0_6px_16px_rgba(0,0,0,0.22)] ${
                      isSelected || connection?.fromNodeId === node.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-label="创建连接"
                    title="创建连接"
                    onPointerDown={(event) => handleConnectorPointerDown(event, node)}
                    onPointerMove={handleConnectorPointerMove}
                    onPointerUp={handleConnectorPointerUp}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    +
                  </button>
                </>
              )}
            </div>
          );
        })}
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-full border border-black/10 bg-white/72 px-2.5 py-1 text-xs font-medium text-stone-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#2f2f2f]/78 dark:text-neutral-300">
          {Math.round(viewport.scale * 100)}%
        </div>
      </div>
    </section>
  );
}
