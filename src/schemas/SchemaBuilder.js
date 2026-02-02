/**
 * SchemaBuilder - Fluent API for building extraction schemas
 * 
 * Create schemas that define the structure of data to extract
 * from documents, with validation rules and patterns.
 */

const { v4: uuidv4 } = require('uuid');

const FieldTypes = {
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  DATE: 'date',
  ARRAY: 'array',
  OBJECT: 'object',
  ANY: 'any'
};

class SchemaBuilder {
  constructor(name, options = {}) {
    this.schema = {
      id: options.id || uuidv4(),
      name,
      version: options.version || '1.0.0',
      description: options.description || '',
      fields: [],
      crossFieldValidations: [],
      metadata: options.metadata || {},
      createdAt: new Date().toISOString()
    };
    this._currentField = null;
  }

  /**
   * Set schema description
   */
  describe(description) {
    this.schema.description = description;
    return this;
  }

  /**
   * Set schema version
   */
  version(version) {
    this.schema.version = version;
    return this;
  }

  /**
   * Add a string field
   */
  string(name, options = {}) {
    return this._addField(name, FieldTypes.STRING, options);
  }

  /**
   * Add a number field
   */
  number(name, options = {}) {
    return this._addField(name, FieldTypes.NUMBER, options);
  }

  /**
   * Add an integer field
   */
  integer(name, options = {}) {
    return this._addField(name, FieldTypes.INTEGER, options);
  }

  /**
   * Add a boolean field
   */
  boolean(name, options = {}) {
    return this._addField(name, FieldTypes.BOOLEAN, options);
  }

  /**
   * Add a date field
   */
  date(name, options = {}) {
    return this._addField(name, FieldTypes.DATE, {
      format: 'date',
      ...options
    });
  }

  /**
   * Add a datetime field
   */
  datetime(name, options = {}) {
    return this._addField(name, FieldTypes.DATE, {
      format: 'date-time',
      ...options
    });
  }

  /**
   * Add an array field
   */
  array(name, options = {}) {
    return this._addField(name, FieldTypes.ARRAY, options);
  }

  /**
   * Add an object field
   */
  object(name, options = {}) {
    return this._addField(name, FieldTypes.OBJECT, options);
  }

  /**
   * Add a currency field
   */
  currency(name, options = {}) {
    return this._addField(name, FieldTypes.STRING, {
      format: 'currency',
      ...options
    });
  }

  /**
   * Add a percentage field
   */
  percentage(name, options = {}) {
    return this._addField(name, FieldTypes.NUMBER, {
      minimum: 0,
      maximum: 100,
      format: 'percentage',
      ...options
    });
  }

  /**
   * Add an email field
   */
  email(name, options = {}) {
    return this._addField(name, FieldTypes.STRING, {
      format: 'email',
      ...options
    });
  }

  /**
   * Add a phone field
   */
  phone(name, options = {}) {
    return this._addField(name, FieldTypes.STRING, {
      format: 'phone',
      ...options
    });
  }

  /**
   * Add a URL field
   */
  url(name, options = {}) {
    return this._addField(name, FieldTypes.STRING, {
      format: 'url',
      ...options
    });
  }

  /**
   * Add an enum field
   */
  enum(name, values, options = {}) {
    return this._addField(name, FieldTypes.STRING, {
      enum: values,
      ...options
    });
  }

  /**
   * Add a generic field
   */
  field(name, type, options = {}) {
    return this._addField(name, type, options);
  }

  /**
   * Internal: Add a field
   */
  _addField(name, type, options = {}) {
    this._currentField = {
      name,
      type,
      description: options.description || '',
      required: options.required ?? false,
      defaultValue: options.defaultValue,
      enum: options.enum,
      format: options.format,
      pattern: options.pattern,
      patterns: options.patterns || [],
      minimum: options.minimum,
      maximum: options.maximum,
      minLength: options.minLength,
      maxLength: options.maxLength,
      minItems: options.minItems,
      maxItems: options.maxItems,
      uniqueItems: options.uniqueItems,
      validators: options.validators || [],
      extractionHints: options.extractionHints || [],
      metadata: options.metadata || {}
    };
    
    this.schema.fields.push(this._currentField);
    return this;
  }

  // Field modifiers (chainable on current field)

  /**
   * Mark current field as required
   */
  required() {
    if (this._currentField) {
      this._currentField.required = true;
    }
    return this;
  }

  /**
   * Mark current field as optional (default)
   */
  optional() {
    if (this._currentField) {
      this._currentField.required = false;
    }
    return this;
  }

  /**
   * Set default value for current field
   */
  default(value) {
    if (this._currentField) {
      this._currentField.defaultValue = value;
    }
    return this;
  }

  /**
   * Set description for current field
   */
  withDescription(description) {
    if (this._currentField) {
      this._currentField.description = description;
    }
    return this;
  }

