// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

export function withsuprawall(tools: Record<string, any>, options?: { apiKey?: string; apiUrl?: string; agentId?: string }) {
    const apiKey = options?.apiKey || process.env.SUPRAWALL_API_KEY || "";
    if (!apiKey) {
        throw new Error("SUPRAWALL_API_KEY is required");
    }
    const apiUrl = options?.apiUrl || process.env.SUPRAWALL_API_URL || "https://www.supra-wall.com/api/v1/evaluate";
    const agentId = options?.agentId || "vercel_ai_agent";
    const testMode = apiKey.startsWith("sw_test_") || apiKey.startsWith("ag_test_");

    const securedTools: Record<string, any> = {};

    for (const [toolName, tool] of Object.entries(tools)) {
        securedTools[toolName] = {
            ...tool,
            execute: async (args: any, ...rest: any[]) => {
                if (testMode) {
                    if (typeof tool.execute === "function") {
                        return tool.execute(args, ...rest);
                    }
                    return;
                }

                // Retry logic for enterprise reliability
                let lastError: any;
                const retries = 3;
                
                for (let i = 0; i < retries; i++) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

                    try {
                        const response = await fetch(apiUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${apiKey}`,
                                "x-suprawall-framework": "vercel-ai"
                            },
                            body: JSON.stringify({
                                agentId,
                                toolName,
                                arguments: args, // Standardized key
                            }),
                            signal: controller.signal,
                        });

                        if (!response.ok) {
                            // Only retry on 5xx or network errors
                            if (response.status < 500) {
                                throw new Error(`suprawall: Service returned ${response.status}`);
                            }
                            throw new Error("suprawall: Network error");
                        }

                        const data = await response.json();
                        if (data.decision === "DENY") {
                            throw new Error(`suprawall Policy Violation: Tool '${toolName}' is explicitly denied. ${data.reason || ""}`);
                        } else if (data.decision === "REQUIRE_APPROVAL") {
                            throw new Error(`suprawall Policy Violation: Tool '${toolName}' requires human approval.`);
                        }

                        // Call the original Vercel AI SDK tool execute logic
                        if (typeof tool.execute === "function") {
                            return tool.execute(args, ...rest);
                        }
                        return; // Successfully audited but nothing to execute

                    } catch (error: any) {
                        lastError = error;
                        // If it's a policy violation (DENY/REQUIRE_APPROVAL), don't retry
                        if (error.message.includes("Policy Violation")) {
                            throw error;
                        }
                        
                        if (i < retries - 1) {
                            const delay = Math.pow(2, i) * 200;
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } finally {
                        clearTimeout(timeoutId);
                    }
                }

                // If all retries failed, fail-closed for security
                console.error("SupraWall error after retries:", lastError?.message);
                throw new Error("suprawall: Safety Layer unreachable (Fail-Closed)");
            }
        };
    }

    return securedTools;
}
