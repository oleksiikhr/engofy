import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    environment: 'node',
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        // Tests
        'src/**/*.spec.ts',
        'src/**/*.ispec.ts',

        // Types
        'src/**/*.d.ts',

        // Auto-generated files
        'src/metadata.ts',

        // DTOs are data shape declarations — constructors have no logic to test
        'src/**/*.dto.ts',

        // Database scripts
        'src/core/database/migrations/**',

        // Application entrypoints / bootstrap files
        'src/main.ts',
        'src/cli.ts',
        'src/cron.ts',
        'src/worker.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          setupFiles: ['./test/setup/unit.setup.ts'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.ispec.ts'],
          isolate: false,
          maxWorkers: 1,
          fileParallelism: false,
          typecheck: { enabled: false },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
