import type { DietaryTag } from '@restaurant-qr/core';

export interface CsvMenuItemRow {
  name: string;
  price: number;
  description: string;
  preparationTime: number;
  categoryId: string;
  dietaryTags: DietaryTag[];
}

export interface CsvValidationResult {
  isValid: boolean;
  errors: string[];
  validRows: CsvMenuItemRow[];
}

const VALID_DIETARY_TAGS: DietaryTag[] = ['veg', 'non-veg', 'vegan', 'jain', 'gluten-free'];

/**
 * RFC 4180 compliant CSV line parser that properly handles quoted cells with commas
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let curCell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        curCell += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(curCell.trim().replace(/^"|"$/g, ''));
      curCell = '';
    } else {
      curCell += char;
    }
  }
  result.push(curCell.trim().replace(/^"|"$/g, ''));
  return result;
}

export class CsvValidator {
  /**
   * Validates raw CSV text content and returns parsed rows or validation errors
   */
  static validateMenuCsv(csvText: string): CsvValidationResult {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const errors: string[] = [];
    const validRows: CsvMenuItemRow[] = [];
    const seenNames = new Set<string>();

    if (lines.length < 2) {
      return {
        isValid: false,
        errors: ['CSV file must contain a header row and at least one data row.'],
        validRows: []
      };
    }

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const nameIdx = header.indexOf('name');
    const priceIdx = header.indexOf('price');
    const descIdx = header.indexOf('description');
    const prepIdx = header.indexOf('preparationtime');
    const catIdx = header.indexOf('categoryid');
    const tagsIdx = header.indexOf('dietarytags');

    if (nameIdx === -1 || priceIdx === -1) {
      return {
        isValid: false,
        errors: ['CSV header must contain at least "name" and "price" columns.'],
        validRows: []
      };
    }

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const row = parseCsvLine(lines[i]);
      
      const name = row[nameIdx] || '';
      const priceRaw = row[priceIdx] || '';
      const description = descIdx !== -1 && descIdx < row.length ? row[descIdx] || '' : '';
      const prepTimeRaw = prepIdx !== -1 && prepIdx < row.length ? row[prepIdx] || '10' : '10';
      const categoryId = catIdx !== -1 && catIdx < row.length ? row[catIdx] || 'default' : 'default';
      const tagsRaw = tagsIdx !== -1 && tagsIdx < row.length ? row[tagsIdx] || '' : '';

      // 1. Check missing name
      if (!name) {
        errors.push(`Row ${lineNum}: Missing item name.`);
        continue;
      }

      // 2. Check duplicate name
      if (seenNames.has(name.toLowerCase())) {
        errors.push(`Row ${lineNum}: Duplicate dish name "${name}".`);
        continue;
      }

      // 3. Check price
      const price = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price <= 0) {
        errors.push(`Row ${lineNum}: Invalid or non-positive price "${priceRaw}" for dish "${name}".`);
        continue;
      }

      // 4. Check prep time (with intelligent number extraction fallback)
      let preparationTime = parseInt(prepTimeRaw, 10);
      if (isNaN(preparationTime) || preparationTime < 1) {
        const extracted = parseInt(prepTimeRaw.replace(/[^0-9]/g, ''), 10);
        preparationTime = !isNaN(extracted) && extracted > 0 ? extracted : 10;
      }

      // 5. Check dietary tags
      const dietaryTags: DietaryTag[] = [];
      if (tagsRaw) {
        const rawTagsList = tagsRaw.split(/;|\|/).map((t) => t.trim().toLowerCase());
        for (const t of rawTagsList) {
          if (VALID_DIETARY_TAGS.includes(t as DietaryTag)) {
            dietaryTags.push(t as DietaryTag);
          }
        }
      }

      seenNames.add(name.toLowerCase());
      validRows.push({
        name,
        price,
        description,
        preparationTime,
        categoryId,
        dietaryTags
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      validRows
    };
  }
}
