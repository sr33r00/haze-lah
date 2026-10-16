import { ECDA, MOE, MOH, NEA_FAQ } from "./advice";
import { CIGARETTE_NOTES, CIGARETTE_SOURCES, PM25_PER_CIGARETTE } from "./cigarettes";

export type GuideSection = { id: string; title: string; items: { id: string; q: string; a: string; sources: [string, string][] }[] };

const NEA_GUIDE: [string, string] = ["NEA", "https://www.haze.gov.sg/docs/default-source/posters/haze-pm-psi-guide-a4-english.pdf"];
const NEA_HAZE: [string, string] = ["NEA", "https://www.nea.gov.sg/our-services/pollution-control/air-pollution/managing-haze"];
const NEA_RELEASE: [string, string] = ["NEA", ECDA[1]];
const MOM: [string, string] = ["MOM", "https://www.mom.gov.sg/haze/guidelines-on-protecting-employees-from-haze"];
const HSS: [string, string] = [
  "MOH",
  "https://www.moh.gov.sg/newsroom/haze-subsidy-scheme-to-start-at-public-health-preparedness-clinics-and-polyclinics-from-12-october-2026/",
];

/**
 * Questions people ask during haze. Every answer restates the cited official page (NEA, MOH, MOE, MOM);
 * about/ and the FAQPage structured data on /guide are built from this list.
 */
