export type NormalizedProfileCrop = Readonly<{
  centerX: number;
  centerY: number;
  scale: number;
  rotation: 0 | 90 | 180 | 270;
}>;

export function computeProfileCropWindow(width: number, height: number, aspect: number, crop: NormalizedProfileCrop) {
  const sourceAspect = width / height;
  const baseWidth = sourceAspect >= aspect ? height * aspect : width;
  const baseHeight = sourceAspect >= aspect ? height : width / aspect;
  const cropWidth = Math.max(1, baseWidth / crop.scale);
  const cropHeight = Math.max(1, baseHeight / crop.scale);
  const left = Math.max(0, Math.min(width - cropWidth, crop.centerX * width - cropWidth / 2));
  const top = Math.max(0, Math.min(height - cropHeight, crop.centerY * height - cropHeight / 2));
  const roundedLeft = Math.round(left);
  const roundedTop = Math.round(top);
  return {
    left: roundedLeft,
    top: roundedTop,
    width: Math.min(width - roundedLeft, Math.max(1, Math.round(cropWidth))),
    height: Math.min(height - roundedTop, Math.max(1, Math.round(cropHeight))),
  };
}
