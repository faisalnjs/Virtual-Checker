export function registerServiceWorker(version) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register(`/service-worker.js?v=${encodeURIComponent(version)}`, { scope: '/' }).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}