module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>"],
	testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	moduleFileExtensions: ["ts", "js", "json"],
	// 与 tsconfig.json 的 paths 对齐，src/ 里的模块才能用 @src/… 互相引用而不影响单测
	moduleNameMapper: {
		"^@src/(.*)$": "<rootDir>/src/$1",
		"^@styles/(.*)$": "<rootDir>/styles/$1",
	},
	collectCoverageFrom: [
		"src/**/*.ts",
		"!src/**/*.d.ts",
		"!**/*.test.ts",
		"!**/*.spec.ts",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
};
