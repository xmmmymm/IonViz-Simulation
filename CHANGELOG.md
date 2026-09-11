# 更新日志 (Changelog)

本文件记录本项目的所有重要变更。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [1.1.0] - 2026-09-11

### 新增

- README 全面重写：项目简介、功能特性、内置溶质与考点、快速开始、打包说明、
  模型公式推导、项目结构、贡献指引，并以 `docs/preview.png` 作为界面预览图
- MIT LICENSE
- 预览图自动生成脚本 `scripts/screenshot.js`：等粒子体系**真正建立电离平衡**后再截图，
  而非截首屏（首屏电离度恒为 0.0%，是废图）
- 应用图标生成脚本 `scripts/make-icon.js`：以代码渲染图标，产出 `build/icon.png` (512×512)
  与多尺寸 `build/icon.ico` (256/128/64/48/32/16)。此前打包版使用 Electron 默认图标
- 自检脚本 `scripts/verify-preview.js`：图像层 / 运行层 / 图标层共 23 项断言
- 新增 npm 脚本：`typecheck`、`screenshot`、`verify:preview`、`icon`、`clean`、
  `electron:portable`（免安装单文件 exe）
- GitHub Actions 工作流：CI（Node 18/20 类型检查 + 构建）、Release（打 tag 自动打包发布）、
  Pages（构建静态站点并部署）
- 仓库模板：Issue 表单（Bug / 功能建议）、PR 模板、Dependabot、`.editorconfig`、`.gitattributes`
- `package.json` 补齐 `description` / `license` / `repository` / `homepage` / `bugs` /
  `keywords` / `engines` 及 electron-builder 的 `nsis` / `mac` / `linux` 目标配置

### 变更

- **界面重构**：布局改为「左侧 8:5 演示区 + 右侧电离方程式 / 控制面板 / 实时数据栏」，
  宽屏铺满不留空白；粒子图例常驻画布左下角，移除页头冗余图例
- 电离方程式统一为教学书写法（`HCl(aq) == H⁺(aq) + Cl⁻(aq)`），
  强酸用 `==`、弱酸用可逆符号，语义一目了然
- 全局字号基准 16px → 17px，提升投屏可读性
- 化学试剂数据补全：每种溶质附带 12 条考点与 12 条生活/工业应用

### 修复

- **打包版断网后丢失全部样式**：移除 `cdn.tailwindcss.com` 与 `esm.sh` importmap，
  改为 PostCSS 本地编译 Tailwind；React / lucide 全部走 npm 依赖，实现零 CDN 请求
- **Electron `file://` 加载资源 404**：`index.html` 资源路径改相对路径，并设置 `vite base: './'`
- **预览图/自检脚本永远等不到离子生成**：隐藏窗口（`show: false`）中的
  `requestAnimationFrame` 被 Chromium 节流到 **1 fps**，粒子模拟因此慢 60 倍，
  跑满 40 秒画面上仍只有分子、电离度恒为 0.0%。
  实测 `webPreferences.backgroundThrottling = false` **无效**（仍是 1 fps），
  最终改用 Electron **offscreen 渲染**才恢复满帧（约 6 秒达到平衡）

### 性能

- 画布 backing store 精确等于容器 CSS 尺寸 × devicePixelRatio（上限 1.5），
  不再把 800×500 缓冲放大到全屏，省掉每帧一次全屏重采样
- 离子复合判定由 O(n²) 全量双循环 + `Array.includes` 线性查找，
  改为空间网格 + 3×3 邻域 + `Set` 常数时间查找
- 暂停时完全跳过绘制与物理更新（原先每帧仍在 `clearRect` + 重绘 + 切 `ctx.filter`）
- 统计结果回传由每帧降为每 400 ms，避免 60 fps 触发 React 重渲染
- 逐粒子字符串查找（颜色/符号/字体）全部提到每帧一次；
  温度、浓度、暂停等参数改由 ref 读取，不再重启 effect 与粒子位置

### 说明

- 面板上「模拟电离度」与「理论电离度」刻意并排显示且**本就不相等**
  （25 °C / 1.0 M 醋酸下典型为 14% vs 0.42%）。
  原因是样本量：画布上仅 50 个粒子，若严格按 0.42% 电离则一个离子都不会出现，
  逆反应与「动态平衡」将无从演示。详见 README「模型与公式」章节

## [1.0.0] - 2025-12-22

### 新增

- 首个发布版本：强/弱电解质电离过程与动态平衡微观模拟
- 内置 HCl（强酸）、CH₃COOH（弱酸）、NH₃·H₂O（弱碱）三种溶质
- Canvas 粒子级模拟：分子电离、离子结合、碰撞反弹
- 温度（−50 ~ 100 °C）与浓度（0.1 ~ 3.0 M）滑块，实时联动 Ka / α / pH
- 虚拟导电灯泡亮度、正逆反应速率对比、实时数据面板
- Electron 桌面端封装与 Windows 安装包

[Unreleased]: https://github.com/xmmmymm/IonViz-Simulation/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/xmmmymm/IonViz-Simulation/compare/011e297...v1.1.0
[1.0.0]: https://github.com/xmmmymm/IonViz-Simulation/releases/tag/Middle-School-Chemistry
