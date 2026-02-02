/**
 * CitationTracker - Track citations and source references
 * 
 * Maintains audit trails of where extracted data came from,
 * supporting compliance requirements in regulated industries.
 */

const { v4: uuidv4 } = require('uuid');

class CitationTracker {
  constructor(options = {}) {
    this.citations = new Map();
    this.documentCitations = new Map(); // documentId -> citation[]
    this.fieldCitations = new Map();    // fieldName -> citation[]
    this.requireCitations = options.requireCitations ?? false;
    this.minCitations = options.minCitations ?? 0;
    this.validateSources = options.validateSources ?? true;
    this.sourceDocuments = new Map();   // sourceId -> document info
  }

  /**
   * Add a citation
   */
  add(citation) {
    const citationId = citation.id || uuidv4();
    
    const normalizedCitation = {
      id: citationId,
      text: citation.text,
      sourceDocument: citation.sourceDocument || citation.documentId,
      startOffset: citation.startOffset,
      endOffset: citation.endOffset,
      chunkIndex: citation.chunkIndex,
      pageNumber: citation.pageNumber,
      sectionId: citation.sectionId,
      fieldName: citation.fieldName,
      extractionId: citation.extractionId,
      confidence: citation.confidence ?? 1.0,
      reasoning: citation.reasoning,
      createdAt: new Date().toISOString(),
      metadata: citation.metadata || {}
    };

    this.citations.set(citationId, normalizedCitation);

    // Index by document
    if (normalizedCitation.extractionId) {
      if (!this.documentCitations.has(normalizedCitation.extractionId)) {
        this.documentCitations.set(normalizedCitation.extractionId, []);
      }
      this.documentCitations.get(normalizedCitation.extractionId).push(citationId);
    }

    // Index by field
    if (normalizedCitation.fieldName) {
      if (!this.fieldCitations.has(normalizedCitation.fieldName)) {
        this.fieldCitations.set(normalizedCitation.fieldName, []);
      }
      this.fieldCitations.get(normalizedCitation.fieldName).push(citationId);
    }

    return citationId;
  }

  /**
   * Add multiple citations
   */
  addBatch(citations) {
    return citations.map(c => this.add(c));
  }

  /**
   * Get a citation by ID
   */
  get(citationId) {
    return this.citations.get(citationId);
  }

  /**
   * Get all citations for a document/extraction
   */
  getForDocument(extractionId) {
    const citationIds = this.documentCitations.get(extractionId) || [];
    return citationIds.map(id => this.citations.get(id));
  }

  /**
   * Get all citations for a field
   */
  getForField(fieldName) {
    const citationIds = this.fieldCitations.get(fieldName) || [];
    return citationIds.map(id => this.citations.get(id));
  }

  /**
   * Register a source document
   */
  registerSource(sourceId, sourceInfo) {
    this.sourceDocuments.set(sourceId, {
      id: sourceId,
      name: sourceInfo.name,
      type: sourceInfo.type,
      path: sourceInfo.path,
      hash: sourceInfo.hash,
      version: sourceInfo.version,
      registeredAt: new Date().toISOString(),
      metadata: sourceInfo.metadata || {}
    });
    return sourceId;
  }

  /**
   * Validate citations against requirements
   */
  validate(extractionId, options = {}) {
    const citations = this.getForDocument(extractionId);
    const errors = [];
    const warnings = [];

    // Check minimum citations requirement
    const minRequired = options.minCitations ?? this.minCitations;
    if (citations.length < minRequired) {
      errors.push({
        code: 'INSUFFICIENT_CITATIONS',
        message: `Found ${citations.length} citations, minimum required is ${minRequired}`,
        required: minRequired,
        found: citations.length
      });
    }

    // Check that required fields have citations
    if (options.requiredFields?.length) {
      for (const field of options.requiredFields) {
        const fieldCitations = citations.filter(c => c.fieldName === field);
        if (fieldCitations.length === 0) {
          errors.push({
            code: 'MISSING_FIELD_CITATION',
            message: `No citation found for required field: ${field}`,
            field
          });
        }
      }
    }

    // Validate source document references
    if (this.validateSources) {
      for (const citation of citations) {
        if (citation.sourceDocument && !this.sourceDocuments.has(citation.sourceDocument)) {
          warnings.push({
            code: 'UNREGISTERED_SOURCE',
            message: `Citation references unregistered source: ${citation.sourceDocument}`,
            citationId: citation.id,
            sourceDocument: citation.sourceDocument
          });
        }
      }
    }

    // Check citation confidence
    const lowConfidenceCitations = citations.filter(
      c => c.confidence < (options.confidenceThreshold ?? 0.7)
    );
    if (lowConfidenceCitations.length > 0) {
      warnings.push({
        code: 'LOW_CONFIDENCE_CITATIONS',
        message: `${lowConfidenceCitations.length} citation(s) have low confidence`,
        citations: lowConfidenceCitations.map(c => ({
          id: c.id,
          field: c.fieldName,
          confidence: c.confidence
        }))
      });
    }

    return {
      valid: errors.length === 0,
      citationCount: citations.length,
      errors,
      warnings,
      summary: errors.length === 0 
        ? `Valid: ${citations.length} citation(s) verified`
        : `Invalid: ${errors.length} error(s) found`
    };
  }

