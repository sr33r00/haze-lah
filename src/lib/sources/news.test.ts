import assert from "node:assert/strict";
import { test } from "node:test";
import { toText } from "@/lib/sources/news";

test("toText joins words split by inline tags", () => {
  assert.equal(toText("<b>Th</b>e PSI forecast"), "The PSI forecast");
  assert.equal(toText("<span>T</span><em>he</em> PSI"), "The PSI");
  assert.equal(toText("&lt;b&gt;Th&lt;/b&gt;e PSI"), "The PSI");
});

test("toText keeps words apart across block tags", () => {
  assert.equal(toText("<p>One</p><p>Two</p>"), "One Two");
  assert.equal(toText("One<br/>Two<br />Three"), "One Two Three");
  assert.equal(toText("<ul><li>A</li><li>B</li></ul>"), "A B");
  assert.equal(toText("<td>x</td><td>y</td>"), "x y");
});
