/**
 * DocumentRegister - Version-controlled document storage
 * 
 * Maintains a register of extracted documents with full version history,
 * effective dates, and audit trails for regulatory compliance.
 */

const { v4: uuidv4 } = require('uuid');

class DocumentRegister {
  constructor(options = {}) {
    this.storage = options.storage || new Map();
    this.name = options.name || 'default';
    this.schemaId = options.schemaId || null;
    this.enableVersioning = options.enableVersioning ?? true;
    this.enableAuditLog = options.enableAuditLog ?? true;
    this.retentionPolicy = options.retentionPolicy || null;
    this.auditLog = [];
    this.indexes = new Map(); // Field-based indexes for fast lookup
  }

  /**
   * Add a document to the register
   */
  async add(document, options = {}) {
    const entryId = options.id || uuidv4();
    const version = 1;
    const now = new Date().toISOString();

    const entry = {
      id: entryId,
      version,
      createdAt: now,
      updatedAt: now,
      effectiveFrom: options.effectiveFrom || now,
      effectiveTo: options.effectiveTo || null,
      status: options.status || 'active',
      data: document.data || document,
      metadata: {
        schemaId: document.schemaId || this.schemaId,
        schemaVersion: document.schemaVersion,
        extractionId: document.extractionId,
        confidence: document.confidence,
        source: options.source || null,
        tags: options.tags || [],
        category: options.category || null,
        ...options.metadata
      },
      citations: document.citations || [],
      history: []
    };

    // Store the entry
    if (this.storage instanceof Map) {
      this.storage.set(entryId, entry);
    } else {
      await this.storage.write(entryId, entry);
    }

    // Update indexes
    this._updateIndexes(entry);

    // Audit log
    if (this.enableAuditLog) {
      this._logAudit('ADD', entryId, {
        version,
        effectiveFrom: entry.effectiveFrom,
        userId: options.userId
      });
    }

    return {
      id: entryId,
      version,
      createdAt: now,
      status: 'created'
    };
  }

  /**
   * Update a document (creates new version)
   */
  async update(id, document, options = {}) {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }

    const now = new Date().toISOString();
    const newVersion = existing.version + 1;

    // Archive previous version in history
    const historyEntry = {
      version: existing.version,
      data: existing.data,
      metadata: existing.metadata,
      effectiveFrom: existing.effectiveFrom,
      effectiveTo: now,
      archivedAt: now
    };

    const updated = {
      ...existing,
      version: newVersion,
      updatedAt: now,
      effectiveFrom: options.effectiveFrom || now,
      effectiveTo: options.effectiveTo || null,
      data: document.data || document,
      metadata: {
        ...existing.metadata,
        schemaId: document.schemaId || existing.metadata.schemaId,
        schemaVersion: document.schemaVersion || existing.metadata.schemaVersion,
        extractionId: document.extractionId,
        confidence: document.confidence,
        ...options.metadata
      },
      citations: document.citations || existing.citations,
      history: this.enableVersioning 
        ? [...existing.history, historyEntry]
        : []
    };

    // Store updated entry
    if (this.storage instanceof Map) {
      this.storage.set(id, updated);
    } else {
      await this.storage.write(id, updated);
    }

    // Update indexes
    this._updateIndexes(updated);

    // Audit log
    if (this.enableAuditLog) {
      this._logAudit('UPDATE', id, {
        previousVersion: existing.version,
        newVersion,
        effectiveFrom: updated.effectiveFrom,
        userId: options.userId,
        changeReason: options.changeReason
      });
    }