  /**
   * Generate citation report for audit
   */
  generateReport(extractionId, options = {}) {
    const citations = this.getForDocument(extractionId);
    const format = options.format || 'json';

    const report = {
      extractionId,
      generatedAt: new Date().toISOString(),
      totalCitations: citations.length,
      citations: citations.map(c => ({
        id: c.id,
        field: c.fieldName,
        text: c.text,
        source: c.sourceDocument,
        location: {
          startOffset: c.startOffset,
          endOffset: c.endOffset,
          pageNumber: c.pageNumber,
          sectionId: c.sectionId
        },
        confidence: c.confidence,
        reasoning: c.reasoning
      })),
      byField: this._groupByField(citations),
      bySource: this._groupBySource(citations),
      validation: this.validate(extractionId)
    };

    if (format === 'text') {
      return this._formatReportAsText(report);
    }

    return report;
  }

  /**
   * Create a citation chain (for nested references)
   */
  createChain(citationIds) {
    const chainId = uuidv4();
    const citations = citationIds.map(id => this.citations.get(id)).filter(Boolean);

    if (citations.length === 0) {
      throw new Error('No valid citations found for chain');
    }

    return {
      chainId,
      citations: citationIds,
      depth: citations.length,
      rootCitation: citations[0],
      leafCitation: citations[citations.length - 1],
      path: citations.map(c => ({
        id: c.id,
        text: c.text?.substring(0, 100),
        source: c.sourceDocument
      }))
    };
  }

  /**
   * Find citations by text content
   */
  search(query, options = {}) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const citation of this.citations.values()) {
      if (citation.text?.toLowerCase().includes(queryLower)) {
        results.push({
          ...citation,
          matchScore: this._calculateMatchScore(citation.text, query)
        });
      }
    }

    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, options.limit || 50);
  }

  /**
   * Export all citations
   */
  export(options = {}) {
    const citations = Array.from(this.citations.values());
    
    if (options.extractionId) {
      return citations.filter(c => c.extractionId === options.extractionId);
    }

    if (options.fieldName) {
      return citations.filter(c => c.fieldName === options.fieldName);
    }

    return citations;
  }

  /**
   * Import citations from export
   */
  import(citations) {
    let imported = 0;
    for (const citation of citations) {
      this.add(citation);
      imported++;
    }
    return { imported };
  }

  /**
   * Clear all citations
   */
  clear() {
    this.citations.clear();
    this.documentCitations.clear();
    this.fieldCitations.clear();
    this.sourceDocuments.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    const citations = Array.from(this.citations.values());
    
    return {
      totalCitations: citations.length,
      documentsWithCitations: this.documentCitations.size,
      fieldsWithCitations: this.fieldCitations.size,
      sourcesRegistered: this.sourceDocuments.size,
      averageConfidence: citations.length > 0
        ? citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length
        : 0,
      citationsPerDocument: this.documentCitations.size > 0
        ? citations.length / this.documentCitations.size
        : 0
    };
  }

  /**
   * Group citations by field
   */
  _groupByField(citations) {
    const grouped = {};
    for (const citation of citations) {
      const field = citation.fieldName || '_unassigned';
      if (!grouped[field]) {
        grouped[field] = [];
      }
      grouped[field].push(citation.id);
    }
    return grouped;
  }

  /**
   * Group citations by source
   */
  _groupBySource(citations) {
    const grouped = {};
    for (const citation of citations) {
      const source = citation.sourceDocument || '_unknown';
      if (!grouped[source]) {
        grouped[source] = [];
      }
      grouped[source].push(citation.id);
    }
    return grouped;
  }

  /**
   * Calculate text match score
   */
  _calculateMatchScore(text, query) {
    if (!text) return 0;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match
    if (textLower === queryLower) return 1.0;
    
    // Contains match
    if (textLower.includes(queryLower)) {
      return 0.7 + (queryLower.length / textLower.length) * 0.3;
    }
    
    return 0;
  }

  /**
   * Format report as text
   */
  _formatReportAsText(report) {
    const lines = [
      'CITATION REPORT',
      '===============',
      `Extraction ID: ${report.extractionId}`,
      `Generated: ${report.generatedAt}`,
      `Total Citations: ${report.totalCitations}`,
      '',
      'CITATIONS',
      '---------'
    ];

    for (const citation of report.citations) {
      lines.push('');
      lines.push(`[${citation.id}]`);
      lines.push(`  Field: ${citation.field}`);
      lines.push(`  Text: "${citation.text?.substring(0, 100)}..."`);
      lines.push(`  Source: ${citation.source}`);
      lines.push(`  Confidence: ${(citation.confidence * 100).toFixed(0)}%`);
      if (citation.reasoning) {
        lines.push(`  Reasoning: ${citation.reasoning}`);
      }
    }

    lines.push('');
    lines.push('VALIDATION');
    lines.push('----------');
    lines.push(`Status: ${report.validation.valid ? 'VALID' : 'INVALID'}`);
    lines.push(report.validation.summary);

    return lines.join('\n');
  }
}

module.exports = { CitationTracker };
