/**
 * 自动生成产物的自检 (verify generated assets)
 * ---------------------------------------------------------------
 * 目的：不靠肉眼也能证明自动生成的产物是「真的渲染出来了」，而不是空白图或纯色图。
 * 检查分三层：
 *   图像层 —— 尺寸 / 颜色丰富度 / 非背景占比 / 关键配色是否出现
 *   运行层 —— 以 offscreen 满帧驱动一次页面，确认能真正进入电离平衡
 *   图标层 —— 解析 ICO 目录，确认尺寸齐备且条目可被 Windows 读取
 *
 * 用法（需先 npm run screenshot && npm run icon）：
 *   npm run verify:preview
 *
 * 注意：运行时检查必须开 offscreen。隐藏窗口的 rAF 被节流到 1 fps，
 * 粒子模拟会慢 60 倍，永远等不到离子生成（详见 scripts/screenshot.js 顶部说明）。
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const previewPng = path.join(rootDir, 'docs', 'preview.png');
const iconPng = path.join(rootDir, 'build', 'icon.png');
const iconIco = path.join(rootDir, 'build', 'icon.ico');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RED = [239, 68, 68];   // cation #ef4444（CH₃COOH 的 H⁺）
const BLUE = [37, 99, 235];  // blue-600 主题色
const CYAN = [236, 254, 255]; // cyan-50 画布底色

const checks = [];
const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail });

/** 统计图片的颜色分布；hasColor 用曼哈顿距离判断目标色是否出现 */
function analyze(img, { bg = [248, 250, 252], bgTol = 12 } = {}) {
  const size = img.getSize();
  const bmp = img.toBitmap(); // BGRA
  const colors = new Set();
  let nonBg = 0;
  let reddish = 0;
  const total = size.width * size.height;

  for (let i = 0; i < bmp.length; i += 4) {
    const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2];
    if (colors.size < 200000) colors.add((r << 16) | (g << 8) | b);
    if (Math.abs(r - bg[0]) > bgTol || Math.abs(g - bg[1]) > bgTol || Math.abs(b - bg[2]) > bgTol) nonBg++;
    if (r > 170 && r - g > 70 && r - b > 70) reddish++; // 偏红像素（含抗锯齿边缘）
  }

  return {
    size,
    colorCount: colors.size,
    nonBgPct: (nonBg / total) * 100,
    reddish,
    hasColor(target, tol = 40) {
      for (const key of colors) {
        const r = (key >> 16) & 255, g = (key >> 8) & 255, b = key & 255;
        if (Math.abs(r - target[0]) + Math.abs(g - target[1]) + Math.abs(b - target[2]) <= tol) return true;
      }
      return false;
    },
  };
}

/** 解析 ICO 目录，返回每个条目声明的尺寸 */
function parseIco(buf) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error('不是合法 ICO 头');
  const count = buf.readUInt16LE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const e = 6 + i * 16;
    const w = buf.readUInt8(e) || 256;
    const h = buf.readUInt8(e + 1) || 256;
    const bytes = buf.readUInt32LE(e + 8);
    const off = buf.readUInt32LE(e + 12);
    const sig = buf.slice(off, off + 8);
    out.push({
      w, h, bytes,
      inRange: off + bytes <= buf.length,
      isPng: sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    });
  }
  return out;
}

