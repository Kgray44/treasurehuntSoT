import { resolveLegacyCampaign } from "../../src/compatibility/legacy-companion";
import { PAGE_TURN_LIFECYCLE_BROWSER_EVENT } from "../../src/components/animation/PageFlipBook";
import { PHASE3_MOTION_MODES, expect, phase3Test, setPhase3Motion } from "./fixtures/lanternwake-phase3";

type SoundReceipt = { contexts: number; played: number; ended: number; settledTurns: number; failures: number };
type DiagnosticWindow = Window & { pageTurnCueDiagnostic: SoundReceipt };

for (const muted of [false,true]) {
  phase3Test(`the existing page-turn cue preserves the player's mute preference (${muted})`, async ({page,phase3})=>{
    await page.addInitScript(({muted,eventName})=>{
      localStorage.setItem("forever-muted",String(muted));
      const receipt:SoundReceipt={contexts:0,played:0,ended:0,settledTurns:0,failures:0};
      (window as unknown as DiagnosticWindow).pageTurnCueDiagnostic=receipt;
      const OriginalContext=window.AudioContext;
      if(OriginalContext) window.AudioContext=new Proxy(OriginalContext,{construct(target,args,newTarget){
        receipt.contexts++;
        return Reflect.construct(target,args,newTarget);
      }});
      const originalPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){
        const playable=Reflect.apply(originalPlay,this,[]) as Promise<void>;
        if(!new URL(this.currentSrc||this.src||location.href).pathname.endsWith("/sounds/journal-page-turn.wav")) return playable;
        this.addEventListener("ended",()=>receipt.ended++,{once:true});
        return playable.then(()=>{receipt.played++;},(error:unknown)=>{receipt.failures++;throw error;});
      };
      document.addEventListener(eventName,(event)=>{
        if((event as CustomEvent<{phase:string}>).detail?.phase==="settle")receipt.settledTurns++;
      },true);
    },{muted,eventName:PAGE_TURN_LIFECYCLE_BROWSER_EVENT});
    const receipt=()=>page.evaluate(()=>(window as unknown as DiagnosticWindow).pageTurnCueDiagnostic);
    await setPhase3Motion(page,PHASE3_MOTION_MODES[0]);
    await phase3.proveIsolation();
    const fixture=await phase3.createCase(muted?"P3-JOURNAL-CUE-MUTED":"P3-JOURNAL-CUE-ACTIVE","CHAPTER_RELEASED");
    const voyage=await resolveLegacyCampaign(fixture.slug);
    expect(voyage).toBeTruthy();
    const access=await page.request.post("/api/player/access",{data:{campaignSlug:fixture.slug,accessCode:fixture.accessCode}});
    expect(access.ok()).toBe(true);
    await page.goto("/player/playthroughs/"+voyage!.sessionId+"/journal");
    await page.getByRole("button",{name:"Open the journal"}).click();
    await expect(page.locator(".chronicle-journal-shell")).toHaveAttribute("data-journal-ready-reason","completed",{timeout:20_000});
    expect((await receipt()).contexts).toBe(0);
    expect((await receipt()).played).toBe(0);
    const before=(await receipt()).settledTurns;
    await page.getByRole("button",{name:"Next journal page"}).click();
    await expect.poll(async()=>(await receipt()).settledTurns).toBe(before+1);
    if(!muted) {
      await expect.poll(async()=>(await receipt()).played).toBe(1);
      await expect.poll(async()=>(await receipt()).ended).toBe(1);
    }
    const sound=await receipt();
    expect(sound.played).toBe(muted?0:1);
    expect(sound.failures).toBe(0);
    expect(sound.contexts).toBe(0);
    console.log("JOURNAL_CUE_RECEIPT "+JSON.stringify({muted,...sound}));
  });
}
