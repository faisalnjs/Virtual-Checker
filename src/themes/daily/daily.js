import "./daily.css";

import * as auth from "/src/modules/auth.js";
import * as ui from "/src/modules/ui.js";
import { syncPwaTheme } from "/src/modules/service-worker.js";

let dailyImage = null;
let pendingRequest = null;

export function addCopyright(parent) {
  const copyright = document.createElement("small");
  copyright.className = "daily-theme-copyright";
  copyright.textContent = dailyImage?.copyright || "Daily image currently unavailable.";
  parent.appendChild(copyright);
  return copyright;
}

function colorLuminance(rgb) {
  const linear = rgb.map(channel => {
    const value = channel / 255;
    return (value <= 0.04045) ? (value / 12.92) : (((value + 0.055) / 1.055) ** 2.4);
  });
  return (linear[0] * 0.2126) + (linear[1] * 0.7152) + (linear[2] * 0.0722);
}

function themePaletteFromPixels({ data, width, height }) {
  const buckets = new Map();
  const distance = (a, b) => a.reduce((sum, value, index) => sum + ((value - b[index]) ** 2), 0);
  const hex = rgb => "#" + rgb.map(value => Math.round(value).toString(16).padStart(2, "0")).join("");
  const contrast = (a, b) => {
    const first = colorLuminance(a);
    const second = colorLuminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const mix = (rgb, target, amount) => rgb.map(value => Math.round((value * (1 - amount)) + (target * amount)));
  const textColor = (rgb, tint) => {
    const target = (contrast([0, 0, 0], rgb) >= contrast([255, 255, 255], rgb)) ? 0 : 255;
    for (let percent = 65; percent <= 100; percent++) {
      const candidate = mix(tint, target, percent / 100);
      if (contrast(candidate, rgb) >= 4.5) return candidate;
    }
    return [target, target, target];
  };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    const key = rgb.map(value => value >> 5).join(",");
    const bucket = buckets.get(key) || { sum: [0, 0, 0], count: 0, edges: 0 };
    rgb.forEach((value, channel) => { bucket.sum[channel] += value; });
    bucket.count++;
    const x = (i / 4) % width;
    const y = Math.floor((i / 4) / width);
    if ((x < (width * 0.1)) || (x >= (width * 0.9)) || (y < (height * 0.1)) || (y >= (height * 0.9))) bucket.edges++;
    buckets.set(key, bucket);
  }
  const colors = [...buckets.values()].map(bucket => ({
    ...bucket, rgb: bucket.sum.map(value => value / bucket.count),
  })).sort((a, b) => b.count - a.count);
  if (!colors.length) throw new Error("Theme image has no opaque pixels");
  const clusters = [];
  for (const color of colors) {
    const nearest = clusters.reduce((best, cluster) => (!best || (distance(color.rgb, cluster.rgb) < distance(color.rgb, best.rgb))) ? cluster : best, null);
    if (nearest && distance(color.rgb, nearest.rgb) < 48 ** 2) {
      nearest.rgb = nearest.rgb.map((value, channel) => ((value * nearest.count) + (color.rgb[channel] * color.count)) / (nearest.count + color.count));
      nearest.count += color.count;
      nearest.edges += color.edges;
    } else {
      clusters.push({ rgb: [...color.rgb], count: color.count, edges: color.edges });
    }
  }
  clusters.sort((a, b) => b.count - a.count);
  const accent = clusters[0].rgb.map(Math.round);
  const background = [...clusters].sort((a, b) => b.edges - a.edges)[0].rgb.map(Math.round);
  const secondary = clusters.find(color => (color.count >= (width * height * 0.03)) && (distance(color.rgb, accent) >= (48 ** 2)))?.rgb || background;
  const text = textColor(background, accent);
  const lightSurface = colorLuminance(text) < colorLuminance(background);
  let surface = mix(secondary, lightSurface ? 255 : 0, lightSurface ? 0.8 : 0.65);
  if (distance(surface, accent) < (60 ** 2)) surface = mix(secondary, (colorLuminance(accent) > 0.179) ? 0 : 255, 0.8);
  const originalSurface = surface;
  for (let percent = 0; (contrast(text, surface) < 4.5) && (percent <= 100); percent++) surface = mix(originalSurface, lightSurface ? 255 : 0, percent / 100);
  const red = colors.find(({ rgb: [r, g, b] }) => (r >= 80) && (r > (g * 1.3)) && (r > (b * 1.15)) && ((r - Math.max(g, b)) > 35));
  return {
    "text-color": hex(text),
    "background-color": hex(background),
    "surface-color": hex(surface),
    "accent-color": hex(accent),
    "accent-text-color": hex(textColor(accent, secondary)),
    "error-color": red ? hex(red.rgb) : "#eb324b",
    "color-scheme": lightSurface ? "light" : "dark",
  };
}

