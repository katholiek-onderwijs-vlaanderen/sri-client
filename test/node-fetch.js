const http = require('http');
const assert = require('assert');
const SriClientError = require('../sri-client-error');
const nodeFetchModule = require('../node-fetch/node-fetch.js');

// werkt zowel als de module een factory-functie als een class exporteert
function createClient(config) {
  try {
    return new nodeFetchModule(config);
  } catch (e) {
    return nodeFetchModule(config);
  }
}

const SLOW_DELAY_MS = 2000;
let slowHits = 0;

/**
 * Builds the error that native fetch (undici) throws on a network failure.
 */
function fetchFailedError(code, message = `getaddrinfo ${code} does-not-exist.invalid`) {
  return new TypeError('fetch failed', {
    cause: Object.assign(new Error(message), { code, syscall: 'getaddrinfo', hostname: 'does-not-exist.invalid' }),
  });
}

/**
 * Replaces globalThis.fetch with a stub that rejects with `error`
 * while `fn` runs, and restores the original afterwards.
 */
async function withFailingFetch(error, fn) {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw error; };
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
  return calls;
}

function startServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const json = (status, data, headers = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
        res.end(JSON.stringify(data));
      };

      if (req.method === 'GET' && req.url === '/tests/1') {
        return json(200, { $$meta: { permalink: '/tests/1' }, key: 1 });
      }
      if (req.method === 'GET' && req.url.startsWith('/tests?')) {
        return json(200, { $$meta: { count: 0 }, results: [], url: req.url });
      }
      if (req.method === 'GET' && req.url === '/headers') {
        return json(200, req.headers);
      }
      if (req.method === 'GET' && req.url === '/notfound') {
        return json(404, { errors: [{ code: 'not.found' }] });
      }
      if (req.url === '/slow') {
        slowHits++;
        const timer = setTimeout(() => json(200, { slow: true, method: req.method }), SLOW_DELAY_MS);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      if (req.method === 'PUT' && req.url === '/tests/1') {
        return json(201, { received: JSON.parse(body) });
      }
      if (req.method === 'POST' && req.url === '/tests') {
        return json(200, { received: JSON.parse(body), contentType: req.headers['content-type'] });
      }
      if (req.method === 'PUT' && req.url === '/conflict') {
        return json(409, { errors: [{ code: 'conflict' }] });
      }
      if (req.method === 'DELETE' && req.url === '/tests/1') {
        return json(200, { deleted: true });
      }
      if (req.method === 'DELETE' && req.url === '/notfound') {
        return json(404, { errors: [{ code: 'not.found' }] });
      }
      if (req.url === '/redirect-hop1') {
        const timer = setTimeout(() => {
          res.writeHead(302, { Location: '/redirect-hop2' });
          res.end();
        }, 300);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      if (req.url === '/redirect-hop2') {
        const timer = setTimeout(() => json(200, { hop: 2 }), 300);
        res.on('close', () => clearTimeout(timer));
        return;
      }
      if (req.url === '/redirect-to-data') {
        res.writeHead(302, { Location: 'data:application/json,{"fake":true}' });
        res.end();
        return;
      }
      return json(500, { error: 'unexpected route ' + req.method + ' ' + req.url });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('node-fetch client', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = await startServer();
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  it('GET returns the parsed body', async () => {
    const api = createClient({ baseUrl });
    const result = await api.getRaw('/tests/1');
    assert.deepStrictEqual(result, { $$meta: { permalink: '/tests/1' }, key: 1 });
  });

  it('GET passes query parameters', async () => {
    const api = createClient({ baseUrl });
    const result = await api.getRaw('/tests', { limit: 5 });
    assert.match(result.url, /limit=5/);
  });

  it('GET with fullResponse returns status and headers', async () => {
    const api = createClient({ baseUrl });
    const resp = await api.getRaw('/tests/1', undefined, { fullResponse: true });
    assert.strictEqual(resp.status, 200);
    assert.match(resp.headers['content-type'], /application\/json/);
    assert.strictEqual(resp.body.key, 1);
  });

  it('sends default, basic auth and per-request headers', async () => {
    const api = createClient({
      baseUrl,
      username: 'user',
      password: 'pass',
      headers: { 'X-Default': 'a' },
    });
    const headers = await api.getRaw('/headers', undefined, { headers: { 'X-Extra': 'b' } });
    assert.strictEqual(headers['x-default'], 'a');
    assert.strictEqual(headers['x-extra'], 'b');
    assert.strictEqual(headers.authorization, 'Basic ' + Buffer.from('user:pass').toString('base64'));
  });

  it('GET on a 404 throws an SriClientError with status 404', async () => {
    const api = createClient({ baseUrl });
    await assert.rejects(api.getRaw('/notfound'), (err) => {
      assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
      assert.strictEqual(err.status, 404);
      return true;
    });
  });

  it('PUT sends the payload as JSON', async () => {
    const api = createClient({ baseUrl });
    const result = await api.sendPayload('/tests/1', { key: 1, name: 'test' }, {}, 'PUT');
    assert.deepStrictEqual(result, { received: { key: 1, name: 'test' } });
  });

  it('DELETE works', async () => {
    const api = createClient({ baseUrl });
    const result = await api.delete('/tests/1');
    assert.deepStrictEqual(result, { deleted: true });
  });

  describe('timeout', function () {
    this.timeout(SLOW_DELAY_MS + 3000);

    it('aborts a GET when the timeout option expires', async () => {
      const api = createClient({ baseUrl });
      const start = Date.now();
      await assert.rejects(api.getRaw('/slow', undefined, { timeout: 200 }), (err) => {
        assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
        return true;
      });
      const elapsed = Date.now() - start;
      assert.ok(elapsed < SLOW_DELAY_MS, `request was not aborted by timeout (took ${elapsed}ms)`);
    });

    it('uses the timeout from the client configuration', async () => {
      const api = createClient({ baseUrl, timeout: 200 });
      const start = Date.now();
      await assert.rejects(api.getRaw('/slow'));
      const elapsed = Date.now() - start;
      assert.ok(elapsed < SLOW_DELAY_MS, `request was not aborted by timeout (took ${elapsed}ms)`);
    });

    it('does not time out when the response is faster than the timeout', async () => {
      const api = createClient({ baseUrl });
      const result = await api.getRaw('/tests/1', undefined, { timeout: 1000 });
      assert.strictEqual(result.key, 1);
    });

    it('without timeout waits for the slow response', async () => {
      const api = createClient({ baseUrl });
      const result = await api.getRaw('/slow');
      assert.deepStrictEqual(result, { slow: true, method: 'GET' });
    });

    it('can be cancelled with an AbortController (cancel option)', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      const start = Date.now();
      await assert.rejects(api.getRaw('/slow', undefined, { cancel: controller.signal }));
      assert.ok(Date.now() - start < SLOW_DELAY_MS, 'request was not cancelled');
    });

    it('cancel still works when a timeout is also set', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      const start = Date.now();
      await assert.rejects(api.getRaw('/slow', undefined, { cancel: controller.signal, timeout: 5000 }));
      assert.ok(Date.now() - start < SLOW_DELAY_MS, 'request was not cancelled');
    });
  });

  // Searches for the underlying error in the SriClientError, which may be a TimeoutError, TypeError, etc.
  function underlyingError(err) {
    return err.error || err.cause || err.originalError;
  }

  async function expectFastRejection(promise, check) {
    const start = Date.now();
    await assert.rejects(promise, (err) => {
      assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
      if (check) check(err);
      return true;
    });
    const elapsed = Date.now() - start;
    assert.ok(elapsed < SLOW_DELAY_MS, `request was not aborted (took ${elapsed}ms)`);
  }

  describe('POST / PUT / DELETE', () => {
    it('POST sends JSON with the correct content-type', async () => {
      const api = createClient({ baseUrl });
      const result = await api.sendPayload('/tests', { key: 2 }, {}, 'POST');
      assert.deepStrictEqual(result.received, { key: 2 });
      assert.match(result.contentType, /application\/json/);
    });

    it('PUT strips $$-properties from the payload', async () => {
      const api = createClient({ baseUrl });
      const result = await api.sendPayload('/tests/1', { key: 1, $$meta: { x: 1 }, $$extra: true }, {}, 'PUT');
      assert.deepStrictEqual(result, { received: { key: 1 } });
    });

    it('PUT on a 409 throws an SriClientError with status 409', async () => {
      const api = createClient({ baseUrl });
      await assert.rejects(api.sendPayload('/conflict', { key: 1 }, {}, 'PUT'), (err) => {
        assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
        assert.strictEqual(err.status, 409);
        return true;
      });
    });

    it('DELETE on a 404 throws an SriClientError with status 404', async () => {
      const api = createClient({ baseUrl });
      await assert.rejects(api.delete('/notfound'), (err) => {
        assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
        assert.strictEqual(err.status, 404);
        return true;
      });
    });
  });

  describe('timeout and cancel for PUT / DELETE', function () {
    this.timeout(SLOW_DELAY_MS + 3000);

    it('PUT is aborted by the timeout option', async () => {
      const api = createClient({ baseUrl });
      await expectFastRejection(
        api.sendPayload('/slow', { key: 1 }, { timeout: 200 }, 'PUT'),
        (err) => assert.strictEqual(underlyingError(err)?.name, 'TimeoutError'),
      );
    });

    it('PUT uses the timeout from the client configuration', async () => {
      const api = createClient({ baseUrl, timeout: 200 });
      await expectFastRejection(api.sendPayload('/slow', { key: 1 }, {}, 'PUT'));
    });

    it('PUT can be cancelled', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      await expectFastRejection(
        api.sendPayload('/slow', { key: 1 }, { cancel: controller.signal, timeout: 5000 }, 'PUT'),
        (err) => assert.strictEqual(underlyingError(err)?.name, 'AbortError'),
      );
    });

    it('DELETE is aborted by the timeout option', async () => {
      const api = createClient({ baseUrl });
      await expectFastRejection(api.delete('/slow', { timeout: 200 }));
    });

    it('DELETE can be cancelled', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      await expectFastRejection(api.delete('/slow', { cancel: controller.signal }));
    });

    it('GET timeout error exposes TimeoutError as underlying error', async () => {
      const api = createClient({ baseUrl });
      await expectFastRejection(
        api.getRaw('/slow', undefined, { timeout: 200 }),
        (err) => {
          assert.strictEqual(underlyingError(err)?.name, 'TimeoutError');
          assert.ok(!err.status, 'a timeout should not have an HTTP status');
        },
      );
    });
  });

  describe('network errors', function () {
    this.timeout(10000);

    it('ENOTFOUND: fetch failure is wrapped in an SriClientError with cause.code', async () => {
      const fetchError = fetchFailedError('ENOTFOUND');
      const api = createClient({ baseUrl: 'http://does-not-exist.invalid' });
      const calls = await withFailingFetch(fetchError, async () => {
        await assert.rejects(api.getRaw('/tests/1'), (err) => {
          assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
          const cause = underlyingError(err);
          assert.strictEqual(cause, fetchError);
          assert.ok(cause instanceof TypeError, 'native fetch wraps network errors in a TypeError');
          assert.strictEqual(cause.cause?.code, 'ENOTFOUND');
          assert.ok(!err.status, 'a network error should not have an HTTP status');
          return true;
        });
      });
      assert.strictEqual(calls, 1);
    });

    it('ENOTFOUND on PUT and DELETE is wrapped as well', async () => {
      const fetchError = fetchFailedError('ENOTFOUND');
      const api = createClient({ baseUrl: 'http://does-not-exist.invalid' });
      await withFailingFetch(fetchError, async () => {
        for (const promiseFn of [
          () => api.sendPayload('/tests/1', { key: 1 }, {}, 'PUT'),
          () => api.delete('/tests/1'),
        ]) {
          await assert.rejects(promiseFn(), (err) => {
            assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
            assert.strictEqual(underlyingError(err)?.cause?.code, 'ENOTFOUND');
            return true;
          });
        }
      });
    });

    it('ECONNREFUSED: closed port gives an SriClientError with cause.code', async () => {
      const tmp = http.createServer();
      await new Promise((resolve) => tmp.listen(0, '127.0.0.1', resolve));
      const port = tmp.address().port;
      await new Promise((resolve) => tmp.close(resolve));

      const api = createClient({ baseUrl: `http://127.0.0.1:${port}` });
      await assert.rejects(api.sendPayload('/tests/1', { key: 1 }, {}, 'PUT'), (err) => {
        assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
        assert.strictEqual(underlyingError(err)?.cause?.code, 'ECONNREFUSED');
        return true;
      });
    });
  });

  describe('handleError without a Response', () => {
    // If handleError calls readResponse on these objects, you get
    // "response.text is not a function" or similar instead of an SriClientError
    const cases = {
      'TimeoutError': new DOMException('timed out', 'TimeoutError'),
      'AbortError': new DOMException('aborted', 'AbortError'),
      'TypeError fetch failed': Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('getaddrinfo ENOTFOUND x'), { code: 'ENOTFOUND' }),
      }),
    };

    for (const [name, error] of Object.entries(cases)) {
      it(`returns an SriClientError for ${name} without calling readResponse`, async () => {
        const api = createClient({ baseUrl });
        api.readResponse = () => { throw new Error('readResponse must not be called for ' + name); };
        const result = await api.handleError('GET /x', error, {}, new Error().stack);
        assert.ok(result instanceof SriClientError, 'expected SriClientError, got ' + result);
        assert.ok(!result.status);
        assert.strictEqual(underlyingError(result), error);
      });
    }

    it('still reads the body for a real Response', async () => {
      const api = createClient({ baseUrl });
      const response = new Response(JSON.stringify({ errors: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await api.handleError('GET /x', response, {}, new Error().stack);
      assert.ok(result instanceof SriClientError);
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.body, { errors: [] });
    });
  });

  describe('logging in sendPayload', () => {
    let logs;
    let originalLog;

    beforeEach(() => {
      logs = [];
      originalLog = console.log;
      console.log = (...args) => { logs.push(args.map(String).join(' ')); };
    });

    afterEach(() => {
      console.log = originalLog;
    });

    it('logs the request when logging contains the method (PUT)', async () => {
      const api = createClient({ baseUrl, logging: 'put' });
      await api.sendPayload('/tests/1', { key: 1 }, {}, 'PUT');
      assert.ok(
        logs.some((l) => l.includes('[sri-client] PUT ' + baseUrl + '/tests/1')),
        'expected a PUT log line, got: ' + JSON.stringify(logs),
      );
    });

    it('logs the request when logging contains the method (POST, case-insensitive)', async () => {
      const api = createClient({ baseUrl, logging: 'GET,POST' });
      await api.sendPayload('/tests', { key: 2 }, {}, 'POST');
      assert.ok(
        logs.some((l) => l.includes('[sri-client] POST ' + baseUrl + '/tests')),
        'expected a POST log line, got: ' + JSON.stringify(logs),
      );
    });

    it('logging option per request also works', async () => {
      const api = createClient({ baseUrl });
      await api.sendPayload('/tests/1', { key: 1 }, { logging: 'put' }, 'PUT');
      assert.ok(logs.some((l) => l.includes('[sri-client] PUT')), 'expected a PUT log line');
    });

    it('logs "response is not ok!" on an error response', async () => {
      const api = createClient({ baseUrl, logging: 'put' });
      await assert.rejects(api.sendPayload('/conflict', { key: 1 }, {}, 'PUT'));
      assert.ok(
        logs.some((l) => l.includes('[sri-client] response is not ok!')),
        'expected a "response is not ok!" log line, got: ' + JSON.stringify(logs),
      );
    });

    it('logs the fetch error on a network error', async () => {
      const api = createClient({ baseUrl: 'http://does-not-exist.invalid', logging: 'put' });
      await assert.rejects(api.sendPayload('/tests/1', { key: 1 }, {}, 'PUT'));
      assert.ok(
        logs.some((l) => l.includes('[sri-client] an error occured when doing fetch')),
        'expected a fetch error log line, got: ' + JSON.stringify(logs),
      );
    });

    it('does not log PUT when logging only contains get', async () => {
      const api = createClient({ baseUrl, logging: 'get' });
      await api.sendPayload('/tests/1', { key: 1 }, {}, 'PUT');
      assert.deepStrictEqual(logs, []);
    });
  });

  describe('cancel with retries enabled (api.get)', function () {
    this.timeout(SLOW_DELAY_MS + 3000);

    // pas aan naar de bestaande retry-config van sri-client
    const retry = { retries: 5, initialWait: 500, factor: 2 };

    beforeEach(() => { slowHits = 0; });

    it('an already-aborted signal does not trigger retries', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      controller.abort();
      const start = Date.now();
      await assert.rejects(api.get('/slow', undefined, { retry, cancel: controller.signal }));
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 300, `expected immediate rejection, took ${elapsed}ms`);
      assert.ok(slowHits <= 1, `expected at most 1 request, got ${slowHits}`);
    });

    it('aborting during a request stops retrying', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 200);
      const start = Date.now();
      await assert.rejects(api.get('/slow', undefined, { retry, cancel: controller.signal }));
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 500, `expected prompt rejection, took ${elapsed}ms`);
      assert.strictEqual(slowHits, 1);
    });
    it('aborting during the backoff delay rejects promptly', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      // eerste poging faalt na 100ms (timeout), daarna begint een backoff van 500ms
      setTimeout(() => controller.abort(), 250);
      const start = Date.now();
      await assert.rejects(api.get('/slow', undefined, {
        retry, timeout: 100, cancel: controller.signal,
      }));
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 450, `backoff was not interrupted (took ${elapsed}ms)`);
      assert.strictEqual(slowHits, 1);
    });

    it('PUT with retries: aborting during backoff rejects promptly', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 250);
      const start = Date.now();
      await assert.rejects(api.put('/slow', { key: 1 }, {
        retry, timeout: 100, cancel: controller.signal,
      }));
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 450, `backoff was not interrupted (took ${elapsed}ms)`);
      assert.strictEqual(slowHits, 1);
    });

    it('a timeout without cancel is still retried', async () => {
      const api = createClient({ baseUrl });
      await assert.rejects(api.get('/slow', undefined, {
        retry: { retries: 2, initialWait: 50, factor: 1 }, timeout: 100,
      }));
      assert.strictEqual(slowHits, 3);
    });
  });

  describe('timeout with redirects (deadline for the whole chain)', function () {
    this.timeout(5000);

    it('follows redirects when the whole chain is faster than the timeout', async () => {
      const api = createClient({ baseUrl });
      const resp = await api.getRaw('/redirect-hop1', undefined, { timeout: 1000, fullResponse: true });
      assert.deepStrictEqual(resp.body, { hop: 2 });
      assert.strictEqual(resp.redirected, true);
    });

    it('times out when the whole chain exceeds the timeout, even if every hop is faster', async () => {
      const api = createClient({ baseUrl });
      const start = Date.now();
      await assert.rejects(api.getRaw('/redirect-hop1', undefined, { timeout: 450 }), (err) => {
        assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
        assert.strictEqual(underlyingError(err)?.name, 'TimeoutError');
        return true;
      });
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 600, `expected the deadline to apply to the whole chain (took ${elapsed}ms)`);
    });

    it('times out when a single hop is slower than the timeout', async () => {
      const api = createClient({ baseUrl });
      await expectFastRejection(
        api.getRaw('/redirect-hop1', undefined, { timeout: 200 }),
        (err) => assert.strictEqual(underlyingError(err)?.name, 'TimeoutError'),
      );
    });

    it('cancel still aborts the whole redirect chain', async () => {
      const api = createClient({ baseUrl });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 400); // during hop 2
      await expectFastRejection(
        api.getRaw('/redirect-hop1', undefined, { timeout: 450, cancel: controller.signal }),
        (err) => assert.strictEqual(underlyingError(err)?.name, 'AbortError'),
      );
    });

    for (const timeout of [undefined, 1000]) {
      it(`rejects a redirect to a data: URL (timeout: ${timeout})`, async () => {
        const api = createClient({ baseUrl });
        await assert.rejects(api.getRaw('/redirect-to-data', undefined, { timeout }), (err) => {
          assert.ok(err instanceof SriClientError, 'expected SriClientError, got ' + err);
          assert.ok(!err.status);
          assert.ok(underlyingError(err) instanceof TypeError);
          return true;
        });
      });
    }

    it('rejects a redirect to a data: URL on PUT with timeout', async () => {
      const api = createClient({ baseUrl });
      await assert.rejects(
        api.sendPayload('/redirect-to-data', { key: 1 }, { timeout: 1000 }, 'PUT'),
        (err) => err instanceof SriClientError && !err.status,
      );
    });
  });

});