import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, useToast } from '@components/ui';
import {
  executeSplitCsvImport,
  previewSplitCsv,
  type SplitCsvPreview,
} from '../services/importCsv';

export function SplitCsvImportCard({ groupId, currency }: { groupId: string; currency: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<SplitCsvPreview>();
  const [filename, setFilename] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const readFile = async (file: File) => {
    try {
      const next = previewSplitCsv(await file.text(), currency);
      setPreview(next);
      setFilename(file.name);
    } catch (error) {
      setPreview(undefined);
      setFilename('');
      toast.show(error instanceof Error ? error.message : 'Could not read CSV', { variant: 'error' });
    }
  };

  const runImport = async () => {
    if (!preview) return;
    const confirmed = window.confirm(
      `Import ${preview.rows.length} expense${preview.rows.length === 1 ? '' : 's'} into this trip? Existing expenses will not be changed.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await executeSplitCsvImport(groupId, preview);
      toast.show(
        `Imported ${result.imported} expense${result.imported === 1 ? '' : 's'}${result.peopleAdded ? ` and added ${result.peopleAdded} new ${result.peopleAdded === 1 ? 'person' : 'people'}` : ''}.`,
        { variant: 'success' },
      );
      setPreview(undefined);
      setFilename('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Import failed', { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import expenses</CardTitle>
        <FileSpreadsheet size={18} className="text-slate-400" />
      </CardHeader>
      <p className="text-sm text-slate-500">
        Import a Splitwise group CSV or a simple CSV with Date, Description and Amount. The file is parsed entirely on this device.
      </p>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
        }}
      />

      {!preview ? (
        <Button className="mt-3" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload size={16} /> Choose CSV
        </Button>
      ) : (
        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
          <div>
            <p className="truncate text-sm font-semibold">{filename}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {preview.kind === 'splitwise' ? 'Splitwise format' : 'Generic format'} · {preview.rows.length} ready
              {preview.skippedRows ? ` · ${preview.skippedRows} skipped` : ''}
            </p>
          </div>
          {preview.participantNames.length > 0 && (
            <p className="text-xs text-slate-500">
              People found: {preview.participantNames.join(', ')}. Existing matching names are reused.
            </p>
          )}
          {preview.warnings.length > 0 && (
            <details className="text-xs text-amber-700 dark:text-amber-300">
              <summary className="cursor-pointer font-medium">{preview.warnings.length} import note{preview.warnings.length === 1 ? '' : 's'}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {preview.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}
                {preview.warnings.length > 8 && <li>{preview.warnings.length - 8} more…</li>}
              </ul>
            </details>
          )}
          <p className="text-xs text-slate-400">Importing the same file twice can create duplicate expenses, so review the preview before continuing.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { setPreview(undefined); setFilename(''); }}>Choose another</Button>
            <Button disabled={busy} onClick={() => void runImport()}>{busy ? 'Importing…' : `Import ${preview.rows.length}`}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
