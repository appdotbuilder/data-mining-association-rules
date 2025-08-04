
import { db } from '../db';
import { transactionsTable, transactionItemsTable, itemsTable, usersTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction, type TransactionItem } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createTransaction(input: CreateTransactionInput, userId: number): Promise<Transaction> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify all items exist
    const itemIds = input.items.map(item => item.item_id);
    
    // Check each item exists
    for (const itemId of itemIds) {
      const item = await db.select()
        .from(itemsTable)
        .where(eq(itemsTable.id, itemId))
        .execute();
      
      if (item.length === 0) {
        throw new Error(`Item with id ${itemId} not found`);
      }
    }

    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_date: input.transaction_date,
        created_by: userId
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Create transaction items
    const transactionItemsData = input.items.map(item => ({
      transaction_id: transaction.id,
      item_id: item.item_id,
      quantity: item.quantity
    }));

    await db.insert(transactionItemsTable)
      .values(transactionItemsData)
      .execute();

    return transaction;
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}

export async function getTransactions(userId?: number): Promise<Transaction[]> {
  try {
    // Build query step by step to maintain proper typing
    let baseQuery = db.select().from(transactionsTable);

    // If userId is provided, filter by user
    if (userId !== undefined) {
      const query = baseQuery.where(eq(transactionsTable.created_by, userId));
      const results = await query.execute();
      return results;
    }

    const results = await baseQuery.execute();
    return results;
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    throw error;
  }
}

export async function getTransactionById(id: number, userId: number): Promise<Transaction | null> {
  try {
    // First get the transaction
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .execute();
    
    if (transactions.length === 0) {
      return null;
    }

    const transaction = transactions[0];

    // Check if user has access to this transaction
    // Admin role check would be handled at the route level
    if (transaction.created_by !== userId) {
      return null;
    }

    return transaction;
  } catch (error) {
    console.error('Failed to fetch transaction:', error);
    throw error;
  }
}

export async function deleteTransaction(id: number, userId: number): Promise<boolean> {
  try {
    // First check if transaction exists and user has access
    const transaction = await getTransactionById(id, userId);
    if (!transaction) {
      return false;
    }

    // Delete transaction items first (foreign key constraint)
    await db.delete(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, id))
      .execute();

    // Delete transaction
    const result = await db.delete(transactionsTable)
      .where(and(
        eq(transactionsTable.id, id),
        eq(transactionsTable.created_by, userId)
      ))
      .execute();

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    throw error;
  }
}

export async function getTransactionItems(transactionId: number): Promise<TransactionItem[]> {
  try {
    const results = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch transaction items:', error);
    throw error;
  }
}
