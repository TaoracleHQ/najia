/**
 * 起卦 —— the main casting flow, ported from `najia/najia.py`.
 *
 * The Python original returns a mutable `self.data` dict and also owns a jinja2
 * renderer. This port returns a plain immutable result and leaves formatting to
 * the caller.
 */
import { type Ganzhi, type GanzhiOptions, ganzhiAt } from "./calendar.js";
import {
	GUA64,
	GUAS,
	type Gua,
	type Qing6,
	type Shen6,
	YAOS,
} from "./const.js";
import guaciData from "./data/guaci.json" with { type: "json" };
import {
	getGod6,
	getNajia,
	getQin6,
	getType,
	gongXing,
	gz5x,
	palace,
	type ShiYao,
	setShiYao,
	soul,
	yaoXing,
} from "./utils.js";

/**
 * 爻 cast outcomes: 1 单 (阳静), 2 拆 (阴静), 3 重 (阳动), 4 交 (阴动).
 *
 * Six of them, 初爻 first.
 */
export type Yao = 1 | 2 | 3 | 4;
export type Params = readonly Yao[] | string;

const GUACI: Record<string, string> = guaciData;

/** 卦名 that {@link guaci} has no text for. See README. */
export const GUACI_MISSING: readonly string[] = Object.freeze(
	Object.values(GUA64).filter((name) => GUACI[name] === undefined),
);

/**
 * 卦辞 for a 卦名, or `undefined` when the bundled text has no entry.
 *
 * Two of the sixty-four are missing upstream; {@link GUACI_MISSING} names them.
 * The Python reference returns `None` here without saying so.
 */
export function guaci(name: string): string | undefined {
	return GUACI[name];
}

/**
 * Normalise 爻 input to exactly six {@link Yao} values.
 *
 * The Python original accepts a string but then compares its characters against
 * integers (`if 3 in params`), so string input silently produces no 变卦 and no
 * 动爻. Normalising once up front removes that trap.
 */
export function normaliseParams(params: Params): Yao[] {
	const raw = typeof params === "string" ? [...params] : params;
	if (raw.length !== 6) {
		throw new Error(`卦 needs exactly 6 爻, got ${raw.length}`);
	}
	return raw.map((value, i) => {
		const n = typeof value === "number" ? value : Number.parseInt(value, 10);
		if (n !== 1 && n !== 2 && n !== 3 && n !== 4) {
			throw new Error(
				`爻 ${i + 1} must be 1 单 / 2 拆 / 3 重 / 4 交, got ${String(value)}`,
			);
		}
		return n;
	});
}

/** 卦码 from cast outcomes —— parity gives 阴阳. */
function markOf(params: readonly Yao[]): string {
	return params.map((p) => String(p % 2)).join("");
}

export interface Hexagram {
	/** 卦名 */
	name: string;
	/** 六位卦码, 初爻 first */
	mark: string;
	/** 卦宫 */
	gong: Gua;
	/** 六亲 per 爻 */
	qin6: Qing6[];
	/** 干支五行 per 爻, e.g. `己卯木` */
	qinx: string[];
}

export interface Hidden extends Hexagram {
	/** Positions in the 本宫卦 holding the 六亲 the cast 卦 lacks, ascending. */
	seat: number[];
}

export interface CastResult {
	/** Cast outcomes, normalised */
	params: Yao[];
	/** 本卦 */
	gua: Hexagram;
	/** 世应爻 */
	shiy: ShiYao;
	/** 卦型 —— 游魂 / 归魂 / 六冲 / 六合, or `""` */
	type: string;
	/** 游魂 / 归魂, or `""` */
	soul: "游魂" | "归魂" | "";
	/** 六神, 初爻 first, rotated by the day's 天干 */
	god6: Shen6[];
	/** Zero-based positions of 动爻 */
	dong: number[];
	/** 变卦, or `null` when nothing moves */
	bian: Hexagram | null;
	/** 伏神, or `null` when all five 六亲 are present */
	hide: Hidden | null;
	/** 干支 for the moment of casting */
	ganzhi: Ganzhi;
	/** 卦辞, when bundled text has an entry */
	guaci?: string;
	gender?: string;
	title?: string;
}

