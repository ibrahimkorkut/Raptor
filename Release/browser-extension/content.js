// Raptor Download Manager - High-Performance In-Page Media Sniffer & Grabber Bar
// IDM-Style Floating Video Panel with Iframe & HLS/m3u8 Stream Detection

(function () {
  'use strict';

  // Alt-click bypass for native browser downloads
  document.addEventListener('click', (event) => {
    if (event.altKey) {
      const link = event.target.closest('a');
      if (link && link.href) {
        chrome.runtime.sendMessage({ type: 'SET_BYPASS_NEXT' });
      }
    }
  }, true);

  const IDM_PANEL_ID = 'raptor-video-sniffer-panel';
  let activePanel = null;
  let detectedStreamUrl = '';
  let detectedStreamReferer = '';
  let cachedTabTitle = '';

  // Listen for messages from background service worker (Network Sniffer)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STREAM_SNIFFED' && message.media) {
      detectedStreamUrl = message.media.url;
      detectedStreamReferer = message.media.referer || '';
      if (message.media.title && !cachedTabTitle) {
        cachedTabTitle = message.media.title;
      }
      inspectAndAttach();
    }
  });

  // Injected CSS Styles for Modern Ultra-Sleek Glassmorphic Raptor Grabber
  const STYLES = `
    #${IDM_PANEL_ID} {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.3;
      user-select: none;
      box-sizing: border-box;
      direction: ltr;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      filter: drop-shadow(0 10px 25px rgba(0, 0, 0, 0.5));
      animation: hdSlideDown 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes hdSlideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    #${IDM_PANEL_ID}.hd-fixed-panel {
      position: fixed;
      top: 18px;
      right: 22px;
    }

    #${IDM_PANEL_ID} * {
      box-sizing: border-box;
    }

    .hd-grabber-btn {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      padding: 7px 14px;
      background: rgba(14, 20, 16, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(74, 222, 128, 0.32);
      border-radius: 9999px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.65), 0 0 15px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15);
      cursor: pointer;
      color: #f1f5f9;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .hd-grabber-btn:hover {
      background: rgba(18, 28, 20, 0.96);
      border-color: rgba(163, 230, 53, 0.7);
      transform: translateY(-1px) scale(1.02);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 22px rgba(74, 222, 128, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }

    .hd-icon-pulse {
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 0 5px rgba(163, 230, 53, 0.6));
      animation: hdPulse 2.5s infinite ease-in-out;
    }

    @keyframes hdPulse {
      0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px rgba(163, 230, 53, 0.5)); }
      50% { transform: scale(1.08); filter: drop-shadow(0 0 9px rgba(163, 230, 53, 0.9)); }
    }

    .hd-brand-container {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hd-brand-badge {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      background: linear-gradient(135deg, #a3e635 0%, #4ade80 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-transform: uppercase;
    }

    .hd-divider-dot {
      color: rgba(255, 255, 255, 0.25);
      font-size: 10px;
    }

    .hd-grabber-title {
      font-weight: 600;
      color: #f8fafc;
      font-size: 12px;
      letter-spacing: -0.1px;
      white-space: nowrap;
    }

    .hd-btn-action {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      padding: 2px 3px;
      border-radius: 6px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .hd-btn-action:hover {
      color: #4ade80;
      background: rgba(255, 255, 255, 0.08);
    }

    .hd-open-active .hd-btn-action {
      transform: rotate(180deg);
      color: #a3e635;
    }

    .hd-close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.45);
      padding: 3px;
      border-radius: 50%;
      transition: all 0.15s ease;
      cursor: pointer;
      margin-left: 2px;
    }

    .hd-close-btn:hover {
      color: #f87171;
      background: rgba(239, 68, 68, 0.2);
    }

    .hd-grabber-btn.hd-success {
      background: linear-gradient(135deg, #15803d 0%, #22c55e 100%) !important;
      border-color: #86efac !important;
      box-shadow: 0 0 28px rgba(34, 197, 94, 0.7) !important;
      color: #ffffff !important;
    }

    .hd-grabber-btn.hd-success .hd-grabber-title {
      color: #ffffff;
      font-weight: 700;
    }

    /* DROPDOWN MENU */
    .hd-dropdown-menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      min-width: 330px;
      max-width: 440px;
      background: rgba(13, 19, 14, 0.96);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(74, 222, 128, 0.25);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.8), 0 0 25px rgba(34, 197, 94, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 8px;
      margin-top: 8px;
      z-index: 2147483647;
      overflow: hidden;
    }

    .hd-dropdown-menu.hd-open {
      display: block;
      animation: hdMenuFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes hdMenuFadeIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .hd-menu-header {
      padding: 10px 12px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.18), rgba(163, 230, 53, 0.08));
      border: 1px solid rgba(74, 222, 128, 0.35);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.18s ease;
      margin-bottom: 8px;
    }

    .hd-menu-header:hover {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(163, 230, 53, 0.18));
      border-color: rgba(163, 230, 53, 0.65);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(34, 197, 94, 0.25);
    }

    .hd-menu-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .hd-download-circle {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.25);
      border: 1px solid rgba(74, 222, 128, 0.5);
      color: #a3e635;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .hd-menu-header-text {
      display: flex;
      flex-direction: column;
    }

    .hd-menu-header-title {
      color: #f8fafc;
      font-weight: 700;
      font-size: 12px;
    }

    .hd-menu-header-sub {
      color: #86efac;
      font-size: 10px;
      font-weight: 500;
    }

    .hd-recommended-badge {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #15803d;
      background: #86efac;
      padding: 2px 7px;
      border-radius: 9999px;
    }

    .hd-menu-section-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
      padding: 4px 10px 6px;
    }

    .hd-menu-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .hd-menu-item {
      padding: 8px 10px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #e2e8f0;
      cursor: pointer;
      font-size: 11.5px;
      transition: all 0.12s ease;
    }

    .hd-menu-item:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      transform: translateX(2px);
    }

    .hd-item-left {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
      flex: 1;
    }

    .hd-item-index {
      font-weight: 700;
      color: #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      width: 14px;
    }

    .hd-menu-item:hover .hd-item-index {
      color: #a3e635;
    }

    .hd-item-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .hd-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .hd-badge-hd {
      background: rgba(99, 102, 241, 0.18);
      color: #c7d2fe;
      border: 1px solid rgba(99, 102, 241, 0.35);
    }

    .hd-badge-audio {
      background: rgba(245, 158, 11, 0.18);
      color: #fde047;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .hd-menu-footer {
      padding: 8px 10px 4px;
      margin-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.07);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }

    /* Instagram Per-Post In-Feed Button Styles */
    .raptor-ig-container {
      display: inline-flex !important;
      align-items: center !important;
      position: relative !important;
      vertical-align: middle !important;
      margin-right: 8px !important;
      z-index: 50 !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    }

    .raptor-ig-container.raptor-ig-floating {
      position: absolute !important;
      top: 12px !important;
      right: 12px !important;
      z-index: 1000 !important;
      margin-right: 0 !important;
    }

    .raptor-ig-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 4px 10px !important;
      background: rgba(14, 22, 16, 0.94) !important;
      backdrop-filter: blur(14px) !important;
      -webkit-backdrop-filter: blur(14px) !important;
      border: 1px solid rgba(74, 222, 128, 0.38) !important;
      border-radius: 9999px !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px rgba(74, 222, 128, 0.15) !important;
      cursor: pointer !important;
      color: #f1f5f9 !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      line-height: 1.2 !important;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    .raptor-ig-btn:hover {
      background: rgba(20, 32, 22, 0.98) !important;
      border-color: #a3e635 !important;
      transform: translateY(-1px) scale(1.02) !important;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.65), 0 0 14px rgba(74, 222, 128, 0.35) !important;
    }

    .raptor-ig-brand {
      font-size: 10.5px !important;
      font-weight: 800 !important;
      letter-spacing: 0.5px !important;
      background: linear-gradient(135deg, #a3e635 0%, #4ade80 100%) !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      text-transform: uppercase !important;
    }

    .raptor-ig-dot {
      color: rgba(255, 255, 255, 0.3) !important;
      font-size: 9px !important;
    }

    .raptor-ig-text {
      color: #f8fafc !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      white-space: nowrap !important;
    }

    .raptor-ig-arrow {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #94a3b8 !important;
      padding: 1px 2px !important;
      border-radius: 4px !important;
      transition: all 0.15s ease !important;
    }

    .raptor-ig-arrow:hover {
      color: #a3e635 !important;
      background: rgba(255, 255, 255, 0.1) !important;
    }

    .raptor-ig-btn.hd-success {
      background: linear-gradient(135deg, #15803d 0%, #22c55e 100%) !important;
      border-color: #86efac !important;
      box-shadow: 0 0 20px rgba(34, 197, 94, 0.75) !important;
      color: #ffffff !important;
    }

    .raptor-ig-btn.hd-success .raptor-ig-text {
      color: #ffffff !important;
      font-weight: 700 !important;
    }

    .raptor-ig-dropdown {
      display: none;
      position: absolute !important;
      top: 100% !important;
      right: 0 !important;
      margin-top: 6px !important;
      min-width: 210px !important;
      background: rgba(14, 22, 16, 0.98) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(74, 222, 128, 0.35) !important;
      border-radius: 12px !important;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.8), 0 0 16px rgba(34, 197, 94, 0.2) !important;
      padding: 6px !important;
      z-index: 2147483647 !important;
    }

    .raptor-ig-dropdown.hd-open {
      display: block !important;
      animation: raptorIgFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    @keyframes raptorIgFadeIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .raptor-ig-dropdown-item {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 7px 10px !important;
      border-radius: 8px !important;
      color: #e2e8f0 !important;
      font-size: 11.5px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.12s ease !important;
    }

    .raptor-ig-dropdown-item:hover {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #ffffff !important;
    }

    /* Chomping Pacman Keyframes for Raptor Mascot */
    @keyframes raptorChompUpper {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(-14deg); }
    }
    @keyframes raptorChompLower {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(18deg); }
    }
    @keyframes raptorDotFeed {
      0% { transform: translateX(12px); opacity: 0; }
      20% { opacity: 1; }
      80% { opacity: 1; }
      100% { transform: translateX(-4px); opacity: 0; }
    }

    .raptor-anim-upper {
      transform-origin: 3px 14px;
      animation: raptorChompUpper 0.38s infinite ease-in-out;
    }

    .raptor-anim-lower {
      transform-origin: 3px 15px;
      animation: raptorChompLower 0.38s infinite ease-in-out;
    }

    .raptor-anim-dots {
      animation: raptorDotFeed 0.38s infinite linear;
    }

    /* Speed up chomping on hover or when download triggers */
    .hd-grabber-btn:hover .raptor-anim-upper,
    .raptor-ig-btn:hover .raptor-anim-upper,
    .hd-grabber-btn.hd-success .raptor-anim-upper,
    .raptor-ig-btn.hd-success .raptor-anim-upper {
      animation-duration: 0.22s;
    }

    .hd-grabber-btn:hover .raptor-anim-lower,
    .raptor-ig-btn:hover .raptor-anim-lower,
    .hd-grabber-btn.hd-success .raptor-anim-lower,
    .raptor-ig-btn.hd-success .raptor-anim-lower {
      animation-duration: 0.22s;
    }

    .hd-grabber-btn:hover .raptor-anim-dots,
    .raptor-ig-btn:hover .raptor-anim-dots,
    .hd-grabber-btn.hd-success .raptor-anim-dots,
    .raptor-ig-btn.hd-success .raptor-anim-dots {
      animation-duration: 0.22s;
    }
  `;

  function injectStyles() {
    if (document.getElementById('raptor-injected-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'raptor-injected-styles';
    styleEl.textContent = STYLES;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // Retrieve clean title from document, meta tags, or parent window/background
  function getMediaTitle() {
    if (cachedTabTitle) return cachedTabTitle;

    // Check specific meta tags (og:title, twitter:title)
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle && ogTitle.trim().length > 3) {
      return sanitizeTitle(ogTitle);
    }

    // YouTube specific
    if (window.location.hostname.includes('youtube.com')) {
      const ytTitleEl = document.querySelector('ytd-watch-metadata #title h1, h1.ytd-video-primary-info-renderer, #title h1');
      if (ytTitleEl && ytTitleEl.textContent.trim()) {
        return sanitizeTitle(ytTitleEl.textContent);
      }
    }

    // Streaming movie sites (e.g. hdfilmcehennemi, dizipal, fullhdfilmizlesene)
    const h1Title = document.querySelector('.film-title, .entry-title, h1.title, h1')?.textContent;
    if (h1Title && h1Title.trim().length > 3 && !h1Title.toLowerCase().includes('izle')) {
      return sanitizeTitle(h1Title);
    }

    const docTitle = document.title;
    if (docTitle && docTitle.trim().length > 3) {
      return sanitizeTitle(docTitle);
    }

    return 'Video Stream';
  }

  function sanitizeTitle(raw) {
    if (!raw) return 'Video Stream';
    return raw
      .replace(/ - YouTube$/i, '')
      .replace(/ \| Hdfilmcehennemi$/i, '')
      .replace(/ - Hdfilmcehennemi$/i, '')
      .replace(/ \| Film izle.*$/i, '')
      .replace(/ - Full HD Film.*$/i, '')
      .replace(/ 1080p izle.*$/i, '')
      .replace(/ Full HD izle.*$/i, '')
      .replace(/ izle.*$/i, '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .trim() || 'Video Stream';
  }

  // Fetch parent tab title if we are inside an iframe
  if (window !== window.top) {
    chrome.runtime.sendMessage({ type: 'GET_TAB_INFO' }, (res) => {
      if (res && res.title) {
        cachedTabTitle = res.title;
      }
    });
  }

  // Quality streams menu
  function getAvailableStreams(title) {
    return [
      { label: `${title} - En Yüksek Kalite (Best Video)`, quality: 'best', badge: '1080p HD', badgeClass: 'hd-badge-hd', ext: 'mp4' },
      { label: `${title} - 1080p Full HD`, quality: '1080p', badge: '1080p', badgeClass: 'hd-badge-hd', ext: 'mp4' },
      { label: `${title} - 720p HD`, quality: '720p', badge: '720p', badgeClass: 'hd-badge-hd', ext: 'mp4' },
      { label: `${title} - 480p SD`, quality: '480p', badge: '480p', badgeClass: '', ext: 'mp4' },
      { label: `${title} - Sadece Ses (MP3 Formatında)`, quality: 'audio-320k', badge: 'MP3 Ses', badgeClass: 'hd-badge-audio', ext: 'mp3' },
    ];
  }

  const RAPTOR_DINO_ICON_SVG = `
    <svg viewBox="0 -4 34 27" width="19" height="15" fill="#a3e635" shape-rendering="crispEdges" style="overflow: visible;">
      <!-- Feeding Pacman Data Dots -->
      <g class="raptor-anim-dots" fill="#facc15">
        <rect x="25" y="11" width="2.2" height="2.2" rx="0.5" />
        <rect x="31" y="11" width="2.2" height="2.2" rx="0.5" />
      </g>
      <!-- Upper Skull & Jaw -->
      <g class="raptor-anim-upper">
        <rect x="8" y="0" width="5" height="1" />
        <rect x="8" y="1" width="6" height="1" />
        <rect x="7" y="2" width="7" height="1" />
        <rect x="7" y="3" width="8" height="1" />
        <rect x="6" y="4" width="4" height="1" />
        <rect x="12" y="4" width="3" height="1" />
        <rect x="6" y="5" width="4" height="1" />
        <rect x="12" y="5" width="4" height="1" />
        <rect x="0" y="6" width="10" height="1" />
        <rect x="12" y="6" width="12" height="1" />
        <rect x="0" y="7" width="25" height="1" />
        <rect x="0" y="8" width="25" height="1" />
        <rect x="0" y="9" width="25" height="1" />
        <rect x="0" y="10" width="16" height="1" />
        <rect x="18" y="10" width="3" height="1" />
        <rect x="23" y="10" width="2" height="1" />
        <rect x="0" y="11" width="16" height="1" />
        <rect x="18" y="11" width="3" height="1" />
        <rect x="23" y="11" width="2" height="1" />
        <rect x="0" y="12" width="16" height="1" />
        <rect x="18" y="12" width="3" height="1" />
        <rect x="23" y="12" width="2" height="1" />
        <rect x="0" y="13" width="24" height="1" />
        <rect x="0" y="14" width="9" height="1" />
        <rect x="0" y="15" width="9" height="1" />
        <g fill="#0f1712">
          <rect x="10" y="4" width="2" height="2" />
          <rect x="16" y="10" width="2" height="3" />
          <rect x="21" y="10" width="2" height="3" />
        </g>
      </g>
      <!-- Lower Jaw & Chin -->
      <g class="raptor-anim-lower">
        <rect x="1" y="16" width="21" height="1" />
        <rect x="2" y="17" width="19" height="1" />
        <rect x="3" y="18" width="18" height="1" />
        <rect x="4" y="19" width="16" height="1" />
        <rect x="5" y="20" width="14" height="1" />
        <g fill="#0f1712">
          <rect x="9" y="14" width="16" height="2" />
        </g>
      </g>
    </svg>
  `;

  // Create or update the floating IDM button & dropdown widget
  function createSnifferWidget(container, directMediaUrl = null) {
    if (document.getElementById(IDM_PANEL_ID)) {
      if (directMediaUrl) detectedStreamUrl = directMediaUrl;
      return;
    }

    const panel = document.createElement('div');
    panel.id = IDM_PANEL_ID;

    const isFixed = !container || container === document.body || container === document.documentElement;
    if (isFixed) {
      panel.classList.add('hd-fixed-panel');
    }

    const title = getMediaTitle();
    const streams = getAvailableStreams(title);

    panel.innerHTML = `
      <div class="hd-grabber-btn" id="hd-main-btn" title="Raptor Çok Parçalı Video İndirici">
        <div class="hd-icon-pulse">
          ${RAPTOR_DINO_ICON_SVG}
        </div>
        <div class="hd-brand-container">
          <span class="hd-brand-badge">RAPTOR</span>
          <span class="hd-divider-dot">•</span>
          <span class="hd-grabber-title">Bu videoyu indir</span>
        </div>
        <div class="hd-btn-action" id="hd-chevron-btn" title="Kalite Seçenekleri">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div class="hd-close-btn" id="hd-close-panel" title="Bu paneli gizle">
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
      <div class="hd-dropdown-menu" id="hd-menu">
        <div class="hd-menu-header" id="hd-download-all">
          <div class="hd-menu-header-left">
            <div class="hd-download-circle">
              <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
                <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="hd-menu-header-text">
              <span class="hd-menu-header-title">En yüksek kalitede hemen indir</span>
              <span class="hd-menu-header-sub">Orijinal kalitede doğrudan çek</span>
            </div>
          </div>
          <span class="hd-recommended-badge">ÖNERİLEN</span>
        </div>
        <div class="hd-menu-section-label">Mevcut Kalite Akışları</div>
        <div class="hd-menu-items">
          ${streams.map((item, idx) => `
            <div class="hd-menu-item" data-quality="${item.quality}" data-ext="${item.ext}">
              <div class="hd-item-left">
                <span class="hd-item-index">${idx + 1}</span>
                <span class="hd-item-text" title="${item.label}">${item.label}</span>
              </div>
              ${item.badge ? `<span class="hd-badge ${item.badgeClass}">${item.badge}</span>` : ''}
            </div>
          `).join('')}
        </div>
        <div class="hd-menu-footer">
          <span>Raptor Hızlandırılmış İndirici</span>
          <span>Çok Parçalı Motor</span>
        </div>
      </div>
    `;

    if (!isFixed) {
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(panel);
    } else {
      (document.body || document.documentElement).appendChild(panel);
    }

    activePanel = panel;

    const mainBtn = panel.querySelector('#hd-main-btn');
    const menu = panel.querySelector('#hd-menu');
    const closeBtn = panel.querySelector('#hd-close-panel');
    const titleSpan = panel.querySelector('.hd-grabber-title');

    // Toggle menu
    mainBtn.addEventListener('click', (e) => {
      if (closeBtn.contains(e.target)) return;
      const isOpen = menu.classList.toggle('hd-open');
      mainBtn.classList.toggle('hd-open-active', isOpen);
    });

    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.style.display = 'none';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target)) {
        menu.classList.remove('hd-open');
        mainBtn.classList.remove('hd-open-active');
      }
    });

    // Execute download helper
    const triggerDownload = (quality, ext) => {
      const currentTitle = getMediaTitle();
      const safeName = `${currentTitle}_${quality}.${ext}`;
      const targetUrl = detectedStreamUrl || directMediaUrl || window.location.href;

      mainBtn.classList.add('hd-success');
      titleSpan.textContent = '✓ Raptor\'a Gönderildi!';

      setTimeout(() => {
        mainBtn.classList.remove('hd-success');
        titleSpan.textContent = 'Bu videoyu indir';
      }, 3500);

      chrome.runtime.sendMessage({
        type: 'START_MEDIA_DOWNLOAD',
        url: targetUrl,
        filename: safeName,
        quality: quality,
        referer: (detectedStreamUrl && targetUrl === detectedStreamUrl && detectedStreamReferer)
          ? detectedStreamReferer
          : window.location.href
      });
    };

    // Item click
    panel.querySelectorAll('.hd-menu-item').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('hd-open');
        const quality = opt.getAttribute('data-quality');
        const ext = opt.getAttribute('data-ext') || 'mp4';
        triggerDownload(quality, ext);
      });
    });

    // Download header click
    const dlAll = panel.querySelector('#hd-download-all');
    if (dlAll) {
      dlAll.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('hd-open');
        triggerDownload('best', 'mp4');
      });
    }
  }

  // Create an individual Raptor download button for an Instagram post or reel
  function createInstagramButtonForPost(postContainer, isFloating) {
    const container = document.createElement('div');
    container.className = 'raptor-ig-container' + (isFloating ? ' raptor-ig-floating' : '');

    container.innerHTML = `
      <div class="raptor-ig-btn" title="Raptor ile bu videoyu indir">
        <div style="display:inline-flex;align-items:center;filter:drop-shadow(0 0 4px rgba(163,230,53,0.6));">
          ${RAPTOR_DINO_ICON_SVG}
        </div>
        <span class="raptor-ig-brand">RAPTOR</span>
        <span class="raptor-ig-dot">•</span>
        <span class="raptor-ig-text">İndir</span>
        <span class="raptor-ig-arrow" title="Format seçenekleri">
          <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </span>
      </div>
      <div class="raptor-ig-dropdown">
        <div class="raptor-ig-dropdown-item" data-quality="best" data-ext="mp4">
          <span>🎬 En Yüksek Kalite (MP4)</span>
          <span style="font-size:10px;color:#a3e635;font-weight:700;">HD</span>
        </div>
        <div class="raptor-ig-dropdown-item" data-quality="audio-320k" data-ext="mp3">
          <span>🎵 Sadece Ses (MP3)</span>
          <span style="font-size:10px;color:#fde047;font-weight:700;">MP3</span>
        </div>
      </div>
    `;

    const btn = container.querySelector('.raptor-ig-btn');
    const dropdown = container.querySelector('.raptor-ig-dropdown');
    const arrow = container.querySelector('.raptor-ig-arrow');
    const label = container.querySelector('.raptor-ig-text');

    const triggerPostDownload = (quality = 'best', ext = 'mp4') => {
      // 1. Locate video in this specific post
      const video = postContainer.querySelector('video');
      let videoUrl = '';
      if (video) {
        videoUrl = video.currentSrc || video.src || video.querySelector('source')?.src || '';
      }

      // 2. Author username
      const authorEl = postContainer.querySelector('header a[role="link"], a[role="link"], a[href^="/"]');
      let author = authorEl ? authorEl.textContent.trim().replace(/^@/, '') : '';
      if (!author || author.length < 2) author = 'Instagram';

      // 3. Caption / title text
      const captionEl = postContainer.querySelector('h1, span._ap3a, div[role="button"] span, span[dir="auto"]');
      let caption = captionEl ? captionEl.textContent.trim().slice(0, 40) : '';

      // 4. Construct clean filename
      let cleanName = `Instagram_${author}`;
      if (caption) {
        cleanName += `_${caption.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_').slice(0, 30)}`;
      }
      cleanName = cleanName.replace(/_+/g, '_').replace(/^_|_$/g, '') + `.${ext}`;

      // 5. Fallback URL
      if (!videoUrl) {
        const linkEl = postContainer.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        if (linkEl && linkEl.href) {
          videoUrl = linkEl.href;
        } else {
          videoUrl = window.location.href;
        }
      }

      // 6. Visual feedback
      btn.classList.add('hd-success');
      label.textContent = '✓ Gönderildi!';
      setTimeout(() => {
        btn.classList.remove('hd-success');
        label.textContent = 'İndir';
      }, 3000);

      // 7. Send message to extension background
      chrome.runtime.sendMessage({
        type: 'START_MEDIA_DOWNLOAD',
        url: videoUrl,
        filename: cleanName,
        quality: quality,
        referer: 'https://www.instagram.com/'
      });
    };

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (arrow.contains(e.target)) {
        dropdown.classList.toggle('hd-open');
      } else {
        dropdown.classList.remove('hd-open');
        triggerPostDownload('best', 'mp4');
      }
    });

    dropdown.querySelectorAll('.raptor-ig-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.remove('hd-open');
        const q = item.getAttribute('data-quality');
        const ext = item.getAttribute('data-ext') || 'mp4';
        triggerPostDownload(q, ext);
      });
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('hd-open');
      }
    });

    return container;
  }

  // Scan and attach individual Raptor download buttons to each Instagram post/reel
  function scanAndAttachInstagramPosts() {
    if (!window.location.hostname.includes('instagram.com')) return;
    injectStyles();

    // 1. Scan feed posts (<article>)
    const articles = document.querySelectorAll('article');
    articles.forEach(article => {
      const video = article.querySelector('video');
      if (!video) return;
      if (article.querySelector('.raptor-ig-container')) return;

      // Find header row and the "..." options menu button
      let moreBtn = null;
      const candidates = article.querySelectorAll('div[role="button"], button');
      for (const c of candidates) {
        if (c.querySelector('svg circle') || c.querySelector('svg[aria-label="Diğer seçenekler"], svg[aria-label="More options"]')) {
          moreBtn = c;
          break;
        }
      }

      if (moreBtn && moreBtn.parentNode) {
        const btn = createInstagramButtonForPost(article, false);
        moreBtn.parentNode.insertBefore(btn, moreBtn);
      } else {
        // Fallback: attach to top-right of the video container
        const videoParent = video.closest('div[style*="position"]') || video.parentElement;
        if (videoParent) {
          if (getComputedStyle(videoParent).position === 'static') {
            videoParent.style.position = 'relative';
          }
          const btn = createInstagramButtonForPost(article, true);
          videoParent.appendChild(btn);
        }
      }
    });

    // 2. Scan Reels containers
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach(video => {
      if (video.closest('article')) return; // already handled by article scanner
      
      const reelContainer = video.closest('div[role="presentation"], div[class*="_ab6-"], section main > div') || video.parentElement;
      if (!reelContainer) return;
      if (reelContainer.querySelector('.raptor-ig-container')) return;

      if (getComputedStyle(reelContainer).position === 'static') {
        reelContainer.style.position = 'relative';
      }
      const btn = createInstagramButtonForPost(reelContainer, true);
      reelContainer.appendChild(btn);
    });
  }

  // Scan document for video players, iframes, and active media elements
  function inspectAndAttach() {
    injectStyles();

    // 0. Instagram Per-Post Injection
    if (window.location.hostname.includes('instagram.com')) {
      scanAndAttachInstagramPosts();
      return;
    }

    // 1. YouTube Player
    if (window.location.hostname.includes('youtube.com')) {
      const isWatch = window.location.pathname.startsWith('/watch') || window.location.pathname.startsWith('/shorts');
      if (!isWatch) {
        if (activePanel) activePanel.remove();
        return;
      }
      const ytPlayerContainer = document.querySelector('#movie_player, .html5-video-player, #ytd-player');
      if (ytPlayerContainer) {
        createSnifferWidget(ytPlayerContainer, window.location.href);
        return;
      }
    }

    // 2. Direct HTML5 video / audio elements
    const mediaElements = document.querySelectorAll('video, audio');
    for (const el of mediaElements) {
      const src = el.src || el.querySelector('source')?.src || el.currentSrc;
      const parent = el.parentElement || el;

      let targetMediaUrl = detectedStreamUrl;
      if (!targetMediaUrl && src && !src.startsWith('blob:') && !src.startsWith('data:')) {
        targetMediaUrl = src;
      }

      createSnifferWidget(parent, targetMediaUrl || window.location.href);
      return;
    }

    // 3. Embedded Player Iframes (hdfilmcehennemi, vidmoly, closeload, streamwish, etc.)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      const src = (iframe.src || '').toLowerCase();
      const rect = iframe.getBoundingClientRect();
      const isPlayerIframe = src.includes('embed') || src.includes('player') || src.includes('video') ||
                             src.includes('stream') || src.includes('closeload') || src.includes('vidmoly') ||
                             src.includes('rapidram') || src.includes('supervideo') || src.includes('dood') ||
                             (rect.width >= 320 && rect.height >= 180);

      if (isPlayerIframe) {
        const wrapper = iframe.parentElement || iframe;
        createSnifferWidget(wrapper, detectedStreamUrl || iframe.src);
        return;
      }
    }

    // 4. If a stream URL was sniffed by background.js or in-page hook, display fixed floating grabber
    if (detectedStreamUrl) {
      createSnifferWidget(document.body, detectedStreamUrl);
    }
  }

  // Initialization & Dynamic Observers
  function init() {
    injectStyles();
    inspectAndAttach();

    // Re-check periodically when video players load lazily
    setTimeout(inspectAndAttach, 1000);
    setTimeout(inspectAndAttach, 2500);
    setTimeout(inspectAndAttach, 5000);

    // Navigation events
    window.addEventListener('yt-navigate-finish', () => setTimeout(inspectAndAttach, 600));
    window.addEventListener('popstate', () => setTimeout(inspectAndAttach, 600));

    // Observe DOM changes (players dynamically injected via AJAX / iframes)
    const observer = new MutationObserver(() => {
      inspectAndAttach();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Fast periodic check for Instagram feed posts and dynamic DOM loading
    if (window.location.hostname.includes('instagram.com')) {
      setInterval(scanAndAttachInstagramPosts, 800);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
