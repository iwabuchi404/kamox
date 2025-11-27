import { LogEntry, LogCollection } from '../types/common.js';

export class Logger {
  private logs: LogCollection = {
    build: [],
    runtime: [],
    pages: {}
  };

  log(type: LogEntry['type'], content: string, source: string = 'system') {
    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      content,
      source
    };
    
    // シンプルなコンソール出力
    const time = new Date(entry.timestamp).toISOString().split('T')[1].split('.')[0];
    console.log(`[${time}] [${source}] ${content}`);

    if (source === 'build') {
      this.logs.build.push(entry);
    } else if (source.startsWith('page_')) {
      if (!this.logs.pages[source]) {
        this.logs.pages[source] = [];
      }
      this.logs.pages[source].push(entry);
    } else {
      this.logs.runtime.push(entry);
    }
  }

  getLogs(): LogCollection {
    return this.logs;
  }

  clearLogs() {
    this.logs = {
      build: [],
      runtime: [],
      pages: {}
    };
  }
}
