/**
 * 干支 for a moment in time.
 *
 * The Python reference delegates this to `lunar_python` (`getBaZi()` and
 * `getDayXunKong()`). This port uses `tyme4ts` — same author (6tail), but
 * typed, ESM and dependency-free. Equivalence is not assumed: `test/calendar`
 * pins the two against each other.
 */
import { SolarDay, SolarTime } from "tyme4ts";
import { KONG, type Kong } from "./const.js";

/**
 * How to treat 晚子时 (23:00–24:00) when reporting the 日柱.
 *
 * Both are established conventions, and the two upstream libraries disagree:
 *
 * - `day-stays` — 晚子时 keeps the current day's 日柱. This is what
 *   `lunar_python.getBaZi()` returns, so it is what the Python `najia` produces
 *   and therefore the default here: migrating off Python must not silently
 *   change anyone's reading.
 * - `day-advances` — 晚子时 belongs to the next day's 日柱, which is
 *   `tyme4ts`'s own default.
 *
 * The 时柱 is unaffected: both libraries derive it from the next day's 天干,
 * and all 336 pinned datetimes agree on it.
 */
export type LateZiSect = "day-stays" | "day-advances";

export interface Ganzhi {
	/** 年柱 —— boundary is 立春, not the calendar new year. */
	year: string;
	/** 月柱 —— boundary is the 节气, not the calendar month. */
	month: string;
	/** 日柱 —— see {@link LateZiSect}. */
	day: string;
	/** 时柱 */
	hour: string;
	/** 日旬空, derived from the 日柱. */
	xkong: Kong;
}

export interface GanzhiOptions {
	/** Defaults to `day-stays`, matching the Python reference. */
	lateZi?: LateZiSect;
}

function toKong(name: string): Kong {
	const found = KONG.find((k) => k === name);
	if (found === undefined) throw new Error(`unexpected 旬空 "${name}"`);
	return found;
}

/**
 * 干支 for a wall-clock moment.
 *
 * Minutes and seconds are accepted but only the hour affects the 时柱, matching
 * the Python reference which passes `date.hour` and zeroes the rest.
 */
export function ganzhiAt(
	year: number,
	month: number,
	day: number,
	hour: number,
	options: GanzhiOptions = {},
): Ganzhi {
	const sect = options.lateZi ?? "day-stays";
	const cycleHour = SolarTime.fromYmdHms(
		year,
		month,
		day,
		hour,
		0,
		0,
	).getSixtyCycleHour();

	const dayCycle =
		sect === "day-advances"
			? cycleHour.getDay()
			: SolarDay.fromYmd(year, month, day).getSixtyCycleDay().getSixtyCycle();

	return {
		year: cycleHour.getYear().getName(),
		month: cycleHour.getMonth().getName(),
		day: dayCycle.getName(),
		hour: cycleHour.getSixtyCycle().getName(),
		xkong: toKong(
			dayCycle
				.getExtraEarthBranches()
				.map((branch) => branch.getName())
				.join(""),
		),
	};
}

/** {@link ganzhiAt} for a `Date`, read in the host's local timezone. */
export function ganzhiFromDate(
	date: Date,
	options: GanzhiOptions = {},
): Ganzhi {
	return ganzhiAt(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
		date.getHours(),
		options,
	);
}
