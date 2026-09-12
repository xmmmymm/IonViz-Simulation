/**
 * 打包产物自检 (verify packaged app)
 * ---------------------------------------------------------------
 * 验证 electron-builder 产出的 app.asar **自身就是完整可用的**，
 * 而不是「构建成功」就假定没问题。
 *
 * 为什么需要它：
 *   package.json 里 dependencies 是空的（react/react-dom/lucide-react 由 Vite
 *   打进 dist/assets/*.js），electron-builder 因此不再把 node_modules 塞进 asar。
 *   这个优化一旦判断错误（例如将来有人加了真正的运行时依赖），
 *   打包出来的桌面端会白屏——而且**只在双击 exe 时才暴露**。
 *   本脚本把这种失败提前到构建阶段。
 *
 * 检查项：
 *   1. asar 体积是否仍然精简（没有回退到塞 node_modules）
 *   2. asar 里该有的运行时文件是否齐全（dist/、electron/main.js、package.json）
 *   3. 直接以 file:// 加载 asar 内的 dist/index.html，确认页面真的渲染得出来、
 *      并且粒子模拟能进入电离平衡 —— 等价于应用启动后的真实路径
 *
 * 用法（需先 npm run electron:build）：
 *   npm run verify:package
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
// Electron 会把 app.asar 当成「目录」来做 fs 补丁，fs.statSync(asar).size 因此恒为 0，
// 用它判断体积会永远通过（假绿灯）。original-fs 绕过这层补丁，拿得到磁盘上的真实大小。
const originalFs = require('original-fs');

const rootDir = path.join(__dirname, '..');
const asarPath = path.join(rootDir, 'dist_electron', 'win-unpacked', 'resources', 'app.asar');
const ASAR_BUDGET_MB = 2;   // 空 node_modules 的纯应用代码约 200 KB，留足余量

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const checks = [];
const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail });

/** 递归列目录（Electron 的 fs 对 asar 路径是透明的，可直接当普通目录读） */
function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (fs.statSync(full).isDirectory()) walk(full, base, out);
    else out.push(rel);
  }
  return out;
}

app.whenReady().then(async () => {
  if (!fs.existsSync(asarPath)) {
    console.error('✗ 未找到 dist_electron/win-unpacked/resources/app.asar');
    console.error('  请先执行: npm run electron:build');
    return app.exit(1);
  }

  // ---------- 1. asar 结构与体积 ----------
  // 磁盘真实体积用 original-fs（fs 会把它当目录，size 恒为 0）；
  // asar 内部各文件的体积则只能用被补丁过的 fs 才读得到。
  const asarBytes = originalFs.statSync(asarPath).size;
  const asarMB = asarBytes / 1024 / 1024;
  const topLevel = fs.readdirSync(asarPath);
  const files = walk(asarPath);
  const contentBytes = files.reduce((n, f) => n + fs.statSync(path.join(asarPath, f)).size, 0);

  check('asar 体积在预算内（未回退到打包 node_modules）',
    asarMB > 0 && asarMB < ASAR_BUDGET_MB,
    `${asarMB.toFixed(2)} MB（内容 ${(contentBytes / 1024).toFixed(0)} KB）`);
  // 体积阈值单独可能被「巧合」满足，再显式断言一次结构
  check('asar 顶层不含 node_modules', !topLevel.includes('node_modules'),
    topLevel.join(', '));
  check('asar 含运行时入口 electron/main.js', files.includes('electron/main.js'));
  check('asar 含 Web 产物 dist/index.html', files.includes('dist/index.html'));

  const assets = files.filter((f) => f.startsWith('dist/assets/'));
  check('asar 含打包后的 JS', assets.some((f) => f.endsWith('.js')),
    assets.filter((f) => f.endsWith('.js')).join(', '));
  check('asar 含打包后的 CSS', assets.some((f) => f.endsWith('.css')),
    assets.filter((f) => f.endsWith('.css')).join(', '));

  // 主进程靠 package.json 的 main 字段定位入口，位置错了应用就起不来
  const pkg = JSON.parse(fs.readFileSync(path.join(asarPath, 'package.json'), 'utf8'));
  check('asar 内 package.json 的 main 指向 electron/main.js',
    pkg.main === 'electron/main.js', String(pkg.main));
  check('asar 内 package.json 版本与仓库一致',
    pkg.version === require(path.join(rootDir, 'package.json')).version, pkg.version);

  // 主进程加载的正是这个文件（electron/main.js 里 __dirname + '/../dist/index.html'），
  // 因此下面直接加载它等价于应用真实启动路径
  const entryHtml = path.join(asarPath, 'dist', 'index.html');

  // ---------- 2. 真的把页面渲染出来 ----------
  const win = new BrowserWindow({
    width: 1600, height: 1050, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
  let latestFrame = null;
  win.webContents.on('paint', (_e, _d, image) => { latestFrame = image; });
  win.webContents.setFrameRate(60);

  let loadError = null;
  win.webContents.on('did-fail-load', (_e, code, desc) => { loadError = `${code} ${desc}`; });

  await win.loadFile(entryHtml);
  await sleep(1500);
  check('asar 内页面加载无错误', !loadError, loadError || 'ok');

  // React 挂载成功的话，能点得到溶质按钮
  const clicked = await win.webContents.executeJavaScript(
    `(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.innerText||'').includes('CH₃COOH')); if (b) b.click(); return !!b; })()`
  );
  check('页面渲染出可交互的溶质按钮（React 已挂载）', clicked);

  // 等电离平衡：能数到离子，说明 Canvas 模拟 + 数据面板整条链路都活着
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

  check('粒子模拟已建立电离平衡', stats && stats.ionCount > 0,
    stats ? `分子 ${stats.moleculeCount} / 离子对 ${stats.ionCount}` : 'N/A');
  const lower = (stats?.text || '').toLowerCase();
  check('数据面板完整渲染（电离度 / 平衡常数 / pH）',
    lower.includes('电离度') && lower.includes('平衡常数') && lower.includes('ph 值'));
  check('画面非空白（取到了渲染帧）',
    !!latestFrame && !latestFrame.isEmpty(),
    latestFrame ? latestFrame.getSize().width + '×' + latestFrame.getSize().height : '无帧');

  win.destroy();

  // ---------- 输出 ----------
  console.log(`\nasar 体积 ${asarMB.toFixed(2)} MB，含 ${files.length} 个文件`);
  console.log('  ' + files.slice(0, 8).join('\n  ') + (files.length > 8 ? `\n  … 其余 ${files.length - 8} 个` : '') + '\n');

  let ok = true;
  for (const c of checks) {
    if (!c.pass) ok = false;
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? '  → ' + c.detail : ''}`);
  }
  console.log(ok ? `\nPASS  ${checks.length}/${checks.length} 项打包自检全部通过` : `\nFAIL  ${checks.filter(c => !c.pass).length}/${checks.length} 项未通过`);
  app.exit(ok ? 0 : 1);
}).catch((e) => {
  console.error('✗ 打包自检异常:', e);
  app.exit(1);
});
