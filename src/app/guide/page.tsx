import { pageMeta } from "@/lib/seo";
import AppShell from "@/components/AppShell";
import GuideView from "@/components/GuideView";
import JsonLd from "@/components/JsonLd";
import { GUIDE, answerText } from "@/lib/guide";

export const metadata = pageMeta(
  "Singapore haze guide: masks, exercise, schools and health advice",
  "Short answers to common Singapore haze questions on N95 masks, exercise, air purifiers, schools, work and health, each with official NEA, MOH, MOE and MOM sources.",
  "/guide",
);
// Fully static, built once per deploy: the guide shows no live readings, so the shell gets no data (no "updated" label).
export default function Guide() {
  const items = GUIDE.flatMap((s) => s.items);
  return (
    <AppShell title="Guide">
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
