/**
 * Built-in schemas for common document types
 * 
 * Ready-to-use schemas for regulated industries.
 */

const { SchemaBuilder } = require('./SchemaBuilder');

/**
 * Pension Scheme Rule Schema
 * For extracting rules from pension scheme documents
 */
const pensionSchemeRule = new SchemaBuilder('pension-scheme-rule', {
  version: '1.0.0',
  description: 'Schema for pension scheme rules and provisions'
})
  .string('ruleNumber').required()
    .withDescription('The rule/section number (e.g., "12.3", "Section 15")')
    .patterns([
      /(?:Rule|Section|Clause)\s*(\d+(?:\.\d+)*)/i,
      /^(\d+(?:\.\d+)*)\s/
    ])
  
  .string('ruleTitle').required()
    .withDescription('Title or heading of the rule')
  
  .string('ruleType')
    .withDescription('Category of rule')
    .enum(['benefit', 'eligibility', 'contribution', 'payment', 'transfer', 'death', 'governance', 'other'])
  
  .string('ruleText').required()
    .withDescription('Full text of the rule provision')
  
  .string('summary')
    .withDescription('Plain-English summary of the rule')
  
  .date('effectiveFrom')
    .withDescription('Date the rule became effective')
  
  .date('effectiveTo')
    .withDescription('Date the rule ceased to be effective (if superseded)')
  
  .string('supersedes')
    .withDescription('Reference to rule this supersedes')
  
  .string('supersededBy')
    .withDescription('Reference to rule that supersedes this')
  
  .array('definitions')
    .withDescription('Key terms defined in this rule')
  
  .array('references')
    .withDescription('References to other rules or legislation')
  
  .array('schedules')
    .withDescription('Related schedules or appendices')
  
  .string('applicableSections')
    .withDescription('Which scheme sections this rule applies to')
  
  .array('conditions')
    .withDescription('Conditions or qualifications on the rule')
  
  .object('calculations')
    .withDescription('Any benefit calculations specified')
  
  .build();

/**
 * Due Diligence Document Schema
 * For extracting key information from investment DD documents
 */
const dueDiligenceDocument = new SchemaBuilder('due-diligence-document', {
  version: '1.0.0',
  description: 'Schema for investment due diligence documents'
})
  .string('documentType').required()
    .enum(['information-memorandum', 'cim', 'teaser', 'financial-statements', 'legal-dd', 'commercial-dd', 'technical-dd'])
  
  .string('companyName').required()
    .withDescription('Name of the target company')
  
  .string('dealName')
    .withDescription('Name or code for the deal')
  
  .date('documentDate')
    .withDescription('Date of the document')
  
  .string('preparedBy')
    .withDescription('Party who prepared the document')
  
  // Financial metrics
  .currency('revenue')
    .withDescription('Annual revenue')
    .patterns([/revenue[:\s]+[\$£€]?([\d,]+)/i])
  
  .currency('ebitda')
    .withDescription('EBITDA')
    .patterns([/ebitda[:\s]+[\$£€]?([\d,]+)/i])
  
  .number('revenueGrowth')
    .withDescription('Revenue growth rate (%)')
  
  .number('ebitdaMargin')
    .withDescription('EBITDA margin (%)')
  
  .currency('netDebt')
    .withDescription('Net debt position')
  
  .currency('enterpriseValue')
    .withDescription('Enterprise value')
  
  // Deal structure
  .string('transactionType')
    .enum(['acquisition', 'merger', 'buyout', 'growth-equity', 'refinancing', 'recapitalization'])
  
  .currency('considerationAmount')
    .withDescription('Deal consideration/price')
  
  .string('paymentStructure')
    .withDescription('How consideration is structured')
  
  // Risk factors
  .array('keyRisks')
    .withDescription('Identified risk factors')
  
  .array('redFlags')
    .withDescription('Potential red flags or concerns')
  
  // ESG
  .string('esgRating')
    .withDescription('ESG rating or assessment')
  
  .array('esgRisks')
    .withDescription('Environmental, social, or governance risks')
  
  // Management
  .array('keyManagement')
    .withDescription('Key management personnel')
  
  .string('managementAssessment')
    .withDescription('Assessment of management team')
  
  // Market
  .string('sector')
    .withDescription('Industry sector')
  
  .string('marketPosition')
    .withDescription('Competitive position in market')
  
  .array('competitors')
    .withDescription('Key competitors')
  
  .build();

