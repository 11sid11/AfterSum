import type { Backup } from '@/export/json/backup';

export type PortableBackupResult = 'shared' | 'downloaded' | 'cancelled';

export function createPortableBackupFile(backup: Backup, now: Date = new Date()): File {
  const stamp = formatFileTimestamp(now);
  return new File([JSON.stringify(backup, null, 2)], `AfterSum-${stamp}.aftersum.json`, {
    type: 'application/json',
  });
}

/**
 * Hand a complete backup to the operating system. Mobile PWAs normally get the
 * native share sheet (Drive, Files, Dropbox, etc.); unsupported browsers fall
 * back to a normal file download. AfterSum never learns which destination the
 * user chooses.
 */
export async function shareOrDownloadBackup(file: File): Promise<PortableBackupResult> {
  const shareData: ShareData = {
    title: 'AfterSum backup',
    text: 'Portable AfterSum backup',
    files: [file],
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // A platform can expose Web Share but reject files at runtime. Falling
      // back to download keeps backup available without broad permissions.
    }
  }

  downloadFile(file);
  return 'downloaded';
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function formatFileTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
}
