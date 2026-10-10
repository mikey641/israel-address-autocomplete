import { defineConfig } from "tsup";

const shared = {
  format: ["esm", "cjs"] as ("esm" | "cjs")[],
  dts: true,
  sourcemap: true,
  target: "es2022",
  external: ["react"],
};

export default defineConfig([
  { ...shared, entry: { index: "src/index.ts" }, clean: true },
  // The React entry keeps its "use client" directive so it can be imported straight
  // into a Next.js App Router server component tree.
  { ...shared, entry: { react: "src/react.tsx" }, banner: { js: '"use client";' } },
]);
