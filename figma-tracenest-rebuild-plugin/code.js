const FONT = 'Inter';

const C = {
  ink: '#18211f',
  text: '#33413f',
  muted: '#7f8a87',
  faint: '#a8b0ad',
  chrome: '#fbfcfb',
  sidebar: '#f7f9f8',
  appBg: '#eef4f2',
  panel: '#ffffff',
  line: '#e2e9e7',
  lineSoft: '#edf2f0',
  blue: '#6f8fa8',
  blueInk: '#496b83',
  blueSoft: '#eaf3f8',
  blueSoft2: '#f4f9fb',
  danger: '#b65d56',
  dark: '#2c3432'
};

const W = 2048;
const H = 1152;
const TOP = 44;
const SIDE = 208;
const DETAIL_X = 1735;
const DETAIL_W = 298;
const GALLERY_W = DETAIL_X - SIDE;

function color(hex, opacity = 1) {
  const h = hex.replace('#', '');
  return {
    type: 'SOLID',
    color: {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255
    },
    opacity
  };
}

function shadow(x, y, blur, hex, a) {
  const c = color(hex).color;
  return {
    type: 'DROP_SHADOW',
    color: { r: c.r, g: c.g, b: c.b, a },
    offset: { x, y },
    radius: blur,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL'
  };
}

function frame(name, x, y, w, h, fill = null, radius = 0) {
  const n = figma.createFrame();
  n.name = name;
  n.x = x;
  n.y = y;
  n.resize(w, h);
  n.fills = fill ? [color(fill)] : [];
  n.strokes = [];
  n.cornerRadius = radius;
  n.clipsContent = true;
  return n;
}

function auto(name, direction, x, y, w, h, fill = null, radius = 0, gap = 0, pad = {}) {
  const n = frame(name, x, y, w, h, fill, radius);
  n.layoutMode = direction;
  n.primaryAxisSizingMode = 'FIXED';
  n.counterAxisSizingMode = 'FIXED';
  n.itemSpacing = gap;
  n.paddingTop = pad.t || 0;
  n.paddingRight = pad.r || 0;
  n.paddingBottom = pad.b || 0;
  n.paddingLeft = pad.l || 0;
  n.primaryAxisAlignItems = pad.main || 'MIN';
  n.counterAxisAlignItems = pad.cross || 'MIN';
  return n;
}

function rect(name, x, y, w, h, fill, radius = 0, stroke = null, opacity = 1) {
  const n = figma.createRectangle();
  n.name = name;
  n.x = x;
  n.y = y;
  n.resize(w, h);
  n.fills = fill ? [color(fill, opacity)] : [];
  n.strokes = stroke ? [color(stroke)] : [];
  n.strokeWeight = stroke ? 1 : 0;
  n.cornerRadius = radius;
  return n;
}

function ellipse(name, x, y, w, h, fill = null, stroke = null) {
  const n = figma.createEllipse();
  n.name = name;
  n.x = x;
  n.y = y;
  n.resize(w, h);
  n.fills = fill ? [color(fill)] : [];
  n.strokes = stroke ? [color(stroke)] : [];
  n.strokeWeight = stroke ? 1 : 0;
  return n;
}

async function txt(name, value, x, y, w, size, fill = C.ink, style = 'Regular', lineHeight = null) {
  const n = figma.createText();
  await figma.loadFontAsync({ family: FONT, style });
  n.name = name;
  n.x = x;
  n.y = y;
  n.resize(w, 1);
  n.fontName = { family: FONT, style };
  n.characters = value;
  n.fontSize = size;
  n.fills = [color(fill)];
  n.lineHeight = { unit: 'PIXELS', value: lineHeight || Math.round(size * 1.45) };
  n.textAutoResize = 'HEIGHT';
  return n;
}

function lineNode(name, x1, y1, x2, y2, stroke = C.muted, weight = 1.6) {
  const n = figma.createLine();
  n.name = name;
  n.x = x1;
  n.y = y1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  n.resize(Math.sqrt(dx * dx + dy * dy), 0);
  n.rotation = Math.atan2(dy, dx) * 180 / Math.PI;
  n.strokes = [color(stroke)];
  n.strokeWeight = weight;
  n.strokeCap = 'ROUND';
  return n;
}

