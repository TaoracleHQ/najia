/**
 * najia — 六爻纳甲排盘
 *
 * TypeScript port of the Python `najia` library (MIT, bopo).
 *
 * The deterministic derivations are ported and cross-checked against the Python
 * reference. 起卦 (`Najia.compile`) is not ported yet — it needs the lunar
 * date/干支 layer. See README.
 */

export const VERSION = "0.0.0";

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
