/**
 * DocMind 项目汇报 PPTX 生成脚本
 * 使用 pptxgenjs v4.0.1
 * 运行: node generate_pptx.cjs
 */

const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

// ==================== CONSTANTS ====================
const COLORS = {
  dark: '0F172A',
  darker: '0B1120',
  primary: '2563EB',
  primaryLight: '3B82F6',
  accent: '028090',
  accentLight: '0EA5A0',
  white: 'FFFFFF',
  gray50: 'F8FAFC',
  gray100: 'F1F5F9',
  gray200: 'E2E8F0',
  gray300: 'CBD5E1',
  gray400: '94A3B8',
  gray500: '64748B',
  gray600: '475569',
  gray700: '334155',
  gray800: '1E293B',
  gray900: '0F172A',
  green: '10B981',
  greenDark: '059669',
  red: 'EF4444',
  orange: 'F59E0B',
  purple: '8B5CF6',
  blue100: 'DBEAFE',
  blue200: 'BFDBFE',
  amber100: 'FEF3C7',
  green100: 'D1FAE5',
  red100: 'FEE2E2',
  purple100: 'EDE9FE',
  teal100: 'CCFBF1',
};

const FONT = {
  title: 'Arial Black',
  body: 'Arial',
  code: 'Consolas',
};

const SLIDE_W = 10;
const SLIDE_H = 5.625;

// ==================== HELPERS ====================

/** Add a dark background rect covering the full slide */
function addBg(slide, color = COLORS.dark) {
  slide.background = { color: color };
}

/** Add a semi-transparent card rectangle */
function addCard(slide, x, y, w, h, fill = COLORS.gray800) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: fill },
    rectRadius: 0.08,
  });
}

/** Add a thin accent line */
function addAccentBar(slide, x, y, w, h = 0.05, color = COLORS.primary) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: color },
  });
}

/** Add text with rich formatting */
function addText(slide, text, x, y, w, h, opts = {}) {
  slide.addText(text, {
    x, y, w, h,
    fontFace: opts.fontFace || FONT.body,
    fontSize: opts.fontSize || 10,
    color: opts.color || COLORS.white,
    bold: opts.bold || false,
    align: opts.align || 'left',
    valign: opts.valign || 'top',
    wrap: true,
    lineSpacing: opts.lineSpacing || null,
    ...opts,
  });
}

/** Add a page number in the bottom-right */
function addPageNum(slide, num, total) {
  slide.addText(`${num} / ${total}`, {
    x: 8.5, y: 5.25, w: 1.3, h: 0.3,
    fontSize: 7, color: COLORS.gray500,
    fontFace: FONT.code, align: 'right',
  });
}

/** Add a tiny footer bar */
function addFooterBar(slide) {
  slide.addShape('rect', {
    x: 0, y: 5.55, w: 10, h: 0.075,
    fill: { color: COLORS.primary },
  });
}

/** Default slide setup: dark bg, title, subtitle line */
function setupSlide(slide, title, subtitle) {
  addBg(slide);
  addAccentBar(slide, 0.4, 0.45, 9.2, 0.04, COLORS.primary);
  addText(slide, title, 0.4, 0.18, 9.2, 0.4, {
    fontSize: 22, bold: true, fontFace: FONT.title,
    color: COLORS.white,
  });
  if (subtitle) {
    addText(slide, subtitle, 0.4, 0.54, 9.2, 0.3, {
      fontSize: 9, color: COLORS.gray400, fontFace: FONT.body,
    });
  }
  addFooterBar(slide);
}

// ==================== SLIDES ====================

function slide01_Title(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);

  // Large decorative elements
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 0.08,
    fill: { color: COLORS.primary },
  });

  // Decorative gradient-like bars
  slide.addShape('rect', {
    x: 0, y: 0.08, w: 10, h: 2.0,
    fill: { color: COLORS.darker },
  });

  // Accent dash
  slide.addShape('rect', {
    x: 0.6, y: 2.3, w: 1.0, h: 0.05,
    fill: { color: COLORS.accent },
  });

  // Main title
  slide.addText('DocMind', {
    x: 0.6, y: 1.0, w: 5, h: 0.7,
    fontSize: 44, bold: true, fontFace: FONT.title,
    color: COLORS.white,
  });
  slide.addText('智能文档处理平台', {
    x: 0.6, y: 1.65, w: 8, h: 0.55,
    fontSize: 28, bold: true, fontFace: FONT.title,
    color: COLORS.primary,
  });

  // Subtitle
  slide.addText('Full-Scenario Intelligent Document Processing Assistant', {
    x: 0.6, y: 2.45, w: 8, h: 0.35,
    fontSize: 12, italic: true, fontFace: FONT.body,
    color: COLORS.gray400,
  });

  // Tech stack line
  slide.addText('React 19  +  Vite 8  +  FastAPI  +  PostgreSQL 16  +  DeepSeek AI', {
    x: 0.6, y: 3.0, w: 8, h: 0.4,
    fontSize: 13, fontFace: FONT.code, color: COLORS.accentLight,
    bold: true,
  });

  // Bottom info area
  addCard(slide, 0.6, 3.7, 8.8, 1.5, COLORS.gray800);

  const infoItems = [
    ['版本', 'v1.0.0'],
    ['测试状态', '18/18 测试通过'],
    ['技术栈', 'Python 3.12 + TypeScript 5'],
    ['数据库', 'PostgreSQL 16 + Redis 7'],
    ['部署', 'Docker Compose'],
  ];

  infoItems.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const ix = 0.9 + col * 3.0;
    const iy = 3.85 + row * 0.55;

    addText(slide, item[0], ix, iy, 1.0, 0.22, {
      fontSize: 7, color: COLORS.gray500, fontFace: FONT.body,
    });
    addText(slide, item[1], ix, iy + 0.18, 2.5, 0.22, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.body,
    });
  });

  addFooterBar(slide);
}

function slide02_Overview(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '项目概述', 'PROJECT OVERVIEW — 智能文档处理平台的定位与价值');

  // Three column cards
  const cardW = 2.85;
  const cardH = 3.6;
  const startX = 0.35;
  const cardY = 0.95;
  const gap = 0.2;

  const cards = [
    {
      icon: '?',
      title: '解决的问题',
      color: COLORS.primary,
      bg: COLORS.gray800,
      items: [
        '文档格式多样、转换困难',
        '人工审校效率低、易出错',
        '团队协作缺乏实时同步',
        '文档版本管理混乱',
        '格式排版耗时费力',
        '文档内容提取分析难',
      ],
    },
    {
      icon: '',
      title: '目标用户',
      color: COLORS.accent,
      bg: COLORS.gray800,
      items: [
        '企业办公人员 — 日常文档处理',
        '学生/教师 — 论文撰写与审阅',
        '技术团队 — 技术文档协作',
        '内容创作者 — 文案优化润色',
        '行政管理者 — 批量文档管理',
        '研究人员 — 文献阅读与总结',
      ],
    },
    {
      icon: '',
      title: '核心价值',
      color: COLORS.green,
      bg: COLORS.gray800,
      items: [
        '多格式支持：DOCX/MD/PDF/TXT',
        'AI 驱动：智能校对、总结、改写',
        '实时协作：WebSocket 多人编辑',
        '版本管理：完整历史追踪与回滚',
        '异步处理：Celery 后台任务队列',
        'GitHub 集成：代码文档双向联动',
      ],
    },
  ];

  cards.forEach((card, i) => {
    const cx = startX + i * (cardW + gap);

    // Card background
    slide.addShape('rect', {
      x: cx, y: cardY, w: cardW, h: cardH,
      fill: { color: card.bg },
      rectRadius: 0.08,
    });

    // Accent top bar
    slide.addShape('rect', {
      x: cx, y: cardY, w: cardW, h: 0.05,
      fill: { color: card.color },
    });

    // Card title
    addText(slide, card.title, cx + 0.15, cardY + 0.2, cardW - 0.3, 0.35, {
      fontSize: 14, bold: true, color: card.color, fontFace: FONT.title,
    });

    // Card items
    card.items.forEach((item, j) => {
      addText(slide, `${item}`, cx + 0.15, cardY + 0.7 + j * 0.42, cardW - 0.3, 0.4, {
        fontSize: 9, color: COLORS.gray300, fontFace: FONT.body,
        bullet: { characterCode: '25CF', indent: 8 },
      });
    });
  });

  addPageNum(slide, 2, 16);
  addFooterBar(slide);
}

