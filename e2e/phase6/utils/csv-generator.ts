import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export interface PromptData {
  prompt: string;
  category?: string;
  priority?: string;
  metadata?: Record<string, any>;
}

export interface GeneratorOptions {
  count: number;
  includeMetadata?: boolean;
  categories?: string[];
  priorities?: string[];
  promptLength?: 'short' | 'medium' | 'long' | 'mixed';
  includeSpecialChars?: boolean;
  includeUnicode?: boolean;
}

export class CSVGenerator {
  private static readonly DEFAULT_CATEGORIES = [
    'education', 'business', 'programming', 'health', 'career',
    'creative', 'technology', 'communication', 'data', 'design'
  ];

  private static readonly DEFAULT_PRIORITIES = ['low', 'medium', 'high', 'critical'];

  private static readonly PROMPT_TEMPLATES = {
    short: [
      'Explain {topic}',
      'How to {action}',
      'What is {concept}',
      'Tips for {activity}',
      'Best {thing} for {purpose}'
    ],
    medium: [
      'Write a detailed explanation about {topic} including examples',
      'Create a step-by-step guide for {action} with best practices',
      'Compare and contrast {concept1} with {concept2}',
      'Develop a strategy for {goal} considering {constraints}',
      'Analyze the impact of {factor} on {outcome}'
    ],
    long: [
      'Provide a comprehensive analysis of {topic} including historical context, current state, future implications, and practical applications in real-world scenarios',
      'Design and implement a complete solution for {problem} that addresses scalability, security, performance, and maintainability concerns',
      'Write an in-depth tutorial on {subject} covering beginner to advanced concepts with code examples, best practices, common pitfalls, and optimization techniques'
    ]
  };

  private static readonly TOPICS = [
    'machine learning', 'web development', 'data science', 'cloud computing',
    'cybersecurity', 'mobile apps', 'blockchain', 'DevOps', 'AI ethics',
    'microservices', 'quantum computing', 'IoT', 'edge computing'
  ];

  private static readonly SPECIAL_CHARS = ['&', '<', '>', '"', "'", ';', '\\', '/', '|', '\n', '\t'];
  
  private static readonly UNICODE_SAMPLES = [
    '你好', '世界', 'مرحبا', 'שלום', 'Здравствуйте', 'हैलो',
    '🌍', '🚀', '💻', '📊', '🔒', '⚡', 'café', 'résumé', 'naïve'
  ];

  /**
   * Generate CSV content with specified number of prompts
   */
  static generateCSV(options: GeneratorOptions): string {
    const prompts = this.generatePrompts(options);
    const headers = ['prompt', 'category', 'priority'];
    
    if (options.includeMetadata) {
      headers.push('metadata');
    }

    const rows = prompts.map(prompt => {
      const row: any = {
        prompt: prompt.prompt,
        category: prompt.category,
        priority: prompt.priority
      };

      if (options.includeMetadata && prompt.metadata) {
        row.metadata = JSON.stringify(prompt.metadata);
      }

      return row;
    });

    return stringify(rows, { header: true, columns: headers });
  }

