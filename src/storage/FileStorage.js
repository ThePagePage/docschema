/**
 * FileStorage - File-based storage adapter
 */

const fs = require('fs');
const path = require('path');

class FileStorage {
  constructor(options = {}) {
    this.basePath = options.path || './docschema-data';
    this.extension = options.extension || '.json';
    this._ensureDirectory();
  }

  _ensureDirectory() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  _getFilePath(key) {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.basePath, `${safeKey}${this.extension}`);
  }

  async write(key, value) {
    const filePath = this._getFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
    return { key, path: filePath, success: true };
  }

  async read(key) {
    const filePath = this._getFilePath(key);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  async delete(key) {
    const filePath = this._getFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async list() {
    const files = fs.readdirSync(this.basePath)
      .filter(f => f.endsWith(this.extension));
    
    return Promise.all(files.map(async f => {
      const content = fs.readFileSync(path.join(this.basePath, f), 'utf-8');
      return JSON.parse(content);
    }));
  }

  async clear() {
    const files = fs.readdirSync(this.basePath)
      .filter(f => f.endsWith(this.extension));
    files.forEach(f => fs.unlinkSync(path.join(this.basePath, f)));
  }
}

module.exports = { FileStorage };
