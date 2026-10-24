import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".vinext/**",
      ".wrangler/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "workers/**",
    ],
  },
];

export default eslintConfig;
