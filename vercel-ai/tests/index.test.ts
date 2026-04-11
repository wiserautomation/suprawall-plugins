import { withsuprawall } from "../src/index";

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe("withsuprawall", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should throw if apiKey is missing", () => {
        expect(() => withsuprawall({}, { apiKey: "" })).toThrow();
    });

    it("should bypass in test mode", async () => {
        const tool = { execute: jest.fn().mockResolvedValue("success") };
        const secured = withsuprawall({ myTool: tool }, { apiKey: "sw_test_123" });
        
        const result = await secured.myTool.execute({ arg: 1 });
        expect(result).toBe("success");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should block on DENY", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ decision: "DENY" }),
        });

        const tool = { execute: jest.fn() };
        const secured = withsuprawall({ myTool: tool }, { apiKey: "sw_real_key" });
        
        await expect(secured.myTool.execute({ arg: 1 })).rejects.toThrow("Policy Violation");
        expect(tool.execute).not.toHaveBeenCalled();
    });
});
