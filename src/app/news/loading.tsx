export default function Loading() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-[calc(var(--nav-space)+1rem)] pt-6" aria-hidden>
      <div className="h-8 w-40 animate-pulse rounded-xl bg-line" />
      <div className="h-64 animate-pulse rounded-3xl bg-line" />
      <div className="h-32 animate-pulse rounded-3xl bg-line" />
    </div>
  );
}
