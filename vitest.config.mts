import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    env: {
      DOMAIN: "https://short.test",
      TURNSTILE_SECRET_KEY: "test-secret",
      UPSTASH_REDIS_REST_URL: "https://fake-upstash.test",
      UPSTASH_REDIS_REST_TOKEN: "fake-token",
      S3_REGION: "us-east-1",
      S3_ENDPOINT: "https://s3.fake.test",
      S3_ACCESS_KEY: "test-access-key",
      S3_SECRET_KEY: "test-secret-key",
      S3_BUCKET: "test-bucket",
      DESTINATION_URL: "https://files.test",
    },
  },
});
