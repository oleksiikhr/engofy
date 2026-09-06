import { ChangeSetType } from '@mikro-orm/core';
import {
  hasAnyFieldChanged,
  hasFieldChanged,
  isChangeSetOf,
  wasCreatedOrAnyFieldChanged,
  wasCreatedOrFieldChanged,
} from './change-set.helper.js';

class Foo {}
class Bar {}

describe('isChangeSetOf', () => {
  it('narrows to change sets whose entity is an instance of the class', () => {
    const isFoo = isChangeSetOf(Foo);
    expect(isFoo({ entity: new Foo() } as never)).toBe(true);
    expect(isFoo({ entity: new Bar() } as never)).toBe(false);
  });
});

describe('hasFieldChanged', () => {
  it('is true only for an UPDATE whose payload carries the field', () => {
    expect(
      hasFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { name: 'x' } },
        'name',
      ),
    ).toBe(true);
  });

  it('is false when the field is absent from the payload', () => {
    expect(
      hasFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { other: 1 } },
        'name',
      ),
    ).toBe(false);
  });

  it('is false for a CREATE (payload not consulted)', () => {
    expect(
      hasFieldChanged(
        { type: ChangeSetType.CREATE, payload: { name: 'x' } },
        'name',
      ),
    ).toBe(false);
  });

  it('tolerates a null/absent payload', () => {
    expect(hasFieldChanged({ type: ChangeSetType.UPDATE }, 'name')).toBe(false);
    expect(
      hasFieldChanged({ type: ChangeSetType.UPDATE, payload: null }, 'name'),
    ).toBe(false);
  });
});

describe('wasCreatedOrFieldChanged', () => {
  it('is true for any CREATE', () => {
    expect(
      wasCreatedOrFieldChanged({ type: ChangeSetType.CREATE }, 'name'),
    ).toBe(true);
  });

  it('falls back to hasFieldChanged for an UPDATE', () => {
    expect(
      wasCreatedOrFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { name: 1 } },
        'name',
      ),
    ).toBe(true);
    expect(
      wasCreatedOrFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { x: 1 } },
        'name',
      ),
    ).toBe(false);
  });
});

describe('hasAnyFieldChanged', () => {
  const fields = new Set(['a', 'b']);

  it('is true when the UPDATE payload touches any listed field', () => {
    expect(
      hasAnyFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { b: 2, c: 3 } },
        fields,
      ),
    ).toBe(true);
  });

  it('is false when the payload touches none of them', () => {
    expect(
      hasAnyFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { c: 3 } },
        fields,
      ),
    ).toBe(false);
  });

  it('is false for a CREATE', () => {
    expect(
      hasAnyFieldChanged(
        { type: ChangeSetType.CREATE, payload: { a: 1 } },
        fields,
      ),
    ).toBe(false);
  });
});

describe('wasCreatedOrAnyFieldChanged', () => {
  it('is true for a CREATE, otherwise defers to hasAnyFieldChanged', () => {
    const fields = new Set(['a']);
    expect(
      wasCreatedOrAnyFieldChanged({ type: ChangeSetType.CREATE }, fields),
    ).toBe(true);
    expect(
      wasCreatedOrAnyFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { a: 1 } },
        fields,
      ),
    ).toBe(true);
    expect(
      wasCreatedOrAnyFieldChanged(
        { type: ChangeSetType.UPDATE, payload: { z: 1 } },
        fields,
      ),
    ).toBe(false);
  });
});
