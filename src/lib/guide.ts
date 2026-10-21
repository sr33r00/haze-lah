import { ECDA, MOE, MOH, NEA_FAQ } from "./advice";
import { pm25ToPsi, pm25ToUsAqi } from "./bands";

type Source = [name: string, url: string];
export type GuideItem = { id: string; q: string; a: string; points?: string[]; sources: Source[] };
export type GuideSection = { id: string; title: string; items: GuideItem[] };

// Named for the reader: several sources share an agency, so "NEA, NEA" would say nothing.
const NEA_GUIDE: Source = ["NEA PSI and PM2.5 guide", "https://www.haze.gov.sg/docs/default-source/posters/haze-pm-psi-guide-a4-english.pdf"];
const AQICN: Source = ["AQICN Singapore page", "https://aqicn.org/city/singapore/"];
const AQICN_SCALE: Source = ["AQICN scale", "https://aqicn.org/scale/"];
const NEA_HAZE: Source = ["NEA: managing haze", "https://www.nea.gov.sg/our-services/pollution-control/air-pollution/managing-haze"];
const NEA_QA: Source = ["NEA air pollution FAQ", NEA_FAQ[1]];
const MOH_HAZE: Source = ["MOH haze advice", MOH[1]];
const MOE_HAZE: Source = ["MOE haze measures", MOE[1]];
const HAZE_MASK: Source = ["HazeMaskGoWhere", "https://go.gov.sg/hazemask"];
const TASK_FORCE: Source = ["Haze Task Force release", ECDA[1]];
const PRESCHOOLS: Source = ["ECDA, in the Haze Task Force release", ECDA[1]];
const MOM: Source = ["MOM employer guidelines", "https://www.mom.gov.sg/haze/guidelines-on-protecting-employees-from-haze"];
const HSS: Source = [
  "MOH Haze Subsidy Scheme",
  "https://www.moh.gov.sg/newsroom/haze-subsidy-scheme-to-start-at-public-health-preparedness-clinics-and-polyclinics-from-12-october-2026/",
];

/** The whole answer as one paragraph, for structured data. */
export const answerText = (it: GuideItem) => [it.a, ...(it.points ?? [])].join(" ");

/**
 * Questions people ask during haze: a short answer first, then the detail as points.
 * Every answer restates the cited official page (NEA, MOH, MOE, MOM); the FAQPage structured data on /guide is built from this list.
 */
