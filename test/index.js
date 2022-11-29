/* global fetch, Response */
const SriClient = require('../sri-client.js');
const commonUtils = require('../common-utils');
const SriClientError = require('../sri-client-error');
const assert = require('assert');

function generateTestExpandedResource(key) {
  const href = `/tests/${key}`;

  return {
    href,
    $$expanded: {
      $$meta: {
        permalink: href,
      },
      key,
      name: `this is test ${key}`
    },
  };
}

class TestClient extends SriClient {

  constructor(config = {}) {
    super(config);
  }

  async getRaw(href, params, optionsParam = {}) {
    // const fullHref = href
    switch (href) {
      case '/tests': return {
        $$meta: { next: '/tests?offset=3' },
        results: [
          generateTestExpandedResource(1),
          generateTestExpandedResource(2),
          generateTestExpandedResource(3),
        ]
      };
      case '/tests?offset=3': return {
        $$meta: { next: '/tests?offset=6' },
        results: [
          generateTestExpandedResource(4),
          generateTestExpandedResource(5),
          generateTestExpandedResource(6),
        ]
      };
      case '/tests?offset=6': return {
        $$meta: {},
        results: [
          generateTestExpandedResource(7),
          generateTestExpandedResource(8),
          generateTestExpandedResource(9),
        ]
      };
      case '/tests?expand=NONE': return {
        $$meta: { next: '/tests?expand=NONE&offset=3' },
        results: [
          { href: generateTestExpandedResource(1).href },
          { href: generateTestExpandedResource(2).href },
          { href: generateTestExpandedResource(3).href },
        ]
      };
      case '/tests?expand=NONE&offset=3': return {
        $$meta: { next: '/tests?expand=NONE&offset=6' },
        results: [
          { href: generateTestExpandedResource(4).href },
          { href: generateTestExpandedResource(5).href },
          { href: generateTestExpandedResource(6).href },
        ]
      };
      case '/tests?expand=NONE&offset=6': return {
        $$meta: {},
        results: [
          { href: generateTestExpandedResource(7).href },
          { href: generateTestExpandedResource(8).href },
          { href: generateTestExpandedResource(9).href },
        ]
      };
      case '/testsreturningasimplearray': return [
        generateTestExpandedResource(1).href,
        generateTestExpandedResource(2).href,
        generateTestExpandedResource(3).href,
      ];
    }
  }

  async sendPayload(href, payload, optionsParam = {}, method) {
  }

  async delete(href, optionsParam = {}) {
  }
};



module.exports = describe('sri-client test suite', () => {
  it('getListAsIterableIterator works as expected', async () => {
    api = new TestClient();
    const result = [];
    for await (const r of api.getListAsIterableIterator('/tests')) {
      result.push(r);
    }
    assert.deepEqual(result, [
      generateTestExpandedResource(1).$$expanded,
      generateTestExpandedResource(2).$$expanded,
      generateTestExpandedResource(3).$$expanded,
      generateTestExpandedResource(4).$$expanded,
      generateTestExpandedResource(5).$$expanded,
      generateTestExpandedResource(6).$$expanded,
      generateTestExpandedResource(7).$$expanded,
      generateTestExpandedResource(8).$$expanded,
      generateTestExpandedResource(9).$$expanded,
    ]);


    const resultNoExpansion = [];
    for await (const r of api.getListAsIterableIterator('/tests?expand=NONE')) {
      resultNoExpansion.push(r);
    }
    assert.deepEqual(resultNoExpansion, [
      generateTestExpandedResource(1).href,
      generateTestExpandedResource(2).href,
      generateTestExpandedResource(3).href,
      generateTestExpandedResource(4).href,
      generateTestExpandedResource(5).href,
      generateTestExpandedResource(6).href,
      generateTestExpandedResource(7).href,
      generateTestExpandedResource(8).href,
      generateTestExpandedResource(9).href,
    ]);

    const resultSimpleArray = [];
    for await (const r of api.getListAsIterableIterator('/testsreturningasimplearray')) {
      resultSimpleArray.push(r);
    }
    assert.deepEqual(resultSimpleArray, [
      generateTestExpandedResource(1).href,
      generateTestExpandedResource(2).href,
      generateTestExpandedResource(3).href,
    ]);
  })
});