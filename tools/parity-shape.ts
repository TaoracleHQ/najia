/**
 * Canonical projection shared by the fixture generator and the parity test.
 *
 * Both sides must reduce a reading to the exact same array for the aggregate
 * hash to mean anything, so the shape lives here and nowhere else.
 */
import type { CastResult } from "../src/najia.js";

/** The five dates the fixture rotates through, matching the generator. */
export const PARITY_DATES: ReadonlyArray<
	readonly [number, number, number, number]
> = [
	[1949, 10, 1, 15],
	[1984, 2, 29, 9],
	[2000, 8, 16, 11],
	[2024, 6, 5, 23],
	[2026, 7, 26, 14],
];

/** All 4^6 cast combinations, 初爻 first, in odometer order. */
export function allCombinations(): number[][] {
	const out: number[][] = [];
	const walk = (prefix: number[]) => {
		if (prefix.length === 6) {
			out.push(prefix);
			return;
		}
		for (const yao of [1, 2, 3, 4]) walk([...prefix, yao]);
	};
	walk([]);
	return out;
}

export function caseKey(
	params: readonly number[],
	date: readonly number[],
): string {
	return `${params.join("")}@${date[0]}-${date[1]}-${date[2]}-${date[3]}`;
}

/** Flatten a reading into comparable scalars, in a fixed order. */
export function project(result: CastResult): (string | number | null)[] {
	const out: (string | number | null)[] = [
		result.gua.mark,
		result.gua.name,
		result.gua.gong,
		result.shiy.shi,
		result.shiy.ying,
		...result.gua.qin6,
		...result.gua.qinx,
		...result.god6,
		result.dong.join(","),
		result.ganzhi.year,
		result.ganzhi.month,
		result.ganzhi.day,
		result.ganzhi.hour,
		result.ganzhi.xkong,
	];

	if (result.bian === null) out.push(null);
	else {
		out.push(
			result.bian.mark,
			result.bian.name,
			result.bian.gong,
			...result.bian.qin6,
			...result.bian.qinx,
		);
	}

	if (result.hide === null) out.push(null);
	else {
		out.push(
			result.hide.mark,
			result.hide.name,
			...result.hide.qin6,
			...result.hide.qinx,
			result.hide.seat.join(","),
		);
	}

	return out;
}

export async function digest(
	rows: (string | number | null)[][],
): Promise<string> {
	const hasher = new Bun.CryptoHasher("sha256");
	for (const row of rows) hasher.update(`${JSON.stringify(row)}\n`);
	return hasher.digest("hex");
}
