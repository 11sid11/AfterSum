import type { Backup } from '@/export/json/backup';
import {
  shareOrDownloadFile,
  type FileHandoffResult,
} from '@shared/files/shareFile';

export type PortableBackupResult = FileHandoffResult;

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
export function shareOrDownloadBackup(file: File): Promise<PortableBackupResult> {
  return shareOrDownloadFile(file, {
    title: 'AfterSum backup',
    text: 'Portable AfterSum backup',
  });
}

function formatFileTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}`;
}
