# najia

六爻纳甲排盘的 TypeScript 实现。

移植自 Python 库 [`najia`](https://github.com/bopo/najia)（MIT，作者 bopo），并保留其版权声明。

> **状态：移植完成，并在全部 4⁶ = 4096 种起卦组合上与 Python 实现验证一致。**

## 用法

```typescript
import { cast } from "najia";

// 六爻，初爻在前：1 单(阳静) 2 拆(阴静) 3 重(阳动) 4 交(阴动)
const reading = cast([2, 2, 1, 2, 4, 2], { date: new Date(2026, 6, 26, 14), guaci: true });

reading.gua.name;   // 卦名
reading.gua.gong;   // 卦宫
reading.gua.qin6;   // 六亲（每爻）
reading.gua.qinx;   // 干支五行（每爻）
reading.shiy;       // { shi, ying } 世应爻
reading.god6;       // 六神，按日干起
reading.dong;       // 动爻位置（0 起）
reading.bian;       // 变卦，无动爻时为 null
reading.hide;       // 伏神，六亲齐全时为 null
reading.ganzhi;     // { year, month, day, hour, xkong }
```

## 模块

| 模块 | 内容 |
| --- | --- |
| `src/const.ts` | 纳甲表、六十四卦、六神、六亲、五行、旬空、卦宫 |
| `src/utils.ts` | 纳甲配干支、世应爻、卦宫、游魂归魂、六冲六合、卦型、六亲、六神、旬空、干支五行 |
| `src/calendar.ts` | 年月日时干支与旬空，基于 `tyme4ts` |
| `src/najia.ts` | 起卦主流程、变卦、伏神、卦辞 |
| `src/data/guaci.json` | 六十四卦卦辞（62 条，见下） |

## 验证

**全部 4⁶ = 4096 种起卦组合 × 5 个日期，99,776 个字段与 Python 实现零差异。**

`test/fixtures/parity.json` 固化了这个结果：全空间取一个 SHA-256 聚合哈希，另有 48 个精选详例覆盖八个卦宫与变卦/伏神/动爻的各个分支。**CI 不需要 Python 解释器即可验证一致性。**

日期干支层单独验证：336 个时点（含立春、节气、子时、闰年、跨年边界）× 5 个字段，与 `lunar_python` 零差异。

重新生成 fixture 需要参考实现，见 `tools/make-parity-fixture.ts`。

## 与原版的有意差异

移植过程中发现的原版缺陷，这里做了修正。**每一处都会改变输出或 API，所以逐条列出：**

**1. 移除 `set_shi_yao` 的第三个返回值 `index`。**
上游 `compile()` 从不使用它，始终把世爻传给 `palace()`。而对 8 个游魂卦，两者给出**不同的卦宫**（火地晋用世爻得乾宫，用 `index` 得离宫）。留着它就是留一个静默出错的入口。

**2. `seat`（伏神位置）改为升序确定输出。**
上游用 `set` 差集迭代产生顺序，Python 的字符串哈希按进程随机化，**同样的输入在不同次运行会得到不同顺序**。

**3. 字符串入参不再静默失效。**
上游 `_transform` 写的是 `if 3 in params`，当 `params` 是字符串时该判断恒为假——**传字符串会静默地不产生变卦、不识别动爻**。现在入参统一归一化并校验。

**4. 拒绝非法日期。**
`lunar_python` 接受 `1900-2-29` 这类不存在的日期（1900 非闰年）并给出结果，`tyme4ts` 会报错。测试中 24 个这类时点在本实现下抛异常。

**5. 晚子时流派显式可选。**
23:00–24:00 的日柱归属有两种成法，两个上游库的默认值恰好相反。本实现默认 `day-stays`（与 Python 一致，保证迁移不改变任何人的卦），可通过 `lateZi: "day-advances"` 切换。时柱不受影响——两个库都用次日干起。

**6. 卦辞缺两条，且缺得显式。**
`guaci.pkl` 只有 62 条，缺 **艮为山** 和 **雷风恒**。上游 `get_guaci()` 对这两卦静默返回 `None`。本实现返回 `undefined`，并导出 `GUACI_MISSING` 让调用方能明确处理。

**这两条卦辞我没有补。**《周易》原文属公有领域，但凭记忆写爻辞出错同样是看不出来的错误——需要从可靠底本录入并核对，不是靠印象。

**7. 不移植渲染层与 CLI。**
上游的 jinja2 模板与 click 命令行不在范围内，结构化输出交给调用方格式化。因此本库**零运行时依赖**（除 `tyme4ts`）。

## 待办

- 补齐艮为山、雷风恒两卦卦辞（需可靠底本）
- 确认 `guaci` 数据的整理来源，开源时注明出处

## 为什么要做这个

npm 上没有成熟的 TS 纳甲实现（现有几个包都还很稚嫩），而纯 TypeScript 的技术栈需要它。紫微斗数有 [`iztro`](https://github.com/SylarLong/iztro) 原生 TS 实现、农历有 `tyme4ts`，六爻纳甲是唯一没有上游可用的一环。

## 移植原则：先验证，后实现

**一个算错的卦不会抛异常，也不会看起来有问题**——它会输出一个自洽、完整、措辞确定的卦象，而它是错的。使用者无法察觉，作者也无法察觉。

所以这个移植不靠"仔细写"来保证正确，靠**差分验证**：

1. 以 Python `najia` 为基准（oracle）
2. 穷举卦象输入空间（六爻的阴阳与动变，共 4^6 = 4096 种基本组合，再乘日期与性别维度）
3. 逐字段比对，**差异为零**才算完成

六爻在这一点上比紫微有利：输入空间是有限且可穷举的，不像出生时间那样连续。**理论上可以做到完全穷举，而不是抽样。**

## 移植范围

Python 原库共 758 行，其中需要移植的是计算核心：

| 原文件 | 行数 | 是否移植 | 说明 |
| --- | --- | --- | --- |
| `najia.py` | 320 | 是 | 排盘主逻辑 |
| `utils.py` | 302 | 是 | 干支、纳甲、六亲等推导 |
| `const.py` | 96 | 是 | 常量表 |
| `__main__.py` | 35 | 否 | CLI |
| `data/standard.tpl` | 1.2K | 否 | jinja2 文本模板，属表现层 |
| `data/guaci.pkl` | 57K | 已转换 | 六十四卦卦辞，已导出为 JSON |

## 开发

```bash
bun install
bun run typecheck
bun test
bun run build      # tsc 输出 ESM + .d.ts 到 dist/
```

## 许可

MIT。见 `LICENSE`——同时保留本项目与原 Python 实现的版权声明。