  /**
   * Add extraction pattern for current field
   */
  pattern(regex) {
    if (this._currentField) {
      this._currentField.patterns.push(regex);
      if (!this._currentField.pattern) {
        this._currentField.pattern = typeof regex === 'string' ? regex : regex.source;
      }
    }
    return this;
  }

  /**
   * Add multiple extraction patterns
   */
  patterns(regexArray) {
    if (this._currentField) {
      this._currentField.patterns.push(...regexArray);
    }
    return this;
  }

  /**
   * Add extraction hints for LLM
   */
  hints(hintsArray) {
    if (this._currentField) {
      this._currentField.extractionHints.push(...hintsArray);
    }
    return this;
  }

  /**
   * Set minimum value (for numbers)
   */
  min(value) {
    if (this._currentField) {
      if (this._currentField.type === FieldTypes.NUMBER || this._currentField.type === FieldTypes.INTEGER) {
        this._currentField.minimum = value;
      } else if (this._currentField.type === FieldTypes.STRING) {
        this._currentField.minLength = value;
      } else if (this._currentField.type === FieldTypes.ARRAY) {
        this._currentField.minItems = value;
      }
    }
    return this;
  }

  /**
   * Set maximum value (for numbers)
   */
  max(value) {
    if (this._currentField) {
      if (this._currentField.type === FieldTypes.NUMBER || this._currentField.type === FieldTypes.INTEGER) {
        this._currentField.maximum = value;
      } else if (this._currentField.type === FieldTypes.STRING) {
        this._currentField.maxLength = value;
      } else if (this._currentField.type === FieldTypes.ARRAY) {
        this._currentField.maxItems = value;
      }
    }
    return this;
  }

  /**
   * Add custom validator
   */
  validate(validatorName) {
    if (this._currentField) {
      this._currentField.validators.push(validatorName);
    }
    return this;
  }

  // Cross-field validations

  /**
   * Add a cross-field validation rule
   */
  crossValidate(validation) {
    this.schema.crossFieldValidations.push(validation);
    return this;
  }

  /**
   * Require field A if field B has a value
   */
  requireIf(fieldA, fieldB, condition) {
    return this.crossValidate({
      name: `${fieldA}_required_if_${fieldB}`,
      type: 'requiredIf',
      fields: [fieldA, fieldB],
      condition: condition || ((data) => data[fieldB] !== undefined && data[fieldB] !== null)
    });
  }

  /**
   * Mark fields as mutually exclusive
   */
  mutuallyExclusive(fields) {
    return this.crossValidate({
      name: `mutually_exclusive_${fields.join('_')}`,
      type: 'mutuallyExclusive',
      fields
    });
  }

  /**
   * Add a comparison validation
   */
  compare(fieldA, fieldB, compareFn, message) {
    return this.crossValidate({
      name: `compare_${fieldA}_${fieldB}`,
      type: 'comparison',
      fields: [fieldA, fieldB],
      condition: compareFn,
      message
    });
  }

  /**
   * Add custom cross-field validation
   */
  customValidation(name, fields, condition) {
    return this.crossValidate({
      name,
      type: 'custom',
      fields,
      condition
    });
  }

  /**
   * Build and return the schema
   */
  build() {
    // Clean up empty arrays
    for (const field of this.schema.fields) {
      if (field.patterns?.length === 0) delete field.patterns;
      if (field.extractionHints?.length === 0) delete field.extractionHints;
      if (field.validators?.length === 0) delete field.validators;
      
      // Remove undefined/null values
      Object.keys(field).forEach(key => {
        if (field[key] === undefined || field[key] === null) {
          delete field[key];
        }
      });
    }

    return this.schema;
  }

  /**
   * Create schema from JSON definition
   */
  static fromJSON(json) {
    const builder = new SchemaBuilder(json.name, {
      id: json.id,
      version: json.version,
      description: json.description,
      metadata: json.metadata
    });

    for (const field of json.fields || []) {
      builder._addField(field.name, field.type, field);
    }

    for (const validation of json.crossFieldValidations || []) {
      builder.crossValidate(validation);
    }

    return builder.build();
  }

  /**
   * Validate a schema definition
   */
  static validate(schema) {
    const errors = [];

    if (!schema.name) {
      errors.push('Schema must have a name');
    }

    if (!schema.fields || schema.fields.length === 0) {
      errors.push('Schema must have at least one field');
    }

    const fieldNames = new Set();
    for (const field of schema.fields || []) {
      if (!field.name) {
        errors.push('All fields must have a name');
      }
      if (fieldNames.has(field.name)) {
        errors.push(`Duplicate field name: ${field.name}`);
      }
      fieldNames.add(field.name);

      if (!field.type) {
        errors.push(`Field "${field.name}" must have a type`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = { SchemaBuilder, FieldTypes };
