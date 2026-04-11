// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";

export interface SupraWallOptions {
    /** Your Supra-wall API key (sw_...) */
    apiKey?: string;
    /** Override the default API endpoint */
    apiUrl?: string;
    /** Agent identifier shown in audit logs */
    agentId?: string;
    /** Whether to throw on REQUIRE_APPROVAL decisions (default: true) */
    blockOnApproval?: boolean;
}

/**
 * SupraWallCallbackHandler — LangChain EU AI Act compliance integration.
 */
export class SupraWallCallbackHandler extends BaseCallbackHandler {
    name = "SupraWallCallbackHandler";
    private apiKey: string;
    private apiUrl: string;
    private agentId: string;
    private blockOnApproval: boolean;

    constructor(options?: SupraWallOptions) {
        super();
        this.apiKey = options?.apiKey || process.env.SUPRAWALL_API_KEY || "";
        if (!this.apiKey) {
            throw new Error(
                "[Supra-wall] SUPRAWALL_API_KEY is required. Get yours at supra-wall.com"
            );
        }
        this.apiUrl =
            options?.apiUrl ||
            process.env.SUPRAWALL_API_URL ||
            "https://www.supra-wall.com/api/v1/evaluate";
        this.agentId = options?.agentId || "langchain_agent";
        this.blockOnApproval = options?.blockOnApproval !== false;
    }

    private isTestMode(): boolean {
        return this.apiKey.startsWith("sw_test_") || this.apiKey.startsWith("ag_test_");
    }

    async handleToolStart(
        tool: Serialized,
        input: string,
        _runId: string,
        _parentRunId?: string,
        _tags?: string[],
        _metadata?: Record<string, unknown>,
        _runName?: string,
        _toolCallId?: string
    ): Promise<void> {
        if (this.isTestMode()) return;

        // More robust tool name extraction
        const toolName = tool.name || (tool.id?.[tool.id.length - 1] as string) || "unknown";

        let lastError: any;
        const retries = 3;
        
        for (let i = 0; i < retries; i++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

            try {
                const response = await fetch(this.apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                        "x-suprawall-framework": "langchain-ts"
                    },
                    body: JSON.stringify({
                        agentId: this.agentId,
                        toolName,
                        arguments: input, // Standardized key
                    }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    if (response.status < 500) {
                        throw new Error(`[Supra-wall] Service returned ${response.status}`);
                    }
                    throw new Error("[Supra-wall] Network error");
                }

                const data = (await response.json()) as { decision: string; reason?: string };

                if (data.decision === "DENY") {
                    throw new Error(
                        `[Supra-wall] Policy violation: tool '${toolName}' is denied. ${data.reason || ""}`
                    );
                }

                if (data.decision === "REQUIRE_APPROVAL" && this.blockOnApproval) {
                    throw new Error(
                        `[Supra-wall] Tool '${toolName}' requires human approval. ` +
                            `Approve in the Supra-wall dashboard or configure the approval webhook.`
                    );
                }
                
                return; // Success!

            } catch (error: any) {
                lastError = error;
                // Don't retry on policy violations
                if (error.message.includes("Policy violation") || error.message.includes("requires human approval")) {
                    throw error;
                }

                if (i < retries - 1) {
                    const delay = Math.pow(2, i) * 200;
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            } finally {
                clearTimeout(timeoutId);
            }
        }

        // If all retries failed, fail-closed for security
        console.error("[Supra-wall] Error after retries:", lastError?.message);
        throw new Error(
            "[Supra-wall] Could not reach policy server after retries. Failing closed for safety."
        );
    }
}

/**
 * One-line LangChain security wrapper.
 */
export function secureChain<T extends { withConfig: (config: { callbacks: any[] }) => T }>(
    chain: T,
    apiKey: string,
    options?: Omit<SupraWallOptions, "apiKey">
): T {
    const handler = new SupraWallCallbackHandler({ apiKey, ...options });
    return chain.withConfig({ callbacks: [handler] });
}
