import { exec } from 'child_process';
import { RebuildResult, LogEntry } from '../types/common.js';

export async function runBuild(command: string, cwd: string): Promise<RebuildResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const logs: LogEntry[] = [];

    exec(command, { cwd }, (error, stdout, stderr) => {
      const endTime = Date.now();
      
      if (stdout) {
        logs.push({
          timestamp: endTime,
          type: 'info',
          content: stdout,
          source: 'build'
        });
      }

      if (stderr) {
        logs.push({
          timestamp: endTime,
          type: 'error',
          content: stderr,
          source: 'build'
        });
      }

      if (error) {
        logs.push({
          timestamp: endTime,
          type: 'error',
          content: error.message,
          source: 'build'
        });
      }

      resolve({
        success: !error,
        logs,
        buildTime: endTime - startTime
      });
    });
  });
}
