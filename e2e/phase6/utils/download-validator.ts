import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as crypto from 'crypto';
import * as AdmZip from 'adm-zip';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    fileSize: number;
    recordCount: number;
    format: string;
    checksum: string;
    encoding: string;
  };
}

export interface CSVValidationOptions {
  expectedColumns?: string[];
  requiredColumns?: string[];
  maxFileSize?: number;
  encoding?: BufferEncoding;
  validateContent?: (record: any) => string | null;
}

export interface ContentIntegrityCheck {
  originalPrompts: string[];
  results: Array<{
    originalPrompt: string;
    enhancedPrompt: string;
    technique: string;
  }>;
}

export class DownloadValidator {
  /**
   * Validate CSV file
   */
  static validateCSV(
    filepath: string, 
    options: CSVValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check file exists
    if (!fs.existsSync(filepath)) {
      return {
        valid: false,
        errors: ['File does not exist'],
        warnings: [],
        metadata: {
          fileSize: 0,
          recordCount: 0,
          format: 'CSV',
          checksum: '',
          encoding: 'utf-8'
        }
      };
    }

    const stats = fs.statSync(filepath);
    const content = fs.readFileSync(filepath, options.encoding || 'utf-8');
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    // Check file size
    if (options.maxFileSize && stats.size > options.maxFileSize) {
      errors.push(`File size ${stats.size} exceeds maximum ${options.maxFileSize}`);
    }

    let records: any[] = [];
    
    try {
      // Parse CSV
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        relaxed_column_count: true
      });

      // Validate columns
      if (records.length > 0) {
        const actualColumns = Object.keys(records[0]);
        
        // Check expected columns
        if (options.expectedColumns) {
          const missingExpected = options.expectedColumns.filter(
            col => !actualColumns.includes(col)
          );
          if (missingExpected.length > 0) {
            warnings.push(`Missing expected columns: ${missingExpected.join(', ')}`);
          }
        }

        // Check required columns
        if (options.requiredColumns) {
          const missingRequired = options.requiredColumns.filter(
            col => !actualColumns.includes(col)
          );
          if (missingRequired.length > 0) {
            errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
          }
        }
      }

      // Validate content
      if (options.validateContent) {
        records.forEach((record, index) => {
          const error = options.validateContent!(record);
          if (error) {
            errors.push(`Row ${index + 1}: ${error}`);
          }
        });
      }

