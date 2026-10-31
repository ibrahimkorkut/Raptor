// Raptor Browser Extension - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  const interceptToggle = document.getElementById('intercept-toggle');
  const engineStatus = document.getElementById('engine-status');
  const openOptionsBtn = document.getElementById('open-options-btn');
  const mediaContainer = document.getElementById('media-container');
  const mediaCountBadge = document.getElementById('media-count');
  const emptyState = document.getElementById('empty-state');

  // Load initial settings
  const settings = await chrome.storage.local.get(['interceptEnabled']);
  interceptToggle.checked = settings.interceptEnabled !== false;

  interceptToggle.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ interceptEnabled: e.target.checked });
  });

  // Open Options page
  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Engine health check
  try {
    chrome.runtime.sendMessage({ type: 'CHECK_ENGINE_HEALTH' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.online) {
        engineStatus.textContent = 'Motor Çevrimdışı';
        engineStatus.className = 'badge offline';
      } else {
        engineStatus.textContent = `Aktif (: ${response.port})`;
        engineStatus.className = 'badge online';
      }
    });
  } catch (err) {
    engineStatus.textContent = 'Motor Çevrimdışı';
    engineStatus.className = 'badge offline';
  }

  // Load sniffed media streams for the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return;

    chrome.runtime.sendMessage({ type: 'GET_DETECTED_MEDIA', tabId: activeTab.id }, (response) => {
      const mediaList = response?.media || [];
      renderMediaList(mediaList, activeTab);
    });
  });

  function renderMediaList(mediaList, activeTab) {
    if (!mediaList || mediaList.length === 0) {
      mediaCountBadge.textContent = '0';
      mediaCountBadge.style.background = '#0f172a';
      mediaCountBadge.style.color = '#94a3b8';
      emptyState.style.display = 'block';
      return;
    }

    mediaCountBadge.textContent = String(mediaList.length);
    mediaCountBadge.style.background = 'rgba(16, 185, 129, 0.2)';
    mediaCountBadge.style.color = '#34d399';
    emptyState.style.display = 'none';

    // Clear previous items
    mediaContainer.innerHTML = '';

    // Render items in reverse chronological order (newest first)
    [...mediaList].reverse().forEach((item) => {
      const el = document.createElement('div');
      el.className = 'media-item';

      const title = item.title || activeTab.title || 'Video Akışı';
      const typeName = item.typeName || (item.type === 'hls' ? 'HLS (.m3u8)' : 'Video (MP4)');

      el.innerHTML = `
        <div class="media-info">
          <div class="media-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
          <div class="media-meta">
            <span class="media-pill">${escapeHtml(typeName)}</span>
          </div>
        </div>
        <button class="media-btn" id="dl-btn-${item.id}">
          <img src="icons/icon-16.png" style="width:13px; height:13px; border-radius:3px;" alt="" />
          <span>İndir</span>
        </button>
      `;

      const btn = el.querySelector(`#dl-btn-${item.id}`);
      btn.addEventListener('click', () => {
        btn.classList.add('downloaded');
        btn.innerHTML = '<span>✓ Raptor\'a Gönderildi</span>';

        chrome.runtime.sendMessage({
          type: 'START_MEDIA_DOWNLOAD',
          url: item.url,
          filename: `${title}.${item.ext || 'mp4'}`,
          quality: 'best',
          referer: item.referer || activeTab.url || ''
        });

        setTimeout(() => {
          btn.classList.remove('downloaded');
          btn.innerHTML = '<img src="icons/icon-16.png" style="width:13px; height:13px; border-radius:3px;" alt="" /><span>İndir</span>';
        }, 3000);
      });

      mediaContainer.appendChild(el);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