/**
 * ESG Report Schema
 * For extracting ESG data from corporate reports
 */
const esgReport = new SchemaBuilder('esg-report', {
  version: '1.0.0',
  description: 'Schema for ESG/sustainability reports'
})
  .string('companyName').required()
  
  .string('reportingPeriod').required()
    .withDescription('Reporting period (e.g., "FY2024")')
  
  .date('reportDate')
  
  .string('reportingFramework')
    .withDescription('Framework used (GRI, SASB, TCFD, etc.)')
  
  // Environmental
  .number('carbonEmissionsScope1')
    .withDescription('Scope 1 emissions (tonnes CO2e)')
  
  .number('carbonEmissionsScope2')
    .withDescription('Scope 2 emissions (tonnes CO2e)')
  
  .number('carbonEmissionsScope3')
    .withDescription('Scope 3 emissions (tonnes CO2e)')
  
  .number('carbonIntensity')
    .withDescription('Carbon intensity (per revenue/unit)')
  
  .string('netZeroTarget')
    .withDescription('Net zero commitment and target date')
  
  .number('renewableEnergyPercentage')
    .withDescription('Percentage of renewable energy used')
  
  .number('waterUsage')
    .withDescription('Water usage (cubic meters)')
  
  .number('wasteRecyclingRate')
    .withDescription('Waste recycling rate (%)')
  
  // Social
  .integer('employeeCount')
    .withDescription('Total number of employees')
  
  .number('genderDiversityPercentage')
    .withDescription('Percentage of female employees')
  
  .number('boardDiversityPercentage')
    .withDescription('Percentage of female board members')
  
  .number('employeeTurnover')
    .withDescription('Employee turnover rate (%)')
  
  .number('safetyIncidentRate')
    .withDescription('Safety incident rate (per 100 workers)')
  
  .number('trainingHoursPerEmployee')
    .withDescription('Average training hours per employee')
  
  .string('livingWageCommitment')
    .withDescription('Living wage policy/commitment')
  
  // Governance
  .integer('boardSize')
    .withDescription('Number of board members')
  
  .integer('independentDirectors')
    .withDescription('Number of independent directors')
  
  .boolean('separateChairCeo')
    .withDescription('Whether Chair and CEO roles are separate')
  
  .string('executiveCompensationStructure')
    .withDescription('Executive compensation approach')
  
  .boolean('esgLinkedCompensation')
    .withDescription('Whether ESG metrics linked to executive pay')
  
  .array('materialIssues')
    .withDescription('Material ESG issues identified')
  
  .array('controversies')
    .withDescription('ESG controversies or incidents')
  
  .build();

/**
 * Regulatory Compliance Schema
 * For extracting compliance requirements from regulatory documents
 */
