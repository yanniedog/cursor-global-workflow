---
name: deep-browser-explore
description: >-
  Browser MCP exploration and QA: discover base URL from project config, exercise
  critical flows, capture console/network evidence, report defects data-first.
---

# Deep browser explore

Use **Browser MCP** for hands-on QA when the task needs a running app — post-merge verify, UI regressions, or explicit user request.

**Data-first:** dense findings (URL, repro steps, console errors, network failures). No marketing copy.

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

4. **MCP server config:** list tools under `mcps/user-browser_agent_cursor/` (or your Browser MCP server name) in the Cursor project folder

5. **Ask once** if none resolve — then proceed with user-provided URL

Always use trailing slash on base URL when joining paths.

## MCP usage

1. List/read Browser MCP tool schemas before calling (`CallMcpTool`).
2. Navigate to base URL; confirm HTTP 200 or expected redirect.
3. Exercise **critical flows** relevant to the change (not exhaustive sitemap crawl unless asked).
4. Check **console** and **network** for errors on changed surfaces.
5. Screenshot or snapshot only when it proves a defect.

## When to run

- After step 9 `{VERIFY_COMMAND}` when UI changed.
- User asks for beta test, visual QA, or "check the dashboard".
- Orchestrator/chief delegates UI verification after merge.

## When NOT to run

- Pure backend/script changes with no web surface.
- Acceptance environment is production and user forbade live testing — use staging `{DEPLOY_URL}` instead.

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

## Project override

Teams may commit `.cursor/project.json` (see `templates/project.json.example` in cursor-global-workflow). Do not commit secrets or auth tokens — use local env for authenticated sessions.

## Related

- Orchestrator step 9: `{VERIFY_COMMAND}`
- Global install: `cursor-global-workflow/skills/deep-browser-explore/`
