/**
 * 预览图生成脚本 (README preview generator)
 * ---------------------------------------------------------------
 * 用 Electron 自带的 Chromium 打开「生产构建产物」dist/index.html，
 * 自动选择一种溶质，等粒子体系真正建立起电离平衡后再截图，
 * 输出 docs/preview.png。
 *
 * 用法：
 *   npm run screenshot            # = npm run build && electron scripts/screenshot.js
 *   或单独跑：npx electron scripts/screenshot.js
 *
 * ── 为什么用 offscreen 渲染 ──────────────────────────────────────
 * 这不是可有可无的选项，而是本脚本能出正确图的前提：
 * 隐藏窗口（show:false）里的 requestAnimationFrame 会被 Chromium 节流到
 * **1 fps**，粒子模拟因此慢 60 倍，跑满 40 秒画面上仍然是「50 个分子、0 个离子」，
 * 电离度恒为 0.0% —— 截出来是一张看起来什么都没发生的废图。
 * （实测：webPreferences.backgroundThrottling=false 也无效，仍是 1 fps。）
 * 开启 offscreen 渲染后 rAF 恢复满帧，约 6 秒即可达到动态平衡（分子 43 / 离子对 7）。
 *
 * 之所以复用 Electron 而不是引入 puppeteer/playwright：
 * 本项目本来就把 electron 作为 devDependency，无需额外下载一份 Chromium。
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- 可调参数 ----------------------------------------------------
const WINDOW_WIDTH = 1600;    // 需 >= 1280，才能触发 xl 双栏布局
const WINDOW_HEIGHT = 1050;
const FRAME_RATE = 60;        // 与真实使用一致；物理按帧推进，降帧会减慢模拟
const SUBSTANCE = process.env.PREVIEW_SUBSTANCE || 'CH₃COOH'; // 按钮文案
const MAX_WAIT_MS = 45000;    // 等待平衡的上限
const STABLE_READS = 4;       // 连续 N 次读数不变即认为已平衡（每次间隔 500ms）
// -----------------------------------------------------------------

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'docs');
const outFile = path.join(outDir, 'preview.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 在渲染进程里按可见文字找到按钮，返回其中心点坐标（CSS 像素 == DIP） */
const locateButton = (label) => `
(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const target = btns.find(b => (b.innerText || '').includes(${JSON.stringify(label)}));
  if (!target) return null;
  const r = target.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()
`;

/** 读回右侧数据面板的统计值（面板每 400ms 才刷新一次，故以此判断平衡） */
const readStats = `
(() => {
  const t = (document.body.innerText || '').replace(/\\s+/g, ' ');
  const mol = t.match(/分子数 (\\d+)/);
  const ion = t.match(/离子对数 (\\d+)/);
  const alpha = t.match(/电离度 [ΑαA]?\\)? ?([\\d.]+%)/);
  return {
    moleculeCount: mol ? Number(mol[1]) : -1,
    ionCount: ion ? Number(ion[1]) : -1,
    alpha: alpha ? alpha[1] : null,
  };
})()
`;

/** 轮询直到分子数/离子对数连续若干次不再变化（且已有离子生成） */
async function waitForEquilibrium(win) {
  const t0 = Date.now();
  let prev = null;
  let stable = 0;

  while (Date.now() - t0 < MAX_WAIT_MS) {
    await sleep(500);
    const s = await win.webContents.executeJavaScript(readStats);
    if (!s || s.moleculeCount < 0) continue;

    if (prev && prev.moleculeCount === s.moleculeCount && prev.ionCount === s.ionCount) {
      stable++;
    } else {
      stable = 0;
    }
    if (stable === 1 || stable === STABLE_READS) {
      console.log(`  t=${((Date.now() - t0) / 1000).toFixed(1)}s  分子 ${s.moleculeCount} / 离子对 ${s.ionCount}  α=${s.alpha}`);
    }
    prev = s;

    // 已生成离子 + 读数稳定 → 认为进入动态平衡
    if (s.ionCount > 0 && stable >= STABLE_READS) return s;
  }
  return prev;
}

async function main() {
  const indexPath = path.join(rootDir, 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('✗ 未找到 dist/index.html，请先执行: npm run build');
    return app.exit(1);
  }

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    useContentSize: true,
    show: false,
    frame: false,
    backgroundColor: '#f8fafc',
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });

  // offscreen 模式下用 paint 事件拿帧比 capturePage 更可靠
  let latestFrame = null;
  win.webContents.on('paint', (_event, _dirty, image) => { latestFrame = image; });
  win.webContents.setFrameRate(FRAME_RATE);

  await win.loadFile(indexPath);
  await sleep(1500); // 等 React 首屏挂载 + Tailwind 样式应用 + 第一帧产出

  const point = await win.webContents.executeJavaScript(locateButton(SUBSTANCE));
  if (!point) {
    console.error(`✗ 页面上找不到包含「${SUBSTANCE}」的按钮`);
    return app.exit(1);
  }

  // 用真实的鼠标事件点击，确保 React 的 onClick 被触发
  win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 });

  console.log(`等待 ${SUBSTANCE} 电离平衡建立…`);
  const stats = await waitForEquilibrium(win);
  if (!stats || stats.ionCount <= 0) {
    console.warn('⚠ 未观察到离子生成，截出的图电离度可能为 0.0%（请检查粒子模拟是否正常）');
  }

  // 收起鼠标悬停态，避免截图里残留 hover 高亮
  win.webContents.sendInputEvent({ type: 'mouseMove', x: 2, y: 2 });
  await sleep(600);

  const image = latestFrame;
  if (!image || image.isEmpty()) {
    console.error('✗ 未取到任何渲染帧');
    return app.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, image.toPNG());

  const { width, height } = image.getSize();
  const kb = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`✓ 预览图已生成: ${path.relative(rootDir, outFile)} (${width}×${height}, ${kb} KB)`);
  console.log(`  平衡态: 分子 ${stats.moleculeCount} / 离子对 ${stats.ionCount} / 电离度 ${stats.alpha}`);

  win.destroy();
  app.exit(0);
}

app.whenReady().then(main).catch((err) => {
  console.error('✗ 截图失败:', err);
  app.exit(1);
});
