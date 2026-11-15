import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appText, APP_TEXT_ROWS } from "./appText";
import { LANGS } from "./i18n";

// The app's own words in every language the Language setting offers.

describe("the app's translations", () => {
  it("has every phrase in every language", () => {
    const langs = LANGS.map((l) => l.value).filter((l) => l !== "en");
    for (const [phrase, row] of Object.entries(APP_TEXT_ROWS)) {
      for (const lang of langs) assert.ok(row[lang]?.trim(), `${phrase} in ${lang}`);
    }
  });

  it("leaves English, names and unknown text as they are", () => {
    assert.equal(appText("Matches", "en"), "Matches");
    assert.equal(appText("Jolly Boys", "kn"), "Jolly Boys");
  });

  it("translates the app's own words", () => {
    assert.equal(appText("Matches", "hi"), "मैच");
    assert.equal(appText("Scorecard", "kn"), "ಸ್ಕೋರ್‌ಕಾರ್ಡ್");
  });
});
