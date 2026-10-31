// Raptor Download Manager Service Worker
// Network Media Sniffer, HLS/m3u8 Stream Interceptor & Native Bridge Controller

const DEFAULT_EXTENSIONS = [
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'zst',
  'exe', 'msi', 'bat', 'cmd', 'apk',
  'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm3u8', 'mpd', 'ts', 'm4s',
  'mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'bin', 'dmg', 'pkg', 'deb', 'rpm'
];

// In-memory registry of media streams detected per browser tab
// tabId => Array<{ id, url, type, typeName, ext, title, referer, timestamp, size }>
const detectedMediaByTab = new Map();

let bypassNextDownload = false;
let bypassTimestamp = 0;

// Domains to ignore during network sniffing to avoid tracking / ad pixels
const AD_AND_TRACKER_DOMAINS = [
  'google-analytics.com', 'googlesyndication.com', 'doubleclick.net',
  'pagead2.googlesyndication.com', 'adservice.google.', 'adnxs.com',
  'facebook.com/tr/', 'connect.facebook.net', 'adroll.com', 'criteo.com',
  'scorecardresearch.com', 'taboola.com', 'outbrain.com', 'yandex.ru',
  'hotjar.com', 'clarity.ms', 'newrelic.com', 'segment.io', 'datadoghq.com',
  'telemetry', 'analytics', 'beacon', 'pixel'
];

function isAdOrTracker(urlStr) {
  if (!urlStr) return true;
  const lower = urlStr.toLowerCase();
  return AD_AND_TRACKER_DOMAINS.some(domain => lower.includes(domain));
}

function cleanMediaTitle(rawTitle) {
  if (!rawTitle) return 'Video Stream';
  return rawTitle
    .replace(/ - YouTube$/i, '')
    .replace(/ \| Hdfilmcehennemi$/i, '')
    .replace(/ - Hdfilmcehennemi$/i, '')
    .replace(/ \| Film izle.*$/i, '')
    .replace(/ izle.*$/i, '')
    .replace(/ Full HD izle.*$/i, '')
    .replace(/ 1080p izle.*$/i, '')
    .replace(/ \| Pornhub$/i, '')
    .replace(/ - TikTok$/i, '')
    .replace(/ : [^:]+ : Reddit$/i, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .trim() || 'Video Stream';
}

// 1. Initialize Extension on Install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get([
    'interceptEnabled',
    'activeManager',
    'fileExtensions',
    'excludedDomains'
  ]);

  if (existing.interceptEnabled === undefined) {
    await chrome.storage.local.set({
      interceptEnabled: true,
      activeManager: 'hyperdownload',
      fileExtensions: DEFAULT_EXTENSIONS,
      excludedDomains: [],
      useNativeMessaging: true,
      bridgePort: 9145
    });
  }

  // Setup right-click context menus
  chrome.contextMenus.create({
    id: 'raptor-download-link',
    title: 'Raptor ile İndir',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'raptor-download-media',
    title: 'Raptor ile Medyayı İndir',
    contexts: ['video', 'audio', 'image']
  });
});

// Handle right-click context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const targetUrl = info.linkUrl || info.srcUrl;
  if (!targetUrl) return;

  const referer = tab?.url || '';
  await triggerDownloadToHyperDownload(targetUrl, referer, null);
});

