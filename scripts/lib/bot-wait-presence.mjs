import { spawnSync } from 'node:child_process';
import {
  allKnownBotLogins,
  formatRequiredKeys,
  isCursorAutoReviewBody,
  missingRequiredKeys,
  resolveRequiredKeys,
} from './bot-wait-config.mjs';

const COMMENTS_QUERY =
  'query($owner:String!,$name:String!,$num:Int!){repository(owner:$owner,name:$name){pullRequest(number:$num){createdAt comments(last:100){nodes{author{login}createdAt body}}reviews(last:30){nodes{author{login}submittedAt body}}reviewThreads(last:100){nodes{comments(last:10){nodes{author{login}createdAt body}}}}}}}';

function ghGraphql(owner, name, prNumber) {
  const r = spawnSync(
    'gh',
    [
      'api',
      'graphql',
      '-f',
      `query=${COMMENTS_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `num=${prNumber}`,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || 'gh api graphql failed').trim());
  }
  return JSON.parse(r.stdout || '{}');
}

export function collectBotEvents(prPayload, knownBots, anchorIso) {
  const anchorMs = new Date(anchorIso).getTime();
  const events = [];
  const pushEvent = (login, at, body) => {
    if (!login || !at) return;
    if (login.toLowerCase() === 'github-actions[bot]' && !isCursorAutoReviewBody(body)) return;
    events.push({ login, at });
  };
  for (const c of prPayload.comments?.nodes || []) {
    pushEvent(c.author?.login, c.createdAt, c.body);
  }
  for (const rev of prPayload.reviews?.nodes || []) {
    pushEvent(rev.author?.login, rev.submittedAt, rev.body);
  }
  for (const t of prPayload.reviewThreads?.nodes || []) {
    for (const c of t.comments?.nodes || []) {
      pushEvent(c.author?.login, c.createdAt, c.body);
    }
  }
  return events.filter(
    (e) => knownBots.has(e.login.toLowerCase()) && new Date(e.at).getTime() >= anchorMs,
  );
}

export function checkRequiredBotsOnPr(owner, name, prNumber, { requiredKeys, anchorIso } = {}) {
  const keys = requiredKeys || resolveRequiredKeys();
  const knownBots = allKnownBotLogins(keys);
  const data = ghGraphql(owner, name, prNumber);
  const pr = data?.data?.repository?.pullRequest;
  if (!pr) throw new Error('GraphQL: pull request not found');
  const anchor = anchorIso || pr.createdAt;
  const events = collectBotEvents(pr, knownBots, anchor);
  const seenLogins = [...new Set(events.map((e) => e.login))];
  const missing = missingRequiredKeys(keys, seenLogins);
  return {
    requiredKeys: keys,
    anchor,
    missing,
    botsSeen: seenLogins,
    ok: missing.length === 0,
    detail: formatRequiredKeys(keys),
  };
}
