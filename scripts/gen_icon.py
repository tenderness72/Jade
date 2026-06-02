#!/usr/bin/env python3
"""
Jade app icon generator  -  1024×1024 RGBA PNG
勾玉 (magatama) shaped icon in jade green.
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import math, os, sys

SIZE = 1024
OUT  = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons", "jade_icon_source.png")

# ─── Palette ──────────────────────────────────────────────────────────────────
BG          = (10, 26, 17, 255)       # dark forest green (background)
JADE_HI     = (185, 228, 205)         # pale jade highlight
JADE_MID    = (52, 148, 97)           # medium jade
JADE_SHADOW = (22, 68, 43)            # deep shadow
HOLE_COLOR  = (6, 18, 11, 255)        # very dark — looks like a drilled hole
SHINE       = (220, 248, 232, 75)     # soft specular

# ─── Magatama geometry ────────────────────────────────────────────────────────
# Head: lower-left, tail pointing upper-right  (classic diagonal orientation)
HX, HY = 385, 620      # head center
HR      = 240           # head radius
TX, TY  = 820, 125      # tail tip

# Angles on the head circle where the tail emerges
# (measured from positive-x, standard math, but y flipped on screen)
A_OUT = math.radians(-80)   # outer edge of tail
A_IN  = math.radians(-48)   # inner edge of tail

# ─── Helpers ──────────────────────────────────────────────────────────────────
def quad_bezier(p0, ctrl, p2, n=80):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1-t)**2*p0[0] + 2*(1-t)*t*ctrl[0] + t**2*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*ctrl[1] + t**2*p2[1]
        pts.append((int(x), int(y)))
    return pts

def head_arc(a_start, a_end, n=20):
    pts = []
    for i in range(n + 1):
        a = a_start + (a_end - a_start) * i / n
        pts.append((int(HX + HR*math.cos(a)), int(HY + HR*math.sin(a))))
    return pts

# ─── Tail polygon ─────────────────────────────────────────────────────────────
P_OUT = (HX + HR*math.cos(A_OUT), HY + HR*math.sin(A_OUT))
P_IN  = (HX + HR*math.cos(A_IN),  HY + HR*math.sin(A_IN))
TIP   = (TX, TY)

# Control points: outer edge sweeps wide, inner edge stays closer
CTRL_OUT = (P_OUT[0] + 130,  P_OUT[1] - 140)
CTRL_IN  = (P_IN[0]  -  40,  P_IN[1]  - 115)

outer_curve = quad_bezier(P_OUT, CTRL_OUT, TIP, n=80)
inner_curve = quad_bezier(P_IN,  CTRL_IN,  TIP, n=80)
inner_curve.reverse()
arc_base    = head_arc(A_IN, A_OUT, n=20)      # close polygon along head arc
TAIL_POLY   = outer_curve + inner_curve + arc_base

# ─── Hole position ────────────────────────────────────────────────────────────
# Opposite side of the head from the tail
tail_dir = np.array([TX - HX, TY - HY], dtype=float)
tail_dir /= np.linalg.norm(tail_dir)
hole_c = np.array([HX, HY]) - tail_dir * HR * 0.52
HCX, HCY = int(hole_c[0]), int(hole_c[1])
HOLE_R = 62

# ─── Shape mask ───────────────────────────────────────────────────────────────
mask = Image.new('L', (SIZE, SIZE), 0)
md   = ImageDraw.Draw(mask)
md.ellipse([HX-HR, HY-HR, HX+HR, HY+HR], fill=255)   # head circle
md.polygon(TAIL_POLY, fill=255)                        # tail
# Smooth edges slightly then re-threshold
m_arr = np.array(mask.filter(ImageFilter.GaussianBlur(2)))
m_arr = np.where(m_arr > 80, 255, 0).astype(np.uint8)
mask  = Image.fromarray(m_arr)
# Drill the hole
md2   = ImageDraw.Draw(mask)
md2.ellipse([HCX-HOLE_R, HCY-HOLE_R, HCX+HOLE_R, HCY+HOLE_R], fill=0)
mask_arr = np.array(mask)

# ─── Jade radial gradient (vectorized) ────────────────────────────────────────
yy, xx = np.mgrid[0:SIZE, 0:SIZE]
# Highlight origin: upper-left part of head (where light hits first)
lx = HX - HR * 0.36
ly = HY - HR * 0.40
dist = np.sqrt((xx - lx)**2 + (yy - ly)**2)
t    = np.clip(dist / (HR * 2.1), 0.0, 1.0)

pivot = 0.42
r_ch = np.where(t < pivot,
    JADE_HI[0] + (JADE_MID[0]    - JADE_HI[0])    * t / pivot,
    JADE_MID[0]  + (JADE_SHADOW[0] - JADE_MID[0])  * (t - pivot) / (1 - pivot)
).clip(0, 255).astype(np.uint8)
g_ch = np.where(t < pivot,
    JADE_HI[1] + (JADE_MID[1]    - JADE_HI[1])    * t / pivot,
    JADE_MID[1]  + (JADE_SHADOW[1] - JADE_MID[1])  * (t - pivot) / (1 - pivot)
).clip(0, 255).astype(np.uint8)
b_ch = np.where(t < pivot,
    JADE_HI[2] + (JADE_MID[2]    - JADE_HI[2])    * t / pivot,
    JADE_MID[2]  + (JADE_SHADOW[2] - JADE_MID[2])  * (t - pivot) / (1 - pivot)
).clip(0, 255).astype(np.uint8)

jade_rgba = np.stack([r_ch, g_ch, b_ch, mask_arr], axis=2)
jade_img  = Image.fromarray(jade_rgba, 'RGBA')

# ─── Background ───────────────────────────────────────────────────────────────
bg = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
bg_d = ImageDraw.Draw(bg)
try:
    bg_d.rounded_rectangle([28, 28, SIZE-28, SIZE-28], radius=210, fill=BG)
except AttributeError:
    # Pillow < 8.2 fallback
    bg_d.rectangle([28, 28, SIZE-28, SIZE-28], fill=BG)

# ─── Hole fill layer ──────────────────────────────────────────────────────────
hole_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hl_d = ImageDraw.Draw(hole_layer)
hl_d.ellipse([HCX-HOLE_R, HCY-HOLE_R, HCX+HOLE_R, HCY+HOLE_R], fill=HOLE_COLOR)

# ─── Specular highlight ───────────────────────────────────────────────────────
shine_layer = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
sh_d = ImageDraw.Draw(shine_layer)
sx = int(HX - HR * 0.28)
sy = int(HY - HR * 0.33)
sw, sh_h = int(HR * 0.42), int(HR * 0.25)
sh_d.ellipse([sx-sw, sy-sh_h, sx+sw, sy+sh_h], fill=SHINE)
shine_layer = shine_layer.filter(ImageFilter.GaussianBlur(22))

# ─── Subtle inner shadow on hole edge ────────────────────────────────────────
hole_shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
hs_d = ImageDraw.Draw(hole_shadow)
for i, alpha in enumerate([40, 25, 12]):
    r = HOLE_R + 3 + i*4
    hs_d.ellipse([HCX-r, HCY-r, HCX+r, HCY+r],
                 outline=(0, 0, 0, alpha), width=3)

# ─── Composite ────────────────────────────────────────────────────────────────
canvas = bg.copy()
canvas.alpha_composite(jade_img)
canvas.alpha_composite(hole_layer)
canvas.alpha_composite(hole_shadow)
canvas.alpha_composite(shine_layer)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
canvas.save(OUT)
print(f"Saved: {OUT}")
