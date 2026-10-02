const assert = require('node:assert/strict');
const {test} = require('node:test');
const checkUpstream = require('./check-upstream.cjs');

function fixture({ahead = 0, existing = []} = {}) {
  const calls = [];
  const github = {rest: {
    repos: {compareCommitsWithBasehead: async (input) => {
      calls.push(['compare', input]);
      return {data: {ahead_by: ahead}};
    }},
    pulls: {
      list: async (input) => {calls.push(['list', input]); return {data: existing};},
      create: async (input) => {calls.push(['create', input]); return {data: {html_url: 'https://github.com/bernylinville/cumora/pull/42'}};},
    },
  }};
  return {github, context: {repo: {owner: 'bernylinville', repo: 'cumora'}}, core: {info() {}}, calls};
}

test('up-to-date fork is a read-only no-op', async () => {
  const f = fixture();
  assert.deepEqual(await checkUpstream(f), {created: false});
  assert.deepEqual(f.calls, [['compare', {owner: 'bernylinville', repo: 'cumora', basehead: 'main...yetone:main'}]]);
});

test('upstream commits open one cross-fork PR without touching branches or merging', async () => {
  const f = fixture({ahead: 2});
  const result = await checkUpstream(f);
  assert.equal(result.created, true);
  assert.deepEqual(f.calls.map(([operation]) => operation), ['compare', 'list', 'create']);
  const request = f.calls[2][1];
  assert.equal(request.head, 'yetone:main');
  assert.equal(request.base, 'main');
  assert.equal(request.owner, 'bernylinville');
});

test('existing sync PR is reused rather than duplicated', async () => {
  const url = 'https://github.com/bernylinville/cumora/pull/41';
  const f = fixture({ahead: 3, existing: [{html_url: url}]});
  assert.deepEqual(await checkUpstream(f), {created: false, url});
  assert.deepEqual(f.calls.map(([operation]) => operation), ['compare', 'list']);
});

test('invalid comparison or GitHub failure stops before proposing an update', async () => {
  const invalid = fixture({ahead: undefined});
  invalid.github.rest.repos.compareCommitsWithBasehead = async () => ({data: {}});
  await assert.rejects(checkUpstream(invalid), /valid upstream commit count/);
  assert.equal(invalid.calls.length, 0);
  const failed = fixture();
  failed.github.rest.repos.compareCommitsWithBasehead = async () => {throw new Error('API unavailable');};
  await assert.rejects(checkUpstream(failed), /API unavailable/);
  assert.equal(failed.calls.length, 0);
});