function icon(name, kind, x, y, s = 20, stroke = C.muted) {
  const g = frame(name, x, y, s, s);
  g.clipsContent = false;
  const add = (node) => g.appendChild(node);
  const l = (n, a, b, c, d, w = 1.6) => add(lineNode(n, a, b, c, d, stroke, Math.max(w, s / 13)));
  const e = (n, cx, cy, r, fill = false) => {
    const item = ellipse(n, cx - r, cy - r, r * 2, r * 2, fill ? stroke : null, fill ? null : stroke);
    item.strokeWeight = Math.max(1.5, s / 13);
    add(item);
  };
  if (kind === 'search') {
    e('Lens', s * 0.43, s * 0.42, s * 0.22);
    l('Handle', s * 0.59, s * 0.59, s * 0.79, s * 0.79);
  } else if (kind === 'image') {
    add(rect('Frame', s * 0.18, s * 0.22, s * 0.64, s * 0.56, null, 3, stroke));
    e('Dot', s * 0.36, s * 0.39, s * 0.045, true);
    l('Mountain 1', s * 0.26, s * 0.68, s * 0.43, s * 0.52);
    l('Mountain 2', s * 0.43, s * 0.52, s * 0.56, s * 0.64);
    l('Mountain 3', s * 0.56, s * 0.64, s * 0.74, s * 0.45);
  } else if (kind === 'box') {
    add(rect('Box', s * 0.20, s * 0.28, s * 0.60, s * 0.46, null, 3, stroke));
    l('Top', s * 0.30, s * 0.28, s * 0.42, s * 0.18);
    l('Top 2', s * 0.42, s * 0.18, s * 0.70, s * 0.18);
  } else if (kind === 'heart') {
    e('Left', s * 0.40, s * 0.42, s * 0.13);
    e('Right', s * 0.60, s * 0.42, s * 0.13);
    l('Left edge', s * 0.29, s * 0.50, s * 0.50, s * 0.76);
    l('Right edge', s * 0.71, s * 0.50, s * 0.50, s * 0.76);
  } else if (kind === 'folder') {
    add(rect('Folder tab', s * 0.18, s * 0.30, s * 0.28, s * 0.14, null, 2, stroke));
    add(rect('Folder body', s * 0.16, s * 0.40, s * 0.68, s * 0.38, null, 3, stroke));
  } else if (kind === 'branch') {
    e('A', s * 0.28, s * 0.28, s * 0.065);
    e('B', s * 0.72, s * 0.48, s * 0.065);
    e('C', s * 0.32, s * 0.74, s * 0.065);
    l('AB', s * 0.35, s * 0.31, s * 0.65, s * 0.45);
    l('CB', s * 0.37, s * 0.70, s * 0.65, s * 0.52);
  } else if (kind === 'copy') {
    add(rect('Back', s * 0.25, s * 0.20, s * 0.42, s * 0.50, null, 3, stroke));
    add(rect('Front', s * 0.36, s * 0.31, s * 0.42, s * 0.50, null, 3, stroke));
  } else if (kind === 'database') {
    add(ellipse('Top', s * 0.22, s * 0.20, s * 0.56, s * 0.20, null, stroke));
    l('Left', s * 0.22, s * 0.30, s * 0.22, s * 0.70);
    l('Right', s * 0.78, s * 0.30, s * 0.78, s * 0.70);
    add(ellipse('Bottom', s * 0.22, s * 0.60, s * 0.56, s * 0.20, null, stroke));
  } else if (kind === 'refresh') {
    l('Arc 1', s * 0.28, s * 0.36, s * 0.44, s * 0.24);
    l('Arc 2', s * 0.44, s * 0.24, s * 0.66, s * 0.32);
    l('Arrow 1', s * 0.64, s * 0.20, s * 0.68, s * 0.34);
    l('Arc 3', s * 0.72, s * 0.64, s * 0.56, s * 0.76);
    l('Arc 4', s * 0.56, s * 0.76, s * 0.34, s * 0.68);
    l('Arrow 2', s * 0.36, s * 0.80, s * 0.32, s * 0.66);
  } else if (kind === 'moon') {
    const m = ellipse('Moon', s * 0.24, s * 0.18, s * 0.56, s * 0.64, null, stroke);
    add(m);
  } else if (kind === 'x') {
    l('Slash 1', s * 0.30, s * 0.30, s * 0.70, s * 0.70);
    l('Slash 2', s * 0.70, s * 0.30, s * 0.30, s * 0.70);
  } else if (kind === 'more') {
    e('Dot 1', s * 0.32, s * 0.50, s * 0.05, true);
    e('Dot 2', s * 0.50, s * 0.50, s * 0.05, true);
    e('Dot 3', s * 0.68, s * 0.50, s * 0.05, true);
  } else if (kind === 'upload') {
    l('Up 1', s * 0.50, s * 0.25, s * 0.50, s * 0.66);
    l('Up 2', s * 0.34, s * 0.42, s * 0.50, s * 0.25);
    l('Up 3', s * 0.66, s * 0.42, s * 0.50, s * 0.25);
    l('Base', s * 0.27, s * 0.74, s * 0.73, s * 0.74);
  } else if (kind === 'minus') {
    l('Minus', s * 0.28, s * 0.50, s * 0.72, s * 0.50);
  } else if (kind === 'square') {
    add(rect('Square', s * 0.30, s * 0.30, s * 0.40, s * 0.40, null, 2, stroke));
  }
  return g;
}

