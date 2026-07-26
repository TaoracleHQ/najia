"""Compare our 卦辞 against ctext.org (武英殿十三經注疏) character by character."""
import json, re, difflib, sys
from opencc import OpenCC

t2s = OpenCC("t2s"); s2t = OpenCC("s2t")
ct = json.load(open("/tmp/ctext_gua.json"))
ours = json.load(open("/Users/ahpx/Code/najia/src/data/guaci.json"))

CJK = re.compile(r"[㐀-鿿]")
LABEL = re.compile(r"^(彖曰|象曰|用九|用六)：")

def chars(text: str) -> str:
    return "".join(CJK.findall(text))

def variant_equal(a: str, b: str) -> bool:
    """True when a (simplified) and b (traditional) are the same character."""
    if a == b:
        return True
    if t2s.convert(b) == a or s2t.convert(a) == b:
        return True
    # 乾/干-style over-conversion: accept when either direction round-trips.
    return t2s.convert(a) == t2s.convert(b)

# Our title line carries the canonical short 卦名 as its second token, e.g.
# "《易经》第三十三卦 遁 天山遁 艮上乾下" -> 遁. ctext keys on the traditional
# form of exactly that name.
def ct_key_for(short: str) -> str | None:
    if short in ct:
        return short
    trad = s2t.convert(short)
    if trad in ct:
        return trad
    for k in ct:
        if t2s.convert(k) == short:
            return k
    return None

report = []
uncovered = []
for name, text in ours.items():
    title_tokens = text.split("\n")[0].split()
    short = title_tokens[1] if len(title_tokens) > 1 else name
    body = "\n".join(text.split("\n")[1:])          # drop our title line
    body = "\n".join(LABEL.sub("", l) for l in body.split("\n"))
    mine = chars(body)

    key = ct_key_for(short)
    if key is None:
        uncovered.append(f"{name}({short})")
        continue
    theirs = chars("".join(ct[key]["cells"]))

    sm = difflib.SequenceMatcher(None, mine, theirs, autojunk=False)
    hits = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        a, b = mine[i1:i2], theirs[j1:j2]
        if tag == "replace" and len(a) == len(b) and all(variant_equal(x, y) for x, y in zip(a, b)):
            continue
        hits.append((tag, a, b, mine[max(0, i1 - 6):i1]))
    if hits:
        report.append((name, key, hits))

print(f"比对 {len(ours) - len(uncovered)} 卦，未覆盖 {len(uncovered)} 卦: {' '.join(uncovered) or '无'}")
print(f"有差异的卦: {len(report)}\n")

# 只报告单字替换（最可能是错字），成段差异多为版本体例不同
single = []
for name, key, hits in report:
    for tag, a, b, ctx in hits:
        if tag == "replace" and len(a) == 1 and len(b) == 1:
            single.append((name, ctx, a, b))
print(f"单字差异 {len(single)} 处（最可能是错字）:")
for name, ctx, a, b in single:
    print(f"  {name:6} …{ctx}[{a}]  ctext 作 [{b}]")
json.dump({"single": single, "uncovered": uncovered}, open("/tmp/guaci_diff.json", "w"), ensure_ascii=False)
