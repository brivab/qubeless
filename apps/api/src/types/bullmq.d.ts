declare module 'bullmq' {
  export interface QueueOptions {
    connection?: { host?: string; port?: number };
  }
  export interface BackoffOptions {
    type: string;
    delay: number;
  }
  export interface JobOptions {
    attempts?: number;
    backoff?: BackoffOptions;
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
  }
  export class Queue<T = any> {
    constructor(name: string, opts?: QueueOptions);
    add(name: string, data: T, opts?: JobOptions): Promise<void>;
    close(): Promise<void>;
  }
}
