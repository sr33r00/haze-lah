import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import GuideView from "@/components/GuideView";
import JsonLd from "@/components/JsonLd";
import { getHazeData } from "@/lib/data";
import { GUIDE, answerText } from "@/lib/guide";

export const metadata = pageMeta(
  "Singapore haze guide: masks, exercise, schools and health advice",
  "Short answers to common Singapore haze questions on N95 masks, exercise, air purifiers, schools, work and health, each with official NEA, MOH, MOE and MOM sources.",
  "/guide",
);
export const revalidate = 300;

export default async function Guide() {
  const data = await getHazeData();
  const items = GUIDE.flatMap((s) => s.items);
  return (
    <AppShell data={data} title="Guide">
      <GuideView />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: answerText(it) } })),
        }}
      />
    </AppShell>
  );
}
