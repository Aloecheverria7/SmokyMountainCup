"""Apply bounded, idempotent HTML and image optimizations to existing templates."""
import re
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def edit(name, transform):
    path = ROOT / name
    before = path.read_text(encoding='utf-8')
    after = transform(before)
    if after != before:
        path.write_text(after, encoding='utf-8', newline='\n')
        print(name)

def header(s):
    if '</head>' not in s:
        s = re.sub(r'(\s*<body\b)', r'\n</head>\n\1', s, count=1)
    s = s.replace('width="200"height=', 'width="200" height=')
    s = s.replace('gallery.php"class=', 'gallery.php" class=')
    s = s.replace('src="upload/logo.png" alt=""', 'src="upload/logo.png" alt="Smoky Mountain Cup"')
    return s
edit('php/secction/header.php', header)

def clean_footer(s):
    def map_json(match):
        value = match[1]
        if '/"' not in value:
            return match[0]
        parsed = json.loads(re.sub(r'/\s*"', '"', value))
        def trim(item):
            if isinstance(item, dict):
                return {key.strip(): trim(val) for key, val in item.items()}
            if isinstance(item, list):
                return [trim(val) for val in item]
            return item.strip() if isinstance(item, str) else item
        return '"json": ' + json.dumps(json.dumps(trim(parsed), separators=(',', ':'))) + ','
    s = re.sub(r'"json": "(\[.*?\])",', map_json, s)
    s = s.replace('tmp: "<span class=/"tp- bullet - inner / "></span>"', '''tmp: '<span class="tp-bullet-inner"></span>' ''')
    # The same slider was initialized twice with conflicting dimensions.
    blocks = list(re.finditer(r'<script\b[^>]*>\s*setREVStartSize\([\s\S]*?</script>', s))
    if len(blocks) > 1:
        for block in reversed(blocks[1:]):
            s = s[:block.start()] + s[block.end():]
    guard = '            if (!document.getElementById("rev_slider_1_1")) return;\n'
    s = s.replace(guard, '')
    s = s.replace('tpj = jQuery;\n', 'tpj = jQuery;\n' + guard)
    return s
edit('php/secction/footer.php', clean_footer)
for name in ('games-calendar.php', 'games-blocks.php'):
    def footer(s):
        needle = "include('php/secction/header.php')"
        pos = s.rfind(needle)
        return s[:pos] + s[pos:].replace(needle, "include('php/secction/footer.php')", 1) if pos > s.find(needle) else s
    edit(name, footer)
edit('schedule.php', lambda s: s.replace('rel="tag"RecSports', 'rel="tag">RecSports'))

def images(s):
    def image(match):
        tag = match.group()
        source = re.search(r'\bsrc="([^"]+)"', tag)
        if not source:
            return tag
        name = source[1]
        if name in ('images/G2.jpg', 'images/G3.jpg', 'images/G4.jpg', 'upload/1.jpg', 'upload/2.jpg', 'upload/3.jpg', 'upload/4.jpg'):
            stem = Path(name).stem
            small = f'images/optimized/{stem}-550.jpg'
            large = f'images/optimized/{stem}-1100.jpg'
            if (ROOT / small).exists():
                tag = tag.replace(f'src="{name}"', f'src="{small}"')
                if (ROOT / large).exists() and 'srcset=' not in tag:
                    tag = tag.replace('<img', f'<img srcset="{small} 550w, {large} 1100w" sizes="(max-width: 768px) 90vw, 400px"', 1)
        if 'loading=' not in tag:
            tag = tag.replace('<img', '<img loading="lazy"', 1)
        if 'decoding=' not in tag:
            tag = tag.replace('<img', '<img decoding="async"', 1)
        return tag
    return re.sub(r'<img\b[^>]*>', image, s, flags=re.I)

for name in ('php/secction/marcador.php', 'php/secction/seccion-gallery.php',
             'php/secction/seccion-contact.php', 'php/secction/seccion-contact2.php',
             'php/secction/footer.php', 'gallery.php'):
    edit(name, images)

# The lightbox should open the photograph represented by its thumbnail.
edit('php/secction/seccion-gallery.php', lambda s: s.replace('href="upload/shutterstock_433241116-550x500.jpg"', 'href="upload/1.jpg"').replace('href="upload/Untitled-12-550x500.jpg"', 'href="upload/4.jpg"').replace('href="upload/pic-gel-2-550x500.jpg"', 'href="upload/pic-gel-1-550x500.jpg"'))
