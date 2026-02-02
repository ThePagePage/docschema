/**
 * DocumentComparator - Compare documents and versions
 * 
 * Compares extracted documents to identify differences, conflicts,
 * and changes over time. Essential for regulatory compliance.
 */

const { v4: uuidv4 } = require('uuid');

class DocumentComparator {
  constructor(options = {}) {
    this.ignoreFields = options.ignoreFields || ['extractionId', 'timestamp', 'durationMs'];
    this.significanceThreshold = options.significanceThreshold ?? 0.1;
    this.deepCompare = options.deepCompare ?? true;
  }

  /**
   * Compare two documents
   */
  compare(docA, docB, options = {}) {
    const comparisonId = uuidv4();
    const dataA = docA.data || docA;
    const dataB = docB.data || docB;
    
    const differences = [];
    const allFields = new Set([
      ...Object.keys(dataA),
      ...Object.keys(dataB)
    ]);

    for (const field of allFields) {
      if (this.ignoreFields.includes(field)) continue;

      const valueA = dataA[field];
      const valueB = dataB[field];
      const diff = this._compareValues(valueA, valueB, field, options);

      if (diff) {
        differences.push(diff);
      }
    }

    // Calculate overall change statistics
    const stats = this._calculateStats(differences, allFields.size);

    return {
      comparisonId,
      timestamp: new Date().toISOString(),
      documentA: {
        id: docA.id,
        version: docA.version,
        effectiveFrom: docA.effectiveFrom
      },
      documentB: {
        id: docB.id,
        version: docB.version,
        effectiveFrom: docB.effectiveFrom
      },
      identical: differences.length === 0,
      differences,
      statistics: stats,
      summary: this._generateSummary(differences, stats)
    };
  }

