/**
 * 应用图标生成脚本 (app icon generator)
 * ---------------------------------------------------------------
 * 用 Electron 的 Chromium 渲染一张矢量图标，导出为：
 *   build/icon.png   512×512，供 macOS / Linux 打包使用
 *   build/icon.ico   多尺寸（256/128/64/48/32/16），供 Windows 打包使用
 *
 * 为什么不直接放一张手绘 png：
 *   图标要随主题色改动保持同步，且多尺寸 ICO 用手工工具切图容易漏尺寸。
 *   这里全部由代码渲染，改一行颜色即可重新生成全套。
 *
 * 用法：npm run icon
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const MASTER = 512;                       // 主图尺寸，其余尺寸由它降采样
const ICO_SIZES = [256, 128, 64, 48, 32, 16];
const outDir = path.join(__dirname, '..', 'build');

/** 图标构图：圆角方形渐变底 + 白色锥形瓶 + 瓶内彩色粒子 */
const iconHtml = (size) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
  canvas{display:block}
</style></head><body><canvas id="c" width="${size}" height="${size}"></canvas>
<script>
const S = ${size};
const ctx = document.getElementById('c').getContext('2d');
const k = S / 512;                      // 以 512 为设计基准等比缩放
const px = (v) => v * k;

// ---- 1. 圆角方形底 + 斜向渐变 -------------------------------------
const R = px(112);
const bg = ctx.createLinearGradient(0, 0, S, S);
bg.addColorStop(0,    '#2563eb');       // blue-600
bg.addColorStop(0.55, '#3b82f6');       // blue-500
bg.addColorStop(1,    '#06b6d4');       // cyan-500
ctx.beginPath();
ctx.moveTo(R, 0);
ctx.arcTo(S, 0, S, S, R);
ctx.arcTo(S, S, 0, S, R);
ctx.arcTo(0, S, 0, 0, R);
ctx.arcTo(0, 0, S, 0, R);
ctx.closePath();
ctx.fillStyle = bg;
ctx.fill();

// 左上角加一层高光，避免大尺寸下显得扁平
const gloss = ctx.createRadialGradient(px(150), px(110), 0, px(150), px(110), px(430));
gloss.addColorStop(0, 'rgba(255,255,255,0.30)');
gloss.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = gloss;
ctx.fill();

// ---- 2. 锥形瓶轮廓（左右严格对称，以 x=256 为轴） ------------------
const flask = new Path2D();
flask.moveTo(px(206), px(112));
flask.lineTo(px(206), px(196));
flask.bezierCurveTo(px(206), px(232), px(176), px(258), px(148), px(300));
flask.bezierCurveTo(px(120), px(342), px(112), px(366), px(112), px(388));
flask.quadraticCurveTo(px(112), px(418), px(146), px(418));
flask.lineTo(px(366), px(418));
flask.quadraticCurveTo(px(400), px(418), px(400), px(388));
flask.bezierCurveTo(px(400), px(366), px(392), px(342), px(364), px(300));
flask.bezierCurveTo(px(336), px(258), px(306), px(232), px(306), px(196));
flask.lineTo(px(306), px(112));
flask.closePath();

// 瓶体：白色实心 + 轻微投影感
ctx.save();
ctx.shadowColor = 'rgba(15,23,42,0.28)';
ctx.shadowBlur = px(18);
ctx.shadowOffsetY = px(6);
ctx.fillStyle = '#ffffff';
ctx.fill(flask);
ctx.restore();

// 瓶口横档，让小尺寸下也能看出“这是个瓶子”
ctx.beginPath();
const rimH = px(20), rimW = px(126);
const rimX = px(256) - rimW / 2, rimY = px(92), rimR = px(9);
ctx.moveTo(rimX + rimR, rimY);
ctx.arcTo(rimX + rimW, rimY, rimX + rimW, rimY + rimH, rimR);
ctx.arcTo(rimX + rimW, rimY + rimH, rimX, rimY + rimH, rimR);
ctx.arcTo(rimX, rimY + rimH, rimX, rimY, rimR);
ctx.arcTo(rimX, rimY, rimX + rimW, rimY, rimR);
ctx.closePath();
ctx.fillStyle = '#ffffff';
ctx.fill();

