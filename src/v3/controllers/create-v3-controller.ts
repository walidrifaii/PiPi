import { Controller, Type } from '@nestjs/common';
import 'reflect-metadata';

/** Same routes and handlers as v1, mounted under `/v3/...`. */
export function createV3Controller<TBase extends Type>(
  Base: TBase,
  path?: string,
): Type {
  @Controller(path === undefined ? { version: '3' } : { path, version: '3' })
  class V3Controller extends (Base as Type<Record<string, unknown>>) {
    constructor(...args: ConstructorParameters<TBase>) {
      super(...args);
    }
  }

  Object.defineProperty(V3Controller, 'name', {
    value: `${Base.name}V3`,
    configurable: true,
  });

  const paramTypes = Reflect.getMetadata('design:paramtypes', Base);
  if (paramTypes) {
    Reflect.defineMetadata('design:paramtypes', paramTypes, V3Controller);
  }

  return V3Controller;
}
