/**
 * ValidationEngine - Validate extracted data against schemas and rules
 * 
 * Provides comprehensive validation with human-in-the-loop support
 * for regulated industries requiring high accuracy.
 */

class ValidationEngine {
  constructor(options = {}) {
    this.rules = new Map();
    this.validators = new Map();
    this.strictMode = options.strictMode ?? false;
    this.customValidators = options.validators || {};
    
    // Register built-in validators
    this._registerBuiltInValidators();
  }

  /**
   * Validate extracted data against a schema
   */
  validate(data, schema, options = {}) {
    const errors = [];
    const warnings = [];
    const fieldResults = {};

    for (const field of schema.fields) {
      const value = data[field.name];
      const result = this._validateField(value, field, data, options);
      
      fieldResults[field.name] = {
        valid: result.valid,
        value,
        errors: result.errors,
        warnings: result.warnings
      };

      errors.push(...result.errors.map(e => ({ ...e, field: field.name })));
      warnings.push(...result.warnings.map(w => ({ ...w, field: field.name })));
    }

    // Cross-field validations
    if (schema.crossFieldValidations?.length) {
      for (const validation of schema.crossFieldValidations) {
        const result = this._runCrossFieldValidation(validation, data);
        if (!result.valid) {
          errors.push({
            code: 'CROSS_FIELD_VALIDATION',
            rule: validation.name,
            message: result.message,
            fields: validation.fields
          });
        }
      }
    }

    // Custom schema-level validations
    if (options.customValidations?.length) {
      for (const validation of options.customValidations) {
        const result = validation(data, schema);
        if (!result.valid) {
          errors.push({
            code: 'CUSTOM_VALIDATION',
            message: result.message
          });
        }
      }
    }

    const valid = errors.length === 0;

    return {
      valid,
      schemaId: schema.id,
      schemaVersion: schema.version,
      timestamp: new Date().toISOString(),
      fieldResults,
      errors,
      warnings,
      summary: this._generateSummary(valid, errors, warnings),
      confidence: this._calculateValidationConfidence(fieldResults)
    };
  }

  /**
   * Validate a single field
   */
  _validateField(value, field, allData, options) {
    const errors = [];
    const warnings = [];

    // Required check
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({
        code: 'REQUIRED',
        message: `Field "${field.name}" is required`
      });
      return { valid: false, errors, warnings };
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null) {
      return { valid: true, errors, warnings };
    }

    // Type validation
    const typeResult = this._validateType(value, field.type);
    if (!typeResult.valid) {
      errors.push({
        code: 'TYPE_MISMATCH',
        message: `Expected type "${field.type}", got "${typeResult.actualType}"`,
        expected: field.type,
        actual: typeResult.actualType
      });
    }

    // Enum validation
    if (field.enum?.length && !field.enum.includes(value)) {
      errors.push({
        code: 'INVALID_ENUM',
        message: `Value "${value}" not in allowed values: ${field.enum.join(', ')}`,
        allowedValues: field.enum
      });
    }

    // Format validation
    if (field.format) {
      const formatResult = this._validateFormat(value, field.format);
      if (!formatResult.valid) {
        errors.push({
          code: 'INVALID_FORMAT',
          message: `Value does not match format "${field.format}"`,
          format: field.format
        });
      }
    }

