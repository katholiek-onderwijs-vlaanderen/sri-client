module.exports = class Batch {
  constructor(sriClient) {
    this.array = [];
    this.sriClient = sriClient;
  }

  getPayload() {
    return this.array;
  }

  get(href) {
    this.array.push({
      href: href,
      verb: 'GET'
    });
  }

  put(href, payload) {
    //make it also possible to just do put of a resource and get the href from the $$meta permalink.
    if (typeof href === 'object' && href.$$meta && href.$$meta.permalink) {
      this.array.push({
        href: href.$$meta.permalink,
        verb: 'PUT',
        body: href
      });
    } else {
      this.array.push({
        href: href,
        verb: 'PUT',
        body: payload
      });
    }
  }

  post(href, payload) {
    this.array.push({
      href: href,
      verb: 'POST',
      body: payload
    });
  }

  delete(href) {
    this.array.push({
      href: href,
      verb: 'DELETE'
    });
  }

  send(href, sriClient) {
    return sriClient ? sriClient.put(href, this.array) : this.sriClient.put(href, this.array);
  }
};