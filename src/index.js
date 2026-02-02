/**
 * docschema - Document Schema Extraction Framework
 * 
 * Parse complex documents into versioned, comparable structured data
 * with citation tracking and audit trails for regulated industries.
 */

const { SchemaExtractor } = require('./SchemaExtractor');
const { DocumentRegister } = require('./DocumentRegister');
const { DocumentComparator } = require('./DocumentComparator');
const { CitationTracker } = require('./CitationTracker');
const { ValidationEngine } = require('./ValidationEngine');
const { ExtractionPipeline } = require('./ExtractionPipeline');

// Schema definitions
const { SchemaBuilder, FieldTypes } = require('./schemas/SchemaBuilder');
const builtInSchemas = require('./schemas/built-in');

// Parsers
const { TextParser } = require('./parsers/TextParser');
const { StructuredParser } = require('./parsers/StructuredParser');

// Storage adapters
const { MemoryStorage } = require('./storage/MemoryStorage');
const { FileStorage } = require('./storage/FileStorage');

module.exports = {
  // Core classes
  SchemaExtractor,
  DocumentRegister,
  DocumentComparator,
  CitationTracker,
  ValidationEngine,
  ExtractionPipeline,
  
  // Schema building
  SchemaBuilder,
  FieldTypes,
  builtInSchemas,
  
  // Parsers
  TextParser,
  StructuredParser,
  
  // Storage
  MemoryStorage,
  FileStorage,
  
  // Convenience factory
  createExtractor: (options = {}) => new SchemaExtractor(options),
  createRegister: (options = {}) => new DocumentRegister(options),
  createPipeline: (options = {}) => new ExtractionPipeline(options)
};
