/**
 * Integrity checks on the bundled 卦辞.
 *
 * These are all self-contained: they hold the text against this repo's own
 * 卦码 table and against itself, so they keep working with no network and no
 * second edition to consult. That matters because the text has a single source
 * (Chinese Wikisource) and a wiki is not a critical edition.
 */
import { describe, expect, it } from "bun:test";
import { GUA64 } from "../src/const.js";
import { GUACI_MISSING, guaci } from "../src/najia.js";

const POSITIONS = ["初", "二", "三", "四", "五", "上"] as const;
const YAO_LABEL = /^(初[六九]|[六九][二三四五]|上[六九])：/;

/** 爻位 name for position `i` (0 = 初爻), given whether that 爻 is 阳. */
function yaoLabel(i: number, yang: boolean): string {
	const sex = yang ? "九" : "六";
	// 初 and 上 lead with the position; the middle four lead with the number.
	return i === 0 || i === 5 ? `${POSITIONS[i]}${sex}` : `${sex}${POSITIONS[i]}`;
}

describe("卦辞 integrity", () => {
	it("covers all sixty-four 卦", () => {
		expect(GUACI_MISSING).toEqual([]);
		expect(Object.keys(GUA64).length).toBe(64);
	});

	/**
	 * The strongest check available without a second edition: 爻位 names are a
	 * function of the 卦码, so a transposed or misfiled 爻辞 shows up here. This
	 * is what pinned down 复卦's 「不复远 / 不远复」.
	 */
	it("labels every 爻 the way its 卦码 requires", () => {
		for (const [mark, name] of Object.entries(GUA64)) {
			const expected = [...mark].map((bit, i) => yaoLabel(i, bit === "1"));
			const found = (guaci(name) ?? "")
				.split("\n")
				.map((line) => line.match(YAO_LABEL)?.[1])
				.filter((x): x is string => Boolean(x));
			expect(found, `${name} (${mark})`).toEqual(expected);
		}
	});

	it("pairs each 爻辞 with exactly one 小象, after one 大象", () => {
		for (const name of Object.values(GUA64)) {
			const lines = (guaci(name) ?? "").split("\n");
			const yao = lines.filter((l) =>
				/^(初[六九]|[六九][二三四五]|上[六九]|用[九六])：/.test(l),
			);
			const xiang = lines.filter((l) => l.startsWith("象曰："));
			expect(yao.length, name).toBeGreaterThanOrEqual(6);
			expect(xiang.length, name).toBe(yao.length + 1);
		}
	});

	it("keeps 彖曰 and 象曰 present and singular where expected", () => {
		for (const name of Object.values(GUA64)) {
			const lines = (guaci(name) ?? "").split("\n");
			expect(lines.filter((l) => l.startsWith("彖曰：")).length, name).toBe(1);
		}
	});

	it("carries no apparatus, watermark or unrenderable character", () => {
		for (const name of Object.values(GUA64)) {
			const text = guaci(name) ?? "";
			// Wikisource glosses variants inline, e.g. 保合大和〈一作太和〉.
			expect(text, name).not.toMatch(/[〈〉]/);
			// The previous, scraped source embedded a site watermark and BBCode.
			expect(text, name).not.toContain("aa963");
			expect(text, name).not.toMatch(/\[\/?[A-Za-z]/);
			// opencc maps a few classical characters onto extension-plane variants
			// that render as a missing glyph, e.g. 餗 -> U+2B5E7.
			const stray = [...text].filter((c) => (c.codePointAt(0) ?? 0) > 0xffff);
			expect(stray, name).toEqual([]);
		}
	});

	it("starts each entry with its own 卦名 and nothing else's", () => {
		for (const name of Object.values(GUA64)) {
			const lines = (guaci(name) ?? "").split("\n");
			expect(lines[0], name).toContain(name);
			// 泽山咸 once carried the whole of 雷风恒 appended to it.
			expect(
				lines.slice(1).filter((l) => l.startsWith("《易经》第")),
				name,
			).toEqual([]);
		}
	});
});