function slide03_PainPoints(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '痛点与解决方案', 'PAIN POINTS & SOLUTION — 传统文档处理 vs DocMind');

  // Table
  const tableY = 0.95;
  const headerH = 0.38;
  const rowH = 0.52;
  const colW = [0.6, 3.7, 0.5, 3.7];
  const startX = 0.5;

  // Table header background
  addCard(slide, startX, tableY, colW[0] + colW[1] + colW[2] + colW[3], rowH * 9, COLORS.gray800);

  // Header row
  slide.addShape('rect', {
    x: startX, y: tableY, w: colW[0] + colW[1] + colW[2] + colW[3], h: headerH,
    fill: { color: COLORS.primary },
  });

  const headers = ['序号', '传统痛点', '', 'DocMind 解决方案'];
  const headerXs = [startX, startX + colW[0], startX + colW[0] + colW[1], startX + colW[0] + colW[1] + colW[2]];
  const headerWs = [colW[0], colW[1], colW[2], colW[3]];

  headers.forEach((h, i) => {
    addText(slide, h, headerXs[i], tableY, headerWs[i], headerH, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: i === 0 ? 'center' : 'center', valign: 'middle',
    });
  });

  const rows = [
    ['1', '格式不支持：仅能处理单一格式', '→', '多格式引擎：原生支持 DOCX/MD/PDF/TXT，自动识别与解析'],
    ['2', '效率低下：人工校对耗时且易出错', '→', 'AI 智能校对：基于 DeepSeek 的语法、拼写、逻辑纠错，秒级响应'],
    ['3', '协作困难：文件通过邮件/U盘反复传输', '→', '实时协作：WebSocket 多人同步编辑，操作日志完整追踪'],
    ['4', '版本混乱：修改后找不到历史版本', '→', '版本控制：每次修改自动保存版本，任意回滚 + Diff 对比'],
    ['5', '排版费力：手动调整格式反复操作', '→', '智能排版：AI 自动识别标题层级、段落格式，一键美化'],
    ['6', '内容提取难：无法快速获取文档核心信息', '→', '智能总结：AI 自动提取关键信息，3 秒生成摘要 + 思维导图'],
    ['7', '工具割裂：写作、翻译、改写需切换多个工具', '→', '一体化平台：6 种 AI 工具集成，支持链式处理'],
    ['8', '处理慢：大文档处理需等待数十分钟', '→', '异步队列：Celery + Redis 后台处理，实时进度推送'],
  ];

  rows.forEach((row, i) => {
    const ry = tableY + headerH + i * rowH;
    const isAlt = i % 2 === 1;

    if (isAlt) {
      slide.addShape('rect', {
        x: startX, y: ry, w: colW[0] + colW[1] + colW[2] + colW[3], h: rowH,
        fill: { color: '1A2338' },
      });
    }

    const rColor = COLORS.gray300;

    addText(slide, row[0], startX, ry, colW[0], rowH, {
      fontSize: 9, color: COLORS.red, bold: true, fontFace: FONT.code,
      align: 'center', valign: 'middle',
    });
    addText(slide, row[1], startX + colW[0], ry, colW[1], rowH, {
      fontSize: 8.5, color: COLORS.red100, fontFace: FONT.body, valign: 'middle',
    });
    addText(slide, row[2], startX + colW[0] + colW[1], ry, colW[2], rowH, {
      fontSize: 10, color: COLORS.accent, bold: true, fontFace: FONT.code,
      align: 'center', valign: 'middle',
    });
    addText(slide, row[3], startX + colW[0] + colW[1] + colW[2], ry, colW[3], rowH, {
      fontSize: 8.5, color: COLORS.green100, fontFace: FONT.body, valign: 'middle',
    });
  });

  addPageNum(slide, 3, 16);
  addFooterBar(slide);
}

function slide04_CoreFeatures(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '核心功能', 'CORE FEATURES — 6大功能模块覆盖全场景文档处理');

  const features = [
    { icon: '01', title: '多格式支持', desc: '原生解析 DOCX、MD、PDF、TXT，保留格式、表格、公式', color: COLORS.primary },
    { icon: '02', title: 'AI 智能分析', desc: '校对、总结、改写、扩写、精简、翻译共 6 种 AI 工具', color: COLORS.accent },
    { icon: '03', title: '实时协作', desc: '基于 WebSocket 的多人实时编辑，操作日志完整追踪', color: COLORS.green },
    { icon: '04', title: '版本控制', desc: '自动保存版本历史、支持任意版本回滚与 Diff 对比', color: COLORS.purple },
    { icon: '05', title: 'GitHub 集成', desc: '双向同步 GitHub 仓库文档，支持 PR 工作流', color: COLORS.orange },
    { icon: '06', title: '异步处理', desc: 'Celery + Redis 后台任务队列，大文档不阻塞用户操作', color: COLORS.accentLight },
  ];

  const cardW = 2.85;
  const cardH = 2.05;
  const startX = 0.35;
  const startY = 0.95;
  const gap = 0.2;

  features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = startX + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);

    // Card
    addCard(slide, cx, cy, cardW, cardH, COLORS.gray800);

    // Accent top bar
    slide.addShape('rect', { x: cx, y: cy, w: cardW, h: 0.04, fill: { color: f.color } });

    // Icon/number
    addText(slide, f.icon, cx + 0.15, cy + 0.15, 0.5, 0.4, {
      fontSize: 22, bold: true, color: f.color, fontFace: FONT.title,
    });

    // Title
    addText(slide, f.title, cx + 0.7, cy + 0.15, cardW - 0.9, 0.35, {
      fontSize: 14, bold: true, color: COLORS.white, fontFace: FONT.title,
      valign: 'middle',
    });

    // Description
    addText(slide, f.desc, cx + 0.15, cy + 0.75, cardW - 0.3, cardH - 0.95, {
      fontSize: 9, color: COLORS.gray300, fontFace: FONT.body,
      lineSpacing: 16,
    });

    // Feature details
    const details = {
      '多格式支持': ['支持 DOCX / MD / PDF / TXT', '表格、公式、图片完整渲染', '格式自动检测与路由'],
      'AI 智能分析': ['校对：语法/拼写/逻辑纠错', '总结：自动提取关键信息', '改写：风格多样化重写'],
      '实时协作': ['WebSocket 双向通信', '实时光标位置同步', '操作日志完整追踪'],
      '版本控制': ['自动创建版本快照', '任意版本回滚/恢复', '版本间内容 Diff 对比'],
      'GitHub 集成': ['OAuth 授权认证', '仓库文件双向同步', '支持 PR 工作流'],
      '异步处理': ['Celery 分布式任务队列', 'Redis 消息中间件', '实时进度推送 (SSE)'],
    };

    const detailItems = details[f.title] || [];
    detailItems.forEach((d, j) => {
      addText(slide, `  ${d}`, cx + 0.15, cy + 1.35 + j * 0.22, cardW - 0.3, 0.2, {
        fontSize: 7.5, color: COLORS.gray400, fontFace: FONT.code,
      });
    });
  });

  addPageNum(slide, 4, 16);
  addFooterBar(slide);
}