      // Check for empty file
      if (records.length === 0) {
        warnings.push('CSV file contains no data rows');
      }

    } catch (error) {
      errors.push(`CSV parsing error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        fileSize: stats.size,
        recordCount: records.length,
        format: 'CSV',
        checksum,
        encoding: options.encoding || 'utf-8'
      }
    };
  }

  /**
   * Validate JSON file
   */
  static validateJSON(
    filepath: string,
    schema?: any
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!fs.existsSync(filepath)) {
      return {
        valid: false,
        errors: ['File does not exist'],
        warnings: [],
        metadata: {
          fileSize: 0,
          recordCount: 0,
          format: 'JSON',
          checksum: '',
          encoding: 'utf-8'
        }
      };
    }

    const stats = fs.statSync(filepath);
    const content = fs.readFileSync(filepath, 'utf-8');
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    let data: any;
    let recordCount = 0;

    try {
      data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        recordCount = data.length;
      } else if (data.results && Array.isArray(data.results)) {
        recordCount = data.results.length;
      }

      // Validate against schema if provided
      if (schema) {
        // Simple schema validation (in real app, use ajv or similar)
        const validateSchema = (obj: any, schema: any, path: string = '') => {
          for (const key in schema) {
            if (schema[key].required && !(key in obj)) {
              errors.push(`Missing required field at ${path}${key}`);
            }
            if (key in obj && schema[key].type) {
              const actualType = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
              if (actualType !== schema[key].type) {
                errors.push(`Type mismatch at ${path}${key}: expected ${schema[key].type}, got ${actualType}`);
              }
            }
          }
        };

        if (Array.isArray(data)) {
          data.forEach((item, index) => {
            validateSchema(item, schema, `[${index}].`);
          });
        } else {
          validateSchema(data, schema);
        }
      }

    } catch (error) {
      errors.push(`JSON parsing error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        fileSize: stats.size,
        recordCount,
        format: 'JSON',
        checksum,
        encoding: 'utf-8'
      }
    };
  }

  /**
   * Validate ZIP file
   */
  static validateZIP(
    filepath: string,
    expectedFiles?: string[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!fs.existsSync(filepath)) {
      return {
        valid: false,
        errors: ['File does not exist'],
        warnings: [],
        metadata: {
          fileSize: 0,
          recordCount: 0,
          format: 'ZIP',
          checksum: '',
          encoding: 'binary'
        }
      };
    }

    const stats = fs.statSync(filepath);
    const content = fs.readFileSync(filepath);
    const checksum = crypto.createHash('md5').update(content).digest('hex');

    let recordCount = 0;

    try {
      const zip = new AdmZip(filepath);
      const entries = zip.getEntries();
      const entryNames = entries.map(e => e.entryName);

      // Check for expected files
      if (expectedFiles) {
        const missingFiles = expectedFiles.filter(f => !entryNames.includes(f));
        if (missingFiles.length > 0) {
          errors.push(`Missing expected files: ${missingFiles.join(', ')}`);
        }
      }

      // Validate individual files
      entries.forEach(entry => {
        if (entry.entryName === 'results.csv') {
          const csvContent = entry.getData().toString('utf-8');
          try {
            const records = parse(csvContent, { columns: true });
            recordCount = records.length;
          } catch (error) {
            errors.push(`Error parsing results.csv: ${error}`);
          }
        } else if (entry.entryName === 'results.json') {
          const jsonContent = entry.getData().toString('utf-8');
          try {
            const data = JSON.parse(jsonContent);
            if (Array.isArray(data)) {
              recordCount = data.length;
            }
          } catch (error) {
            errors.push(`Error parsing results.json: ${error}`);
          }
        }
      });

      // Check for empty archive
      if (entries.length === 0) {
        errors.push('ZIP file is empty');
      }

    } catch (error) {
      errors.push(`ZIP processing error: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        fileSize: stats.size,
        recordCount,
        format: 'ZIP',
        checksum,
        encoding: 'binary'
      }
    };
  }

  /**
   * Verify content integrity between original and results
   */
  static verifyContentIntegrity(
    originalFile: string,
    resultsFile: string
  ): ContentIntegrityCheck & { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let originalPrompts: string[] = [];
    let results: any[] = [];

    try {
      // Read original prompts
      if (originalFile.endsWith('.csv')) {
        const content = fs.readFileSync(originalFile, 'utf-8');
        const records = parse(content, { columns: true });
        originalPrompts = records.map((r: any) => r.prompt || r.text || '');
      } else if (originalFile.endsWith('.txt')) {
        const content = fs.readFileSync(originalFile, 'utf-8');
        originalPrompts = content.split('\n').filter(line => line.trim());
      }

      // Read results
      const resultsContent = fs.readFileSync(resultsFile, 'utf-8');
      
      if (resultsFile.endsWith('.csv')) {
        results = parse(resultsContent, { columns: true });
      } else if (resultsFile.endsWith('.json')) {
        const data = JSON.parse(resultsContent);
        results = Array.isArray(data) ? data : data.results || [];
      }

      // Verify all original prompts are in results
      const resultPrompts = results.map(r => 
        r.originalPrompt || r.original_prompt || r.prompt || ''
      );

      const missingPrompts = originalPrompts.filter(
        prompt => !resultPrompts.includes(prompt)
      );

      if (missingPrompts.length > 0) {
        errors.push(`Missing ${missingPrompts.length} prompts in results`);
      }

      // Check order preservation
      const orderPreserved = originalPrompts.every((prompt, index) => 
        index < resultPrompts.length && resultPrompts[index] === prompt
      );

      if (!orderPreserved) {
        warnings.push('Prompt order not preserved in results');
      }

      // Verify each result has required fields
      results.forEach((result, index) => {
        const enhancedPrompt = result.enhancedPrompt || result.enhanced_prompt || result.result;
        const technique = result.technique || result.method;
        
        if (!enhancedPrompt) {
          errors.push(`Result ${index + 1} missing enhanced prompt`);
        }
        if (!technique) {
          errors.push(`Result ${index + 1} missing technique`);
        }
      });

    } catch (error) {
      errors.push(`Content integrity check failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      originalPrompts,
      results: results.map(r => ({
        originalPrompt: r.originalPrompt || r.original_prompt || r.prompt || '',
        enhancedPrompt: r.enhancedPrompt || r.enhanced_prompt || r.result || '',
        technique: r.technique || r.method || ''
      }))
    };
  }

  /**
   * Calculate file checksum
   */
  static calculateChecksum(filepath: string, algorithm: string = 'sha256'): string {
    const content = fs.readFileSync(filepath);
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Verify file encoding
   */
  static verifyEncoding(filepath: string, expectedEncoding: BufferEncoding = 'utf-8'): boolean {
    try {
      fs.readFileSync(filepath, expectedEncoding);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract and validate performance metrics from results
   */
  static validatePerformanceMetrics(
    resultsFile: string,
    requirements: {
      maxProcessingTime?: number;
      minThroughput?: number;
      maxErrorRate?: number;
    }
  ): { valid: boolean; metrics: any; errors: string[] } {
    const errors: string[] = [];
    let metrics: any = {
      totalTime: 0,
      averageTime: 0,
      throughput: 0,
      errorRate: 0,
      successCount: 0,
      errorCount: 0
    };

    try {
      const content = fs.readFileSync(resultsFile, 'utf-8');
      let results: any[] = [];

      if (resultsFile.endsWith('.csv')) {
        results = parse(content, { columns: true });
      } else if (resultsFile.endsWith('.json')) {
        const data = JSON.parse(content);
        results = Array.isArray(data) ? data : data.results || [];
      }

      // Calculate metrics
      const processingTimes = results
        .map(r => r.processingTime || r.processing_time)
        .filter(t => t !== undefined)
        .map(t => parseFloat(t));

      metrics.successCount = results.filter(r => !r.error).length;
      metrics.errorCount = results.filter(r => r.error).length;
      metrics.errorRate = results.length > 0 ? metrics.errorCount / results.length : 0;

      if (processingTimes.length > 0) {
        metrics.totalTime = processingTimes.reduce((a, b) => a + b, 0);
        metrics.averageTime = metrics.totalTime / processingTimes.length;
        metrics.throughput = processingTimes.length / (metrics.totalTime / 1000 / 60); // per minute
      }

      // Validate against requirements
      if (requirements.maxProcessingTime && metrics.averageTime > requirements.maxProcessingTime) {
        errors.push(`Average processing time ${metrics.averageTime}ms exceeds max ${requirements.maxProcessingTime}ms`);
      }

      if (requirements.minThroughput && metrics.throughput < requirements.minThroughput) {
        errors.push(`Throughput ${metrics.throughput}/min below minimum ${requirements.minThroughput}/min`);
      }

      if (requirements.maxErrorRate && metrics.errorRate > requirements.maxErrorRate) {
        errors.push(`Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds max ${(requirements.maxErrorRate * 100).toFixed(2)}%`);
      }

    } catch (error) {
      errors.push(`Performance metrics validation failed: ${error}`);
    }

    return {
      valid: errors.length === 0,
      metrics,
      errors
    };
  }
}