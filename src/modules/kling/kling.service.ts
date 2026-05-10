import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KLING_TEXT_TO_VIDEO_TASK_TYPE } from './kling.constants';
import { KlingProvider } from './kling.provider';
import {
  KlingTextToVideoRequest,
  KlingTextToVideoResponse,
  KlingVideoTaskResponse,
  KlingWebhookPayload,
} from './kling.types';

@Injectable()
export class KlingService {
  private readonly logger = new Logger(KlingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly klingProvider: KlingProvider,
  ) {}

  async submitTextToVideoTask(
    generationRequestId: bigint,
    input: KlingTextToVideoRequest,
  ): Promise<KlingTextToVideoResponse> {
    const response = await this.klingProvider.submitTextToVideo(input);
    const taskId = this.extractTaskId(response);
    const status = this.normalizeStatus(
      response.data?.task_status ?? response.status ?? 'submitted',
    );

    if (!taskId) {
      throw new InternalServerErrorException(
        'Kling API response missing task id',
      );
    }

    await this.klingTasksDelegate.upsert({
      where: { task_id: taskId },
      create: {
        generation_request_id: generationRequestId,
        attempt_no: 1,
        task_id: taskId,
        external_task_id: input.external_task_id ?? null,
        task_type: KLING_TEXT_TO_VIDEO_TASK_TYPE,
        model: input.model,
        status,
        request_payload: input as Prisma.InputJsonValue,
        submit_response: response as Prisma.InputJsonValue,
        submitted_at: new Date(),
      },
      update: {
        external_task_id: input.external_task_id ?? null,
        task_type: KLING_TEXT_TO_VIDEO_TASK_TYPE,
        model: input.model,
        status,
        request_payload: input as Prisma.InputJsonValue,
        submit_response: response as Prisma.InputJsonValue,
        submitted_at: new Date(),
        error_message: response.message ?? null,
      },
    });

    return response;
  }

  async handleWebhookCallback(
    token: string,
    payload: KlingWebhookPayload,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    this.assertWebhookToken(token);

    const taskId = this.extractTaskId(payload);
    if (!taskId) {
      this.logger.warn('Kling webhook received without task_id');
      return;
    }

    const existingTask = await this.klingTasksDelegate.findUnique({
      where: { task_id: taskId },
    });

    if (!existingTask) {
      this.logger.warn(`Kling webhook received for unknown task_id: ${taskId}`);
      return;
    }

    const callbackStatus = this.normalizeStatus(
      payload.data?.task_status ?? payload.task_status ?? payload.status,
    );

    await this.klingTaskCallbacksDelegate.create({
      data: {
        kling_task_id: existingTask.id,
        status: callbackStatus,
        headers: this.serializeHeaders(headers),
        payload: payload as Prisma.InputJsonValue,
      },
    });

    await this.klingTasksDelegate.update({
      where: { id: existingTask.id },
      data: {
        status: callbackStatus,
        last_callback_at: new Date(),
        error_message: payload.message ?? null,
      },
    });

    await this.refreshTaskFromProvider(taskId);
  }

  async refreshTaskFromProvider(taskId: string): Promise<any> {
    const providerResponse =
      await this.klingProvider.getTextToVideoTask(taskId);
    const status = this.normalizeStatus(
      providerResponse.data?.task_status ?? providerResponse.status,
    );
    const isCompleted = this.isTerminalStatus(status);

    return this.klingTasksDelegate.update({
      where: { task_id: taskId },
      data: {
        status,
        result_payload: providerResponse as Prisma.InputJsonValue,
        completed_at: isCompleted ? new Date() : null,
        error_message: providerResponse.message ?? null,
      },
    });
  }

  private assertWebhookToken(token: string) {
    const expectedToken = this.config.getOrThrow<string>('KLING_WEBHOOK_TOKEN');

    if (token !== expectedToken) {
      throw new ForbiddenException('Invalid Kling webhook token');
    }
  }

  private extractTaskId(
    payload:
      | KlingTextToVideoResponse
      | KlingVideoTaskResponse
      | KlingWebhookPayload,
  ): string | null {
    const directTaskId = payload.task_id;
    if (typeof directTaskId === 'string' && directTaskId.trim()) {
      return directTaskId.trim();
    }

    const nestedTaskId = payload.data?.task_id;
    if (typeof nestedTaskId === 'string' && nestedTaskId.trim()) {
      return nestedTaskId.trim();
    }

    return null;
  }

  private normalizeStatus(status?: string | null): string {
    return (status ?? 'unknown').trim().toLowerCase();
  }

  private isTerminalStatus(status: string): boolean {
    return ['succeed', 'failed'].includes(status);
  }

  private serializeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ) {
    return Object.fromEntries(
      Object.entries(headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, value]),
    ) as Prisma.InputJsonValue;
  }

  private get klingTasksDelegate() {
    return (
      this.prisma as PrismaService & {
        kling_tasks: {
          upsert(args: unknown): Promise<any>;
          update(args: unknown): Promise<any>;
          findUnique(args: unknown): Promise<any>;
        };
      }
    ).kling_tasks;
  }

  private get klingTaskCallbacksDelegate() {
    return (
      this.prisma as PrismaService & {
        kling_task_callbacks: {
          create(args: unknown): Promise<any>;
        };
      }
    ).kling_task_callbacks;
  }
}
