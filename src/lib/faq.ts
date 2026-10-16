import { CIGARETTE_NOTES, PM25_PER_CIGARETTE } from "./cigarettes";

/** Questions shown on the About page and published as FAQPage structured data. Answers restate facts already in the app. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Is it safe to go out in the haze today?",
    a: "It depends on the current NEA reading and on who you are. The home page answers this for your region and group, using whichever is worse of NEA's latest 1-hour PM2.5 and 24-hour PSI. Healthy adults can go about normal activities when the 24-hour PSI is 100 or below, and are advised to reduce prolonged or strenuous outdoor exertion from 101.",
  },
  {
    q: "What is the difference between PSI and PM2.5?",
    a: "PM2.5 is the concentration of fine particles in the air, in µg/m³. The PSI is NEA's index built from several pollutants, and during haze PM2.5 almost always sets it. NEA recommends the 1-hour PM2.5 for deciding on immediate activities and the 24-hour PSI for planning ahead.",
  },
  {
    q: "What PSI is unhealthy in Singapore?",
    a: "NEA's bands for the 24-hour PSI are Good (0 to 50), Moderate (51 to 100), Unhealthy (101 to 200), Very unhealthy (201 to 300) and Hazardous (above 300).",
  },
  {
    q: "Do I need an N95 mask?",
    a: "Only if you must be outdoors for several hours. NEA suggests a well-fitted N95 for healthy adults when the PSI forecast is above 300, and for the elderly, pregnant women and people with heart or lung disease above 200. Surgical masks do not filter fine smoke. N95 masks are not made for children, so keep them indoors. If you have trouble breathing at rest or on exertion, check with a doctor first.",
  },
  {
    q: "How accurate is the haze forecast?",
    a: "The forecast is a calibrated Copernicus CAMS model, and it can be wrong when wind shifts suddenly or fires flare up. Every forecast is saved and compared with what NEA actually measured. The results are in the measured accuracy section of this page.",
  },
  {
    q: "How many cigarettes is the haze equal to?",
    a: `Breathing PM2.5 at ${PM25_PER_CIGARETTE} µg/m³ for 24 hours carries about the same risk of early death as smoking one cigarette (Berkeley Earth, 2015). ${CIGARETTE_NOTES[2]}`,
  },
];
