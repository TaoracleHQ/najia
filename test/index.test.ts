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

	it("does not leak the source site's scrape artefacts into 卦辞", () => {
		// The upstream text carried a watermark and a stray BBCode tag; both would
		// otherwise be read aloud to users as if they were part of the 象曰.
		const texts = Object.values(GUA64).map((name) => guaci(name) ?? "");
		expect(texts.filter((t) => t.includes("aa963"))).toEqual([]);
		expect(texts.filter((t) => /\[\/?[A-Za-z]/.test(t))).toEqual([]);
	});

	it("keeps each 卦辞 to its own 卦", () => {
		// 泽山咸 used to carry all of 雷风恒 appended to it.
		for (const name of Object.values(GUA64)) {
			const lines = (guaci(name) ?? "").split("\n");
			expect(lines[0]).toContain(name);
			expect(lines.slice(1).filter((l) => l.startsWith("《易经》第"))).toEqual(
				[],
			);
		}
	});
});
