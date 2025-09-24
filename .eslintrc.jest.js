module.exports = {
	env: {
		jest: true,
		node: true,
	},
	globals: {
		// Jest globals
		jest: "readonly",
		describe: "readonly",
		it: "readonly",
		test: "readonly",
		expect: "readonly",
		beforeEach: "readonly",
		afterEach: "readonly",
		beforeAll: "readonly",
		afterAll: "readonly",
		// Additional Jest globals
		before: "readonly",
		after: "readonly",
		// Testing Library globals
		screen: "readonly",
		render: "readonly",
		fireEvent: "readonly",
		waitFor: "readonly",
		act: "readonly",
		// Node.js globals
		module: "readonly",
		require: "readonly",
		process: "readonly",
		global: "readonly",
	},
	rules: {
		"no-undef": "off",
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/no-require-imports": "off",
		"react/display-name": "off",
	},
};
