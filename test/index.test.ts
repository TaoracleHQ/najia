import { describe, expect, it } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { cast, VERSION } from "../src/index.js";

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
});
