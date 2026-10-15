/**
 * Yearly peak 24-hr PSI (highest region) from NEA's historical 24-hr PSI, hourly from April 2014:
 * data.gov.sg dataset d_b4cf557f8750260d229c49fd768e11ed. Computed from the dataset; 2026 is excluded
 * because the current episode is in it.
 */
export const PSI_YEAR_PEAKS: Record<number, number> = {
  2014: 125,
  2015: 322,
  2016: 143,
  2017: 143,
  2018: 91,
  2019: 154,
  2020: 84,
  2021: 124,
  2022: 75,
  2023: 123,
  2024: 77,
  2025: 114,
};

export const HISTORY_URL = "https://data.gov.sg/datasets/d_b4cf557f8750260d229c49fd768e11ed/view";

/** How rare a peak 24-hr PSI is against NEA's yearly peaks; null when it is not above Moderate. */
export function sinceWhen(peak: number): string | null {
  if (peak <= 100) return null;
  const year = Object.keys(PSI_YEAR_PEAKS)
    .map(Number)
    .sort((a, b) => b - a)
    .find((y) => PSI_YEAR_PEAKS[y] >= peak);
  return year ? `Highest since ${year} (peak ${PSI_YEAR_PEAKS[year]})` : "Highest since NEA's open records began in 2014";
}
