import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ---------------------------------------------------------------------------
// IPC: Creator Studio file dialog handlers
// ---------------------------------------------------------------------------

const DEFAULT_LEVELS_DIR = path.join(os.homedir(), 'Documents', 'PINBALLZZZ', 'levels');

/**
 * dialog:saveFile — opens a native Save File dialog and writes JSON data.
 *
 * Payload: { defaultName: string, data: unknown }
 * Returns: true on success, false if the user cancelled.
 */
ipcMain.handle('dialog:saveFile', async (_event, payload: { defaultName: string; data: unknown }) => {
  // Ensure the default save directory exists
  fs.mkdirSync(DEFAULT_LEVELS_DIR, { recursive: true });

  const result = await dialog.showSaveDialog({
    title: 'Save Level',
    defaultPath: path.join(DEFAULT_LEVELS_DIR, payload.defaultName),
    filters: [{ name: 'PINBALLZZZ Level', extensions: ['json'] }],
    properties: ['createDirectory'],
  });

  if (result.canceled || !result.filePath) return false;

  fs.writeFileSync(result.filePath, JSON.stringify(payload.data, null, 2), 'utf-8');
  return true;
});

/**
 * dialog:openFile — opens a native Open File dialog and reads JSON data.
 *
 * Returns: parsed JSON object on success, null if the user cancelled or
 *          the file is unreadable.
 */
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open Level',
    defaultPath: DEFAULT_LEVELS_DIR,
    filters: [{ name: 'PINBALLZZZ Level', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Window lifecycle
// ---------------------------------------------------------------------------

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // In dev, load from the Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built index.html from dist
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
