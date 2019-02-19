module.exports = class SriClientError {
  constructor(obj) {
    this.object = obj;
    this.status = obj.status;
    this.body = obj.body;
    this.headers = obj.headers;
    this.stack = obj.stack;
  }

  getStatusCode() {
    return this.status;
  };

  getResponseHeader(header) {
    return this.headers[header];
  }

  print() {
    return {
      status: this.status,
      body: this.body
    };
  }
};