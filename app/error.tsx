"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 text-center">
      <div>
        <h1 className="serif text-4xl">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{error.message}</p>
        <button type="button" className="mt-5 min-h-11 rounded-full bg-accent px-5 text-sm text-accent-ink" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
