import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { apertureResidualMask } from '../../src/animation/embarkation/aperture-mask.ts';
const source='public/images/muster/lantern-room.png';
const aperture='public/images/embarkation/derived/room-aperture.png';
const output='public/images/embarkation/derived/room-reconciliation-mask.png';
const rgb=await sharp(source).removeAlpha().raw().toBuffer({resolveWithObject:true});
const hole=await sharp(aperture).greyscale().raw().toBuffer();
const {width,height}=rgb.info, data=Buffer.alloc(width*height);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const i=y*width+x;
 data[i]=Math.round(255*apertureResidualMask(rgb.data[i*3],rgb.data[i*3+2],x/width,y/height,hole[i]/255));
}
await sharp(data,{raw:{width,height,channels:1}}).png().toFile(output);
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const samplePoints=[[950,150,'sky'],[950,345,'water'],[1080,295,'island'],[1167,240,'moon'],[660,250,'timber'],[380,80,'lantern'],[400,700,'cushion']];
await writeFile('Development_Docs/Projects/Voyagewright_Refit_V1/embarkation/audit-aperture-mask.json',JSON.stringify({
 classification:'engineering-evidence',finding:'EMB-AUD-11',domain:'R8 linear data mask derived from original encoded 8-bit art; not color managed',
 source,sourceSha256:await hash(source),aperture,apertureSha256:await hash(aperture),output,sha256:await hash(output),
 coolThresholdBytes:[8,32],samples:samplePoints.map(([x,y,label])=>({x,y,label,original:[...rgb.data.subarray((y*width+x)*3,(y*width+x)*3+3)],aperture:hole[y*width+x],mask:data[y*width+x]})),
 filmReview:'Pending same-revision full threshold screening; pixel classification alone does not qualify the edit.'
},null,2)+'\n');
console.log('Derived immutable artwork classification mask; source art unchanged.');
