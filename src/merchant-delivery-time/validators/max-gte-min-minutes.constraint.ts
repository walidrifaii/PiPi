import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxGteMinMinutes', async: false })
export class MaxGteMinMinutesConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as {
      minMinutes?: number;
      maxMinutes?: number;
    };
    const min = Number(obj.minMinutes);
    const max = Number(obj.maxMinutes);
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return true;
    }
    return max >= min;
  }

  defaultMessage(): string {
    return 'maxMinutes must be greater than or equal to minMinutes';
  }
}
