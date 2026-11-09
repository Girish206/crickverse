import { App } from "@capacitor/app";
import { Clipboard } from "@capacitor/clipboard";
import { registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// What the Android app adds on top of the website. Loaded only in the app
// (main.tsx), so the website never downloads it. The pages keep using the
// browser's own share / clipboard calls: those are filled in here with the
// phone's, which the app's web view lacks.

// android/app/src/main/java/in/runmitra/app/AppWindowPlugin.java
const AppWindow = registerPlugin<{
  setBackgroundColor(options: { color: string }): Promise<void>;
  setKeepAwake(options: { on: boolean }): Promise<void>;
}>("AppWindow");

// Light text needed on it? (#rrggbb; anything else counts as dark.)
function isDarkColor(color: string) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim())?.[1];
  if (!hex) return true;
  const n = parseInt(hex, 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 140;
}

// Every page sits between the status bar and the navigation buttons
// (MainActivity.java). The strips behind them take the page's theme-color, as
// Chrome's own bars do on the website, with icons that read on it. It
// follows the colour as the theme changes (useAdminTheme sets it).
function followThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const apply = () => {
    void AppWindow.setBackgroundColor({ color: meta.content });
    void SystemBars.setStyle({ style: isDarkColor(meta.content) ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  };
  apply();
  new MutationObserver(apply).observe(meta, { attributes: true, attributeFilter: ["content"] });
}

// Android's back button: closes an open sheet, picture or dialog first (as
// Escape does on a computer), then goes back a page, and on the first page
// leaves the app.
function handleBackButton() {
  void App.addListener("backButton", ({ canGoBack }) => {
    if (document.querySelector('[aria-modal="true"], .swal2-container')) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    } else if (canGoBack) {
      window.history.back();
    } else {
      void App.exitApp();
    }
  });
}

function base64Of(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// navigator.share through the phone's share sheet. A file (a share card) is
// saved to the app's cache first, since the sheet shares files by path.
async function share(data: ShareData = {}) {
  const files = await Promise.all(
    (data.files ?? []).map(async (file) => {
      const saved = await Filesystem.writeFile({
        path: `share/${file.name.replace(/[^\w.-]+/g, "-")}`,
        data: await base64Of(file),
        directory: Directory.Cache,
        recursive: true,
      });
      return saved.uri;
    }),
  );
  try {
    await Share.share({
      title: data.title,
      text: data.text,
      url: data.url,
      files: files.length ? files : undefined,
      dialogTitle: data.title,
    });
  } catch (err) {
    // Closing the sheet without picking an app isn't a failure; the pages
    // already ignore the browser's AbortError for that.
    if (/cancel/i.test(err instanceof Error ? err.message : String(err))) {
      throw new DOMException("Share canceled", "AbortError");
    }
    throw err;
  }
}

function fillInShare() {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
}

// "Copy link" / "Copy as text": the phone's clipboard, which works without
// the web view's clipboard permission.
function fillInClipboard() {
  const writeText = async (text: string) => {
    await Clipboard.write({ string: text });
  };
  if (navigator.clipboard) Object.defineProperty(navigator.clipboard, "writeText", { value: writeText, configurable: true });
  else Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

// navigator.wakeLock through the window's keep-screen-on flag, which Android
// only honours while the app is showing, so it survives going to the
// background and needs no taking again.
function fillInWakeLock() {
  const request = async () => {
    await AppWindow.setKeepAwake({ on: true });
    const lock = {
      released: false,
      release: async () => {
        lock.released = true;
        await AppWindow.setKeepAwake({ on: false });
      },
    };
    return lock as unknown as WakeLockSentinel;
  };
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
}

export function installNativeShell() {
  followThemeColor();
  handleBackButton();
  fillInShare();
  fillInClipboard();
  fillInWakeLock();
}
