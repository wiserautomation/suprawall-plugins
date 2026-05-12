// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * SupraWall × Cline adapter
 *
 * Intercepts Cline tool calls via the onBeforeToolUse hook and evaluates them
 * against SupraWall's deterministic policy engine before execution.
 *
 * Decision outcomes:
 *   ALLOW            → tool call proceeds normally (no-op)
 *   DENY             → throws SupraWallBlocked (Cline catches and reports)
 *   REQUIRE_APPROVAL → throws SupraWallApprovalRequired with the approval URL
 *
 * Fail-safe behaviour: if SupraWall is unreachable after 3 retries the call is
 * blocked (fail-closed) to prevent security bypasses via network errors.
 */

export class SupraWallBlocked extends Error {
    public readonly policy: string;
    public readonly reason: string;

    constructor(policy: string, reason: string) {
        super(`🛡️ SupraWall BLOCKED: [${policy}] ${reason}`);
        this.name = "SupraWallBlocked";
        this.policy = policy;
        this.reason = reason;
    }
}

export class SupraWallApprovalRequired extends Error {
    public readonly approvalUrl: string;

    constructor(approvalUrl: string) {
        super(`🛡️ SupraWall: Action requires human approval. Visit: ${approvalUrl}`);
        this.name = "SupraWallApprovalRequired";
        this.approvalUrl = approvalUrl;
    }
}

export interface SupraWallClineOptions {
    /** Your SupraWall API key. Alternatively set SUPRAWALL_API_KEY env var. */
    apiKey?: string;
    /** Unique identifier for the agent. Defaults to "cline-agent". */
    agentId?: string;
    /** Override the evaluation URL (useful for self-hosted deployments). */
    apiUrl?: string;
    /** Request timeout in milliseconds. Defaults to 3000. */
    timeoutMs?: number;
}

export interface ClineToolCallContext {
    /** The tool name Cline is about to execute. */
    toolName: string;
    /** The arguments passed to the tool. */
    toolInput: Record<string, unknown>;
    /** Optional Cline-provided run metadata. */
    metadata?: Record<string, unknown>;
}

export interface ClineHook {
    onBeforeToolUse(context: ClineToolCallContext): Promise<void>;
}

export class SupraWallClineMiddleware {
    private readonly apiKey: string;
    private readonly agentId: string;
    private readonly apiUrl: string;
    private readonly timeoutMs: number;
    private readonly isTestMode: boolean;

    constructor(options: SupraWallClineOptions = {}) {
        const resolvedKey = options.apiKey ?? process.env.SUPRAWALL_API_KEY ?? "";
        if (!resolvedKey) {
            throw new Error(
                "[SupraWall] apiKey is required. Pass it as an option or set SUPRAWALL_API_KEY."
            );
        }
        this.apiKey = resolvedKey;
        this.agentId = options.agentId ?? process.env.SUPRAWALL_AGENT_ID ?? "cline-agent";
        this.apiUrl =
            options.apiUrl ??
            process.env.SUPRAWALL_API_URL ??
            "https://www.supra-wall.com/api/v1/evaluate";
        this.timeoutMs = options.timeoutMs ?? Number(process.env.SUPRAWALL_TIMEOUT_MS ?? "3000");
        this.isTestMode = resolvedKey.startsWith("sw_test_") || resolvedKey.startsWith("ag_test_");
    }

    /**
     * Returns a Cline-compatible hook object to be passed to `clineAgent.use()`.
     *
     * @example
     * const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_..." });
     * clineAgent.use(middleware.hook());
     */
    public hook(): ClineHook {
        return {
            onBeforeToolUse: (context: ClineToolCallContext) =>
                this.evaluateToolCall(context),
        };
    }

    private async evaluateToolCall(context: ClineToolCallContext): Promise<void> {
        if (this.isTestMode) return; // Test keys skip evaluation

        const payload = {
            agentId: this.agentId,
            toolName: context.toolName,
            arguments: JSON.stringify(context.toolInput),
            metadata: {
                framework: "cline",
                ...context.metadata,
            },
        };

        let lastError: unknown;

        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), this.timeoutMs);

                let response: Response;
                try {
                    response = await fetch(this.apiUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${this.apiKey}`,
                            "x-suprawall-framework": "cline",
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal,
                    });
                } finally {
                    clearTimeout(timer);
                }

                if (response.ok) {
                    const data = (await response.json()) as {
                        decision: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
                        policy?: string;
                        reason?: string;
                        approvalUrl?: string;
                    };

                    if (data.decision === "DENY") {
                        throw new SupraWallBlocked(
                            data.policy ?? "unknown-policy",
                            data.reason ?? "Blocked by policy."
                        );
                    }

                    if (data.decision === "REQUIRE_APPROVAL") {
                        throw new SupraWallApprovalRequired(
                            data.approvalUrl ?? "https://www.supra-wall.com"
                        );
                    }

                    return; // ALLOW
                }

                // 4xx = client error, do not retry
                if (response.status >= 400 && response.status < 500) {
                    throw new Error(
                        `[SupraWall] API client error ${response.status} — check your API key.`
                    );
                }

                // 5xx or unexpected — store error and retry
                lastError = new Error(`[SupraWall] API returned ${response.status}`);
            } catch (err: unknown) {
                // Re-throw our own typed errors immediately — no retry
                if (err instanceof SupraWallBlocked || err instanceof SupraWallApprovalRequired) {
                    throw err;
                }
                lastError = err;
            }

            if (attempt < 2) {
                await sleep(200 * 2 ** attempt); // 200ms, 400ms backoff
            }
        }

        // Fail-closed after 3 failed attempts
        throw new Error(
            `[SupraWall] Unreachable after 3 attempts (${String(lastError)}). Failing closed.`
        );
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