/** 六亲 and 干支五行 for a 卦码 read against a 卦宫. */
function relations(
	mark: string,
	gong: number,
): Pick<Hexagram, "qin6" | "qinx"> {
	const najia = getNajia(mark);
	const xing = gongXing(gong);
	return {
		qin6: najia.map((gz) => getQin6(xing, yaoXing(gz))),
		qinx: najia.map((gz) => gz5x(gz)),
	};
}

/**
 * @param gong 卦宫 reported for this 卦
 * @param relationGong 卦宫 the 六亲 are read against. Differs from `gong` for
 *   变卦: its 六亲 stay anchored to the 本卦's 卦宫 (体用不变) while the 卦宫 it
 *   reports is its own. Upstream does the same, just implicitly.
 */
function hexagram(
	mark: string,
	gong: number,
	relationGong: number = gong,
): Hexagram {
	const name = GUA64[mark];
	if (name === undefined) throw new Error(`unknown 卦码 "${mark}"`);
	return {
		name,
		mark,
		gong: GUAS[gong] as Gua,
		...relations(mark, relationGong),
	};
}

/**
 * 伏神 —— the 本宫卦 stands in for whichever 六亲 the cast 卦 is missing.
 *
 * Deviation from the Python reference: upstream derives `seat` by iterating a
 * `set` difference, so the order varies between interpreter runs (string hashing
 * is seeded per process). This returns ascending positions instead — the same
 * set, deterministically ordered.
 */
export function hidden(gong: number, qin6: readonly Qing6[]): Hidden | null {
	if (new Set(qin6).size >= 5) return null;

	// YAOS is indexed by 卦宫, so the 本宫卦 is its trigram doubled.
	const trigram = YAOS[gong];
	if (trigram === undefined) throw new Error(`unknown 卦宫 ${gong}`);
	const base = hexagram(`${trigram}${trigram}`, gong);

	const present = new Set(qin6);
	const seat = base.qin6
		.map((qin, position) => ({ qin, position }))
		.filter(({ qin }) => !present.has(qin))
		// Keep only the first position per missing 六亲, matching upstream's
		// `qin6.index(x)`, then order ascending.
		.filter(
			({ qin }, i, all) => all.findIndex((other) => other.qin === qin) === i,
		)
		.map(({ position }) => position)
		.sort((a, b) => a - b);

	return { ...base, seat };
}

/**
 * 变卦 —— 动爻 flip, or `null` when nothing moves.
 *
 * @param gong the 本卦's 卦宫; the 变卦's 六亲 are read against it, not against
 *   the 变卦's own 卦宫.
 */
export function transform(
	params: readonly Yao[],
	gong: number,
): Hexagram | null {
	if (!params.some((p) => p === 3 || p === 4)) return null;
	// 3 重 is 阳动 -> becomes 阴; 4 交 is 阴动 -> becomes 阳.
	const mark = params.map((p) => (p === 1 || p === 4 ? "1" : "0")).join("");
	return hexagram(mark, palace(mark, setShiYao(mark).shi), gong);
}

export interface CastOptions extends GanzhiOptions {
	/** Defaults to now, read in the host's local timezone. */
	date?: Date;
	/** Include 卦辞 in the result. */
	guaci?: boolean;
	gender?: string;
	title?: string;
}

/** 起卦 —— the full reading for a set of cast outcomes. */
export function cast(params: Params, options: CastOptions = {}): CastResult {
	const yao = normaliseParams(params);
	const mark = markOf(yao);

	const shiy = setShiYao(mark);
	const gong = palace(mark, shiy.shi);
	const gua = hexagram(mark, gong);

	const date = options.date ?? new Date();
	const ganzhi = ganzhiAt(
		date.getFullYear(),
		date.getMonth() + 1,
		date.getDate(),
		date.getHours(),
		options.lateZi === undefined ? {} : { lateZi: options.lateZi },
	);

	const result: CastResult = {
		params: yao,
		gua,
		shiy,
		type: getType(mark),
		soul: soul(mark),
		god6: getGod6(ganzhi.day),
		dong: yao.flatMap((p, i) => (p > 2 ? [i] : [])),
		bian: transform(yao, gong),
		hide: hidden(gong, gua.qin6),
		ganzhi,
	};

	if (options.guaci) {
		const text = guaci(gua.name);
		if (text !== undefined) result.guaci = text;
	}
	if (options.gender !== undefined) result.gender = options.gender;
	if (options.title !== undefined) result.title = options.title;

	return result;
}
