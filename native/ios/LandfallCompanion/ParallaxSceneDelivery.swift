import Foundation
import CoreFoundation

/// A renderer profile over the canonical Scene. The native provider has no story state.
enum ParallaxSceneDelivery {
    static let capabilities = ["WORLD_TRACKING","PLANE_PLACEMENT","MODEL_GLB"]
    static func boolean(_ value: Any?) -> Bool { guard let value=value as? NSNumber else { return false };return CFGetTypeID(value) == CFBooleanGetTypeID() }
    static func valid(_ scene: [String:Any], version: Int, checksum: String?, instanceId: String?) -> Bool {
        guard ParallaxAssetCache.strictInteger(scene["schemaVersion"]) == version, scene["transformKind"] as? String == "RESOLVED_LOCAL_V1",
              scene["coordinateFrame"] as? String == "LOCAL_Y_UP_NEGATIVE_Z", let entities=scene["entities"] as? [[String:Any]] else { return false }
        if version == 1 { return scene.count == 4 && ParallaxSceneTransfer.validEntities(entities) }
        let required=Set(["schemaVersion","transformKind","coordinateFrame","identity","units","entities","anchors","requirements","presentation","fallback"])
        guard version == 2, Set(scene.keys) == required, scene["units"] as? String == "METERS", entities.count <= 32,
              let identity=scene["identity"] as? [String:Any], Set(identity.keys).isSubset(of:Set(["definitionId","versionId","versionChecksum","instanceId","environment"])),
              let definition=identity["definitionId"] as? String, validId(definition), let versionId=identity["versionId"] as? String, validId(versionId),
              let deliveredChecksum=identity["versionChecksum"] as? String, deliveredChecksum == checksum,
              let deliveredInstance=identity["instanceId"] as? String, deliveredInstance == instanceId,
              let requirements=scene["requirements"] as? [String], Set(requirements).count == requirements.count, requirements.allSatisfy({capabilities.contains($0)}),
              let anchors=scene["anchors"] as? [[String:Any]], (1...16).contains(anchors.count),
              let presentation=scene["presentation"] as? [String:Any],Set(presentation.keys).isSubset(of:Set(["elapsedMs","reducedMotion","studio","adaptive"])),let elapsed=presentation["elapsedMs"] as? NSNumber,
              CFGetTypeID(elapsed) != CFBooleanGetTypeID(), elapsed.doubleValue.isFinite, (0...9007199254740991).contains(elapsed.doubleValue), boolean(presentation["reducedMotion"]),
              let fallback=scene["fallback"] as? [String:Any],Set(fallback.keys) == Set(["mode","narrative","preservesMeaning"]), fallback["mode"] as? String == "GUIDED", boolean(fallback["preservesMeaning"]),fallback["preservesMeaning"] as? Bool == true,
              let narrative=fallback["narrative"] as? String, (1...4000).contains(narrative.utf16.count) else { return false }
        if let environment=identity["environment"] {
            guard let environment=environment as? [String:Any],Set(environment.keys) == Set(["environmentId","versionId","revision","checksum"]),
                  let id=environment["environmentId"] as? String,validId(id),let version=environment["versionId"] as? String,
                  version.range(of:"^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$",options:.regularExpression) != nil,
                  let revision=ParallaxAssetCache.strictInteger(environment["revision"]),revision > 0,
                  let digest=environment["checksum"] as? String,digest.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else { return false }
        }
        let anchorIds=anchors.compactMap{$0["id"] as? String}
        guard anchorIds.count == anchors.count, Set(anchorIds).count == anchors.count,
              anchors.allSatisfy({ anchor in
                  guard let id=anchor["id"] as? String, validId(id), let frame=anchor["frameId"] as? String, validId(frame),
                        let kind=anchor["kind"] as? String, ["LOCAL_WORLD","SURFACE_RELATIVE"].contains(kind),
                        let transform=anchor["transform"] as? [String:Any], validAuthoredTransform(transform) else { return false }
                  let keys=Set(["id","kind","frameId","transform"])
                  return kind == "SURFACE_RELATIVE" ? Set(anchor.keys) == keys.union(["alignment"]) && ["HORIZONTAL","VERTICAL"].contains(anchor["alignment"] as? String ?? "") : Set(anchor.keys) == keys
              }) else { return false }
        var ids=Set<String>()
        let fields=Set(["id","kind","content","widthMeters","transform","anchorId","authoredTransform","interactions","visible","selectable","opacity"])
        let optional=Set(["parentEntityId","element","model"])
        for entity in entities {
            let keys=Set(entity.keys)
            var legacy=entity;for key in keys.subtracting(Set(["id","kind","content","widthMeters","transform"])) { legacy.removeValue(forKey:key) }
            guard fields.isSubset(of:keys),keys.isSubset(of:fields.union(optional)), ParallaxSceneTransfer.validEntities([legacy]),
                  let id=entity["id"] as? String, ids.insert(id).inserted,
                  let anchor=entity["anchorId"] as? String, anchorIds.contains(anchor),
                  let authored=entity["authoredTransform"] as? [String:Any], validAuthoredTransform(authored),
                  let interactions=entity["interactions"] as? [String], (1...3).contains(interactions.count), Set(interactions).count == interactions.count, interactions.allSatisfy({["PICK","INSPECT","PLACE"].contains($0)}),
                  boolean(entity["visible"]), boolean(entity["selectable"]), let opacity=entity["opacity"] as? NSNumber,
                  CFGetTypeID(opacity) != CFBooleanGetTypeID(), (0...1).contains(opacity.doubleValue) else { return false }
            if let model=entity["model"] {
                guard let model=model as? [String:Any],let parsed=ParallaxAssetCache.Model.parse(model),requirements.contains("MODEL_GLB"),
                      let components=URLComponents(string:parsed.path),components.queryItems?.first(where:{$0.name == "versionChecksum"})?.value == deliveredChecksum,
                      let element=entity["element"] as? [String:Any],element["kind"] as? String == "PHYSICAL_ASSET",element["modelId"] as? String == parsed.assetId,element["packageVersion"] as? String == parsed.version else { return false }
            }
            if let value=entity["element"] {
                guard let element=value as? [String:Any],boolean(element["enabled"]) else { return false }
                if element["enabled"] as? Bool == true {
                    guard Set(element.keys) == Set(["enabled","kind","modelId","packageVersion","articulation"]),element["kind"] as? String == "PHYSICAL_ASSET",entity["model"] != nil,
                          let articulation=element["articulation"] as? NSNumber, CFGetTypeID(articulation) != CFBooleanGetTypeID(),articulation.doubleValue == 0 else { return false }
                }
            }
        }
        for entity in entities {
            var seen=Set<String>();var current: [String:Any]?=entity
            while let item=current, let id=item["id"] as? String {
                guard seen.insert(id).inserted else { return false }
                guard let parent=item["parentEntityId"] else { break }
                guard let parentId=parent as? String, let found=entities.first(where:{$0["id"] as? String == parentId}), found["anchorId"] as? String == entity["anchorId"] as? String else { return false };current=found
            }
        }
        return true
    }
    static func validId(_ id: String) -> Bool { id.range(of:"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",options:.regularExpression) != nil }
    private static func validTransform(_ transform: [String:Any]) -> Bool {
        let legacy:[String:Any]=["id":"validation","kind":"MARKER","content":"validation","widthMeters":0.1,"transform":transform]
        return ParallaxSceneTransfer.validEntities([legacy])
    }
    private static func validAuthoredTransform(_ transform: [String:Any]) -> Bool {
        guard validTransform(transform),let scale=transform["scale"] as? Double,(0.01...10).contains(scale),
              let position=transform["position"] as? [String:Double],position.values.allSatisfy({abs($0) <= 10000}) else { return false }
        return true
    }
}
