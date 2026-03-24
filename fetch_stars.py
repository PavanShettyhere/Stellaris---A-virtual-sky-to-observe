import urllib.request
import urllib.parse
import csv
import io
import os

print("Fetching Hipparcos catalog from VizieR...")
# Fetch top brightest stars (Vmag < 5.5)
query = 'SELECT Vmag, _RAJ2000, _DEJ2000, SpType FROM "I/239/hip_main" WHERE Vmag < 5.5'
url = 'https://tapvizier.u-strasbg.fr/TAPVizieR/tap/sync?request=doQuery&lang=adql&format=csv&query=' + urllib.parse.quote(query)

import ssl
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    response = urllib.request.urlopen(req, context=ctx)
    data = response.read().decode('utf-8')
    
    stars = []
    reader = csv.reader(io.StringIO(data))
    header = next(reader) # skip header
    print(f"Columns: {header}")
    for row in reader:
        if len(row) < 4: continue
        try:
            mag = float(row[0].strip())
            ra = float(row[1].strip())
            dec = float(row[2].strip())
            sp = row[3].strip()
            # formatting: [name (empty), ra, dec, mag, spec, constellation]
            stars.append(f"['',{ra:.4f},{dec:.4f},{mag:.2f},'{sp}','']")
        except ValueError:
            pass

    js_content = f"// Auto-generated Catalog from VizieR (Hipparcos)\n"
    js_content += f"const EXTRA_STARS = [\n  "
    js_content += ",\n  ".join(stars)
    js_content += "\n];\n"
    
    out_path = os.path.join(os.path.dirname(__file__), 'src', 'js', 'catalog.js')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully wrote {len(stars)} stars to catalog.js")

except Exception as e:
    print(f"Error fetching data: {e}")
