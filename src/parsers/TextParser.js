/**
 * TextParser - Parse and preprocess text documents
 * 
 * Handles cleaning, structuring, and preparing text for extraction.
 */

class TextParser {
  constructor(options = {}) {
    this.normalizeWhitespace = options.normalizeWhitespace ?? true;
    this.preserveLineBreaks = options.preserveLineBreaks ?? true;
    this.detectSections = options.detectSections ?? true;
    this.detectLists = options.detectLists ?? true;
    this.extractTables = options.extractTables ?? false;
  }

  /**
   * Parse raw text into structured format
   */
  parse(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return { text: '', sections: [], metadata: {} };
    }

    let processedText = text;

    // Normalize whitespace
    if (this.normalizeWhitespace) {
      processedText = this._normalizeWhitespace(processedText);
    }

    // Detect and structure sections
    const sections = this.detectSections
      ? this._detectSections(processedText)
      : [];

    // Detect lists
    const lists = this.detectLists
      ? this._detectLists(processedText)
      : [];

    // Extract tables if enabled
    const tables = this.extractTables
      ? this._extractTables(processedText)
      : [];

    return {
      text: processedText,
      originalLength: text.length,
      processedLength: processedText.length,
      sections,
      lists,
      tables,
      metadata: {
        lineCount: processedText.split('\n').length,
        wordCount: processedText.split(/\s+/).length,
        paragraphCount: processedText.split(/\n\n+/).length
      }
    };
  }

  /**
   * Normalize whitespace while preserving structure
   */
  _normalizeWhitespace(text) {
    let result = text;
    
    // Replace multiple spaces with single space
    result = result.replace(/[ \t]+/g, ' ');
    
    // Normalize line endings
    result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Reduce multiple blank lines to maximum of two
    result = result.replace(/\n{3,}/g, '\n\n');
    
    // Trim lines
    result = result.split('\n').map(line => line.trim()).join('\n');
    
    return result.trim();
  }

  /**
   * Detect sections in the document
   */
  _detectSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;
    let sectionContent = [];
    let lineIndex = 0;

    // Patterns for section headings
    const headingPatterns = [
      /^(#{1,6})\s+(.+)$/,                          // Markdown headers
      /^(\d+(?:\.\d+)*)\s+(.+)$/,                   // Numbered sections (1.2.3 Title)
      /^(Section|Article|Clause|Part|Chapter)\s+(\d+(?:\.\d+)?)[:\s]+(.+)$/i,
      /^([A-Z][A-Z\s]{2,})$/,                       // ALL CAPS headings
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):$/,       // Title Case with colon
    ];

    for (const line of lines) {
      let isHeading = false;
      let headingLevel = 0;
      let headingText = '';

      for (const pattern of headingPatterns) {
        const match = line.match(pattern);
        if (match) {
          isHeading = true;
          if (match[1].startsWith('#')) {
            headingLevel = match[1].length;
            headingText = match[2];
          } else if (/^\d/.test(match[1])) {
            headingLevel = match[1].split('.').length;
            headingText = match[2];
          } else {
            headingLevel = 1;
            headingText = match[0].replace(/:$/, '');
          }
          break;
        }
      }

      if (isHeading) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          currentSection.endLine = lineIndex - 1;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          level: headingLevel,
          title: headingText.trim(),
          startLine: lineIndex,
          endLine: lineIndex
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }

      lineIndex++;
    }

    // Add last section
    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      currentSection.endLine = lineIndex - 1;
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Detect lists in the document
   */
  _detectLists(text) {
    const lists = [];
    const lines = text.split('\n');
    let currentList = null;
    let lineIndex = 0;

    const listPatterns = [
      /^[-*•]\s+(.+)$/,                    // Bullet lists
      /^(\d+)[.)]\s+(.+)$/,                // Numbered lists
      /^([a-z])[.)]\s+(.+)$/i,             // Lettered lists
      /^(\([a-z]\)|\([0-9]+\))\s+(.+)$/i,  // Parenthetical lists
    ];

    for (const line of lines) {
      let isListItem = false;
      let itemContent = '';
      let listType = 'bullet';

      for (const pattern of listPatterns) {
        const match = line.match(pattern);
        if (match) {
          isListItem = true;
          if (/^\d/.test(match[1])) {
            listType = 'numbered';
          } else if (/^[a-z]/i.test(match[1])) {
            listType = 'lettered';
          }
          itemContent = match[match.length - 1];
          break;
        }
      }

      if (isListItem) {
        if (!currentList || currentList.type !== listType) {
          // Save previous list
          if (currentList && currentList.items.length > 0) {
            lists.push(currentList);
          }
          // Start new list
          currentList = {
            type: listType,
            startLine: lineIndex,
            items: []
          };
        }
        currentList.items.push({
          content: itemContent.trim(),
          line: lineIndex
        });
        currentList.endLine = lineIndex;
      } else if (currentList && line.trim() === '') {
        // Empty line might end the list
        if (currentList.items.length > 0) {
          lists.push(currentList);
          currentList = null;
        }
      }

      lineIndex++;
    }

    // Add last list
    if (currentList && currentList.items.length > 0) {
      lists.push(currentList);
    }

    return lists;
  }

  /**
   * Extract table-like structures from text
   */
  _extractTables(text) {
    const tables = [];
    const lines = text.split('\n');
    let tableStart = -1;
    let tableRows = [];
    let columnCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detect potential table rows (multiple values separated by tabs or multiple spaces)
      const cells = line.split(/\t|(?:\s{2,})/);
      
      if (cells.length >= 2 && cells.filter(c => c.trim()).length >= 2) {
        if (tableStart === -1) {
          tableStart = i;
          columnCount = cells.length;
        }
        
        if (cells.length === columnCount || Math.abs(cells.length - columnCount) <= 1) {
          tableRows.push({
            line: i,
            cells: cells.map(c => c.trim())
          });
        }
      } else if (tableStart !== -1) {
        // End of table
        if (tableRows.length >= 2) {
          tables.push({
            startLine: tableStart,
            endLine: i - 1,
            columnCount,
            rows: tableRows,
            headers: tableRows[0]?.cells
          });
        }
        tableStart = -1;
        tableRows = [];
        columnCount = 0;
      }
    }

    // Handle table at end of document
    if (tableStart !== -1 && tableRows.length >= 2) {
      tables.push({
        startLine: tableStart,
        endLine: lines.length - 1,
        columnCount,
        rows: tableRows,
        headers: tableRows[0]?.cells
      });
    }

    return tables;
  }

  /**
   * Extract text within specific boundaries
   */
  extractBetween(text, startPattern, endPattern, options = {}) {
    const startMatch = text.match(startPattern);
    if (!startMatch) return null;

    const startIndex = startMatch.index + startMatch[0].length;
    const remainingText = text.slice(startIndex);
    
    const endMatch = remainingText.match(endPattern);
    if (!endMatch) {
      return options.includeToEnd ? remainingText.trim() : null;
    }

    return remainingText.slice(0, endMatch.index).trim();
  }

  /**
   * Split text into paragraphs
   */
  splitParagraphs(text) {
    return text
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  /**
   * Split text into sentences
   */
  splitSentences(text) {
    // Simple sentence splitting - handles common cases
    return text
      .replace(/([.?!])\s+/g, '$1|SPLIT|')
      .split('|SPLIT|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Remove common boilerplate patterns
   */
  removeBoilerplate(text, patterns = []) {
    const defaultPatterns = [
      /^page \d+ of \d+$/gim,
      /^confidential$/gim,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/gm,
      /^draft$/gim
    ];

    const allPatterns = [...defaultPatterns, ...patterns];
    let result = text;

    for (const pattern of allPatterns) {
      result = result.replace(pattern, '');
    }

    return this._normalizeWhitespace(result);
  }
}

module.exports = { TextParser };
