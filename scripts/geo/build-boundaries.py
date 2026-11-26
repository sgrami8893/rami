"""법정동(읍면동·리) 경계 SHP → 전월세 지도용 단순화 GeoJSON (2026-11-26).

입력: 도로명주소 계열 경계 SHP(WGS84, UTF-8). 서울·경기·인천 시군구/읍면동/리 폴더를 압축 해제한 폴더.
출력: src/data/geo/sgg.json (시·군·구, 동네콕콕 slug 단위로 합침), src/data/geo/emd/{sido}__{slug}.json (동 단위)
  - 읍·면은 전월세 자료가 '공도읍 마정리'처럼 리 단위라, 그 읍·면에 리 단위 거래가 있으면 리 경계로 바꿔 넣는다.
  - 경계 공유선을 지키는 단순화(topojson toposimplify)로 동 사이 틈·겹침이 생기지 않게 한다.
  - 좌표는 소수 5자리(약 1m)로 줄인다. 라벨 위치는 polylabel(도형 안쪽 점).
도구: pyshp(MIT), shapely(BSD-3), topojson(BSD-3). 화면 번들에는 들어가지 않는 빌드 도구.
쓰는 법: pip install pyshp shapely topojson
         python3 scripts/geo/build-boundaries.py <압축 푼 폴더> <rent-lawd 코드표 JSON>
코드표 JSON은 node로 만든다(README의 '경계 갱신' 참고): {"11110": ["seoul", "jongno-gu"], ...}
"""
import glob, json, os, sys
import shapefile
from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union, polylabel
from shapely.validation import make_valid
import topojson

SRC, LAWD = sys.argv[1], sys.argv[2]
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'data', 'geo'))
lawd = json.load(open(LAWD, encoding='utf-8'))
rent = json.load(open(os.path.join(os.path.dirname(OUT), 'rent-stats.json'), encoding='utf-8'))
rent_keys = {(a['sido'], a['sigungu'], a['dong']) for a in rent['areas'] if a['dong']}

def read(kind):
    out = []
    for p in glob.glob(os.path.join(SRC, '**', '*.shp'), recursive=True):
        r = shapefile.Reader(p, encoding='utf-8')
        if r.fields[1][0] != kind: continue
        for sr in r.iterShapeRecords():
            if sr.shape.shapeType == 0: continue  # 빈 도형(일부 리)
            out.append((sr.record[0], sr.record[1], make_valid(shape(sr.shape.__geo_interface__))))
    return out

emd = read('emd_cd'); li = read('li_cd')
emd_name = {c: n for c, n, _ in emd}
feats = []  # (sido, slug, key, code, geom)
li_by_emd = {}
for c, n, g in li: li_by_emd.setdefault(c[:8], []).append((c, n, g))
for c, n, g in emd:
    reg = lawd.get(c[:5])
    if not reg: continue
    sido, slug = reg
    ris = li_by_emd.get(c, [])
    if n[-1] in '읍면' and ris and any((sido, slug, f'{n} {rn}') in rent_keys for _, rn, _ in ris):
        for rc, rn, rg in ris: feats.append((sido, slug, f'{n} {rn}', rc, rg))
    else:
        feats.append((sido, slug, n, c, g))

def polys(g, min_area=2e-7):
    """다각형만 남기고, 아주 작은 조각(약 2,000㎡ 미만 섬·틈)은 뺀다(가장 큰 조각은 항상 남김)."""
    g = make_valid(g)
    parts = []
    for x in (g.geoms if hasattr(g, 'geoms') else [g]):
        if isinstance(x, Polygon): parts.append(x)
        elif isinstance(x, MultiPolygon): parts.extend(x.geoms)
    if not parts: return Polygon()
    big = max(parts, key=lambda x: x.area)
    keep = [x for x in parts if x is big or x.area >= min_area]
    return keep[0] if len(keep) == 1 else MultiPolygon(keep)

