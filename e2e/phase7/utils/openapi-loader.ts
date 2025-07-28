import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { OpenAPIV3 } from 'openapi-types';

export class OpenAPILoader {
  static loadFromFile(filePath: string): OpenAPIV3.Document {
    const absolutePath = path.resolve(filePath);
    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      return yaml.load(fileContent) as OpenAPIV3.Document;
    } else if (filePath.endsWith('.json')) {
      return JSON.parse(fileContent) as OpenAPIV3.Document;
    } else {
      throw new Error('Unsupported file format. Use .yaml, .yml, or .json');
    }
  }

  static loadFromString(content: string, format: 'yaml' | 'json'): OpenAPIV3.Document {
    if (format === 'yaml') {
      return yaml.load(content) as OpenAPIV3.Document;
    } else {
      return JSON.parse(content) as OpenAPIV3.Document;
    }
  }

  static getDefaultSpec(): OpenAPIV3.Document {
    const specPath = path.join(__dirname, '..', 'fixtures', 'openapi.yaml');
    return this.loadFromFile(specPath);
  }
}