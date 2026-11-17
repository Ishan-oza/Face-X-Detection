import { useState } from 'react';
import { Check, FileDown, FileJson, Loader2 } from 'lucide-react';
import type { CompletedAnalysis } from '../../context/AnalysisContext';
import type { Report } from '../../lib/report/buildReport';
import { downloadJson } from '../../lib/report/exportJson';
import { buttonClasses, cx } from '../ui';

type State = 'idle' | 'working' | 'done' | 'error';

export function ExportActions({ report, analysis, compact }: { report: Report; analysis: CompletedAnalysis; compact?: boolean }) {
  const [pdf, setPdf] = useState<State>('idle');
  const [json, setJson] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const flash = (set: (s: State) => void) => setTimeout(() => set('idle'), 2200);

  const onPdf = async () => {
    if (pdf === 'working') return;
    setPdf('working');
    setError(null);
    try {
      // jsPDF is loaded only when a report is actually requested.
      const { downloadPdf } = await import('../../lib/report/pdf');
      await downloadPdf(report);
      setPdf('done');
      flash(setPdf);
    } catch (e) {
      setPdf('error');
      setError(e instanceof Error ? e.message : 'The PDF could not be generated.');
    }
  };

  const onJson = () => {
    try {
      downloadJson(report, analysis);
      setJson('done');
      flash(setJson);
    } catch {
      setJson('error');
      setError('The JSON file could not be created.');
    }
  };

  return (
    <div className={cx('flex flex-col gap-2', !compact && 'sm:items-end')}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onPdf} disabled={pdf === 'working'} className={buttonClasses('primary')} aria-live="polite">
          {pdf === 'working' ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          ) : pdf === 'done' ? (
            <Check aria-hidden className="h-4 w-4" />
          ) : (
            <FileDown aria-hidden className="h-4 w-4" />
          )}
          {pdf === 'working' ? 'Generating PDF…' : pdf === 'done' ? 'PDF downloaded' : 'Download PDF report'}
        </button>
        <button type="button" onClick={onJson} className={buttonClasses('secondary')}>
          {json === 'done' ? <Check aria-hidden className="h-4 w-4" /> : <FileJson aria-hidden className="h-4 w-4" />}
          {json === 'done' ? 'JSON exported' : 'Export JSON'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-fake">{error}</p>}
    </div>
  );
}
