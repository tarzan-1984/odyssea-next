const eslintConfig = [
	// Jest configuration files specific rules
	{
		files: ["jest.config.js", "jest.setup.js"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
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
				// React globals
				React: "readonly",
			},
		},
		rules: {
			"no-undef": "off", // Disable undefined variable checks for Jest files
			"@typescript-eslint/no-explicit-any": "off", // Allow use of `any` in Jest files
			"@typescript-eslint/no-require-imports": "off", // Allow require() in Jest files
			"react/display-name": "off", // Disable display name rule for mocks
		},
	},
];

export default eslintConfig;
