const {test} = require('node:test');
const assert = require('node:assert/strict');
const {sameOrigin, allowedRequest, safeFilename} = require('../app/policy.cjs');
const config = require('../app/config.cjs');
test('only the central HTTPS site is trusted', () => {
  assert.equal(new URL(config.origin).protocol, 'https:');
  for (const route of ['/', '/api/state', '/#ventas']) assert.ok(sameOrigin(config.origin + route, config.origin));
  for (const url of ['http://santa-elena-de-la-cruz.sistemascacl.chatgpt.site', config.origin+'.evil.test', 'https://evil.test', 'javascript:alert(1)', 'file:///tmp/test.html', 'https://user:pass@'+new URL(config.origin).host]) assert.equal(sameOrigin(url, config.origin), false);
});
test('download blobs are scoped to the system origin', () => {
  assert.ok(allowedRequest('blob:'+config.origin+'/uuid', config.origin));
  assert.equal(allowedRequest('blob:https://evil.test/uuid', config.origin), false);
});
test('download filenames cannot choose a directory', () => {
  assert.equal(safeFilename('../../respaldo.json'), 'respaldo.json');
  assert.equal(safeFilename('C:\\temp\\respaldo.json'), 'respaldo.json');
  assert.equal(safeFilename('bad:name?.json'), 'bad_name_.json');
});
