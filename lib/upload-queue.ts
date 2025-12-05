// lib/upload-queue.ts
class UploadQueue {
  private concurrentUploads = 0;
  private maxConcurrent = 3; // Limit concurrent uploads
  private queue: Array<() => Promise<void>> = [];

  async addUpload(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const executeTask = async (): Promise<void> => {
        this.concurrentUploads++;
        try {
          await task();
          resolve(); // ✅ Now properly typed with void
        } catch (error) {
          reject(error);
        } finally {
          this.concurrentUploads--;
          this.processQueue();
        }
      };

      if (this.concurrentUploads < this.maxConcurrent) {
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.concurrentUploads < this.maxConcurrent) {
      const task = this.queue.shift();
      if (task) task();
    }
  }

  // Optional: Add methods to monitor queue status
  getQueueStatus() {
    return {
      concurrentUploads: this.concurrentUploads,
      maxConcurrent: this.maxConcurrent,
      queuedTasks: this.queue.length,
    };
  }
}

export const uploadQueue = new UploadQueue();