  /**
   * Generate and save CSV file
   */
  static async generateFile(
    filename: string,
    options: GeneratorOptions
  ): Promise<string> {
    const csvContent = this.generateCSV(options);
    const filepath = path.join(process.cwd(), 'e2e', 'phase6', 'fixtures', 'generated', filename);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, csvContent);
    return filepath;
  }

  /**
   * Generate array of prompt data
   */
  private static generatePrompts(options: GeneratorOptions): PromptData[] {
    const prompts: PromptData[] = [];
    const categories = options.categories || this.DEFAULT_CATEGORIES;
    const priorities = options.priorities || this.DEFAULT_PRIORITIES;

    for (let i = 0; i < options.count; i++) {
      const prompt = this.generateSinglePrompt(i, options);
      prompts.push({
        prompt: prompt,
        category: categories[i % categories.length],
        priority: priorities[i % priorities.length],
        metadata: options.includeMetadata ? this.generateMetadata(i) : undefined
      });
    }

    return prompts;
  }

  /**
   * Generate a single prompt based on options
   */
  private static generateSinglePrompt(index: number, options: GeneratorOptions): string {
    let promptType: 'short' | 'medium' | 'long';
    
    if (options.promptLength === 'mixed') {
      const types: ('short' | 'medium' | 'long')[] = ['short', 'medium', 'long'];
      promptType = types[index % 3];
    } else {
      promptType = options.promptLength || 'medium';
    }

    const templates = this.PROMPT_TEMPLATES[promptType];
    const template = templates[index % templates.length];
    const topic = this.TOPICS[index % this.TOPICS.length];

    let prompt = template.replace(/{topic}/g, topic)
      .replace(/{action}/g, `work with ${topic}`)
      .replace(/{concept}/g, topic)
      .replace(/{concept1}/g, topic)
      .replace(/{concept2}/g, this.TOPICS[(index + 1) % this.TOPICS.length])
      .replace(/{activity}/g, `learning ${topic}`)
      .replace(/{thing}/g, 'practices')
      .replace(/{purpose}/g, topic)
      .replace(/{goal}/g, `mastering ${topic}`)
      .replace(/{constraints}/g, 'time and resource limitations')
      .replace(/{factor}/g, 'technology trends')
      .replace(/{outcome}/g, 'business success')
      .replace(/{problem}/g, `implementing ${topic}`)
      .replace(/{subject}/g, topic);

    // Add special characters if requested
    if (options.includeSpecialChars && index % 5 === 0) {
      const char = this.SPECIAL_CHARS[index % this.SPECIAL_CHARS.length];
      prompt += ` [Special: ${char}]`;
    }

    // Add unicode if requested
    if (options.includeUnicode && index % 7 === 0) {
      const unicode = this.UNICODE_SAMPLES[index % this.UNICODE_SAMPLES.length];
      prompt += ` (Unicode: ${unicode})`;
    }

    return prompt;
  }

  /**
   * Generate metadata for a prompt
   */
  private static generateMetadata(index: number): Record<string, any> {
    return {
      generated_at: new Date().toISOString(),
      index: index,
      version: '1.0',
      tags: ['test', 'generated', `batch-${Math.floor(index / 10)}`],
      complexity: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low'
    };
  }

  /**
   * Generate XLSX content (for Excel format testing)
   */
  static generateXLSX(options: GeneratorOptions): Buffer {
    // This would use a library like xlsx or exceljs
    // For now, we'll throw an error indicating it needs implementation
    throw new Error('XLSX generation not yet implemented. Use CSV for now.');
  }

  /**
   * Generate a file that exceeds size limits
   */
  static async generateOversizedFile(
    filename: string,
    targetSizeMB: number = 11
  ): Promise<string> {
    const prompts: string[] = [];
    const longPrompt = 'A'.repeat(1000); // 1KB per prompt
    const promptsNeeded = (targetSizeMB * 1024); // Number of 1KB prompts needed

    for (let i = 0; i < promptsNeeded; i++) {
      prompts.push(`"${longPrompt} ${i}",category${i % 10},high`);
    }

    const content = 'prompt,category,priority\n' + prompts.join('\n');
    const filepath = path.join(process.cwd(), 'e2e', 'phase6', 'fixtures', 'generated', filename);
    
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, content);
    return filepath;
  }

  /**
   * Generate a file with more than allowed prompts
   */
  static async generateExceedingPromptLimit(
    filename: string,
    count: number = 1001
  ): Promise<string> {
    const options: GeneratorOptions = {
      count,
      promptLength: 'short'
    };

    return this.generateFile(filename, options);
  }

  /**
   * Load and parse a CSV file
   */
  static loadCSV(filepath: string): PromptData[] {
    const content = fs.readFileSync(filepath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true
    });

    return records.map((record: any) => ({
      prompt: record.prompt,
      category: record.category,
      priority: record.priority,
      metadata: record.metadata ? JSON.parse(record.metadata) : undefined
    }));
  }
}