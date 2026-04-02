import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['tests/**/*.test.ts'],
        // Give API tests more time (fetch-url timeout test hits real network)
        testTimeout: 25000,
    },
});
