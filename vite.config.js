/* eslint-disable no-undef */
import webfontDownload from "vite-plugin-webfont-dl";

export default {
  plugins: [webfontDownload()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
};
