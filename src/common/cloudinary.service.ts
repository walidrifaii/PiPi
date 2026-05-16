import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

type CloudinaryDestroyResult = {
  result: string;
};

function isCloudinaryDestroyResult(
  value: unknown,
): value is CloudinaryDestroyResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'result' in value &&
    typeof (value as CloudinaryDestroyResult).result === 'string'
  );
}

@Injectable()
export class CloudinaryService {
  private readonly log = new Logger(CloudinaryService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Extract Cloudinary `public_id` from a secure URL (e.g. …/upload/v123/athar/banners/x.jpg).
   */
  publicIdFromSecureUrl(imageUrl: string): string | null {
    const marker = '/upload/';
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) {
      return null;
    }
    let path = imageUrl.slice(idx + marker.length).split('?')[0] ?? '';
    path = path.replace(/^v\d+\//, '');
    const withoutExt = path.replace(/\.[a-zA-Z0-9]+$/, '');
    return withoutExt.length > 0 ? withoutExt : null;
  }

  /** True if the URL points at this app's Cloudinary cloud. */
  isOwnCloudinaryUrl(imageUrl: string): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    if (!cloudName) {
      return false;
    }
    return imageUrl.includes(`res.cloudinary.com/${cloudName}/`);
  }

  /**
   * Deletes the asset from Cloudinary when the URL is on this cloud.
   * Does not throw — logs a warning on failure so DB operations can complete.
   */
  async deleteImageByUrl(imageUrl: string | null | undefined): Promise<void> {
    const url = imageUrl?.trim();
    if (!url) {
      return;
    }
    if (!this.isOwnCloudinaryUrl(url)) {
      return;
    }
    const publicId = this.publicIdFromSecureUrl(url);
    if (!publicId) {
      this.log.warn(`Could not parse Cloudinary public_id from URL: ${url}`);
      return;
    }
    try {
      const raw: unknown = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      });
      if (!isCloudinaryDestroyResult(raw)) {
        this.log.warn(
          `Cloudinary destroy for public_id=${publicId}: unexpected response`,
        );
        return;
      }
      if (raw.result !== 'ok' && raw.result !== 'not found') {
        this.log.warn(
          `Cloudinary destroy for public_id=${publicId}: ${raw.result}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn(
        `Failed to delete Cloudinary image public_id=${publicId}: ${msg}`,
      );
    }
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    try {
      const result = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, uploaded) => {
              if (error || !uploaded) {
                reject(
                  error instanceof Error
                    ? error
                    : new Error('Cloudinary upload failed'),
                );
                return;
              }
              resolve(uploaded as { secure_url: string });
            },
          );
          stream.end(buffer);
        },
      );

      return result.secure_url;
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }
}
