import math
import random
import os

stars = []
# Give them a distribution favoring the galactic plane
for i in range(8000):
    ra = random.uniform(0, 360)
    # Concentration towards the milky way (roughly tilting the plane)
    u = random.random()
    # Math to concentrate stars near a plane
    b = (random.random() - 0.5) * 2
    b = b * b * b # cubic distribution to heavily weight the center
    dec = b * 90
    
    mag = random.uniform(4.0, 7.5)
    sp = random.choice(['B', 'A', 'A', 'F', 'F', 'G', 'G', 'G', 'K', 'K', 'M'])
    
    stars.append(f"['',{ra:.3f},{dec:.3f},{mag:.2f},'{sp}','']")

js = "const EXTRA_STARS = [\n  " + ",\n  ".join(stars) + "\n];\n"
out_path = os.path.join(os.path.dirname(__file__), 'src', 'js', 'catalog.js')
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w') as f:
    f.write(js)
print(f"Generated {len(stars)} catalog stars.")
