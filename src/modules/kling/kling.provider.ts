import { Injectable } from '@nestjs/common';
import { KlingHttpClient } from './kling-http.client';
import {
  KlingCredentials,
  KlingTextToVideoRequest,
  KlingTextToVideoResponse,
  KlingVideoTaskResponse,
} from './kling.types';

@Injectable()
export class KlingProvider {
  constructor(private readonly klingHttpClient: KlingHttpClient) {}

  async submitTextToVideo(
    input: KlingTextToVideoRequest,
    credentials?: KlingCredentials,
  ): Promise<KlingTextToVideoResponse> {
    return this.klingHttpClient.post<KlingTextToVideoResponse>(
      '/v1/videos/text2video',
      input,
      credentials,
    );
  }

  async getTextToVideoTask(
    taskId: string,
    credentials?: KlingCredentials,
  ): Promise<KlingVideoTaskResponse> {
    return this.klingHttpClient.get<KlingVideoTaskResponse>(
      `/v1/videos/text2video/${encodeURIComponent(taskId)}`,
      credentials,
    );
  }
}
