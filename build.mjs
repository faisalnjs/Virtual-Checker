import { build } from "vite";
import config from "./vite.config.js";

const entries = Object.entries(config.build.rollupOptions.input);

for (const [index, [name, input]] of entries.entries()) {
  await build({
    ...config,
    configFile: false,
    build: {
      ...config.build,
      emptyOutDir: index === 0,
      rolldownOptions: {
        ...config.build.rolldownOptions,
        input: { [name]: input },
      },
      rollupOptions: {
        ...config.build.rollupOptions,
        input: { [name]: input },
      },
    },
  });
}
