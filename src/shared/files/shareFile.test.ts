import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shareOrDownloadFile } from './shareFile';

const originalShare = navigator.share;
const originalCanShare = navigator.canShare;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

function setNavigatorMethod<K extends 'share' | 'canShare'>(key: K, value: Navigator[K] | undefined) {
  Object.defineProperty(navigator, key, {
    configurable: true,
    value,
  });
}

describe('shareOrDownloadFile', () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

  beforeEach(() => {
    click.mockClear();
    URL.createObjectURL = vi.fn(() => 'blob:aftersum-test');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    setNavigatorMethod('share', originalShare);
    setNavigatorMethod('canShare', originalCanShare);
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('uses the native share sheet when file sharing is supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    setNavigatorMethod('share', share as Navigator['share']);
    setNavigatorMethod('canShare', canShare as Navigator['canShare']);

    const file = new File(['hello'], 'export.csv', { type: 'text/csv' });
    const result = await shareOrDownloadFile(file, { title: 'AfterSum export' });

    expect(result).toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [file] });
    expect(share).toHaveBeenCalledWith({ title: 'AfterSum export', files: [file] });
    expect(click).not.toHaveBeenCalled();
  });

  it('does not download when the user cancels the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    setNavigatorMethod('share', share as Navigator['share']);
    setNavigatorMethod('canShare', vi.fn().mockReturnValue(true) as Navigator['canShare']);

    const result = await shareOrDownloadFile(new File(['x'], 'backup.json'));

    expect(result).toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });

  it('falls back to a file download when native file sharing is unavailable', async () => {
    setNavigatorMethod('share', vi.fn() as Navigator['share']);
    setNavigatorMethod('canShare', vi.fn().mockReturnValue(false) as Navigator['canShare']);

    const result = await shareOrDownloadFile(new File(['x'], 'export.zip'));

    expect(result).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
  });
});
