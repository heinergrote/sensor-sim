import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  // @sensor-sim/shared ships TypeScript source — bundle it, node can't load it from node_modules
  deps: {
    alwaysBundle: ["@sensor-sim/shared"],
  },
  dts: false,
  target: false,
});