  /**
   * Compare multiple documents pairwise
   */
  compareMultiple(documents, options = {}) {
    const comparisons = [];
    
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        comparisons.push({
          pair: [i, j],
          comparison: this.compare(documents[i], documents[j], options)
        });
      }
    }

    // Find common differences across all pairs
    const commonDiffs = this._findCommonDifferences(comparisons);

    return {
      documentCount: documents.length,
      comparisonCount: comparisons.length,
      comparisons,
      commonDifferences: commonDiffs,
      allIdentical: comparisons.every(c => c.comparison.identical)
    };
  }

  /**
   * Compare document versions over time
   */
  compareVersions(documentWithHistory, options = {}) {
    const versions = [
      { version: documentWithHistory.version, data: documentWithHistory.data },
      ...(documentWithHistory.history || []).map(h => ({
        version: h.version,
        data: h.data,
        effectiveFrom: h.effectiveFrom,
        effectiveTo: h.effectiveTo
      }))
    ].sort((a, b) => a.version - b.version);

    const timeline = [];

    for (let i = 1; i < versions.length; i++) {
      const prev = versions[i - 1];
      const curr = versions[i];
      const comparison = this.compare(
        { data: prev.data, version: prev.version },
        { data: curr.data, version: curr.version },
        options
      );

      timeline.push({
        fromVersion: prev.version,
        toVersion: curr.version,
        effectiveFrom: curr.effectiveFrom,
        changes: comparison.differences,
        changeCount: comparison.differences.length,
        statistics: comparison.statistics
      });
    }

    return {
      documentId: documentWithHistory.id,
      versionCount: versions.length,
      timeline,
      totalChanges: timeline.reduce((sum, t) => sum + t.changeCount, 0),
      mostChangedFields: this._getMostChangedFields(timeline)
    };
  }

  /**
   * Find conflicts between documents
   */
  findConflicts(documents, options = {}) {
    const conflicts = [];
    const fieldsToCheck = options.conflictFields || null;

    // Group by field values to find contradictions
    const fieldValues = new Map();

    for (const doc of documents) {
      const data = doc.data || doc;
      for (const [field, value] of Object.entries(data)) {
        if (fieldsToCheck && !fieldsToCheck.includes(field)) continue;
        
        if (!fieldValues.has(field)) {
          fieldValues.set(field, []);
        }
        fieldValues.get(field).push({
          documentId: doc.id,
          version: doc.version,
          value,
          effectiveFrom: doc.effectiveFrom
        });
      }
    }

    // Check for conflicting values
    for (const [field, values] of fieldValues) {
      const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
      
      if (uniqueValues.size > 1) {
        // Check if conflicts are due to time periods (valid) or actual conflicts
        const overlapping = this._findOverlappingPeriods(values);
        
        if (overlapping.length > 0) {
          conflicts.push({
            field,
            type: 'value_conflict',
            severity: this._calculateConflictSeverity(field, values),
            documents: values,
            overlappingPeriods: overlapping,
            recommendation: this._generateConflictRecommendation(field, values)
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflictCount: conflicts.length,
      conflicts: conflicts.sort((a, b) => b.severity - a.severity),
      summary: this._generateConflictSummary(conflicts)
    };
  }

  /**
   * Detect overlaps between documents
   */
  findOverlaps(documents, options = {}) {
    const overlaps = [];
    const fieldGroups = options.groupByFields || [];

    // Group documents by specified fields
    if (fieldGroups.length > 0) {
      const groups = new Map();
      
      for (const doc of documents) {
        const data = doc.data || doc;
        const key = fieldGroups.map(f => data[f]).join('|');
        
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(doc);
      }

      // Find duplicates within groups
      for (const [groupKey, groupDocs] of groups) {
        if (groupDocs.length > 1) {
          overlaps.push({
            type: 'duplicate_group',
            groupKey,
            fields: fieldGroups,
            documents: groupDocs.map(d => ({ id: d.id, version: d.version })),
            count: groupDocs.length
          });
        }
      }
    }

    // Find content-similar documents
    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const similarity = this._calculateSimilarity(documents[i], documents[j]);
        
        if (similarity > (options.similarityThreshold || 0.9)) {
          overlaps.push({
            type: 'high_similarity',
            similarity,
            documentA: { id: documents[i].id, version: documents[i].version },
            documentB: { id: documents[j].id, version: documents[j].version }
          });
        }
      }
    }

    return {
      hasOverlaps: overlaps.length > 0,
      overlapCount: overlaps.length,
      overlaps,
      summary: `Found ${overlaps.length} overlaps across ${documents.length} documents`
    };
  }

  /**
   * Generate a diff report
   */
  generateDiffReport(comparison, options = {}) {
    const format = options.format || 'text';
    
    if (format === 'json') {
      return comparison;
    }

    let report = [];
    report.push(`Document Comparison Report`);
    report.push(`Generated: ${comparison.timestamp}`);
    report.push(`Comparison ID: ${comparison.comparisonId}`);
    report.push('');
    report.push(`Document A: ${comparison.documentA.id} (v${comparison.documentA.version})`);
    report.push(`Document B: ${comparison.documentB.id} (v${comparison.documentB.version})`);
    report.push('');
    
    if (comparison.identical) {
      report.push('Result: Documents are IDENTICAL');
    } else {
      report.push(`Result: ${comparison.differences.length} difference(s) found`);
      report.push('');
      report.push('--- Differences ---');
      
      for (const diff of comparison.differences) {
        report.push('');
        report.push(`Field: ${diff.field}`);
        report.push(`  Type: ${diff.type}`);
        if (diff.type !== 'added' && diff.type !== 'removed') {
          report.push(`  Before: ${this._formatValue(diff.valueA)}`);
          report.push(`  After:  ${this._formatValue(diff.valueB)}`);
        } else if (diff.type === 'added') {
          report.push(`  Added:  ${this._formatValue(diff.valueB)}`);
        } else {
          report.push(`  Removed: ${this._formatValue(diff.valueA)}`);
        }
        if (diff.significance) {
          report.push(`  Significance: ${(diff.significance * 100).toFixed(0)}%`);
        }
      }
      
      report.push('');
      report.push('--- Statistics ---');
      report.push(`Total fields compared: ${comparison.statistics.totalFields}`);
      report.push(`Fields added: ${comparison.statistics.added}`);
      report.push(`Fields removed: ${comparison.statistics.removed}`);
      report.push(`Fields modified: ${comparison.statistics.modified}`);
      report.push(`Change percentage: ${(comparison.statistics.changePercentage * 100).toFixed(1)}%`);
    }

    return format === 'html' 
      ? this._convertToHtml(report)
      : report.join('\n');
  }

  /**
   * Compare two values and return difference info
   */
  _compareValues(valueA, valueB, field, options) {
    // Handle undefined/null cases
    if (valueA === undefined && valueB !== undefined) {
      return {
        field,
        type: 'added',
        valueA: null,
        valueB,
        significance: this._calculateSignificance(null, valueB)
      };
    }
    
    if (valueA !== undefined && valueB === undefined) {
      return {
        field,
        type: 'removed',
        valueA,
        valueB: null,
        significance: this._calculateSignificance(valueA, null)
      };
    }

    // Both have values - compare them
    if (this._areEqual(valueA, valueB)) {
      return null; // No difference
    }

    // Determine type of change
    let type = 'modified';
    let details = {};

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      type = 'numeric_change';
      details = {
        delta: valueB - valueA,
        percentChange: valueA !== 0 ? ((valueB - valueA) / valueA) * 100 : null
      };
    } else if (typeof valueA === 'string' && typeof valueB === 'string') {
      type = 'text_change';
      details = {
        lengthChange: valueB.length - valueA.length
      };
    } else if (Array.isArray(valueA) && Array.isArray(valueB)) {
      type = 'array_change';
      details = this._compareArrays(valueA, valueB);
    } else if (this.deepCompare && typeof valueA === 'object' && typeof valueB === 'object') {
      type = 'object_change';
      details = this._compareObjects(valueA, valueB);
    }

    return {
      field,
      type,
      valueA,
      valueB,
      significance: this._calculateSignificance(valueA, valueB),
      ...details
    };
  }

  /**
   * Check if two values are equal
   */
  _areEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  /**
   * Compare two arrays
   */
  _compareArrays(arrA, arrB) {
    const added = arrB.filter(b => !arrA.some(a => this._areEqual(a, b)));
    const removed = arrA.filter(a => !arrB.some(b => this._areEqual(a, b)));
    
    return {
      itemsAdded: added.length,
      itemsRemoved: removed.length,
      added,
      removed
    };
  }

  /**
   * Compare two objects (deep)
   */
  _compareObjects(objA, objB) {
    const changes = [];
    const allKeys = new Set([...Object.keys(objA || {}), ...Object.keys(objB || {})]);

    for (const key of allKeys) {
      const diff = this._compareValues(objA?.[key], objB?.[key], key, {});
      if (diff) changes.push(diff);
    }

    return {
      nestedChanges: changes.length,
      changes
    };
  }

  /**
   * Calculate significance of a change
   */
  _calculateSignificance(oldVal, newVal) {
    if (oldVal === null || oldVal === undefined) return 0.5;
    if (newVal === null || newVal === undefined) return 0.5;

    if (typeof oldVal === 'number' && typeof newVal === 'number') {
      const percentChange = Math.abs((newVal - oldVal) / (oldVal || 1));
      return Math.min(percentChange, 1);
    }

    if (typeof oldVal === 'string' && typeof newVal === 'string') {
      // Levenshtein-like significance
      const maxLen = Math.max(oldVal.length, newVal.length);
      if (maxLen === 0) return 0;
      const commonPrefix = this._commonPrefixLength(oldVal, newVal);
      return 1 - (commonPrefix / maxLen);
    }

    return 0.5; // Default significance for other types
  }

  /**
   * Calculate length of common prefix
   */
  _commonPrefixLength(strA, strB) {
    let i = 0;
    while (i < strA.length && i < strB.length && strA[i] === strB[i]) {
      i++;
    }
    return i;
  }

  /**
   * Calculate comparison statistics
   */
  _calculateStats(differences, totalFields) {
    const added = differences.filter(d => d.type === 'added').length;
    const removed = differences.filter(d => d.type === 'removed').length;
    const modified = differences.length - added - removed;

    return {
      totalFields,
      totalDifferences: differences.length,
      added,
      removed,
      modified,
      changePercentage: totalFields > 0 ? differences.length / totalFields : 0,
      averageSignificance: differences.length > 0
        ? differences.reduce((sum, d) => sum + (d.significance || 0), 0) / differences.length
        : 0
    };
  }

  /**
   * Generate comparison summary
   */
  _generateSummary(differences, stats) {
    if (differences.length === 0) {
      return 'Documents are identical';
    }

    const parts = [];
    if (stats.added > 0) parts.push(`${stats.added} field(s) added`);
    if (stats.removed > 0) parts.push(`${stats.removed} field(s) removed`);
    if (stats.modified > 0) parts.push(`${stats.modified} field(s) modified`);

    return parts.join(', ');
  }

  /**
   * Find common differences across comparisons
   */
  _findCommonDifferences(comparisons) {
    if (comparisons.length < 2) return [];

    const fieldDiffs = new Map();

    for (const { comparison } of comparisons) {
      for (const diff of comparison.differences) {
        if (!fieldDiffs.has(diff.field)) {
          fieldDiffs.set(diff.field, 0);
        }
        fieldDiffs.set(diff.field, fieldDiffs.get(diff.field) + 1);
      }
    }

    // Fields that differ in all comparisons
    return Array.from(fieldDiffs.entries())
      .filter(([_, count]) => count === comparisons.length)
      .map(([field]) => field);
  }

  /**
   * Get most frequently changed fields
   */
  _getMostChangedFields(timeline) {
    const fieldCounts = new Map();

    for (const entry of timeline) {
      for (const change of entry.changes) {
        const count = fieldCounts.get(change.field) || 0;
        fieldCounts.set(change.field, count + 1);
      }
    }

    return Array.from(fieldCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([field, count]) => ({ field, changeCount: count }));
  }

  /**
   * Find overlapping effective periods
   */
  _findOverlappingPeriods(values) {
    const overlaps = [];

    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i];
        const b = values[j];

        if (!a.effectiveFrom || !b.effectiveFrom) continue;

        const aFrom = new Date(a.effectiveFrom);
        const aTo = a.effectiveTo ? new Date(a.effectiveTo) : new Date('9999-12-31');
        const bFrom = new Date(b.effectiveFrom);
        const bTo = b.effectiveTo ? new Date(b.effectiveTo) : new Date('9999-12-31');

        // Check for overlap
        if (aFrom <= bTo && bFrom <= aTo) {
          overlaps.push({
            documents: [a.documentId, b.documentId],
            overlapStart: new Date(Math.max(aFrom, bFrom)).toISOString(),
            overlapEnd: new Date(Math.min(aTo, bTo)).toISOString()
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Calculate conflict severity
   */
  _calculateConflictSeverity(field, values) {
    // Higher severity for more documents in conflict
    const docCount = new Set(values.map(v => v.documentId)).size;
    return Math.min(docCount / 10, 1);
  }

  /**
   * Generate conflict recommendation
   */
  _generateConflictRecommendation(field, values) {
    const uniqueValues = [...new Set(values.map(v => JSON.stringify(v.value)))];
    
    if (uniqueValues.length === 2) {
      return `Review and reconcile the two different values for "${field}"`;
    }
    return `Multiple conflicting values found for "${field}". Manual review required to determine authoritative value.`;
  }

  /**
   * Generate conflict summary
   */
  _generateConflictSummary(conflicts) {
    if (conflicts.length === 0) {
      return 'No conflicts detected';
    }
    
    const highSeverity = conflicts.filter(c => c.severity > 0.7).length;
    return `Found ${conflicts.length} conflict(s): ${highSeverity} high severity`;
  }

  /**
   * Calculate similarity between documents
   */
  _calculateSimilarity(docA, docB) {
    const dataA = docA.data || docA;
    const dataB = docB.data || docB;
    
    const keysA = Object.keys(dataA);
    const keysB = Object.keys(dataB);
    const allKeys = new Set([...keysA, ...keysB]);
    
    let matchingFields = 0;
    for (const key of allKeys) {
      if (this._areEqual(dataA[key], dataB[key])) {
        matchingFields++;
      }
    }

    return allKeys.size > 0 ? matchingFields / allKeys.size : 1;
  }

  /**
   * Format value for display
   */
  _formatValue(value) {
    if (value === null || value === undefined) return '(null)';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  /**
   * Convert report to HTML
   */
  _convertToHtml(lines) {
    return `<pre>${lines.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
  }
}

module.exports = { DocumentComparator };
