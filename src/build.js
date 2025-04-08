/**
 * Simple build script to copy .js files from src to dist
 * No TypeScript transpilation necessary!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source and destination directories
const srcDir = path.join(__dirname, '../src');
const distDir = path.join(__dirname, '../dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Recursive function to copy files
function copyFiles(sourceDir, destDir) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Read all files in the source directory
  const files = fs.readdirSync(sourceDir);

  // Copy each file to the destination directory
  files.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    // Get file stats
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      copyFiles(sourcePath, destPath);
    } else if (file.endsWith('.js')) {
      // Copy JavaScript files
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied: ${sourcePath} → ${destPath}`);
    }
  });
}

// Start copying files
console.log('Building Instagram Scraper...');
copyFiles(srcDir, distDir);
console.log('Build complete!');