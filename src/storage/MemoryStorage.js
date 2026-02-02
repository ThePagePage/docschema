/**
 * MemoryStorage - In-memory storage adapter
 */

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  async write(key, value) {
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    return { key, success: true };
  }

  async read(key) {
    const value = this.data.get(key);
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async list() {
    return Array.from(this.data.values());
  }

  async clear() {
    this.data.clear();
  }

  get size() {
    return this.data.size;
  }
}

module.exports = { MemoryStorage };
