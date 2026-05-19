---
name: deep-browser-explore
description: >-
  Browser MCP exploration and QA: discover base URL from project config, exercise
  critical flows, capture console/network evidence, report defects data-first.
---

# Deep browser explore

Use **Browser MCP** for hands-on QA when the task needs a running app — post-merge verify, UI regressions, or explicit user request.

**Data-first:** dense findings (URL, repro steps, console errors, network failures). No marketing copy.

**Read MCP tool schemas every session** before calling tools — list descriptors under the active Cursor project's `mcps/<browser-server>/tools/` folder.

## Base URL discovery (order)

1. **`.cursor/project.json`** in repo root:

   ```json
   {
     "workflow": {
       "browserBaseUrl": "http://127.0.0.1:3000/"
     }
   }
   ```

2. **Env:** `CURSOR_BROWSER_BASE_URL` or `BROWSER_BASE_URL`

3. **Repo docs:** `WORKFLOW.md` / `README` `{DEPLOY_URL}` or `{VERIFY_COMMAND}` flags (e.g. `--base-url=`)

4. **MCP server config:** list tools under your Browser MCP server folder in the Cursor project `mcps/` directory

5. **Ask once** if none resolve — then proceed with user-provided URL

Always use trailing slash on base URL when joining paths.

## Preflight (mandatory when HTTP smoke exists)

1. Run the project's HTTP smoke command (e.g. `npm test`, `npm run verify:local`, `{VERIFY_COMMAND}`) — exit **0** before deep UI pass unless user waived.
2. If the page shows API/bootstrap errors (empty data shell), **stop** — fix server/data first; browser pass will not validate real flows.
3. Prefer staging or local dev with real data per project rules — no fabricated rows for acceptance.

## MCP tool inventory (typical Browser MCP server)

Read schemas each session; names may vary by server version.

| Tool | Purpose | Key parameters |
|------|---------|----------------|
| `session_create` | Start browser session | `projectId`, `browser`, `headless`, `viewport` |
| `session_close` | End session | `sessionId` |
| `navigate` | Open URL | `url`, `waitUntil` |
| `click` | Click element | `selector`, `timeoutMs` |
| `type` | Fill input | `selector`, `text`, `clearFirst` |
| `hover` | Hover | `selector` |
| `select` | `<select>` option | `selector`, `value` |
| `scroll` | Viewport scroll | offsets per schema |
| `wait_for` | Wait for element or idle | `selector`, `state`, or `strategy` |
| `snapshot_dom` | HTML dump to artifact | `sessionId` |
| `screenshot` | PNG evidence | `fullPage`, `name` (use `.png` suffix) |
| `console_capture` | Console log export | `sessionId` |
| `network_capture` | Network log export | `sessionId` |

### Common gaps

- No arbitrary **`evaluate`** / run JS in page on some servers.
- Clicks may require **CSS selectors** only (strict mode if ambiguous).
- Always pass screenshot `name` ending in `.png` when required by schema.

Call tools via **`CallMcpTool`** after reading the tool descriptor JSON.

## Project-specific selectors

Commit stable selectors in the **project** copy of this skill (`.cursor/skills/deep-browser-explore/SKILL.md`) when they are not generic. Keep this global skill free of private hostnames and repo-specific paths.

## When to run

- After step 9 `{VERIFY_COMMAND}` when UI changed.
- User asks for beta test, visual QA, or "check the app".
- Orchestrator/chief delegates UI verification after merge.

## When NOT to run

- Pure backend/script changes with no web surface.
- Production acceptance when project rules forbid live testing — use staging `{DEPLOY_URL}` instead.

## Output format

```markdown
## Browser QA — <base URL>

### Pass
- <flow>: OK

### Fail
- **<title>** @ `<path>`
  - Repro: …
  - Console: …
  - Network: …

### Blocked
- <reason>
```

## Related

- Orchestrator step 9: `{VERIFY_COMMAND}`
- Global install: `cursor-global-workflow/skills/deep-browser-explore/`
- Sync: `rules/global-feature-sync.mdc`
