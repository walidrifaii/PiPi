import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxGteMinDeliveryTime', async: false })
export class MaxGteMinDeliveryTimeConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { min?: number; max?: number };
    const min = Number(obj.min);
    const max = Number(obj.max);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return true;
    }
    return max >= min;
  }

  defaultMessage(): string {
    return 'max must be greater than or equal to min';
  }
}
