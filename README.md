# docschema

**Document Schema Extraction Framework for Regulated Industries**

Parse complex documents into versioned, comparable structured data with citation tracking and audit trails.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Why docschema?

Organizations in regulated industries (financial services, pensions, legal, healthcare) face a common challenge: extracting structured, auditable data from complex documents like:

- **Pension scheme rules** with 100+ sections and historic amendments
- **Due diligence documents** with financial metrics and risk factors
- **Regulatory requirements** with compliance obligations
- **Legal contracts** with interdependent clauses
- **ESG reports** with sustainability metrics

Manual extraction is slow, inconsistent, and error-prone. docschema provides a framework to:

- **Define schemas** for the data you need to extract
- **Extract data** using patterns or LLM-based intelligence
- **Track citations** back to source text for audit trails
- **Version control** documents with full history
- **Compare documents** to find differences and conflicts
- **Validate** extracted data against rules
- **Human-in-the-loop** approval for high-stakes extractions

## Installation

```bash
npm install docschema
```

## Quick Start

```javascript
const { 
  SchemaBuilder, 
  SchemaExtractor, 
  DocumentRegister,
  DocumentComparator 
} = require('docschema');

// 1. Define your schema
const schema = new SchemaBuilder('pension-rule')
  .string('ruleNumber').required()
    .pattern(/(?:Rule|Section)\s*(\d+(?:\.\d+)*)/)
  .string('ruleTitle').required()
  .string('ruleText').required()
  .date('effectiveFrom')
  .array('definitions')
  .build();

// 2. Extract data from a document
const extractor = new SchemaExtractor({ schema });

const result = await extractor.extract(documentText);
console.log(result.data);
// { ruleNumber: '12.3', ruleTitle: 'Early Retirement', ... }
console.log(result.citations);
// [{ text: 'Rule 12.3 Early Retirement...', startOffset: 1420, ... }]

// 3. Store in a version-controlled register
const register = new DocumentRegister({ name: 'scheme-rules' });

await register.add(result, {
  effectiveFrom: '2024-01-01',
  category: 'retirement-benefits'
});

// 4. Compare versions
const comparator = new DocumentComparator();
const diff = comparator.compare(oldVersion, newVersion);
console.log(diff.differences);
// [{ field: 'ruleText', type: 'modified', valueA: '...', valueB: '...' }]
```

## Core Concepts

### Schema Definition

Define what data to extract using the fluent SchemaBuilder:

```javascript
const { SchemaBuilder } = require('docschema');

const schema = new SchemaBuilder('contract-clause')
  .describe('Schema for contract clauses')
  .version('1.0.0')
  
  // Basic fields
  .string('clauseNumber').required()
  .string('clauseTitle').required()
  .string('clauseText').required()
  
  // Typed fields
  .date('effectiveDate')
  .currency('liabilityLimit')
  .percentage('interestRate').min(0).max(100)
  
  // Enums
  .enum('clauseType', ['payment', 'liability', 'termination', 'confidentiality'])
  
  // With extraction patterns
  .string('partyA')
    .pattern(/(?:Party A|First Party)[:\s]+([^,\n]+)/)
    .hints(['Look for the first named party', 'Usually appears after "between"'])
  
  // With validation
  .string('companyNumber')
    .validate('companyNumber')
  
  // Cross-field validation
  .compare('startDate', 'endDate', 
    (start, end) => new Date(start) < new Date(end),
    'Start date must be before end date')
  
  .build();
```

### Extraction with Citations

Extract data while tracking exactly where it came from:

```javascript
const { SchemaExtractor } = require('docschema');

const extractor = new SchemaExtractor({
  schema,
  preserveSourceLocation: true,
  confidenceThreshold: 0.7
});

// Pattern-based extraction
const result = await extractor.extract(documentText);

// LLM-based extraction (bring your own provider)
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

const aiResult = await extractor.extract(documentText);

// Every extracted field has citations
console.log(aiResult.citations);
// [{
//   text: 'The liability cap shall be £1,000,000',
//   fieldName: 'liabilityLimit',
//   startOffset: 2340,
//   endOffset: 2380,
//   confidence: 0.95
// }]
```

### Version-Controlled Document Register

Store documents with full version history and effective dates:

```javascript
const { DocumentRegister } = require('docschema');

const register = new DocumentRegister({
  name: 'scheme-rules',
  enableVersioning: true,
  enableAuditLog: true
});

// Add a document
const entry = await register.add(extractedData, {
  effectiveFrom: '2024-01-01',
  category: 'benefits',
  tags: ['retirement', 'early-retirement']
});

// Update creates new version
await register.update(entry.id, newData, {
  effectiveFrom: '2024-06-01',
  changeReason: 'Regulatory update'
});

// Query by effective date
const rulesAsOf = await register.get(entry.id, {
  asOf: '2024-03-15'  // Returns version effective at that date
});

// Get full history
const history = await register.getHistory(entry.id);

// Search
const results = await register.search({
  'ruleType': 'retirement',
  'effectiveFrom': { $gt: '2023-01-01' }
});

// Audit log
const auditLog = register.getAuditLog({ documentId: entry.id });
```

### Document Comparison

Compare documents to find changes, conflicts, and overlaps:

```javascript
const { DocumentComparator } = require('docschema');

const comparator = new DocumentComparator();

// Compare two documents
const diff = comparator.compare(docA, docB);
console.log(diff.identical); // false
console.log(diff.differences);
// [{ field: 'liabilityLimit', type: 'numeric_change', 
//    valueA: 1000000, valueB: 2000000, delta: 1000000 }]

// Compare version history
const timeline = comparator.compareVersions(documentWithHistory);
console.log(timeline.mostChangedFields);
// [{ field: 'ruleText', changeCount: 5 }]

// Find conflicts across documents
const conflicts = comparator.findConflicts(multipleDocuments, {
  conflictFields: ['benefitRate', 'eligibilityAge']
});

// Generate diff report
const report = comparator.generateDiffReport(diff, { format: 'text' });
```

### Extraction Pipeline

Orchestrate the full workflow with human-in-the-loop support:

```javascript
const { ExtractionPipeline } = require('docschema');

const pipeline = new ExtractionPipeline({
  name: 'scheme-rules-pipeline',
  schema,
  autoValidate: true,
  autoRegister: true,
  requireHumanApproval: true,
  confidenceThreshold: 0.85,
  
  onApprovalRequired: async ({ pipelineRunId, reason }) => {
    // Notify reviewers
    await notifyReviewTeam(pipelineRunId, reason);
  }
});

// Process a document
const result = await pipeline.process(documentText, {
  source: 'trust-deed-2024.pdf',
  category: 'scheme-rules'
});

if (result.status === 'awaiting_approval') {
  // Document needs human review
  console.log('Pending approval:', result.stages.approval.reason);
}

// Approve or reject
await pipeline.approve(result.pipelineRunId, {
  approvedBy: 'legal-team@example.com',
  comments: 'Verified against source document'
});

// Get pipeline statistics
console.log(pipeline.getStats());
// { completed: 150, failed: 3, pendingApprovals: 2, successRate: '97.5%' }
```

## Built-in Schemas

docschema includes ready-to-use schemas for common document types:

```javascript
const { builtInSchemas } = require('docschema');

// Pension scheme rules
const { pensionSchemeRule } = builtInSchemas;

// Investment due diligence
const { dueDiligenceDocument } = builtInSchemas;

// ESG/sustainability reports
const { esgReport } = builtInSchemas;

// Regulatory compliance
const { regulatoryCompliance } = builtInSchemas;

// Contract clauses
const { contractClause } = builtInSchemas;

// Financial statements
const { financialStatement } = builtInSchemas;
```

## Validation

Comprehensive validation with built-in and custom validators:

```javascript
const { ValidationEngine } = require('docschema');

const validator = new ValidationEngine();

// Built-in validators
validator.registerValidator('ukNino', ...);      // UK National Insurance
validator.registerValidator('ukPostcode', ...);  // UK Postcodes
validator.registerValidator('sortCode', ...);    // Bank sort codes
validator.registerValidator('companyNumber', ...); // Company registration

// Custom validators
validator.registerValidator('pensionAge', (value) => ({
  valid: value >= 55 && value <= 75,
  message: 'Pension age must be between 55 and 75'
}));

// Validate extracted data
const result = validator.validate(extractedData, schema);
console.log(result.valid);
console.log(result.errors);
console.log(result.warnings);
```

## Storage Adapters

Choose where to store your document register:

```javascript
const { DocumentRegister, MemoryStorage, FileStorage } = require('docschema');

// In-memory (default, for testing)
const memoryRegister = new DocumentRegister({
  storage: new MemoryStorage()
});

// File-based
const fileRegister = new DocumentRegister({
  storage: new FileStorage({ path: './data/rules' })
});

// Custom adapter (e.g., database)
class DatabaseStorage {
  async write(key, value) { /* ... */ }
  async read(key) { /* ... */ }
  async list() { /* ... */ }
  async delete(key) { /* ... */ }
}

const dbRegister = new DocumentRegister({
  storage: new DatabaseStorage({ connectionString: '...' })
});
```

## Use Cases

### Pension Scheme Administration
- Extract and version-control scheme rules across 100+ sections
- Track rule changes over time with effective dates
- Compare rules across different scheme sections
- Provide grounded Q&A on rule content

### Investment Due Diligence
- Extract key metrics from information memoranda
- Standardize data across deal flow
- Track red flags and risk factors
- Compare current vs. historic deals

### Regulatory Compliance
- Extract obligations from regulatory documents
- Map requirements to controls
- Track regulatory changes and deadlines
- Generate compliance evidence

### Contract Analysis
- Extract clause-level data from agreements
- Compare contract versions during negotiation
- Identify conflicting terms across contracts
- Build clause libraries

## Best Practices

### For Regulated Industries

1. **Always enable citations** — Regulators require evidence of data provenance
2. **Use version control** — Maintain full history with effective dates
3. **Enable audit logs** — Track all changes with user attribution
4. **Set appropriate thresholds** — Higher confidence thresholds for high-stakes data
5. **Human-in-the-loop** — Route low-confidence extractions to reviewers

### For Accuracy

1. **Define clear schemas** — Be specific about field types and formats
2. **Use extraction hints** — Help LLMs understand context
3. **Validate thoroughly** — Use built-in and custom validators
4. **Test with real documents** — Patterns that work on samples may fail on variants
5. **Monitor confidence scores** — Track extraction quality over time

## API Reference

See the [full API documentation](docs/API.md) for detailed reference.

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

## License

MIT License — see [LICENSE](LICENSE) for details.