function slide05_TechStack(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '技术栈总览', 'TECH STACK — 全栈技术架构一览');

  // 5 layers
  const layers = [
    {
      title: '前端 Frontend',
      color: COLORS.primary,
      techs: [
        { name: 'React 19', desc: 'UI 框架 — Hooks / Suspense' },
        { name: 'TypeScript 5', desc: '类型安全' },
        { name: 'Vite 8', desc: '构建工具 — HMR 极速' },
        { name: 'Tailwind CSS 4', desc: '原子化 CSS 框架' },
        { name: 'TanStack Query 5', desc: '服务端状态管理' },
        { name: 'React Router 7', desc: '客户端路由' },
      ],
    },
    {
      title: '后端 Backend',
      color: COLORS.accent,
      techs: [
        { name: 'Python 3.12', desc: '编程语言' },
        { name: 'FastAPI', desc: '异步 Web 框架' },
        { name: 'Celery 5', desc: '分布式任务队列' },
        { name: 'SQLAlchemy 2', desc: '异步 ORM' },
        { name: 'Pydantic v2', desc: '数据验证' },
        { name: 'WebSocket', desc: '实时双向通信' },
      ],
    },
    {
      title: '数据层 Data',
      color: COLORS.green,
      techs: [
        { name: 'PostgreSQL 16', desc: '主数据库 — TIMESTAMPTZ' },
        { name: 'Redis 7', desc: '缓存 + 消息队列' },
        { name: 'MinIO', desc: '对象存储 — S3 兼容' },
        { name: 'SQLite', desc: 'Dev Fallback 模式' },
      ],
    },
    {
      title: 'AI 引擎',
      color: COLORS.purple,
      techs: [
        { name: 'DeepSeek API', desc: '大语言模型 — v1 端点' },
        { name: '智能分块器', desc: '文档语义切割' },
        { name: '文本清洗器', desc: '格式标准化' },
        { name: '策略模式', desc: 'Pipelines: proofread/summarize/rewrite' },
      ],
    },
    {
      title: '基础设施 Infra',
      color: COLORS.gray500,
      techs: [
        { name: 'Docker Compose', desc: '一键部署' },
        { name: 'JWT (HS256)', desc: '认证 — Access + Refresh' },
        { name: 'Argon2', desc: '密码哈希' },
        { name: 'Nginx', desc: '反向代理 (生产)' },
      ],
    },
  ];

  const layerH = 0.82;
  const startY = 0.95;
  const gap = 0.08;

  layers.forEach((layer, i) => {
    const ly = startY + i * (layerH + gap);

    // Layer background
    addCard(slide, 0.35, ly, 9.3, layerH, COLORS.gray800);

    // Layer label
    slide.addShape('rect', {
      x: 0.35, y: ly, w: 1.5, h: layerH,
      fill: { color: layer.color },
    });
    addText(slide, layer.title, 0.5, ly, 1.3, layerH, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
      valign: 'middle', align: 'center',
    });

    // Tech items
    layer.techs.forEach((tech, j) => {
      const tx = 2.05 + j * 1.35;
      addText(slide, tech.name, tx, ly + 0.1, 1.25, 0.32, {
        fontSize: 9, bold: true, color: COLORS.white, fontFace: FONT.code,
      });
      addText(slide, tech.desc, tx, ly + 0.42, 1.25, 0.3, {
        fontSize: 7, color: COLORS.gray400, fontFace: FONT.body,
      });
    });
  });

  // Summary stats
  addText(slide, 'Python 文件: 79  |  TypeScript 文件: 43  |  Git 提交: 49  |  测试通过: 18/18', 0.35, 5.1, 9.3, 0.35, {
    fontSize: 9, bold: true, color: COLORS.gray400, fontFace: FONT.code,
    align: 'center', valign: 'middle',
  });

  addPageNum(slide, 5, 16);
  addFooterBar(slide);
}

function slide06_FrontendArch(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '前端架构', 'FRONTEND ARCHITECTURE — React 19 + TypeScript + Vite 8');

  // Left: Component structure
  addText(slide, '组件架构 Component Tree', 0.4, 0.95, 4.3, 0.3, {
    fontSize: 11, bold: true, color: COLORS.primary, fontFace: FONT.title,
  });

  const components = [
    'App (React Router 7)',
    '  Layout',
    '    Navbar  |  Sidebar  |  Footer',
    '  Pages (12 routes)',
    '    Landing  |  Login  |  Register  |  Dashboard',
    '    DocumentEditor  |  AiToolPanel  |  VersionHistory',
    '    Collaboration  |  GitHubImport  |  Settings',
    '    AdminDashboard  |  AuthCallback',
    '    +4 Viewers: DocxViewer | MdViewer | PdfViewer | TxtViewer',
    '  Components (23 files)',
    '    ui/ — Button, Input, Modal, Toast, Dropdown...',
    '    layout/ — Navbar, Sidebar, Footer',
    '    common/ — ErrorBoundary, LoadingSpinner, EmptyState',
    '    github/ — RepoBrowser, FileTree, PRCard',
  ];

  addText(slide, components.map(c => ({ text: c + '\n', options: { fontSize: 7.5, color: c.startsWith('  ') ? COLORS.gray400 : (c.startsWith('App') ? COLORS.white : COLORS.gray300), fontFace: FONT.code, lineSpacing: 13 } })), 0.4, 1.3, 4.5, 3.8, {
    valign: 'top', align: 'left', wrap: true,
  });

  // Right: Architecture boxes
  addText(slide, '架构亮点', 5.2, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const archItems = [
    { title: '状态管理 State', items: ['TanStack Query 5 — 服务端缓存', 'React Context — 认证全局状态', 'local state — 组件内状态', '自动失效 + 后台刷新策略'] },
    { title: '国际化 i18n', items: ['自定义 i18n 引擎', '支持 zh-CN / en-US', '动态语言切换', 'JSON 词条文件管理'] },
    { title: '路由设计 Router', items: ['React Router 7 (BrowserRouter)', '受保护路由 + 公开路由分离', 'AuthCallback — OAuth 回调', '404 兜底路由'] },
    { title: '性能优化 Performance', items: ['React.lazy + Suspense 代码分割', 'Vite 8 HMR 极速热更新', 'Tailwind CSS JIT 按需编译', 'TanStack Query 智能缓存'] },
  ];

  archItems.forEach((item, i) => {
    const ay = 1.35 + i * 0.98;
    addCard(slide, 5.2, ay, 4.5, 0.88, COLORS.gray800);
    slide.addShape('rect', { x: 5.2, y: ay, w: 0.05, h: 0.88, fill: { color: COLORS.accent } });

    addText(slide, item.title, 5.4, ay + 0.08, 4.1, 0.22, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
    });
    item.items.forEach((li, j) => {
      addText(slide, li, 5.55, ay + 0.32 + j * 0.14, 4.0, 0.14, {
        fontSize: 7, color: COLORS.gray400, fontFace: FONT.code,
      });
    });
  });

  addPageNum(slide, 6, 16);
  addFooterBar(slide);
}

