import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  clearAllData,
  closePeriod,
  createCollaborator,
  exportCsv,
  getAppSettings,
  getEvaluation,
  getLatestEvaluation,
  getPeriodStatus,
  getRanking,
  importCsv,
  listPeriods,
  listCollaborators,
  saveEvaluation,
  saveAppSettings,
  updateCollaborator,
} from './database';

const unsavedChangesByWindow = new Map<number, boolean>();
const allowCloseByWindow = new Map<number, boolean>();

function createWindow() {
  const window = new BrowserWindow({
    title: 'Evaluacion de Desempeño',
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#f4efe6',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void window.loadURL(devServerUrl);
  } else {
    void window.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  }

  window.on('close', async (event) => {
    if (allowCloseByWindow.get(window.id) || !unsavedChangesByWindow.get(window.id)) {
      return;
    }

    if (window.webContents.isDestroyed() || window.webContents.isCrashed()) {
      allowCloseByWindow.set(window.id, true);
      unsavedChangesByWindow.set(window.id, false);
      return;
    }

    event.preventDefault();

    try {
      window.webContents.send('window:attempt-discard-unsaved-feedback');
    } catch {
      allowCloseByWindow.set(window.id, true);
      unsavedChangesByWindow.set(window.id, false);
      window.close();
    }
  });

  window.on('closed', () => {
    allowCloseByWindow.delete(window.id);
    unsavedChangesByWindow.delete(window.id);
  });
}

app.whenReady().then(() => {
  app.setName('Evaluacion de Desempeño');
  ipcMain.handle('collaborators:list', () => listCollaborators());
  ipcMain.handle('collaborators:create', (_event, input) => createCollaborator(input));
  ipcMain.handle('collaborators:update', (_event, collaboratorId: number, input) =>
    updateCollaborator(collaboratorId, input),
  );
  ipcMain.handle('evaluations:get-latest', (_event, collaboratorId: number) => getLatestEvaluation(collaboratorId));
  ipcMain.handle('evaluations:get-by-period', (_event, collaboratorId: number, period: string) =>
    getEvaluation(collaboratorId, period),
  );
  ipcMain.handle('evaluations:list-periods', () => listPeriods());
  ipcMain.handle('settings:get', () => getAppSettings());
  ipcMain.handle('periods:get-status', (_event, collaboratorId: number, period: string) => getPeriodStatus(collaboratorId, period));
  ipcMain.handle('periods:close', (_event, collaboratorId: number, period: string) => closePeriod(collaboratorId, period));
  ipcMain.handle('evaluations:save', (_event, input) => saveEvaluation(input));
  ipcMain.handle('settings:save', (_event, input) => saveAppSettings(input));
  ipcMain.handle('ranking:list', (_event, filters) => getRanking(filters));
  ipcMain.handle('storage:clear-all', () => clearAllData());
  ipcMain.handle('window:discard-unsaved-and-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    allowCloseByWindow.set(window.id, true);
    unsavedChangesByWindow.set(window.id, false);
    window.close();
  });
  ipcMain.on('window:set-unsaved-feedback', (event, hasUnsavedChanges: boolean) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return;
    }

    unsavedChangesByWindow.set(window.id, hasUnsavedChanges);
  });

  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Exportar respaldo CSV',
      defaultPath: 'evaluacion-desempeno-backup.csv',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    writeFileSync(result.filePath, exportCsv(), 'utf8');
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar respaldo CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const imported = importCsv(readFileSync(filePath, 'utf8'));
    return { canceled: false, imported };
  });

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