async function componentShelf(parent) {
  const shelf = auto('Components', 'VERTICAL', W + 80, 0, 260, 420, null, 0, 14);
  parent.appendChild(shelf);
  const button = figma.createComponent();
  button.name = 'Component / Button';
  button.resize(84, 32);
  button.cornerRadius = 8;
  button.fills = [color(C.blue)];
  button.appendChild(icon('Icon', 'upload', 12, 8, 16, '#ffffff'));
  button.appendChild(await txt('Label', '导入图片', 34, 7, 48, 12, '#ffffff', 'Medium', 16));
  shelf.appendChild(button);

  const input = figma.createComponent();
  input.name = 'Component / Input';
  input.resize(336, 30);
  input.cornerRadius = 10;
  input.fills = [color('#ffffff')];
  input.strokes = [color(C.line)];
  input.appendChild(icon('Search', 'search', 13, 7, 16, C.faint));
  input.appendChild(await txt('Placeholder', '搜索作品 / 粘贴图片链接', 40, 7, 180, 12, C.faint, 'Regular', 16));
  shelf.appendChild(input);

  const sideItem = figma.createComponent();
  sideItem.name = 'Component / Sidebar Item';
  sideItem.resize(182, 28);
  sideItem.cornerRadius = 7;
  sideItem.fills = [color(C.blueSoft)];
  sideItem.appendChild(rect('Active Indicator', 0, 3, 3, 22, C.blue, 99));
  sideItem.appendChild(icon('Icon', 'more', 17, 6, 16, C.blueInk));
  sideItem.appendChild(await txt('Label', '全部作品', 38, 7, 80, 12, C.blueInk, 'Regular', 16));
  sideItem.appendChild(await txt('Count', '0', 163, 7, 16, 12, C.blueInk, 'Regular', 16));
  shelf.appendChild(sideItem);
}

function addReferenceLayer(root) {
  const ref = frame('Reference Screenshot', 0, 0, W, H, '#ffffff', 0);
  ref.locked = true;
  ref.opacity = 0.28;
  root.appendChild(ref);
  ref.appendChild(rect('Reference Background Approximation', 0, 0, W, H, C.chrome));
  ref.appendChild(rect('Reference Sidebar', 0, TOP, SIDE, H - TOP, C.sidebar));
  ref.appendChild(rect('Reference Gallery', SIDE, TOP, GALLERY_W, H - TOP, C.appBg));
  ref.appendChild(rect('Reference Detail Panel', DETAIL_X, 58, DETAIL_W, 1044, '#ffffff', 16));
}

async function addTopbar(root) {
  const top = frame('Topbar', 0, 0, W, TOP, C.chrome);
  top.strokes = [color(C.lineSoft)];
  root.appendChild(top);
  top.appendChild(await txt('Brand Crumb', '图迹', 13, 15, 34, 12, C.ink, 'Semi Bold', 16));
  top.appendChild(await txt('Slash', '/', 53, 15, 8, 12, C.faint, 'Regular', 16));
  top.appendChild(await txt('Current View', '全部作品', 66, 15, 60, 12, C.muted, 'Semi Bold', 16));

  const search = frame('Search Bar', 198, 8, 336, 30, '#ffffff', 10);
  search.strokes = [color(C.line)];
  top.appendChild(search);
  search.appendChild(icon('Search Icon', 'search', 13, 7, 16, C.faint));
  search.appendChild(await txt('Placeholder', '搜索作品 / 粘贴图片链接', 40, 7, 180, 12, C.faint, 'Regular', 16));

  const buttons = [
    ['Library', 'database', 1801],
    ['Refresh', 'refresh', 1834],
    ['Panel Toggle', 'copy', 1869],
    ['Theme', 'moon', 1905]
  ];
  for (const [name, kind, x] of buttons) {
    const b = frame(`Topbar Button / ${name}`, x, 8, 28, 28, '#ffffff', 8);
    b.strokes = [color(C.line)];
    top.appendChild(b);
    b.appendChild(icon('Icon', kind, 7, 7, 14, C.muted));
  }
  top.appendChild(icon('Window Minimize', 'minus', 1963, 14, 14, C.muted));
  top.appendChild(icon('Window Maximize', 'square', 1994, 14, 14, C.muted));
  top.appendChild(icon('Window Close', 'x', 2025, 14, 14, C.muted));
}

