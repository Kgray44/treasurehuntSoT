"""Registered supporting fill and independent pier material. Masters are read only."""
from pathlib import Path
import cv2
import numpy as np
import json
import hashlib

root = Path('.runtime/embarkation/motion-fog-correction')
out = Path('public/images/embarkation/derived')
source_path = out / 'room-exterior-continuous.png'
source = cv2.imread(str(source_path))
generated = cv2.imread(str(root / 'stage-c-fill-master.png'))
height, width = source.shape[:2]
mask = np.zeros((height,width),np.uint8)
mask[:320,:] = 255
sift = cv2.SIFT_create(nfeatures=6000)
k1,d1 = sift.detectAndCompute(source,mask)
k2,d2 = sift.detectAndCompute(generated,None)
matches = cv2.BFMatcher().knnMatch(d1,d2,k=2)
good = [a for a,b in matches if a.distance < .73*b.distance]
src_pts = np.float32([k1[m.queryIdx].pt for m in good])
dst_pts = np.float32([k2[m.trainIdx].pt for m in good])
matrix,inliers = cv2.estimateAffinePartial2D(src_pts,dst_pts,method=cv2.RANSAC,ransacReprojThreshold=3)
if matrix is None or int(inliers.sum()) < 12:
    raise RuntimeError('Backing registration is not supported by enough landmarks')