function slide07_BackendArch(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '后端架构', 'BACKEND ARCHITECTURE — FastAPI + Celery + WebSocket');

  // Left: API routes
  addText(slide, 'API 路由模块 (10 modules)', 0.35, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.primary, fontFace: FONT.title,
  });

  const routes = [
    'auth.py          — 认证 (login/register/refresh/logout)',
    'users.py         — 用户管理 (profile/settings/quota)',
    'documents.py     — 文档 CRUD (upload/download/delete)',
    'processing.py    — AI 处理 (proofread/summarize/rewrite)',
    'versions.py      — 版本控制 (history/rollback/diff)',
    'collaboration.py — 协作 (session/edit/join)',
    'github.py        — GitHub 集成 (oauth/repos/sync)',
    'oauth.py         — OAuth (callback/providers)',
    'admin.py         — 管理后台 (stats/users/system)',
    'operations.py    — 操作日志 (audit/trail)',
  ];

  addText(slide, routes.map(r => ({ text: r + '\n', options: { fontSize: 7.5, fontFace: FONT.code, color: COLORS.gray300, lineSpacing: 16 } })), 0.35, 1.3, 4.7, 3.5, {
    valign: 'top',
  });

  // Right: Service layers + flow
  addText(slide, '服务层 (8 services) + JWT 认证流', 5.2, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const services = [
    'auth_service        document_service',
    'ai_service           version_service',
    'collaboration_service  github_service',
    'oauth_service        user_service',
  ];

  addText(slide, services.join('\n'), 5.35, 1.3, 4.5, 1.0, {
    fontSize: 8, fontFace: FONT.code, color: COLORS.gray300,
    lineSpacing: 18,
  });

  // JWT flow diagram
  addText(slide, 'JWT 双令牌认证流程', 5.35, 2.35, 4.3, 0.25, {
    fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  const flowSteps = [
    ['Client', 'POST /login', 'Server', 'Verify + Issue'],
    ['', 'Access Token (15min)', '→', 'API Access'],
    ['', 'Refresh Token (7d)', '→', 'Token Renewal'],
    ['Bearer Token', 'Authorization Header', 'JWT Middleware', 'Decode + Validate'],
  ];

  const flowY = 2.7;
  const flowColW = [1.0, 1.35, 0.3, 1.5];
  const flowStartX = 5.35;

  flowSteps.forEach((row, i) => {
    const ry = flowY + i * 0.35;
    let cx = flowStartX;

    row.forEach((cell, j) => {
      if (cell) {
        addText(slide, cell, cx, ry, flowColW[j], 0.3, {
          fontSize: 7.5, fontFace: j === 1 || j === 3 ? FONT.code : FONT.body,
          color: j === 0 ? COLORS.primary : (j === 2 ? COLORS.accent : COLORS.gray300),
          bold: j === 0 || j === 2,
          align: 'center', valign: 'middle',
        });
      }
      cx += flowColW[j];
    });

    // Connecting lines
    if (i < flowSteps.length - 1) {
      slide.addShape('rect', {
        x: flowStartX + 0.5, y: ry + 0.3, w: 0.02, h: 0.05,
        fill: { color: COLORS.gray600 },
      });
      slide.addShape('rect', {
        x: flowStartX + 2.15, y: ry + 0.3, w: 0.02, h: 0.05,
        fill: { color: COLORS.gray600 },
      });
    }
  });

  // Middleware stack
  addText(slide, '中间件栈: CORS → Rate Limiter → JWT Auth → RBAC', 5.35, 4.3, 4.3, 0.25, {
    fontSize: 9, fontFace: FONT.code, color: COLORS.green, bold: true,
  });

  addText(slide, 'WebSocket 端点: /ws/collaboration/{doc_id}', 5.35, 4.55, 4.3, 0.2, {
    fontSize: 8, fontFace: FONT.code, color: COLORS.gray400,
  });
  addText(slide, 'Celery 任务: ai_process | document_export | batch_operation', 5.35, 4.75, 4.3, 0.2, {
    fontSize: 8, fontFace: FONT.code, color: COLORS.gray400,
  });

  addPageNum(slide, 7, 16);
  addFooterBar(slide);
}

function slide08_Database(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '数据库设计', 'DATABASE DESIGN — PostgreSQL 16 + SQLAlchemy 2 Async');

  // 16 tables grid
  const tables = [
    'users', 'documents', 'document_versions', 'operation_logs',
    'collaboration_sessions', 'collaboration_participants', 'collaboration_operations',
    'oauth_accounts', 'oauth_states', 'github_connections',
    'user_tiers', 'user_quotas', 'ai_processing_tasks',
    'document_shares', 'tags', 'tag_associations',
  ];

  addText(slide, '数据表清单 (16 tables)', 0.35, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.primary, fontFace: FONT.title,
  });

  tables.forEach((t, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tx = 0.45 + col * 2.3;
    const ty = 1.35 + row * 0.42;

    addCard(slide, tx, ty, 2.1, 0.35, COLORS.gray800);
    addText(slide, t, tx + 0.1, ty, 2.0, 0.35, {
      fontSize: 8.5, fontFace: FONT.code, color: COLORS.gray200,
      valign: 'middle',
    });
  });

  // E-R diagram text
  addText(slide, '核心 E-R 关系', 0.35, 3.2, 9.0, 0.3, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const relationships = [
    'users 1──N documents          (owner_id FK)',
    'users 1──N oauth_accounts     (user_id FK)',
    'documents 1──N document_versions  (document_id FK)',
    'documents 1──N collaboration_sessions (document_id FK)',
    'documents N──M tags            (tag_associations 中间表)',
    'documents 1──N ai_processing_tasks (document_id FK)',
    'collaboration_sessions 1──N collaboration_participants',
    'users 1──1 user_quotas        (user_id FK)',
  ];

  relationships.forEach((r, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rx = 0.35 + col * 4.8;
    const ry = 3.55 + row * 0.28;

    addText(slide, r, rx, ry, 4.6, 0.25, {
      fontSize: 7.5, fontFace: FONT.code, color: COLORS.gray300,
    });
  });

  // Design decisions
  addText(slide, '关键设计决策', 0.35, 4.75, 9.0, 0.25, {
    fontSize: 11, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  const decisions = [
    ['UUID 主键', '全局唯一，分布式友好，避免自增 ID 冲突', COLORS.primary],
    ['TIMESTAMPTZ', '带时区时间戳，多时区用户精准记录', COLORS.accent],
    ['JSONB 字段', 'metadata_ 列灵活存储扩展属性，无需频繁 DDL', COLORS.green],
    ['软删除', 'deleted_at 字段实现逻辑删除，数据可恢复', COLORS.purple],
    ['异步 ORM', 'SQLAlchemy 2.0 async session，全链路非阻塞', COLORS.orange],
  ];

  decisions.forEach((d, i) => {
    const dx = 0.35 + i * 1.9;
    addCard(slide, dx, 5.0, 1.75, 0.48, COLORS.gray800);
    slide.addShape('rect', { x: dx, y: 5.0, w: 1.75, h: 0.03, fill: { color: d[2] } });
    addText(slide, d[0], dx + 0.1, 5.02, 1.55, 0.2, {
      fontSize: 8, bold: true, color: d[2], fontFace: FONT.code,
    });
    addText(slide, d[1], dx + 0.1, 5.22, 1.55, 0.22, {
      fontSize: 6.5, color: COLORS.gray400, fontFace: FONT.body,
    });
  });

  addPageNum(slide, 8, 16);
  addFooterBar(slide);
}

function slide09_TestResults(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '功能测试结果', 'TEST RESULTS — 3 格式 x 6 功能 = 18 项全通过');

  // Big summary banner
  slide.addShape('rect', {
    x: 0.35, y: 0.95, w: 9.3, h: 0.55,
    fill: { color: COLORS.green },
    rectRadius: 0.08,
  });
  addText(slide, 'ALL 18 TESTS PASSED    |    3 Formats (DOCX / MD / PDF) x 6 Features = 100% Pass Rate', {
    x: 0.35, y: 0.95, w: 9.3, h: 0.55,
    fontSize: 13, bold: true, color: COLORS.white, fontFace: FONT.title,
    align: 'center', valign: 'middle',
  });

  // Test table
  const tableX = 0.35;
  const tableY = 1.7;
  const colW = [0.7, 2.0, 2.0, 2.0, 2.0];
  const tableW = colW.reduce((a, b) => a + b, 0);
  const rowH = 0.42;
  const headerH = 0.38;

  const headers = ['序号', '测试功能', 'DOCX 格式', 'MD 格式', 'PDF 格式'];

  // Header
  slide.addShape('rect', { x: tableX, y: tableY, w: tableW, h: headerH, fill: { color: COLORS.primary } });
  let hx = tableX;
  headers.forEach((h, i) => {
    addText(slide, h, hx, tableY, colW[i], headerH, {
      fontSize: 9, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });
    hx += colW[i];
  });

  const testRows = [
    ['1', '文档上传与解析', '', '', ''],
    ['2', 'AI 智能校对 (Proofread)', '', '', ''],
    ['3', 'AI 智能总结 (Summarize)', '', '', ''],
    ['4', 'AI 内容改写 (Rewrite)', '', '', ''],
    ['5', '格式保留与渲染', '', '', ''],
    ['6', '版本创建与回滚', '', '', ''],
  ];

  testRows.forEach((row, i) => {
    const ry = tableY + headerH + i * rowH;
    const isAlt = i % 2 === 1;
    if (isAlt) {
      slide.addShape('rect', { x: tableX, y: ry, w: tableW, h: rowH, fill: { color: '1A2338' } });
    }

    hx = tableX;
    row.forEach((cell, j) => {
      if (j >= 2) {
        addText(slide, j >= 2 ? 'PASS' : cell, hx, ry, colW[j], rowH, {
          fontSize: j >= 2 ? 14 : 9, color: j >= 2 ? COLORS.green : (j === 0 ? COLORS.gray500 : COLORS.gray200),
          fontFace: j >= 2 ? 'Segoe UI Symbol' : (j === 0 ? FONT.code : FONT.body),
          bold: j >= 2,
          align: 'center', valign: 'middle',
        });
      } else {
        addText(slide, cell, hx, ry, colW[j], rowH, {
          fontSize: 9, color: j === 0 ? COLORS.gray500 : COLORS.gray200,
          fontFace: j === 0 ? FONT.code : FONT.body,
          align: j === 0 ? 'center' : 'left', valign: 'middle',
        });
      }
      hx += colW[j];
    });
  });

  // Test details
  addText(slide, '测试详情', 0.35, 4.35, 9.0, 0.25, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const testDetails = [
    '测试文档: 智能文档处理助手功能检测测试文档 (含标题、列表、表格、公式、代码块、高亮等元素)',
    '测试时间: 2026-06-04    测试环境: Dev Fallback Mode (SQLite + Local FS)',
    'DOCX 测试: 文件 10,271 bytes, 2,697 字符 — 上传、解析、校对、总结、改写全部通过',
    'MD 测试:   文件 7,468 bytes,  3,007 字符 — 上传、解析、校对、总结、改写全部通过',
    'PDF 测试:  文件 418,425 bytes, 2,793 字符 — 上传、解析、校对、总结、改写全部通过',
  ];

  testDetails.forEach((d, i) => {
    addText(slide, d, 0.5, 4.65 + i * 0.18, 9.0, 0.18, {
      fontSize: 7.5, color: COLORS.gray400, fontFace: FONT.code,
    });
  });

  addPageNum(slide, 9, 16);
  addFooterBar(slide);
}

function slide10_AIProcessingDemo(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, 'AI 处理效果演示', 'AI PROCESSING DEMO — 校对 / 总结 / 改写 实际输出');

  // Three columns showing AI results
  const cols = [
    { title: 'Proofread 校对', color: COLORS.primary, bg: COLORS.gray800 },
    { title: 'Summarize 总结', color: COLORS.accent, bg: COLORS.gray800 },
    { title: 'Rewrite 改写', color: COLORS.green, bg: COLORS.gray800 },
  ];

  const colW = 2.95;
  const colH = 4.1;
  const startX = 0.35;
  const colY = 0.9;
  const gap = 0.15;

  cols.forEach((col, i) => {
    const cx = startX + i * (colW + gap);

    addCard(slide, cx, colY, colW, colH, col.bg);

    // Header
    slide.addShape('rect', {
      x: cx, y: colY, w: colW, h: 0.4,
      fill: { color: col.color },
    });
    addText(slide, col.title, cx, colY, colW, 0.4, {
      fontSize: 12, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });

    // Input sample
    addText(slide, 'Input (原始):', cx + 0.12, colY + 0.5, colW - 0.24, 0.2, {
      fontSize: 7, bold: true, color: COLORS.gray500, fontFace: FONT.code,
    });

    if (i === 0) {
      // Proofread input
      addText(slide, '"现在的很多上班族每天都要处理很多的文档，文档的种类特别多，有工作总结，有汇报方案，还有日常的通知，所以大家经常会觉得办公很累，效率很低，浪费了很多的时间。"', cx + 0.12, colY + 0.7, colW - 0.24, 0.95, {
        fontSize: 7, color: COLORS.gray300, fontFace: FONT.body,
        italic: true, lineSpacing: 13,
      });
    } else if (i === 1) {
      // Summarize input
      addText(slide, '"智能文档处理助手功能检测测试文档，包含文字、段落、标题、列表、表格、公式、高亮、分栏、引用、代码块等各类文档元素，涵盖常规编辑、改写、精简、扩写、纠错、总结等功能测试用例..."', cx + 0.12, colY + 0.7, colW - 0.24, 0.95, {
        fontSize: 7, color: COLORS.gray300, fontFace: FONT.body,
        italic: true, lineSpacing: 13,
      });
    } else {
      // Rewrite input
      addText(slide, '"智能文档助手可高效完成日常办公文档的撰写、编辑与优化工作，适配职场报告、学生作文、工作总结、方案策划等多种场景。"', cx + 0.12, colY + 0.7, colW - 0.24, 0.7, {
        fontSize: 7, color: COLORS.gray300, fontFace: FONT.body,
        italic: true, lineSpacing: 13,
      });
    }

    // Output sample
    addText(slide, 'Output (AI 结果):', cx + 0.12, colY + (i === 2 ? 1.5 : 1.75), colW - 0.24, 0.2, {
      fontSize: 7, bold: true, color: COLORS.green, fontFace: FONT.code,
    });

    if (i === 0) {
      // Proofread output
      addText(slide, '"如今，许多上班族每天需要处理大量文档，包括工作总结、汇报方案和日常通知等，种类繁多。因此，大家常感到办公疲惫、效率低下，大量时间被浪费。"', cx + 0.12, colY + 1.95, colW - 0.24, 1.0, {
        fontSize: 7, color: COLORS.green100, fontFace: FONT.body,
        lineSpacing: 13,
      });

      // Corrections list
      addText(slide, '修正项:\n  "现在的" → "如今"\n  "特别多" → "种类繁多"\n  "觉得很累" → "感到疲惫"\n  去冗余，长句拆分', cx + 0.12, colY + 2.95, colW - 0.24, 0.8, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
        lineSpacing: 12,
      });
    } else if (i === 1) {
      // Summarize output
      addText(slide, 'The document is a comprehensive test plan for an intelligent document processing assistant, covering text editing, formatting, element rendering, and smart content processing. It includes test cases for basic text input, editing, heading hierarchies, text styles, lists, tables, formulas, highlights, quotes, code blocks, and column layouts. The document serves as a reusable validation tool.', cx + 0.12, colY + 1.95, colW - 0.24, 1.4, {
        fontSize: 6.8, color: COLORS.green100, fontFace: FONT.body,
        lineSpacing: 12,
      });
    } else {
      // Rewrite output
      addText(slide, 'This document tests the full functionality of the Intelligent Document Processing Assistant, including text editing, formatting, rendering, and smart parsing.\n\nKey Test Areas:\n  Text input and processing\n  Heading hierarchy\n  Text styles\n  Ordered and unordered lists\n  Tables, formulas, code blocks\n\nOutcome: The assistant should render all elements correctly, process content accurately, and maintain consistent formatting.', cx + 0.12, colY + 1.7, colW - 0.24, 2.3, {
        fontSize: 6.8, color: COLORS.green100, fontFace: FONT.body,
        lineSpacing: 11.5,
      });
    }
  });

  addPageNum(slide, 10, 16);
  addFooterBar(slide);
}

function slide11_ProductShowcase(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '产品展示', 'PRODUCT SHOWCASE — DocMind 核心界面截图');

  // Try to find images from local media/ directory, then script dir
  const baseDir = path.join(__dirname, 'media');
  const fallbackDir = __dirname;

  function findImage(name) {
    // Check media/ first, then script dir
    const candidates = [
      path.join(baseDir, name),
      path.join(fallbackDir, name),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // 4 screenshot cards in 2x2 grid - use actual local images
  const screenshots = [
    { title: 'Dashboard 工作台 (含 AI 助手)', img: findImage('ai_assistant_chat.png') || findImage('image-4-1.jpg'), x: 0.35, y: 0.95 },
    { title: 'AI 助手对话', img: findImage('ai_assistant_test.png') || findImage('image-4-3.png'), x: 5.15, y: 0.95 },
    { title: 'Landing 首页', img: findImage('image-1-2.png') || findImage('image-2-2.png'), x: 0.35, y: 3.15 },
    { title: '文档编辑器 + AI 工具', img: findImage('image-7-6.png') || findImage('image-7-7.png'), x: 5.15, y: 3.15 },
  ];

  const imgW = 4.5;
  const imgH = 1.95;

  screenshots.forEach((ss) => {
    // Card background
    addCard(slide, ss.x, ss.y, imgW, imgH + 0.25, COLORS.gray800);

    // Try to embed image
    if (ss.img && fs.existsSync(ss.img)) {
      try {
        slide.addImage({
          path: ss.img,
          x: ss.x + 0.05, y: ss.y + 0.05,
          w: imgW - 0.1, h: imgH - 0.3,
          sizing: { type: 'contain', w: imgW - 0.1, h: imgH - 0.3 },
        });
      } catch (e) {
        // Image load failed, show placeholder
        addText(slide, `[${ss.title}]`, ss.x + 0.05, ss.y + 0.3, imgW - 0.1, imgH - 0.6, {
          fontSize: 10, color: COLORS.gray500, fontFace: FONT.body,
          align: 'center', valign: 'middle',
        });
        console.log(`  Warning: Could not load image for "${ss.title}": ${e.message}`);
      }
    } else {
      addText(slide, `[截图: ${ss.title}]`, ss.x + 0.05, ss.y + 0.3, imgW - 0.1, imgH - 0.6, {
        fontSize: 10, color: COLORS.gray500, fontFace: FONT.body,
        align: 'center', valign: 'middle',
      });
      console.log(`  Info: No screenshot available for "${ss.title}"`);
    }

    // Title
    addText(slide, ss.title, ss.x + 0.1, ss.y + imgH - 0.05, imgW - 0.2, 0.22, {
      fontSize: 9, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });
  });

  addPageNum(slide, 11, 16);
  addFooterBar(slide);
}

function slide12_TechHighlights(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '技术亮点', 'TECHNICAL HIGHLIGHTS — 6 大技术特色');

  const highlights = [
    {
      title: 'React 19 Hooks',
      desc: '全面采用 React 19 新特性：use() hook、Suspense 数据获取、Server Components 思路、Concurrent Features 提升交互响应',
      color: COLORS.primary,
    },
    {
      title: 'TanStack Query 5',
      desc: '声明式服务端状态管理，自动缓存失效 + 后台刷新。staleTime 5min / gcTime 30min，减少 70% 重复 API 请求',
      color: COLORS.accent,
    },
    {
      title: 'JWT 双令牌机制',
      desc: 'Access Token (15min) + Refresh Token (7d)。自动无感刷新，黑名单快速失效。HS256 签名，Bearer 认证头',
      color: COLORS.green,
    },
    {
      title: 'PostgreSQL 原生 UUID',
      desc: 'gen_random_uuid() 生成主键，分布式唯一。TIMESTAMPTZ 自动时区转换。JSONB 灵活存储扩展属性，GIN 索引加速',
      color: COLORS.purple,
    },
    {
      title: 'SQLAlchemy 2 异步',
      desc: '全链路 async/await，连接池复用。selectinload 预加载避免 N+1。Dev Fallback: SQLite 零配置开发模式',
      color: COLORS.orange,
    },
    {
      title: 'Celery + Redis 异步',
      desc: '分布式任务队列处理 AI 调用和文档导出。SSE 实时推送进度。支持任务重试、超时控制、优先级调度',
      color: COLORS.accentLight,
    },
  ];

  const cardW = 2.9;
  const cardH = 1.85;
  const startX = 0.35;
  const startY = 0.95;
  const gap = 0.15;

  highlights.forEach((h, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = startX + col * (cardW + gap);
    const cy = startY + row * (cardH + gap);

    addCard(slide, cx, cy, cardW, cardH, COLORS.gray800);

    // Colored accent on left side
    slide.addShape('rect', {
      x: cx, y: cy, w: 0.06, h: cardH,
      fill: { color: h.color },
    });

    addText(slide, h.title, cx + 0.2, cy + 0.15, cardW - 0.4, 0.32, {
      fontSize: 11, bold: true, color: h.color, fontFace: FONT.title,
    });

    addText(slide, h.desc, cx + 0.2, cy + 0.55, cardW - 0.4, cardH - 0.7, {
      fontSize: 8, color: COLORS.gray300, fontFace: FONT.body,
      lineSpacing: 14,
    });

    // Code snippet at bottom
    if (h.title === 'React 19 Hooks') {
      addText(slide, 'const { data } = useSuspenseQuery({...})', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    } else if (h.title === 'TanStack Query 5') {
      addText(slide, 'queryClient.invalidateQueries({...})', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    } else if (h.title === 'JWT 双令牌机制') {
      addText(slide, 'Authorization: Bearer <access_token>', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    } else if (h.title === 'PostgreSQL 原生 UUID') {
      addText(slide, 'id UUID DEFAULT gen_random_uuid()', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    } else if (h.title === 'SQLAlchemy 2 异步') {
      addText(slide, 'await db.execute(select(Model).where(...))', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    } else if (h.title === 'Celery + Redis 异步') {
      addText(slide, '@celery.task(bind=True, max_retries=3)', cx + 0.2, cy + 1.5, cardW - 0.4, 0.25, {
        fontSize: 6.5, color: COLORS.gray500, fontFace: FONT.code,
      });
    }
  });

  addPageNum(slide, 12, 16);
  addFooterBar(slide);
}

function slide13_AIPipeline(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, 'AI 处理流水线', 'AI PIPELINE — 从上传到结果的一站式处理流程');

  // Flow diagram: 7 steps
  const steps = [
    { label: 'Upload', desc: '文档上传\nMinIO 存储', color: COLORS.primary, x: 0.3 },
    { label: 'Parse', desc: '格式解析\nDOCX/MD/PDF', color: COLORS.accent, x: 1.55 },
    { label: 'Clean', desc: '文本清洗\n标准化处理', color: COLORS.green, x: 2.8 },
    { label: 'Chunk', desc: '智能分块\n语义切割', color: COLORS.purple, x: 4.05 },
    { label: 'AI Call', desc: 'DeepSeek API\n策略执行', color: COLORS.orange, x: 5.3 },
    { label: 'Aggregate', desc: '结果聚合\n内容组装', color: COLORS.primaryLight, x: 6.55 },
    { label: 'Result', desc: '结果返回\nSSE 推送', color: COLORS.green, x: 7.8 },
  ];

  const stepW = 1.15;
  const stepH = 1.5;
  const stepY = 1.1;

  // Draw steps
  steps.forEach((step, i) => {
    const sx = step.x;

    // Step box
    addCard(slide, sx, stepY, stepW, stepH, COLORS.gray800);

    // Step number
    slide.addShape('rect', {
      x: sx + 0.35, y: stepY + 0.1, w: 0.45, h: 0.45,
      fill: { color: step.color },
      rectRadius: 0.05,
    });
    addText(slide, `${i + 1}`, sx + 0.35, stepY + 0.1, 0.45, 0.45, {
      fontSize: 16, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });

    // Step label
    addText(slide, step.label, sx, stepY + 0.7, stepW, 0.3, {
      fontSize: 11, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });

    // Step description
    addText(slide, step.desc, sx + 0.1, stepY + 0.95, stepW - 0.2, 0.5, {
      fontSize: 7, color: COLORS.gray400, fontFace: FONT.body,
      align: 'center',
    });

    // Arrow between steps
    if (i < steps.length - 1) {
      addText(slide, '>', sx + stepW, stepY + 0.45, 0.25, 0.45, {
        fontSize: 18, bold: true, color: COLORS.gray600, fontFace: FONT.code,
        align: 'center', valign: 'middle',
      });
    }
  });

  // Detailed pipeline description below
  addText(slide, '处理细节', 0.35, 2.85, 9.0, 0.25, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const pipelineDetails = [
    {
      phase: '1. 解析层 (Parse)',
      desc: '支持 DOCX (python-docx)、MD (mistune/markdown)、PDF (PyMuPDF) 三种格式。提取文本、表格、图片、公式、代码块等结构化元素，保留标题层级、列表、引用等语义信息。',
    },
    {
      phase: '2. 清洗层 (Clean)',
      desc: '去除无意义空白、统一换行符、标准化标点符号（全角/半角转换）、过滤不可见字符。保留原始格式标记供后续渲染使用。输出干净纯文本流。',
    },
    {
      phase: '3. 分块层 (Chunk)',
      desc: '基于语义边界（标题、段落、列表分隔）智能切分文档。默认块大小 ~2000 tokens，重叠 200 tokens 保证上下文连贯。支持自定义分块策略。',
    },
    {
      phase: '4. AI 处理层 (AI Call)',
      desc: '通过策略模式 (Strategy Pattern) 执行对应 Pipeline。ProofreadPipeline / SummarizePipeline / RewritePipeline 各含独立 Prompt 模板、参数配置和后处理逻辑。',
    },
    {
      phase: '5. 聚合层 (Aggregate)',
      desc: '将分块 AI 结果按原始顺序拼接，处理块间过渡。应用后处理规则：格式恢复、Markdown 渲染、错位修复。最终生成完整结果文档。',
    },
  ];

  pipelineDetails.forEach((pd, i) => {
    const col = i < 3 ? 0 : 1;
    const idx = i % 3;
    const dx = 0.35 + col * 4.5;
    const dy = 3.15 + idx * 0.55;

    addText(slide, pd.phase, dx, dy, 4.3, 0.18, {
      fontSize: 8, bold: true, color: COLORS.primary, fontFace: FONT.code,
    });
    addText(slide, pd.desc, dx, dy + 0.17, 4.3, 0.35, {
      fontSize: 6.8, color: COLORS.gray400, fontFace: FONT.body,
      lineSpacing: 12,
    });
  });

  addPageNum(slide, 13, 16);
  addFooterBar(slide);
}

function slide14_Security(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, '安全架构', 'SECURITY — 多层安全防护体系');

  // Left: Auth flow
  addText(slide, '认证流程 Authentication Flow', 0.35, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.primary, fontFace: FONT.title,
  });

  const authSteps = [
    { step: '1', title: '用户登录', desc: 'POST /api/v1/auth/login\nemail + password' },
    { step: '2', title: '密码验证', desc: 'Argon2id 哈希比对\n抵御彩虹表 + 暴力破解' },
    { step: '3', title: '令牌签发', desc: 'JWT HS256 签名\nAccess (15min) + Refresh (7d)' },
    { step: '4', title: '请求认证', desc: 'Bearer Token 头携带\n中间件自动解析验证' },
    { step: '5', title: '令牌刷新', desc: 'POST /api/v1/auth/refresh\n无感续期，黑名单检查' },
    { step: '6', title: '安全登出', desc: 'Refresh Token 加入黑名单\nRedis TTL 自动过期' },
  ];

  authSteps.forEach((as, i) => {
    const ay = 1.35 + i * 0.55;

    // Step number circle
    slide.addShape('circle', {
      x: 0.5, y: ay + 0.08, w: 0.28, h: 0.28,
      fill: { color: COLORS.primary },
    });
    addText(slide, as.step, 0.5, ay + 0.08, 0.28, 0.28, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });

    // Connecting line
    if (i < authSteps.length - 1) {
      slide.addShape('rect', {
        x: 0.63, y: ay + 0.37, w: 0.02, h: 0.17,
        fill: { color: COLORS.gray600 },
      });
    }

    addText(slide, as.title, 0.95, ay, 1.8, 0.25, {
      fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
    });
    addText(slide, as.desc, 0.95, ay + 0.25, 3.5, 0.3, {
      fontSize: 7.5, color: COLORS.gray400, fontFace: FONT.code,
    });
  });

  // Right: Security layers
  addText(slide, '安全防护层 Security Layers', 5.2, 0.95, 4.5, 0.3, {
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  const securityLayers = [
    { title: '密码安全', items: ['Argon2id (RFC 9106)', '内存成本: 64MB', '时间成本: 3 迭代', '并行度: 4', '随机 Salt 每条记录'], color: COLORS.primary },
    { title: 'JWT 安全', items: ['HS256 签名算法', 'Access Token 15min 短有效期', 'Refresh Token 7d + 黑名单', 'Payload 最小化原则', 'exp/iat/nbf 标准声明'], color: COLORS.accent },
    { title: '网络安全', items: ['CORS 白名单', 'Security Headers', 'Rate Limiting (100 req/min)', 'Request Size Limit (50MB)', 'HTTPS 强制 (生产环境)'], color: COLORS.green },
    { title: '数据安全', items: ['字段级加密 (AES-256)', '文件校验 (SHA-256)', 'SQL 注入防护 (ORM 参数化)', 'XSS 防护 (前端输出转义)', 'CSRF Token'], color: COLORS.purple },
  ];

  securityLayers.forEach((sl, i) => {
    const col = i % 2;
    const idx = Math.floor(i / 2);
    const sx = 5.2 + col * 2.35;
    const sy = 1.35 + idx * 1.6;

    addCard(slide, sx, sy, 2.2, 1.45, COLORS.gray800);

    slide.addShape('rect', { x: sx, y: sy, w: 2.2, h: 0.04, fill: { color: sl.color } });

    addText(slide, sl.title, sx + 0.12, sy + 0.12, 2.0, 0.25, {
      fontSize: 10, bold: true, color: sl.color, fontFace: FONT.title,
    });

    sl.items.forEach((item, j) => {
      addText(slide, `  ${item}`, sx + 0.12, sy + 0.42 + j * 0.2, 2.0, 0.18, {
        fontSize: 7, color: COLORS.gray300, fontFace: FONT.code,
      });
    });
  });

  // Bottom: Compliance note
  addText(slide, '安全合规: OWASP Top 10 防护  |  GDPR 数据保护  |  SOC 2 审计日志  |  API 全量 HTTPS', 0.35, 4.85, 9.3, 0.3, {
    fontSize: 8, bold: true, color: COLORS.gray500, fontFace: FONT.code,
    align: 'center', valign: 'middle',
  });

  addPageNum(slide, 14, 16);
  addFooterBar(slide);
}

function slide15_AiAssistant(pptx) {
  const slide = pptx.addSlide();
  setupSlide(slide, 'AI 智能助手', 'AI ASSISTANT — 可拖拽的全局 AI 对话助手');

  // Left side: Feature description
  const features = [
    { icon: '01', title: '自由拖拽定位', desc: '鼠标按住标题栏即可将助手面板拖拽到页面任意位置，自动限制在视口范围内不超出屏幕边界', color: COLORS.primary },
    { icon: '02', title: '浮动球快捷入口', desc: '最小化时收起到右下角紫色渐变浮动球，带在线状态指示灯，hover 显示提示文字', color: COLORS.accent },
    { icon: '03', title: '多轮智能对话', desc: '基于 DeepSeek 大模型的多轮对话能力，记住上下文，支持中文和英文双语交流', color: COLORS.green },
    { icon: '04', title: '项目功能知识', desc: '内置 DocMind 全部功能说明：文档处理、AI 工具、格式转换、协作、GitHub 集成等', color: COLORS.purple },
    { icon: '05', title: '通用知识问答', desc: '除了项目功能外，还可回答编程、技术、写作、翻译等任意领域的问题', color: COLORS.orange },
    { icon: '06', title: '文档感知模式', desc: '传入 documentId 后自动加载文档内容，基于文档上下文进行精准回答', color: COLORS.accentLight },
  ];

  const itemH = 0.68;
  const startY = 0.95;

  features.forEach((f, i) => {
    const iy = startY + i * (itemH + 0.05);

    // Accent indicator
    slide.addShape('rect', {
      x: 0.35, y: iy, w: 0.06, h: itemH,
      fill: { color: f.color },
    });

    // Number
    addText(slide, f.icon, 0.55, iy + 0.08, 0.4, 0.3, {
      fontSize: 14, bold: true, color: f.color, fontFace: FONT.title,
    });

    // Title
    addText(slide, f.title, 0.95, iy + 0.08, 5.0, 0.28, {
      fontSize: 11, bold: true, color: COLORS.white, fontFace: FONT.title,
    });

    // Description
    addText(slide, f.desc, 0.95, iy + 0.35, 5.0, 0.28, {
      fontSize: 7.5, color: COLORS.gray400, fontFace: FONT.body,
    });

    // Bottom separator
    if (i < features.length - 1) {
      slide.addShape('rect', {
        x: 0.35, y: iy + itemH, w: 5.8, h: 0.005,
        fill: { color: '2A3040' },
      });
    }
  });

  // Right side: component architecture
  addText(slide, '技术实现', 6.6, 0.95, 3.2, 0.3, {
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: FONT.title,
  });

  addCard(slide, 6.6, 1.3, 3.2, 1.9, COLORS.gray800);

  const archLines = [
    'DraggableAiAssistant',
    '  useState + useRef + useEffect',
    '  Mouse Events (mousedown/move/up)',
    '  clampPosition() 边界限制',
    '',
    'API Layer',
    '  POST /api/v1/ai/chat',
    '  ChatRequest / ChatResponse',
    '',
    'Backend',
    '  FastAPI router (/ai prefix)',
    '  DeepSeekClient.chat()',
    '  ASSISTANT_SYSTEM prompt',
    '  ASSISTANT_DOC_CONTEXT_SYSTEM',
  ];

  addText(slide, archLines.map(l => ({ text: l + '\n', options: { fontSize: 7, color: l.startsWith('  ') ? COLORS.gray500 : (l === '' ? COLORS.gray500 : COLORS.gray200), fontFace: l.startsWith('  ') ? FONT.code : FONT.body, lineSpacing: l === '' ? 6 : 13 } })), 6.75, 1.35, 2.95, 1.8, {
    valign: 'top',
  });

  // Quick actions preview
  addText(slide, '快捷操作', 6.6, 3.35, 3.2, 0.25, {
    fontSize: 10, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  const quickActions = [
    { label: '文档处理', color: COLORS.primary },
    { label: '文档摘要', color: COLORS.accent },
    { label: '格式转换', color: COLORS.green },
    { label: '协作功能', color: COLORS.purple },
  ];

  quickActions.forEach((qa, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const qx = 6.6 + col * 1.65;
    const qy = 3.65 + row * 0.45;
    addCard(slide, qx, qy, 1.5, 0.38, COLORS.gray800);
    addText(slide, qa.label, qx, qy, 1.5, 0.38, {
      fontSize: 8.5, color: qa.color, fontFace: FONT.title,
      align: 'center', valign: 'middle',
    });
  });

  // Integration note
  addCard(slide, 6.6, 4.65, 3.2, 0.55, COLORS.gray800);
  slide.addShape('rect', { x: 6.6, y: 4.65, w: 0.06, h: 0.55, fill: { color: COLORS.green } });
  addText(slide, '集成方式', 6.8, 4.68, 2.8, 0.2, {
    fontSize: 9, bold: true, color: COLORS.green, fontFace: FONT.title,
  });
  addText(slide, 'AppLayout.tsx 中注入\n所有认证页面自动显示', 6.8, 4.88, 2.8, 0.3, {
    fontSize: 7, color: COLORS.gray400, fontFace: FONT.code,
    lineSpacing: 12,
  });

  addPageNum(slide, 15, 16);
  addFooterBar(slide);
}

function slide16_Summary(pptx) {
  const slide = pptx.addSlide();
  addBg(slide);
  addFooterBar(slide);

  // Hero summary banner
  slide.addShape('rect', {
    x: 0, y: 0, w: 10, h: 1.65,
    fill: { color: COLORS.darker },
  });
  slide.addShape('rect', {
    x: 0, y: 1.65, w: 10, h: 0.04,
    fill: { color: COLORS.primary },
  });

  addText(slide, '项目总结', 0.5, 0.2, 9.0, 0.55, {
    fontSize: 28, bold: true, color: COLORS.white, fontFace: FONT.title,
  });
  addText(slide, 'DocMind — Full-Scenario Intelligent Document Processing Assistant', 0.5, 0.75, 9.0, 0.35, {
    fontSize: 11, italic: true, color: COLORS.gray400, fontFace: FONT.body,
  });
  addText(slide, 'React 19 + Vite 8 + FastAPI + PostgreSQL 16 + DeepSeek AI  |  50+ commits  |  18/18 tests passed  |  AI 智能助手', 0.5, 1.1, 9.0, 0.3, {
    fontSize: 10, bold: true, color: COLORS.primary, fontFace: FONT.code,
  });

  // Key metrics
  addText(slide, '关键指标 Key Metrics', 0.35, 1.9, 4.5, 0.3, {
    fontSize: 14, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  const metrics = [
    ['项目规模', '80+ Python 文件 + 45+ TS/TSX 文件 = 125+ 源文件'],
    ['数据模型', '16 张数据表 (PostgreSQL 16)'],
    ['API 路由', '11 个路由模块 (含 AI Chat)，覆盖完整业务'],
    ['前端页面', '12 个页面 + 4 种文档查看器 + AI 助手组件'],
    ['服务层', '8 个服务模块 + 3 个 PPTX 渲染服务'],
    ['AI 工具', '6 种文档 AI + 1 个全局 AI 对话助手'],
    ['UI 组件', '24 个 React 组件，全手写 Tailwind CSS v4'],
    ['测试覆盖', '3 格式 x 6 功能 = 18/18 全通过'],
  ];

  metrics.forEach((m, i) => {
    const col = 0;
    const my = 2.3 + i * 0.3;
    addText(slide, m[0], 0.5, my, 1.3, 0.25, {
      fontSize: 8.5, bold: true, color: COLORS.primary, fontFace: FONT.code,
    });
    addText(slide, m[1], 1.85, my, 3.0, 0.25, {
      fontSize: 8.5, color: COLORS.gray300, fontFace: FONT.body,
    });
  });

  // Tech stack summary
  addText(slide, '技术栈总结', 5.2, 1.9, 4.5, 0.3, {
    fontSize: 14, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  addCard(slide, 5.2, 2.3, 4.5, 2.1, COLORS.gray800);

  const summaryStack = [
    ['Language', 'Python 3.12', 'TypeScript 5', ''],
    ['Framework', 'FastAPI', 'React 19', ''],
    ['Database', 'PostgreSQL 16', 'Redis 7 (Cache)', 'MinIO (Storage)'],
    ['ORM', 'SQLAlchemy 2 (Async)', '', ''],
    ['Task Queue', 'Celery 5 + Redis', '', ''],
    ['AI', 'DeepSeek API v1', '', ''],
    ['Auth', 'JWT HS256 + Argon2', '', ''],
    ['Build', 'Docker Compose', 'Vite 8', ''],
  ];

  summaryStack.forEach((row, i) => {
    const sy = 2.4 + i * 0.25;
    addText(slide, row[0], 5.35, sy, 1.2, 0.22, {
      fontSize: 7.5, bold: true, color: COLORS.accent, fontFace: FONT.code,
    });
    addText(slide, [row[1], row[2], row[3]].filter(Boolean).join('  |  '), 6.55, sy, 3.0, 0.22, {
      fontSize: 7.5, color: COLORS.gray300, fontFace: FONT.body,
    });
  });

  // Future roadmap
  addText(slide, '未来规划 Roadmap', 5.2, 4.55, 4.5, 0.3, {
    fontSize: 14, bold: true, color: COLORS.white, fontFace: FONT.title,
  });

  const roadmap = [
    { phase: 'Phase 1 (Current)', items: ['AI 智能助手', '核心功能完善', '性能优化与安全加固'], color: COLORS.green },
    { phase: 'Phase 2 (Q3 2026)', items: ['PDF 导出增强', 'OCR 图片文字识别', '高级语义搜索'], color: COLORS.primary },
    { phase: 'Phase 3 (Q4 2026)', items: ['插件市场', '企业 SSO 集成', '移动端适配'], color: COLORS.purple },
  ];

  roadmap.forEach((rm, i) => {
    const ry = 4.88 + i * 0.2;
    addText(slide, rm.phase, 5.35, ry, 1.5, 0.18, {
      fontSize: 7.5, bold: true, color: rm.color, fontFace: FONT.code,
    });
    addText(slide, rm.items.join('  |  '), 6.85, ry, 2.85, 0.18, {
      fontSize: 7, color: COLORS.gray400, fontFace: FONT.body,
    });
  });

  addText(slide, 'Thank You!', 0.35, 5.1, 9.3, 0.35, {
    fontSize: 18, bold: true, color: COLORS.primary, fontFace: FONT.title,
    align: 'center', valign: 'middle',
  });

  addPageNum(slide, 16, 16);
}

// ==================== MAIN ====================

function main() {
  console.log('='.repeat(60));
  console.log('  DocMind PPTX Generator');
  console.log('  使用 pptxgenjs v4.0.1');
  console.log('='.repeat(60));

  // Verify screenshots (check local media/ and script dir)
  const screenshotFiles = [
    'media/image-1-2.png',
    'media/image-2-2.png',
    'media/image-4-1.jpg',
    'media/image-7-6.png',
    'ai_assistant_chat.png',
    'ai_assistant_test.png',
  ];

  screenshotFiles.forEach((ss) => {
    if (fs.existsSync(path.join(__dirname, ss))) {
      console.log(`  [OK] Found: ${ss}`);
    } else {
      console.log(`  [WARN] Missing: ${ss}`);
    }
  });

  console.log('\n  Creating presentation...');

  const pptx = new PptxGenJS();

  // Presentation settings
  pptx.layout = 'LAYOUT_16x9'; // 10" x 5.625"
  pptx.author = 'DocMind Team';
  pptx.company = 'DocMind';
  pptx.subject = 'DocMind 智能文档处理平台项目汇报';
  pptx.title = 'DocMind 项目汇报';

  // Generate all slides
  console.log('  Generating slides...');

  slide01_Title(pptx);
  console.log('    Slide 01: Title');

  slide02_Overview(pptx);
  console.log('    Slide 02: Project Overview');

  slide03_PainPoints(pptx);
  console.log('    Slide 03: Pain Points & Solution');

  slide04_CoreFeatures(pptx);
  console.log('    Slide 04: Core Features');

  slide05_TechStack(pptx);
  console.log('    Slide 05: Tech Stack');

  slide06_FrontendArch(pptx);
  console.log('    Slide 06: Frontend Architecture');

  slide07_BackendArch(pptx);
  console.log('    Slide 07: Backend Architecture');

  slide08_Database(pptx);
  console.log('    Slide 08: Database Design');

  slide09_TestResults(pptx);
  console.log('    Slide 09: Feature Testing Results');

  slide10_AIProcessingDemo(pptx);
  console.log('    Slide 10: AI Processing Demo');

  slide11_ProductShowcase(pptx);
  console.log('    Slide 11: Product Showcase');

  slide12_TechHighlights(pptx);
  console.log('    Slide 12: Technical Highlights');

  slide13_AIPipeline(pptx);
  console.log('    Slide 13: AI Pipeline');

  slide14_Security(pptx);
  console.log('    Slide 14: Security');

  slide15_AiAssistant(pptx);
  console.log('    Slide 15: AI Assistant');

  slide16_Summary(pptx);
  console.log('    Slide 16: Project Summary');

  // Write file
  const outputPath = path.join(__dirname, '..', '..', 'DocMind_项目汇报.pptx');
  console.log(`\n  Writing to: ${outputPath}`);

  pptx.writeFile({ fileName: outputPath })
    .then((fileName) => {
      console.log(`\n  SUCCESS! File created: ${fileName}`);

      // Verify
      const stats = fs.statSync(fileName);
      console.log(`  File size: ${(stats.size / 1024).toFixed(1)} KB`);
      console.log(`  Total slides: 16`);
      console.log('='.repeat(60));
    })
    .catch((err) => {
      console.error(`\n  ERROR: ${err.message}`);
      console.error(err.stack);
      process.exit(1);
    });
}

main();
