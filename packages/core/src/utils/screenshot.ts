import fs from 'fs';
import path from 'path';

export class ScreenshotManager {
  private screenshotDir: string;

  constructor(rootDir: string) {
    this.screenshotDir = path.join(rootDir, 'screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
    this.startCleanupTask();
  }

  async saveScreenshot(buffer: Buffer, prefix: string): Promise<string> {
    const filename = `${prefix}_${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    await fs.promises.writeFile(filepath, buffer);
    return `screenshots/${filename}`;
  }

  private startCleanupTask() {
    setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000); // 10分ごとに実行
  }

  private async cleanup() {
    try {
      const files = await fs.promises.readdir(this.screenshotDir);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.screenshotDir, file);
        const stats = await fs.promises.stat(filepath);
        if (now - stats.mtimeMs > oneHour) {
          await fs.promises.unlink(filepath);
        }
      }
    } catch (error) {
      console.error('Screenshot cleanup failed:', error);
    }
  }
}
