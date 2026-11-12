# -*- coding: utf-8 -*-
"""
生成「荷花花笺」诗阵数据：data/huajian.js

机制：把整句诗按字铺进同一张格子，横句与竖句在「相同的字」处交叉共格。
玩家只填被擦掉的花名（荷 / 莲 / 菡萏 / 芙蕖 / 水芝 / 藕花 / 莲叶 ...），
填完后每一横排、每一竖列都能读回完整诗句。

用法：python tools/gen_huajian.py
"""
import json
import os
import random
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (诗句, 花名, 出处) —— 全部取自《荷花 300 句》整理稿，花名须在句中且唯一
CORPUS = [
    ("接天莲叶无穷碧", "莲叶", "杨万里《晓出净慈寺送林子方》"),
    ("映日荷花别样红", "荷花", "杨万里《晓出净慈寺送林子方》"),
    ("小荷才露尖尖角", "荷", "杨万里《小池》"),
    ("荷叶罗裙一色裁", "荷叶", "王昌龄《采莲曲》"),
    ("芙蓉向脸两边开", "芙蓉", "王昌龄《采莲曲》"),
    ("误入藕花深处", "藕花", "李清照《如梦令》"),
    ("一一风荷举", "荷", "周邦彦《苏幕遮》"),
    ("荷风送香气", "荷", "孟浩然《夏日南亭怀辛大》"),
    ("江南可采莲", "莲", "汉乐府《江南》"),
    ("莲叶何田田", "莲叶", "汉乐府《江南》"),
    ("十里荷花", "荷花", "柳永《望海潮》"),
    ("涉江采芙蓉", "芙蓉", "《涉江采芙蓉》"),
    ("惟有绿荷红菡萏", "菡萏", "李商隐《赠荷花》"),
    ("照水红蕖细细香", "红蕖", "苏轼《鹧鸪天》"),
    ("菡萏香销翠叶残", "菡萏", "李璟《浣溪沙》"),
    ("一朵芙蕖", "芙蕖", "苏轼《江城子·江景》"),
    ("隰有荷华", "荷华", "《诗经·郑风·山有扶苏》"),
    ("有蒲菡萏", "菡萏", "《诗经·陈风·泽陂》"),
    ("荷花开后西湖好", "荷花", "欧阳修《采桑子》"),
    ("红白莲花共塘开", "莲花", "杨万里《莲花》"),
    ("中有荷花分外香", "荷花", "徐渭《荷》"),
    ("青荷盖绿水", "青荷", "晋乐府《青阳渡》"),
    ("芙蓉披红鲜", "芙蓉", "晋乐府《青阳渡》"),
    ("上有并头莲", "并头莲", "晋乐府《青阳渡》"),
    ("荷花娇欲语", "荷花", "李白《渌水曲》"),
    ("爱此红蕖鲜", "红蕖", "李白《折荷有赠》"),
    ("攀荷弄其珠", "荷", "李白《折荷有赠》"),
    ("至今莲蕊有香尘", "莲", "温庭筠《莲花》"),
    ("太华峰头玉井莲", "玉井莲", "韩愈《古意》"),
    ("莲房前后熟", "莲房", "司马光《房莲》"),
    ("曲沼芙蓉映竹嘉", "芙蓉", "何中《荷花》"),
    ("芙蓉宛转在中洲", "芙蓉", "文征明《钱氏池上芙蓉》"),
    ("远忆荷花浦", "荷花", "徐玑《夏日怀友》"),
    ("百花开尽水芝香", "水芝", "陈羽《夏日宴九华池赠主人》"),
    ("袅袅水芝红", "水芝", "葛立方《卜算子·席间再作》"),
    ("看取莲花净", "莲花", "孟浩然《题大禹寺义公禅房》"),
    ("江妃不惜水芝香", "水芝", "元好问《泛舟大明湖》"),
    ("荷花靓无语", "荷花", "莫止《月下观莲》"),
    ("菡萏发清池", "菡萏", "朱景玄《望莲台》"),
    ("荷花十里", "荷花", "张可久《人月圆·会稽怀古》"),
    ("一池荷花一池诗", "荷花", "李斐《一池荷花一池诗》"),
    ("守得莲开结伴游", "莲", "晏几道《鹧鸪天》"),
    ("灼灼荷花瑞", "荷花", "杜公瞻《咏同心芙蓉》"),
    ("莲叶出水大如钱", "莲叶", "张籍《春别曲》"),
    ("莲子已成荷叶老", "荷叶", "李清照《怨王孙》"),
    ("平湖淼淼莲风清", "莲", "《荷花》"),
    ("菡萏新花晓并开", "菡萏", "刘商《咏双开莲花》"),
    ("圆荷泻露", "圆荷", "苏轼《永遇乐·彭城夜宿燕子楼》"),
    ("制芰荷以为衣兮", "荷", "屈原《离骚》"),
    ("集芙蓉以为裳", "芙蓉", "屈原《离骚》"),
    ("留得枯荷听雨声", "枯荷", "李商隐《宿骆氏亭寄怀崔雍崔衮》"),
    ("荷花镜里香", "荷花", "李白《别储邕之剡中》"),
    ("满庭清露湿芙蕖", "芙蕖", "秦松龄《和吴弘人见赠之作》"),
    ("圆荷影若规", "圆荷", "李峤《荷》"),
    ("白莲种山净无尘", "白莲", "《东林寺》"),
    ("白鸟朱荷引画桡", "荷", "王士祯《浣溪沙·红桥》"),
]

