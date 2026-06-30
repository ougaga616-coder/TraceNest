import type { PicFlowCase } from '../types';

export function getSearchableText(work: PicFlowCase): string {
  return [
    work.title,
    work.prompt,
    work.sourceUrl,
    ...(work.modelTags ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchesWorkSearch(work: PicFlowCase, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return getSearchableText(work).includes(normalizedQuery);
}

export function filterWorksByQuery(works: PicFlowCase[], query: string): PicFlowCase[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return works;
  return works.filter((work) => matchesWorkSearch(work, normalizedQuery));
}
