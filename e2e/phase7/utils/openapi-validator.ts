import { OpenAPIV3 } from 'openapi-types';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationResult {
  valid: boolean;
  errors?: any[];
  warnings?: string[];
}

export interface EndpointValidation {
  path: string;
  method: string;
  statusCode: number;
  request?: {
    body?: any;
    params?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, string>;
  };
  response?: {
    body?: any;
    headers?: Record<string, string>;
  };
  result: ValidationResult;
}

export class OpenAPIValidator {
  private spec: OpenAPIV3.Document;
  private ajv: Ajv;
  private validationResults: EndpointValidation[] = [];

  constructor(spec: OpenAPIV3.Document) {
    this.spec = spec;
    this.ajv = new Ajv({ 
      allErrors: true, 
      verbose: true,
      strict: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Validate a request against the OpenAPI spec
   */
  validateRequest(
    path: string,
    method: string,
    request: {
      body?: any;
      params?: Record<string, any>;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    }
  ): ValidationResult {
    const operation = this.getOperation(path, method);
    if (!operation) {
      return {
        valid: false,
        errors: [`Operation ${method.toUpperCase()} ${path} not found in spec`],
      };
    }

    const errors: any[] = [];
    const warnings: string[] = [];

    // Validate request body
    if (request.body && operation.requestBody) {
      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
      const content = requestBody.content?.['application/json'];
      
      if (content?.schema) {
        const schema = this.resolveSchema(content.schema);
        const validate = this.ajv.compile(schema);
        const valid = validate(request.body);
        
        if (!valid) {
          errors.push(...(validate.errors || []));
        }
      }
    }

    // Validate parameters
    if (operation.parameters) {
      for (const param of operation.parameters as OpenAPIV3.ParameterObject[]) {
        const value = this.getParameterValue(param, request);
        
        if (param.required && value === undefined) {
          errors.push({
            message: `Required parameter '${param.name}' is missing`,
            params: { name: param.name, in: param.in },
          });
        }
        
        if (value !== undefined && param.schema) {
          const schema = this.resolveSchema(param.schema);
          const validate = this.ajv.compile(schema);
          const valid = validate(value);
          
          if (!valid) {
            errors.push(...(validate.errors || []));
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate a response against the OpenAPI spec
   */
  validateResponse(
    path: string,
    method: string,
    statusCode: number,
    response: {
      body?: any;
      headers?: Record<string, string>;
    }
  ): ValidationResult {
    const operation = this.getOperation(path, method);
    if (!operation) {
      return {
        valid: false,
        errors: [`Operation ${method.toUpperCase()} ${path} not found in spec`],
      };
    }

    const errors: any[] = [];
    const warnings: string[] = [];

    // Check if status code is documented
    const responses = operation.responses;
    const responseSpec = responses[statusCode.toString()] || responses.default;

    if (!responseSpec) {
      warnings.push(`Status code ${statusCode} not documented for ${method.toUpperCase()} ${path}`);
    } else {
      const responseObj = responseSpec as OpenAPIV3.ResponseObject;
      
      // Validate response body
      if (response.body !== undefined && responseObj.content) {
        const content = responseObj.content['application/json'];
        
        if (content?.schema) {
          const schema = this.resolveSchema(content.schema);
          const validate = this.ajv.compile(schema);
          const valid = validate(response.body);
          
          if (!valid) {
            errors.push(...(validate.errors || []));
          }
        }
      }
      
      // Validate response headers
      if (responseObj.headers) {
        for (const [headerName, headerSpec] of Object.entries(responseObj.headers)) {
          const header = headerSpec as OpenAPIV3.HeaderObject;
          const value = response.headers?.[headerName.toLowerCase()];
          
          if (header.required && !value) {
            errors.push({
              message: `Required response header '${headerName}' is missing`,
              params: { name: headerName },
            });
          }
          
          if (value && header.schema) {
            const schema = this.resolveSchema(header.schema);
            const validate = this.ajv.compile(schema);
            const valid = validate(value);
            
            if (!valid) {
              errors.push(...(validate.errors || []));
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Validate a complete API interaction (request + response)
   */
  validateInteraction(
    path: string,
    method: string,
    statusCode: number,
    request: {
      body?: any;
      params?: Record<string, any>;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    },
    response: {
      body?: any;
      headers?: Record<string, string>;
    }
  ): EndpointValidation {
    const requestResult = this.validateRequest(path, method, request);
    const responseResult = this.validateResponse(path, method, statusCode, response);

    const validation: EndpointValidation = {
      path,
      method,
      statusCode,
      request,
      response,
      result: {
        valid: requestResult.valid && responseResult.valid,
        errors: [
          ...(requestResult.errors || []),
          ...(responseResult.errors || []),
        ],
        warnings: [
          ...(requestResult.warnings || []),
          ...(responseResult.warnings || []),
        ],
      },
    };

    this.validationResults.push(validation);
    return validation;
  }

  /**
   * Get all validation results
   */
  getValidationResults(): EndpointValidation[] {
    return this.validationResults;
  }

  /**
   * Get validation summary
   */
  getValidationSummary(): {
    total: number;
    valid: number;
    invalid: number;
    coverage: number;
    uncoveredEndpoints: string[];
  } {
    const total = this.validationResults.length;
    const valid = this.validationResults.filter(v => v.result.valid).length;
    const invalid = total - valid;

    // Calculate coverage
    const allEndpoints = this.getAllEndpoints();
    const testedEndpoints = new Set(
      this.validationResults.map(v => `${v.method.toUpperCase()} ${v.path}`)
    );
    
    const uncoveredEndpoints = allEndpoints.filter(e => !testedEndpoints.has(e));
    const coverage = (testedEndpoints.size / allEndpoints.length) * 100;

    return {
      total,
      valid,
      invalid,
      coverage,
      uncoveredEndpoints,
    };
  }

  /**
   * Generate validation report
   */
  generateReport(): string {
    const summary = this.getValidationSummary();
    const lines: string[] = [
      '# OpenAPI Contract Validation Report',
      '',
      '## Summary',
      `- Total validations: ${summary.total}`,
      `- Valid: ${summary.valid}`,
      `- Invalid: ${summary.invalid}`,
      `- API Coverage: ${summary.coverage.toFixed(2)}%`,
      '',
    ];

    if (summary.uncoveredEndpoints.length > 0) {
      lines.push('## Uncovered Endpoints');
      summary.uncoveredEndpoints.forEach(endpoint => {
        lines.push(`- ${endpoint}`);
      });
      lines.push('');
    }

    const failures = this.validationResults.filter(v => !v.result.valid);
    if (failures.length > 0) {
      lines.push('## Validation Failures');
      failures.forEach(failure => {
        lines.push(`### ${failure.method.toUpperCase()} ${failure.path} (${failure.statusCode})`);
        if (failure.result.errors) {
          lines.push('**Errors:**');
          failure.result.errors.forEach(error => {
            lines.push(`- ${JSON.stringify(error)}`);
          });
        }
        lines.push('');
      });
    }

    const warnings = this.validationResults.filter(v => v.result.warnings && v.result.warnings.length > 0);
    if (warnings.length > 0) {
      lines.push('## Warnings');
      warnings.forEach(warning => {
        lines.push(`### ${warning.method.toUpperCase()} ${warning.path}`);
        warning.result.warnings!.forEach(w => {
          lines.push(`- ${w}`);
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private getOperation(path: string, method: string): OpenAPIV3.OperationObject | null {
    const pathItem = this.spec.paths[path];
    if (!pathItem) return null;

    const operation = (pathItem as any)[method.toLowerCase()];
    return operation || null;
  }

  private resolveSchema(schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject): any {
    if ('$ref' in schema) {
      const ref = schema.$ref;
      const parts = ref.split('/');
      let current: any = this.spec;
      
      for (let i = 1; i < parts.length; i++) {
        current = current[parts[i]];
      }
      
      return current;
    }
    
    return schema;
  }

  private getParameterValue(
    param: OpenAPIV3.ParameterObject,
    request: {
      body?: any;
      params?: Record<string, any>;
      query?: Record<string, any>;
      headers?: Record<string, string>;
    }
  ): any {
    switch (param.in) {
      case 'path':
        return request.params?.[param.name];
      case 'query':
        return request.query?.[param.name];
      case 'header':
        return request.headers?.[param.name];
      default:
        return undefined;
    }
  }

  private getAllEndpoints(): string[] {
    const endpoints: string[] = [];
    
    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
      
      for (const method of methods) {
        if ((pathItem as any)[method]) {
          endpoints.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    
    return endpoints;
  }
}