DIRS = {"H": (0, 1), "V": (1, 0)}


def check_corpus():
    seen = {}
    for text, answer, src in CORPUS:
        n = text.count(answer)
        assert n == 1, "花名在句中不唯一或缺失：%s / %s" % (text, answer)
        assert len(text) == len(re.sub(r"\s", "", text)), "含空格：%s" % text
        for ch in text:
            assert "\u4e00" <= ch <= "\u9fff", "非汉字：%s" % text
        seen.setdefault(text, []).append(answer)
    for text, ans in seen.items():
        assert len(ans) == 1, "同句多花名，会互相泄底：%s" % text


def try_place(grid, text, r, c, dr, dc, max_span=15):
    """返回待写入的 (r,c,ch,is_cross) 列表；不合法返回 None"""
    cells = []
    crossings = 0
    for i, ch in enumerate(text):
        rr, cc = r + dr * i, c + dc * i
        if not (-max_span <= rr <= max_span and -max_span <= cc <= max_span):
            return None
        cur = grid.get((rr, cc))
        if cur is None:
            cells.append((rr, cc, ch, False))
        else:
            if cur["ch"] != ch:
                return None
            if (dr, dc) in cur["dirs"]:
                return None          # 同方向重叠：会并成长串
            if len(cur["dirs"]) >= 1 and (dr, dc) not in cur["dirs"]:
                # 该格已是横竖交叉点，再叠第三个词条会失控
                if cur["used"]:
                    return None
            cells.append((rr, cc, ch, True))
            crossings += 1
    if crossings == 0:
        return None
    return cells


def commit(grid, text, r, c, dr, dc, cells):
    for rr, cc, ch, is_cross in cells:
        cell = grid.get((rr, cc))
        if cell is None:
            grid[(rr, cc)] = {"ch": ch, "dirs": {(dr, dc)}, "used": False}
        else:
            cell["dirs"].add((dr, dc))
            cell["used"] = True
    return {"text": text, "r": r, "c": c, "dir": "H" if dr == 0 else "V"}


def build(entries, seed, target, max_span=15):
    rnd = random.Random(seed)
    grid = {}
    lines = []
    text0, ans0, src0 = entries[0]
    commit(grid, text0, 0, 0, 0, 1, [(0, i, ch, False) for i, ch in enumerate(text0)])
    lines.append({"text": text0, "r": 0, "c": 0, "dir": "H"})
    used_text = {text0}

    while len(lines) < target:
        best = None
        order = list(range(len(entries)))
        rnd.shuffle(order)
        for idx in order:
            text, ans, src = entries[idx]
            if text in used_text:
                continue
            for dirname, (dr, dc) in DIRS.items():
                for (gr, gc), cell in list(grid.items()):
                    if (dr, dc) in cell["dirs"]:
                        continue        # 交叉点必须换方向
                    for k, ch in enumerate(text):
                        if ch != cell["ch"]:
                            continue
                        r = gr - dr * k
                        c = gc - dc * k
                        cells = try_place(grid, text, r, c, dr, dc, max_span)
                        if not cells:
                            continue
                        crosses = sum(1 for x in cells if x[3])
                        rs = [x[0] for x in cells] + [p[0] for p in grid]
                        cs = [x[1] for x in cells] + [p[1] for p in grid]
                        h = max(rs) - min(rs) + 1
                        w = max(cs) - min(cs) + 1
                        if max(h, w) > max_span or h * w > 200:
                            continue
                        # 贴边邻接：新字与已有字平行相邻会产生假句，轻微罚分
                        adj = 0
                        for rr, cc, _ch, is_cross in cells:
                            if is_cross:
                                continue
                            for nr, nc in ((rr + dc, cc + dr), (rr - dc, cc - dr)):
                                if (nr, nc) in grid:
                                    adj += 1
                        score = crosses * 6 - adj * 0.9 - (h * w) / 34.0 - abs(len(text) - 7) * 0.5
                        score += rnd.random() * 0.9
                        if best is None or score > best[0]:
                            best = (score, text, ans, src, r, c, dr, dc, cells)
        if best is None:
            break
        _, text, ans, src, r, c, dr, dc, cells = best
        commit(grid, text, r, c, dr, dc, cells)
        lines.append({"text": text, "r": r, "c": c, "dir": "H" if dr == 0 else "V"})
        used_text.add(text)
    return grid, lines