// ---- 3. 瓶内“溶液” + 粒子 ----------------------------------------
ctx.save();
ctx.clip(flask);
const liquid = ctx.createLinearGradient(0, px(290), 0, px(418));
liquid.addColorStop(0, 'rgba(37,99,235,0.16)');
liquid.addColorStop(1, 'rgba(37,99,235,0.34)');
ctx.fillStyle = liquid;
ctx.fillRect(px(96), px(286), px(320), px(150));

// 粒子：分子大而浅、离子小而艳，呼应应用里“分子/离子”两种粒子
const dots = [
  [178, 352, 26, '#3b82f6'],   // 未电离分子（大、蓝）
  [278, 330, 15, '#ef4444'],   // 阳离子（小、红）
  [338, 372, 16, '#22c55e'],   // 阴离子（小、绿）
  [222, 396, 15, '#ef4444'],
  [300, 398, 14, '#22c55e'],
  [148, 392, 13, '#3b82f6'],
];
for (const [x, y, r, color] of dots) {
  ctx.beginPath();
  ctx.arc(px(x), px(y), px(r), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = px(3);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
}
ctx.restore();

// ---- 4. 瓶体描边（压在粒子上，保证轮廓清晰） ----------------------
ctx.lineWidth = px(10);
ctx.strokeStyle = 'rgba(255,255,255,0.95)';
ctx.stroke(flask);
</script></body></html>`;

/**
 * 组装多尺寸 ICO。
 * Vista 之后的 ICO 允许每个条目直接内嵌 PNG 数据，无需 BMP+DIB 手工拼装。
 */
function buildIco(entries) {
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);   // reserved
  header.writeUInt16LE(1, 2);   // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  entries.forEach(({ size, png }, i) => {
    const e = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, e + 0);  // 宽（0 表示 256）
    dir.writeUInt8(size >= 256 ? 0 : size, e + 1);  // 高
    dir.writeUInt8(0, e + 2);                        // 调色板数
    dir.writeUInt8(0, e + 3);                        // reserved
    dir.writeUInt16LE(1, e + 4);                     // color planes
    dir.writeUInt16LE(32, e + 6);                    // bits per pixel
    dir.writeUInt32LE(png.length, e + 8);            // 数据长度
    dir.writeUInt32LE(offset, e + 12);               // 数据偏移
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: MASTER,
    height: MASTER,
    show: false,
    transparent: true,
    frame: false,
    paintWhenInitiallyHidden: true,
    webPreferences: { offscreen: false, zoomFactor: 1 },
  });

  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(iconHtml(MASTER)));
  await new Promise((r) => setTimeout(r, 800)); // 等字体与 Canvas 绘制完成
  const master = await win.webContents.capturePage();
  win.destroy();

  fs.mkdirSync(outDir, { recursive: true });

  // 主图：Linux 打包需要 ≥512 的 png
  fs.writeFileSync(path.join(outDir, 'icon.png'), master.toPNG());

  // 多尺寸 ICO：Windows 各场景（任务栏/桌面/资源管理器）会各取所需
  const entries = ICO_SIZES.map((size) => ({
    size,
    png: master.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }));
  fs.writeFileSync(path.join(outDir, 'icon.ico'), buildIco(entries));

  console.log(`✓ ${path.relative(path.join(__dirname, '..'), path.join(outDir, 'icon.png'))}  (${MASTER}x${MASTER})`);
  console.log(`✓ ${path.relative(path.join(__dirname, '..'), path.join(outDir, 'icon.ico'))}  (${ICO_SIZES.join(', ')})`);
  app.exit(0);
}).catch((err) => {
  console.error('✗ 图标生成失败:', err);
  app.exit(1);
});
