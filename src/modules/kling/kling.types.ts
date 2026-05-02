export type KlingCredentials = {
  accessKey: string;
  secretKey: string;
};

export type KlingTaskStatus =
  | 'submitted'
  | 'queued'
  | 'processing'
  | 'succeed'
  | 'failed'
  | 'unknown'
  | string;

export type KlingTextToVideoRequest = {
  model: string;
  prompt: string;
  negative_prompt?: string;
  duration?: number;
  aspect_ratio?: string;
  mode?: string;
  callback_url?: string;
  external_task_id?: string;
};

export type KlingTextToVideoResponse = {
  task_id?: string;
  request_id?: string;
  status?: KlingTaskStatus;
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: KlingTaskStatus;
    created_at?: number | string;
    submit_time?: number | string;
  } | null;
  [key: string]: unknown;
};

export type KlingVideoTaskResponse = {
  task_id?: string;
  request_id?: string;
  status?: KlingTaskStatus;
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: KlingTaskStatus;
    task_result?: {
      videos?: Array<{
        id?: string;
        url?: string;
        duration?: number;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    } | null;
    task_info?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type KlingWebhookPayload = {
  task_id?: string;
  request_id?: string;
  status?: KlingTaskStatus;
  task_status?: KlingTaskStatus;
  code?: number;
  message?: string;
  data?: {
    task_id?: string;
    task_status?: KlingTaskStatus;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};
