import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";
import copy from "rollup-plugin-copy";
import serve from "rollup-plugin-serve";

const isWatch = process.env.ROLLUP_WATCH === "true";

export default [
  // Main bundle (ESM and CJS)
  {
    input: "src/gift-with-purchase.js",
    output: [
      {
        file: "dist/gift-with-purchase.esm.js",
        format: "esm",
        sourcemap: true,
      },
      {
        file: "dist/gift-with-purchase.cjs.js",
        format: "cjs",
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      postcss({
        extract: true,
        minimize: false,
        sourceMap: true,
        use: ["sass"],
      }),
    ],
  },
  // Minified bundle (UMD)
  {
    input: "src/gift-with-purchase.js",
    output: {
      file: "dist/gift-with-purchase.min.js",
      format: "umd",
      name: "GiftWithPurchase",
      sourcemap: true,
    },
    plugins: [
      resolve(),
      postcss({
        extract: "gift-with-purchase.min.css",
        minimize: true,
        sourceMap: true,
        use: ["sass"],
      }),
      terser(),
    ],
  },
  // Demo build
  {
    input: "src/gift-with-purchase.js",
    output: {
      file: "demo/gift-with-purchase.esm.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      resolve(),
      postcss({
        extract: "gift-with-purchase.min.css",
        minimize: true,
        sourceMap: true,
        use: ["sass"],
      }),
      copy({
        targets: [{ src: "src/gift-with-purchase.scss", dest: "dist/" }],
      }),
      ...(isWatch
        ? [
            serve({
              open: true,
              contentBase: ["demo"],
              port: 3000,
            }),
          ]
        : []),
    ],
  },
];
