import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="bg-grid mask-radial absolute inset-0" />
      <div className="shell relative flex min-h-[70vh] flex-col items-start justify-center py-20">
        <p className="eyebrow animate-fade-up">
          <span className="text-signal">404</span> <span className="mx-2 text-ink-500">/</span> Not found
        </p>
        <h1 className="display mt-5 max-w-3xl animate-fade-up text-[52px] [animation-delay:80ms] sm:text-7xl lg:text-8xl">
          Nothing to examine <em className="text-mist">here.</em>
        </h1>
        <p className="mt-6 max-w-xl animate-fade-up text-lg text-mist [animation-delay:160ms]">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <div className="mt-10 flex animate-fade-up flex-wrap gap-3 [animation-delay:240ms]">
          <ButtonLink to="/" size="lg">
            Back to home
          </ButtonLink>
          <ButtonLink to="/detect" size="lg" variant="secondary">
            Analyse an image
            <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
