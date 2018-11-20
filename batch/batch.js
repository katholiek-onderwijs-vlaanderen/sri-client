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
      verb: 'GET'
    });
  }

  put(href, payload) {
    this.batchArray.push({
      href: href,
      verb: 'PUT',
      body: payload
    });
  }

  post(href, payload) {
    this.batchArray.push({
      href: href,
      verb: 'POST',
      body: payload
    });
  }

  delete(href) {
    this.batchArray.push({
      href: href,
      verb: 'DELETE'
    });
  }

  send(href, sriClient) {
    return sriClient.put(href, this.batchArray);
  }
};