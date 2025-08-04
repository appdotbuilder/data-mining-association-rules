
import { serial, text, pgTable, timestamp, integer, jsonb, real, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const miningAlgorithmEnum = pgEnum('mining_algorithm', ['apriori', 'fp_growth']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Items table
export const itemsTable = pgTable('items', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  transaction_date: timestamp('transaction_date').notNull(),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Transaction items table (many-to-many relationship)
export const transactionItemsTable = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').notNull(),
  item_id: integer('item_id').notNull(),
  quantity: integer('quantity').notNull(),
});

// Mining results table
export const miningResultsTable = pgTable('mining_results', {
  id: serial('id').primaryKey(),
  algorithm: miningAlgorithmEnum('algorithm').notNull(),
  parameters: jsonb('parameters').notNull(), // Store min_support, min_confidence
  frequent_itemsets: jsonb('frequent_itemsets').notNull(), // Store array of frequent itemsets
  association_rules: jsonb('association_rules').notNull(), // Store array of association rules
  execution_time_ms: real('execution_time_ms').notNull(),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  transactions: many(transactionsTable),
  miningResults: many(miningResultsTable),
}));

export const transactionsRelations = relations(transactionsTable, ({ one, many }) => ({
  createdBy: one(usersTable, {
    fields: [transactionsTable.created_by],
    references: [usersTable.id],
  }),
  items: many(transactionItemsTable),
}));

export const transactionItemsRelations = relations(transactionItemsTable, ({ one }) => ({
  transaction: one(transactionsTable, {
    fields: [transactionItemsTable.transaction_id],
    references: [transactionsTable.id],
  }),
  item: one(itemsTable, {
    fields: [transactionItemsTable.item_id],
    references: [itemsTable.id],
  }),
}));

export const itemsRelations = relations(itemsTable, ({ many }) => ({
  transactionItems: many(transactionItemsTable),
}));

export const miningResultsRelations = relations(miningResultsTable, ({ one }) => ({
  createdBy: one(usersTable, {
    fields: [miningResultsTable.created_by],
    references: [usersTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Item = typeof itemsTable.$inferSelect;
export type NewItem = typeof itemsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type TransactionItem = typeof transactionItemsTable.$inferSelect;
export type NewTransactionItem = typeof transactionItemsTable.$inferInsert;
export type MiningResult = typeof miningResultsTable.$inferSelect;
export type NewMiningResult = typeof miningResultsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  items: itemsTable,
  transactions: transactionsTable,
  transactionItems: transactionItemsTable,
  miningResults: miningResultsTable,
};
