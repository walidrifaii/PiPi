import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(buffer: Buffer, folder: string): Promise<string> {
    try {
      const result = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, uploaded) => {
              if (error || !uploaded) {
                reject(error);
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
