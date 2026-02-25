import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';

interface UploadResult {
  bucket: string;
  key: string;
  url?: string;
}

function normalizeEndpoint(value?: string | null) {
  if (!value) return undefined;
  return value.replace(/\/$/, '');
}

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly signingClient: S3Client;
  readonly urlExpirySeconds = 15 * 60;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET_SOURCES') ?? 'sources';
    const endpoint = normalizeEndpoint(this.configService.get<string>('MINIO_ENDPOINT')) ?? 'http://minio:9000';
    const publicEndpoint = normalizeEndpoint(this.configService.get<string>('MINIO_PUBLIC_ENDPOINT')) ?? endpoint;
    const baseConfig = {
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('MINIO_ACCESS_KEY') ?? 'minio',
        secretAccessKey: this.configService.get<string>('MINIO_SECRET_KEY') ?? 'minio123',
      },
      forcePathStyle: true,
    };
    this.client = new S3Client({
      ...baseConfig,
      endpoint,
    });
    this.signingClient =
      publicEndpoint === endpoint
        ? this.client
        : new S3Client({
            ...baseConfig,
            endpoint: publicEndpoint,
          });
  }

  async uploadStream(
    stream: Readable,
    opts: { objectKey?: string; contentType?: string },
  ): Promise<UploadResult> {
    const key =
      opts.objectKey ??
      `${randomUUID()}${opts?.contentType ? extname(opts.contentType) : ''}`.replace(/^\./, '');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: opts.contentType ?? 'application/octet-stream',
      }),
    );

    return { bucket: this.bucket, key };
  }

  async uploadBuffer(
    buffer: Buffer,
    opts: { objectKey?: string; contentType?: string; metadata?: Record<string, string> },
  ): Promise<UploadResult> {
    const key =
      opts.objectKey ??
      `${randomUUID()}${opts?.contentType ? extname(opts.contentType) : ''}`.replace(/^\./, '');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: opts.contentType ?? 'application/octet-stream',
        ContentLength: buffer.length,
        Metadata: opts.metadata,
      }),
    );

    return { bucket: this.bucket, key };
  }

  async getPresignedUrl(params: { bucket?: string; key: string; contentType?: string }) {
    const bucket = params.bucket ?? this.bucket;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
    });
    return getSignedUrl(this.signingClient, command, { expiresIn: this.urlExpirySeconds });
  }

  async getObjectStream(params: { bucket?: string; key: string }) {
    const bucket = params.bucket ?? this.bucket;
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
      }),
    );

    if (!result.Body) {
      throw new Error('Empty object');
    }

    return {
      stream: result.Body as Readable,
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      eTag: result.ETag,
    };
  }

  async getObjectBuffer(params: { bucket?: string; key: string }) {
    const result = await this.getObjectStream(params);
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: result.contentType,
      contentLength: result.contentLength,
      eTag: result.eTag,
    };
  }
}
