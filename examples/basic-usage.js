/**
 * Basic usage example for docschema
 */

const {
  SchemaBuilder,
  SchemaExtractor,
  DocumentRegister,
  DocumentComparator,
  ValidationEngine
} = require('../src');

async function main() {
  console.log('=== docschema Basic Usage Example ===\n');

  // 1. Define a schema for pension scheme rules
  console.log('1. Defining schema...');
  
  const schema = new SchemaBuilder('pension-rule', {
    version: '1.0.0',
    description: 'Schema for pension scheme rules'
  })
    .string('ruleNumber').required()
      .withDescription('The rule/section number')
      .pattern(/(?:Rule|Section)\s*(\d+(?:\.\d+)*)/)
    
    .string('ruleTitle').required()
      .withDescription('Title of the rule')
    
    .string('ruleType')
      .enum(['benefit', 'eligibility', 'contribution', 'payment', 'transfer', 'other'])
    
    .string('ruleText').required()
      .withDescription('Full text of the rule')
    
    .date('effectiveFrom')
      .withDescription('When the rule became effective')
    
    .array('definitions')
      .withDescription('Key terms defined')
    
    .build();

  console.log(`Schema "${schema.name}" v${schema.version} created with ${schema.fields.length} fields\n`);

  // 2. Create sample document text
  const documentText = `
SECTION 12 - EARLY RETIREMENT

12.1 Eligibility for Early Retirement

A member may retire early and receive their pension benefits before Normal Pension Age 
if they satisfy the following conditions:

(a) the member has attained age 55; and
(b) the member has completed at least 2 years of Pensionable Service; and
(c) the member has not already received benefits under this Section.

"Normal Pension Age" means age 65, or such other age as may be specified in the 
member's Schedule of Benefits.

"Pensionable Service" means the period of employment during which the member 
contributed to the Scheme.

This rule is effective from 1 April 2024 and supersedes Rule 12 of the 2019 Trust Deed.

12.2 Calculation of Early Retirement Benefits

The early retirement pension shall be calculated as follows:
- Take the member's accrued pension at the date of early retirement
- Apply an early retirement factor as set out in Schedule 3
- The factor reduces the pension by 4% for each year before Normal Pension Age
`;

  // 3. Extract data using the schema
  console.log('2. Extracting data from document...');
  
  const extractor = new SchemaExtractor({
    schema,
    preserveSourceLocation: true,
    confidenceThreshold: 0.6
  });

  const extracted = await extractor.extract(documentText);
  
  console.log('Extracted data:');
  console.log(JSON.stringify(extracted.data, null, 2));
  console.log(`\nConfidence: ${(extracted.confidence * 100).toFixed(0)}%`);
  console.log(`Citations: ${extracted.citations.length}`);
  console.log('');

  // 4. Validate the extracted data
  console.log('3. Validating extracted data...');
  
  const validator = new ValidationEngine();
  const validation = validator.validate(extracted.data, schema);
  
  console.log(`Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }
  console.log('');

  // 5. Store in the document register
  console.log('4. Storing in document register...');
  
  const register = new DocumentRegister({
    name: 'scheme-rules',
    enableVersioning: true,
    enableAuditLog: true
  });

  const entry = await register.add(extracted, {
    effectiveFrom: '2024-04-01',
    category: 'retirement-benefits',
    tags: ['early-retirement', 'section-12'],
    source: 'trust-deed-2024.pdf'
  });

  console.log(`Document registered: ID=${entry.id}, Version=${entry.version}`);
  console.log('');

  // 6. Simulate an update
  console.log('5. Updating document (creates new version)...');
  
  const updatedData = {
    ...extracted,
    data: {
      ...extracted.data,
      ruleText: extracted.data.ruleText + '\n\nAmendment: Minimum age reduced to 50 for certain categories.'
    }
  };

  const updated = await register.update(entry.id, updatedData, {
    effectiveFrom: '2024-10-01',
    changeReason: 'Regulatory update - minimum age reduction'
  });

  console.log(`Updated: Version ${updated.previousVersion} → ${updated.version}`);
  console.log('');

  // 7. Compare versions
  console.log('6. Comparing versions...');
  
  const docWithHistory = await register.get(entry.id);
  const comparator = new DocumentComparator();
  const timeline = comparator.compareVersions(docWithHistory);

  console.log(`Version history: ${timeline.versionCount} versions`);
  console.log(`Total changes: ${timeline.totalChanges}`);
  if (timeline.timeline.length > 0) {
    console.log('Changes in latest update:');
    for (const change of timeline.timeline[0].changes) {
      console.log(`  - ${change.field}: ${change.type}`);
    }
  }
  console.log('');

  // 8. Query the register
  console.log('7. Querying register...');
  
  const searchResults = await register.search({
    'ruleType': { $contains: 'benefit' }
  });
  console.log(`Found ${searchResults.total} matching documents`);
  
  const auditLog = register.getAuditLog({ limit: 5 });
  console.log(`\nRecent audit log entries: ${auditLog.length}`);
  for (const entry of auditLog) {
    console.log(`  ${entry.timestamp}: ${entry.action} - ${entry.documentId}`);
  }

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
