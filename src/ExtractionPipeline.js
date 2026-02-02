/**
 * ExtractionPipeline - End-to-end document processing pipeline
 * 
 * Orchestrates the full extraction workflow: parse → extract → validate → register
 * with support for human-in-the-loop and audit trails.
 */

const { v4: uuidv4 } = require('uuid');
const { SchemaExtractor } = require('./SchemaExtractor');
const { DocumentRegister } = require('./DocumentRegister');
const { ValidationEngine } = require('./ValidationEngine');
const { CitationTracker } = require('./CitationTracker');

class ExtractionPipeline {
  constructor(options = {}) {
    this.name = options.name || 'default-pipeline';
    this.schema = options.schema || null;
    this.extractor = options.extractor || new SchemaExtractor(options.extractorOptions || {});
    this.register = options.register || new DocumentRegister(options.registerOptions || {});
    this.validator = options.validator || new ValidationEngine(options.validatorOptions || {});
    this.citationTracker = options.citationTracker || new CitationTracker(options.citationOptions || {});
    
    // Pipeline configuration
    this.config = {
      autoValidate: options.autoValidate ?? true,
      autoRegister: options.autoRegister ?? true,
      requireHumanApproval: options.requireHumanApproval ?? false,
      confidenceThreshold: options.confidenceThreshold ?? 0.8,
      validationThreshold: options.validationThreshold ?? 1.0, // All fields must pass
      enableCitations: options.enableCitations ?? true,
      retryOnFailure: options.retryOnFailure ?? true,
      maxRetries: options.maxRetries ?? 3
    };

    // Pipeline state
    this.pendingApprovals = new Map();
    this.processingHistory = [];
    
    // Event handlers
    this.handlers = {
      onExtractionComplete: options.onExtractionComplete || null,
      onValidationComplete: options.onValidationComplete || null,
      onApprovalRequired: options.onApprovalRequired || null,
      onRegistered: options.onRegistered || null,
      onError: options.onError || null
    };
  }

  /**
   * Set the extraction schema
   */
  setSchema(schema) {
    this.schema = schema;
    this.extractor.setSchema(schema);
    return this;
  }

  /**
   * Set the LLM provider for AI-based extraction
   */
  setLLMProvider(provider) {
    this.extractor.setLLMProvider(provider);
    return this;
  }

  /**
   * Process a document through the full pipeline
   */
  async process(document, options = {}) {
    const pipelineRunId = uuidv4();
    const startTime = Date.now();
    const results = {
      pipelineRunId,
      pipelineName: this.name,
      status: 'processing',
      stages: {},
      startedAt: new Date().toISOString()
    };

    try {
      // Stage 1: Extraction
      results.stages.extraction = await this._runExtraction(document, options);
      
      if (this.handlers.onExtractionComplete) {
        await this.handlers.onExtractionComplete(results.stages.extraction);
      }

      // Stage 2: Validation
      if (this.config.autoValidate) {
        results.stages.validation = await this._runValidation(
          results.stages.extraction.data,
          options
        );

        if (this.handlers.onValidationComplete) {
          await this.handlers.onValidationComplete(results.stages.validation);
        }

        // Check if validation passed
        if (!results.stages.validation.valid && this.config.validationThreshold === 1.0) {
          results.status = 'validation_failed';
          results.error = 'Validation failed';
          return this._finalizeResults(results, startTime);
        }
      }

      // Stage 3: Human approval (if required)
      const needsApproval = this._requiresApproval(results);
      
      if (needsApproval) {
        results.stages.approval = {
          status: 'pending',
          reason: this._getApprovalReason(results),
          requestedAt: new Date().toISOString()
        };

        // Store in pending approvals
        this.pendingApprovals.set(pipelineRunId, {
          results,
          document,
          options,
          requestedAt: new Date()
        });

        if (this.handlers.onApprovalRequired) {
          await this.handlers.onApprovalRequired({
            pipelineRunId,
            reason: results.stages.approval.reason,
            extractionResult: results.stages.extraction,
            validationResult: results.stages.validation
          });
        }

        results.status = 'awaiting_approval';
        return this._finalizeResults(results, startTime);
      }

      // Stage 4: Registration
      if (this.config.autoRegister) {
        results.stages.registration = await this._runRegistration(
          results.stages.extraction,
          options
        );

        if (this.handlers.onRegistered) {
          await this.handlers.onRegistered(results.stages.registration);
        }
      }

      results.status = 'completed';
      
    } catch (error) {
      results.status = 'error';
      results.error = error.message;
      results.errorStack = error.stack;

      if (this.handlers.onError) {
        await this.handlers.onError(error, results);
      }
    }

    return this._finalizeResults(results, startTime);
  }

