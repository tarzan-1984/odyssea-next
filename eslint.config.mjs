import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

const eslintConfig = [
	// Global ignores
	{
		ignores: [
			"node_modules/**",
			".next/**",
			"out/**",
			"build/**",
			"dist/**",
			"*.min.js",
			"*.min.css",
			"*.map",
			"src/app-api/api-types.ts",
			"jest.config.js",
			"jest.setup.js",
		],
	},
	// Jest configuration files specific rules
	{
		files: ["jest.config.js", "jest.setup.js"],
		languageOptions: {
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
		},
		rules: {
			"no-undef": "off", // Отключаем проверку неопределенных переменных для Jest файлов
			"@typescript-eslint/no-explicit-any": "off", // Разрешаем any в Jest файлах
			"@typescript-eslint/no-require-imports": "off", // Разрешаем require() в Jest файлах
			"react/display-name": "off", // Отключаем проверку display name для моков
		},
	},
	// Base configuration
	...compat.extends("next/core-web-vitals", "next/typescript"),
	// Global rules for all files
	{
		rules: {
			// Basic code quality rules
			"no-console": "off",
			"no-debugger": "error",
			"no-alert": "warn",
			"no-var": "error",
			"prefer-const": "error",
			"no-unused-vars": "off",
			"no-undef": "warn",
			"no-redeclare": "error",
			"no-unreachable": "error",
			"no-constant-condition": "error",
			"no-dupe-keys": "error",
			"no-dupe-args": "error",
			"no-dupe-class-members": "error",
			"no-dupe-else-if": "error",
			"no-empty": "error",
			"no-empty-function": "off",
			"no-eval": "error",
			"no-implied-eval": "error",
			"no-new-func": "error",
			"no-obj-calls": "error",
			"no-script-url": "error",
			"no-self-compare": "error",
			"no-sequences": "error",
			"no-throw-literal": "error",
			"no-unmodified-loop-condition": "error",
			"no-useless-call": "error",
			"no-useless-concat": "error",
			"no-useless-escape": "error",
			"no-useless-return": "error",
			"no-void": "error",
			"prefer-promise-reject-errors": "error",
			"require-await": "warn",
			yoda: "error",
		},
	},
	// TypeScript files specific rules
	{
		files: ["**/*.ts", "**/*.tsx"],
		rules: {
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-non-null-assertion": "off",
		},
	},
	// Configuration files specific rules
	{
		files: ["*.config.js", "*.config.mjs", "*.config.ts"],
		rules: {
			"@typescript-eslint/no-var-requires": "off",
			"import/no-commonjs": "off",
		},
	},
	// Test files specific rules
	{
		files: [
			"**/*.test.ts",
			"**/*.test.tsx",
			"**/*.spec.ts",
			"**/*.spec.tsx",
			"**/__tests__/**/*",
			"jest.config.js",
			"jest.setup.js",
		],
		languageOptions: {
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
			},
		},
		rules: {
			"no-undef": "off", // Отключаем проверку неопределенных переменных для тестов
			"@typescript-eslint/no-explicit-any": "off", // Разрешаем any в тестах
			"@typescript-eslint/no-require-imports": "off", // Разрешаем require() в Jest файлах
			"react/display-name": "off", // Отключаем проверку display name для моков
		},
	},
];

export default eslintConfig;
