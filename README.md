# najia

六爻纳甲排盘的 TypeScript 实现。

移植自 Python 库 [`najia`](https://github.com/bopo/najia)（MIT，作者 bopo），并保留其版权声明。

> **状态：确定性推导层已完成并通过交叉验证；起卦（`Najia.compile`）尚未移植。**

## 已完成

| 模块 | 内容 |
| --- | --- |
| `src/const.ts` | 纳甲表、六十四卦、六神、六亲、五行、旬空、卦宫等常量 |
| `src/utils.ts` | `getNajia` `setShiYao` `palace` `soul` `attack` `unite` `getType` `getQin6` `getGod6` `xkong` `gz5x` `mark` |
| `test/upstream.test.ts` | 移植自上游自带测试的 benchmark |

**交叉验证结果：全部 64 卦 × 10 个字段 = 640 处断言，与 Python 实现零差异。**

## 待移植

- `Najia.compile()` —— 起卦主流程，含动爻、变卦（`_transform`）、伏神（`_hidden`）
- 日期干支层。Python 原库用 `lunar_python`，其 JS 对应物 `lunar-javascript` / `tyme4ts` 出自同一作者（6tail），是 1:1 对应关系，不需要重写
- `guaci.pkl` 卦辞数据导出为 JSON

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
| `data/guaci.pkl` | 57K | 需转换 | 六十四卦卦辞，pickle 需导出为 JSON |

原库依赖 `arrow`（日期）、`jinja2`（渲染）、`click`（CLI）。**本实现不移植渲染与 CLI**——结构化输出交给调用方格式化，这样库本身可以零运行时依赖。

## 待确认事项

- `guaci.pkl` 里卦辞数据的**整理来源**。《周易》原文属公有领域，但若原作者是从某个现代整理本录入，开源时应注明出处。转换这份数据前需要先查清。

## 开发

```bash
bun install
bun run typecheck
bun test
bun run build      # tsc 输出 ESM + .d.ts 到 dist/
```

## 许可

MIT。见 `LICENSE`——同时保留本项目与原 Python 实现的版权声明。