app.whenReady().then(async () => {
  // ============ 1. 预览图（图像层） ============
  if (!fs.existsSync(previewPng)) {
    console.error('✗ 缺少 docs/preview.png，请先执行: npm run screenshot');
    return app.exit(1);
  }
  const pv = analyze(nativeImage.createFromPath(previewPng));
  check('预览图尺寸 ≥ 1280 宽（触发双栏布局）', pv.size.width >= 1280, `${pv.size.width}×${pv.size.height}`);
  check('预览图颜色数 > 500（不是纯色/空白）', pv.colorCount > 500, `${pv.colorCount} 种`);
  check('预览图非背景像素 > 5%（确实画了内容）', pv.nonBgPct > 5, `${pv.nonBgPct.toFixed(1)}%`);
  check('含画布底色 cyan-50 (#ecfeff)', pv.hasColor(CYAN, 24));
  check('含主题蓝 (blue-600 #2563eb)', pv.hasColor(BLUE, 60));
  check('含阳离子红点 (#ef4444) 成片出现，而非仅图例一颗', pv.reddish > 200, `${pv.reddish} px`);

  // ============ 2. 运行层：页面能否真正进入电离平衡 ============
  const win = new BrowserWindow({
    width: 1600, height: 1050, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  win.webContents.setFrameRate(60);
  await win.loadFile(path.join(rootDir, 'dist', 'index.html'));
  await sleep(1500);
  await win.webContents.executeJavaScript(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText||'').includes('CH₃COOH')); if (b) b.click(); })()`
  );

  // 轮询直到出现离子且读数稳定
  let stats = null, prev = null, stable = 0;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    stats = await win.webContents.executeJavaScript(`(() => {
      const t = (document.body.innerText || '').replace(/\\s+/g, ' ');
      const mol = t.match(/分子数 (\\d+)/);
      const ion = t.match(/离子对数 (\\d+)/);
      return { moleculeCount: mol ? +mol[1] : -1, ionCount: ion ? +ion[1] : -1, text: t };
    })()`);
    if (stats.moleculeCount < 0) continue;
    if (prev && prev.moleculeCount === stats.moleculeCount && prev.ionCount === stats.ionCount) stable++;
    else stable = 0;
    prev = stats;
    if (stats.ionCount > 0 && stable >= 2) break;
  }
  // innerText 会带上 CSS text-transform:uppercase 的效果（pH→PH、α→Α），
  // 因此统一转小写后再断言，避免把「样式大写」误判成「内容缺失」。
  const text = stats.text;
  const lower = text.toLowerCase();
  const molCount = stats.moleculeCount;
  const ionCount = stats.ionCount;
  win.destroy();

  check('页面显示电离方程式（含 ==）', /ch3cooh/.test(lower) && lower.includes('=='));
  check('页面显示电离方程式可逆符号语义', /ch3coo/.test(lower) && /h⁺/.test(lower));
  check('页面显示电离度与粒子计数', lower.includes('电离度') && lower.includes('分子数') && lower.includes('离子对数'));
  check('页面显示平衡常数 Ka', lower.includes('平衡常数') && lower.includes('ka') && /e-5/.test(lower));
  check('页面显示 pH 值卡片', lower.includes('ph 值'));
  check('页面显示导电能力卡片', lower.includes('导电能力'));
  check('页面显示速率平衡 v正/v逆', lower.includes('速率平衡') && lower.includes('结合'));
  check('粒子体系已建立（分子数 > 0）', molCount > 0, `分子数 ${molCount}`);
  check('已进入动态平衡（离子对 > 0）', ionCount > 0, `分子 ${molCount} / 离子对 ${ionCount}`);

  // ============ 3. 图标层 ============
  if (fs.existsSync(iconPng)) {
    const ic = analyze(nativeImage.createFromPath(iconPng), { bg: [255, 255, 255], bgTol: 250 });
    check('图标 png 为 512×512（打包要求）', ic.size.width === 512 && ic.size.height === 512, `${ic.size.width}×${ic.size.height}`);
    check('图标含主题蓝底', ic.hasColor(BLUE, 90));
    check('图标含白色瓶身', ic.hasColor([255, 255, 255], 20));
    check('图标含彩色粒子（红）', ic.hasColor(RED, 45));
  } else {
    check('图标 png 存在（先运行 npm run icon）', false);
  }

  if (fs.existsSync(iconIco)) {
    const entries = parseIco(fs.readFileSync(iconIco));
    const sizes = entries.map((e) => e.w).sort((a, b) => b - a);
    check('ICO 含 256×256 条目（Windows 必需）', sizes.includes(256), sizes.join('/'));
    check('ICO 全部为内嵌 PNG 条目', entries.every((e) => e.isPng));
    check('ICO 各条目尺寸自洽', entries.every((e) => e.w === e.h));
    check('ICO 数据偏移未越界（结构完整）', entries.every((e) => e.inRange));
  } else {
    check('ICO 存在（先运行 npm run icon）', false);
  }

  // ============ 输出 ============
  let ok = true;
  for (const c of checks) {
    if (!c.pass) ok = false;
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? '  → ' + c.detail : ''}`);
  }
  console.log(ok ? `\nPASS  ${checks.length}/${checks.length} 项自检全部通过` : `\nFAIL  ${checks.filter(c => !c.pass).length}/${checks.length} 项未通过`);
  app.exit(ok ? 0 : 1);
}).catch((e) => {
  console.error('✗ 自检异常:', e);
  app.exit(1);
});
