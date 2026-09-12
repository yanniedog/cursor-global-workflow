import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { changedLinesFromDiff, isReviewablePath, normalizeFindings } from './qwen-pr-review.mjs';
import { isTrivialBotMessage } from './lib/bot-noise.mjs';
const diff = '--- a/a.cpp\n+++ b/a.cpp\n@@ -4,2 +4,3 @@\n---index;\n+++index;\n\\ No newline at end of file\n+next();\n context\n';
const lines = changedLinesFromDiff(diff);
assert.deepEqual([...lines.left], [4]);
assert.deepEqual([...lines.right], [4, 5]);
for (const path of ['src/a.py', 'main.go', 'lib.rs', 'a.cpp', 'a.swift', 'a.tf', 'a.sql', 'Makefile', 'Jenkinsfile', 'CMakeLists.txt', '.gitmodules', 'src/café.py']) assert.ok(isReviewablePath(path));
for (const path of ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'Cargo.lock', 'poetry.lock']) assert.equal(isReviewablePath(path), false);
assert.equal(isTrivialBotMessage('SQL injection in query'), false);
assert.equal(normalizeFindings([{path:'a.cpp', line:4, side:'RIGHT', severity:'high', issue:'Overflow', suggested_fix:'Bound it'}], {reviewedFiles:['a.cpp'], validLines:new Map([['a.cpp',lines]])}).length, 1);
for (const path of ['scripts/qwen-pr-review.mjs', '.cursor/PR_REVIEW_PROMPT.md', '.github/workflows/cursor-auto-pr-review.yml']) {
  assert.equal(readFileSync(path,'utf8'),readFileSync(`templates/${path}`,'utf8'));
}
console.log('Qwen closeout regression checks passed');
