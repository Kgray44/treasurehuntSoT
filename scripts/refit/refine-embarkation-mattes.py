"""Refine authored contours against original pixels; never repaint the masters."""
import json
from pathlib import Path
import cv2
import numpy as np

root = Path('.runtime/embarkation/delta2')
record = json.loads((root/'stage-provenance.json').read_text())
source = cv2.imread(record['source'])
h, w = source.shape[:2]
for name, points in record['shapes'].items():
    region = np.zeros((h,w), np.uint8)
    cv2.fillPoly(region, [np.array(points,np.int32)], 255)
    # Only the skyline needs classification. Preserve the authored shoreline
    # and its soft water contact; all foreground pixels remain source pixels.
    top = np.full(w, h, np.int32)
    for x in range(w):
        ys=np.flatnonzero(region[:,x]); top[x]=ys[0] if len(ys) else h
    labels=np.where(region>0,cv2.GC_PR_FGD,cv2.GC_BGD).astype(np.uint8)
    for x in range(w):
        if top[x] < h:
            labels[max(0,top[x]-55):min(h,top[x]+65),x]=cv2.GC_PR_BGD
            labels[min(h,top[x]+65):,x][region[min(h,top[x]+65):,x]>0]=cv2.GC_FGD
    cv2.grabCut(source,labels,None,np.zeros((1,65)),np.zeros((1,65)),6,cv2.GC_INIT_WITH_MASK)
    alpha=np.where((labels==cv2.GC_FGD)|(labels==cv2.GC_PR_FGD),255,0).astype(np.uint8)
    for x in range(w):
        ys=np.flatnonzero(region[:,x])
        if not len(ys):alpha[:,x]=0;continue
        bottom=int(ys[-1]);alpha[bottom+1:,x]=0
        if bottom<h-2:
            for y in range(max(0,bottom-7),bottom+1):
                alpha[y,x]=int(alpha[y,x]*min(1,(bottom-y)/7))
    # Keep only components attached to the intended land mass.
    n, components, stats, _=cv2.connectedComponentsWithStats(alpha)
    for k in range(1,n):
        if stats[k,cv2.CC_STAT_AREA]<45:alpha[components==k]=0
    alpha=cv2.GaussianBlur(alpha,(3,3),.38)
    cv2.imwrite(f'public/images/embarkation/derived/stage-{name}.png',np.dstack([source,alpha]))
print('Refined source-pixel skyline mattes with seeded color segmentation.')

# Remove the painted moon from the sky backing; the one celestial body is a
# persistent world object, not a second disc hidden with a sampled patch.
sky=cv2.imread(str(root/'stage-distant-backing-master.png'))
moon=np.zeros(sky.shape[:2],np.uint8)
cv2.circle(moon,(595,523),36,255,-1)
sky=cv2.inpaint(sky,moon,7,cv2.INPAINT_TELEA)
cv2.imwrite('public/images/embarkation/derived/stage-distant.webp',sky,[cv2.IMWRITE_WEBP_QUALITY,96])
