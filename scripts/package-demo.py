"""Package the self-contained browser demo for direct download from GitHub."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
html = root / "exports" / "CraftNDetail-demo.html"
if not html.is_file():
    raise SystemExit("Run npm run export:demo first.")

destination = root / "downloads" / "CraftNDetail-demo.zip"
destination.parent.mkdir(exist_ok=True)
instructions = """CraftNDetail clickable prototype

1. Download this ZIP to your computer and extract/unzip it.
2. Find CraftNDetail-demo.html in the extracted folder.
3. Open that file with Chrome, Edge, Firefox, or Safari.
   Do not open it inside the ZIP or a chat/document preview.

No installation, terminal commands, or account is needed to view the demo.
The images are included in the HTML file. Use fictional customer details.
Some mobile file viewers do not run HTML apps; a desktop browser is recommended.
If the wardrobe says browser storage is unavailable, use the hosted website.

This download does not update automatically. Download a new ZIP after changes.
It includes the dressed sample mannequins and mouse/touch outfit dragging.
"""
with ZipFile(destination, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
    archive.write(html, "CraftNDetail-demo.html")
    archive.writestr("START-HERE.txt", instructions)
with ZipFile(destination) as archive:
    assert archive.testzip() is None, "ZIP verification failed"
    assert archive.read("CraftNDetail-demo.html") == html.read_bytes()
print(f"Created and verified {destination.relative_to(root)} ({destination.stat().st_size:,} bytes)")
