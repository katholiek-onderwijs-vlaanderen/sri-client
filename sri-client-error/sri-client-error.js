module.exports = class SriClientError {
  constructor(obj) {
    if(obj.originalResponse) {
      this.response = obj.originalResponse;
    } else {
      this.object = obj;
    }
    this.status = obj.status;
    this.body = obj.body;
    this.headers = obj.headers;
    this.error = obj.error;
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