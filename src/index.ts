/**
 * najia — 六爻纳甲排盘
 *
 * TypeScript port of the Python `najia` library (MIT, bopo).
 *
 * Fully ported and verified against the Python reference across the entire 4^6
 * cast space. See README for the deliberate deviations.
 */

export const VERSION = "0.1.0";

export {
	type Ganzhi,
	type GanzhiOptions,
	ganzhiAt,
	ganzhiFromDate,
	type LateZiSect,
} from "./calendar.js";
export {
	GANS,
	type Gan,
	GUA5,
	GUA64,
	GUAS,
	type Gua,
	KONG,
	type Kong,
	LIUHE,
	NAJIA,
	QING6,
	type Qing6,
	SHEN6,
	type Shen6,
	XING5,
	type Xing5,
	YAOS,
	ZHI5,
	ZHIS,
	type Zhi,
} from "./const.js";
export {
	type CastOptions,
	type CastResult,
	cast,
	GUACI_MISSING,
	guaci,
	type Hexagram,
	type Hidden,
	hidden,
	normaliseParams,
	type Params,
	transform,
	type Yao,
} from "./najia.js";
export {
	attack,
	getGod6,
	getNajia,
	getQin6,
	getType,
	gongXing,
	gz5x,
	mark,
	palace,
	type ShiYao,
	setShiYao,
	soul,
	unite,
	xkong,
	yaoXing,
} from "./utils.js";