    return {
      id,
      version: newVersion,
      previousVersion: existing.version,
      updatedAt: now,
      status: 'updated'
    };
  }

  /**
   * Get a document by ID
   */
  async get(id, options = {}) {
    let entry;
    
    if (this.storage instanceof Map) {
      entry = this.storage.get(id);
    } else {
      entry = await this.storage.read(id);
    }

    if (!entry) return null;

    // Return specific version if requested
    if (options.version && options.version !== entry.version) {
      const historicVersion = entry.history.find(h => h.version === options.version);
      if (historicVersion) {
        return {
          id: entry.id,
          version: historicVersion.version,
          data: historicVersion.data,
          metadata: historicVersion.metadata,
          effectiveFrom: historicVersion.effectiveFrom,
          effectiveTo: historicVersion.effectiveTo,
          isHistoric: true
        };
      }
      throw new Error(`Version ${options.version} not found for document ${id}`);
    }

    // Return version effective at specific date
    if (options.asOf) {
      const asOfDate = new Date(options.asOf);
      
      // Check if current version is valid
      const currentFrom = new Date(entry.effectiveFrom);
      const currentTo = entry.effectiveTo ? new Date(entry.effectiveTo) : null;
      
      if (currentFrom <= asOfDate && (!currentTo || currentTo > asOfDate)) {
        return entry;
      }

      // Search history
      for (const historicVersion of entry.history.reverse()) {
        const histFrom = new Date(historicVersion.effectiveFrom);
        const histTo = historicVersion.effectiveTo ? new Date(historicVersion.effectiveTo) : null;
        
        if (histFrom <= asOfDate && (!histTo || histTo > asOfDate)) {
          return {
            id: entry.id,
            version: historicVersion.version,
            data: historicVersion.data,
            metadata: historicVersion.metadata,
            effectiveFrom: historicVersion.effectiveFrom,
            effectiveTo: historicVersion.effectiveTo,
            isHistoric: true
          };
        }
      }
      
      return null; // No version effective at that date
    }

    return entry;
  }

  /**
   * List all documents with optional filtering
   */
  async list(options = {}) {
    let entries = [];
    
    if (this.storage instanceof Map) {
      entries = Array.from(this.storage.values());
    } else {
      entries = await this.storage.list();
    }

    // Apply filters
    if (options.status) {
      entries = entries.filter(e => e.status === options.status);
    }

    if (options.category) {
      entries = entries.filter(e => e.metadata?.category === options.category);
    }

    if (options.tags?.length) {
      entries = entries.filter(e => 
        options.tags.some(tag => e.metadata?.tags?.includes(tag))
      );
    }

    if (options.effectiveAt) {
      const date = new Date(options.effectiveAt);
      entries = entries.filter(e => {
        const from = new Date(e.effectiveFrom);
        const to = e.effectiveTo ? new Date(e.effectiveTo) : null;
        return from <= date && (!to || to > date);
      });
    }

    if (options.schemaId) {
      entries = entries.filter(e => e.metadata?.schemaId === options.schemaId);
    }

    // Sort
    const sortField = options.sortBy || 'updatedAt';
    const sortDir = options.sortDir || 'desc';
    entries.sort((a, b) => {
      const aVal = a[sortField] || a.metadata?.[sortField];
      const bVal = b[sortField] || b.metadata?.[sortField];
      return sortDir === 'asc' 
        ? (aVal > bVal ? 1 : -1)
        : (aVal < bVal ? 1 : -1);
    });

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    return {
      entries: entries.map(e => options.includeData ? e : {
        id: e.id,
        version: e.version,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        effectiveFrom: e.effectiveFrom,
        effectiveTo: e.effectiveTo,
        metadata: e.metadata
      }),
      total,
      offset,
      limit,
      hasMore: offset + limit < total
    };
  }

  /**
   * Search documents by field value
   */
  async search(query, options = {}) {
    let entries = [];
    
    if (this.storage instanceof Map) {
      entries = Array.from(this.storage.values());
    } else {
      entries = await this.storage.list();
    }

    const results = [];

    for (const entry of entries) {
      const matches = this._matchesQuery(entry.data, query);
      if (matches.matched) {
        results.push({
          ...entry,
          matchScore: matches.score,
          matchedFields: matches.fields
        });
      }
    }

    // Sort by match score
    results.sort((a, b) => b.matchScore - a.matchScore);

    return {
      results: results.slice(0, options.limit || 50),
      total: results.length,
      query
    };
  }

  /**
   * Get version history for a document
   */
  async getHistory(id) {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Document not found: ${id}`);
    }

    return {
      id,
      currentVersion: entry.version,
      versions: [
        // Current version
        {
          version: entry.version,
          effectiveFrom: entry.effectiveFrom,
          effectiveTo: entry.effectiveTo,
          updatedAt: entry.updatedAt,
          isCurrent: true
        },
        // Historic versions
        ...entry.history.map(h => ({
          version: h.version,
          effectiveFrom: h.effectiveFrom,
          effectiveTo: h.effectiveTo,
          archivedAt: h.archivedAt,
          isCurrent: false
        })).reverse()
      ]
    };
  }

  /**
   * Archive a document (soft delete)
   */
  async archive(id, options = {}) {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Document not found: ${id}`);
    }

    entry.status = 'archived';
    entry.archivedAt = new Date().toISOString();
    entry.archiveReason = options.reason;

    if (this.storage instanceof Map) {
      this.storage.set(id, entry);
    } else {
      await this.storage.write(id, entry);
    }

    if (this.enableAuditLog) {
      this._logAudit('ARCHIVE', id, {
        reason: options.reason,
        userId: options.userId
      });
    }

    return { id, status: 'archived', archivedAt: entry.archivedAt };
  }

  /**
   * Export register to JSON
   */
  async export(options = {}) {
    const list = await this.list({ ...options, includeData: true, limit: Infinity });
    
    return {
      registerName: this.name,
      schemaId: this.schemaId,
      exportedAt: new Date().toISOString(),
      totalEntries: list.total,
      entries: list.entries,
      auditLog: options.includeAuditLog ? this.auditLog : undefined
    };
  }

  /**
   * Import documents from JSON
   */
  async import(data, options = {}) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    for (const entry of data.entries || data) {
      try {
        if (options.skipExisting && await this.get(entry.id)) {
          results.skipped++;
          continue;
        }

        await this.add(entry.data || entry, {
          id: entry.id,
          effectiveFrom: entry.effectiveFrom,
          effectiveTo: entry.effectiveTo,
          status: entry.status,
          metadata: entry.metadata,
          source: 'import'
        });
        results.imported++;
      } catch (error) {
        results.errors.push({ id: entry.id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get audit log entries
   */
  getAuditLog(options = {}) {
    let logs = [...this.auditLog];

    if (options.documentId) {
      logs = logs.filter(l => l.documentId === options.documentId);
    }

    if (options.action) {
      logs = logs.filter(l => l.action === options.action);
    }

    if (options.since) {
      const since = new Date(options.since);
      logs = logs.filter(l => new Date(l.timestamp) >= since);
    }

    return logs.slice(-(options.limit || 1000));
  }

  /**
   * Update indexes for fast lookup
   */
  _updateIndexes(entry) {
    // Index by category
    if (entry.metadata?.category) {
      if (!this.indexes.has('category')) {
        this.indexes.set('category', new Map());
      }
      const categoryIndex = this.indexes.get('category');
      if (!categoryIndex.has(entry.metadata.category)) {
        categoryIndex.set(entry.metadata.category, new Set());
      }
      categoryIndex.get(entry.metadata.category).add(entry.id);
    }

    // Index by tags
    if (entry.metadata?.tags?.length) {
      if (!this.indexes.has('tags')) {
        this.indexes.set('tags', new Map());
      }
      const tagIndex = this.indexes.get('tags');
      for (const tag of entry.metadata.tags) {
        if (!tagIndex.has(tag)) {
          tagIndex.set(tag, new Set());
        }
        tagIndex.get(tag).add(entry.id);
      }
    }
  }

  /**
   * Check if document matches search query
   */
  _matchesQuery(data, query) {
    const matches = { matched: false, score: 0, fields: [] };

    for (const [field, value] of Object.entries(query)) {
      const fieldValue = this._getNestedValue(data, field);
      
      if (fieldValue === undefined) continue;

      if (typeof value === 'object' && value !== null) {
        // Complex query operators
        if (value.$eq !== undefined && fieldValue === value.$eq) {
          matches.matched = true;
          matches.score += 1;
          matches.fields.push(field);
        }
        if (value.$contains !== undefined && String(fieldValue).includes(value.$contains)) {
          matches.matched = true;
          matches.score += 0.8;
          matches.fields.push(field);
        }
        if (value.$gt !== undefined && fieldValue > value.$gt) {
          matches.matched = true;
          matches.score += 0.7;
          matches.fields.push(field);
        }
        if (value.$lt !== undefined && fieldValue < value.$lt) {
          matches.matched = true;
          matches.score += 0.7;
          matches.fields.push(field);
        }
        if (value.$regex !== undefined) {
          const regex = new RegExp(value.$regex, value.$flags || 'i');
          if (regex.test(String(fieldValue))) {
            matches.matched = true;
            matches.score += 0.9;
            matches.fields.push(field);
          }
        }
      } else {
        // Simple equality
        if (fieldValue === value) {
          matches.matched = true;
          matches.score += 1;
          matches.fields.push(field);
        }
      }
    }

    return matches;
  }

  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  /**
   * Log audit entry
   */
  _logAudit(action, documentId, details = {}) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      documentId,
      ...details
    });
  }
}

module.exports = { DocumentRegister };
