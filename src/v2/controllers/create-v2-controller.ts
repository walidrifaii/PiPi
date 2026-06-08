import { Controller, Type } from '@nestjs/common';
import 'reflect-metadata';

/** Same routes and handlers as v1, mounted under `/v2/...`. */
export function createV2Controller<TBase extends Type>(
  Base: TBase,
  path?: string,
): Type {
  @Controller(path === undefined ? { version: '2' } : { path, version: '2' })
  class V2Controller extends (Base as Type<Record<string, unknown>>) {
    constructor(...args: ConstructorParameters<TBase>) {
      super(...args);
    }
  }

  Object.defineProperty(V2Controller, 'name', {
    value: `${Base.name}V2`,
    configurable: true,
  });

  // Nest DI reads param types from the subclass constructor; rest-args erase them.
  const paramTypes = Reflect.getMetadata('design:paramtypes', Base);
  if (paramTypes) {
    Reflect.defineMetadata('design:paramtypes', paramTypes, V2Controller);
  }

  return V2Controller;
}
