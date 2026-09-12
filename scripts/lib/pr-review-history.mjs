import { spawnSync } from 'node:child_process';

export function fetchReviewHistory(owner, name, number) {
  const result = spawnSync('gh', ['api', '--paginate', '--slurp',
    `repos/${owner}/${name}/pulls/${number}/reviews?per_page=100`],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || 'Cannot fetch review history');
  }
  return JSON.parse(result.stdout).flat().map(review => ({
    author: { login: review.user?.login }, submittedAt: review.submitted_at, body: review.body,
  }));
}
