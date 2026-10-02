// Open a cross-fork PR, never reset the fork or execute newly fetched upstream code.
module.exports = async function checkUpstream({github, context, core}) {
  const {owner, repo} = context.repo;
  const head = 'yetone:main';
  const {data: comparison} = await github.rest.repos.compareCommitsWithBasehead({
    owner, repo, basehead: `main...${head}`,
  });
  if (!Number.isSafeInteger(comparison.ahead_by) || comparison.ahead_by < 0) {
    throw new Error('GitHub did not return a valid upstream commit count');
  }
  if (comparison.ahead_by === 0) {
    core.info('The fork already contains all upstream commits; no PR needed.');
    return {created: false};
  }
  const {data: existing} = await github.rest.pulls.list({owner, repo, head, base: 'main', state: 'open'});
  if (existing.length) {
    core.info(`Upstream update PR already open: ${existing[0].html_url}`);
    return {created: false, url: existing[0].html_url};
  }
  const {data: pr} = await github.rest.pulls.create({
    owner, repo, head, base: 'main',
    title: 'chore: sync Cumora upstream',
    body: [
      'An upstream update is available. This PR imports upstream commits without replacing the fork-only GHCR workflow.',
      '',
      `Compare: https://github.com/${owner}/${repo}/compare/main...${head}`,
      '',
      '- Approve the bot-triggered workflows if GitHub requests it; wait for PR checks to pass.',
      '- Review migrations, OAuth and BYOA compatibility before accepting the update.',
      '- Use **Create a merge commit**, not squash/rebase, to preserve upstream ancestry for the next sync.',
      '- Merging publishes a SHA-tagged GHCR image. VPS deployment remains a separate digest-update PR in vps-ansible.',
      '- This automation never approves or merges a PR and never deploys production.',
    ].join('\n'),
  });
  core.info(`Opened upstream update PR: ${pr.html_url}`);
  return {created: true, url: pr.html_url};
};
