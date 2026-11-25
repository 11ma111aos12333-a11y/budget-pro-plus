"""Generates launcher icons, adaptive-icon foreground, notification icon and splash."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
EMOJI_FONT = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'

def gradient(size, c1=(79,70,229), c2=(139,92,246)):
    img = Image.new('RGB', (size, size), c1)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img

def emoji(ch='\U0001F4B0', size=512):
    f = ImageFont.truetype(EMOJI_FONT, 109)
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((80, 80), ch, font=f, embedded_color=True, anchor='mm')
    im = im.crop(im.getbbox())
    return im.resize((size, int(size * im.height / im.width)), Image.LANCZOS)

def with_shadow(base, em, pos):
    sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
    alpha = em.split()[3].point(lambda a: int(a * 0.35))
    blk = Image.new('RGBA', em.size, (0, 0, 0, 255)); blk.putalpha(alpha)
    sh.paste(blk, (pos[0], pos[1] + base.size[0] // 40), blk)
    sh = sh.filter(ImageFilter.GaussianBlur(base.size[0] // 60))
    base.alpha_composite(sh); base.alpha_composite(em, pos)
    return base

MASTER = 1024
bg = gradient(MASTER).convert('RGBA')
em = emoji(size=int(MASTER * 0.62))
full = with_shadow(bg.copy(), em, ((MASTER - em.width) // 2, (MASTER - em.height) // 2))
# rounded square legacy icon
mask = Image.new('L', (MASTER, MASTER), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, MASTER - 1, MASTER - 1], radius=int(MASTER * 0.22), fill=255)
legacy = Image.new('RGBA', (MASTER, MASTER), (0, 0, 0, 0)); legacy.paste(full, (0, 0), mask)
rmask = Image.new('L', (MASTER, MASTER), 0); ImageDraw.Draw(rmask).ellipse([0, 0, MASTER - 1, MASTER - 1], fill=255)
roundi = Image.new('RGBA', (MASTER, MASTER), (0, 0, 0, 0)); roundi.paste(full, (0, 0), rmask)
# adaptive foreground: emoji inside 66% safe zone on transparent
fg = Image.new('RGBA', (MASTER, MASTER), (0, 0, 0, 0))
em2 = emoji(size=int(MASTER * 0.42))
fg = with_shadow(fg, em2, ((MASTER - em2.width) // 2, (MASTER - em2.height) // 2))

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, s in dens.items():
    p = os.path.join(RES, 'mipmap-' + d); os.makedirs(p, exist_ok=True)
    legacy.resize((int(48 * s),) * 2, Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
    roundi.resize((int(48 * s),) * 2, Image.LANCZOS).save(os.path.join(p, 'ic_launcher_round.png'))
    fg.resize((int(108 * s),) * 2, Image.LANCZOS).save(os.path.join(p, 'ic_launcher_foreground.png'))
    # notification small icon: white coin silhouette with "$"
    n = int(24 * s); big = 240
    ni = Image.new('RGBA', (big, big), (0, 0, 0, 0)); dr = ImageDraw.Draw(ni)
    dr.ellipse([18, 18, big - 18, big - 18], fill=(255, 255, 255, 255))
    try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 150)
    except Exception: f = ImageFont.load_default()
    dr.text((big // 2, big // 2 + 4), '$', font=f, fill=(0, 0, 0, 0), anchor='mm')
    pd = os.path.join(RES, 'drawable-' + d); os.makedirs(pd, exist_ok=True)
    ni.resize((n, n), Image.LANCZOS).save(os.path.join(pd, 'ic_stat_notify.png'))

with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w') as fh:
    fh.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#5B4FE6</color>\n</resources>\n')
# adaptive bg as gradient drawable
os.makedirs(os.path.join(RES, 'drawable'), exist_ok=True)
with open(os.path.join(RES, 'drawable', 'ic_launcher_gradient.xml'), 'w') as fh:
    fh.write('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:angle="315" android:startColor="#4F46E5" android:endColor="#8B5CF6" />
</shape>
''')
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    with open(os.path.join(RES, 'mipmap-anydpi-v26', name), 'w') as fh:
        fh.write('''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_gradient"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
''')
# remove the template vector foreground (would shadow the png)
for v in ('drawable-v24/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml'):
    pth = os.path.join(RES, v)
    if os.path.exists(pth): os.remove(pth)

# splash screens (gradient + emoji + title)
def splash(w, h):
    img = Image.new('RGB', (w, h)); px = img.load()
    c1, c2 = (79, 70, 229), (139, 92, 246)
    for y in range(h):
        t = y / h; col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
        for x in range(w): px[x, y] = col
    img = img.convert('RGBA'); e = emoji(size=int(min(w, h) * 0.28))
    img.alpha_composite(e, ((w - e.width) // 2, (h - e.height) // 2))
    return img.convert('RGB')
for folder in os.listdir(RES):
    if folder.startswith('drawable') and os.path.exists(os.path.join(RES, folder, 'splash.png')):
        p = os.path.join(RES, folder, 'splash.png'); w, h = Image.open(p).size
        splash(w, h).save(p, optimize=True)
legacy.save(os.path.join(os.path.dirname(__file__), 'icon-1024.png'))
print('icons done')
