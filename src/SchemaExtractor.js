/**
 * SchemaExtractor - Core extraction engine
 * 
 * Extracts structured data from documents using defined schemas.
 * Supports LLM-based extraction with citation tracking.
 */

const { v4: uuidv4 } = require('uuid');
const { CitationTracker } = require('./CitationTracker');

class SchemaExtractor {
  constructor(options = {}) {
    this.schema = options.schema || null;
    this.llmProvider = options.llmProvider || null;
    this.citationTracker = new CitationTracker(options.citations || {});
    this.extractionOptions = {
      preserveSourceLocation: options.preserveSourceLocation ?? true,
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
      maxRetries: options.maxRetries ?? 3,
      includeRawText: options.includeRawText ?? false,
      chunkSize: options.chunkSize ?? 4000,
      chunkOverlap: options.chunkOverlap ?? 200,
      ...options.extractionOptions
    };
    this.hooks = {
      beforeExtraction: options.beforeExtraction || null,
      afterExtraction: options.afterExtraction || null,
      onFieldExtracted: options.onFieldExtracted || null,
      onValidationError: options.onValidationError || null
    };
  }

  /**
   * Set the schema for extraction
   */
  setSchema(schema) {
    this.schema = schema;
    return this;
  }

  /**
   * Set the LLM provider for AI-based extraction
   */
  setLLMProvider(provider) {
    this.llmProvider = provider;
    return this;
  }

  /**
   * Extract structured data from a document
   */
  async extract(document, options = {}) {
    const extractionId = uuidv4();
    const startTime = Date.now();
    const mergedOptions = { ...this.extractionOptions, ...options };
    const schema = options.schema || this.schema;

    if (!schema) {
      throw new Error('No schema defined. Use setSchema() or pass schema in options.');
    }

    // Pre-extraction hook
    if (this.hooks.beforeExtraction) {
      await this.hooks.beforeExtraction({ document, schema, extractionId });
    }

    // Parse document into processable chunks
    const chunks = this._chunkDocument(document, mergedOptions);
    
    // Extract fields according to schema
    const extractedData = {};
    const citations = [];
    const fieldConfidences = {};
    const errors = [];

    for (const field of schema.fields) {
      try {
        const result = await this._extractField(field, chunks, schema, mergedOptions);
        extractedData[field.name] = result.value;
        fieldConfidences[field.name] = result.confidence;
        
        if (result.citations?.length > 0) {
          citations.push(...result.citations.map(c => ({
            ...c,
            fieldName: field.name,
            extractionId
          })));
        }

        // Field extraction hook
        if (this.hooks.onFieldExtracted) {
          await this.hooks.onFieldExtracted({
            field,
            value: result.value,
            confidence: result.confidence,
            citations: result.citations
          });
        }
      } catch (error) {
        errors.push({
          field: field.name,
          error: error.message,
          code: error.code || 'EXTRACTION_ERROR'
        });

        if (this.hooks.onValidationError) {
          await this.hooks.onValidationError({ field, error });
        }

        // Use default value if available
        if (field.defaultValue !== undefined) {
          extractedData[field.name] = field.defaultValue;
          fieldConfidences[field.name] = 0;
        }
      }
    }

    // Track citations
    for (const citation of citations) {
      this.citationTracker.add(citation);
    }

    const result = {
      extractionId,
      schemaId: schema.id,
      schemaVersion: schema.version,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      data: extractedData,
      confidence: this._calculateOverallConfidence(fieldConfidences),
      fieldConfidences,
      citations,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        documentLength: typeof document === 'string' ? document.length : JSON.stringify(document).length,
        chunksProcessed: chunks.length,
        fieldsExtracted: Object.keys(extractedData).length,
        fieldsWithErrors: errors.length
      }
    };

    // Post-extraction hook
    if (this.hooks.afterExtraction) {
      await this.hooks.afterExtraction(result);
    }

