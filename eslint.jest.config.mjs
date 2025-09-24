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
			"no-undef": "off", // Отключаем проверку неопределенных переменных для Jest файлов
			"@typescript-eslint/no-explicit-any": "off", // Разрешаем any в Jest файлах
			"@typescript-eslint/no-require-imports": "off", // Разрешаем require() в Jest файлах
			"react/display-name": "off", // Отключаем проверку display name для моков
		},
	},
];

export default eslintConfig;
