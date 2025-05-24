import pluginNext from "@next/eslint-plugin-next"
import reactCompiler from "eslint-plugin-react-compiler"
import pluginReactHooks from "eslint-plugin-react-hooks"
import { defineConfig } from "eslint/config"
import globals from "globals"
import tseslint from "typescript-eslint"

export default defineConfig([
	{
		files: [
			"src/**/*.{jsx,tsx}"
			// You can add more specific paths if needed, e.g., "src/components/**/*.{jsx,tsx}", "src/app/**/*.{jsx,tsx}"
		],
		ignores: [
			// Combined ignore patterns from biome.json
			"dist/**/*",
			"node_modules/**/*",
			"public/**/*",
			"**/*.css",
			".wrangler/**/*",
			".next/**/*",
			".open-next/**/*",
			"cloudflare-env.d.ts",
			"**/*.md"
			// Add any other ESLint-specific ignores if necessary
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
				sourceType: "module",
				ecmaVersion: "latest"
			},
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		plugins: {
			"react-hooks": pluginReactHooks,
			next: pluginNext,
			"react-compiler": reactCompiler
		},
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"react-compiler/react-compiler": "error",
			// Disable jsx-a11y/prefer-tag-over-role when we intentionally use div with role="button"
			// to avoid nested button issues
			"jsx-a11y/prefer-tag-over-role": "off"
		}
	}
])
