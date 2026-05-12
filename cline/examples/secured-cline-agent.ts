// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Example: Cline agent secured with SupraWall
 *
 * Run:
 *   SUPRAWALL_API_KEY=sw_live_... ts-node examples/secured-cline-agent.ts
 *
 * What this demonstrates:
 *   1. Wrapping a Cline agent's onBeforeToolUse hook with SupraWall
 *   2. A DENY decision throwing SupraWallBlocked before execution
 *   3. An ALLOW decision letting the tool call proceed
 *
 * No real Cline runtime is imported here — this shows the hook interface
 * directly so you can copy the pattern into any Cline extension.
 */

import { SupraWallClineMiddleware, SupraWallBlocked, SupraWallApprovalRequired } from "../src/index";

// ---------------------------------------------------------------------------
// Initialize the middleware (reads SUPRAWALL_API_KEY from env)
// ---------------------------------------------------------------------------

const middleware = new SupraWallClineMiddleware({
    apiKey: process.env.SUPRAWALL_API_KEY,
    agentId: "my-cline-coding-agent",
});

const supraWallHook = middleware.hook();

// ---------------------------------------------------------------------------
// Simulate a Cline tool call — destructive command (should be BLOCKED)
// ---------------------------------------------------------------------------

async function runDemoDestructiveCall(): Promise<void> {
    console.log("\n--- Attempting: rm -rf /tmp/workspace ---");
    try {
        await supraWallHook.onBeforeToolUse({
            toolName: "execute_command",
            toolInput: { command: "rm -rf /tmp/workspace" },
            metadata: { runId: "demo-run-001" },
        });
        console.log("✅ ALLOWED — tool would execute");
    } catch (err) {
        if (err instanceof SupraWallBlocked) {
            console.error(`❌ BLOCKED — Policy: ${err.policy}`);
            console.error(`   Reason: ${err.reason}`);
        } else if (err instanceof SupraWallApprovalRequired) {
            console.warn(`⏳ APPROVAL REQUIRED — ${err.approvalUrl}`);
        } else {
            throw err;
        }
    }
}

// ---------------------------------------------------------------------------
// Simulate a Cline tool call — safe read (should ALLOW)
// ---------------------------------------------------------------------------

async function runDemoSafeCall(): Promise<void> {
    console.log("\n--- Attempting: read_file /src/index.ts ---");
    try {
        await supraWallHook.onBeforeToolUse({
            toolName: "read_file",
            toolInput: { path: "/src/index.ts" },
            metadata: { runId: "demo-run-002" },
        });
        console.log("✅ ALLOWED — tool would execute");
    } catch (err) {
        if (err instanceof SupraWallBlocked) {
            console.error(`❌ BLOCKED — Policy: ${err.policy}`);
            console.error(`   Reason: ${err.reason}`);
        } else {
            throw err;
        }
    }
}

(async () => {
    console.log("SupraWall × Cline — security demo");
    console.log("Agent ID:", "my-cline-coding-agent");

    await runDemoDestructiveCall();
    await runDemoSafeCall();

    console.log("\nDone. Star SupraWall: https://github.com/wiserautomation/SupraWall");
})();