async function addSidebar(root) {
  const side = frame('Sidebar', 0, TOP, SIDE, H - TOP, C.sidebar);
  root.appendChild(side);
  const brand = frame('Brand Header', 0, 0, SIDE, 110, C.sidebar);
  side.appendChild(brand);
  const logo = frame('Brand Logo', 14, 18, 36, 36, C.dark, 9);
  brand.appendChild(logo);
  logo.appendChild(await txt('TN', 'TN', 10, 10, 18, 12, '#ffffff', 'Bold', 16));
  brand.appendChild(await txt('Brand Name', '图迹', 58, 21, 52, 20, C.ink, 'Extra Bold', 24));
  brand.appendChild(await txt('Brand English', 'TraceNest', 58, 44, 72, 12, C.muted, 'Bold', 15));
  brand.appendChild(await txt('Description', 'AIGC 视觉灵感库', 14, 68, 130, 13, C.muted, 'Regular', 18));
  brand.appendChild(await txt('Studio', 'by OMG Design Lab', 14, 93, 130, 12, C.faint, 'Regular', 16));
  side.appendChild(rect('Header Divider', 0, 110, SIDE, 1, C.lineSoft));

  await sidebarRow(side, '全部作品', '0', 'more', 14, 129, true);
  await sidebarRow(side, '待整理', '0', 'box', 14, 165, false);
  side.appendChild(rect('Divider / Collections', 14, 209, 182, 1, C.line));
  side.appendChild(await txt('Section / 灵感图集', '灵感图集', 26, 235, 70, 12, C.muted, 'Semi Bold', 16));
  await sidebarRow(side, '我的收藏', '0', 'heart', 14, 277, false);
  await sidebarRow(side, '新建图集', '0', 'folder', 14, 309, false);
  side.appendChild(rect('Divider / Trace', 14, 353, 182, 1, C.line));
  await sidebarRow(side, '创作复迹', '0', 'branch', 14, 387, false);
}

async function sidebarRow(parent, labelText, count, kind, x, y, active) {
  const row = frame(`Sidebar Item / ${labelText}`, x, y, 182, 28, active ? C.blueSoft : null, 7);
  parent.appendChild(row);
  if (active) row.appendChild(rect('Active Indicator', 0, 3, 3, 22, C.blue, 99));
  row.appendChild(icon('Icon', kind, 16, 6, 16, active ? C.blueInk : C.muted));
  row.appendChild(await txt('Label', labelText, 38, 7, 90, 12, active ? C.blueInk : C.muted, 'Regular', 16));
  row.appendChild(await txt('Count', count, 163, 7, 16, 12, active ? C.blueInk : C.faint, 'Regular', 16));
}

async function addGallery(root) {
  const gallery = frame('Gallery', SIDE, TOP, GALLERY_W, H - TOP, C.appBg);
  root.appendChild(gallery);
  gallery.appendChild(await txt('Gallery Title', '全部作品', 22, 22, 70, 12, C.ink, 'Semi Bold', 16));
  gallery.appendChild(await txt('Gallery Count', '0 个作品', 22, 39, 70, 12, C.muted, 'Regular', 16));

  const empty = frame('Empty State', 0, 0, 430, 166);
  empty.x = Math.round((GALLERY_W - 430) / 2);
  empty.y = 180;
  gallery.appendChild(empty);
  const iconShell = frame('Empty State Icon Shell', 190, 0, 52, 52, C.blueSoft2, 12);
  empty.appendChild(iconShell);
  iconShell.appendChild(icon('Image Plus Icon', 'image', 15, 15, 22, C.blueInk));
  empty.appendChild(await txt('Empty Title', '拖入图片，开始创建你的第一个作品', 95, 72, 260, 15, C.ink, 'Semi Bold', 21));
  empty.appendChild(await txt('Empty Description', '支持导入图片、拖拽图片、粘贴截图、粘贴图片链接', 82, 101, 300, 12, C.muted, 'Regular', 18));
  const btn = frame('Button / 导入图片', 184, 132, 84, 32, C.blue, 8);
  btn.effects = [shadow(0, 8, 18, C.blueInk, 0.16)];
  empty.appendChild(btn);
  btn.appendChild(icon('Upload Icon', 'upload', 12, 8, 16, '#ffffff'));
  btn.appendChild(await txt('Label', '导入图片', 34, 8, 48, 12, '#ffffff', 'Medium', 16));
}

