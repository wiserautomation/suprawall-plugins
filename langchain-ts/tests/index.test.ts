import { SupraWallCallbackHandler } from "../src/index";

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe("SupraWallCallbackHandler", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should throw error if apiKey is missing", () => {
        expect(() => new SupraWallCallbackHandler({ apiKey: "" })).toThrow();
    });

    it("should bypass in test mode", async () => {
        const handler = new SupraWallCallbackHandler({ apiKey: "sw_test_123" });
        await expect(handler.handleToolStart({ id: ["test"] } as any, "input", "id")).resolves.toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should call evaluate and throw on DENY", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ decision: "DENY", reason: "Blocked" }),
        });

        const handler = new SupraWallCallbackHandler({ apiKey: "sw_real_key" });
        await expect(handler.handleToolStart({ id: ["tool"] } as any, "input", "id")).rejects.toThrow("Policy violation");
    });
});
