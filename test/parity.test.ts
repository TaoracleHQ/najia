/**
 * Parity against the Python `najia` reference.
 *
 * A wrong hexagram throws nothing and looks fine, so equivalence with the
 * reference implementation is asserted mechanically rather than trusted.
 *
 * `fullSpace.sha256` covers every one of the 4^6 = 4096 cast combinations. If it
 * breaks, something changed in a derivation; the curated cases below then point
 * at which field. Regenerate the fixture only after confirming the reference
 * agrees — see tools/make-parity-fixture.ts.
 */
import { describe, expect, it } from "bun:test";
import { cast, type Yao } from "../src/najia.js";
import {
	allCombinations,
	digest,
	PARITY_DATES,
	project,
} from "../tools/parity-shape.js";
import fixture from "./fixtures/parity.json" with { type: "json" };

function readingFor(key: string) {
	const [paramStr, dateStr] = key.split("@") as [string, string];
	const [y, m, d, h] = dateStr.split("-").map(Number) as [
		number,
		number,
		number,
		number,
	];
	const params = [...paramStr].map(Number) as Yao[];
	return cast(params, { date: new Date(y, m - 1, d, h, 0, 0) });
}

describe("parity with the Python reference", () => {
	it("matches across the entire 4^6 cast space", async () => {
		const combos = allCombinations();
		expect(combos.length).toBe(fixture.fullSpace.combinations);

		const rows = combos.map((params, i) => {
			const date = PARITY_DATES[i % PARITY_DATES.length] as readonly [
				number,
				number,
				number,
				number,
			];
			return project(
				cast(params as Yao[], {
					date: new Date(date[0], date[1] - 1, date[2], date[3], 0, 0),
				}),
			);
		});

		expect(await digest(rows)).toBe(fixture.fullSpace.sha256);
	});

	it("curates enough cases to cover every 卦宫", () => {
		const gongs = new Set(fixture.curated.map(({ expected }) => expected[2]));
		expect(gongs.size).toBe(8);
	});

	for (const { key, expected } of fixture.curated) {
		it(`reproduces ${key}`, () => {
			expect(project(readingFor(key))).toEqual(expected);
		});
	}
});