// 2. High-Performance Passive Network Media Sniffer (IDM Style)
// Sniffs HTTP responses across all tabs & frames for .m3u8, .mpd, .mp4 and video/audio MIME types
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (!details || details.tabId < 0) return;
    if (isAdOrTracker(details.url)) return;

    const lowerUrl = details.url.toLowerCase();
    
    // Ignore data and blob URLs from network listener
    if (lowerUrl.startsWith('data:') || lowerUrl.startsWith('blob:')) return;

    // Check for Content-Type
    let contentType = '';
    let contentLength = null;
    if (details.responseHeaders) {
      for (const h of details.responseHeaders) {
        const hName = h.name.toLowerCase();
        if (hName === 'content-type' && h.value) {
          contentType = h.value.toLowerCase();
        } else if (hName === 'content-length' && h.value) {
          contentLength = parseInt(h.value, 10);
        }
      }
    }

    const isHls = lowerUrl.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('application/x-mpegurl');
    const isDash = lowerUrl.includes('.mpd') || contentType.includes('application/dash+xml');
    
    // Prevent spamming individual transport segments (.ts or .m4s fragments)
    const isFragment = lowerUrl.includes('.ts?') || lowerUrl.endsWith('.ts') || lowerUrl.includes('.m4s') || lowerUrl.includes('frag-') || lowerUrl.includes('segment-');
    if (isFragment && !isHls) {
      return;
    }

    const isDirectVideo = lowerUrl.endsWith('.mp4') || lowerUrl.includes('.mp4?') ||
                          lowerUrl.endsWith('.webm') || lowerUrl.includes('.webm?') ||
                          lowerUrl.endsWith('.mkv') || lowerUrl.includes('.mkv?') ||
                          contentType.startsWith('video/');

    const isAudioStream = lowerUrl.endsWith('.mp3') || lowerUrl.includes('.mp3?') ||
                          lowerUrl.endsWith('.m4a') || lowerUrl.includes('.m4a?') ||
                          contentType.startsWith('audio/');

    if (!isHls && !isDash && !isDirectVideo && !isAudioStream) {
      return;
    }

    // Determine stream type & metadata
    let type = 'video';
    let typeName = 'MP4 Video';
    let ext = 'mp4';

    if (isHls) {
      type = 'hls';
      typeName = 'HLS Akışı (.m3u8)';
      ext = 'mp4';
    } else if (isDash) {
      type = 'dash';
      typeName = 'DASH Akışı (.mpd)';
      ext = 'mp4';
    } else if (isAudioStream) {
      type = 'audio';
      typeName = 'Ses Akışı (.mp3)';
      ext = 'mp3';
    }

    // Register into detectedMediaByTab
    let list = detectedMediaByTab.get(details.tabId);
    if (!list) {
      list = [];
      detectedMediaByTab.set(details.tabId, list);
    }

    // Deduplicate against already detected URLs
    const urlBase = details.url.split('?')[0];
    const exists = list.some(item => {
      const itemBase = item.url.split('?')[0];
      return itemBase === urlBase || item.url === details.url;
    });

    if (exists) return;

    // Fetch tab info asynchronously to obtain clean title
    chrome.tabs.get(details.tabId, (tab) => {
      const tabTitle = cleanMediaTitle(tab?.title);
      const referer = details.initiator || tab?.url || details.documentUrl || '';

      const mediaItem = {
        id: 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        url: details.url,
        type: type,
        typeName: typeName,
        ext: ext,
        title: tabTitle,
        referer: referer,
        size: contentLength,
        timestamp: Date.now()
      };

      list.push(mediaItem);

      // Keep max 25 streams per tab
      if (list.length > 25) {
        list.shift();
      }

      // Update extension badge
      chrome.action.setBadgeText({ tabId: details.tabId, text: String(list.length) });
      chrome.action.setBadgeBackgroundColor({ tabId: details.tabId, color: '#10b981' });
      chrome.action.setTitle({ tabId: details.tabId, title: `Raptor: ${list.length} medya akışı yakalandı!` });

      // Notify content script in that tab
      chrome.tabs.sendMessage(details.tabId, {
        type: 'STREAM_SNIFFED',
        media: mediaItem
      }).catch(() => {});
    });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Tab Lifecycle: clear detected media when tab is refreshed or closed
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedMediaByTab.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    detectedMediaByTab.delete(tabId);
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }
});

// 3. Message Dispatcher for Content Scripts & Popups
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_BYPASS_NEXT') {
    bypassNextDownload = true;
    bypassTimestamp = Date.now();
    sendResponse({ ok: true });
  } else if (message.type === 'CHECK_ENGINE_HEALTH') {
    checkEngineHealth().then(status => sendResponse(status));
    return true;
  } else if (message.type === 'GET_DETECTED_MEDIA') {
    const tabId = message.tabId || _sender?.tab?.id;
    const media = tabId ? (detectedMediaByTab.get(tabId) || []) : [];
    sendResponse({ media });
    return true;
  } else if (message.type === 'CLEAR_DETECTED_MEDIA') {
    const tabId = message.tabId || _sender?.tab?.id;
    if (tabId) {
      detectedMediaByTab.delete(tabId);
      chrome.action.setBadgeText({ tabId: tabId, text: '' });
    }
    sendResponse({ ok: true });
  } else if (message.type === 'GET_TAB_INFO') {
    const tabId = _sender?.tab?.id;
    if (tabId) {
      chrome.tabs.get(tabId, (tab) => {
        sendResponse({ title: cleanMediaTitle(tab?.title), url: tab?.url });
      });
      return true;
    }
    sendResponse({ title: 'Video Stream', url: '' });
  } else if (message.type === 'START_MEDIA_DOWNLOAD') {
    (async () => {
      const cookies = await getCookiesForUrl(message.url);
      const referer = message.referer || _sender?.tab?.url || '';
      const success = await sendToHyperDownload({
        url: message.url,
        referer: referer,
        cookie: cookies,
        filename: message.filename || null,
        quality: message.quality || null
      });
      sendResponse({ ok: success });
    })();
    return true;
  }
});

