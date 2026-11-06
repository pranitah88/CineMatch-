"""
Generates a crisp 1200x630 Open Graph image conforming to visual design guidelines:
- Dark slate/charcoal cinema aesthetic (#0e1015)
- Elegant brass/gold details (#c9a86a)
- No emojis, no harsh gradients, no purple glow
"""

from PIL import Image, ImageDraw, ImageFont
import math

def generate_og_image():
    width = 1200
    height = 630
    img = Image.new("RGB", (width, height), color=(14, 16, 21))
    draw = ImageDraw.Draw(img)

    # Subtle inner border in muted brass
    draw.rectangle([(24, 24), (width - 24, height - 24)], outline=(201, 168, 106), width=2)
    draw.rectangle([(32, 32), (width - 32, height - 32)], outline=(35, 41, 54), width=1)

    # Film reel icon graphic (vector geometry)
    cx, cy, r = 180, 315, 80
    draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], outline=(201, 168, 106), width=3)
    draw.ellipse([(cx - 25, cy - 25), (cx + 25, cy + 25)], fill=(20, 24, 32), outline=(201, 168, 106), width=2)
    for i in range(6):
        angle = i * (math.pi / 3)
        px = cx + int(48 * math.cos(angle))
        py = cy + int(48 * math.sin(angle))
        draw.ellipse([(px - 10, py - 10), (px + 10, py + 10)], fill=(201, 168, 106))

    # Text rendering using standard default or truetype font
    try:
        font_brand = ImageFont.truetype("arial.ttf", 52)
        font_sub = ImageFont.truetype("arial.ttf", 24)
        font_desc = ImageFont.truetype("arial.ttf", 20)
        font_pill = ImageFont.truetype("arial.ttf", 16)
    except Exception:
        font_brand = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        font_desc = ImageFont.load_default()
        font_pill = ImageFont.load_default()

    # Title and subtitles
    text_x = 310
    draw.text((text_x, 180), "CINEMATCH", fill=(240, 236, 225), font=font_brand)
    draw.text((text_x, 245), "AI MOVIE RECOMMENDATION SYSTEM", fill=(201, 168, 106), font=font_sub)
    
    desc_line1 = "Content-based movie discovery using trained K-Nearest Neighbors"
    desc_line2 = "with Cosine Distance and 10 unsupervised K-Means genre clusters."
    draw.text((text_x, 295), desc_line1, fill=(180, 185, 195), font=font_desc)
    draw.text((text_x, 325), desc_line2, fill=(180, 185, 195), font=font_desc)

    # Technical Metric Badges
    pills = [
        "9,742 Catalog Titles",
        "19 Binary Genre Dimensions",
        "10 Archetype Clusters",
        "Deterministic Cosine Distance"
    ]
    px_curr = text_x
    for pill in pills:
        bbox = draw.textbbox((px_curr + 16, 400), pill, font=font_pill)
        pill_w = bbox[2] - bbox[0] + 32
        pill_rect = [(px_curr, 394), (px_curr + pill_w, 428)]
        draw.rounded_rectangle(pill_rect, radius=6, fill=(24, 28, 38), outline=(50, 58, 75), width=1)
        draw.text((px_curr + 16, 402), pill, fill=(225, 220, 210), font=font_pill)
        px_curr += pill_w + 14

    img.save("public/og-image.png", "PNG", optimize=True)
    print("Generated public/og-image.png successfully (1200x630)")

if __name__ == "__main__":
    generate_og_image()
