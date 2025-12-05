import { sendBulkEmails } from "./email-service";

// lib/queue-service.ts
interface QueueJob {
  id: string;
  type: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  delay?: number;
  createdAt: Date;
}

class SimpleQueue {
  private queue: QueueJob[] = [];
  private processing = false;
  private isPaused = false;

  async addJob(type: string, data: any, delay: number = 0): Promise<string> {
    const job: QueueJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      attempts: 0,
      maxAttempts: 3,
      delay,
      createdAt: new Date(),
    };

    this.queue.push(job);
    console.log(`✅ Job queued: ${type} (ID: ${job.id})`);

    if (!this.processing && !this.isPaused) {
      this.processQueue();
    }

    return job.id;
  }

  private async processQueue() {
    if (this.processing || this.isPaused) return;

    this.processing = true;

    while (this.queue.length > 0 && !this.isPaused) {
      const job = this.queue[0];

      // Check if job should be delayed
      if (job.delay && job.delay > 0) {
        const elapsed = Date.now() - job.createdAt.getTime();
        if (elapsed < job.delay) {
          // Move to end of queue if still in delay period
          this.queue.shift();
          this.queue.push(job);
          await this.delay(1000);
          continue;
        }
      }

      // Process the job
      this.queue.shift();
      await this.processJob(job);

      // Small delay between jobs
      await this.delay(100);
    }

    this.processing = false;
  }

  // Add to the processJob method in queue-service.ts
  private async processJob(job: QueueJob) {
    try {
      console.log(
        `🔄 Processing job: ${job.type} (Attempt: ${job.attempts + 1})`
      );

      switch (job.type) {
        case "NOTIFY_PUBLISHERS":
          await this.handlePublisherNotification(job.data);
          break;
        case "SEND_BULK_EMAILS":
          await this.handleBulkEmail(job.data);
          break;

        default:
          console.warn(`Unknown job type: ${job.type}`);
      }

      console.log(`✅ Job completed: ${job.type} (ID: ${job.id})`);
    } catch (error) {
      // ... existing error handling
    }
  }

  private async handlePublisherNotification(data: any) {
    const { campaignId, batchSize = 50, delayBetweenBatches = 2000 } = data;

    // This will be implemented in the notification service
    const { processPublisherNotifications } = await import(
      "./notification-service"
    );
    await processPublisherNotifications(
      campaignId,
      batchSize,
      delayBetweenBatches
    );
  }

  private async handleBulkEmail(data: any) {
    const { emails, subject, html, batchSize = 50 } = data;
    await sendBulkEmails(emails, subject, html, batchSize);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    if (!this.processing) {
      this.processQueue();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingStatus(): boolean {
    return this.processing;
  }
}

// Singleton instance
export const emailQueue = new SimpleQueue();
