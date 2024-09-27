import webfontDownload from "vite-plugin-webfont-dl";
import version from "vite-plugin-package-version";

export default {
  appType: 'mpa',
  plugins: [webfontDownload(), version()],
  build: {
    rollupOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        nested: new URL('admin/index.html', import.meta.url).pathname,
      },
    },
  },
};