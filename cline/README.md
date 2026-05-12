# SupraWall × Cline Security Adapter

Wrap any Cline tool with SupraWall's deterministic policy engine.  
Blocks dangerous tool calls before Cline executes them — inline, zero-latency, no cloud required.

[![npm version](https://badge.fury.io/js/%40suprawall%2Fcline.svg)](https://www.npmjs.com/package/@suprawall/cline)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## Install

```bash
npm install @suprawall/cline
```

## Usage — 3 lines

```typescript
import { SupraWallClineMiddleware } from "@suprawall/cline";

const middleware = new SupraWallClineMiddleware({ apiKey: process.env.SUPRAWALL_API_KEY! });

// Wrap Cline's onBeforeToolUse hook
clineAgent.use(middleware.hook());
```

That's it. Any tool call that violates your policies throws a `SupraWallBlocked` error before Cline executes the tool.

## Full example

See [`examples/secured-cline-agent.ts`](./examples/secured-cline-agent.ts).

## What it checks

Every tool call is evaluated against your SupraWall policy set before execution:

| Decision | Behaviour |
|---|---|
| `ALLOW` | Tool call proceeds normally |
| `DENY` | `SupraWallBlocked` thrown — Cline catches and reports to user |
| `REQUIRE_APPROVAL` | Execution paused — approval URL returned |

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `SUPRAWALL_API_KEY` | ✅ | — |
| `SUPRAWALL_AGENT_ID` | No | `"cline-agent"` |
| `SUPRAWALL_API_URL` | No | `https://www.supra-wall.com/api/v1/evaluate` |
| `SUPRAWALL_TIMEOUT_MS` | No | `3000` |

## Links

- [SupraWall docs](https://www.supra-wall.com/docs)
- [GitHub repo](https://github.com/wiserautomation/SupraWall)
- [All integrations](https://www.supra-wall.com/integrations)
