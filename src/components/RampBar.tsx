/** A pollutant colour bar with its band names under it (four bands, or the two ends of a ramp). `background` is a CSS gradient, `bar` and `names` the theme's classes. */
export default function RampBar({ background, names, bar, text, label }: { background: string; names: string[]; bar: string; text: string; label?: string }) {
  return (
    <>
      <div className={`mt-1 h-2.5 rounded-full border ${bar}`} style={{ backgroundImage: background }} {...(label ? { role: "img", "aria-label": label } : {})} />
      <div aria-hidden={label ? true : undefined} className={`mt-1 text-[11px] font-semibold leading-4 ${text} ${names.length === 4 ? "grid grid-cols-4 text-center" : "flex justify-between"}`}>
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </>
  );
}
