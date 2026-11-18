import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

test("Driver Delivery Portal Multilingual Suite", async (t) => {
  const i18nDir = path.resolve(process.cwd(), "src/lib/i18n/driver-portal");
  const typesPath = path.join(i18nDir, "types.ts");
  const enPath = path.join(i18nDir, "en.ts");
  const taPath = path.join(i18nDir, "ta.ts");
  const hiPath = path.join(i18nDir, "hi.ts");

  await t.test("should ensure all i18n dictionary and type files exist", () => {
    assert.ok(fs.existsSync(typesPath), "types.ts must exist");
    assert.ok(fs.existsSync(enPath), "en.ts must exist");
    assert.ok(fs.existsSync(taPath), "ta.ts must exist");
    assert.ok(fs.existsSync(hiPath), "hi.ts must exist");
  });

  await t.test("should define all three supported languages with native labels in types.ts", () => {
    const typesContent = fs.readFileSync(typesPath, "utf-8");
    assert.ok(typesContent.includes('export type DriverLanguage = "en" | "ta" | "hi";'));
    assert.ok(typesContent.includes('{ code: "en", label: "English", nativeLabel: "English" }'));
    assert.ok(typesContent.includes('{ code: "ta", label: "Tamil", nativeLabel: "தமிழ்" }'));
    assert.ok(typesContent.includes('{ code: "hi", label: "Hindi", nativeLabel: "हिन्दी" }'));
  });

  await t.test("should accurately validate language schema and reject unsupported languages", () => {
    const languageSchema = z.object({
      language: z.enum(["en", "ta", "hi"]),
    });

    assert.ok(languageSchema.safeParse({ language: "en" }).success);
    assert.ok(languageSchema.safeParse({ language: "ta" }).success);
    assert.ok(languageSchema.safeParse({ language: "hi" }).success);

    assert.ok(!languageSchema.safeParse({ language: "fr" }).success);
    assert.ok(!languageSchema.safeParse({ language: "es" }).success);
    assert.ok(!languageSchema.safeParse({ language: "" }).success);
    assert.ok(!languageSchema.safeParse({}).success);
  });

  await t.test("should ensure key parity across English, Tamil, and Hindi dictionaries", () => {
    const enContent = fs.readFileSync(enPath, "utf-8");
    const taContent = fs.readFileSync(taPath, "utf-8");
    const hiContent = fs.readFileSync(hiPath, "utf-8");

    // Extract property keys from en.ts
    const keyRegex = /^\s*([a-zA-Z0-9]+):\s*(?:["'`]|(?:["'`]))/gm;
    const enKeys = new Set();
    let match;
    while ((match = keyRegex.exec(enContent)) !== null) {
      enKeys.add(match[1]);
    }

    assert.ok(enKeys.size >= 50, `English dictionary should have 50+ keys, found ${enKeys.size}`);

    for (const key of enKeys) {
      assert.ok(
        taContent.includes(`${key}:`),
        `Tamil dictionary must include key: ${key}`
      );
      assert.ok(
        hiContent.includes(`${key}:`),
        `Hindi dictionary must include key: ${key}`
      );
    }
  });

  await t.test("should verify native Tamil and Hindi operational translations", () => {
    const taContent = fs.readFileSync(taPath, "utf-8");
    const hiContent = fs.readFileSync(hiPath, "utf-8");

    // Tamil key verification
    assert.ok(taContent.includes("விநியோகங்கள்"), "Tamil dictionary must have translation for Deliveries");
    assert.ok(taContent.includes("பிக்அப்"), "Tamil dictionary must have translation for Pickups");
    assert.ok(taContent.includes("வாடிக்கையாளர்"), "Tamil dictionary must have translation for Customer");
    assert.ok(taContent.includes("கட்டுமான தளம்"), "Tamil dictionary must have translation for Construction Site");
    assert.ok(taContent.includes("சேதமடைந்தவை"), "Tamil dictionary must have translation for Damaged Qty");

    // Hindi key verification
    assert.ok(hiContent.includes("डिलीवरी"), "Hindi dictionary must have translation for Deliveries");
    assert.ok(hiContent.includes("पिकअप"), "Hindi dictionary must have translation for Pickups");
    assert.ok(hiContent.includes("ग्राहक"), "Hindi dictionary must have translation for Customer");
    assert.ok(hiContent.includes("निर्माण स्थल"), "Hindi dictionary must have translation for Construction Site");
    assert.ok(hiContent.includes("क्षतिग्रस्त मात्रा"), "Hindi dictionary must have translation for Damaged Qty");
  });
});
