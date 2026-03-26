import urllib.request
import json
import os

url = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json"
print("Downloading real star map catalog...")

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
    stars = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        coords = feature.get('geometry', {}).get('coordinates', [0,0])
        mag = props.get('mag', 6.0)
        # Convert Dec/RA from geojson. RA in GeoJSON d3-celestial is [-180, 180], where 0 is RA=0.
        # But actually d3-celestial maps RA hours (0 to 24) to longitude (-180 to 180).
        # Wait, standard GeoJSON celestial: ra_deg = lon. If lon < 0, ra_deg = lon + 360.
        lon = coords[0]
        lat = coords[1]
        ra = lon if lon >= 0 else lon + 360
        dec = lat
        
        # approximate spectral type from typical catalogs or default to 'G'
        stars.append(f"['',{ra:.3f},{dec:.3f},{mag:.2f},'G','']")
        
    js_content = f"// Authentic Sky Map Database (Replaces procedural data)\n"
    js_content += f"const EXTRA_STARS = [\n  "
    js_content += ",\n  ".join(stars)
    js_content += "\n];\n"
    
    out_path = os.path.join('src', 'js', 'catalog.js')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully wrote {len(stars)} authentic stars to catalog.")
except Exception as e:
    print("Error:", e)
