import { type AnyEntity, type ChangeSet, ChangeSetType } from '@mikro-orm/core';

type ChangeSetLike = {
  type: ChangeSetType;
  payload?: Record<string, unknown> | null;
};

export function isChangeSetOf<T extends AnyEntity>(
  entityClass: new (...args: unknown[]) => T,
) {
  return (
    cs: ChangeSet<AnyEntity>,
  ): cs is ChangeSet<AnyEntity> & { entity: T } =>
    cs.entity instanceof entityClass;
}

export function hasFieldChanged(cs: ChangeSetLike, field: string): boolean {
  if (cs.type !== ChangeSetType.UPDATE) {
    return false;
  }

  return Object.hasOwn(cs.payload ?? {}, field);
}

export function wasCreatedOrFieldChanged(
  cs: ChangeSetLike,
  field: string,
): boolean {
  return cs.type === ChangeSetType.CREATE || hasFieldChanged(cs, field);
}

export function hasAnyFieldChanged(
  cs: ChangeSetLike,
  fields: Set<string>,
): boolean {
  if (cs.type !== ChangeSetType.UPDATE) {
    return false;
  }

  return Object.keys(cs.payload ?? {}).some((k) => fields.has(k));
}

export function wasCreatedOrAnyFieldChanged(
  cs: ChangeSetLike,
  fields: Set<string>,
): boolean {
  return cs.type === ChangeSetType.CREATE || hasAnyFieldChanged(cs, fields);
}
