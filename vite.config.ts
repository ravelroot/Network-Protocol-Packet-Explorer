import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const POLITICA = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

const seguranca = (): Plugin => ({
  name: 'ocelo-seguranca',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: POLITICA }, injectTo: 'head-prepend' },
  ],
});

export default defineConfig({
  base: './',
  plugins: [seguranca()],
  build: {
    target: 'es2022',
    sourcemap: false,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
