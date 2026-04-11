import initialize from "../src/index";
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SupraWallMCP", () => {
    it("should bypass in test mode", async () => {
        const plugin = await initialize({ apiKey: "sw_test_123" });
        const result = await plugin.tools.check_policy({ toolName: "test", args: {} });
        expect(result.decision).toBe("ALLOW");
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it("should fail closed on API error", async () => {
        mockedAxios.post.mockRejectedValue(new Error("Network Error"));
        const plugin = await initialize({ apiKey: "sw_real_key" });
        const result = await plugin.tools.check_policy({ toolName: "test", args: {} });
        expect(result.decision).toBe("DENY");
        expect(result.reason).toContain("unreachable");
    });
});
