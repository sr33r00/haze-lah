export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Card({ title, aside, children }: { title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-3xl bg-card p-4">
      {title && (
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
