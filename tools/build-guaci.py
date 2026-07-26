"""Rebuild src/data/guaci.json from Chinese Wikisource.

Why not the text that shipped with the Python `najia` library: it was scraped
from a fortune-telling site (the site's anti-copy watermark was still embedded
in the text), its txt→pickle conversion glued two 卦 onto their neighbours, its
乾卦 was missing every per-爻 小象, and it carried transcription errors such as
「见龙再田」. See README.

Source: https://zh.wikisource.org/wiki/周易 — the 周易 is public domain and
Wikisource transcriptions are CC BY-SA 4.0, which the README attributes.

Usage:
    uv run --with opencc-python-reimplemented python tools/build-guaci.py fetch
    uv run --with opencc-python-reimplemented python tools/build-guaci.py build
"""

from __future__ import annotations

import difflib
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

from opencc import OpenCC

ROOT = pathlib.Path(__file__).resolve().parent.parent
TARGET = ROOT / "src" / "data" / "guaci.json"
CACHE = ROOT / "tools" / ".wikisource-cache.json"

API = "https://zh.wikisource.org/w/api.php"
UA = "taoracle-najia/0.1 (https://github.com/TaoracleHQ/najia)"

t2s = OpenCC("t2s")
s2t = OpenCC("s2t")

# 爻位 is followed by ：on most pages and ，on 否卦. Match both, then normalise
# to ：so the shipped data is internally consistent and parseable by one rule.
YAO_LABEL = r"(初[六九]|[六九][二三四五]|上[六九]|用[九六])"
YAO = re.compile(rf"^{YAO_LABEL}[：，]")
YAO_COMMA = re.compile(rf"^({YAO_LABEL})，")
SECTIONS = {"易經": "jing", "彖曰": "tuan", "象曰": "xiang"}
# 文言傳 is a separate layer of the 周易 that this dataset does not carry.
STOP = ("文言曰",)

# t2s folds 乾 into 干 (as in 乾燥/干燥). In 周易 both the 卦名 and 乾乾 stay 乾.
KEEP_AS_IS = {"乾"}

# Corrections to the Wikisource transcription itself — a wiki is not a critical
# edition. Each entry must be justifiable from *inside* this dataset, so the
# correction stands on its own and does not depend on a second source staying
# reachable. Applied after conversion, on the simplified forms that ship.
CORRECTIONS: dict[str, list[tuple[str, str, str]]] = {
    "地雷复": [
        (
            "不复远",
            "不远复",
            "字序颠倒；紧随其后的象曰作「不远之复」，可自证",
        ),
        ("无袛悔", "无祗悔", "袛为内衣（衣部），此处无义；应为祗"),
    ],
}

# Wikisource carries the odd editorial gloss inline, e.g. 保合大和〈一作太和〉.
# That is apparatus, not scripture, and would otherwise be read out to users.
GLOSS = re.compile(r"〈[^〉]{0,30}〉")


def to_simplified(text: str) -> str:
    """Convert per character, refusing conversions that make the text rarer.

    opencc maps a few classical characters onto obscure variants outside the
    BMP — 餗 becomes 𫗧 (U+2B5E7) and 繻 becomes 𦈡 (U+26221), both of which
    render as a missing glyph nearly everywhere. Pushing a common character
    into an extension plane is never the conversion we want.
    """
    out: list[str] = []
    for ch in text:
        if ch in KEEP_AS_IS:
            out.append(ch)
            continue
        converted = t2s.convert(ch)
        if len(converted) == 1 and ord(ch) <= 0xFFFF and ord(converted) > 0xFFFF:
            out.append(ch)
        else:
            out.append(converted)
    return "".join(out)


def parse_page(text: str) -> dict[str, list[str]]:
    section: str | None = None
    out: dict[str, list[str]] = {"jing": [], "tuan": [], "xiang": []}
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        if any(line.startswith(s) for s in STOP):
            break
        line = GLOSS.sub("", line)
        head = line.rstrip("：")
        if head in SECTIONS:
            section = SECTIONS[head]
            continue
        if section:
            out[section].append(line)
    return out


def split_layers(parsed: dict[str, list[str]]) -> dict[str, list[str]]:
    jing = parsed["jing"]
    xiang = parsed["xiang"]
    return {
        # 坤 splits its 卦辞 across three lines; ours keeps it as one.
        "guaci": ["".join(l for l in jing if not YAO.match(l))],
        "yaoci": [YAO_COMMA.sub(r"\1：", l) for l in jing if YAO.match(l)],
        "tuan": ["".join(parsed["tuan"])],
        "daxiang": xiang[:1],
        "xiaoxiang": xiang[1:],
    }