def finalize(grid, lines, entries):
    meta = {t: (a, s) for t, a, s in entries}
    rows = [p[0] for p in grid]
    cols = [p[1] for p in grid]
    r0, c0 = min(rows), min(cols)
    out_lines = []
    blank_map = {}
    for ln in lines:
        ans, src = meta[ln["text"]]
        start = ln["text"].index(ans)
        dr, dc = DIRS[ln["dir"]]
        out_lines.append({
            "text": ln["text"],
            "r": ln["r"] - r0,
            "c": ln["c"] - c0,
            "dir": ln["dir"],
            "answer": ans,
            "start": start,
            "source": src,
        })
        for i in range(len(ans)):
            key = (ln["r"] - r0 + dr * (start + i), ln["c"] - c0 + dc * (start + i))
            blank_map.setdefault(key, {"char": ans[i], "lines": []})
            blank_map[key]["lines"].append(len(out_lines) - 1)
    # 空格所属句子 = 所有经过该格的诗句（含仅在交叉处路过的句子，用于高亮）
    through = {}
    for i, ln in enumerate(out_lines):
        dr, dc = DIRS[ln["dir"]]
        for k in range(len(ln["text"])):
            through.setdefault((ln["r"] + dr * k, ln["c"] + dc * k), []).append(i)
    blanks = [{"r": k[0], "c": k[1], "char": v["char"], "lines": sorted(through[k])}
              for k, v in sorted(blank_map.items())]
    return {
        "rows": max(rows) - r0 + 1,
        "cols": max(cols) - c0 + 1,
        "lines": out_lines,
        "blanks": blanks,
    }


def validate(puz):
    cells = {}
    for i, ln in enumerate(puz["lines"]):
        dr, dc = DIRS[ln["dir"]]
        for k, ch in enumerate(ln["text"]):
            key = (ln["r"] + dr * k, ln["c"] + dc * k)
            if key in cells:
                assert cells[key][0] == ch, "字冲突 %s: %s vs %s" % (key, cells[key][0], ch)
                cells[key][1].add(i)
            else:
                cells[key] = [ch, {i}]
    for b in puz["blanks"]:
        key = (b["r"], b["c"])
        assert key in cells, "空格不在任何句子上 %s" % str(key)
        assert cells[key][0] == b["char"], "空格字不符 %s" % str(key)
        assert set(b["lines"]) == cells[key][1], "空格所属句子不一致 %s" % str(key)
    # 每句至少有一个空格
    for i, ln in enumerate(puz["lines"]):
        assert any(i in b["lines"] for b in puz["blanks"]), "该句无空格"
    return len(cells)


TITLES = ["曲院风荷", "莲塘夜雨", "湖心采莲", "藕花深处", "水榭清圆", "西洲莲歌", "净慈晚照", "玉井秋香"]


def main():
    check_corpus()
    pools = []
    seed = 0
    while len(pools) < 40 and seed < 6000:
        entries = CORPUS[:]
        random.Random(seed).shuffle(entries)
        grid, lines = build(entries, seed, target=8)
        seed += 1
        if len(lines) < 6:
            continue
        puz = finalize(grid, lines, CORPUS)
        if max(puz["rows"], puz["cols"]) > 16:
            continue
        nb = len(puz["blanks"])
        if not 8 <= nb <= 20:
            continue
        total = validate(puz)
        fill = total / float(puz["rows"] * puz["cols"])
        if fill < 0.30:
            continue
        shared = sum(1 for b in puz["blanks"] if len(b["lines"]) > 1)
        if shared == 0:
            continue
        key = frozenset(ln["text"] for ln in puz["lines"])
        if any(len(key & p["_key"]) >= max(4, len(key) - 2) for p in pools):
            continue
        puz["_key"] = key
        puz["_score"] = len(puz["lines"]) * 3 + shared * 2.5 + fill * 14 - nb * 0.1
        puz["_cells"] = total
        pools.append(puz)

    pools.sort(key=lambda x: -x["_score"])
    puzzles = []
    for i, puz in enumerate(pools[:6]):
        puz.pop("_score", None)
        puz.pop("_key", None)
        total = puz.pop("_cells", 0)
        puz["id"] = i + 1
        puz["title"] = TITLES[i % len(TITLES)]
        puz["level"] = ["入门", "入门", "进阶", "进阶", "精研", "精研"][i]
        puzzles.append(puz)
        print("卷%d %s  %d×%d  %d句 %d空 共%d格 密度%.0f%%" % (
            puz["id"], puz["title"], puz["rows"], puz["cols"],
            len(puz["lines"]), len(puz["blanks"]), total,
            total * 100.0 / (puz["rows"] * puz["cols"])))

    all_answers = sorted({ln["answer"] for p in puzzles for ln in p["lines"]})
    out = {"flower": "荷花", "answers": all_answers, "puzzles": puzzles}
    path = os.path.join(ROOT, "data", "huajian.js")
    js = "/* 知花屿 · 花笺题库（由 tools/gen_huajian.py 生成，勿手改） */\n" \
         "window.HUAJIAN = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(js)
    print("已写入 data/huajian.js  共 %d 卷" % len(puzzles))


if __name__ == "__main__":
    main()