export const GUIDE: GuideSection[] = [
  {
    id: "outdoors",
    title: "Outdoors",
    items: [
      {
        id: "go-out",
        q: "Is it safe to go out or exercise?",
        a: "Go by the 1-hour PM2.5. Above 55, cut down strenuous outdoor activity, and if you are in a vulnerable group, avoid it.",
        points: [
          "Band II (56 to 150): healthy people reduce strenuous outdoor activity. The elderly, pregnant women, children and people with heart or lung disease avoid it.",
          "Band III (151 to 250): healthy people avoid strenuous outdoor activity. Vulnerable groups avoid all outdoor activity.",
          "Band IV (251 and above): healthy people minimise all outdoor activity. Vulnerable groups avoid it.",
          "For the next day, follow the 24-hour PSI forecast and advisory. This app's answer for now follows the 1-hour PM2.5.",
        ],
        sources: [NEA_GUIDE, MOH_HAZE],
      },
      {
        id: "psi-pm25",
        q: "Which to use: PSI or PM2.5?",
        a: "The 1-hour PM2.5 for the next few hours, and the 24-hour PSI forecast to plan the next day.",
        points: ["PM2.5 is the main pollutant of concern in smoke haze.", "The 24-hour PSI averages the past day, so the 1-hour PM2.5 shows changes sooner."],
        sources: [NEA_GUIDE, NEA_HAZE],
      },
      {
        id: "other-apps",
        q: "Why does AQICN show a bigger number than NEA?",
        a: "The air is the same. AQICN uses NEA's readings. It shows them on a US scale, and that scale gives bigger numbers.",
        points: [
          "AQICN takes NEA's PM2.5 for the last hour. It changes that reading to a US AQI number.",
          "NEA's PSI and the US AQI both go from 0 to 500. For the same air, the US AQI number is bigger.",
          ...[24, 49, 55, 65, 100].map((c) => `NEA PM2.5 ${c}: AQICN shows ${pm25ToUsAqi(c)}. As a PSI, it is ${pm25ToPsi(c)}.`),
          "NEA's PSI is the average of the past 24 hours. When haze comes in fast, the last-hour reading goes up first.",
          "On the Now card, under \"Right now\", this app shows the number that AQICN shows for the same PM2.5 reading.",
          "NEA's health advice uses NEA's numbers. Follow NEA's advice, not the US AQI words.",
        ],
        sources: [NEA_GUIDE, AQICN, AQICN_SCALE],
      },
      {
        id: "psi-bands",
        q: "What PSI is unhealthy?",
        a: "A 24-hour PSI of 101 and above is deemed unhealthy.",
        points: ["Good: 0 to 50.", "Moderate: 51 to 100.", "Unhealthy: 101 to 200.", "Very unhealthy: 201 to 300.", "Hazardous: above 300."],
        sources: [NEA_GUIDE, NEA_HAZE],
      },
      {
        id: "cause",
        q: "What causes the haze?",
        a: "Forest fires in the region, started by open burning to clear land.",
        points: ["Dry seasons, wind direction and low rainfall make it worse.", "Winds carry the smoke over Singapore, particularly in the Southwest monsoon."],
        sources: [NEA_HAZE, NEA_QA],
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
        a: "Not for short trips like commuting, or indoors.",
        points: [
          "Healthy people who must be outdoors for several hours may wear one when the PSI forecast is Hazardous (above 300) or the 1-hour PM2.5 is in band IV.",
          "The elderly, pregnant women and people with heart or lung disease may wear one when the PSI forecast is above 200 or the PM2.5 is in band III.",
          "Surgical masks do not filter fine particles, and an N95 only works with a good fit.",
        ],
        sources: [NEA_QA, MOH_HAZE],
      },
      {
        id: "n95-doctor",
        q: "Who should check with a doctor before using an N95?",
        a: "The elderly, pregnant women and people with severe heart or lung problems who have difficulty breathing at rest or on exertion.",
        points: ["Anyone who feels uncomfortable should take a break from the mask."],
        sources: [MOH_HAZE, NEA_QA],
      },
      {
        id: "free-masks",
        q: "Where can I get free N95 masks?",
        a: "During bad haze the Government gives free N95 masks to eligible Singaporeans at Community Clubs and mask vending machines. HazeMaskGoWhere shows who is eligible, where to collect and which places have stock.",
        points: ["Bring the eligible person's NRIC."],
        sources: [HAZE_MASK, TASK_FORCE],
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
        a: "Close doors and windows when the air outside is getting worse, and open them again when it improves.",
        points: ["Fans and aircon are fine.", "If the aircon draws in unfiltered outside air, such as a window unit, close its outdoor air intake."],
        sources: [NEA_QA],
      },
      {
        id: "purifier",
        q: "Which air purifier should I get?",
        a: "One with a HEPA filter, big enough for the room.",
        points: [
          "Its smoke CADR should be at least 3 times the room volume in cubic metres.",
          "For example, a 4 by 3 m bedroom with a 2.6 m ceiling is about 31 m³, so look for a smoke CADR of at least 94 m³ per hour.",
        ],
        sources: [NEA_QA],
      },
      {
        id: "shelter",
        q: "Where can I get away from the haze?",
        a: "At haze shelters: air-conditioned rooms in Community Clubs and selected Residents' Committee and Residents' Network centres.",
        points: ["They open to the public when the PSI enters Very unhealthy (above 200).", "Shelters in Community Clubs stay open until 10pm if the PSI turns Hazardous."],
        sources: [TASK_FORCE],
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
        a: "Minimise prolonged or strenuous outdoor exertion when the 24-hour PSI forecast is above 100.",
        points: [
          "Avoid outdoor activity when it is above 300.",
          "There is no certified mask standard, such as N95, for children.",
          "MOH says the AIR+ Smart Mask can be used only where necessary by children without heart or lung conditions, if it keeps a good seal.",
        ],
        sources: [NEA_QA, MOH_HAZE],
      },
      {
        id: "schools",
        q: "Will schools close?",
        a: "MOE considers closing schools when the next day is forecast Hazardous (24-hour PSI above 300).",
        points: [
          "A closure is announced when the health advisory is issued.",
          "Below that, schools cut outdoor activity as the PSI rises and keep pupils in rooms with air purifiers.",
        ],
        sources: [MOE_HAZE],
      },
      {
        id: "preschools",
        q: "What do preschools do?",
        a: "At Very unhealthy, preschools stop all outdoor and strenuous indoor activity.",
        points: [
          "Children stay indoors with doors and windows closed, and a room with an air purifier is set aside.",
          "Children with heart or lung conditions skip all indoor physical activity.",
        ],
        sources: [PRESCHOOLS],
      },
    ],
  },
  {
    id: "work",
    title: "Work",
    items: [
      {
        id: "work-rules",
        q: "What should my employer do?",
        a: "MOM's guidelines: less outdoor work as the PSI rises, and protection for staff who still work outdoors.",
        points: [
          "For healthy staff: reduce prolonged or strenuous outdoor work at PSI 101 to 200, avoid it at 201 to 300, and minimise outdoor work above 300. Limits are stricter for vulnerable staff.",
          "Fit-test masks for staff still working outdoors, and keep at least a 1-week supply of N95s.",
          "Use measures such as job rotation, indoor rest breaks and enough water.",
        ],
        sources: [MOM, TASK_FORCE],
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
        a: "If you feel unwell or have trouble breathing, especially if you are elderly, a child or have a heart or lung condition.",
        points: [
          "In healthy people, a few days of haze may irritate the eyes, nose and throat, which usually clears on its own.",
          "Haze can worsen heart and lung disease, and symptoms may show up 1 to 3 days after exposure.",
        ],
        sources: [MOH_HAZE, NEA_QA],
      },
      {
        id: "pregnancy",
        q: "Is haze a risk in pregnancy?",
        a: "NEA advises pregnant women to reduce exposure to haze for the health of the unborn baby.",
        points: [
          "PSI 101 to 200: minimise prolonged or strenuous outdoor exertion.",
          "PSI 201 to 300: minimise outdoor activity.",
          "Above 300: avoid outdoor activity.",
          "In the 2nd and 3rd trimesters, stop using an N95 if it feels uncomfortable.",
        ],
        sources: [NEA_QA, NEA_GUIDE],
      },
      {
        id: "subsidy",
        q: "Is treatment subsidised?",
        a: "Yes, while MOH's Haze Subsidy Scheme is active. It has been active since 12 Oct 2026.",
        points: [
          "All Singapore Citizens qualify at polyclinics.",
          "At participating Public Health Preparedness Clinics (look for the PHPC decal), it covers children 18 and below, seniors 65 and above, and some card holders such as CHAS Blue and Orange.",
          "For conditions like asthma and bronchitis, eligible citizens pay no more than $10, Pioneer and Merdeka Generation no more than $5, and Public Assistance card holders nothing.",
        ],
        sources: [HSS, MOH_HAZE],
      },
    ],
  },
];