async function addDetailPanel(root) {
  const panel = frame('Detail Panel', DETAIL_X, 58, DETAIL_W, 1044, C.panel, 16);
  panel.effects = [shadow(0, 18, 52, '#6f807a', 0.08)];
  root.appendChild(panel);
  const empty = frame('Detail Panel Empty State', 0, 0, 220, 150);
  empty.x = 39;
  empty.y = 462;
  panel.appendChild(empty);
  const iconShell = frame('Detail Empty Icon Shell', 91, 0, 38, 38, C.blueSoft2, 9);
  empty.appendChild(iconShell);
  iconShell.appendChild(icon('More Icon', 'more', 11, 11, 16, C.blueInk));
  empty.appendChild(await txt('Empty Title', '选择一个作品', 70, 54, 90, 13, C.ink, 'Semi Bold', 18));
  empty.appendChild(await txt('Empty Description Line 1', '点击卡片后，可在这里整理主图、垫图、', 18, 82, 190, 12, C.muted, 'Regular', 18));
  empty.appendChild(await txt('Empty Description Line 2', 'Prompt、模型和来源。', 51, 107, 140, 12, C.muted, 'Regular', 18));
}

async function addTraceEntry(root, y) {
  const screen = frame('Trace Entry', 0, y, W, H, C.chrome);
  root.appendChild(screen);
  await addTopbar(screen);
  await addSidebar(screen);
  const body = frame('Trace Entry Body', SIDE, TOP, W - SIDE, H - TOP, C.appBg);
  screen.appendChild(body);
  body.appendChild(await txt('Trace Entry Title', '创作复迹', 28, 26, 110, 20, C.ink, 'Semi Bold', 28));
  body.appendChild(await txt('Trace Entry Description', '用节点画布整理生成思路，复盘你的 AI 视觉创作过程', 28, 60, 360, 14, C.muted, 'Regular', 20));
  const empty = frame('Trace Entry Empty State', 0, 0, 410, 210);
  empty.x = Math.round((W - SIDE - 410) / 2);
  empty.y = 250;
  body.appendChild(empty);
  const shell = frame('Trace Icon Shell', 173, 0, 64, 64, C.blueSoft, 16);
  empty.appendChild(shell);
  shell.appendChild(icon('Branch Icon', 'branch', 18, 18, 28, C.blueInk));
  empty.appendChild(await txt('Trace Empty Title', '还没有创作复迹', 120, 88, 180, 18, C.ink, 'Semi Bold', 26));
  empty.appendChild(await txt('Trace Empty Description', '新建一张复迹图，记录并复盘你的 AI 视觉生成过程', 50, 122, 320, 14, C.muted, 'Regular', 22));
  const btn = frame('Button / 新建', 160, 170, 90, 32, C.blue, 8);
  empty.appendChild(btn);
  btn.appendChild(icon('Plus Icon', 'upload', 14, 8, 16, '#ffffff'));
  btn.appendChild(await txt('Label', '新建', 40, 8, 32, 12, '#ffffff', 'Medium', 16));
}

