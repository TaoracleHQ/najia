import { describe, expect, it } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { GUA64 } from "../src/const.js";
import { cast, GUACI_MISSING, guaci, VERSION } from "../src/index.js";

describe("package", () => {
	it("keeps VERSION in step with package.json", () => {
		expect(VERSION).toBe(pkg.version);
	});

	it("exposes 起卦 from the root entry point", () => {
		// 2 拆 / 2 拆 / 1 单 / 4 交 / 2 拆 / 2 拆 —— the 交 sits at index 3.
		const reading = cast("221422", { date: new Date(2026, 6, 26, 14, 0, 0) });
		expect(reading.gua.name).toBe("地山谦");
		expect(reading.gua.mark).toBe("001000");
		expect(reading.dong).toEqual([3]);
	});

	it("bundles 卦辞 for all sixty-four 卦", () => {
		expect(GUACI_MISSING).toEqual([]);
	});

	it("carries only scripture in 卦辞, no apparatus or scrape artefacts", () => {
		// Failures here would be read aloud to users as if they were 经文:
		// the old scraped text embedded a site watermark and a BBCode tag, and
		// Wikisource carries the odd editorial gloss such as 〈一作太和〉.
		const texts = Object.values(GUA64).map((name) => guaci(name) ?? "");
		expect(texts.filter((t) => t.includes("aa963"))).toEqual([]);
		expect(texts.filter((t) => /\[\/?[A-Za-z]/.test(t))).toEqual([]);
		expect(texts.filter((t) => /[〈〉]/.test(t))).toEqual([]);
		// opencc maps a few classical characters onto extension-plane variants
		// that render as a missing glyph, e.g. 餗 -> U+2B5E7.
		expect(
			texts.filter((t) => [...t].some((c) => (c.codePointAt(0) ?? 0) > 0xffff)),
		).toEqual([]);
	});

	it("keeps each 卦辞 to its own 卦, with every 爻 paired to its 小象", () => {
		const YAO = /^(初[六九]|[六九][二三四五]|上[六九]|用[九六])：/;
		for (const name of Object.values(GUA64)) {
			const lines = (guaci(name) ?? "").split("\n");
			// 泽山咸 used to carry all of 雷风恒 appended to it.
			expect(lines[0]).toContain(name);
			expect(lines.slice(1).filter((l) => l.startsWith("《易经》第"))).toEqual(
				[],
			);
			// 乾卦 shipped with no per-爻 小象 at all in the old data.
			const yao = lines.filter((l) => YAO.test(l));
			const xiao = lines.filter((l) => l.startsWith("象曰："));
			expect(yao.length).toBeGreaterThanOrEqual(6);
			expect(xiao.length).toBe(yao.length + 1); // + 大象
		}
	});
});
