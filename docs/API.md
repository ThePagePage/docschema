# docschema API Reference

Complete API documentation for docschema.

## Table of Contents

- [SchemaBuilder](#schemabuilder)
- [SchemaExtractor](#schemaextractor)
- [DocumentRegister](#documentregister)
- [DocumentComparator](#documentcomparator)
- [ExtractionPipeline](#extractionpipeline)
- [ValidationEngine](#validationengine)
- [CitationTracker](#citationtracker)
- [Storage Adapters](#storage-adapters)
- [Built-in Schemas](#built-in-schemas)
- [Parsers](#parsers)

---

## SchemaBuilder

Fluent builder for defining extraction schemas.

### Constructor

```javascript
const schema = new SchemaBuilder(name);
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the schema |

### Methods

#### `.describe(description)`

Add a human-readable description to the schema.

```javascript
schema.describe('Schema for extracting pension scheme rules');
```

#### `.version(version)`

Set the schema version (semver format recommended).

```javascript
schema.version('1.0.0');
```

#### `.string(fieldName)`

Add a string field.

```javascript
schema.string('clauseTitle');
```

Returns a `FieldBuilder` for chaining field options.

#### `.number(fieldName)`

Add a numeric field.

```javascript
schema.number('benefitAmount');
```

#### `.boolean(fieldName)`

Add a boolean field.

```javascript
schema.boolean('isActive');
```

#### `.date(fieldName)`

Add a date field. Accepts ISO 8601 strings or Date objects.

```javascript
schema.date('effectiveFrom');
```

#### `.currency(fieldName)`

Add a currency field. Extracts numeric value and currency code.

```javascript
schema.currency('liabilityLimit');
// Extracts: { value: 1000000, currency: 'GBP' }
```

#### `.percentage(fieldName)`

Add a percentage field (0-100).

```javascript
schema.percentage('interestRate');
```

#### `.enum(fieldName, values)`

Add an enumerated field with allowed values.

```javascript
schema.enum('status', ['active', 'pending', 'closed']);
```

#### `.array(fieldName)`

Add an array field.

```javascript
schema.array('definitions');
```

#### `.object(fieldName)`

Add a nested object field.

```javascript
schema.object('contactDetails');
```

#### `.compare(fieldA, fieldB, compareFn, message)`

Add cross-field validation.

```javascript
schema.compare('startDate', 'endDate',
  (start, end) => new Date(start) < new Date(end),
  'Start date must be before end date'
);
```

#### `.build()`

Compile and return the schema object.

```javascript
const compiledSchema = schema.build();
```

### FieldBuilder Methods

These methods are available after adding a field:

#### `.required()`

Mark field as required.

```javascript
schema.string('title').required();
```

#### `.optional()`

Mark field as optional (default).

```javascript
schema.string('subtitle').optional();
```

#### `.pattern(regex)`

Add extraction pattern (regular expression).

```javascript
schema.string('ruleNumber')
  .pattern(/Rule\s+(\d+(?:\.\d+)*)/i);
```

#### `.hints(hintArray)`

Add extraction hints for LLM-based extraction.

```javascript
schema.string('partyName')
  .hints([
    'Look for company names after "between"',
    'Usually formatted as "Company Name Ltd"'
  ]);
```

#### `.validate(validatorName)`

Apply a named validator.

```javascript
schema.string('postcode').validate('ukPostcode');
```

#### `.min(value)` / `.max(value)`

Set numeric bounds.

```javascript
schema.number('age').min(18).max(120);
schema.percentage('rate').min(0).max(100);
```

#### `.default(value)`

Set default value if not extracted.

```javascript
schema.string('status').default('pending');
```

---

## SchemaExtractor

Extract structured data from documents using schemas.

### Constructor

```javascript
const extractor = new SchemaExtractor(options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | object | Required | Compiled schema from SchemaBuilder |
| `preserveSourceLocation` | boolean | `true` | Track source locations for citations |
| `confidenceThreshold` | number | `0.7` | Minimum confidence for LLM extractions |
| `enableCitations` | boolean | `true` | Generate citation objects |

### Methods

#### `.extract(text, options)`

Extract data from text using the schema.

```javascript
const result = await extractor.extract(documentText, {
  mode: 'pattern',  // 'pattern' | 'llm' | 'hybrid'
  context: { documentType: 'contract' }
});
```

**Returns:**

```javascript
{
  data: {
    // Extracted fields
    clauseNumber: '12.3',
    clauseTitle: 'Liability',
    // ...
  },
  citations: [
    {
      fieldName: 'clauseNumber',
      text: 'Clause 12.3',
      startOffset: 1420,
      endOffset: 1432,
      confidence: 1.0
    }
  ],
  metadata: {
    extractedAt: '2024-01-15T10:30:00Z',
    mode: 'pattern',
    schemaVersion: '1.0.0'
  },
  validation: {
    valid: true,
    errors: [],
    warnings: []
  }
}
```

#### `.setLLMProvider(providerFn)`

Set the LLM provider for AI-based extraction.

```javascript
extractor.setLLMProvider(async (prompt) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]
  });
  return response.choices[0].message.content;
});
```

#### `.extractField(text, fieldName, options)`

Extract a single field.

```javascript
const value = await extractor.extractField(text, 'clauseNumber');
```

#### `.validate(data)`

Validate extracted data against schema.

```javascript
const validation = extractor.validate(data);
// { valid: boolean, errors: [], warnings: [] }
```

---

## DocumentRegister

Version-controlled storage for extracted documents.

### Constructor

```javascript
const register = new DocumentRegister(options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | Required | Register name |
| `storage` | Storage | MemoryStorage | Storage adapter |
| `enableVersioning` | boolean | `true` | Track version history |
| `enableAuditLog` | boolean | `true` | Log all operations |

### Methods

#### `.add(data, metadata)`

Add a new document to the register.

```javascript
const entry = await register.add(extractedData, {
  effectiveFrom: '2024-01-01',
  category: 'benefits',
  tags: ['retirement'],
  source: 'trust-deed.pdf'
});
```

**Returns:**

```javascript
{
  id: 'doc_abc123',
  version: 1,
  data: { /* extracted data */ },
  metadata: { /* provided metadata */ },
  createdAt: '2024-01-15T10:30:00Z'
}
```

#### `.get(id, options)`

Retrieve a document.

```javascript
// Get current version
const doc = await register.get('doc_abc123');

// Get version effective at a specific date
const historicDoc = await register.get('doc_abc123', {
  asOf: '2023-06-15'
});

// Get specific version
const v2 = await register.get('doc_abc123', { version: 2 });
```

#### `.update(id, data, metadata)`

Update a document (creates new version).

```javascript
await register.update('doc_abc123', newData, {
  effectiveFrom: '2024-06-01',
  changeReason: 'Regulatory update',
  changedBy: 'legal@example.com'
});
```

#### `.delete(id, options)`

Delete a document.

```javascript
await register.delete('doc_abc123', {
  reason: 'Superseded',
  deletedBy: 'admin@example.com'
});
```

#### `.getHistory(id)`

Get full version history.

```javascript
const history = await register.getHistory('doc_abc123');
// [{ version: 1, ... }, { version: 2, ... }]
```

#### `.search(query, options)`

Search documents.

```javascript
const results = await register.search({
  category: 'benefits',
  'metadata.effectiveFrom': { $gte: '2024-01-01' }
}, {
  limit: 10,
  sort: { createdAt: -1 }
});
```

#### `.list(options)`

List all documents.

```javascript
const docs = await register.list({
  category: 'benefits',
  limit: 50
});
```

#### `.getAuditLog(options)`

Retrieve audit log entries.

```javascript
const log = register.getAuditLog({
  documentId: 'doc_abc123',
  action: 'update',
  from: '2024-01-01',
  to: '2024-12-31'
});
```

---

## DocumentComparator

Compare documents and find differences.

### Constructor

```javascript
const comparator = new DocumentComparator(options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignoreFields` | string[] | `[]` | Fields to exclude from comparison |
| `numericTolerance` | number | `0` | Tolerance for numeric comparisons |

### Methods

#### `.compare(docA, docB, options)`

Compare two documents.

```javascript
const diff = comparator.compare(docA, docB);
```

**Returns:**

```javascript
{
  identical: false,
  differences: [
    {
      field: 'liabilityLimit',
      type: 'modified',
      valueA: 1000000,
      valueB: 2000000,
      delta: 1000000
    },
    {
      field: 'newClause',
      type: 'added',
      valueB: '...'
    },
    {
      field: 'oldClause',
      type: 'removed',
      valueA: '...'
    }
  ],
  summary: {
    added: 1,
    removed: 1,
    modified: 1
  }
}
```

#### `.compareVersions(documentWithHistory)`

Compare across version history.

```javascript
const timeline = comparator.compareVersions(doc);
// Shows changes between each version
```

#### `.findConflicts(documents, options)`

Find conflicts across multiple documents.

```javascript
const conflicts = comparator.findConflicts(docs, {
  conflictFields: ['benefitRate', 'eligibilityAge']
});
```

#### `.generateDiffReport(diff, options)`

Generate human-readable diff report.

```javascript
const report = comparator.generateDiffReport(diff, {
  format: 'text'  // 'text' | 'html' | 'json'
});
```

---

## ExtractionPipeline

Orchestrate the full extraction workflow.

### Constructor

```javascript
const pipeline = new ExtractionPipeline(options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | Required | Pipeline name |
| `schema` | object | Required | Extraction schema |
| `autoValidate` | boolean | `true` | Validate after extraction |
| `autoRegister` | boolean | `false` | Auto-register extracted docs |
| `requireHumanApproval` | boolean | `false` | Require approval for registration |
| `confidenceThreshold` | number | `0.85` | Min confidence for auto-approval |
| `onApprovalRequired` | function | - | Callback when approval needed |
| `onError` | function | - | Error callback |

### Methods

#### `.process(text, options)`

Process a document through the pipeline.

```javascript
const result = await pipeline.process(documentText, {
  source: 'document.pdf',
  category: 'contracts'
});
```

**Returns:**

```javascript
{
  pipelineRunId: 'run_xyz789',
  status: 'completed' | 'failed' | 'awaiting_approval',
  stages: {
    extraction: { status: 'completed', data: {...}, duration: 1234 },
    validation: { status: 'completed', valid: true },
    approval: { status: 'pending', reason: 'Low confidence: 0.72' },
    registration: { status: 'pending' }
  },
  result: { /* final data if completed */ }
}
```

#### `.approve(pipelineRunId, options)`

Approve a pending extraction.

```javascript
await pipeline.approve('run_xyz789', {
  approvedBy: 'reviewer@example.com',
  comments: 'Verified against source'
});
```

#### `.reject(pipelineRunId, options)`

Reject a pending extraction.

```javascript
await pipeline.reject('run_xyz789', {
  rejectedBy: 'reviewer@example.com',
  reason: 'Data does not match source document'
});
```

#### `.getStatus(pipelineRunId)`

Get pipeline run status.

```javascript
const status = pipeline.getStatus('run_xyz789');
```

#### `.getStats()`

Get pipeline statistics.

```javascript
const stats = pipeline.getStats();
// { total: 100, completed: 95, failed: 3, pending: 2, successRate: '95%' }
```

---

## ValidationEngine

Validate extracted data.

### Constructor

```javascript
const validator = new ValidationEngine(options);
```

### Methods

#### `.validate(data, schema)`

Validate data against a schema.

```javascript
const result = validator.validate(data, schema);
// { valid: boolean, errors: [], warnings: [] }
```

#### `.registerValidator(name, fn)`

Register a custom validator.

```javascript
validator.registerValidator('ukNino', (value) => {
  const pattern = /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i;
  return {
    valid: pattern.test(value),
    message: 'Invalid UK National Insurance number'
  };
});
```

### Built-in Validators

| Name | Description |
|------|-------------|
| `ukNino` | UK National Insurance number |
| `ukPostcode` | UK postcode |
| `sortCode` | UK bank sort code |
| `companyNumber` | UK company registration number |
| `email` | Email address |
| `url` | Valid URL |
| `phone` | Phone number |
| `dateRange` | Valid date range |

---

## CitationTracker

Track and manage source citations.

### Constructor

```javascript
const tracker = new CitationTracker();
```

### Methods

#### `.addCitation(citation)`

Add a citation.

```javascript
tracker.addCitation({
  fieldName: 'clauseTitle',
  text: 'Liability Limitation',
  startOffset: 1420,
  endOffset: 1440,
  confidence: 0.95,
  source: 'contract.pdf'
});
```

#### `.getCitations(fieldName)`

Get citations for a field.

```javascript
const citations = tracker.getCitations('clauseTitle');
```

#### `.getAllCitations()`

Get all citations.

```javascript
const all = tracker.getAllCitations();
```

#### `.toJSON()`

Export citations as JSON.

```javascript
const json = tracker.toJSON();
```

---

## Storage Adapters

### MemoryStorage

In-memory storage (default, for testing).

```javascript
const { MemoryStorage } = require('docschema');
const storage = new MemoryStorage();
```

### FileStorage

File-based storage.

```javascript
const { FileStorage } = require('docschema');

const storage = new FileStorage({
  path: './data/documents',
  format: 'json'  // 'json' | 'yaml'
});
```

### Custom Storage

Implement the Storage interface:

```javascript
class DatabaseStorage {
  async write(key, value) { /* ... */ }
  async read(key) { /* ... */ }
  async list(options) { /* ... */ }
  async delete(key) { /* ... */ }
  async exists(key) { /* ... */ }
}
```

---

## Built-in Schemas

### pensionSchemeRule

Schema for pension scheme rules.

```javascript
const { builtInSchemas } = require('docschema');
const schema = builtInSchemas.pensionSchemeRule;
```

Fields: `ruleNumber`, `ruleTitle`, `ruleText`, `effectiveFrom`, `effectiveTo`, `definitions`, `crossReferences`

### dueDiligenceDocument

Schema for investment due diligence.

```javascript
const schema = builtInSchemas.dueDiligenceDocument;
```

Fields: `companyName`, `industry`, `revenue`, `ebitda`, `employees`, `riskFactors`, `keyFindings`

### esgReport

Schema for ESG/sustainability reports.

```javascript
const schema = builtInSchemas.esgReport;
```

Fields: `reportingPeriod`, `scope1Emissions`, `scope2Emissions`, `scope3Emissions`, `energyConsumption`, `waterUsage`, `wasteGenerated`, `employeeDiversity`

### contractClause

Schema for contract clauses.

```javascript
const schema = builtInSchemas.contractClause;
```

Fields: `clauseNumber`, `clauseTitle`, `clauseText`, `clauseType`, `parties`, `effectiveDate`, `terminationConditions`

### regulatoryCompliance

Schema for regulatory requirements.

```javascript
const schema = builtInSchemas.regulatoryCompliance;
```

Fields: `regulationId`, `requirement`, `applicability`, `deadline`, `complianceStatus`, `evidence`

---

## Parsers

### TextParser

Parse plain text documents.

```javascript
const { TextParser } = require('docschema');

const parser = new TextParser();
const sections = parser.parseSections(text, {
  sectionPattern: /^(?:Section|Article)\s+\d+/m
});
```

### StructuredParser

Parse structured documents (JSON, XML).

```javascript
const { StructuredParser } = require('docschema');

const parser = new StructuredParser();
const data = parser.parse(jsonText, { format: 'json' });
```

---

## Error Handling

All async methods may throw these error types:

```javascript
const { 
  SchemaError,
  ExtractionError,
  ValidationError,
  StorageError 
} = require('docschema');

try {
  await extractor.extract(text);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.errors);
  } else if (error instanceof ExtractionError) {
    console.log('Extraction failed:', error.message);
  }
}
```

---

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { 
  SchemaBuilder, 
  SchemaExtractor,
  ExtractionResult,
  Citation 
} from 'docschema';

const result: ExtractionResult = await extractor.extract(text);
const citations: Citation[] = result.citations;
```
