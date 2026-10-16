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
        a: "For the next few hours, check the 1-hour PM2.5. Healthy people reduce strenuous outdoor activity in band II, avoid it in band III and minimise all outdoor activity in band IV. The elderly, pregnant women, children and people with heart or lung disease avoid strenuous outdoor activity in band II and all outdoor activity from band III. For the day ahead, the 24-hour PSI advisory applies; this app follows whichever of the two is stricter.",
        sources: [NEA_GUIDE, MOH],
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
        a: "Not for short trips like commuting, or indoors. A healthy person who must be outdoors for several hours may wear one when the PSI forecast is Hazardous (above 300) or the 1-hour PM2.5 is in band IV. The elderly, pregnant women and people with heart or lung disease may wear one when the PSI forecast is above 200 or PM2.5 is in band III. Surgical masks do not filter fine particles, and an N95 only works with a good fit.",
        sources: [NEA_FAQ, MOH],
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
        a: "When the PSI enters Very unhealthy (above 200), People's Association grassroots organisations give N95 masks to eligible Singaporeans, with mask vending machines at selected transport hubs, Social Service Offices and PA venues. Collect with the eligible person's NRIC, and check gov.sg for current details.",
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
        a: "Close doors and windows when the air outside is getting worse, and open them again when it improves. Fans or aircon are fine, but if the aircon draws in unfiltered outside air, such as a window unit, close its outdoor air intake.",
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
        a: "When the PSI enters Very unhealthy (above 200), air-conditioned rooms in Community Clubs and selected Residents' Committee and Residents' Network centres open as haze shelters for the public. Shelters in Community Clubs stay open until 10pm if the PSI turns Hazardous.",
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
        a: "Minimise prolonged or strenuous outdoor exertion when the 24-hour PSI forecast is above 100, and avoid outdoor activity when it is above 300. There is no certified mask standard, such as N95, for children; MOH says the AIR+ Smart Mask can be used only where necessary by children without heart or lung conditions, if it keeps a good seal.",
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
        a: "At Very unhealthy, preschools stop all outdoor and strenuous indoor activity, keep children indoors with doors and windows closed, and set aside a room with an air purifier. Children with heart or lung conditions skip all indoor physical activity.",
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
        a: "For healthy staff, MOM's guidelines say to reduce prolonged or strenuous outdoor work at PSI 101 to 200, avoid it at 201 to 300 and minimise outdoor work above 300, with stricter limits for vulnerable staff. Employers should fit-test masks for staff still working outdoors, keep at least a 1-week supply of N95s, and use measures such as job rotation, indoor rest breaks and enough water.",
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
        a: "In healthy people, a few days of haze may irritate the eyes, nose and throat, which usually clears on its own. It can worsen heart and lung disease, and symptoms may show up 1 to 3 days after exposure. See a doctor if you feel unwell or have trouble breathing, especially if you are elderly, a child or have a heart or lung condition.",
        sources: [MOH, NEA_FAQ],
      },
      {
        id: "pregnancy",
        q: "Is haze a risk in pregnancy?",
        a: "NEA advises pregnant women to reduce exposure to haze for the health of the unborn baby: minimise prolonged or strenuous outdoor exertion at PSI 101 to 200, minimise outdoor activity at 201 to 300, and avoid it above 300. In the 2nd and 3rd trimesters, stop using an N95 if it feels uncomfortable.",
        sources: [NEA_FAQ, NEA_GUIDE],
      },
      {
        id: "subsidy",
        q: "Is treatment subsidised?",
        a: "Only when MOH activates the Haze Subsidy Scheme, which it did from 12 Oct 2026. All Singapore Citizens qualify at polyclinics. At participating Public Health Preparedness Clinics (look for the PHPC decal) it covers children 18 and below, seniors 65 and above and some card holders such as CHAS Blue and Orange. For conditions like asthma and bronchitis, eligible citizens pay no more than $10, Pioneer and Merdeka Generation no more than $5, and Public Assistance card holders nothing.",
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
