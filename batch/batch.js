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
    //make it also possible to just do put of a resource and get the href from the $$meta permalink.
    if (typeof href === 'object' && href.$$meta && href.$$meta.permalink) {
      this.batchArray.push({
        href: href.$$meta.permalink,
        verb: 'PUT',
        body: href
      });
    } else {
      this.batchArray.push({
        href: href,
        verb: 'PUT',
        body: payload
      });
    }
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