    // Range validation (for numbers)
    if (typeof value === 'number') {
      if (field.minimum !== undefined && value < field.minimum) {
        errors.push({
          code: 'BELOW_MINIMUM',
          message: `Value ${value} is below minimum ${field.minimum}`,
          minimum: field.minimum
        });
      }
      if (field.maximum !== undefined && value > field.maximum) {
        errors.push({
          code: 'ABOVE_MAXIMUM',
          message: `Value ${value} is above maximum ${field.maximum}`,
          maximum: field.maximum
        });
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (field.minLength !== undefined && value.length < field.minLength) {
        errors.push({
          code: 'TOO_SHORT',
          message: `Value length ${value.length} is below minimum ${field.minLength}`,
          minLength: field.minLength
        });
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        errors.push({
          code: 'TOO_LONG',
          message: `Value length ${value.length} is above maximum ${field.maxLength}`,
          maxLength: field.maxLength
        });
      }
    }

    // Pattern validation
    if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(String(value))) {
        errors.push({
          code: 'PATTERN_MISMATCH',
          message: `Value does not match pattern "${field.pattern}"`,
          pattern: field.pattern
        });
      }
    }

    // Array validation
    if (Array.isArray(value)) {
      if (field.minItems !== undefined && value.length < field.minItems) {
        errors.push({
          code: 'TOO_FEW_ITEMS',
          message: `Array has ${value.length} items, minimum is ${field.minItems}`,
          minItems: field.minItems
        });
      }
      if (field.maxItems !== undefined && value.length > field.maxItems) {
        errors.push({
          code: 'TOO_MANY_ITEMS',
          message: `Array has ${value.length} items, maximum is ${field.maxItems}`,
          maxItems: field.maxItems
        });
      }
      if (field.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) {
        errors.push({
          code: 'DUPLICATE_ITEMS',
          message: 'Array contains duplicate items'
        });
      }
    }

    // Custom validators
    if (field.validators?.length) {
      for (const validatorName of field.validators) {
        const validator = this.validators.get(validatorName) || this.customValidators[validatorName];
        if (validator) {
          const result = validator(value, field, allData);
          if (!result.valid) {
            errors.push({
              code: 'CUSTOM_VALIDATOR',
              validator: validatorName,
              message: result.message
            });
          }
          if (result.warning) {
            warnings.push({
              code: 'CUSTOM_VALIDATOR_WARNING',
              validator: validatorName,
              message: result.warning
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate value type
   */
  _validateType(value, expectedType) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    const typeMap = {
      'string': () => typeof value === 'string',
      'number': () => typeof value === 'number' && !isNaN(value),
      'integer': () => Number.isInteger(value),
      'boolean': () => typeof value === 'boolean',
      'array': () => Array.isArray(value),
      'object': () => typeof value === 'object' && value !== null && !Array.isArray(value),
      'date': () => {
        if (value instanceof Date) return !isNaN(value);
        if (typeof value === 'string') return !isNaN(Date.parse(value));
        return false;
      },
      'null': () => value === null,
      'any': () => true
    };

    const isValid = typeMap[expectedType]?.() ?? true;

    return {
      valid: isValid,
      expectedType,
      actualType
    };
  }

  /**
   * Validate value format
   */
  _validateFormat(value, format) {
    const formats = {
      'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'uri': /^https?:\/\/.+/,
      'url': /^https?:\/\/.+/,
      'date': /^\d{4}-\d{2}-\d{2}$/,
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      'time': /^\d{2}:\d{2}(:\d{2})?$/,
      'phone': /^\+?[\d\s\-()]+$/,
      'currency': /^[\$£€¥]?\s?\d+([,\.]\d{2,})?$/,
      'percentage': /^\d+(\.\d+)?%?$/,
      'uuid': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'ipv4': /^(\d{1,3}\.){3}\d{1,3}$/,
      'ipv6': /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i
    };

    const regex = formats[format];
    if (!regex) {
      // Unknown format - assume valid
      return { valid: true };
    }

    return {
      valid: regex.test(String(value)),
      format
    };
  }

  /**
   * Run cross-field validation
   */
  _runCrossFieldValidation(validation, data) {
    const { type, fields, condition } = validation;

    switch (type) {
      case 'requiredIf':
        // Field A required if field B has certain value
        if (condition(data)) {
          const value = data[fields[0]];
          if (value === undefined || value === null || value === '') {
            return {
              valid: false,
              message: `Field "${fields[0]}" is required when condition is met`
            };
          }
        }
        return { valid: true };

      case 'mutuallyExclusive':
        // Only one of the fields should have a value
        const valuesSet = fields.filter(f => data[f] !== undefined && data[f] !== null);
        if (valuesSet.length > 1) {
          return {
            valid: false,
            message: `Fields ${fields.join(', ')} are mutually exclusive`
          };
        }
        return { valid: true };

      case 'dependentRequired':
        // If field A has value, field B is required
        if (data[fields[0]] !== undefined && data[fields[0]] !== null) {
          if (data[fields[1]] === undefined || data[fields[1]] === null) {
            return {
              valid: false,
              message: `Field "${fields[1]}" is required when "${fields[0]}" is set`
            };
          }
        }
        return { valid: true };

      case 'comparison':
        // Compare two field values
        return condition(data[fields[0]], data[fields[1]])
          ? { valid: true }
          : { valid: false, message: validation.message || `Comparison failed for ${fields.join(' and ')}` };

      case 'custom':
        return condition(data);

      default:
        return { valid: true };
    }
  }

  /**
   * Register a custom validator
   */
  registerValidator(name, validator) {
    this.validators.set(name, validator);
    return this;
  }

  /**
   * Register built-in validators
   */
  _registerBuiltInValidators() {
    // UK National Insurance Number
    this.validators.set('ukNino', (value) => {
      const regex = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/i;
      return {
        valid: regex.test(value),
        message: 'Invalid UK National Insurance Number'
      };
    });

    // UK Postcode
    this.validators.set('ukPostcode', (value) => {
      const regex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
      return {
        valid: regex.test(value),
        message: 'Invalid UK postcode'
      };
    });

    // Sort code
    this.validators.set('sortCode', (value) => {
      const regex = /^\d{2}-?\d{2}-?\d{2}$/;
      return {
        valid: regex.test(value),
        message: 'Invalid sort code'
      };
    });

    // UK Account number
    this.validators.set('ukAccountNumber', (value) => {
      const regex = /^\d{8}$/;
      return {
        valid: regex.test(value),
        message: 'Invalid UK account number (must be 8 digits)'
      };
    });

    // Company number
    this.validators.set('companyNumber', (value) => {
      const regex = /^[A-Z0-9]{8}$/i;
      return {
        valid: regex.test(value),
        message: 'Invalid company number'
      };
    });

    // Date in past
    this.validators.set('dateInPast', (value) => {
      const date = new Date(value);
      return {
        valid: date < new Date(),
        message: 'Date must be in the past'
      };
    });

    // Date in future
    this.validators.set('dateInFuture', (value) => {
      const date = new Date(value);
      return {
        valid: date > new Date(),
        message: 'Date must be in the future'
      };
    });

    // Non-negative
    this.validators.set('nonNegative', (value) => ({
      valid: typeof value === 'number' && value >= 0,
      message: 'Value must be non-negative'
    }));

    // Positive
    this.validators.set('positive', (value) => ({
      valid: typeof value === 'number' && value > 0,
      message: 'Value must be positive'
    }));

    // Not empty string
    this.validators.set('notEmpty', (value) => ({
      valid: typeof value === 'string' && value.trim().length > 0,
      message: 'Value cannot be empty'
    }));

    // Valid JSON
    this.validators.set('validJson', (value) => {
      try {
        if (typeof value === 'string') JSON.parse(value);
        return { valid: true };
      } catch {
        return { valid: false, message: 'Invalid JSON' };
      }
    });
  }

  /**
   * Generate validation summary
   */
  _generateSummary(valid, errors, warnings) {
    if (valid && warnings.length === 0) {
      return 'Validation passed with no issues';
    }
    if (valid && warnings.length > 0) {
      return `Validation passed with ${warnings.length} warning(s)`;
    }
    return `Validation failed with ${errors.length} error(s)`;
  }

  /**
   * Calculate validation confidence
   */
  _calculateValidationConfidence(fieldResults) {
    const fields = Object.values(fieldResults);
    if (fields.length === 0) return 1;

    const validFields = fields.filter(f => f.valid).length;
    return validFields / fields.length;
  }

  /**
   * Create validation report
   */
  generateReport(validationResult, options = {}) {
    const format = options.format || 'json';

    if (format === 'json') {
      return validationResult;
    }

    const lines = [
      'VALIDATION REPORT',
      '=================',
      `Schema: ${validationResult.schemaId} v${validationResult.schemaVersion}`,
      `Timestamp: ${validationResult.timestamp}`,
      `Status: ${validationResult.valid ? 'VALID' : 'INVALID'}`,
      `Confidence: ${(validationResult.confidence * 100).toFixed(0)}%`,
      '',
      'FIELD RESULTS',
      '-------------'
    ];

    for (const [field, result] of Object.entries(validationResult.fieldResults)) {
      lines.push(`${result.valid ? '✓' : '✗'} ${field}: ${result.valid ? 'valid' : 'invalid'}`);
      for (const error of result.errors) {
        lines.push(`    ERROR: ${error.message}`);
      }
      for (const warning of result.warnings) {
        lines.push(`    WARNING: ${warning.message}`);
      }
    }

    if (validationResult.errors.length > 0) {
      lines.push('');
      lines.push('ALL ERRORS');
      lines.push('----------');
      for (const error of validationResult.errors) {
        lines.push(`[${error.code}] ${error.field || 'schema'}: ${error.message}`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = { ValidationEngine };
