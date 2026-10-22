const preprocess = require("svelte-preprocess");

module.exports = {
  preprocess: preprocess({
    typescript: {
      compilerOptions: {
        // Imports used by Svelte markup must survive TypeScript transpilation.
        preserveValueImports: true,
      },
    },
  }),
};
