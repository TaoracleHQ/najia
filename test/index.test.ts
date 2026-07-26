import { describe, expect, it } from "bun:test";
import { VERSION } from "../src/index.js";

describe("package", () => {
	it("exposes a version", () => {
		expect(VERSION).toBe("0.0.0");
	});
});