    return result;
  }

  /**
   * Extract with human-in-the-loop validation
   */
  async extractWithValidation(document, options = {}) {
    const result = await this.extract(document, options);
    
    return {
      ...result,
      validationStatus: 'pending',
      validationRequired: result.confidence < (options.autoApproveThreshold || 0.9),
      fieldsRequiringReview: Object.entries(result.fieldConfidences)
        .filter(([_, conf]) => conf < (options.fieldReviewThreshold || 0.8))
        .map(([field, confidence]) => ({ field, confidence }))
    };
  }

  /**
   * Batch extract from multiple documents
   */
  async extractBatch(documents, options = {}) {
    const results = [];
    const batchId = uuidv4();
    const concurrency = options.concurrency || 3;

    // Process in batches for controlled concurrency
    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map((doc, idx) => 
          this.extract(doc, options)
            .then(result => ({ ...result, batchIndex: i + idx }))
            .catch(error => ({
              batchIndex: i + idx,
              error: error.message,
              success: false
            }))
        )
      );
      results.push(...batchResults);
    }

    return {
      batchId,
      timestamp: new Date().toISOString(),
      totalDocuments: documents.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      averageConfidence: this._average(results.filter(r => r.confidence).map(r => r.confidence)),
      results
    };
  }

  /**
   * Chunk document for processing
   */
  _chunkDocument(document, options) {
    const text = typeof document === 'string' 
      ? document 
      : document.text || JSON.stringify(document);
    
    const chunks = [];
    const { chunkSize, chunkOverlap } = options;
    
    // Split by paragraphs first to preserve semantic boundaries
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let currentStart = 0;
    let charIndex = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          startOffset: currentStart,
          endOffset: charIndex - 1,
          index: chunks.length
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + '\n\n' + paragraph;
        currentStart = charIndex - chunkOverlap;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
      charIndex += paragraph.length + 2; // +2 for \n\n
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        startOffset: currentStart,
        endOffset: charIndex,
        index: chunks.length
      });
    }

    return chunks;
  }

  /**
   * Extract a single field from chunks
   */
  async _extractField(field, chunks, schema, options) {
    // Use LLM if available, otherwise fall back to pattern matching
    if (this.llmProvider) {
      return this._extractFieldWithLLM(field, chunks, schema, options);
    }
    return this._extractFieldWithPatterns(field, chunks, options);
  }

  /**
   * Extract field using LLM
   */
  async _extractFieldWithLLM(field, chunks, schema, options) {
    const prompt = this._buildExtractionPrompt(field, chunks, schema);
    
    let response;
    let retries = 0;
    
    while (retries < options.maxRetries) {
      try {
        response = await this.llmProvider(prompt);
        break;
      } catch (error) {
        retries++;
        if (retries >= options.maxRetries) throw error;
        await this._sleep(1000 * retries); // Exponential backoff
      }
    }

    // Parse LLM response
    const parsed = this._parseLLMResponse(response, field);
    
    return {
      value: parsed.value,
      confidence: parsed.confidence || 0.8,
      citations: parsed.citations || [],
      rawResponse: options.includeRawText ? response : undefined
    };
  }

  /**
   * Extract field using pattern matching (fallback)
   */
  _extractFieldWithPatterns(field, chunks, options) {
    const patterns = field.patterns || [];
    const citations = [];
    let bestMatch = null;
    let bestConfidence = 0;

    for (const chunk of chunks) {
      for (const pattern of patterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        const matches = chunk.text.matchAll(regex);
        
        for (const match of matches) {
          const confidence = this._calculatePatternConfidence(match, field);
          if (confidence > bestConfidence) {
            bestMatch = this._extractValueFromMatch(match, field);
            bestConfidence = confidence;
            citations.push({
              text: match[0],
              startOffset: chunk.startOffset + match.index,
              endOffset: chunk.startOffset + match.index + match[0].length,
              chunkIndex: chunk.index,
              confidence
            });
          }
        }
      }
    }

    return {
      value: bestMatch ?? field.defaultValue,
      confidence: bestConfidence,
      citations
    };
  }

  /**
   * Build extraction prompt for LLM
   */
  _buildExtractionPrompt(field, chunks, schema) {
    const contextText = chunks.map(c => c.text).join('\n\n---\n\n');
    
    return {
      system: `You are a document extraction assistant specializing in extracting structured data from regulatory and legal documents. 
Extract the requested field with precision. Always cite the exact source text.
Return JSON with: { "value": <extracted value>, "confidence": <0-1>, "sourceText": "<exact quoted text>", "reasoning": "<brief explanation>" }`,
      
      user: `Schema: ${schema.name} (v${schema.version})
Field to extract: ${field.name}
Description: ${field.description || 'No description'}
Type: ${field.type}
${field.enum ? `Valid values: ${field.enum.join(', ')}` : ''}
${field.format ? `Format: ${field.format}` : ''}

Document text:
"""
${contextText}
"""

Extract the "${field.name}" field. If not found, return null for value.`
    };
  }

  /**
   * Parse LLM response into structured format
   */
  _parseLLMResponse(response, field) {
    try {
      // Handle both string and object responses
      const parsed = typeof response === 'string' 
        ? JSON.parse(response) 
        : response;
      
      // Type coercion based on field type
      let value = parsed.value;
      if (value !== null && value !== undefined) {
        value = this._coerceType(value, field.type);
      }

      return {
        value,
        confidence: parsed.confidence || 0.8,
        citations: parsed.sourceText ? [{
          text: parsed.sourceText,
          reasoning: parsed.reasoning
        }] : []
      };
    } catch {
      // If JSON parse fails, try to extract value directly
      return {
        value: this._coerceType(response, field.type),
        confidence: 0.5,
        citations: []
      };
    }
  }

  /**
   * Coerce value to expected type
   */
  _coerceType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
      case 'integer':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return value;
    }
  }

  /**
   * Calculate pattern match confidence
   */
  _calculatePatternConfidence(match, field) {
    let confidence = 0.6; // Base confidence for pattern match
    
    // Boost for longer matches (more context)
    if (match[0].length > 50) confidence += 0.1;
    
    // Boost for capture groups
    if (match.length > 1) confidence += 0.1;
    
    // Boost if matches expected format
    if (field.format && this._matchesFormat(match[1] || match[0], field.format)) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1);
  }

  /**
   * Extract value from regex match
   */
  _extractValueFromMatch(match, field) {
    // Use first capture group if available, otherwise full match
    const rawValue = match[1] || match[0];
    return this._coerceType(rawValue.trim(), field.type);
  }

  /**
   * Check if value matches expected format
   */
  _matchesFormat(value, format) {
    const formats = {
      'date': /^\d{4}-\d{2}-\d{2}$/,
      'datetime': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
      'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'currency': /^[\$£€]?\d+([,.]\d{2})?$/,
      'percentage': /^\d+(\.\d+)?%?$/
    };
    return formats[format]?.test(value) ?? true;
  }

  /**
   * Calculate overall confidence from field confidences
   */
  _calculateOverallConfidence(fieldConfidences) {
    const values = Object.values(fieldConfidences);
    if (values.length === 0) return 0;
    return this._average(values);
  }

  /**
   * Calculate average of numbers
   */
  _average(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { SchemaExtractor };
