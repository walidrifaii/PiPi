import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

function detectMimeType(buffer: Buffer): { mimeType: string; ext: string } {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { mimeType: 'image/gif', ext: 'gif' };
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  return { mimeType: 'application/octet-stream', ext: 'bin' };
}

@Injectable()
export class S3Service {
  private readonly log = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cloudFrontUrl: string;

  constructor() {
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'eu-north-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    this.cloudFrontUrl = (process.env.AWS_CLOUDFRONT_URL ?? '').replace(
      /\/$/,
      '',
    );
  }

  /** True if the URL belongs to this app's CloudFront distribution. */
  isOwnS3Url(imageUrl: string): boolean {
    if (!this.cloudFrontUrl) {
      return false;
    }
    return imageUrl.startsWith(this.cloudFrontUrl + '/');
  }

  /** Extract S3 key from a CloudFront URL. */
  keyFromUrl(imageUrl: string): string | null {
    if (!this.isOwnS3Url(imageUrl)) {
      return null;
    }
    const key = imageUrl.slice(this.cloudFrontUrl.length + 1).split('?')[0];
    return key || null;
  }

  /**
   * Deletes the S3 object when the URL belongs to this distribution.
   * Does not throw — logs a warning on failure so DB operations can complete.
   */
  async deleteImageByUrl(imageUrl: string | null | undefined): Promise<void> {
    const url = imageUrl?.trim();
    if (!url) {
      return;
    }
    const key = this.keyFromUrl(url);
    if (!key) {
      return;
    }
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(`Failed to delete S3 object key=${key}: ${msg}`);
    }
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    const { mimeType, ext } = detectMimeType(buffer);
    const key = `${folder}/${randomUUID()}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
      return `${this.cloudFrontUrl}/${key}`;
    } catch {
      throw new InternalServerErrorException('Failed to upload image to S3');
    }
  }
}
