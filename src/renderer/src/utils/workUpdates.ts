import type { PicFlowCase } from '../types';

export function updateWork(works: PicFlowCase[], id: string, patch: Partial<PicFlowCase>, updatedAt: string): PicFlowCase[] {
  return works.map((work) => (work.id === id ? { ...work, ...patch, updatedAt } : work));
}
