import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, useToast } from '@components/ui';
import { useSelf } from '@shared/people/queries';
import { personNameKey } from '@shared/people/domain';
import {
  executeSplitCsvImport,
  previewSplitCsv,
  type SplitCsvPreview,
} from '../services/importCsv';

const SELF_NOT_LISTED = '__self_not_listed__';

export function SplitCsvImportCard({ groupId, currency }: { groupId: string; currency: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const self = useSelf();
  const [preview, setPreview] = useState<SplitCsvPreview>();
  const [filename, setFilename] = useState('');
  const [selfParticipant, setSelfParticipant] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const clearPreview = () => {
    setPreview(undefined);
    setFilename('');
    setSelfParticipant('');
  };

  const readFile = async (file: File) => {
    try {
      const next = previewSplitCsv(await file.text(), currency);
      const matchingSelf =
        next.kind === 'splitwise' && self
          ? next.participantNames.find((name) => personNameKey(name) === personNameKey(self.name))
          : undefined;
      setPreview(next);
      setFilename(file.name);
      setSelfParticipant(matchingSelf ?? '');
    } catch (error) {
      clearPreview();
      toast.show(error instanceof Error ? error.message : 'Could not read CSV', { variant: 'error' });
    }
  };

  const runImport = async () => {
    if (!preview) return;
    if (preview.kind === 'splitwise' && !selfParticipant) {
      toast.show('Choose which Splitwise participant is you before importing.', { variant: 'error' });
      return;
    }

    const confirmed = window.confirm(
      `Import ${preview.rows.length} expense${preview.rows.length === 1 ? '' : 's'} into this trip? Existing expenses will not be changed.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const result = await executeSplitCsvImport(groupId, preview, {
        selfParticipantName:
          preview.kind !== 'splitwise'
            ? undefined
            : selfParticipant === SELF_NOT_LISTED
              ? null
              : selfParticipant,
      });
      const duplicateNote = result.skippedDuplicates
        ? ` ${result.skippedDuplicates} already-imported ${result.skippedDuplicates === 1 ? 'row was' : 'rows were'} skipped.`
        : '';
      toast.show(
        `Imported ${result.imported} expense${result.imported === 1 ? '' : 's'}${result.peopleAdded ? ` and added ${result.peopleAdded} new ${result.peopleAdded === 1 ? 'person' : 'people'}` : ''}.${duplicateNote}`,
        { variant: 'success' },
      );
      clearPreview();
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
          {preview.kind === 'splitwise' && (
            <div className="space-y-1.5">
              <label className="label" htmlFor="splitwise-self">Which Splitwise person is you?</label>
              <select
                id="splitwise-self"
                className="input"
                value={selfParticipant}
                onChange={(event) => setSelfParticipant(event.target.value)}
                disabled={busy}
              >
                <option value="">Choose…</option>
                {preview.participantNames.map((name) => <option key={name} value={name}>{name}</option>)}
                <option value={SELF_NOT_LISTED}>I'm not listed in this file</option>
              </select>
              <p className="text-xs text-slate-500">
                This prevents your Splitwise rows from being imported as a second person.
              </p>
            </div>
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
          <p className="text-xs text-slate-400">
            Re-importing the same CSV is safe: rows AfterSum already imported from that file are skipped.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={clearPreview} disabled={busy}>Choose another</Button>
            <Button
              disabled={busy || (preview.kind === 'splitwise' && !selfParticipant)}
              onClick={() => void runImport()}
            >
              {busy ? 'Importing…' : `Import ${preview.rows.length}`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
