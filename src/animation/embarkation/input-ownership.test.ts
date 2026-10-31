import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindArrivalKeyboard } from './input-ownership';

afterEach(() => document.body.replaceChildren());
describe('arrival input ownership', () => {
  it('releases Space and Tab at the interactive boundary while the film still plays', () => {
    document.body.innerHTML = '<main><textarea></textarea><button>Send</button></main>';
    const root = document.querySelector('main')!, beginHold = vi.fn(), cancelHold = vi.fn();
    let owns = true;
    const dispose = bindArrivalKeyboard({root, ownsInput: () => owns, skipAvailable: () => true, beginHold, cancelHold});
    const space = () => new KeyboardEvent('keydown', {code:'Space', bubbles:true, cancelable:true});
    const first = space(); window.dispatchEvent(first); expect(first.defaultPrevented).toBe(true);
    owns = false;
    for (const target of [window, root.querySelector('textarea')!, root.querySelector('button')!]) {
      const e = space(); target.dispatchEvent(e); expect(e.defaultPrevented).toBe(false);
    }
    expect(beginHold).toHaveBeenCalledTimes(1);
    const tab = new KeyboardEvent('keydown', {code:'Tab', bubbles:true, cancelable:true});
    root.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
    dispose(); window.dispatchEvent(space()); expect(beginHold).toHaveBeenCalledTimes(1);
  });
  it('exempts editing/native controls independently of cinematic state and cancels holds', () => {
    document.body.innerHTML = '<main><textarea></textarea><input/><select></select><button>Join</button><div contenteditable="true"><span>text</span></div><div role="textbox"></div></main>';
    const root = document.querySelector('main')!, beginHold = vi.fn(), cancelHold = vi.fn();
    const dispose = bindArrivalKeyboard({root, ownsInput: () => true, skipAvailable: () => true, beginHold, cancelHold});
    for (const target of root.querySelectorAll('*')) {
      const e = new KeyboardEvent('keydown', {code:'Space', bubbles:true, cancelable:true});
      target.dispatchEvent(e); expect(e.defaultPrevented).toBe(false);
    }
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space'}));
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space',repeat:true}));
    expect(beginHold).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new KeyboardEvent('keyup', {code:'Space'}));
    window.dispatchEvent(new Event('blur')); expect(cancelHold).toHaveBeenCalledTimes(2);
    dispose();
  });
});
