
import { db } from '../db';
import { itemsTable, usersTable, transactionItemsTable } from '../db/schema';
import { type CreateItemInput, type UpdateItemInput, type Item } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createItem(input: CreateItemInput, userId: number): Promise<Item> {
  try {
    // Check if user is admin
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user.length || user[0].role !== 'admin') {
      throw new Error('Only admin users can create items');
    }

    // Insert item record
    const result = await db.insert(itemsTable)
      .values({
        name: input.name,
        description: input.description,
        category: input.category
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Item creation failed:', error);
    throw error;
  }
}

export async function getItems(): Promise<Item[]> {
  try {
    const result = await db.select()
      .from(itemsTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch items:', error);
    throw error;
  }
}

export async function getItemById(id: number): Promise<Item | null> {
  try {
    const result = await db.select()
      .from(itemsTable)
      .where(eq(itemsTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch item by ID:', error);
    throw error;
  }
}

export async function updateItem(input: UpdateItemInput, userId: number): Promise<Item | null> {
  try {
    // Check if user is admin
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user.length || user[0].role !== 'admin') {
      throw new Error('Only admin users can update items');
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof itemsTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.category !== undefined) {
      updateData.category = input.category;
    }

    // Only proceed if there are fields to update
    if (Object.keys(updateData).length === 0) {
      // If no fields to update, just return the existing item
      return await getItemById(input.id);
    }

    // Update item record
    const result = await db.update(itemsTable)
      .set({
        ...updateData,
        updated_at: new Date()
      })
      .where(eq(itemsTable.id, input.id))
      .returning()
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Item update failed:', error);
    throw error;
  }
}

export async function deleteItem(id: number, userId: number): Promise<boolean> {
  try {
    // Check if user is admin
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user.length || user[0].role !== 'admin') {
      throw new Error('Only admin users can delete items');
    }

    // Check if item is used in any transactions
    const transactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.item_id, id))
      .execute();

    if (transactionItems.length > 0) {
      throw new Error('Cannot delete item that is used in transactions');
    }

    // Delete item record
    const result = await db.delete(itemsTable)
      .where(eq(itemsTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Item deletion failed:', error);
    throw error;
  }
}
