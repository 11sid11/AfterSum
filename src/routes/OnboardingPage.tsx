/**
 * Onboarding — short, optional, no forced Google sign-in.
 *
 * Screens:
 *   1. Welcome — explain what the app does
 *   2. Default currency
 *   3. Your name (self Person)
 *   4. Persistent storage opt-in
 *   5. Done
 */

import { useState } from 'react';
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

  const next = () => setStep((s) => (s + 1) as Step);
  const back = () => setStep((s) => (s - 1) as Step);

  const finish = async () => {
    setBusy(true);
    try {
      await settingsRepository.update({ defaultCurrency: currency });
      await personRepository.update('self', { name });
      if (persist) {
        await persistBrowserStorage();
      }
      await settingsRepository.setOnboardingComplete(true);
      navigate({ to: '/overview' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-2">
      {step === 0 && (
        <Card>
          <h1 className="text-xl font-semibold">Finance Utility</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Track your spending. Split trips. Remember personal lending.
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Works offline. No bank connection.
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={next}>Get started</Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h1 className="text-base font-semibold">Default currency</h1>
          <p className="mt-1 text-sm text-slate-500">
            Used when you don't pick one. You can change it later.
          </p>
          <div className="mt-4">
            <CurrencyPicker value={currency} onChange={setCurrency} />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
            <Button onClick={next}>Next</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h1 className="text-base font-semibold">Your name</h1>
          <p className="mt-1 text-sm text-slate-500">
            Shown in shared groups and lending ledgers.
          </p>
          <div className="mt-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
            <Button onClick={next} disabled={!name.trim()}>
              Next
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h1 className="text-base font-semibold">Keep your data safer on this device</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ask your browser not to delete your data when storage is low.
            Browsers may still choose to evict data — there's no guarantee.
          </p>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium">Persistent storage</p>
              <p className="text-xs text-slate-500">Best-effort. Enable if you'll use this often.</p>
            </div>
            <Toggle checked={persist} onChange={setPersist} id="persist-toggle" />
          </div>
          <div className="mt-6 flex justify-between">
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
            <Button onClick={finish} disabled={busy}>
              {busy ? 'Setting up…' : 'Finish'}
            </Button>
          </div>
        </Card>
      )}

      <div className="text-center text-xs text-slate-400">
        Step {step + 1} of 4
      </div>
    </div>
  );
}
