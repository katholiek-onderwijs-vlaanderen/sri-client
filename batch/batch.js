module.exports = class Batch {
  constructor() {
    this.batchArray = [];
  }

  getPayload() {
    return this.batchArray;
  }

  get(href) {
    this.batchArray.push({
      href: href,
      method: 'GET'
    });
  }

  put(href, payload) {
    this.batchArray.push({
      href: href,
      method: 'PUT',
      body: payload
    });
  }

  post(href, payload) {
    this.batchArray.push({
      href: href,
      method: 'POST',
      body: payload
    });
  }

  delete(href) {
    this.batchArray.push({
      href: href,
      method: 'DELETE'
    });
  }

  send(href, sriClient) {
    return sriClient.put(href, this.batchArray);
  }
};