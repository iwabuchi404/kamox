import path from 'path';
import fs from 'fs';

export class ProjectDetector {
  detectProjectType(cwd: string): 'chrome' | 'electron' | 'vscode' | null {
    // Chrome Extension detection
    if (
      fs.existsSync(path.join(cwd, 'manifest.json')) ||
      fs.existsSync(path.join(cwd, 'dist', 'manifest.json')) ||
      fs.existsSync(path.join(cwd, 'build', 'manifest.json')) ||
      fs.existsSync(path.join(cwd, 'public', 'manifest.json')) ||
      fs.existsSync(path.join(cwd, 'src', 'manifest.json'))
    ) {
      return 'chrome';
    }

    // Electron detection (simplified)
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies?.electron || pkg.devDependencies?.electron) {
        return 'electron';
      }
      if (pkg.engines?.vscode) {
        return 'vscode';
      }
    }

    return null;
  }

  detectOutputDir(cwd: string): string {
    if (fs.existsSync(path.join(cwd, 'dist'))) return 'dist';
    if (fs.existsSync(path.join(cwd, 'build'))) return 'build';
    if (fs.existsSync(path.join(cwd, 'out'))) return 'out';
    return 'dist'; // default
  }

  detectBuildCommand(cwd: string): string | null {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts) {
        if (pkg.scripts.build) return 'npm run build';
        if (pkg.scripts.compile) return 'npm run compile';
        if (pkg.scripts.bundle) return 'npm run bundle';
        if (pkg.scripts.dev) return 'npm run dev';
      }
    }
    return null;
  }
}
