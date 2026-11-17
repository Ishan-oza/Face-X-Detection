import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CheckCircle2, Loader2, MessageSquareText, RefreshCw, Send, Star } from 'lucide-react';
import { errorMessage, getReviews, submitReview, type PublicReview, type ReviewsResult } from '../../services/api';
import { Reveal, stagger } from '../Reveal';
import { Alert, SectionHeading, buttonClasses, cx } from '../ui';

const REFRESH_MS = 2 * 60 * 1000;
const PAGE = 6;
const NAME_MAX = 60;
const FEEDBACK_MIN = 10;
const FEEDBACK_MAX = 1000;
const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const token = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dateFormat.format(d);
}

/* ---------------- Stars ---------------- */

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cx(size, i <= value ? 'fill-signal text-signal' : 'fill-transparent text-white/20')}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/** 1–5 rating as a radio group: click, hover preview, arrow keys. */
function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = hover || value;

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, (value || 0) + delta));
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div role="radiogroup" aria-label="Rating" aria-required="true" onKeyDown={onKeyDown} onMouseLeave={() => setHover(0)} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            ref={(el) => (refs.current[i - 1] = el)}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? 's' : ''}: ${LABELS[i - 1]}`}
            tabIndex={value ? (value === i ? 0 : -1) : i === 1 ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            className="rounded-md p-1 transition-transform duration-200 hover:scale-110 active:scale-95 disabled:pointer-events-none"
          >
            <Star
              aria-hidden
              className={cx(
                'h-7 w-7 transition-colors duration-200',
                i <= shown ? 'fill-signal text-signal' : 'fill-transparent text-white/25',
              )}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      <span className="min-w-[5rem] font-mono text-xs uppercase tracking-[0.14em] text-mist" aria-hidden>
        {shown ? LABELS[shown - 1] : 'Select'}
      </span>
    </div>
  );
}

/* ---------------- Review cards ---------------- */

function ReviewCard({ review, index }: { review: PublicReview; index: number }) {
  return (
    <Reveal as="li" delay={stagger(index % PAGE, 70)}>
      <article className="panel card-hover flex h-full flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <Stars value={review.rating} />
          {review.submitted_at && (
            <time dateTime={review.submitted_at} className="font-mono text-[11px] text-mist">
              {formatDate(review.submitted_at)}
            </time>
          )}
        </div>
        {/* Rendered as text only: React escapes it, and line breaks are preserved. */}
        <p className="mt-4 flex-1 whitespace-pre-line break-words text-sm leading-relaxed text-bone/90">{review.feedback}</p>
        <p className="mt-5 border-t hairline pt-4 text-sm text-mist">
          <span className="text-bone">{review.name || 'Anonymous'}</span>
        </p>
      </article>
    </Reveal>
  );
}

function ReviewList({ state, onRetry }: { state: ListState; onRetry: () => void }) {
  const [shown, setShown] = useState(PAGE);

  if (state.status === 'loading') {
    return (
      <ul className="grid gap-4 sm:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="panel h-44 animate-pulse p-6">
            <div className="h-3 w-24 rounded bg-white/[0.08]" />
            <div className="mt-5 space-y-2">
              <div className="h-2.5 rounded bg-white/[0.06]" />
              <div className="h-2.5 w-4/5 rounded bg-white/[0.06]" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert
        tone="warning"
        title="Reviews couldn’t be loaded right now"
        action={
          <button type="button" onClick={onRetry} className={buttonClasses('secondary')}>
            <RefreshCw aria-hidden className="h-4 w-4" /> Try again
          </button>
        }
      >
        {state.message}
      </Alert>
    );
  }
  const { reviews, enabled } = state.data;
  if (!reviews.length) {
    return (
      <div className="panel flex flex-col items-center px-6 py-14 text-center">
        <MessageSquareText aria-hidden className="h-9 w-9 text-mist" strokeWidth={1.3} />
        <p className="mt-4 text-bone">{enabled ? 'No published reviews yet.' : 'Reviews aren’t open yet.'}</p>
        <p className="mt-1 max-w-sm text-sm text-mist">
          {enabled
            ? 'Be the first to share your experience. Reviews appear here once they’ve been approved.'
            : 'Public reviews will appear here once the review service is available.'}
        </p>
      </div>
    );
  }
  return (
    <div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {reviews.slice(0, shown).map((r, i) => (
          <ReviewCard key={r.id || i} review={r} index={i} />
        ))}
      </ul>
      {reviews.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={cx(buttonClasses('ghost'), 'mt-4')}>
          Show more reviews ({reviews.length - shown})
        </button>
      )}
    </div>
  );
}

/* ---------------- Form ---------------- */

type FormState = { status: 'idle' | 'submitting' } | { status: 'success'; message: string } | { status: 'error'; message: string };

function ReviewForm({ enabled }: { enabled: boolean }) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [attempted, setAttempted] = useState(false);
  const [state, setState] = useState<FormState>({ status: 'idle' });
  const tokenRef = useRef(token());

  const trimmed = feedback.trim();
  const errors = {
    rating: rating < 1 ? 'Choose a star rating.' : null,
    feedback:
      trimmed.length < FEEDBACK_MIN
        ? `Please write at least ${FEEDBACK_MIN} characters.`
        : trimmed.length > FEEDBACK_MAX
          ? `Please keep it under ${FEEDBACK_MAX} characters.`
          : null,
  };
  const valid = !errors.rating && !errors.feedback;
  const submitting = state.status === 'submitting';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!valid || submitting || !enabled) return;
    setState({ status: 'submitting' });
    try {
      const res = await submitReview({ name: name.trim(), rating, feedback: trimmed, website, client_token: tokenRef.current });
      setState({ status: 'success', message: res.message });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) });
    }
  };

  const reset = () => {
    tokenRef.current = token();
    setRating(0);
    setName('');
    setFeedback('');
    setAttempted(false);
    setState({ status: 'idle' });
  };

  if (state.status === 'success') {
    return (
      <div className="panel animate-scale-in p-7 text-center sm:p-8" role="status">
        <CheckCircle2 aria-hidden className="mx-auto h-10 w-10 text-signal" strokeWidth={1.5} />
        <h3 className="display mt-4 text-3xl">Thank you.</h3>
        <p className="mt-2 text-sm text-mist">{state.message}</p>
        <button type="button" onClick={reset} className={cx(buttonClasses('ghost'), 'mt-5')}>
          Write another review
        </button>
      </div>
    );
  }

  const fieldClass =
    'w-full rounded-xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-bone placeholder:text-mist/70 transition-colors duration-200 hover:border-white/20 focus:border-signal/60 focus:outline-none disabled:opacity-50';

  return (
    <form onSubmit={onSubmit} noValidate className="panel relative space-y-6 p-6 sm:p-8" aria-label="Write a review">
      <div>
        <p id="rating-label" className="eyebrow">Your rating</p>
        <div className="mt-3" aria-labelledby="rating-label">
          <StarInput value={rating} onChange={setRating} disabled={!enabled || submitting} />
        </div>
        {attempted && errors.rating && <p className="mt-2 text-sm text-fake">{errors.rating}</p>}
      </div>

      <div>
        <label htmlFor="review-name" className="eyebrow">
          Name <span className="normal-case tracking-normal text-mist/70">(optional)</span>
        </label>
        <input
          id="review-name"
          className={cx(fieldClass, 'mt-3')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          autoComplete="name"
          placeholder="Shown with your review, or leave blank"
          disabled={!enabled || submitting}
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="review-feedback" className="eyebrow">
            Feedback
          </label>
          <span className={cx('font-mono text-[11px] tabular-nums', trimmed.length > FEEDBACK_MAX ? 'text-fake' : 'text-mist')}>
            {trimmed.length} / {FEEDBACK_MAX}
          </span>
        </div>
        <textarea
          id="review-feedback"
          className={cx(fieldClass, 'mt-3 min-h-32 resize-y leading-relaxed')}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={FEEDBACK_MAX + 50}
          rows={5}
          placeholder="What worked well, and what could be better?"
          aria-invalid={attempted && !!errors.feedback}
          aria-describedby="review-feedback-hint"
          disabled={!enabled || submitting}
        />
        <p id="review-feedback-hint" className={cx('mt-2 text-xs', attempted && errors.feedback ? 'text-fake' : 'text-mist')}>
          {attempted && errors.feedback ? errors.feedback : 'Plain text only. Links aren’t allowed.'}
        </p>
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots that fill it are ignored. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="review-website">Website</label>
        <input id="review-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {state.status === 'error' && <Alert title="Your review wasn’t sent">{state.message}</Alert>}

      <div>
        <button type="submit" disabled={!enabled || submitting} className={cx(buttonClasses('primary', 'lg'), 'w-full')}>
          {submitting ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" />}
          {submitting ? 'Sending…' : 'Submit review'}
        </button>
        <p className="mt-3 text-center text-xs text-mist">
          {enabled
            ? 'Reviews are checked before they’re published. See the Privacy Policy for how they’re stored.'
            : 'Reviews are temporarily unavailable.'}
        </p>
      </div>
    </form>
  );
}

/* ---------------- Section ---------------- */

type ListState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: ReviewsResult };

export function ReviewsSection() {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback((quiet = false) => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    if (!quiet) setState({ status: 'loading' });
    getReviews(controller.signal)
      .then((data) => !controller.signal.aborted && setState({ status: 'ready', data }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Keep showing the last good list during background refreshes.
        setState((prev) => (quiet && prev.status === 'ready' ? prev : { status: 'error', message: errorMessage(err) }));
      });
  }, []);

  useEffect(() => {
    load();
    // Approvals made in the sheet show up through periodic, lightweight refreshes.
    const id = window.setInterval(() => document.visibilityState === 'visible' && load(true), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load(true);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      inflight.current?.abort();
    };
  }, [load]);

  const enabled = state.status === 'ready' ? state.data.enabled : state.status !== 'error';

  return (
    <section id="reviews" className="scroll-mt-20 md:scroll-mt-24 border-b hairline">
      <div className="shell py-20 sm:py-28">
        <SectionHeading eyebrow="Reviews" title="What visitors say.">
          Feedback from people who have used Face-X. Every review is checked before it’s published.
        </SectionHeading>
        <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7" aria-live="polite">
            <ReviewList state={state} onRetry={() => load()} />
          </div>
          <Reveal delay={120} className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <h3 className="mb-4 font-medium text-bone">Share your experience</h3>
              <ReviewForm enabled={enabled} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
