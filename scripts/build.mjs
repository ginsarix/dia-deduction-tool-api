import { build } from "esbuild";

const sharedOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  sourcemap: true,
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
  }),
  build({
    ...sharedOptions,
    entryPoints: ["src/db/seed.ts"],
    outfile: "dist/seed.js",
  }),
]);

console.log("Build complete.");
