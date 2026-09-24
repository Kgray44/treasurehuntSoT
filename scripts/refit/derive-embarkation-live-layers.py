"""Extract independent lamp/rope and flame RGBA layers from approved pixels."""
import json
from pathlib import Path
import cv2
import numpy as np

out=Path('public/images/embarkation/derived')
src=cv2.imread('public/images/muster/lantern-room.png')
h,w=src.shape[:2]
masks=cv2.imread(str(out/'room-living-masks.png'))
flame=masks[:,:,1].copy()
polygons=[
 [[368,0],[449,0],[449,13],[458,22],[458,32],[452,40],[454,113],[465,127],[466,140],[439,148],[416,150],[412,158],[398,158],[394,151],[362,147],[349,139],[349,128],[358,118],[357,43],[349,36],[349,25],[362,16]],
 [[300,151],[306,151],[306,160],[315,166],[319,174],[324,183],[322,192],[320,220],[327,225],[324,231],[306,234],[280,230],[277,225],[283,219],[283,190],[279,185],[284,180],[292,175],[295,166]],
 [[733,91],[740,91],[742,106],[750,110],[751,117],[760,123],[765,132],[771,137],[768,143],[763,144],[762,184],[771,190],[769,199],[747,204],[719,202],[707,195],[711,188],[715,185],[714,143],[706,139],[711,131],[724,122],[729,113]],
 [[1085,105],[1095,105],[1099,114],[1105,116],[1112,128],[1118,132],[1128,138],[1133,146],[1127,152],[1121,153],[1118,195],[1130,201],[1128,211],[1103,218],[1070,217],[1049,210],[1046,204],[1054,197],[1060,194],[1058,150],[1048,149],[1046,144],[1054,137],[1070,131],[1078,118]],
 [[514,297],[522,298],[525,309],[532,318],[533,322],[544,329],[546,336],[541,340],[539,373],[545,377],[543,385],[528,389],[504,389],[490,384],[488,378],[495,373],[495,339],[489,336],[491,329],[505,319],[510,309]],
]
props=np.zeros((h,w),np.uint8)
for polygon in polygons:cv2.fillPoly(props,[np.array(polygon,np.int32)],255)
# These are the actual slender hanging connections, not unrelated room ropes.
for line in [[(300,151),(304,143),(310,128),(315,112)],[(735,91),(738,79),(742,64)],[(1090,105),(1086,91),(1088,67)]]:
 cv2.polylines(props,[np.array(line,np.int32)],False,255,3,cv2.LINE_AA)
props=cv2.GaussianBlur(props,(3,3),.4)
# Flame-free lamp housings are independent alpha material. Inpaint only tiny
# flame interiors; full static background reconstruction is the saved artwork
# derivative already screened with the original ambient implementation.
flameBinary=np.where(flame>9,255,0).astype(np.uint8)
noFlames=cv2.inpaint(src,cv2.dilate(flameBinary,np.ones((3,3),np.uint8)),3,cv2.INPAINT_TELEA)
cv2.imwrite(str(out/'room-live-props.png'),np.dstack([noFlames,props]))
cv2.imwrite(str(out/'room-live-flames.png'),np.dstack([src,flame]))
back=cv2.imread('.runtime/embarkation/room-live-backing.png')
back=cv2.resize(back,(w,h))
union=np.maximum(props,flame).astype(np.float32)/255
static=(src*(1-union[:,:,None])+back*union[:,:,None]).astype(np.uint8)
cv2.imwrite(str(out/'room-static.webp'),static,[cv2.IMWRITE_WEBP_QUALITY,98])
masks[:,:,2]=props
cv2.imwrite(str(out/'room-living-masks.png'),masks)
Path('.runtime/embarkation/delta2/live-layers-provenance.json').write_text(json.dumps({
 'source':'public/images/muster/lantern-room.png','lampContours':polygons,
 'method':'Original pixels isolated as two RGBA materials; flame-free housing inpaint confined to flame masks; static backing composite limited to extracted silhouettes.',
 'derivatives':['room-live-props.png','room-live-flames.png','room-static.webp','room-living-masks.png']
},indent=2))
print('Extracted original lamp/rope pixels and wick-pinned flame pixels onto independent transparent layers.')
