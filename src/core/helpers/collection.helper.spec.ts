import { Collection } from '@mikro-orm/core';
import {
  moveInCollection,
  normalizeOrder,
  removeFromCollection,
} from './collection.helper.js';

interface TestItem {
  id: string;
  position: number;
}

function createCollection(initial: TestItem[]) {
  let items = [...initial];

  return {
    getItems: () => items,

    remove: (target: TestItem) => {
      items = items.filter((i) => i !== target);
    },

    set: (next: TestItem[]) => {
      items = [...next];
    },

    add: (item: TestItem) => {
      items.push(item);
    },
  } as Collection<TestItem>;
}

describe('reorder.helper', () => {
  describe('moveInCollection', () => {
    it('moves item forward', () => {
      const items: TestItem[] = [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
        { id: 'c', position: 2 },
      ];

      const collection = createCollection(items);

      moveInCollection(collection, items[0], 2);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
      expect(result.map((i) => i.position)).toEqual([0, 1, 2]);
    });

    it('moves item backward', () => {
      const items: TestItem[] = [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
        { id: 'c', position: 2 },
      ];

      const collection = createCollection(items);

      moveInCollection(collection, items[2], 0);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b']);
      expect(result.map((i) => i.position)).toEqual([0, 1, 2]);
    });

    it('clamps index if too large', () => {
      const items: TestItem[] = [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
      ];

      const collection = createCollection(items);

      moveInCollection(collection, items[0], 999);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['b', 'a']);
      expect(result.map((i) => i.position)).toEqual([0, 1]);
    });

    it('does nothing if target not in collection', () => {
      const items: TestItem[] = [{ id: 'a', position: 0 }];

      const collection = createCollection(items);

      const outsider = { id: 'x', position: 0 };

      moveInCollection(collection, outsider, 0);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['a']);
      expect(result.map((i) => i.position)).toEqual([0]);
    });

    it('does nothing if moving to same index', () => {
      const items: TestItem[] = [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
      ];

      const collection = createCollection(items);

      moveInCollection(collection, items[0], 0);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['a', 'b']);
    });
  });

  describe('removeFromCollection', () => {
    it('removes item and normalizes order', () => {
      const items: TestItem[] = [
        { id: 'a', position: 0 },
        { id: 'b', position: 1 },
        { id: 'c', position: 2 },
      ];

      const collection = createCollection(items);

      removeFromCollection(collection, items[1]);

      const result = collection.getItems();

      expect(result.map((i) => i.id)).toEqual(['a', 'c']);
      expect(result.map((i) => i.position)).toEqual([0, 1]);
    });
  });

  describe('normalizeOrder', () => {
    it('reassigns positions sequentially', () => {
      const items: TestItem[] = [
        { id: 'a', position: 5 },
        { id: 'b', position: 10 },
      ];

      normalizeOrder(items);

      expect(items.map((i) => i.position)).toEqual([0, 1]);
    });
  });
});