export async function extractPalette(url) {
  const imageUrl = new URL(url, document.baseURI);
  const source = imageUrl.hostname === "img.peapix.com" ? auth.getDailyThemeImageUrl(imageUrl.href) : imageUrl.href;
  const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Theme image unavailable");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    const scale = 64 / Math.max(bitmap.width, bitmap.height);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Theme canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return themePaletteFromPixels(context.getImageData(0, 0, canvas.width, canvas.height));
  } finally {
    bitmap.close();
  }
}

export function random(randomize = false) {
  if (pendingRequest) return pendingRequest;
  pendingRequest = (async () => {
    try {
      const response = await fetch("https://peapix.com/bing/feed", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Daily theme feed unavailable");
      const feed = await response.json();
      const first = Array.isArray(feed) ? feed.filter(item => (typeof item.copyright === "string") && item.copyright.trim())[randomize ? (Math.floor(Math.random() * feed.filter(item => (typeof item.copyright === "string") && item.copyright.trim()).length)) : 0] : null;
      if (!first) throw new Error("Daily theme attribution missing");
      const image = { copyright: first.copyright };
      for (const key of ["imageUrl", "thumbUrl"]) {
        const url = new URL(first[key]);
        if (url.protocol !== "https:") throw new Error("Invalid daily theme image URL");
        image[key] = url.href;
      }
      image.palette = ((dailyImage?.imageUrl === image.imageUrl) && (dailyImage?.thumbUrl === image.thumbUrl) && dailyImage.palette) ? dailyImage.palette : (await extractPalette(image.thumbUrl).catch(() => null));
      for (const key of ["text-color", "background-color", "surface-color", "accent-color", "accent-text-color", "error-color", "color-scheme"]) {
        if (image.palette) {
          document.documentElement.style.setProperty(`--daily-theme-${key}`, image.palette[key]);
        } else {
          document.documentElement.style.removeProperty(`--daily-theme-${key}`);
        }
      }
      dailyImage = image;
      document.documentElement.style.setProperty("--daily-theme-full", `url(${JSON.stringify(image.imageUrl)})`);
      document.documentElement.style.setProperty("--daily-theme-thumb", `url(${JSON.stringify(image.thumbUrl)})`);
      if (!document.querySelector(".daily-theme-wallpaper-copyright")) {
        const copyright = addCopyright(document.body);
        copyright.classList.add("daily-theme-wallpaper-copyright");
      }
      document.querySelectorAll(".daily-theme-copyright").forEach(copyright => {
        copyright.textContent = image.copyright;
      });
      if (document.body.getAttribute("data-theme") === "daily") await syncPwaTheme().catch(() => null);
    } finally {
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}

export function initializeControls(container) {
  if (!container || container.querySelector(".daily-theme-roll")) return;
  const dailyThemeRoll = document.createElement("button");
  dailyThemeRoll.type = "button";
  dailyThemeRoll.className = "icon daily-theme-roll";
  dailyThemeRoll.innerHTML = '<i class="bi bi-dice-5" aria-hidden="true"></i>';
  dailyThemeRoll.setAttribute("tooltip", "Roll Daily Theme");
  dailyThemeRoll.setAttribute("aria-label", "Roll Daily Theme");
  dailyThemeRoll.addEventListener("click", async () => {
    if ((document.body.getAttribute("data-theme") !== "daily") || dailyThemeRoll.disabled) return;
    dailyThemeRoll.disabled = true;
    dailyThemeRoll.setAttribute("aria-busy", "true");
    try {
      await random(true);
    } catch {
      ui.toast("Could not refresh Daily Theme. Please try again.", 3000, "error", "bi bi-exclamation-triangle-fill");
    } finally {
      dailyThemeRoll.disabled = false;
      dailyThemeRoll.removeAttribute("aria-busy");
    }
  });
  container.appendChild(dailyThemeRoll);
}
