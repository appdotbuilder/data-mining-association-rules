
import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password_hash: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Login input schema
export const loginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Item schema
export const itemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Item = z.infer<typeof itemSchema>;

// Create item input schema
export const createItemInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  category: z.string().nullable()
});

export type CreateItemInput = z.infer<typeof createItemInputSchema>;

// Update item input schema
export const updateItemInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional()
});

export type UpdateItemInput = z.infer<typeof updateItemInputSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  transaction_date: z.coerce.date(),
  created_by: z.number(),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Transaction item schema (many-to-many relationship)
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  item_id: z.number(),
  quantity: z.number().int().positive()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

// Create transaction input schema
export const createTransactionInputSchema = z.object({
  transaction_date: z.coerce.date(),
  items: z.array(z.object({
    item_id: z.number(),
    quantity: z.number().int().positive()
  })).min(1)
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Mining algorithm enum
export const miningAlgorithmSchema = z.enum(['apriori', 'fp_growth']);
export type MiningAlgorithm = z.infer<typeof miningAlgorithmSchema>;

// Mining parameters schema
export const miningParametersSchema = z.object({
  min_support: z.number().min(0).max(1),
  min_confidence: z.number().min(0).max(1),
  algorithm: miningAlgorithmSchema
});

export type MiningParameters = z.infer<typeof miningParametersSchema>;

// Frequent itemset schema
export const frequentItemsetSchema = z.object({
  itemset: z.array(z.string()),
  support: z.number(),
  count: z.number().int()
});

export type FrequentItemset = z.infer<typeof frequentItemsetSchema>;

// Association rule schema
export const associationRuleSchema = z.object({
  antecedent: z.array(z.string()),
  consequent: z.array(z.string()),
  support: z.number(),
  confidence: z.number(),
  lift: z.number()
});

export type AssociationRule = z.infer<typeof associationRuleSchema>;

// Mining result schema
export const miningResultSchema = z.object({
  id: z.number(),
  algorithm: miningAlgorithmSchema,
  parameters: z.object({
    min_support: z.number(),
    min_confidence: z.number()
  }),
  frequent_itemsets: z.array(frequentItemsetSchema),
  association_rules: z.array(associationRuleSchema),
  execution_time_ms: z.number(),
  created_by: z.number(),
  created_at: z.coerce.date()
});

export type MiningResult = z.infer<typeof miningResultSchema>;

// Mining comparison schema
export const miningComparisonSchema = z.object({
  apriori_result: miningResultSchema.nullable(),
  fp_growth_result: miningResultSchema.nullable(),
  comparison_metrics: z.object({
    execution_time_difference: z.number(),
    itemsets_count_difference: z.number(),
    rules_count_difference: z.number(),
    faster_algorithm: miningAlgorithmSchema.nullable()
  }).nullable()
});

export type MiningComparison = z.infer<typeof miningComparisonSchema>;

// Excel import schema
export const excelImportInputSchema = z.object({
  file_data: z.string(), // Base64 encoded file data
  has_header: z.boolean().default(true)
});

export type ExcelImportInput = z.infer<typeof excelImportInputSchema>;
