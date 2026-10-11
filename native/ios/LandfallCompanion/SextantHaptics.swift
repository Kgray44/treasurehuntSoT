import Foundation
import CoreHaptics
import UIKit

final class SextantHaptics {
    private var engine:CHHapticEngine?,player:CHHapticPatternPlayer?,owner:String?,expiry:DispatchWorkItem?
    private var last = -1.0,windowStart=0.0,totalOn=0
    var tier:String {
        #if targetEnvironment(simulator)
        return "NONE"
        #else
        return CHHapticEngine.capabilitiesForHardware().supportsHaptics ? "RICH":"NONE"
        #endif
    }
    func execute(_ payload:[String:Any],foreground:Bool,critical:Bool)->[String:Any]{
        func result(_ accepted:Bool,_ tier:String)->[String:Any]{["accepted":accepted,"tier":tier,"physicalOutputConfirmed":false]}
        let now=ProcessInfo.processInfo.systemUptime
        guard foreground,!critical,payload["enabled"] as? Bool==true,payload["reducedSensory"] as? Bool==false,let id=payload["leaseId"] as? String,UUID(uuidString:id) != nil,owner==nil,tier != "NONE",let pattern=payload["pattern"] as? [Int],!pattern.isEmpty,pattern.count<=15,pattern.allSatisfy({(0...200).contains($0)}),now-last>=0.5 else{return result(false,tier)}
        let duration=pattern.reduce(0,+),on=pattern.enumerated().filter{$0.offset%2==0}.reduce(0){$0+$1.element}
        guard duration<=1500,on>0,on<=600 else{return result(false,tier)};if now-windowStart>=60{windowStart=now;totalOn=0};guard totalOn+on<=3000 else{return result(false,tier)}
        var acceptedTier=tier
        do {
            if engine==nil{engine=try CHHapticEngine();engine?.playsHapticsOnly=true}
            try engine?.start();var events=[CHHapticEvent](),at=0.0
            for (index,ms) in pattern.enumerated(){if index%2==0 && ms>0{events.append(CHHapticEvent(eventType:.hapticContinuous,parameters:[CHHapticEventParameter(parameterID:.hapticIntensity,value:0.5),CHHapticEventParameter(parameterID:.hapticSharpness,value:0.5)],relativeTime:at,duration:Double(ms)/1000))};at+=Double(ms)/1000}
            player=try engine?.makePlayer(with:CHHapticPattern(events:events,parameters:[]));try player?.start(atTime:0)
        } catch {
            // A hardware-qualified device may use the system's basic feedback
            // path when rich pattern setup is unavailable; it stays unconfirmed.
            player=nil;engine?.stop(completionHandler:nil);engine=nil
            let basic=UIImpactFeedbackGenerator(style:.light);basic.prepare();basic.impactOccurred();acceptedTier="BASIC"
        }
        owner=id;last=now;totalOn+=on
        let work=DispatchWorkItem{[weak self] in self?.stop(id)};expiry=work;DispatchQueue.main.asyncAfter(deadline:.now()+Double(duration)/1000,execute:work)
        return result(true,acceptedTier)
    }
    func stop(_ id:String){guard owner==id else{return};expiry?.cancel();expiry=nil;try? player?.stop(atTime:0);player=nil;engine?.stop(completionHandler:nil);owner=nil}
    func stopAll(){if let id=owner{stop(id)}}
    deinit{stopAll()}
}
