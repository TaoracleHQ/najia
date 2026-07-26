"""Rebuild guaci.json from the upstream source text, correctly this time.

The shipped pickle glues 雷风恒 onto 泽山咸 and 艮为山 onto 震为雷, so two 卦
return two 卦's worth of text and two return nothing. Re-splitting on title
lines fixes all four. Scrape artefacts (a site watermark, a stray BBCode tag)
are stripped, and the inconsistent leading full-width spaces are normalised.
"""
import json, pathlib, re, sys

RAW = pathlib.Path("/tmp/guaci_raw.txt").read_text(encoding="utf-8")
sys.path.insert(0, sys.argv[1])
from najia.const import GUA64

WATERMARK = "sm.aa963.com"
BBCODE = re.compile(r"\[/?[A-Za-z][^\]]*\]")
TITLE = re.compile(r"^《易经》第\S+卦\s")

def clean(line: str) -> str:
    line = BBCODE.sub("", line.replace(WATERMARK, ""))
    return line.strip("　 \t\r")

lines = RAW.split("\n")
starts = [i for i, l in enumerate(lines) if TITLE.match(l)]
assert len(starts) == 64, f"expected 64 titles, found {len(starts)}"
starts.append(len(lines))

entries: dict[str, str] = {}
for a, b in zip(starts, starts[1:]):
    block = lines[a:b]
    title = clean(block[0])
    name = title.split()[2]
    body = []
    for raw in block[1:]:
        text = clean(raw)
        if text.startswith("====="):
            continue
        if text and set(text) == {"*"}:
            body.append("")
            continue
        body.append(text)
    while body and body[-1] == "":
        body.pop()
    assert name not in entries, f"duplicate 卦名 {name}"
    entries[name] = "\n".join([title, *body])

# --- validation -----------------------------------------------------------
problems = []
if set(entries) != set(GUA64.values()):
    problems.append(f"键与卦名表不符: 缺 {sorted(set(GUA64.values()) - set(entries))}")
for name, text in entries.items():
    body = text.split("\n")
    if body[0].split()[2] != name:
        problems.append(f"{name}: 标题与键不一致")
    if any(l.startswith("《易经》第") for l in body[1:]):
        problems.append(f"{name}: 正文夹带别卦标题")
    if WATERMARK in text or BBCODE.search(text):
        problems.append(f"{name}: 仍有爬虫残留")

print("条目数:", len(entries))
print("校验:", "全部通过" if not problems else f"{len(problems)} 个问题")
for p in problems[:10]:
    print("  ", p)
if problems:
    sys.exit(1)

out = pathlib.Path(sys.argv[2])
ordered = {n: entries[n] for n in GUA64.values()}
out.write_text(json.dumps(ordered, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
print(f"已写出 {len(ordered)} 条 -> {out} ({out.stat().st_size // 1024} KB)")
