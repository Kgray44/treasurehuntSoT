
import { expect, test } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { db } from "../../src/lib/db";
import { activateWorkspaceCapability } from "../../src/homeport/workspace-capabilities";
import { authenticateClosure, closureAccount } from "./fixtures/landfall-closure";
import { ensureGenericSoundingLineIsolation } from "./fixtures/sounding-line-isolation";

test.beforeEach(() => {
  if (process.env.SOUNDING_LINE_SUITE_PROFILE !== "generic") throw new Error("OWNED_PROFILE_REQUIRED");
  ensureGenericSoundingLineIsolation();
});
test.afterAll(() => db.$disconnect());

for(const profile of [{id:"desktop",width:1440,height:900},{id:"mobile",width:390,height:844}]) {
  test("Home keeps the heading and primary action visible after a reduced-motion account return · "+profile.id,
    async ({page,context,baseURL})=>{
      const owner=await closureAccount("Synthetic reduced Home transition reviewer");
      await activateWorkspaceCapability(owner.id,"CREATOR");
      await authenticateClosure(context,owner,baseURL!);
      await page.setViewportSize({width:profile.width,height:profile.height});
      await page.emulateMedia({reducedMotion:"reduce"});
      await page.goto("/account/personal-information");
      await expect(page.getByRole("heading",{name:"Personal Information",exact:true})).toBeVisible();
      await page.getByRole("textbox",{name:"Display name",exact:true}).fill("Unsaved motion compatibility draft");
      await expect(page.getByText("Unsaved changes",{exact:true})).toBeVisible();
      const back=page.getByRole("link",{name:"Return to Home",exact:true});
      await back.focus();
      await expect(back).toBeFocused();
      await page.evaluate(()=>{
        type Row={at:number;heading:boolean;action:boolean};
        const scoped=window as Window & { reducedHomeSamples?: Promise<Row[]> };
        scoped.reducedHomeSamples=new Promise(resolve=>{
          const start=performance.now();
          const samples:Row[]=[];
          const visible=(node:Element|undefined)=>{
            if(!node)return false;
            const rect=node.getBoundingClientRect();
            if(!rect.width||!rect.height)return false;
            let opacity=1;
            for(let element:Element|null=node;element;element=element.parentElement){
              const css=getComputedStyle(element);
              if(css.display==="none"||css.visibility!=="visible")return false;
              opacity*=Number(css.opacity);
            }
            return opacity>=.35;
          };
          const tick=()=>{
            const now=performance.now()-start;
            if(location.pathname==="/"){
              const heading=[...document.querySelectorAll("h1,[role=heading]")].find(
                e=>e.textContent?.includes("Choose your role in Voyagewright"));
              const action=[...document.querySelectorAll("a,button")].find(
                e=>e.textContent?.trim()==="Explore Chronicles");
              samples.push({at:now,heading:visible(heading),action:visible(action)});
            }
            if(now<2200)requestAnimationFrame(tick);
            else resolve(samples);
          };
          requestAnimationFrame(tick);
        });
      });
      await back.press("Enter");
      await expect(page).toHaveURL(new URL("/",baseURL!).href);
      const frames=await page.evaluate(()=>(window as Window & {reducedHomeSamples?: Promise<Array<{
        at:number;heading:boolean;action:boolean;
      }>>}).reducedHomeSamples);
      if(!frames?.length)throw new Error("No actual Home compositor samples");
      await expect(page.getByRole("heading",{name:"Choose your role in Voyagewright"})).toBeVisible();
      const first=frames.findIndex(frame=>frame.heading&&frame.action);
      if(first<0)throw new Error("Home never reached visible heading and primary link");
      const gap=frames.findIndex((frame,index)=>index>first&&(!frame.heading||!frame.action));
      const backInView=gap<0?-1:frames.findIndex((frame,index)=>index>gap&&frame.heading&&frame.action);
      const directory="artifacts/sounding-line/journal-906-reduced-home";
      await mkdir(directory,{recursive:true});
      const receipt={workflowRole:"BASELINE_DIAGNOSTIC",productSource:"fc813a4c03a4916c6b0aab346abbb8b1caa8cf38",profile,
        firstVisibleMs:frames[first]!.at,hideMs:gap<0?null:frames[gap]!.at,
        restoredMs:backInView<0?null:frames[backInView]!.at,sampleCount:frames.length,frames};
      await writeFile(directory+"/"+profile.id+".json",JSON.stringify(receipt,null,2)+"\n");
      console.log("JOURNAL_REDUCED_HOME_BASELINE " + JSON.stringify({...receipt,frames:undefined}));
      expect(gap,"The primary Home action and heading should stay visible after their first paint").toBe(-1);
    });
}