async function addTraceCanvas(root, y) {
  const screen = frame('Trace Canvas', 0, y, W, H, C.chrome);
  root.appendChild(screen);
  await addTopbar(screen);
  await addSidebar(screen);
  const body = frame('Trace Canvas Body', SIDE, TOP, W - SIDE, H - TOP, '#edf4f7');
  screen.appendChild(body);
  const header = frame('Trace Canvas Header', 0, 0, W - SIDE, 64, '#fbfcfb');
  header.strokes = [color(C.line)];
  body.appendChild(header);
  header.appendChild(await txt('Back Button', '返回', 58, 22, 38, 13, C.text, 'Medium', 18));
  header.appendChild(icon('Back Icon', 'minus', 28, 22, 16, C.muted));
  header.appendChild(await txt('Trace Title', '复迹标题', 128, 22, 140, 14, C.ink, 'Semi Bold', 20));
  header.appendChild(await txt('Insert Work', '插入作品', W - SIDE - 230, 22, 60, 13, C.text, 'Medium', 18));
  header.appendChild(await txt('Export', '导出', W - SIDE - 110, 22, 40, 13, C.text, 'Medium', 18));
  for (let gx = 0; gx < W - SIDE; gx += 24) {
    for (let gy = 64; gy < H - TOP; gy += 24) {
      const d = ellipse('Canvas Grid Dot', gx, gy, 2, 2, '#879395');
      d.fills = [color('#879395', 0.24)];
      body.appendChild(d);
    }
  }
  body.appendChild(await txt('Canvas Empty Hint', '双击空白处新建文字节点', 735, 510, 220, 14, C.muted, 'Medium', 20));
  body.appendChild(await txt('Canvas Empty Subhint', '之后可拖拽图片进来，整理你的创作路径', 700, 538, 300, 12, C.faint, 'Regular', 18));
}

async function addToastAndModal(root, y) {
  const screen = frame('Toast and Modal States', 0, y, W, H, C.appBg);
  root.appendChild(screen);
  const toast = frame('Toast', 934, 470, 180, 38, '#2f2f2f', 12);
  toast.fills = [color('#2f2f2f', 0.96)];
  toast.effects = [shadow(0, 10, 24, '#141414', 0.16)];
  screen.appendChild(toast);
  toast.appendChild(await txt('Toast Message', '已复制图片', 55, 9, 90, 14, '#ffffff', 'Regular', 20));

  const overlay = rect('Modal Backdrop', 0, 0, W, H, '#111111', 0, null, 0.42);
  screen.appendChild(overlay);
  const modal = frame('Modal / Confirm Delete', 1268, 742, 538, 188, '#ffffff', 18);
  modal.effects = [shadow(0, 24, 70, '#17201c', 0.18)];
  screen.appendChild(modal);
  modal.appendChild(await txt('Modal Title', '确认删除作品？', 24, 28, 160, 16, C.ink, 'Semi Bold', 22));
  modal.appendChild(icon('Close Button', 'x', 502, 33, 16, C.muted));
  modal.appendChild(await txt('Modal Description', '删除后该作品将从本地作品库中移除，此操作无法撤销。', 24, 68, 390, 14, C.muted, 'Regular', 22));
  const cancel = frame('Button / 取消', 346, 116, 64, 48, '#ffffff', 10);
  cancel.strokes = [color(C.line)];
  modal.appendChild(cancel);
  cancel.appendChild(await txt('Label', '取消', 18, 14, 30, 14, C.muted, 'Regular', 20));
  const del = frame('Button / 删除', 424, 116, 86, 48, '#fff7f6', 10);
  del.strokes = [color('#f1d7d5')];
  modal.appendChild(del);
  del.appendChild(icon('Trash Icon', 'box', 18, 15, 16, C.danger));
  del.appendChild(await txt('Label', '删除', 43, 14, 30, 14, C.danger, 'Medium', 20));
}

async function main() {
  await Promise.all([
    figma.loadFontAsync({ family: FONT, style: 'Regular' }),
    figma.loadFontAsync({ family: FONT, style: 'Medium' }),
    figma.loadFontAsync({ family: FONT, style: 'Semi Bold' }),
    figma.loadFontAsync({ family: FONT, style: 'Bold' }),
    figma.loadFontAsync({ family: FONT, style: 'Extra Bold' })
  ]);

  const page = figma.currentPage;
  const root = frame('TraceNest Fullscreen UI Reconstruction', 0, 0, W, H * 4 + 240, null, 0);
  page.appendChild(root);

  addReferenceLayer(root);
  await addTopbar(root);
  await addSidebar(root);
  await addGallery(root);
  await addDetailPanel(root);
  await componentShelf(root);
  await addToastAndModal(root, H + 80);
  await addTraceEntry(root, H * 2 + 160);
  await addTraceCanvas(root, H * 3 + 240);

  figma.viewport.scrollAndZoomIntoView([root]);
  figma.closePlugin('TraceNest Fullscreen UI Reconstruction created.');
}

main().catch((error) => {
  figma.closePlugin(`TraceNest reconstruction failed: ${error.message}`);
});
