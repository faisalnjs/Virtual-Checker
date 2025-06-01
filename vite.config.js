import webfontDownload from "vite-plugin-webfont-dl";
import version from "vite-plugin-package-version";

export default {
  appType: 'mpa',
  plugins: [webfontDownload(), version()],
  build: {
    rollupOptions: {
      input: {
        main: new URL('index.html', import.meta.url).pathname,
        error: new URL('404.html', import.meta.url).pathname,
        resetcookies: new URL('resetcookies.html', import.meta.url).pathname,
        admin: new URL('admin/index.html', import.meta.url).pathname,
        questions: new URL('admin/questions.html', import.meta.url).pathname,
        upload: new URL('admin/upload.html', import.meta.url).pathname,
        responses: new URL('admin/responses.html', import.meta.url).pathname,
      },
    },
  },
};