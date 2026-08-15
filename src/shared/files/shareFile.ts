export type FileHandoffResult = 'shared' | 'downloaded' | 'cancelled';

export interface FileHandoffOptions {
  title?: string;
  text?: string;
}

/**
 * Hand a generated file to the operating system when Web Share Level 2 is
 * available. The destination remains entirely user-controlled (Drive, Files,
 * WhatsApp, Dropbox, etc.). Browsers that cannot share files fall back to a
 * regular download so exports are never blocked by platform support.
 */
export async function shareOrDownloadFile(
  file: File,
  options: FileHandoffOptions = {},
): Promise<FileHandoffResult> {
  const canUseShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));

  if (canUseShare) {
    try {
      await navigator.share({
        ...options,
        files: [file],
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Some platforms report file sharing support but still reject a file at
      // runtime. A normal download is the safest no-permission fallback.
    }
  }

  downloadFile(file);
  return 'downloaded';
}

export function fileFromBlob(blob: Blob, filename: string, fallbackType?: string): File {
  return new File([blob], filename, {
    type: blob.type || fallbackType || 'application/octet-stream',
  });
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
