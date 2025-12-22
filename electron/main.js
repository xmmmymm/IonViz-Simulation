const { app, BrowserWindow } = require('electron');
const path = require('path');

// 检测是否为开发环境
const isDev = !app.isPackaged;

function createWindow() {
  // 创建浏览器窗口
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: "IonViz: 电离平衡微观模拟",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 简化配置，允许渲染进程使用Node API
      webSecurity: false // 避免本地加载资源时的跨域问题
    },
    autoHideMenuBar: true, // 隐藏默认菜单栏
  });

  if (isDev) {
    // 开发环境下：加载 Vite 开发服务器地址
    // 确保这里的端口号(5173)与您启动 npm run dev 时的端口一致
    win.loadURL('http://localhost:5173');
    // 打开开发者工具
    win.webContents.openDevTools();
  } else {
    // 生产环境下：加载打包后的 html 文件
    // 注意：main.js 在 electron 文件夹下，所以 dist 在上一级 (../dist)
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Electron 初始化完成后调用
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS 特性：点击 Dock 图标且无窗口时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用 (macOS 除外)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});