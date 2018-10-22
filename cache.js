module.exports = class Cache {
  constructor(timeout = 0, maxSize = 10) {
    this.timeout = timeout;
    this.maxSize = maxSize;
  }
};