  /**
   * Process multiple documents
   */
  async processBatch(documents, options = {}) {
    const batchId = uuidv4();
    const results = {
      batchId,
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      results: [],
      summary: {}
    };

    const concurrency = options.concurrency || 3;

    // Process in batches for controlled concurrency
    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((doc, idx) =>
          this.process(doc, options)
            .then(result => ({ index: i + idx, result }))
            .catch(error => ({ index: i + idx, error: error.message }))
        )
      );
      results.results.push(...batchResults);

      // Progress callback
      if (options.onProgress) {
        options.onProgress({
          processed: Math.min(i + concurrency, documents.length),
          total: documents.length,
          percentage: Math.round((Math.min(i + concurrency, documents.length) / documents.length) * 100)
        });
      }
    }

    // Calculate summary
    results.summary = {
      completed: results.results.filter(r => r.result?.status === 'completed').length,
      awaitingApproval: results.results.filter(r => r.result?.status === 'awaiting_approval').length,
      validationFailed: results.results.filter(r => r.result?.status === 'validation_failed').length,
      errors: results.results.filter(r => r.error || r.result?.status === 'error').length
    };

    return results;
  }

  /**
   * Approve a pending extraction
   */
  async approve(pipelineRunId, options = {}) {
    const pending = this.pendingApprovals.get(pipelineRunId);
    if (!pending) {
      throw new Error(`No pending approval found for: ${pipelineRunId}`);
    }

    const { results, options: originalOptions } = pending;

    // Update approval stage
    results.stages.approval = {
      status: 'approved',
      approvedBy: options.approvedBy,
      approvedAt: new Date().toISOString(),
      comments: options.comments
    };

    // Run registration
    if (this.config.autoRegister) {
      results.stages.registration = await this._runRegistration(
        results.stages.extraction,
        { ...originalOptions, ...options }
      );

      if (this.handlers.onRegistered) {
        await this.handlers.onRegistered(results.stages.registration);
      }
    }

    results.status = 'completed';
    this.pendingApprovals.delete(pipelineRunId);

    // Update processing history
    this._recordHistory(results);

    return results;
  }

  /**
   * Reject a pending extraction
   */
  async reject(pipelineRunId, options = {}) {
    const pending = this.pendingApprovals.get(pipelineRunId);
    if (!pending) {
      throw new Error(`No pending approval found for: ${pipelineRunId}`);
    }

    const { results } = pending;

    results.stages.approval = {
      status: 'rejected',
      rejectedBy: options.rejectedBy,
      rejectedAt: new Date().toISOString(),
      reason: options.reason,
      comments: options.comments
    };

    results.status = 'rejected';
    this.pendingApprovals.delete(pipelineRunId);

    this._recordHistory(results);

    return results;
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals() {
    return Array.from(this.pendingApprovals.entries()).map(([id, data]) => ({
      pipelineRunId: id,
      requestedAt: data.requestedAt,
      extractionConfidence: data.results.stages.extraction?.confidence,
      validationStatus: data.results.stages.validation?.valid
    }));
  }

  /**
   * Run extraction stage
   */
  async _runExtraction(document, options) {
    const schema = options.schema || this.schema;
    if (!schema) {
      throw new Error('No schema defined for extraction');
    }

    this.extractor.setSchema(schema);
    
    const result = await this.extractor.extract(document, options);

    // Track citations
    if (this.config.enableCitations && result.citations?.length) {
      this.citationTracker.addBatch(result.citations);
    }

    return result;
  }

  /**
   * Run validation stage
   */
  async _runValidation(data, options) {
    const schema = options.schema || this.schema;
    return this.validator.validate(data, schema, options.validationOptions || {});
  }

  /**
   * Run registration stage
   */
  async _runRegistration(extractionResult, options) {
    const registerResult = await this.register.add(extractionResult, {
      source: options.source,
      category: options.category,
      tags: options.tags,
      effectiveFrom: options.effectiveFrom,
      userId: options.userId || options.approvedBy,
      metadata: {
        extractionId: extractionResult.extractionId,
        confidence: extractionResult.confidence,
        validatedAt: new Date().toISOString(),
        ...options.metadata
      }
    });

    return {
      ...registerResult,
      registeredAt: new Date().toISOString()
    };
  }

  /**
   * Check if results require human approval
   */
  _requiresApproval(results) {
    if (!this.config.requireHumanApproval) {
      return false;
    }

    // Low extraction confidence
    if (results.stages.extraction?.confidence < this.config.confidenceThreshold) {
      return true;
    }

    // Validation warnings or low confidence
    if (results.stages.validation) {
      if (results.stages.validation.warnings?.length > 0) {
        return true;
      }
      if (results.stages.validation.confidence < this.config.validationThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get reason for requiring approval
   */
  _getApprovalReason(results) {
    const reasons = [];

    if (results.stages.extraction?.confidence < this.config.confidenceThreshold) {
      reasons.push(`Low extraction confidence: ${(results.stages.extraction.confidence * 100).toFixed(0)}%`);
    }

    if (results.stages.validation?.warnings?.length > 0) {
      reasons.push(`Validation warnings: ${results.stages.validation.warnings.length}`);
    }

    if (results.stages.validation?.confidence < this.config.validationThreshold) {
      reasons.push(`Low validation confidence: ${(results.stages.validation.confidence * 100).toFixed(0)}%`);
    }

    return reasons.join('; ') || 'Manual review required';
  }

  /**
   * Finalize results
   */
  _finalizeResults(results, startTime) {
    results.completedAt = new Date().toISOString();
    results.durationMs = Date.now() - startTime;

    this._recordHistory(results);

    return results;
  }

  /**
   * Record processing history
   */
  _recordHistory(results) {
    this.processingHistory.push({
      pipelineRunId: results.pipelineRunId,
      status: results.status,
      timestamp: results.completedAt || new Date().toISOString(),
      durationMs: results.durationMs
    });

    // Keep only last 1000 entries
    if (this.processingHistory.length > 1000) {
      this.processingHistory = this.processingHistory.slice(-1000);
    }
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    const total = this.processingHistory.length;
    const completed = this.processingHistory.filter(h => h.status === 'completed').length;
    const failed = this.processingHistory.filter(h => h.status === 'error' || h.status === 'validation_failed').length;
    const avgDuration = total > 0
      ? this.processingHistory.reduce((sum, h) => sum + (h.durationMs || 0), 0) / total
      : 0;

    return {
      pipelineName: this.name,
      totalProcessed: total,
      completed,
      failed,
      pendingApprovals: this.pendingApprovals.size,
      successRate: total > 0 ? (completed / total * 100).toFixed(1) + '%' : 'N/A',
      averageDurationMs: Math.round(avgDuration),
      citationStats: this.citationTracker.getStats()
    };
  }

  /**
   * Create a pipeline report
   */
  generateReport(options = {}) {
    const stats = this.getStats();
    const format = options.format || 'json';

    const report = {
      pipelineName: this.name,
      generatedAt: new Date().toISOString(),
      configuration: this.config,
      statistics: stats,
      pendingApprovals: this.getPendingApprovals(),
      recentHistory: this.processingHistory.slice(-options.historyLimit || 50)
    };

    if (format === 'text') {
      return this._formatReportAsText(report);
    }

    return report;
  }

  /**
   * Format report as text
   */
  _formatReportAsText(report) {
    return [
      `PIPELINE REPORT: ${report.pipelineName}`,
      `Generated: ${report.generatedAt}`,
      '',
      'STATISTICS',
      `  Total Processed: ${report.statistics.totalProcessed}`,
      `  Completed: ${report.statistics.completed}`,
      `  Failed: ${report.statistics.failed}`,
      `  Success Rate: ${report.statistics.successRate}`,
      `  Avg Duration: ${report.statistics.averageDurationMs}ms`,
      `  Pending Approvals: ${report.statistics.pendingApprovals}`,
      '',
      'CONFIGURATION',
      `  Auto Validate: ${report.configuration.autoValidate}`,
      `  Auto Register: ${report.configuration.autoRegister}`,
      `  Require Human Approval: ${report.configuration.requireHumanApproval}`,
      `  Confidence Threshold: ${report.configuration.confidenceThreshold}`
    ].join('\n');
  }
}

module.exports = { ExtractionPipeline };