def fetch_page(title: str) -> str:
    url = (
        f"{API}?action=query&prop=extracts&explaintext=1&redirects=1"
        f"&titles={urllib.parse.quote(title)}&format=json&formatversion=2"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    data = json.loads(urllib.request.urlopen(req, timeout=40).read().decode())
    return data["query"]["pages"][0].get("extract", "")


def short_names() -> list[tuple[str, str]]:
    """(full 卦名, short 卦名) read off the existing title lines."""
    current = json.loads(TARGET.read_text(encoding="utf-8"))
    return [(name, text.split("\n")[0].split()[1]) for name, text in current.items()]


def cmd_fetch() -> None:
    out: dict[str, dict[str, str]] = {}
    misses: list[str] = []
    for i, (name, short) in enumerate(short_names()):
        for candidate in (s2t.convert(short), short):
            text = fetch_page(f"周易/{candidate}")
            if text:
                out[name] = {"title": f"周易/{candidate}", "text": text}
                break
            time.sleep(0.3)
        else:
            misses.append(f"{name}({short})")
        time.sleep(0.25)
        if (i + 1) % 20 == 0:
            print(f"  {i + 1} 卦")
    if misses:
        raise SystemExit(f"未取到: {' '.join(misses)}")
    CACHE.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"已缓存 {len(out)} 卦 -> {CACHE.relative_to(ROOT)}")


def cmd_build() -> None:
    if not CACHE.exists():
        raise SystemExit("缺少缓存，先运行 fetch")
    ws = json.loads(CACHE.read_text(encoding="utf-8"))
    current = json.loads(TARGET.read_text(encoding="utf-8"))

    built: dict[str, str] = {}
    for name, text in current.items():
        # The existing title line already carries 卦名, 卦序 and 上下卦.
        title = text.split("\n")[0]
        layers = split_layers(parse_page(ws[name]["text"]))
        if len(layers["yaoci"]) != len(layers["xiaoxiang"]):
            raise SystemExit(
                f"{name}: 爻辞 {len(layers['yaoci'])} 条与小象 "
                f"{len(layers['xiaoxiang'])} 条不对齐"
            )
        body = [
            layers["guaci"][0],
            f"彖曰：{layers['tuan'][0]}",
            f"象曰：{layers['daxiang'][0]}",
            "",
        ]
        for yao, xiao in zip(layers["yaoci"], layers["xiaoxiang"]):
            body += [yao, f"象曰：{xiao}"]
        text_out = to_simplified("\n".join([title, *body]))
        for wrong, right, _why in CORRECTIONS.get(name, []):
            if wrong not in text_out:
                raise SystemExit(f"{name}: 待修正的「{wrong}」已不存在，请复核 CORRECTIONS")
            text_out = text_out.replace(wrong, right)
        built[name] = text_out

    strays = sorted({ch for v in built.values() for ch in v if ord(ch) > 0xFFFF})
    if strays:
        raise SystemExit(f"输出含扩展区字符: {strays}")
    glosses = [(k, m.group()) for k, v in built.items() for m in GLOSS.finditer(v)]
    if glosses:
        raise SystemExit(f"输出仍含校勘注: {glosses}")
    for name, text in built.items():
        lines = text.split("\n")
        yao = [l for l in lines if re.match(rf"^{YAO_LABEL}：", l)]
        xiao = [l for l in lines if l.startswith("象曰：")]
        if len(yao) < 6 or len(xiao) != len(yao) + 1:
            raise SystemExit(f"{name}: 爻辞 {len(yao)} 条，象曰 {len(xiao)} 条，不符预期")

    report_diff(current, built)
    TARGET.write_text(
        json.dumps(built, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8"
    )
    print(f"\n已写出 {len(built)} 卦 -> {TARGET.relative_to(ROOT)}")


def report_diff(old: dict[str, str], new: dict[str, str]) -> None:
    cjk = re.compile(r"[㐀-鿿]")
    pairs: dict[tuple[str, str], int] = {}
    for name in old:
        a = "".join(cjk.findall(old[name]))
        b = "".join(cjk.findall(new[name]))
        ops = difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes()
        for tag, i1, i2, j1, j2 in ops:
            if tag == "equal":
                continue
            key = (
                (a[i1], b[j1])
                if tag == "replace" and i2 - i1 == 1 and j2 - j1 == 1
                else (f"[{tag}]{a[i1:i2][:14]}", b[j1:j2][:14])
            )
            pairs[key] = pairs.get(key, 0) + 1
    print(f"与替换前的字符差异种类: {len(pairs)}")
    for (x, y), n in sorted(pairs.items(), key=lambda kv: -kv[1])[:12]:
        print(f"  {n:>4}  旧[{x}]  新[{y}]")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    {"fetch": cmd_fetch, "build": cmd_build}[cmd]()
