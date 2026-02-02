/**
 * StructuredParser - Parse structured data formats
 * 
 * Handles JSON, CSV, and other structured formats.
 */

class StructuredParser {
  constructor(options = {}) {
    this.strictMode = options.strictMode ?? false;
    this.dateFields = options.dateFields || [];
    this.numberFields = options.numberFields || [];
  }

  /**
   * Parse JSON with error handling
   */
  parseJSON(input, options = {}) {
    try {
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      return {
        success: true,
        data: this._normalizeData(data, options),
        format: 'json'
      };
    } catch (error) {
      if (this.strictMode) throw error;
      return {
        success: false,
        error: error.message,
        format: 'json'
      };
    }
  }

  /**
   * Parse CSV text
   */
  parseCSV(input, options = {}) {
    const delimiter = options.delimiter || ',';
    const hasHeaders = options.hasHeaders ?? true;
    const lines = input.trim().split('\n');
    
    if (lines.length === 0) {
      return { success: true, data: [], headers: [], format: 'csv' };
    }

    const parseRow = (line) => {
      const cells = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          cells.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current.trim());
      return cells;
    };

    const headers = hasHeaders ? parseRow(lines[0]) : [];
    const dataLines = hasHeaders ? lines.slice(1) : lines;
    
    const data = dataLines.map((line, index) => {
      const cells = parseRow(line);
      if (hasHeaders) {
        const row = {};
        headers.forEach((header, i) => {
          row[header] = this._coerceValue(cells[i], header, options);
        });
        return row;
      }
      return cells.map((cell, i) => this._coerceValue(cell, i, options));
    });

    return {
      success: true,
      data,
      headers,
      rowCount: data.length,
      format: 'csv'
    };
  }

  /**
   * Parse key-value pairs from text
   */
  parseKeyValue(input, options = {}) {
    const separator = options.separator || ':';
    const lineSeparator = options.lineSeparator || '\n';
    const lines = input.split(lineSeparator);
    const data = {};

    for (const line of lines) {
      const sepIndex = line.indexOf(separator);
      if (sepIndex > 0) {
        const key = line.slice(0, sepIndex).trim();
        const value = line.slice(sepIndex + 1).trim();
        data[key] = this._coerceValue(value, key, options);
      }
    }

    return {
      success: true,
      data,
      fieldCount: Object.keys(data).length,
      format: 'key-value'
    };
  }

  /**
   * Normalize data with type coercion
   */
  _normalizeData(data, options) {
    if (Array.isArray(data)) {
      return data.map(item => this._normalizeData(item, options));
    }
    
    if (typeof data === 'object' && data !== null) {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this._coerceValue(value, key, options);
      }
      return result;
    }
    
    return data;
  }

  /**
   * Coerce value to appropriate type
   */
  _coerceValue(value, fieldName, options = {}) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const strValue = String(value).trim();

    // Check if it's a date field
    if (this.dateFields.includes(fieldName) || options.dateFields?.includes(fieldName)) {
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? strValue : date.toISOString();
    }

    // Check if it's a number field
    if (this.numberFields.includes(fieldName) || options.numberFields?.includes(fieldName)) {
      const num = parseFloat(strValue.replace(/[,£$€]/g, ''));
      return isNaN(num) ? strValue : num;
    }

    // Auto-detect types
    if (options.autoDetectTypes !== false) {
      // Boolean
      if (strValue.toLowerCase() === 'true') return true;
      if (strValue.toLowerCase() === 'false') return false;

      // Number
      if (/^-?\d+(\.\d+)?$/.test(strValue)) {
        return parseFloat(strValue);
      }

      // Currency (remove symbols and parse)
      if (/^[£$€]?\s?-?\d{1,3}(,\d{3})*(\.\d{2})?$/.test(strValue)) {
        return parseFloat(strValue.replace(/[£$€,\s]/g, ''));
      }
    }

    return strValue;
  }

  /**
   * Flatten nested object
   */
  flatten(obj, prefix = '', separator = '.') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}${separator}${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, this.flatten(value, newKey, separator));
      } else {
        result[newKey] = value;
      }
    }
    
    return result;
  }

  /**
   * Unflatten object
   */
  unflatten(obj, separator = '.') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const keys = key.split(separator);
      let current = result;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
    }
    
    return result;
  }
}

module.exports = { StructuredParser };
