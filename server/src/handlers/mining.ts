
import { db } from '../db';
import { transactionsTable, transactionItemsTable, itemsTable, miningResultsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { type MiningParameters, type MiningResult, type MiningComparison, type FrequentItemset, type AssociationRule } from '../schema';

// Helper function to fetch all transactions with items
async function getTransactionData(): Promise<Array<{ transactionId: number; items: string[] }>> {
  const results = await db.select()
    .from(transactionsTable)
    .innerJoin(transactionItemsTable, eq(transactionsTable.id, transactionItemsTable.transaction_id))
    .innerJoin(itemsTable, eq(transactionItemsTable.item_id, itemsTable.id))
    .execute();

  // Group items by transaction
  const transactionMap = new Map<number, string[]>();
  
  for (const result of results) {
    const transactionId = result.transactions.id;
    const itemName = result.items.name;
    
    if (!transactionMap.has(transactionId)) {
      transactionMap.set(transactionId, []);
    }
    
    // Add item multiple times based on quantity
    const quantity = result.transaction_items.quantity;
    for (let i = 0; i < quantity; i++) {
      transactionMap.get(transactionId)!.push(itemName);
    }
  }

  return Array.from(transactionMap.entries()).map(([transactionId, items]) => ({
    transactionId,
    items: [...new Set(items)] // Remove duplicates for mining (treat as presence/absence)
  }));
}

// Apriori algorithm implementation
function aprioriAlgorithm(transactions: string[][], minSupport: number): FrequentItemset[] {
  const totalTransactions = transactions.length;
  const minSupportCount = Math.ceil(minSupport * totalTransactions);
  
  // Generate 1-itemsets
  const itemCounts = new Map<string, number>();
  for (const transaction of transactions) {
    for (const item of transaction) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }
  
  // Filter frequent 1-itemsets
  let frequentItemsets: FrequentItemset[] = [];
  for (const [item, count] of itemCounts) {
    if (count >= minSupportCount) {
      frequentItemsets.push({
        itemset: [item],
        support: count / totalTransactions,
        count
      });
    }
  }
  
  // Generate k-itemsets (k > 1)
  let k = 2;
  let candidateItemsets = generateCandidates(frequentItemsets.map(f => f.itemset), k);
  
  while (candidateItemsets.length > 0 && k <= 3) { // Limit to 3-itemsets for performance
    const candidateCounts = new Map<string, number>();
    
    for (const transaction of transactions) {
      for (const candidate of candidateItemsets) {
        if (candidate.every(item => transaction.includes(item))) {
          const key = candidate.sort().join(',');
          candidateCounts.set(key, (candidateCounts.get(key) || 0) + 1);
        }
      }
    }
    
    const kFrequentItemsets: FrequentItemset[] = [];
    for (const [key, count] of candidateCounts) {
      if (count >= minSupportCount) {
        kFrequentItemsets.push({
          itemset: key.split(','),
          support: count / totalTransactions,
          count
        });
      }
    }
    
    frequentItemsets.push(...kFrequentItemsets);
    k++;
    candidateItemsets = generateCandidates(kFrequentItemsets.map(f => f.itemset), k);
  }
  
  return frequentItemsets;
}

// Generate candidate itemsets for Apriori
function generateCandidates(frequentItemsets: string[][], k: number): string[][] {
  const candidates: string[][] = [];
  
  for (let i = 0; i < frequentItemsets.length; i++) {
    for (let j = i + 1; j < frequentItemsets.length; j++) {
      const itemset1 = frequentItemsets[i].sort();
      const itemset2 = frequentItemsets[j].sort();
      
      // Check if first k-2 items are the same
      let canCombine = true;
      for (let l = 0; l < k - 2; l++) {
        if (itemset1[l] !== itemset2[l]) {
          canCombine = false;
          break;
        }
      }
      
      if (canCombine) {
        const newCandidate = [...itemset1, itemset2[itemset2.length - 1]].sort();
        candidates.push(newCandidate);
      }
    }
  }
  
  return candidates;
}

// FP-Growth algorithm implementation (simplified)
function fpGrowthAlgorithm(transactions: string[][], minSupport: number): FrequentItemset[] {
  const totalTransactions = transactions.length;
  const minSupportCount = Math.ceil(minSupport * totalTransactions);
  
  // For simplicity, use the same logic as Apriori but with different ordering
  // In a real implementation, this would build an FP-tree
  const itemCounts = new Map<string, number>();
  for (const transaction of transactions) {
    for (const item of transaction) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
  }
  
  // Sort items by frequency (FP-Growth characteristic)
  const sortedItems = Array.from(itemCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count >= minSupportCount);
  
  const frequentItemsets: FrequentItemset[] = [];
  
  // Add frequent 1-itemsets
  for (const [item, count] of sortedItems) {
    frequentItemsets.push({
      itemset: [item],
      support: count / totalTransactions,
      count
    });
  }
  
  // Generate 2-itemsets (simplified approach)
  const frequentItems = sortedItems.map(([item]) => item);
  for (let i = 0; i < frequentItems.length; i++) {
    for (let j = i + 1; j < frequentItems.length; j++) {
      const itemset = [frequentItems[i], frequentItems[j]];
      let count = 0;
      
      for (const transaction of transactions) {
        if (itemset.every(item => transaction.includes(item))) {
          count++;
        }
      }
      
      if (count >= minSupportCount) {
        frequentItemsets.push({
          itemset: itemset.sort(),
          support: count / totalTransactions,
          count
        });
      }
    }
  }
  
  return frequentItemsets;
}

// Generate association rules from frequent itemsets
function generateAssociationRules(frequentItemsets: FrequentItemset[], minConfidence: number, transactions: string[][]): AssociationRule[] {
  const rules: AssociationRule[] = [];
  const totalTransactions = transactions.length;
  
  // Only generate rules from itemsets with 2+ items
  const multiItemsets = frequentItemsets.filter(itemset => itemset.itemset.length >= 2);
  
  for (const itemset of multiItemsets) {
    // Generate all possible antecedent/consequent combinations
    for (let i = 1; i < Math.pow(2, itemset.itemset.length) - 1; i++) {
      const antecedent: string[] = [];
      const consequent: string[] = [];
      
      for (let j = 0; j < itemset.itemset.length; j++) {
        if ((i >> j) & 1) {
          antecedent.push(itemset.itemset[j]);
        } else {
          consequent.push(itemset.itemset[j]);
        }
      }
      
      if (antecedent.length === 0 || consequent.length === 0) continue;
      
      // Calculate support for antecedent
      let antecedentCount = 0;
      for (const transaction of transactions) {
        if (antecedent.every(item => transaction.includes(item))) {
          antecedentCount++;
        }
      }
      
      const antecedentSupport = antecedentCount / totalTransactions;
      const confidence = itemset.support / antecedentSupport;
      
      if (confidence >= minConfidence) {
        const lift = confidence / (itemset.count / totalTransactions);
        
        rules.push({
          antecedent: antecedent.sort(),
          consequent: consequent.sort(),
          support: itemset.support,
          confidence,
          lift
        });
      }
    }
  }
  
  return rules;
}

export async function runAprioriMining(parameters: MiningParameters, userId: number): Promise<MiningResult> {
  const startTime = Date.now();
  
  try {
    // Fetch transaction data
    const transactionData = await getTransactionData();
    const transactions = transactionData.map(t => t.items);
    
    // Run Apriori algorithm
    const frequentItemsets = aprioriAlgorithm(transactions, parameters.min_support);
    const associationRules = generateAssociationRules(frequentItemsets, parameters.min_confidence, transactions);
    
    const executionTime = Date.now() - startTime;
    
    // Save result to database
    const result = await db.insert(miningResultsTable)
      .values({
        algorithm: 'apriori',
        parameters: {
          min_support: parameters.min_support,
          min_confidence: parameters.min_confidence
        },
        frequent_itemsets: frequentItemsets,
        association_rules: associationRules,
        execution_time_ms: executionTime,
        created_by: userId
      })
      .returning()
      .execute();
    
    const savedResult = result[0];
    
    return {
      id: savedResult.id,
      algorithm: 'apriori',
      parameters: {
        min_support: parameters.min_support,
        min_confidence: parameters.min_confidence
      },
      frequent_itemsets: frequentItemsets,
      association_rules: associationRules,
      execution_time_ms: executionTime,
      created_by: userId,
      created_at: savedResult.created_at
    };
  } catch (error) {
    console.error('Apriori mining failed:', error);
    throw error;
  }
}

export async function runFPGrowthMining(parameters: MiningParameters, userId: number): Promise<MiningResult> {
  const startTime = Date.now();
  
  try {
    // Fetch transaction data
    const transactionData = await getTransactionData();
    const transactions = transactionData.map(t => t.items);
    
    // Run FP-Growth algorithm
    const frequentItemsets = fpGrowthAlgorithm(transactions, parameters.min_support);
    const associationRules = generateAssociationRules(frequentItemsets, parameters.min_confidence, transactions);
    
    const executionTime = Date.now() - startTime;
    
    // Save result to database
    const result = await db.insert(miningResultsTable)
      .values({
        algorithm: 'fp_growth',
        parameters: {
          min_support: parameters.min_support,
          min_confidence: parameters.min_confidence
        },
        frequent_itemsets: frequentItemsets,
        association_rules: associationRules,
        execution_time_ms: executionTime,
        created_by: userId
      })
      .returning()
      .execute();
    
    const savedResult = result[0];
    
    return {
      id: savedResult.id,
      algorithm: 'fp_growth',
      parameters: {
        min_support: parameters.min_support,
        min_confidence: parameters.min_confidence
      },
      frequent_itemsets: frequentItemsets,
      association_rules: associationRules,
      execution_time_ms: executionTime,
      created_by: userId,
      created_at: savedResult.created_at
    };
  } catch (error) {
    console.error('FP-Growth mining failed:', error);
    throw error;
  }
}

export async function compareMiningResults(parameters: MiningParameters, userId: number): Promise<MiningComparison> {
  try {
    const aprioriResult = await runAprioriMining(parameters, userId);
    const fpGrowthResult = await runFPGrowthMining(parameters, userId);
    
    const executionTimeDiff = fpGrowthResult.execution_time_ms - aprioriResult.execution_time_ms;
    const itemsetsCountDiff = fpGrowthResult.frequent_itemsets.length - aprioriResult.frequent_itemsets.length;
    const rulesCountDiff = fpGrowthResult.association_rules.length - aprioriResult.association_rules.length;
    const fasterAlgorithm = aprioriResult.execution_time_ms < fpGrowthResult.execution_time_ms ? 'apriori' : 'fp_growth';
    
    return {
      apriori_result: aprioriResult,
      fp_growth_result: fpGrowthResult,
      comparison_metrics: {
        execution_time_difference: executionTimeDiff,
        itemsets_count_difference: itemsetsCountDiff,
        rules_count_difference: rulesCountDiff,
        faster_algorithm: fasterAlgorithm
      }
    };
  } catch (error) {
    console.error('Mining comparison failed:', error);
    throw error;
  }
}

export async function getMiningResults(userId?: number): Promise<MiningResult[]> {
  try {
    const results = userId !== undefined 
      ? await db.select()
          .from(miningResultsTable)
          .where(eq(miningResultsTable.created_by, userId))
          .execute()
      : await db.select()
          .from(miningResultsTable)
          .execute();
    
    return results.map(result => ({
      id: result.id,
      algorithm: result.algorithm,
      parameters: result.parameters as { min_support: number; min_confidence: number },
      frequent_itemsets: result.frequent_itemsets as FrequentItemset[],
      association_rules: result.association_rules as AssociationRule[],
      execution_time_ms: result.execution_time_ms,
      created_by: result.created_by,
      created_at: result.created_at
    }));
  } catch (error) {
    console.error('Failed to get mining results:', error);
    throw error;
  }
}

export async function getMiningResultById(id: number, userId: number): Promise<MiningResult | null> {
  try {
    const results = await db.select()
      .from(miningResultsTable)
      .where(and(
        eq(miningResultsTable.id, id),
        eq(miningResultsTable.created_by, userId)
      ))
      .execute();
    
    if (results.length === 0) {
      return null;
    }
    
    const result = results[0];
    
    return {
      id: result.id,
      algorithm: result.algorithm,
      parameters: result.parameters as { min_support: number; min_confidence: number },
      frequent_itemsets: result.frequent_itemsets as FrequentItemset[],
      association_rules: result.association_rules as AssociationRule[],
      execution_time_ms: result.execution_time_ms,
      created_by: result.created_by,
      created_at: result.created_at
    };
  } catch (error) {
    console.error('Failed to get mining result by ID:', error);
    throw error;
  }
}
