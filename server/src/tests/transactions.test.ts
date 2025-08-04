
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  deleteTransaction, 
  getTransactionItems 
} from '../handlers/transactions';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  username: 'testuser',
  password_hash: 'hashedpassword123',
  role: 'user' as const
};

const testAdmin = {
  username: 'admin',
  password_hash: 'hashedpassword456',
  role: 'admin' as const
};

const testItems = [
  {
    name: 'Test Item 1',
    description: 'First test item',
    category: 'category1'
  },
  {
    name: 'Test Item 2',
    description: 'Second test item',
    category: 'category2'
  }
];

describe('Transactions', () => {
  let userId: number;
  let adminId: number;
  let itemIds: number[];

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test admin
    const adminResult = await db.insert(usersTable)
      .values(testAdmin)
      .returning()
      .execute();
    adminId = adminResult[0].id;

    // Create test items
    const itemResults = await db.insert(itemsTable)
      .values(testItems)
      .returning()
      .execute();
    itemIds = itemResults.map(item => item.id);
  });

  afterEach(resetDB);

  describe('createTransaction', () => {
    it('should create a transaction with items', async () => {
      const input: CreateTransactionInput = {
        transaction_date: new Date('2024-01-01'),
        items: [
          { item_id: itemIds[0], quantity: 2 },
          { item_id: itemIds[1], quantity: 1 }
        ]
      };

      const result = await createTransaction(input, userId);

      expect(result.id).toBeDefined();
      expect(result.transaction_date).toEqual(new Date('2024-01-01'));
      expect(result.created_by).toEqual(userId);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save transaction to database', async () => {
      const input: CreateTransactionInput = {
        transaction_date: new Date('2024-01-01'),
        items: [
          { item_id: itemIds[0], quantity: 3 }
        ]
      };

      const result = await createTransaction(input, userId);

      // Verify transaction was saved
      const transactions = await db.select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, result.id))
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].created_by).toEqual(userId);

      // Verify transaction items were saved
      const transactionItems = await db.select()
        .from(transactionItemsTable)
        .where(eq(transactionItemsTable.transaction_id, result.id))
        .execute();

      expect(transactionItems).toHaveLength(1);
      expect(transactionItems[0].item_id).toEqual(itemIds[0]);
      expect(transactionItems[0].quantity).toEqual(3);
    });

    it('should throw error for non-existent user', async () => {
      const input: CreateTransactionInput = {
        transaction_date: new Date('2024-01-01'),
        items: [
          { item_id: itemIds[0], quantity: 1 }
        ]
      };

      expect(createTransaction(input, 999)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent item', async () => {
      const input: CreateTransactionInput = {
        transaction_date: new Date('2024-01-01'),
        items: [
          { item_id: 999, quantity: 1 }
        ]
      };

      expect(createTransaction(input, userId)).rejects.toThrow(/item.*not found/i);
    });
  });

  describe('getTransactions', () => {
    beforeEach(async () => {
      // Create test transactions
      await createTransaction({
        transaction_date: new Date('2024-01-01'),
        items: [{ item_id: itemIds[0], quantity: 1 }]
      }, userId);

      await createTransaction({
        transaction_date: new Date('2024-01-02'),
        items: [{ item_id: itemIds[1], quantity: 2 }]
      }, adminId);
    });

    it('should return all transactions when no userId provided', async () => {
      const result = await getTransactions();

      expect(result).toHaveLength(2);
      expect(result.every(t => t.id && t.created_by && t.transaction_date)).toBe(true);
    });

    it('should return filtered transactions for specific user', async () => {
      const result = await getTransactions(userId);

      expect(result).toHaveLength(1);
      expect(result[0].created_by).toEqual(userId);
    });

    it('should return empty array for user with no transactions', async () => {
      // Create another user
      const newUserResult = await db.insert(usersTable)
        .values({
          username: 'newuser',
          password_hash: 'hash',
          role: 'user'
        })
        .returning()
        .execute();

      const result = await getTransactions(newUserResult[0].id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getTransactionById', () => {
    let transactionId: number;

    beforeEach(async () => {
      const transaction = await createTransaction({
        transaction_date: new Date('2024-01-01'),
        items: [{ item_id: itemIds[0], quantity: 1 }]
      }, userId);
      transactionId = transaction.id;
    });

    it('should return transaction for owner', async () => {
      const result = await getTransactionById(transactionId, userId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(transactionId);
      expect(result!.created_by).toEqual(userId);
    });

    it('should return null for non-owner', async () => {
      const result = await getTransactionById(transactionId, adminId);

      expect(result).toBeNull();
    });

    it('should return null for non-existent transaction', async () => {
      const result = await getTransactionById(999, userId);

      expect(result).toBeNull();
    });
  });

  describe('deleteTransaction', () => {
    let transactionId: number;

    beforeEach(async () => {
      const transaction = await createTransaction({
        transaction_date: new Date('2024-01-01'),
        items: [{ item_id: itemIds[0], quantity: 1 }]
      }, userId);
      transactionId = transaction.id;
    });

    it('should delete transaction and its items for owner', async () => {
      const result = await deleteTransaction(transactionId, userId);

      expect(result).toBe(true);

      // Verify transaction was deleted
      const transactions = await db.select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, transactionId))
        .execute();

      expect(transactions).toHaveLength(0);

      // Verify transaction items were deleted
      const transactionItems = await db.select()
        .from(transactionItemsTable)
        .where(eq(transactionItemsTable.transaction_id, transactionId))
        .execute();

      expect(transactionItems).toHaveLength(0);
    });

    it('should return false for non-owner', async () => {
      const result = await deleteTransaction(transactionId, adminId);

      expect(result).toBe(false);

      // Verify transaction still exists
      const transactions = await db.select()
        .from(transactionsTable)
        .where(eq(transactionsTable.id, transactionId))
        .execute();

      expect(transactions).toHaveLength(1);
    });

    it('should return false for non-existent transaction', async () => {
      const result = await deleteTransaction(999, userId);

      expect(result).toBe(false);
    });
  });

  describe('getTransactionItems', () => {
    let transactionId: number;

    beforeEach(async () => {
      const transaction = await createTransaction({
        transaction_date: new Date('2024-01-01'),
        items: [
          { item_id: itemIds[0], quantity: 2 },
          { item_id: itemIds[1], quantity: 3 }
        ]
      }, userId);
      transactionId = transaction.id;
    });

    it('should return all items for transaction', async () => {
      const result = await getTransactionItems(transactionId);

      expect(result).toHaveLength(2);
      expect(result.some(item => item.item_id === itemIds[0] && item.quantity === 2)).toBe(true);
      expect(result.some(item => item.item_id === itemIds[1] && item.quantity === 3)).toBe(true);
      expect(result.every(item => item.transaction_id === transactionId)).toBe(true);
    });

    it('should return empty array for transaction with no items', async () => {
      // Create transaction directly without items
      const transactionResult = await db.insert(transactionsTable)
        .values({
          transaction_date: new Date('2024-01-01'),
          created_by: userId
        })
        .returning()
        .execute();

      const result = await getTransactionItems(transactionResult[0].id);

      expect(result).toHaveLength(0);
    });

    it('should return empty array for non-existent transaction', async () => {
      const result = await getTransactionItems(999);

      expect(result).toHaveLength(0);
    });
  });
});
