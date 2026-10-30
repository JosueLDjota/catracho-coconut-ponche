import os
from PIL import Image

dir_extracted = r"c:\Users\Jota Daniel\proyects\UNAH\Proyecto 2\extracted_pdf_images"
files = sorted([f for f in os.listdir(dir_extracted) if f.lower().endswith(('.png', '.jpg'))])

html = [
    "<!DOCTYPE html>",
    "<html><head><meta charset='utf-8'><title>PDF Extracted Images</title></head>",
    "<body style='font-family:sans-serif; background:#1e1e1e; color:#eee; display:flex; flex-wrap:wrap; gap:20px; padding:20px;'>",
]

for f in files:
    fp = os.path.join(dir_extracted, f)
    with Image.open(fp) as im:
        w, h = im.size
    html.append(f"<div style='background:#2a2a2a; border-radius:12px; padding:12px; width:280px; box-shadow:0 4px 12px rgba(0,0,0,0.4); text-align:center;'>")
    html.append(f"<img src='{f}' style='width:100%; height:260px; object-fit:contain; border-radius:8px; background:#fff;'>")
    html.append(f"<p style='font-size:12px; word-break:break-all; margin:8px 0 0;'><b>{f}</b><br>{w}x{h}</p>")
    html.append("</div>")

html.append("</body></html>")

with open(os.path.join(dir_extracted, "preview_pdf_imgs.html"), "w", encoding="utf-8") as out:
    out.write("\n".join(html))

print("PDF gallery generated.")
