
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, itemsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type ExcelImportInput } from '../schema';
import { importTransactionsFromExcel, validateExcelFormat } from '../handlers/excel_import';
import { eq } from 'drizzle-orm';

describe('Excel Import', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        password_hash: 'hash',
        role: 'user'
      })
      .returning()
      .execute();
    testUserId = user[0].id;
  });

  const createTestCSVFile = (data: string[][], hasHeader: boolean = true): string => {
    const csvContent = data.map(row => 
      row.map(cell => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ).join('\n');
    
    return Buffer.from(csvContent, 'utf-8').toString('base64');
  };

  describe('validateExcelFormat', () => {
    it('should validate correct CSV format with header', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1', 'Item2', 'Qty2'],
        ['2024-01-01', 'Apple', '5', 'Banana', '3'],
        ['2024-01-02', 'Orange', '2', '', '']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.preview).toHaveLength(3);
      expect(result.preview[0]).toEqual(['Date', 'Item1', 'Qty1', 'Item2', 'Qty2']);
    });

    it('should validate correct CSV format without header', async () => {
      const testData = [
        ['2024-01-01', 'Apple', '5', 'Banana', '3'],
        ['2024-01-02', 'Orange', '2', '', '']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData, false),
        has_header: false
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.preview).toHaveLength(2);
    });

    it('should reject CSV with insufficient columns', async () => {
      const testData = [
        ['Date', 'Item1'],
        ['2024-01-01', 'Apple']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Row 2: Expected at least 3 columns (date, item, quantity)');
    });

    it('should reject CSV with invalid dates', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['invalid-date', 'Apple', '5']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Row 2: Invalid date format: invalid-date');
    });

    it('should validate different date formats', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['01/15/2024', 'Apple', '5'],
        ['2024-01-16', 'Banana', '3'],
        ['15/01/2024', 'Orange', '2']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty CSV file', async () => {
      const testData: string[][] = [];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await validateExcelFormat(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });
  });

  describe('importTransactionsFromExcel', () => {
    it('should import transactions successfully', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1', 'Item2', 'Qty2'],
        ['2024-01-01', 'Apple', '5', 'Banana', '3'],
        ['2024-01-02', 'Orange', '2', '', '']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify data was created
      const transactions = await db.select().from(transactionsTable).execute();
      expect(transactions).toHaveLength(2);

      const items = await db.select().from(itemsTable).execute();
      expect(items.map(i => i.name).sort()).toEqual(['Apple', 'Banana', 'Orange']);

      const transactionItems = await db.select().from(transactionItemsTable).execute();
      expect(transactionItems).toHaveLength(3); // Apple+Banana, Orange
    });

    it('should handle different date formats', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['01/15/2024', 'Apple', '5'],
        ['2024-01-16', 'Banana', '3']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(2);

      const transactions = await db.select().from(transactionsTable).execute();
      expect(transactions).toHaveLength(2);
      transactions.forEach(t => {
        expect(t.transaction_date).toBeInstanceOf(Date);
      });
    });

    it('should create new items when they do not exist', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['2024-01-01', 'NewItem', '5']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(1);

      const items = await db.select()
        .from(itemsTable)
        .where(eq(itemsTable.name, 'NewItem'))
        .execute();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('NewItem');
    });

    it('should reuse existing items', async () => {
      // Create existing item
      await db.insert(itemsTable)
        .values({
          name: 'ExistingItem',
          description: 'Test item',
          category: 'Test'
        })
        .execute();

      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['2024-01-01', 'ExistingItem', '5']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(1);

      // Should still have only one item with this name
      const items = await db.select()
        .from(itemsTable)
        .where(eq(itemsTable.name, 'ExistingItem'))
        .execute();
      expect(items).toHaveLength(1);
    });

    it('should skip empty rows', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['2024-01-01', 'Apple', '5'],
        ['', '', ''], // Empty row
        ['2024-01-02', 'Banana', '3']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle invalid quantities', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['2024-01-01', 'Apple', '5'],
        ['2024-01-02', 'Banana', 'invalid'],
        ['2024-01-03', 'Orange', '-1']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(1); // Only Apple should be imported
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      
      // Check that all errors are about invalid quantities
      result.errors.forEach(error => {
        expect(error).toContain('Invalid quantity');
      });
    });

    it('should handle invalid dates', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['invalid-date', 'Apple', '5'],
        ['2024-01-02', 'Banana', '3']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(1); // Only Banana should be imported
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid date format');
    });

    it('should return error for empty file', async () => {
      const testData: string[][] = [];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(false);
      expect(result.imported_count).toBe(0);
      expect(result.errors).toContain('File is empty');
    });

    it('should handle CSV with quoted fields containing commas', async () => {
      const testData = [
        ['Date', 'Item1', 'Qty1'],
        ['2024-01-01', 'Apple, Red', '5']
      ];

      const input: ExcelImportInput = {
        file_data: createTestCSVFile(testData),
        has_header: true
      };

      const result = await importTransactionsFromExcel(input, testUserId);

      expect(result.success).toBe(true);
      expect(result.imported_count).toBe(1);

      const items = await db.select()
        .from(itemsTable)
        .where(eq(itemsTable.name, 'Apple, Red'))
        .execute();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Apple, Red');
    });
  });
});
