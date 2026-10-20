import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts"],
  format: ["esm"],
  outDir: "dist",
  // keep .js (package is "type": "module") — compose.yaml runs dist/migrate.js against pinned image versions
  fixedExtension: false,
  clean: true,
  // @sensor-sim/shared ships TypeScript source — bundle it, node can't load it from node_modules
  deps: {
    // regex, not a string: a string only matches the bare id, not subpath exports like /geoUtils
    alwaysBundle: [/^@sensor-sim\/shared(\/|$)/],
  },
  dts: false,
  target: false,
});
