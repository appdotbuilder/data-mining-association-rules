
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, transactionsTable, transactionItemsTable, miningResultsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type MiningParameters } from '../schema';
import { 
  runAprioriMining, 
  runFPGrowthMining, 
  compareMiningResults, 
  getMiningResults, 
  getMiningResultById 
} from '../handlers/mining';

describe('mining handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testAdminId: number;
  let testItemIds: number[];
  let testTransactionId: number;

  const testParameters: MiningParameters = {
    min_support: 0.5,
    min_confidence: 0.7,
    algorithm: 'apriori'
  };

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        { username: 'testuser', password_hash: 'hash123', role: 'user' },
        { username: 'admin', password_hash: 'hash456', role: 'admin' }
      ])
      .returning()
      .execute();
    
    testUserId = users[0].id;
    testAdminId = users[1].id;

    // Create test items
    const items = await db.insert(itemsTable)
      .values([
        { name: 'Bread', description: 'Fresh bread', category: 'Bakery' },
        { name: 'Milk', description: 'Fresh milk', category: 'Dairy' },
        { name: 'Butter', description: 'Butter', category: 'Dairy' },
        { name: 'Eggs', description: 'Fresh eggs', category: 'Dairy' }
      ])
      .returning()
      .execute();
    
    testItemIds = items.map(item => item.id);

    // Create test transaction
    const transactions = await db.insert(transactionsTable)
      .values([
        { transaction_date: new Date(), created_by: testUserId }
      ])
      .returning()
      .execute();
    
    testTransactionId = transactions[0].id;

    // Create transaction items
    await db.insert(transactionItemsTable)
      .values([
        { transaction_id: testTransactionId, item_id: testItemIds[0], quantity: 1 }, // Bread
        { transaction_id: testTransactionId, item_id: testItemIds[1], quantity: 1 }, // Milk
        { transaction_id: testTransactionId, item_id: testItemIds[2], quantity: 1 }  // Butter
      ])
      .execute();
  });

  describe('runAprioriMining', () => {
    it('should execute Apriori algorithm and return results', async () => {
      const result = await runAprioriMining(testParameters, testUserId);

      expect(result.id).toBeGreaterThan(0);
      expect(result.algorithm).toBe('apriori');
      expect(result.parameters.min_support).toBe(0.5);
      expect(result.parameters.min_confidence).toBe(0.7);
      expect(result.frequent_itemsets).toBeInstanceOf(Array);
      expect(result.association_rules).toBeInstanceOf(Array);
      expect(result.execution_time_ms).toBeGreaterThan(0);
      expect(result.created_by).toBe(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save result to database', async () => {
      const result = await runAprioriMining(testParameters, testUserId);

      const savedResults = await db.select()
        .from(miningResultsTable)
        .where(eq(miningResultsTable.id, result.id))
        .execute();

      expect(savedResults).toHaveLength(1);
      const savedResult = savedResults[0];
      expect(savedResult.algorithm).toBe('apriori');
      expect(savedResult.created_by).toBe(testUserId);
      expect(savedResult.parameters).toEqual({
        min_support: 0.5,
        min_confidence: 0.7
      });
    });

    it('should find frequent itemsets with correct support', async () => {
      const result = await runAprioriMining(testParameters, testUserId);

      // With one transaction containing Bread, Milk, Butter, all single items should have support 1.0
      const singleItemsets = result.frequent_itemsets.filter(itemset => itemset.itemset.length === 1);
      expect(singleItemsets.length).toBeGreaterThan(0);
      
      for (const itemset of singleItemsets) {
        expect(itemset.support).toBe(1.0);
        expect(itemset.count).toBe(1);
      }
    });
  });

  describe('runFPGrowthMining', () => {
    it('should execute FP-Growth algorithm and return results', async () => {
      const result = await runFPGrowthMining(testParameters, testUserId);

      expect(result.id).toBeGreaterThan(0);
      expect(result.algorithm).toBe('fp_growth');
      expect(result.parameters.min_support).toBe(0.5);
      expect(result.parameters.min_confidence).toBe(0.7);
      expect(result.frequent_itemsets).toBeInstanceOf(Array);
      expect(result.association_rules).toBeInstanceOf(Array);
      expect(result.execution_time_ms).toBeGreaterThan(0);
      expect(result.created_by).toBe(testUserId);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save result to database', async () => {
      const result = await runFPGrowthMining(testParameters, testUserId);

      const savedResults = await db.select()
        .from(miningResultsTable)
        .where(eq(miningResultsTable.id, result.id))
        .execute();

      expect(savedResults).toHaveLength(1);
      const savedResult = savedResults[0];
      expect(savedResult.algorithm).toBe('fp_growth');
      expect(savedResult.created_by).toBe(testUserId);
    });
  });

  describe('compareMiningResults', () => {
    it('should run both algorithms and return comparison', async () => {
      const comparison = await compareMiningResults(testParameters, testUserId);

      expect(comparison.apriori_result).toBeDefined();
      expect(comparison.fp_growth_result).toBeDefined();
      expect(comparison.comparison_metrics).toBeDefined();

      expect(comparison.apriori_result!.algorithm).toBe('apriori');
      expect(comparison.fp_growth_result!.algorithm).toBe('fp_growth');

      const metrics = comparison.comparison_metrics!;
      expect(typeof metrics.execution_time_difference).toBe('number');
      expect(typeof metrics.itemsets_count_difference).toBe('number');
      expect(typeof metrics.rules_count_difference).toBe('number');
      expect(['apriori', 'fp_growth']).toContain(metrics.faster_algorithm);
    });

    it('should save both results to database', async () => {
      const comparison = await compareMiningResults(testParameters, testUserId);

      const allResults = await db.select()
        .from(miningResultsTable)
        .where(eq(miningResultsTable.created_by, testUserId))
        .execute();

      expect(allResults).toHaveLength(2);
      
      const algorithms = allResults.map(result => result.algorithm);
      expect(algorithms).toContain('apriori');
      expect(algorithms).toContain('fp_growth');
    });
  });

  describe('getMiningResults', () => {
    it('should return all results when no userId provided (admin view)', async () => {
      // Create results for different users
      await runAprioriMining(testParameters, testUserId);
      await runFPGrowthMining(testParameters, testAdminId);

      const results = await getMiningResults();

      expect(results).toHaveLength(2);
      const userIds = results.map(result => result.created_by);
      expect(userIds).toContain(testUserId);
      expect(userIds).toContain(testAdminId);
    });

    it('should return only user results when userId provided', async () => {
      // Create results for different users
      await runAprioriMining(testParameters, testUserId);
      await runFPGrowthMining(testParameters, testAdminId);

      const results = await getMiningResults(testUserId);

      expect(results).toHaveLength(1);
      expect(results[0].created_by).toBe(testUserId);
      expect(results[0].algorithm).toBe('apriori');
    });

    it('should return empty array when user has no results', async () => {
      const results = await getMiningResults(testUserId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getMiningResultById', () => {
    it('should return specific mining result by ID', async () => {
      const createdResult = await runAprioriMining(testParameters, testUserId);
      
      const foundResult = await getMiningResultById(createdResult.id, testUserId);

      expect(foundResult).toBeDefined();
      expect(foundResult!.id).toBe(createdResult.id);
      expect(foundResult!.algorithm).toBe('apriori');
      expect(foundResult!.created_by).toBe(testUserId);
    });

    it('should return null when result not found', async () => {
      const result = await getMiningResultById(9999, testUserId);
      expect(result).toBeNull();
    });

    it('should return null when result belongs to different user', async () => {
      const createdResult = await runAprioriMining(testParameters, testUserId);
      
      const result = await getMiningResultById(createdResult.id, testAdminId);
      expect(result).toBeNull();
    });
  });

  describe('association rules generation', () => {
    it('should generate valid association rules', async () => {
      // Create multiple transactions to get meaningful rules
      const transaction2 = await db.insert(transactionsTable)
        .values({ transaction_date: new Date(), created_by: testUserId })
        .returning()
        .execute();

      await db.insert(transactionItemsTable)
        .values([
          { transaction_id: transaction2[0].id, item_id: testItemIds[0], quantity: 1 }, // Bread
          { transaction_id: transaction2[0].id, item_id: testItemIds[1], quantity: 1 }  // Milk
        ])
        .execute();

      const result = await runAprioriMining({
        min_support: 0.3,
        min_confidence: 0.5,
        algorithm: 'apriori'
      }, testUserId);

      const rules = result.association_rules;
      if (rules.length > 0) {
        const rule = rules[0];
        expect(rule.antecedent).toBeInstanceOf(Array);
        expect(rule.consequent).toBeInstanceOf(Array);
        expect(rule.antecedent.length).toBeGreaterThan(0);
        expect(rule.consequent.length).toBeGreaterThan(0);
        expect(rule.support).toBeGreaterThan(0);
        expect(rule.confidence).toBeGreaterThan(0);
        expect(rule.lift).toBeGreaterThan(0);
      }
    });
  });
});
