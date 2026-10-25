/** A pollutant colour bar with its band names under it (any number of bands, each name centred under its equal share of the bar, or the two ends of a ramp). `meanings`, one per band, go under the names in plain weight, with room for two lines; with more than four bands the words are too wide for a cell on a phone, so they alternate between the two lines and may run past their cell. `background` is a CSS gradient, `bar` and `names` the theme's classes. */
export default function RampBar({ background, names, meanings, bar, text, label }: { background: string; names: string[]; meanings?: string[]; bar: string; text: string; label?: string }) {
  const bands = names.length > 2;
  const stagger = !!meanings && names.length > 4;
  return (
    <>
      <div className={`mt-1 h-2.5 rounded-full border ${bar}`} style={{ backgroundImage: background }} {...(label ? { role: "img", "aria-label": label } : {})} />
      <div
      aria-hidden={label ? true : undefined}
      className={`mt-1 text-fine font-semibold leading-4 ${text} ${bands ? "grid text-center" : "flex justify-between"}`}
      style={bands ? { gridTemplateColumns: `repeat(${names.length}, 1fr)` } : undefined}
    >
        {names.map((n, i) => (
          <span key={n}>
            {n}
            {meanings &&
              (stagger ? (
                <span className="relative block h-8 font-normal leading-4">
                  <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap ${i % 2 ? "top-4" : "top-0"}`}>{meanings[i]}</span>
                </span>
              ) : (
                <span className="block min-h-8 font-normal leading-4">{meanings[i]}</span>
              ))}
          </span>
        ))}
      </div>
    </>
  );
}
