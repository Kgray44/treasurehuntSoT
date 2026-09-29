import { describe, expect, it } from 'vitest';
import { HARBOR_ENVIRONMENT, selectEnvironment, validateLandscapeSet } from './environment-set';
describe('registered environment selection', () => {
  it('uses intentional generic scenery for different unregistered covers, never a required cover texture', () => {
    for(const destinationUrl of ['/chronicle-a.png','/chronicle-b.png','/missing-cover.png']) {
      const selected=selectEnvironment({destinationUrl});
      expect(selected.reason).toBe('unregistered-image-generic-harbor');
      expect(Object.values(selected.set.textures)).not.toContain(destinationUrl);
    }
  });
  it('selects an entire registered texture/calibration family rather than only replacing a cover', () => {
    const set=structuredClone(HARBOR_ENVIRONMENT);
    set.id='test-registered-second-landscape'; set.calibration.width=2048; set.calibration.height=1024;
    set.calibration.depths=[-17000,-9600,-7200,-5200]; set.calibration.moonUV=[.4,.6];
    for(const key of Object.keys(set.textures) as Array<keyof typeof set.textures>)set.textures[key]='/test/'+key+'.png';
    expect(selectEnvironment({environment:set})).toEqual({set,reason:'explicit-registered-set'});
    expect(validateLandscapeSet({...set,geometry:'unimplemented-spherical-world'})).toBe(false);
    delete (set.textures as Partial<typeof set.textures>)['stage-islands'];
    expect(()=>selectEnvironment({environment:set})).toThrow('invalid-environment-registration');
  });
});
