import { spawn } from 'child_process';
import { RebuildResult, LogEntry } from '../types/common.js';

export async function runBuild(command: string, cwd: string): Promise<RebuildResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    // Simple command parsing: split by spaces, respecting quotes could be added if needed
    // For now, we assume standard npm scripts usage (e.g. "npm run build")
    
    // Security Check: Reject shell metacharacters
    // On Windows, spawning batch files (like npm.cmd) can still be vulnerable to argument injection
    // even with shell: false. We strictly disallow shell operators.
    if (/[\&\|\;\>\<\`\$\(\)]/.test(command)) {
      resolve({
        success: false,
        logs: [{
          timestamp: Date.now(),
          type: 'error',
          content: 'Security Error: Shell operators (&, |, ;, >, <, etc.) are not allowed in buildCommand.\nPlease move complex logic to npm scripts (e.g. "npm run build").',
          source: 'system'
        }],
        buildTime: 0
      });
      return;
    }

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    const child = spawn(cmd, args, { 
      cwd,
      shell: false, // Critical for security: prevents shell injection
      stdio: 'pipe' // Capture output
    });

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const content = data.toString().trim();
        if (content) {
          logs.push({
            timestamp: Date.now(),
            type: 'info',
            content,
            source: 'build'
          });
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const content = data.toString().trim();
        if (content) {
          logs.push({
            timestamp: Date.now(),
            type: 'error', // stderr doesn't always mean error, but often does in build tools
            content,
            source: 'build'
          });
        }
      });
    }

    child.on('error', (error) => {
      logs.push({
        timestamp: Date.now(),
        type: 'error',
        content: error.message,
        source: 'build'
      });
      resolve({
        success: false,
        logs,
        buildTime: Date.now() - startTime
      });
    });

    child.on('close', (code) => {
      const endTime = Date.now();
      resolve({
        success: code === 0,
        logs,
        buildTime: endTime - startTime
      });
    });
  });
}
