export type ShareCardRenderData = {
  mainImageSrc: string;
  referenceImageSrcs: string[];
  prompt: string;
  modelTags: string[];
};

const canvasWidth = 900;
const minCanvasHeight = 1200;
const cardInset = 18;
const cardRadius = 30;
const cardPadding = 48;
const contentRadius = 16;

type Point = {
  x: number;
  y: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  const { x, y, width, height } = rect;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillPanel(ctx: CanvasRenderingContext2D, rect: Rect): void {
  roundedRect(ctx, rect, contentRadius);
  ctx.fillStyle = '#f4f7f3';
  ctx.fill();
  ctx.strokeStyle = '#e1e8df';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCoveredImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect, radius: number, background = '#eef1ec'): void {
  ctx.save();
  roundedRect(ctx, rect, radius);
  ctx.fillStyle = background;
  ctx.fill();
  ctx.clip();

  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, rect.x + (rect.width - drawWidth) / 2, rect.y + (rect.height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawMainImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, rect: Rect): void {
  ctx.save();
  roundedRect(ctx, rect, contentRadius);
  ctx.fillStyle = '#eef2ee';
  ctx.fill();
  ctx.clip();

  const coverScale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const coverWidth = image.naturalWidth * coverScale;
  const coverHeight = image.naturalHeight * coverScale;
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.filter = 'blur(22px)';
  ctx.drawImage(image, rect.x + (rect.width - coverWidth) / 2 - 18, rect.y + (rect.height - coverHeight) / 2 - 18, coverWidth + 36, coverHeight + 36);
  ctx.restore();

  ctx.fillStyle = 'rgba(247, 249, 246, 0.42)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  const containScale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * containScale;
  const drawHeight = image.naturalHeight * containScale;
  ctx.drawImage(image, rect.x + (rect.width - drawWidth) / 2, rect.y + (rect.height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, rect: Rect, text: string): void {
  ctx.save();
  roundedRect(ctx, rect, contentRadius);
  ctx.fillStyle = '#eef1ec';
  ctx.fill();
  ctx.strokeStyle = '#d8ddd7';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#87938b';
  ctx.font = '500 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number): void {
  ctx.fillStyle = '#2f3a33';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
}

function breakLongWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const char of word) {
    const nextChunk = chunk + char;
    if (ctx.measureText(nextChunk).width <= maxWidth) {
      chunk = nextChunk;
      continue;
    }
    if (chunk) chunks.push(chunk);
    chunk = char;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      const wordParts = ctx.measureText(word).width > maxWidth ? breakLongWord(ctx, word, maxWidth) : [word];
      for (const part of wordParts) {
        const nextLine = line ? `${line} ${part}` : part;
        if (ctx.measureText(nextLine).width <= maxWidth) {
          line = nextLine;
          continue;
        }
        if (line) lines.push(line);
        line = part;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function drawTags(ctx: CanvasRenderingContext2D, tags: string[], start: Point, maxWidth: number): number {
  let x = start.x;
  let y = start.y;
  const tagHeight = 38;
  const gap = 10;

  ctx.font = '600 19px sans-serif';
  for (const tag of tags.slice(0, 8)) {
    const text = tag.trim() || '\u672a\u6807\u6ce8\u6a21\u578b';
    const width = Math.min(ctx.measureText(text).width + 28, maxWidth);
    if (x + width > start.x + maxWidth) {
      x = start.x;
      y += tagHeight + gap;
    }

    roundedRect(ctx, { x, y, width, height: tagHeight }, 14);
    ctx.fillStyle = '#edf2ee';
    ctx.fill();
    ctx.strokeStyle = '#dce5dd';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#46594f';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 14, y + tagHeight / 2, width - 28);
    x += width + gap;
  }

  return y + tagHeight;
}

function drawBrand(ctx: CanvasRenderingContext2D, cardRect: Rect): void {
  ctx.fillStyle = '#a3ada6';
  ctx.font = '400 17px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('PicFlow / by OMG Design Lab', cardRect.x + cardRect.width - cardPadding, cardRect.y + cardRect.height - 44);
}

export async function renderShareCardToCanvas(canvas: HTMLCanvasElement, data: ShareCardRenderData): Promise<void> {
  canvas.width = canvasWidth;
  canvas.height = minCanvasHeight;
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const cardWidth = canvasWidth - cardInset * 2;
  const contentWidth = cardWidth - cardPadding * 2;
  const contentX = cardInset + cardPadding;
  const prompt = data.prompt.trim() || '\u6682\u65e0 Prompt';

  ctx.font = '400 22px sans-serif';
  const promptLines = wrapText(ctx, prompt, contentWidth - 44);
  const promptLineHeight = 38;
  const promptBoxHeight = Math.max(96, promptLines.length * promptLineHeight + 52);

  const hasReferences = data.referenceImageSrcs.length > 0;
  const titleTop = cardInset + 46;
  const mainTop = cardInset + 126;
  const mainHeight = 410;
  let measuredY = mainTop + mainHeight + 32;
  if (hasReferences) measuredY += 34 + 92 + 32;
  measuredY += 34 + promptBoxHeight + 36;
  measuredY += 34 + 48 + 42;
  const dynamicCanvasHeight = Math.max(minCanvasHeight, Math.ceil(measuredY + 58 + cardInset));

  canvas.height = dynamicCanvasHeight;
  ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.clearRect(0, 0, canvasWidth, dynamicCanvasHeight);

  const cardRect = { x: cardInset, y: cardInset, width: cardWidth, height: dynamicCanvasHeight - cardInset * 2 };
  ctx.save();
  ctx.shadowColor = 'rgba(29, 45, 35, 0.18)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 14;
  roundedRect(ctx, cardRect, cardRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(ctx, cardRect, cardRadius);
  ctx.clip();

  ctx.fillStyle = '#354139';
  ctx.font = '600 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('\u0041\u0049 \u89c6\u89c9\u751f\u6210\u5361', contentX, titleTop);

  ctx.fillStyle = '#9aa59d';
  ctx.font = '400 15px sans-serif';
  ctx.fillText('AI Visual Prompt Card', contentX, titleTop + 34);

  const mainRect = { x: contentX, y: mainTop, width: contentWidth, height: mainHeight };
  const mainImage = await loadImage(data.mainImageSrc);
  if (mainImage) drawMainImage(ctx, mainImage, mainRect);
  else drawPlaceholder(ctx, mainRect, '\u4e3b\u56fe\u6682\u4e0d\u53ef\u7528');

  let cursorY = mainRect.y + mainRect.height + 32;
  const referenceImages = (await Promise.all(data.referenceImageSrcs.slice(0, 6).map(loadImage))).filter(Boolean) as HTMLImageElement[];
  if (referenceImages.length) {
    drawLabel(ctx, '\u57ab\u56fe', contentX, cursorY);
    cursorY += 34;

    const thumbSize = 64;
    const gap = 12;
    const referencePanel = { x: contentX, y: cursorY, width: contentWidth, height: 92 };
    fillPanel(ctx, referencePanel);
    referenceImages.forEach((image, index) => {
      drawCoveredImage(ctx, image, { x: referencePanel.x + 18 + index * (thumbSize + gap), y: referencePanel.y + 14, width: thumbSize, height: thumbSize }, 12, '#f2f5f1');
    });
    cursorY += referencePanel.height + 32;
  }

  drawLabel(ctx, 'Prompt', contentX, cursorY);
  cursorY += 34;
  const promptBox = { x: contentX, y: cursorY, width: contentWidth, height: promptBoxHeight };
  fillPanel(ctx, promptBox);
  ctx.fillStyle = '#47544c';
  ctx.font = '400 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  promptLines.forEach((line, index) => {
    ctx.fillText(line, promptBox.x + 26, promptBox.y + 24 + index * promptLineHeight);
  });

  cursorY += promptBoxHeight + 36;
  drawLabel(ctx, '\u6a21\u578b', contentX, cursorY);
  cursorY += 34;
  const tags = data.modelTags.filter((tag) => tag.trim());
  drawTags(ctx, tags.length ? tags : ['\u672a\u6807\u6ce8\u6a21\u578b'], { x: contentX, y: cursorY }, contentWidth);

  drawBrand(ctx, cardRect);
  ctx.restore();
}

export function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}
