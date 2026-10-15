// Scores archived forecasts against NEA observations; writes data/accuracy.json.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { scoreArchive, type ArchiveRecord } from "../src/lib/accuracy";

const files = readdirSync("data/archive").filter((f) => f.endsWith(".jsonl")).sort();
const records: ArchiveRecord[] = files.flatMap((f) =>
  readFileSync(`data/archive/${f}`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l)),
);
const out = scoreArchive(records);
writeFileSync("data/accuracy.json", JSON.stringify(out, null, 1) + "\n");
console.log(`scored ${records.length} forecasts`);
