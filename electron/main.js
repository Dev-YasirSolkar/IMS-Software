const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra'); // Use fs-extra for easier file operations

const dataPath = path.join(app.getPath('userData'), 'ims-data');
const productsFilePath = path.join(dataPath, 'products.json');
const imagesPath = path.join(dataPath, 'images'); // Directory for product images

// Ensure the data directory and files exist
function ensureDataDirectoryAndFiles() {
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  if (!fs.existsSync(productsFilePath)) {
    fs.writeFileSync(productsFilePath, '[]', 'utf8'); // Create with empty array
  }
   if (!fs.existsSync(imagesPath)) {
    fs.mkdirSync(imagesPath, { recursive: true }); // Create images directory
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000, // Slightly wider to accommodate image column
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Keep false for security
      contextIsolation: true, // Keep true for security
      enableRemoteModule: false // Deprecated, keep false
    }
  });

  mainWindow.loadFile('src/index.html');

  // Open the DevTools (optional, useful for debugging)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  ensureDataDirectoryAndFiles(); // Create data directory and files on app start
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers (Main Process) ---

// Handler to expose the user data path
ipcMain.handle('get-data-path', () => {
    return dataPath;
});


// Handler to load data from a JSON file
ipcMain.handle('load-data', async (event, fileType) => {
  let filePath;
  switch (fileType) {
    case 'products':
      filePath = productsFilePath;
      break;
    // Add cases for other data types (e.g., orders, suppliers) here
    default:
      console.error(`IPC: Invalid file type for load-data: ${fileType}`);
      return { success: false, error: 'Invalid file type' };
  }

  try {
    const data = fs.readFileSync(filePath, 'utf8');
    console.log(`IPC: Loaded data from ${filePath}`);
    return { success: true, data: JSON.parse(data) };
  } catch (error) {
    console.error(`IPC: Error loading ${fileType} from ${filePath}:`, error);
    // If file doesn't exist or is empty/corrupt, return empty array
     if (error.code === 'ENOENT' || error instanceof SyntaxError) {
       console.warn(`IPC: ${fileType} file not found or corrupt, returning empty array.`);
       return { success: true, data: [] };
    }
    return { success: false, error: error.message };
  }
});

// Handler to save data to a JSON file
ipcMain.handle('save-data', async (event, fileType, data) => {
  let filePath;
  switch (fileType) {
    case 'products':
      filePath = productsFilePath;
      break;
    // Add cases for other data types here
    default:
       console.error(`IPC: Invalid file type for save-data: ${fileType}`);
      return { success: false, error: 'Invalid file type' };
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`IPC: Saved data to ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error(`IPC: Error saving ${fileType} to ${filePath}:`, error);
    return { success: false, error: error.message };
  }
});

// Handler to open file dialog for image selection
ipcMain.handle('select-image', async () => {
    console.log("IPC: Opening select image dialog...");
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
        ]
    });

    if (canceled || filePaths.length === 0) {
        console.log("IPC: Image selection canceled.");
        return { success: false, message: 'File selection canceled' };
    }

    console.log("IPC: Image selected:", filePaths[0]);
    return { success: true, filePath: filePaths[0] };
});

// Handler to copy image file to data directory and return relative path
ipcMain.handle('copy-image-to-data', async (event, originalPath) => {
    console.log("IPC: Received request to copy image:", originalPath);
    if (!originalPath) {
        console.error("IPC: No file path provided for copy-image-to-data.");
        return { success: false, error: 'No file path provided' };
    }

    const fileName = path.basename(originalPath);
    const destinationPath = path.join(imagesPath, fileName);
    const relativePath = path.join('images', fileName); // Path relative to dataPath

    try {
        // Ensure the images directory exists before copying
        await fs.ensureDir(imagesPath);
        await fs.copy(originalPath, destinationPath, { overwrite: true });
        console.log(`IPC: Image copied from ${originalPath} to ${destinationPath}. Relative path: ${relativePath}`);
        return { success: true, relativePath: relativePath };
    } catch (error) {
        console.error(`IPC: Error copying image from ${originalPath} to ${destinationPath}:`, error);
        return { success: false, error: error.message };
    }
});

// Optional: IPC handler to delete a file (for image cleanup)
/*
ipcMain.handle('delete-file', async (event, relativePath) => {
    console.log("IPC: Received request to delete file:", relativePath);
     if (!relativePath) {
        console.error("IPC: No relative path provided for delete-file.");
        return { success: false, error: 'No file path provided' };
    }
    const fullPath = path.join(dataPath, relativePath);
    try {
        await fs.remove(fullPath); // Use fs-extra's remove for files/folders
        console.log(`IPC: File deleted: ${fullPath}`);
        return { success: true };
    } catch (error) {
         console.error(`IPC: Error deleting file ${fullPath}:`, error);
         // Ignore ENOENT error (file not found)
         if (error.code === 'ENOENT') {
             console.warn(`IPC: File not found for deletion: ${fullPath}`);
             return { success: true, message: 'File not found, no deletion needed.' };
         }
        return { success: false, error: error.message };
    }
});
*/
