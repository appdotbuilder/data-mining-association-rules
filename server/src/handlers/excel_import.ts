
import { db } from '../db';
import { itemsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type ExcelImportInput } from '../schema';
import { eq } from 'drizzle-orm';

// Simple CSV parser for basic Excel data
function parseCSVData(csvText: string, hasHeader: boolean): any[][] {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  return lines.map(line => {
    // Simple CSV parsing - handles basic cases
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  });
}

// Parse various date formats
function parseDate(dateValue: string): Date | null {
  if (!dateValue) return null;
  
  // Try different date formats
  const formats = [
    // ISO format
    () => new Date(dateValue),
    // MM/DD/YYYY
    () => {
      const match = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
        const [, month, day, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    },
    // DD/MM/YYYY
    () => {
      const match = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (match) {
        const [, day, month, year] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    },
    // YYYY-MM-DD
    () => {
      const match = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    }
  ];
  
  for (const formatParser of formats) {
    try {
      const date = formatParser();
      if (date && !isNaN(date.getTime())) {
        return date;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

export async function importTransactionsFromExcel(input: ExcelImportInput, userId: number): Promise<{ success: boolean; imported_count: number; errors: string[] }> {
  const errors: string[] = [];
  let imported_count = 0;

  try {
    // Decode base64 data and convert to text
    const buffer = Buffer.from(input.file_data, 'base64');
    const csvText = buffer.toString('utf-8');
    
    // Parse CSV data
    const data = parseCSVData(csvText, input.has_header);

    if (data.length === 0) {
      return { success: false, imported_count: 0, errors: ['File is empty'] };
    }

    // Skip header row if present
    const startRow = input.has_header ? 1 : 0;
    const rows = data.slice(startRow);

    if (rows.length === 0) {
      return { success: false, imported_count: 0, errors: ['No data rows found'] };
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + (input.has_header ? 2 : 1);

      try {
        // Skip empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
          continue;
        }

        if (row.length < 3) {
          errors.push(`Row ${rowNum}: Expected at least 3 columns (date, item, quantity)`);
          continue;
        }

        // Parse transaction date
        const dateValue = row[0]?.trim();
        const transaction_date = parseDate(dateValue);
        
        if (!transaction_date) {
          errors.push(`Row ${rowNum}: Invalid date format: ${dateValue}`);
          continue;
        }

        // Collect items for this transaction
        const transactionItems: { item_id: number; quantity: number }[] = [];
        const rowErrors: string[] = [];
        
        // Process item columns (starting from column 1)
        for (let colIndex = 1; colIndex < row.length; colIndex += 2) {
          const itemName = row[colIndex]?.trim();
          const quantityValue = row[colIndex + 1]?.trim();

          if (!itemName) continue; // Skip empty item names

          if (!quantityValue || isNaN(Number(quantityValue)) || Number(quantityValue) <= 0) {
            rowErrors.push(`Row ${rowNum}, Column ${colIndex + 2}: Invalid quantity for item "${itemName}"`);
            continue;
          }

          const quantity = Math.floor(Number(quantityValue));

          // Find or create item
          let item = await db.select()
            .from(itemsTable)
            .where(eq(itemsTable.name, itemName))
            .execute();

          let item_id: number;
          if (item.length === 0) {
            // Create new item
            const newItem = await db.insert(itemsTable)
              .values({
                name: itemName,
                description: null,
                category: null
              })
              .returning()
              .execute();
            item_id = newItem[0].id;
          } else {
            item_id = item[0].id;
          }

          transactionItems.push({ item_id, quantity });
        }

        // If we have row-specific errors, add them to the main errors array
        errors.push(...rowErrors);

        if (transactionItems.length === 0) {
          // Only add this error if we don't already have quantity-related errors for this row
          if (rowErrors.length === 0) {
            errors.push(`Row ${rowNum}: No valid items found`);
          }
          continue;
        }

        // Create transaction
        const newTransaction = await db.insert(transactionsTable)
          .values({
            transaction_date,
            created_by: userId
          })
          .returning()
          .execute();

        const transaction_id = newTransaction[0].id;

        // Create transaction items
        for (const item of transactionItems) {
          await db.insert(transactionItemsTable)
            .values({
              transaction_id,
              item_id: item.item_id,
              quantity: item.quantity
            })
            .execute();
        }

        imported_count++;
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: imported_count > 0,
      imported_count,
      errors
    };
  } catch (error) {
    return {
      success: false,
      imported_count: 0,
      errors: [`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

export async function validateExcelFormat(input: ExcelImportInput): Promise<{ valid: boolean; preview: any[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Decode base64 data and convert to text
    const buffer = Buffer.from(input.file_data, 'base64');
    const csvText = buffer.toString('utf-8');
    
    // Parse CSV data
    const data = parseCSVData(csvText, input.has_header);

    if (data.length === 0) {
      return { valid: false, preview: [], errors: ['File is empty'] };
    }

    // Get preview data (first 5 rows including header)
    const previewData = data.slice(0, 5);
    
    // Skip header row for validation if present
    const startRow = input.has_header ? 1 : 0;
    const dataRows = data.slice(startRow);

    if (dataRows.length === 0) {
      return { valid: false, preview: previewData, errors: ['No data rows found'] };
    }

    // Validate format
    let hasValidRows = false;
    
    for (let i = 0; i < Math.min(dataRows.length, 10); i++) {
      const row = dataRows[i];
      const rowNum = i + (input.has_header ? 2 : 1);

      // Skip empty rows
      if (!row || row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
        continue;
      }

      if (row.length < 3) {
        errors.push(`Row ${rowNum}: Expected at least 3 columns (date, item, quantity)`);
        continue;
      }

      // Check date format
      const dateValue = row[0]?.trim();
      if (!dateValue) {
        errors.push(`Row ${rowNum}: Date is required`);
        continue;
      }

      // Try to parse date
      const parsedDate = parseDate(dateValue);
      if (!parsedDate) {
        errors.push(`Row ${rowNum}: Invalid date format: ${dateValue}`);
        continue;
      }

      // Check item/quantity pairs
      let hasValidItems = false;
      for (let colIndex = 1; colIndex < row.length; colIndex += 2) {
        const itemName = row[colIndex]?.trim();
        const quantityValue = row[colIndex + 1]?.trim();

        if (itemName && quantityValue && !isNaN(Number(quantityValue)) && Number(quantityValue) > 0) {
          hasValidItems = true;
          break;
        }
      }

      if (!hasValidItems) {
        errors.push(`Row ${rowNum}: No valid item/quantity pairs found`);
        continue;
      }

      hasValidRows = true;
    }

    const valid = hasValidRows && errors.length === 0;

    return {
      valid,
      preview: previewData,
      errors
    };
  } catch (error) {
    return {
      valid: false,
      preview: [],
      errors: [`File processing error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}
