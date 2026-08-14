/**
 * Short first-run onboarding. No account or bank connection is required.
 */

import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button, Card, CurrencyPicker, Input, Toggle } from '@components/ui';
import { settingsRepository } from '@shared/settings/repository';
import { personRepository } from '@shared/people/repository';
import { persistBrowserStorage } from '@shared/storage';

type Step = 0 | 1 | 2 | 3;

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [currency, setCurrency] = useState('INR');
  const [name, setName] = useState('Me');
  const [persist, setPersist] = useState(false);
  const [busy, setBusy] = useState(false);
  const finishStarted = useRef(false);

  const next = () => setStep((s) => (s + 1) as Step);
  const back = () => setStep((s) => (s - 1) as Step);

  const finish = async () => {
    if (finishStarted.current) return;

    finishStarted.current = true;
    setBusy(true);
    try {
      await settingsRepository.update({ defaultCurrency: currency });
      await personRepository.update('self', { name: name.trim() });
      if (persist) await persistBrowserStorage();
      await settingsRepository.setOnboardingComplete(true);
      await navigate({ to: '/overview', replace: true });
    } catch (error) {
      finishStarted.current = false;
      throw error;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center gap-4 px-2">
      {step === 0 && (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">AfterSum</p>
          <h1 className="mt-2 text-2xl font-semibold">Money tracking without the clutter</h1>
          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p><strong>Track</strong> personal spending and income.</p>
            <p><strong>Split</strong> group expenses and settle up.</p>
            <p><strong>Lend</strong> remember money owed between people.</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">Works offline. No bank connection required.</p>
          <div className="mt-6 flex justify-end">
            <Button onClick={next}>Get started</Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h1 className="text-base font-semibold">Choose your main currency</h1>
          <p className="mt-1 text-sm text-slate-500">
            Used for personal Track and Lend records. Split groups can choose their own currency when they are created.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            To keep historical amounts trustworthy, this choice is locked after financial data is recorded.
          </p>
          <div className="mt-4">
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button onClick={next}>Next</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h1 className="text-base font-semibold">Your name</h1>
          <p className="mt-1 text-sm text-slate-500">Used to identify you in Split groups and lending history.</p>
          <div className="mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button onClick={next} disabled={!name.trim()}>Next</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h1 className="text-base font-semibold">Keep your data safer on this device</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ask your browser to preserve AfterSum data when device storage is under pressure. Browser storage is still best-effort, so backups remain important.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium">Persistent storage</p>
              <p className="text-xs text-slate-500">Recommended if you'll use AfterSum regularly.</p>
            </div>
            <Toggle checked={persist} onChange={setPersist} id="persist-toggle" />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>Back</Button>
            <Button onClick={finish} disabled={busy}>{busy ? 'Setting up…' : 'Finish'}</Button>
          </div>
        </Card>
      )}

      <div className="text-center text-xs text-slate-400">Step {step + 1} of 4</div>
    </div>
  );
}
