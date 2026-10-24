/** A pollutant colour bar with its band names under it (any number of bands, each name centred under its equal share of the bar, or the two ends of a ramp). `meanings`, one per band, go under the names in plain weight, with room for two lines. `background` is a CSS gradient, `bar` and `names` the theme's classes. */
export default function RampBar({ background, names, meanings, bar, text, label }: { background: string; names: string[]; meanings?: string[]; bar: string; text: string; label?: string }) {
  const bands = names.length > 2;
  return (
    <>
      <div className={`mt-1 h-2.5 rounded-full border ${bar}`} style={{ backgroundImage: background }} {...(label ? { role: "img", "aria-label": label } : {})} />
      <div
      aria-hidden={label ? true : undefined}
      className={`mt-1 text-[11px] font-semibold leading-4 ${text} ${bands ? "grid text-center" : "flex justify-between"}`}
      style={bands ? { gridTemplateColumns: `repeat(${names.length}, 1fr)` } : undefined}
    >
        {names.map((n, i) => (
          <span key={n}>
            {n}
            {meanings && <span className="block min-h-8 font-normal leading-4">{meanings[i]}</span>}
          </span>
        ))}
      </div>
    </>
  );
}