export const GUIDE: GuideSection[] = [
  {
    id: "outdoors",
    title: "Outdoors",
    items: [
      {
        id: "go-out",
        q: "Is it safe to go out or exercise?",
        a: "Healthy adults can do normal activities when the 24-hour PSI is 100 or below. At 101 to 200 reduce prolonged or strenuous outdoor exertion, and at 201 to 300 avoid it. The elderly, pregnant women and children should minimise it from 101, and people with chronic lung or heart disease should avoid it from 101.",
        sources: [NEA_GUIDE, NEA_FAQ],
      },
      {
        id: "psi-pm25",
        q: "Which to use: PSI or PM2.5?",
        a: "Use the 1-hour PM2.5 for what you do in the next few hours, and the 24-hour PSI forecast to plan the next day. PM2.5 is the main pollutant of concern in smoke haze.",
        sources: [NEA_GUIDE, NEA_HAZE],
      },
      {
        id: "psi-bands",
        q: "What PSI is unhealthy?",
        a: "NEA's 24-hour PSI bands are Good (0 to 50), Moderate (51 to 100), Unhealthy (101 to 200), Very unhealthy (201 to 300) and Hazardous (above 300). A reading of 101 and above is deemed unhealthy.",
        sources: [NEA_GUIDE, NEA_HAZE],
      },
      {
        id: "cause",
        q: "What causes the haze?",
        a: "Forest fires in the region, started by open burning to clear land. Dry seasons, wind direction and low rainfall make it worse, and winds carry the smoke over Singapore, particularly in the Southwest monsoon.",
        sources: [NEA_HAZE, NEA_FAQ],
      },
    ],
  },
  {
    id: "masks",
    title: "Masks",
    items: [
      {
        id: "n95",
        q: "Do I need an N95 mask?",
        a: "Not for short trips like commuting. A healthy person outdoors for several hours may wear one when the forecast is Hazardous (PSI above 300), and vulnerable people when it is Very unhealthy (above 200). Surgical masks do not filter fine particles, and an N95 only works with a good fit.",
        sources: [NEA_FAQ, NEA_RELEASE],
      },
      {
        id: "n95-doctor",
        q: "Who should check with a doctor before using an N95?",
        a: "The elderly, pregnant women and people with severe lung or heart problems who have difficulty breathing at rest or on exertion. Anyone who feels uncomfortable should take a break from the mask.",
        sources: [MOH, NEA_FAQ],
      },
      {
        id: "free-masks",
        q: "Where can I get free N95 masks?",
        a: "When the PSI enters Very unhealthy (above 200), the People's Association gives N95 masks to eligible Singaporeans, and vending machines open at selected transport hubs and Social Service Offices. Bring your NRIC and check gov.sg for current details.",
        sources: [NEA_RELEASE, ["gov.sg", "https://www.gov.sg"]],
      },
    ],
  },
  {
    id: "home",
    title: "At home",
    items: [
      {
        id: "windows",
        q: "Should I close windows and use the aircon?",
        a: "Close doors and windows when the air outside is getting worse, and stay indoors. Fans or aircon are fine, but if the aircon draws in outside air, close its outdoor air intake.",
        sources: [NEA_FAQ],
      },
      {
        id: "purifier",
        q: "Which air purifier should I get?",
        a: "Choose one with a HEPA filter. Its smoke CADR should be at least 3 times the room volume in cubic metres.",
        sources: [NEA_FAQ],
      },
      {
        id: "shelter",
        q: "Where can I get away from the haze?",
        a: "When the air is Very unhealthy, selected Community Clubs and Residents' Committee centres open air-conditioned haze shelters for anyone. Opening hours extend to 10pm if it turns Hazardous.",
        sources: [NEA_RELEASE],
      },
    ],
  },
  {
    id: "school",
    title: "School",
    items: [
      {
        id: "children",
        q: "How do I protect my child?",
        a: "The key step is to limit prolonged or strenuous outdoor exertion when the forecast 24-hour PSI is above 100. MOH says a well-fitted AIR+ Smart Mask can be used only where necessary by children without heart or lung conditions; N95 masks are not certified for children.",
        sources: [NEA_FAQ, MOH],
      },
      {
        id: "schools",
        q: "Will schools close?",
        a: "MOE considers closing schools when the next day is forecast Hazardous (24-hour PSI above 300), announced when the health advisory is issued. Below that, schools cut outdoor activity as PSI rises and keep pupils in rooms with air purifiers.",
        sources: [MOE],
      },
      {
        id: "preschools",
        q: "What do preschools do?",
        a: "At Very unhealthy, preschools stop all outdoor and strenuous indoor activity, keep children indoors with doors and windows closed, and set aside a room with an air purifier.",
        sources: [ECDA],
      },
    ],
  },
  {
    id: "work",
    title: "Work",
    items: [
      {
        id: "work-rules",
        q: "What must my employer do?",
        a: "Employers should reduce prolonged or strenuous outdoor work at PSI 101 to 200, avoid it at 201 to 300 and minimise outdoor work above 300. They should fit-test masks for staff still working outdoors, keep a 1-week supply of N95s, and provide rest breaks, rotation and water.",
        sources: [MOM, NEA_RELEASE],
      },
    ],
  },
  {
    id: "health",
    title: "Health",
    items: [
      {
        id: "symptoms",
        q: "When should I see a doctor?",
        a: "A few days of haze usually only irritates the eyes, nose and throat, which resolves on its own. See a doctor if you feel unwell, especially if you are elderly, a child or have a chronic heart or lung condition, or if you have trouble breathing.",
        sources: [MOH, NEA_FAQ],
      },
      {
        id: "pregnancy",
        q: "Is haze a risk in pregnancy?",
        a: "NEA advises pregnant women to reduce exposure to haze for the health of the unborn baby. They should minimise prolonged or strenuous outdoor exertion from PSI 101 and minimise outdoor activity above 200.",
        sources: [NEA_FAQ, NEA_GUIDE],
      },
      {
        id: "subsidy",
        q: "Is treatment subsidised?",
        a: "Only when MOH activates the Haze Subsidy Scheme, which it did from 12 Oct 2026. At polyclinics all Singapore Citizens qualify. At Public Health Preparedness Clinics it covers children 18 and below, seniors 65 and above and some card holders such as CHAS Blue and Orange, who pay no more than $10 (Pioneer and Merdeka Generation no more than $5) for conditions like asthma and bronchitis. Look for the PHPC decal.",
        sources: [HSS, MOH],
      },
    ],
  },
  {
    id: "numbers",
    title: "This app",
    items: [
      {
        id: "forecast",
        q: "How accurate is the haze forecast?",
        a: "It is a calibrated Copernicus CAMS model and can be wrong when wind shifts suddenly or fires flare up. Every forecast is saved and compared with what NEA measured, and the scores are on the About page.",
        sources: [["Haze Lah accuracy", "/about#accuracy"]],
      },
      {
        id: "cigarettes",
        q: "How many cigarettes is the haze equal to?",
        a: `Breathing PM2.5 at ${PM25_PER_CIGARETTE} µg/m³ for 24 hours carries about the same risk of early death as smoking one cigarette (Berkeley Earth, 2015). ${CIGARETTE_NOTES[2]}`,
        sources: CIGARETTE_SOURCES.map(([n, u]) => [n, u]),
      },
    ],
  },
];
