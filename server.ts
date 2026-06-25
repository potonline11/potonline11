import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProjectFiles(dir: string, baseDir: string, filesList: { path: string; content: string }[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(baseDir, fullPath);

    if (
      relativePath === 'node_modules' ||
      relativePath.startsWith('node_modules' + path.sep) ||
      relativePath === 'dist' ||
      relativePath.startsWith('dist' + path.sep) ||
      relativePath === '.git' ||
      relativePath.startsWith('.git' + path.sep) ||
      relativePath.endsWith('.zip') ||
      relativePath.startsWith('tmp' + path.sep)
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getProjectFiles(fullPath, baseDir, filesList);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      filesList.push({
        path: relativePath.split(path.sep).join('/'),
        content: content
      });
    }
  }
  return filesList;
}

function addFilesToZip(dir: string, zip: JSZip, baseDir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(baseDir, fullPath);

    // Filter rules to keep ZIP clean and avoid infinitely zipping the ZIP itself or heavy folders
    if (
      relativePath === 'node_modules' ||
      relativePath.startsWith('node_modules' + path.sep) ||
      relativePath === 'dist' ||
      relativePath.startsWith('dist' + path.sep) ||
      relativePath === '.git' ||
      relativePath.startsWith('.git' + path.sep) ||
      relativePath.endsWith('.zip') ||
      relativePath.startsWith('tmp' + path.sep)
    ) {
      continue;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addFilesToZip(fullPath, zip, baseDir);
    } else {
      const content = fs.readFileSync(fullPath);
      const zipPath = relativePath.split(path.sep).join('/');
      zip.file(zipPath, content);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route to fetch raw project files for client-side packaging
  app.get('/api/project-files', (req, res) => {
    try {
      console.log('Fetching raw project files list...');
      const rootDir = process.cwd();
      const files = getProjectFiles(rootDir, rootDir);
      res.json({ files });
    } catch (error) {
      console.error('Error fetching project files:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // API Route to fetch runtime environment variables for the frontend
  app.get('/api/config', (req, res) => {
    try {
      res.json({
        DEFAULT_SPREADSHEET_ID: process.env.VITE_DEFAULT_SPREADSHEET_ID || process.env.DEFAULT_SPREADSHEET_ID || '',
        DEFAULT_APPS_SCRIPT_URL: process.env.VITE_DEFAULT_APPS_SCRIPT_URL || process.env.DEFAULT_APPS_SCRIPT_URL || '',
        DEFAULT_FIREBASE_CONFIG: process.env.VITE_DEFAULT_FIREBASE_CONFIG || process.env.DEFAULT_FIREBASE_CONFIG || '',
        DEFAULT_GOOGLE_CLIENT_ID: process.env.VITE_DEFAULT_GOOGLE_CLIENT_ID || process.env.DEFAULT_GOOGLE_CLIENT_ID || '',
      });
    } catch (error) {
      console.error('Error fetching config:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // API Route to proxy Google Drive images server-side to avoid cross-origin cookie / block issues
  app.get('/api/drive-image', async (req, res) => {
    try {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing file id parameter' });
      }

      // Shared browser-impersonating headers to ensure Google Drive doesn't block the backend Cloud Run request
      const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://drive.google.com/',
      };

      // Priority 1: High-Performance Google User Content CDN (lh3.googleusercontent.com)
      const lh3Url = `https://lh3.googleusercontent.com/d/${id}=s1600`;
      try {
        const response = await fetch(lh3Url, { headers: requestHeaders });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400'); // Cache for 7 days
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {
        console.warn(`lh3 proxy failed for ID ${id}:`, e);
      }

      // Priority 2: High-Quality Google Drive Thumbnail
      const thumbnail1600Url = `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
      try {
        const response = await fetch(thumbnail1600Url, { headers: requestHeaders });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {
        console.warn(`thumbnail w1600 proxy failed for ID ${id}:`, e);
      }

      // Priority 3: Medium-Quality Thumbnail (sz=w800)
      const thumbnail800Url = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
      try {
        const response = await fetch(thumbnail800Url, { headers: requestHeaders });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {
        console.warn(`thumbnail w800 proxy failed for ID ${id}:`, e);
      }

      // Priority 4: Google Drive uc (raw web preview view/download format)
      const ucUrl = `https://docs.google.com/uc?export=download&id=${id}`;
      try {
        const response = await fetch(ucUrl, { headers: requestHeaders });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          const buffer = await response.arrayBuffer();
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {
        console.warn(`uc proxy failed for ID ${id}:`, e);
      }

      // If all proxy methods fail, redirect as an absolute last resort
      console.error(`All proxy methods failed to fetch Google Drive image ${id}. Redirecting client directly...`);
      res.redirect(`https://drive.google.com/thumbnail?id=${id}&sz=w1600`);
    } catch (error) {
      console.error('Fatal error proxying Google Drive image:', error);
      res.redirect(`https://drive.google.com/thumbnail?id=${req.query.id}&sz=w1600`);
    }
  });

  // API Route for ZIP downloads - runs in both development and production (Shared builds)
  app.get('/api/download-zip', async (req, res) => {
    try {
      console.log('Generating ZIP of project source code...');
      const zip = new JSZip();
      const rootDir = process.cwd();
      addFilesToZip(rootDir, zip, rootDir);

      const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });

      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="google-sheets-connector-project.zip"',
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } catch (error) {
      console.error('Error generating project ZIP:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP: ' + String(error));
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
