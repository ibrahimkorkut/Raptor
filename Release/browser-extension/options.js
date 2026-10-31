// HyperDownload Extension - Options Controller

const DEFAULT_EXTENSIONS = [
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'zst',
  'exe', 'msi', 'bat', 'cmd', 'apk',
  'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv',
  'mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'bin', 'dmg', 'pkg', 'deb', 'rpm'
];

document.addEventListener('DOMContentLoaded', async () => {
  const fileExtsInput = document.getElementById('file-extensions');
  const excludedDomainsInput = document.getElementById('excluded-domains');
  const bridgePortInput = document.getElementById('bridge-port');
  const useNativeMessagingInput = document.getElementById('use-native-messaging');
  const resetBtn = document.getElementById('reset-extensions-btn');
  const saveBtn = document.getElementById('save-btn');
  const toast = document.getElementById('save-toast');

  // Load existing settings
  const settings = await chrome.storage.local.get([
    'fileExtensions',
    'excludedDomains',
    'bridgePort',
    'useNativeMessaging'
  ]);

  const exts = settings.fileExtensions || DEFAULT_EXTENSIONS;
  fileExtsInput.value = exts.join(', ');

  const domains = settings.excludedDomains || [];
  excludedDomainsInput.value = domains.join('\n');

  bridgePortInput.value = settings.bridgePort || 9145;
  useNativeMessagingInput.checked = settings.useNativeMessaging !== false;

  // Reset to default extensions
  resetBtn.addEventListener('click', () => {
    fileExtsInput.value = DEFAULT_EXTENSIONS.join(', ');
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const rawExts = fileExtsInput.value
      .split(/[,\s]+/)
      .map(s => s.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);

    const rawDomains = excludedDomainsInput.value
      .split('\n')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    const port = parseInt(bridgePortInput.value, 10) || 9145;
    const useNative = useNativeMessagingInput.checked;

    await chrome.storage.local.set({
      fileExtensions: rawExts,
      excludedDomains: rawDomains,
      bridgePort: port,
      useNativeMessaging: useNative
    });

    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  });
});
