module.exports = class SriClientError {
  constructor(obj) {
    this.object = obj;
    this.status = obj.status;
    this.body = obj.body;
    this.getResponseHeader = obj.getResponseHeader;
    this.stack = obj.stack;
  }

  getStatusCode() {
    return this.status;
  };
};