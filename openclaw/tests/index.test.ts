import { secureClaw } from "../src/index";

jest.mock("suprawall", () => ({
    protect: jest.fn((agent, options) => {
        return agent; // Return original agent in mock
    }),
}));

describe("secureClaw", () => {
    it("should call protect with options", () => {
        const agent = { browser: {} };
        const options = { apiKey: "test_key" };
        const secured = secureClaw(agent, options);
        
        const { protect } = require("suprawall");
        expect(protect).toHaveBeenCalledWith(agent, options);
        expect(secured).toBe(agent);
    });
});
