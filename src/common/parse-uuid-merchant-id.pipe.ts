import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';

/** Path segments used by other routes under `/merchants`. */
const RESERVED_MERCHANT_ID_SEGMENTS = new Set(['me', 'admin']);

/**
 * Validates `:merchantId` is a UUID and not a reserved path segment (`me`, `admin`).
 */
@Injectable()
export class ParseUuidMerchantIdPipe implements PipeTransform {
  private readonly uuidPipe = new ParseUUIDPipe();

  transform(value: string, metadata: ArgumentMetadata) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (RESERVED_MERCHANT_ID_SEGMENTS.has(normalized)) {
      throw new BadRequestException(
        `Invalid merchant id "${value}". Use /merchants/${value}/... routes for that scope.`,
      );
    }
    return this.uuidPipe.transform(value, metadata);
  }
}
