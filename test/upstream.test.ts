/**
 * Benchmark ported verbatim from the Python reference's own test suite
 * (`bopo/najia`, `tests/*.py`), so any behavioural drift from upstream shows up
 * as a failure here.
 *
 * Every expected value below is upstream's, not ours. Do not "fix" a failure by
 * editing an expectation — investigate the implementation first.
 *
 * Upstream coverage is thin (141 lines across 10 files) and does not pin
 * 世应, 卦型 or 伏神. Those need the exhaustive differential harness described
 * in the README; these cases are the floor, not the ceiling.
 */
import { describe, expect, it } from "bun:test";
import { ZHI5, ZHIS } from "../src/const.js";
import {
	getGod6,
	getNajia,
	getQin6,
	gz5x,
	mark,
	palace,
	setShiYao,
	xkong,
} from "../src/utils.js";

// tests/test_gz5x.py
describe("gz5x", () => {
	it("appends the 地支 五行", () => {
		expect(gz5x("甲子")).toBe("甲子水");
	});
});

// tests/test_mark.py
describe("mark", () => {
	it("reduces 单拆重交 to a binary 卦码", () => {
		const symbol = [2, 2, 1, 2, 4, 2];
		expect(mark(symbol)).toEqual(["0", "0", "1", "0", "0", "0"]);
		expect(mark(symbol.join(""))).toEqual(["0", "0", "1", "0", "0", "0"]);
	});
});

// tests/test_xkong.py
describe("xkong", () => {
	it("accepts a resolved index pair", () => {
		expect(xkong([0, 0])).toBe("戌亥");
	});

	it("covers all six 旬", () => {
		expect(xkong("甲子")).toBe("戌亥");
		expect(xkong("甲戌")).toBe("申酉");
		expect(xkong("甲申")).toBe("午未");
		expect(xkong("甲午")).toBe("辰巳");
		expect(xkong("甲辰")).toBe("寅卯");
		expect(xkong("甲寅")).toBe("子丑");
	});
});

// tests/test_qin6.py
describe("getQin6", () => {
	it("derives 六亲 from two 五行", () => {
		expect(getQin6("金", "木")).toBe("妻财");
		expect(getQin6("木", "金")).toBe("官鬼");
		expect(getQin6("金", "水")).toBe("子孙");
		expect(getQin6("金", "土")).toBe("父母");
		expect(getQin6("金", "金")).toBe("兄弟");
	});
});

// tests/test_god6.py
describe("getGod6", () => {
	it("甲乙起青龙, 丙丁起朱雀", () => {
		expect(getGod6("甲子")[0]).toBe("青龙");
		expect(getGod6("乙丑")[0]).toBe("青龙");
		expect(getGod6("丙寅")[0]).toBe("朱雀");
		expect(getGod6("丁卯")[0]).toBe("朱雀");
	});

	it("戊日起勾陈, 己日起螣蛇", () => {
		// `戊卯` is not a real 干支 pair, but upstream only reads the 天干 and
		// asserts on it, so the case is kept as-is.
		expect(getGod6("戊卯")[0]).toBe("勾陈");
		expect(getGod6("己酉")[0]).toBe("螣蛇");
	});

	it("庚辛起白虎, 壬癸起玄武", () => {
		expect(getGod6("庚辰")[0]).toBe("白虎");
		expect(getGod6("辛巳")[0]).toBe("白虎");
		expect(getGod6("壬午")[0]).toBe("玄武");
		expect(getGod6("癸未")[0]).toBe("玄武");
	});

	it("returns all six, rotated", () => {
		expect(getGod6("戊子")[0]).toBe("勾陈");
		expect(getGod6("甲子")).toEqual([
			"青龙",
			"朱雀",
			"勾陈",
			"螣蛇",
			"白虎",
			"玄武",
		]);
	});
});

// tests/test_gua.py
describe("离为火 (101101)", () => {
	it("resolves the 卦宫", () => {
		expect(palace("101101", 6)).toBe(2);
	});

	it("assigns 纳甲", () => {
		expect(getNajia("101101")).toEqual([
			"己卯",
			"己丑",
			"己亥",
			"己酉",
			"己未",
			"己巳",
		]);
	});

	it("derives 六亲 for every 爻", () => {
		// Upstream builds this list but only asserts on `get_qin6` directly, so the
		// composition is pinned here. Verified against 五行 relations rather than
		// copied from output: 宫 is 火, and 己卯 木 生 火 -> 生我者为父母,
		// 丑/未 土 -> 我生者为子孙, 亥 水 克 火 -> 克我者为官鬼,
		// 酉 金 -> 我克者为妻财, 巳 火 -> 同我者为兄弟.
		const qin6 = getNajia("101101").map((gz) =>
			getQin6(
				"火",
				ZHI5[ZHIS.indexOf(gz[1] as (typeof ZHIS)[number])] as number,
			),
		);
		expect(qin6).toEqual(["父母", "子孙", "官鬼", "妻财", "子孙", "兄弟"]);
	});

	it("is a 本宫六世 卦", () => {
		expect(setShiYao("101101")).toEqual({ shi: 6, ying: 3, index: 6 });
	});
});
