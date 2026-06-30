import { ArrowLeft, GitBranch } from 'lucide-react';
import type { CreativeTrace } from './traceTypes';

type TraceCanvasProps = {
  trace: CreativeTrace;
  onBack: () => void;
};

export function TraceCanvas({ trace, onBack }: TraceCanvasProps): JSX.Element {
  const centerNode = trace.nodes.find((node) => node.type === 'center') ?? trace.nodes[0];

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#e6eae5] dark:bg-[#252525]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#d8ddd7]/80 bg-[#f7f8f5]/82 px-6 backdrop-blur dark:border-[#3b3b3b] dark:bg-[#2d2d2d]/88">
        <div className="flex min-w-0 items-center gap-3">
          <button className="tool-button h-9 px-2.5" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-stone-800 dark:text-neutral-100">{trace.title}</h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-neutral-500">{trace.nodes.length} 个节点</p>
          </div>
        </div>
      </header>

      <div className="trace-canvas-grid relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 w-[220px] -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-[8px] border border-[#ccd4ca] bg-[#fbfbfa] px-5 py-4 text-center shadow-[0_18px_46px_rgba(23,32,28,0.12)] dark:border-[#555] dark:bg-[#333] dark:shadow-[0_18px_46px_rgba(0,0,0,0.28)]">
            <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#eef1ec] text-[#5f7f69] dark:bg-[#424242] dark:text-neutral-300">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="break-words text-sm font-semibold leading-5 text-stone-800 dark:text-neutral-100">
              {centerNode?.title ?? trace.title}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