def simplify(items, tol):
    """items: [(props, geom)] → 공유선 보존 단순화 후 [(props, geom)]"""
    fc = {'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'i': i}, 'geometry': mapping(g)} for i, (_, g) in enumerate(items)]}
    topo = topojson.Topology(fc, prequantize=False, toposimplify=tol, simplify_algorithm='dp')
    out = json.loads(topo.to_geojson())
    res = [None] * len(items)
    for f in out['features']:
        i = f['properties']['i']
        res[i] = (items[i][0], polys(shape(f['geometry'])) if f['geometry'] else items[i][1].simplify(tol))
    return res

def rnd(o):
    if isinstance(o, float): return round(o, 5)
    if isinstance(o, (list, tuple)): return [rnd(x) for x in o]
    return o

def label(g):
    big = max(g.geoms, key=lambda x: x.area) if isinstance(g, MultiPolygon) else g
    p = polylabel(big, tolerance=0.0001)
    return [round(p.y, 5), round(p.x, 5)]

def feature(props, g):
    gm = mapping(g)
    return {'type': 'Feature', 'properties': {**props, 'l': label(g)}, 'geometry': {'type': gm['type'], 'coordinates': rnd(gm['coordinates'])}}

os.makedirs(os.path.join(OUT, 'emd'), exist_ok=True)
for f in glob.glob(os.path.join(OUT, 'emd', '*.json')): os.remove(f)

# 동 단위: 수도권 전체를 한 번에 단순화(시·군·구 경계선도 공유선으로 지킨다)
dong = simplify([({'sido': s, 'slug': sl, 'k': k, 'c': c}, polys(g)) for s, sl, k, c, g in feats], 0.00015)
groups = {}
for props, g in dong:
    if g.is_empty: continue
    groups.setdefault((props['sido'], props['slug']), []).append(feature({'k': props['k'], 'c': props['c']}, g))
total = 0
for (s, sl), fs in sorted(groups.items()):
    txt = json.dumps({'type': 'FeatureCollection', 'features': fs}, ensure_ascii=False, separators=(',', ':'))
    total += len(txt)
    open(os.path.join(OUT, 'emd', f'{s}__{sl}.json'), 'w', encoding='utf-8').write(txt)

# 시·군·구 단위: 동을 slug로 합친 뒤 더 크게 단순화
# (단순화한 동 경계를 합치므로 시·군·구끼리도 같은 선을 쓴다. 합친 뒤 한 번 더 줄인다)
merged = {}
for props, g in dong:
    if not g.is_empty: merged.setdefault((props['sido'], props['slug']), []).append(g)
fs = []
for (s, sl), gs in sorted(merged.items()):
    g = polys(unary_union(gs).buffer(0.00003).buffer(-0.00003).simplify(0.0005), 4e-6)
    fs.append(feature({'sido': s, 'slug': sl}, g))
txt = json.dumps({'type': 'FeatureCollection', 'features': fs}, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'sgg.json'), 'w', encoding='utf-8').write(txt)
print(f'동 {len(dong)}개, 시군구 {len(groups)}곳 파일 합계 {total // 1024}KB, sgg.json {len(txt) // 1024}KB')

# 시·도 바깥 테두리(2026-11-26): 시·군·구를 합친 외곽선. 지도에서 '시·도 단계' 틀로만 쓴다(채우지 않음)
by_sido = {}
for (s, sl), gs in sorted(merged.items()): by_sido.setdefault(s, []).extend(gs)
sido_fs = []
for s, gs in sorted(by_sido.items()):
    g = polys(unary_union(gs).buffer(0.0002).buffer(-0.0002).simplify(0.0006), 4e-6)
    gm = mapping(g)
    sido_fs.append({'type': 'Feature', 'properties': {'sido': s}, 'geometry': {'type': gm['type'], 'coordinates': rnd(gm['coordinates'])}})
txt = json.dumps({'type': 'FeatureCollection', 'features': sido_fs}, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'sido.json'), 'w', encoding='utf-8').write(txt)
print(f'sido.json {len(txt) // 1024}KB')
