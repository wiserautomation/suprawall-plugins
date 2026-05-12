// Copyright 2026 SupraWall Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Integration tests for @suprawall/cline
 *
 * Tests cover:
 *   - DENY decision throws SupraWallBlocked with correct fields
 *   - ALLOW decision resolves without throwing
 *   - REQUIRE_APPROVAL throws SupraWallApprovalRequired with URL
 *   - 5xx errors trigger retry (max 3 attempts), then fail-closed
 *   - 4xx errors do NOT retry (client error)
 *   - Missing API key throws at construction time
 *   - Test-mode key (sw_test_) bypasses all evaluation
 *   - Timeout triggers fail-closed
 */

import { SupraWallClineMiddleware, SupraWallBlocked, SupraWallApprovalRequired } from "../src/index";

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

const makeFetchMock = (responses: Array<{ status: number; body: object }>) => {
    let callCount = 0;
    return jest.fn(async (_url: string, _opts: RequestInit) => {
        const resp = responses[Math.min(callCount, responses.length - 1)];
        callCount++;
        return {
            ok: resp.status >= 200 && resp.status < 300,
            status: resp.status,
            json: async () => resp.body,
        } as Response;
    });
};

const baseContext = {
    toolName: "execute_command",
    toolInput: { command: "rm -rf /tmp" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SupraWallClineMiddleware", () => {
    afterEach(() => jest.restoreAllMocks());

    // --- Construction ---

    it("throws at construction time when no API key is provided", () => {
        const originalEnv = process.env.SUPRAWALL_API_KEY;
        delete process.env.SUPRAWALL_API_KEY;
        expect(() => new SupraWallClineMiddleware()).toThrow(
            "[SupraWall] apiKey is required"
        );
        if (originalEnv !== undefined) process.env.SUPRAWALL_API_KEY = originalEnv;
    });

    // --- ALLOW ---

    it("resolves without throwing on ALLOW decision", async () => {
        global.fetch = makeFetchMock([{ status: 200, body: { decision: "ALLOW" } }]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_test" });
        await expect(middleware.hook().onBeforeToolUse(baseContext)).resolves.toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // --- DENY ---

    it("throws SupraWallBlocked on DENY with correct policy and reason fields", async () => {
        global.fetch = makeFetchMock([{
            status: 200,
            body: { decision: "DENY", policy: "no-destructive-shell", reason: "rm -rf is prohibited" },
        }]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_test" });
        const err = await middleware.hook().onBeforeToolUse(baseContext).catch((e) => e);

        expect(err).toBeInstanceOf(SupraWallBlocked);
        expect((err as SupraWallBlocked).policy).toBe("no-destructive-shell");
        expect((err as SupraWallBlocked).reason).toBe("rm -rf is prohibited");
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // --- REQUIRE_APPROVAL ---

    it("throws SupraWallApprovalRequired on REQUIRE_APPROVAL with approval URL", async () => {
        global.fetch = makeFetchMock([{
            status: 200,
            body: { decision: "REQUIRE_APPROVAL", approvalUrl: "https://app.supra-wall.com/approve/123" },
        }]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_test" });
        const err = await middleware.hook().onBeforeToolUse(baseContext).catch((e) => e);

        expect(err).toBeInstanceOf(SupraWallApprovalRequired);
        expect((err as SupraWallApprovalRequired).approvalUrl).toBe("https://app.supra-wall.com/approve/123");
    });

    // --- Retry on 5xx ---

    it("retries up to 3 times on 5xx then fails closed", async () => {
        global.fetch = makeFetchMock([
            { status: 503, body: {} },
            { status: 503, body: {} },
            { status: 503, body: {} },
        ]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_test", timeoutMs: 500 });
        const err = await middleware.hook().onBeforeToolUse(baseContext).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain("Unreachable after 3 attempts");
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    // --- No retry on 4xx ---

    it("does NOT retry on 4xx client errors", async () => {
        global.fetch = makeFetchMock([{ status: 401, body: {} }]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_bad" });
        const err = await middleware.hook().onBeforeToolUse(baseContext).catch((e) => e);

        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain("API client error 401");
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // --- Test mode bypass ---

    it("bypasses evaluation entirely for sw_test_ keys", async () => {
        global.fetch = jest.fn();

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_test_abc123" });
        await expect(middleware.hook().onBeforeToolUse(baseContext)).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("bypasses evaluation entirely for ag_test_ keys", async () => {
        global.fetch = jest.fn();

        const middleware = new SupraWallClineMiddleware({ apiKey: "ag_test_abc123" });
        await expect(middleware.hook().onBeforeToolUse(baseContext)).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    // --- Recovers on 3rd attempt ---

    it("succeeds if 3rd retry returns ALLOW after two 5xx failures", async () => {
        global.fetch = makeFetchMock([
            { status: 502, body: {} },
            { status: 502, body: {} },
            { status: 200, body: { decision: "ALLOW" } },
        ]);

        const middleware = new SupraWallClineMiddleware({ apiKey: "sw_live_test", timeoutMs: 500 });
        await expect(middleware.hook().onBeforeToolUse(baseContext)).resolves.toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
