/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    globals: {
        "ts-jest": {
            tsconfig: "tsconfig.json",
        },
    },
    // Extend timeout for retry tests (200ms + 400ms backoff)
    testTimeout: 10000,
};