const regulatoryCompliance = new SchemaBuilder('regulatory-compliance', {
  version: '1.0.0',
  description: 'Schema for regulatory compliance requirements'
})
  .string('regulationName').required()
    .withDescription('Name of the regulation')
  
  .string('regulationReference').required()
    .withDescription('Official reference (e.g., "Article 12(3)")')
    .patterns([
      /Article\s+(\d+(?:\(\d+\))?)/i,
      /Section\s+(\d+(?:\.\d+)?)/i,
      /Regulation\s+(\d+)/i
    ])
  
  .string('jurisdiction')
    .withDescription('Applicable jurisdiction')
    .enum(['UK', 'EU', 'US', 'International'])
  
  .string('regulator')
    .withDescription('Regulatory body (FCA, PRA, SEC, etc.)')
  
  .string('obligationType')
    .enum(['requirement', 'prohibition', 'guidance', 'recommendation'])
  
  .string('obligationText').required()
    .withDescription('Full text of the obligation')
  
  .string('summary')
    .withDescription('Plain-English summary')
  
  .date('effectiveDate')
    .withDescription('When the regulation takes effect')
  
  .date('complianceDeadline')
    .withDescription('Deadline for compliance')
  
  .array('applicableTo')
    .withDescription('Entities this applies to')
  
  .array('exemptions')
    .withDescription('Exemptions or exceptions')
  
  .string('penaltyInfo')
    .withDescription('Penalties for non-compliance')
  
  .array('relatedRegulations')
    .withDescription('Related regulatory requirements')
  
  .array('controlsRequired')
    .withDescription('Controls needed for compliance')
  
  .string('evidenceRequired')
    .withDescription('Evidence needed to demonstrate compliance')
  
  .build();

/**
 * Contract Clause Schema
 * For extracting clauses from legal contracts
 */
const contractClause = new SchemaBuilder('contract-clause', {
  version: '1.0.0',
  description: 'Schema for contract clauses and provisions'
})
  .string('clauseNumber').required()
  
  .string('clauseTitle').required()
  
  .string('clauseType')
    .enum([
      'definitions', 'term', 'payment', 'liability', 'indemnity',
      'confidentiality', 'termination', 'intellectual-property',
      'warranties', 'representations', 'force-majeure', 'dispute-resolution',
      'governing-law', 'assignment', 'notices', 'general'
    ])
  
  .string('clauseText').required()
  
  .string('summary')
    .withDescription('Plain-English summary')
  
  .array('obligations')
    .withDescription('Obligations created by this clause')
  
  .array('rights')
    .withDescription('Rights granted by this clause')
  
  .array('conditions')
    .withDescription('Conditions or triggers')
  
  .array('definitions')
    .withDescription('Terms defined in this clause')
  
  .array('crossReferences')
    .withDescription('References to other clauses')
  
  .string('riskLevel')
    .enum(['low', 'medium', 'high', 'critical'])
  
  .string('negotiationNotes')
    .withDescription('Notes on typical negotiation points')
  
  .build();

/**
 * Financial Statement Schema
 * For extracting data from financial statements
 */
const financialStatement = new SchemaBuilder('financial-statement', {
  version: '1.0.0',
  description: 'Schema for financial statement data'
})
  .string('companyName').required()
  
  .string('statementType').required()
    .enum(['income-statement', 'balance-sheet', 'cash-flow', 'notes'])
  
  .string('period').required()
    .withDescription('Reporting period (e.g., "Year ended 31 Dec 2024")')
  
  .string('currency')
    .default('GBP')
  
  .string('units')
    .withDescription('Units (thousands, millions, etc.)')
    .enum(['units', 'thousands', 'millions', 'billions'])
  
  .boolean('audited')
  
  .string('auditor')
  
  // Income statement
  .currency('revenue')
  .currency('costOfSales')
  .currency('grossProfit')
  .currency('operatingExpenses')
  .currency('operatingProfit')
  .currency('interestExpense')
  .currency('profitBeforeTax')
  .currency('taxExpense')
  .currency('netProfit')
  
  // Balance sheet
  .currency('totalAssets')
  .currency('currentAssets')
  .currency('nonCurrentAssets')
  .currency('totalLiabilities')
  .currency('currentLiabilities')
  .currency('nonCurrentLiabilities')
  .currency('shareholdersEquity')
  
  // Cash flow
  .currency('operatingCashFlow')
  .currency('investingCashFlow')
  .currency('financingCashFlow')
  .currency('netCashFlow')
  
  // Ratios
  .number('currentRatio')
  .number('debtToEquity')
  .number('returnOnEquity')
  .number('grossMargin')
  .number('netMargin')
  
  .build();

module.exports = {
  pensionSchemeRule,
  dueDiligenceDocument,
  esgReport,
  regulatoryCompliance,
  contractClause,
  financialStatement
};