// 4. Intercept standard browser file downloads via onDeterminingFilename
// This intercepts before Chrome creates files or prompts the user, precisely like IDM!
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // If user bypassed with Alt or manually
  if (bypassNextDownload && (Date.now() - bypassTimestamp < 5000)) {
    bypassNextDownload = false;
    suggest();
    return;
  }

  // Blob or data URLs are generated internally by web apps
  if (downloadItem.url.startsWith('blob:') || downloadItem.url.startsWith('data:')) {
    suggest();
    return;
  }

  chrome.storage.local.get([
    'interceptEnabled',
    'activeManager',
    'fileExtensions',
    'excludedDomains'
  ], async (settings) => {
    if (settings.interceptEnabled === false || settings.activeManager === 'browser') {
      suggest();
      return;
    }

    const urlObj = safeParseUrl(downloadItem.url);
    if (urlObj && settings.excludedDomains && settings.excludedDomains.length > 0) {
      const isExcluded = settings.excludedDomains.some(d => urlObj.hostname.endsWith(d));
      if (isExcluded) {
        suggest();
        return;
      }
    }

    const rawFilename = downloadItem.filename || urlObj?.pathname?.split('/').pop() || '';
    const cleanFn = rawFilename.split('\\').pop()?.split('/').pop() || '';
    const ext = cleanFn.split('.').pop()?.toLowerCase() || '';
    const allowedExts = settings.fileExtensions || DEFAULT_EXTENSIONS;

    // Check if extension matches or MIME type is downloadable binary
    const isMimeDownloadable = downloadItem.mime && (
      downloadItem.mime.includes('octet-stream') ||
      downloadItem.mime.includes('x-msdownload') ||
      downloadItem.mime.includes('zip') ||
      downloadItem.mime.includes('compressed') ||
      downloadItem.mime.includes('tar') ||
      downloadItem.mime.includes('iso') ||
      downloadItem.mime.includes('executable')
    );

    const matchesExt = ext && allowedExts.includes(ext);

    if (!matchesExt && !isMimeDownloadable) {
      suggest();
      return;
    }

    // Cancel in Chrome so Chrome doesn't download it or pop up Chrome's shelf
    try {
      chrome.downloads.cancel(downloadItem.id, () => {
        chrome.downloads.erase({ id: downloadItem.id });
      });
    } catch (e) {
      console.warn('Could not cancel Chrome download:', e);
    }

    // Get cookies and send metadata to Raptor
    const cookies = await getCookiesForUrl(downloadItem.url);
    const referer = downloadItem.referrer || '';
    const targetUrl = downloadItem.finalUrl || downloadItem.url;

    const payload = {
      url: targetUrl,
      referer: referer,
      cookie: cookies,
      filename: cleanFn || null,
      fileSize: downloadItem.fileSize > 0 ? downloadItem.fileSize : null,
      mime: downloadItem.mime || null
    };

    const success = await sendToHyperDownload(payload);
    if (!success) {
      // If Raptor was not running, fall back to Chrome download
      console.warn('Raptor engine unreachable; falling back to Chrome download');
      bypassNextDownload = true;
      bypassTimestamp = Date.now();
      chrome.downloads.download({
        url: targetUrl,
        filename: cleanFn || undefined
      });
    }
  });

  return true; // Keep suggest callback valid asynchronously
});

async function triggerDownloadToHyperDownload(url, referer, customFilename) {
  const cookies = await getCookiesForUrl(url);
  return await sendToHyperDownload({
    url,
    referer,
    cookie: cookies,
    filename: customFilename
  });
}

// Retrieve valid session cookies for the domain
async function getCookiesForUrl(url) {
  try {
    const parsed = safeParseUrl(url);
    if (!parsed) return null;

    let cookies = await chrome.cookies.getAll({ url });
    if ((!cookies || cookies.length === 0) && (url.includes('fbcdn.net') || url.includes('cdninstagram.com'))) {
      try {
        cookies = await chrome.cookies.getAll({ domain: 'instagram.com' });
      } catch {}
    }
    if (!cookies || cookies.length === 0) return null;

    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (err) {
    console.warn('Failed to read cookies for domain:', err);
    return null;
  }
}

// Send payload to Raptor Desktop App via Native Messaging or Axum REST Bridge
async function sendToHyperDownload(payload) {
  const settings = await chrome.storage.local.get(['useNativeMessaging', 'bridgePort']);
  const bridgePort = settings.bridgePort || 9145;

  // 1. Try Native Messaging Host first
  if (settings.useNativeMessaging !== false) {
    try {
      const nativeResp = await sendNativeMessage('com.raptor.native', payload);
      if (nativeResp && nativeResp.success) {
        return true;
      }
    } catch {
      try {
        const legacyResp = await sendNativeMessage('com.hyperdownload.native', payload);
        if (legacyResp && legacyResp.success) return true;
      } catch {}
    }
  }

  // 2. Loopback Axum REST Bridge (127.0.0.1:9145)
  try {
    const resp = await fetch(`http://127.0.0.1:${bridgePort}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return resp.ok;
  } catch (httpErr) {
    console.warn('Could not communicate with Raptor engine:', httpErr);
    return false;
  }
}

function sendNativeMessage(hostName, message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(hostName, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

async function checkEngineHealth() {
  try {
    const settings = await chrome.storage.local.get(['bridgePort']);
    const port = settings.bridgePort || 9145;
    const resp = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
    if (resp.ok) {
      const data = await resp.json();
      return { online: true, port, service: data.service || 'Raptor Core' };
    }
  } catch (e) {
    // Engine offline
  }
  return { online: false, port: 9145 };
}

function safeParseUrl(str) {
  try {
    return new URL(str);
  } catch {
    return null;
  }
}
