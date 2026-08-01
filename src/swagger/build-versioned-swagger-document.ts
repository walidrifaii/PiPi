import type { OpenAPIObject } from '@nestjs/swagger';

/** Keep only URI-versioned paths for a given prefix (e.g. `/v3`). */
export function filterSwaggerPathsByPrefix(
  document: OpenAPIObject,
  prefix: string,
): OpenAPIObject {
  const paths = document.paths ?? {};
  const filteredPaths = Object.fromEntries(
    Object.entries(paths).filter(([path]) => path.startsWith(prefix)),
  );
  return { ...document, paths: filteredPaths };
}

/** Remove URI-versioned paths from the legacy Swagger doc. */
export function excludeVersionedSwaggerPaths(
  document: OpenAPIObject,
  excludedPrefixes: string[],
): OpenAPIObject {
  const paths = document.paths ?? {};
  const filteredPaths = Object.fromEntries(
    Object.entries(paths).filter(
      ([path]) => !excludedPrefixes.some((prefix) => path.startsWith(prefix)),
    ),
  );
  return { ...document, paths: filteredPaths };
}

export function filterSwaggerTagGroups<T extends { name: string; tags: string[] }>(
  groups: T[],
  allowedTags: Set<string>,
): T[] {
  return groups
    .map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => allowedTags.has(tag)),
    }))
    .filter((group) => group.tags.length > 0);
}

export function collectSwaggerTags(document: OpenAPIObject): Set<string> {
  const tags = new Set<string>();
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem ?? {})) {
      if (!operation || typeof operation !== 'object') continue;
      const opTags = (operation as { tags?: string[] }).tags;
      if (Array.isArray(opTags)) {
        for (const tag of opTags) {
          tags.add(tag);
        }
      }
    }
  }
  return tags;
}
