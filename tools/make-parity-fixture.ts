#!/usr/bin/env bun
/**
 * Turn a Python `najia` oracle dump into the committed parity fixture.
 *
 * The oracle itself is ~3 MB and is not committed. What lands in the repo is an
 * aggregate SHA-256 over all 4096 readings plus a curated subset with full
 * expected values, so CI verifies parity without needing a Python interpreter.
 *
 * Regenerating requires the reference implementation:
 *
 *   cd apps/backend && uv run python <dump script> > oracle.json
 *   bun run tools/make-parity-fixture.ts oracle.json
 */
import type { CastResult } from "../src/najia.js";
import {
	allCombinations,
	caseKey,
	digest,
	PARITY_DATES,
	project,
} from "./parity-shape.js";

interface OracleCase {
	mark: string;
	name: string;
	gong: string;
	shi: number;
	ying: number;
	qin6: string[];
	qinx: string[];
	god6: string[];
	dong: number[];
	gz: { year: string; month: string; day: string; hour: string };
	xkong: string;
	bian: {
		mark: string;
		name: string;
		gong: string;
		qin6: string[];
		qinx: string[];
	} | null;
	hide: {
		mark: string;
		name: string;
		qin6: string[];
		qinx: string[];
		seat: number[];
	} | null;
	error?: string;
}

/** Rebuild a {@link CastResult}-shaped value from the oracle so `project` applies. */
function asResult(o: OracleCase, params: number[]): CastResult {
	return {
		params: params as CastResult["params"],
		gua: {
			name: o.name,
			mark: o.mark,
			gong: o.gong as CastResult["gua"]["gong"],
			qin6: o.qin6 as CastResult["gua"]["qin6"],
			qinx: o.qinx,
		},
		shiy: { shi: o.shi, ying: o.ying },
		type: "",
		soul: "",
		god6: o.god6 as CastResult["god6"],
		dong: o.dong,
		bian:
			o.bian === null
				? null
				: {
						name: o.bian.name,
						mark: o.bian.mark,
						gong: o.bian.gong as CastResult["gua"]["gong"],
						qin6: o.bian.qin6 as CastResult["gua"]["qin6"],
						qinx: o.bian.qinx,
					},
		hide:
			o.hide === null
				? null
				: {
						name: o.hide.name,
						mark: o.hide.mark,
						gong: o.gong as CastResult["gua"]["gong"],
						qin6: o.hide.qin6 as CastResult["gua"]["qin6"],
						qinx: o.hide.qinx,
						seat: [...o.hide.seat].sort((a, b) => a - b),
					},
		ganzhi: { ...o.gz, xkong: o.xkong as CastResult["ganzhi"]["xkong"] },
	};
}

/** Cases chosen to cover every 卦型 and every 变卦 / 伏神 branch. */
function curate(keys: string[], oracle: Record<string, OracleCase>): string[] {
	const picked: string[] = [];
	const seen = new Set<string>();
	for (const key of keys) {
		const o = oracle[key];
		if (!o) continue;
		const bucket = [
			o.gong,
			o.bian === null ? "no-bian" : "bian",
			o.hide === null ? "no-hide" : "hide",
			o.dong.length === 0
				? "static"
				: o.dong.length === 6
					? "all-moving"
					: "some-moving",
		].join("/");
		if (seen.has(bucket)) continue;
		seen.add(bucket);
		picked.push(key);
	}
	return picked;
}

const oraclePath = Bun.argv[2];
if (!oraclePath) throw new Error("usage: make-parity-fixture.ts <oracle.json>");

const oracle = JSON.parse(await Bun.file(oraclePath).text()) as Record<
	string,
	OracleCase
>;
const combos = allCombinations();

const rows: (string | number | null)[][] = [];
const keys: string[] = [];
for (const [i, params] of combos.entries()) {
	const date = PARITY_DATES[i % PARITY_DATES.length] as readonly [
		number,
		number,
		number,
		number,
	];
	const key = caseKey(params, date);
	const o = oracle[key];
	if (!o || o.error) throw new Error(`oracle missing or errored for ${key}`);
	rows.push(project(asResult(o, params)));
	keys.push(key);
}

const curated = curate(keys, oracle);
const fixture = {
	$comment:
		"Generated from the Python najia 2.0.1 reference. Do not hand-edit: regenerate with tools/make-parity-fixture.ts.",
	reference: "najia 2.0.1 (python, MIT, bopo)",
	dates: PARITY_DATES,
	fullSpace: {
		combinations: combos.length,
		sha256: await digest(rows),
	},
	curated: curated.map((key) => {
		const params = [...(key.split("@")[0] as string)].map(Number);
		return {
			key,
			expected: project(asResult(oracle[key] as OracleCase, params)),
		};
	}),
};

await Bun.write(
	"test/fixtures/parity.json",
	`${JSON.stringify(fixture, null, "\t")}\n`,
);
console.log(
	`wrote test/fixtures/parity.json — ${combos.length} hashed, ${curated.length} curated cases`,
);
