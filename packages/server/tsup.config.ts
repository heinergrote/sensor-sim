import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  // @sensor-sim/shared ships TypeScript source — bundle it, node can't load it from node_modules
  noExternal: ["@sensor-sim/shared"],
});
