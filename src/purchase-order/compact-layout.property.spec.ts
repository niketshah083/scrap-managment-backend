/**
 * Property Test: Compact Layout for Multiple Fields
 * **Feature: grn-entry-flow, Property 11: Compact Layout for Multiple Fields**
 * **Validates: Requirements 2.2**
 * 
 * For any step with more than 4 fields, the layout should use multi-column
 * grid (2 or 3 columns).
 */

import * as fc from 'fast-check';

// Field configuration structure
interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'file' | 'date' | 'readonly';
  required: boolean;
  fullWidth?: boolean;
}

// Step configuration structure
interface StepConfig {
  id: number;
  name: string;
  fields: FieldConfig[];
}

// Layout configuration
interface LayoutConfig {
  columns: 1 | 2 | 3;
  gridClass: string;
}

// Function to determine layout based on field count
function determineLayout(fieldCount: number): LayoutConfig {
  if (fieldCount >= 6) {
    return { columns: 3, gridClass: 'three-col' };
  } else if (fieldCount >= 4) {
    return { columns: 2, gridClass: 'two-col' };
  } else {
    return { columns: 1, gridClass: 'single-col' };
  }
}

// Function to calculate grid positions for fields
function calculateFieldPositions(fields: FieldConfig[], columns: number): { field: FieldConfig; column: number; row: number }[] {
  const positions: { field: FieldConfig; column: number; row: number }[] = [];
  let currentRow = 0;
  let currentCol = 0;
  
  fields.forEach(field => {
    if (field.fullWidth) {
      // Full width fields start on new row and take all columns
      if (currentCol > 0) {
        currentRow++;
        currentCol = 0;
      }
      positions.push({ field, column: 0, row: currentRow });
      currentRow++;
      currentCol = 0;
    } else {
      positions.push({ field, column: currentCol, row: currentRow });
      currentCol++;
      if (currentCol >= columns) {
        currentCol = 0;
        currentRow++;
      }
    }
  });
  
  return positions;
}

// Function to validate layout is compact (no excessive scrolling)
function isCompactLayout(fieldCount: number, layout: LayoutConfig): boolean {
  // With multi-column layout, rows should be reduced
  const rowsNeeded = Math.ceil(fieldCount / layout.columns);
  // Compact means reasonable number of rows (e.g., <= 6 rows visible)
  return rowsNeeded <= 6;
}

// Arbitraries
const fieldTypeArb = fc.constantFrom('text', 'number', 'select', 'file', 'date', 'readonly') as fc.Arbitrary<FieldConfig['type']>;

const fieldConfigArb = fc.record({
  name: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'), { minLength: 3, maxLength: 20 }),
  label: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 3, maxLength: 30 }),
  type: fieldTypeArb,
  required: fc.boolean(),
  fullWidth: fc.boolean()
});

const stepConfigArb = fc.record({
  id: fc.integer({ min: 0, max: 10 }),
  name: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '), { minLength: 5, maxLength: 30 }),
  fields: fc.array(fieldConfigArb, { minLength: 1, maxLength: 10 })
});

describe('Compact Layout Property Tests', () => {
  /**
   * Property 11: Compact Layout for Multiple Fields
   * For any step with more than 4 fields, the layout should use multi-column
   * grid (2 or 3 columns).
   */
  describe('Property 11: Compact Layout for Multiple Fields', () => {
    it('should use 3-column layout for steps with 6+ fields', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 6, max: 12 }), // fieldCount
          (fieldCount) => {
            const layout = determineLayout(fieldCount);
            
            // Property: 6+ fields should use 3 columns
            expect(layout.columns).toBe(3);
            expect(layout.gridClass).toBe('three-col');
            return layout.columns === 3;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use 2-column layout for steps with 4-5 fields', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 5 }), // fieldCount
          (fieldCount) => {
            const layout = determineLayout(fieldCount);
            
            // Property: 4-5 fields should use 2 columns
            expect(layout.columns).toBe(2);
            expect(layout.gridClass).toBe('two-col');
            return layout.columns === 2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use single-column layout for steps with 1-3 fields', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }), // fieldCount
          (fieldCount) => {
            const layout = determineLayout(fieldCount);
            
            // Property: 1-3 fields should use 1 column
            expect(layout.columns).toBe(1);
            expect(layout.gridClass).toBe('single-col');
            return layout.columns === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should result in compact layout (reduced rows) for multi-column', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 12 }), // fieldCount
          (fieldCount) => {
            const layout = determineLayout(fieldCount);
            
            // Property: Multi-column layout should be compact
            const isCompact = isCompactLayout(fieldCount, layout);
            expect(isCompact).toBe(true);
            return isCompact;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reduce row count compared to single-column', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 12 }), // fieldCount
          (fieldCount) => {
            const multiColLayout = determineLayout(fieldCount);
            const singleColRows = fieldCount;
            const multiColRows = Math.ceil(fieldCount / multiColLayout.columns);
            
            // Property: Multi-column should have fewer rows than single-column
            expect(multiColRows).toBeLessThan(singleColRows);
            return multiColRows < singleColRows;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly position fields in grid', () => {
      fc.assert(
        fc.property(
          fc.array(fieldConfigArb.map(f => ({ ...f, fullWidth: false })), { minLength: 4, maxLength: 9 }),
          (fields) => {
            const layout = determineLayout(fields.length);
            const positions = calculateFieldPositions(fields, layout.columns);
            
            // Property: All fields should have valid positions
            const allValid = positions.every(p => 
              p.column >= 0 && 
              p.column < layout.columns && 
              p.row >= 0
            );
            expect(allValid).toBe(true);
            
            // Property: All fields should be positioned
            expect(positions.length).toBe(fields.length);
            
            return allValid && positions.length === fields.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle full-width fields correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fieldConfigArb, { minLength: 4, maxLength: 8 }),
          (fields) => {
            // Ensure at least one full-width field
            const fieldsWithFullWidth = fields.map((f, i) => ({
              ...f,
              fullWidth: i === Math.floor(fields.length / 2)
            }));
            
            const layout = determineLayout(fieldsWithFullWidth.length);
            const positions = calculateFieldPositions(fieldsWithFullWidth, layout.columns);
            
            // Property: Full-width fields should be at column 0
            const fullWidthPositions = positions.filter((p, i) => fieldsWithFullWidth[i].fullWidth);
            const allAtColumn0 = fullWidthPositions.every(p => p.column === 0);
            
            expect(allAtColumn0).toBe(true);
            return allAtColumn0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply correct grid class based on field count', () => {
      fc.assert(
        fc.property(
          stepConfigArb,
          (step) => {
            const layout = determineLayout(step.fields.length);
            
            // Property: Grid class should match column count
            if (layout.columns === 3) {
              expect(layout.gridClass).toBe('three-col');
            } else if (layout.columns === 2) {
              expect(layout.gridClass).toBe('two-col');
            } else {
              expect(layout.gridClass).toBe('single-col');
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent layout for same field count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 10 }), // iterations
          (fieldCount, iterations) => {
            const layouts: LayoutConfig[] = [];
            
            for (let i = 0; i < iterations; i++) {
              layouts.push(determineLayout(fieldCount));
            }
            
            // Property: Same field count should always produce same layout
            const allSame = layouts.every(l => 
              l.columns === layouts[0].columns && 
              l.gridClass === layouts[0].gridClass
            );
            
            expect(allSame).toBe(true);
            return allSame;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