inverse = cv2.invertAffineTransform(matrix)
registration = inverse.copy()
registration[:,2] += [31,113]
extended = cv2.warpAffine(generated,registration,(1598,1157),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
valid = cv2.warpAffine(np.full(generated.shape[:2],255,np.uint8),registration,(1598,1157),flags=cv2.INTER_LINEAR)
# The new water fill supplies only 44 source pixels of upper extension. Reuse
# the already generated wider sky backing for the measured 87-pixel demand;
# register it from landmarks and composite only the uncovered support region.
wide=cv2.imread(str(out/'exterior-overscan.webp'))
kw,dw=sift.detectAndCompute(wide,None)
wide_matches=cv2.BFMatcher().knnMatch(d1,dw,k=2)
wide_good=[a for a,b in wide_matches if a.distance<.75*b.distance]
wide_matrix,wide_inliers=cv2.estimateAffinePartial2D(np.float32([k1[m.queryIdx].pt for m in wide_good]),np.float32([kw[m.trainIdx].pt for m in wide_good]),method=cv2.RANSAC,ransacReprojThreshold=4)
if wide_matrix is None or int(wide_inliers.sum())<12: raise RuntimeError('Wide sky backing registration failed')
wide_registration=cv2.invertAffineTransform(wide_matrix);wide_registration[:,2]+=[31,113]
wide_canvas=cv2.warpAffine(wide,wide_registration,(1598,1157),flags=cv2.INTER_CUBIC)
wide_valid=cv2.warpAffine(np.full(wide.shape[:2],255,np.uint8),wide_registration,(1598,1157))
mix=cv2.GaussianBlur(valid,(31,31),7).astype(np.float32)/255
mix=np.minimum(mix,valid/255)
extended=np.round(extended*mix[:,:,None]+wide_canvas*(1-mix[:,:,None])).astype(np.uint8)
valid=np.maximum(valid,wide_valid)
# Coverage was measured through the authored camera path. Generated support may
# be sampled only where it contains real reconstructed pixels, never edge clamp.
valid[113:113+height,31:31+width]=255  # exact source composite below owns this region
coverage=json.loads((root/'coverage.json').read_text())
all_bounds=[bounds for row in coverage['rows'] for bounds in row['bounds'].values()]
u0=min(b[0] for b in all_bounds);v0=min(b[1] for b in all_bounds)
u1=max(b[2] for b in all_bounds);v1=max(b[3] for b in all_bounds)
x0=max(0,int(np.floor(31+u0*width))-2);x1=min(1598,int(np.ceil(31+u1*width))+2)
y0=max(0,int(np.floor(113+(1-v1)*height))-2);y1=min(1157,int(np.ceil(113+(1-v0)*height))+2)
needed=valid[y0:y1,x0:x1]
print('Registration',matrix.tolist(),'inliers',int(inliers.sum()),'wide',wide_matrix.tolist(),'support min',int(needed.min()))
if int(needed.min())<250: raise RuntimeError('Measured exterior coverage still lacks reconstructed pixels')
cv2.imwrite(str(root/'registered-support.png'),extended)

# Original RGB is retained outside the explicitly separated foreground shape.
rough = np.zeros((height,width),np.uint8)
polygons = [
 [(764,351),(771,341),(773,319),(780,317),(782,348),(795,346),(800,339),(804,341),(806,354),(811,353),(812,337),(817,337),(819,350),(829,346),(835,357),(831,365),(764,359)],
 [(1180,360),(1180,344),(1190,339),(1194,319),(1201,303),(1207,286),(1218,278),(1227,287),(1235,305),(1242,306),(1245,326),(1255,348),(1273,361),(1290,389),(1287,418),(1206,420),(1163,401)],
 [(1316,350),(1320,327),(1333,329),(1343,319),(1352,303),(1361,290),(1373,293),(1382,285),(1397,291),(1407,314),(1421,323),(1435,332),(1452,346),(1475,366),(1536,370),(1536,449),(1450,442),(1386,422),(1310,410)],
 [(1431,332),(1439,305),(1452,281),(1463,274),(1476,266),(1485,269),(1497,253),(1513,245),(1536,258),(1536,445),(1481,426)],
 [(974,396),(982,391),(1002,391),(1092,397),(1130,391),(1200,385),(1324,382),(1424,376),(1536,399),(1536,437),(1445,427),(1312,425),(1210,419),(1089,418),(977,411)]
]
for p in polygons: cv2.fillPoly(rough,[np.array(p,np.int32)],255)
# Narrow rails and posts retain their actual silhouette rather than a bounding box.
for points,thickness in [
 ([(981,393),(1107,376),(1250,369),(1368,357),(1500,357)],7),
 ([(984,365),(984,419)],9), ([(1018,354),(1018,414)],10),
 ([(1070,369),(1070,424)],9), ([(1109,343),(1109,432)],15),
 ([(1186,364),(1186,432)],12), ([(1259,345),(1259,434)],14),
 ([(1297,361),(1297,433)],14), ([(1353,348),(1353,435)],17),
 ([(1420,332),(1420,430)],16), ([(1498,308),(1498,439)],18)
]: cv2.polylines(rough,[np.array(points,np.int32)],False,255,thickness,cv2.LINE_AA)
for x,y,r in [(984,361,5),(1018,350,5),(1110,338,9),(1258,341,7),(1297,357,6),(1353,344,8),(1420,329,8),(1498,298,12)]:
 cv2.circle(rough,(x,y),r,255,-1,cv2.LINE_AA)
# Snap hand contours to the source edge without accepting surrounding open water.
gc=np.full((height,width),cv2.GC_BGD,np.uint8)
expanded=cv2.dilate(rough,np.ones((9,9),np.uint8))>0
gc[expanded]=cv2.GC_PR_BGD;gc[rough>0]=cv2.GC_PR_FGD
sure=cv2.erode(rough,np.ones((5,5),np.uint8))>0
b,g,r=[source[:,:,i].astype(float) for i in range(3)]
blue=(b>r*1.45)&(b>g*1.20)&(b>25)
gc[sure&~blue]=cv2.GC_FGD
gc[expanded&blue]=cv2.GC_PR_BGD
# Deep blue rock and boat paint is real material; bright sky alone is backing.
gc[:340][sure[:340]&(b[:340]<58)]=cv2.GC_FGD
gc[:326][blue[:326]&(b[:326]>65)]=cv2.GC_BGD
boat_seed=np.zeros((height,width),np.uint8)
cv2.fillPoly(boat_seed,[np.array(polygons[0],np.int32)],255)
gc[(boat_seed>0)&(b<65)]=cv2.GC_FGD
cv2.grabCut(source,gc,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
alpha=np.where((gc==cv2.GC_FGD)|(gc==cv2.GC_PR_FGD),255,0).astype(np.uint8)
# The moonlit blue paint of timber overlaps the sea's color distribution.
# Use traced structure here, not a chroma key that would eat the blue posts.
left_pier=np.zeros((height,width),np.uint8)
cv2.fillPoly(left_pier,[np.array([(975,393),(1168,391),(1168,410),(975,407)],np.int32)],255)
for points,thickness in [
 ([(984,370),(984,420)],11), ([(1019,365),(1019,419)],13),
 ([(1062,371),(1062,421)],8), ([(1086,355),(1086,416)],7),
 ([(1111,351),(1111,421)],20), ([(1142,362),(1142,420)],6),
 ([(1152,351),(1152,423)],11),
 ([(984,375),(1019,373),(1168,360)],4),
 ([(1019,387),(1044,384),(1062,376)],2),
 ([(1119,384),(1141,375),(1152,371)],4)
]: cv2.polylines(left_pier,[np.array(points,np.int32)],False,255,thickness,cv2.LINE_AA)
for x,y,radius in [(984,362,4),(1019,352,4),(1152,348,5)]:
 cv2.circle(left_pier,(x,y),radius,255,-1,cv2.LINE_AA)
for x,y0,y1 in [(984,364,372),(1019,354,368)]: cv2.line(left_pier,(x,y0),(x,y1),255,3,cv2.LINE_AA)
cv2.fillPoly(left_pier,[np.array([(1104,345),(1104,337),(1107,334),(1110,329),(1114,335),(1118,338),(1117,346),(1114,351),(1107,351)],np.int32)],255)
alpha[329:445,970:1165]=left_pier[329:445,970:1165]
alpha=cv2.GaussianBlur(alpha,(3,3),.5)
cv2.imwrite(str(out/'stage-c-pier.png'),np.dstack([source,alpha]))

fill=extended[113:113+height,31:31+width]
# The small boats are rigid matte geometry, too. Continue adjacent water behind
# their narrow footprint so the horizontal surface cannot flatten their masts.
boat_backing=fill.copy()
boat_backing[308:377,750:848]=source[308:377,640:738]
boat_mask=np.zeros((height,width),np.uint8)
cv2.fillPoly(boat_mask,[np.array(polygons[0],np.int32)],255)
boat_mask=cv2.GaussianBlur(cv2.dilate(boat_mask,np.ones((13,13),np.uint8)),(15,15),3).astype(np.float32)/255
fill=np.round(fill*(1-boat_mask[:,:,None])+boat_backing*boat_mask[:,:,None]).astype(np.uint8)
repair=cv2.dilate(alpha,np.ones((15,15),np.uint8))
cv2.fillPoly(repair,[np.array([(965,344),(982,329),(1100,323),(1180,260),(1255,285),(1287,330),(1340,270),(1418,291),(1469,234),(1536,230),(1536,474),(967,452)],np.int32)],255)
repair=cv2.GaussianBlur(repair,(19,19),4).astype(np.float32)/255
water=np.round(source*(1-repair[:,:,None])+fill*repair[:,:,None]).astype(np.uint8)
# Remove the painted celestial disc from the backing. The single world-space
# celestial material owns it; original room painting remains untouched.
no_moon=cv2.imread(str(out/'exterior-nomoon.webp'))
moon=np.zeros((height,width),np.uint8);cv2.circle(moon,(1167,240),46,255,-1)
moon=cv2.GaussianBlur(moon,(19,19),4).astype(np.float32)/255
water=np.round(water*(1-moon[:,:,None])+no_moon*moon[:,:,None]).astype(np.uint8)
cv2.imwrite(str(out/'stage-c-water.webp'),water,[cv2.IMWRITE_WEBP_QUALITY,101])
# The approved source coordinates are inserted exactly; generation cannot
# rescale/repaint them. Only hidden backing and the measured continuation survive.
extended[113:113+height,31:31+width]=water
cv2.imwrite(str(out/'stage-c-extended.webp'),extended,[cv2.IMWRITE_WEBP_QUALITY,101])
provenance={'source':str(source_path),'sourceSha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
 'supportingMaster':str(root/'stage-c-fill-master.png'),'sourceToGenerated':matrix.tolist(),'registrationInliers':int(inliers.sum()),
 'canvas':{'width':1598,'height':1157,'sourceRect':[31,113,1536,1024]},
 'wideSkyBacking':{'source':'exterior-overscan.webp','registration':wide_matrix.tolist(),'inliers':int(wide_inliers.sum()),'usage':'Only missing supporting edge pixels, never the original region'},
 'verifiedSupportRect':[x0,y0,x1,y1],'minimumCoverageAlpha':int(needed.min()),
 'coverage':'coverage.json','generatedPixelsUsed':'Only hidden water under the separate foreground and measured exterior bounds',
 'sourcePreservation':'Original pixels composited at unit scale outside foreground-removal and celestial-removal masks; masters unchanged',
 'derivatives':['stage-c-pier.png','stage-c-water.webp','stage-c-extended.webp']}
(root/'stage-c-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps(provenance,indent=2))
