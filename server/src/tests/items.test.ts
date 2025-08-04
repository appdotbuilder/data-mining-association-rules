
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput } from '../schema';
import { createItem, getItems, getItemById, updateItem, deleteItem } from '../handlers/items';
import { eq } from 'drizzle-orm';

// Test data
const adminUser = {
  username: 'admin',
  password_hash: 'hash123',
  role: 'admin' as const
};

const regularUser = {
  username: 'user',
  password_hash: 'hash456',
  role: 'user' as const
};

const testItem: CreateItemInput = {
  name: 'Test Item',
  description: 'A test item description',
  category: 'test-category'
};

const testItemMinimal: CreateItemInput = {
  name: 'Minimal Item',
  description: null,
  category: null
};

describe('Item handlers', () => {
  let adminUserId: number;
  let regularUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const adminResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();
    adminUserId = adminResult[0].id;

    const userResult = await db.insert(usersTable)
      .values(regularUser)
      .returning()
      .execute();
    regularUserId = userResult[0].id;
  });

  afterEach(resetDB);

  describe('createItem', () => {
    it('should create an item as admin user', async () => {
      const result = await createItem(testItem, adminUserId);

      expect(result.name).toEqual('Test Item');
      expect(result.description).toEqual('A test item description');
      expect(result.category).toEqual('test-category');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create an item with null description and category', async () => {
      const result = await createItem(testItemMinimal, adminUserId);

      expect(result.name).toEqual('Minimal Item');
      expect(result.description).toBeNull();
      expect(result.category).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should save item to database', async () => {
      const result = await createItem(testItem, adminUserId);

      const items = await db.select()
        .from(itemsTable)
        .where(eq(itemsTable.id, result.id))
        .execute();

      expect(items).toHaveLength(1);
      expect(items[0].name).toEqual('Test Item');
      expect(items[0].description).toEqual('A test item description');
      expect(items[0].category).toEqual('test-category');
    });

    it('should throw error for non-admin user', async () => {
      expect(createItem(testItem, regularUserId)).rejects.toThrow(/only admin users can create items/i);
    });

    it('should throw error for non-existent user', async () => {
      expect(createItem(testItem, 99999)).rejects.toThrow(/only admin users can create items/i);
    });
  });

  describe('getItems', () => {
    it('should return empty array when no items exist', async () => {
      const result = await getItems();
      expect(result).toEqual([]);
    });

    it('should return all items', async () => {
      // Create test items
      await createItem(testItem, adminUserId);
      await createItem(testItemMinimal, adminUserId);

      const result = await getItems();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Item');
      expect(result[1].name).toEqual('Minimal Item');
    });
  });

  describe('getItemById', () => {
    it('should return null for non-existent item', async () => {
      const result = await getItemById(99999);
      expect(result).toBeNull();
    });

    it('should return item by ID', async () => {
      const created = await createItem(testItem, adminUserId);
      const result = await getItemById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Item');
      expect(result!.description).toEqual('A test item description');
      expect(result!.category).toEqual('test-category');
    });
  });

  describe('updateItem', () => {
    let itemId: number;

    beforeEach(async () => {
      const created = await createItem(testItem, adminUserId);
      itemId = created.id;
    });

    it('should update item as admin user', async () => {
      const updateInput: UpdateItemInput = {
        id: itemId,
        name: 'Updated Item',
        description: 'Updated description',
        category: 'updated-category'
      };

      const result = await updateItem(updateInput, adminUserId);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Updated Item');
      expect(result!.description).toEqual('Updated description');
      expect(result!.category).toEqual('updated-category');
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should update only provided fields', async () => {
      const updateInput: UpdateItemInput = {
        id: itemId,
        name: 'Partially Updated'
      };

      const result = await updateItem(updateInput, adminUserId);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Partially Updated');
      expect(result!.description).toEqual('A test item description'); // Unchanged
      expect(result!.category).toEqual('test-category'); // Unchanged
    });

    it('should handle null values in updates', async () => {
      const updateInput: UpdateItemInput = {
        id: itemId,
        description: null,
        category: null
      };

      const result = await updateItem(updateInput, adminUserId);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Test Item'); // Unchanged
      expect(result!.description).toBeNull();
      expect(result!.category).toBeNull();
    });

    it('should return null for non-existent item', async () => {
      const updateInput: UpdateItemInput = {
        id: 99999,
        name: 'Non-existent'
      };

      const result = await updateItem(updateInput, adminUserId);
      expect(result).toBeNull();
    });

    it('should throw error for non-admin user', async () => {
      const updateInput: UpdateItemInput = {
        id: itemId,
        name: 'Updated by user'
      };

      expect(updateItem(updateInput, regularUserId)).rejects.toThrow(/only admin users can update items/i);
    });
  });

  describe('deleteItem', () => {
    let itemId: number;

    beforeEach(async () => {
      const created = await createItem(testItem, adminUserId);
      itemId = created.id;
    });

    it('should delete item as admin user', async () => {
      const result = await deleteItem(itemId, adminUserId);

      expect(result).toBe(true);

      // Verify item is deleted
      const item = await getItemById(itemId);
      expect(item).toBeNull();
    });

    it('should return false for non-existent item', async () => {
      const result = await deleteItem(99999, adminUserId);
      expect(result).toBe(false);
    });

    it('should throw error for non-admin user', async () => {
      expect(deleteItem(itemId, regularUserId)).rejects.toThrow(/only admin users can delete items/i);
    });

    it('should throw error when item is used in transactions', async () => {
      // Create a transaction with the item
      const transactionResult = await db.insert(transactionsTable)
        .values({
          transaction_date: new Date(),
          created_by: adminUserId
        })
        .returning()
        .execute();

      await db.insert(transactionItemsTable)
        .values({
          transaction_id: transactionResult[0].id,
          item_id: itemId,
          quantity: 1
        })
        .execute();

      expect(deleteItem(itemId, adminUserId)).rejects.toThrow(/cannot delete item that is used in transactions/i);
    });
  });
});
