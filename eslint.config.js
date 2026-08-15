import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['AVATAR_OPTIONS'] },
      ],
    },
  },
  {
    // TanStack Router file-based routes must export `Route` (a non-component)
    // alongside a local component; fast-refresh doesn't apply to route modules.
    files: ['src/routes/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
