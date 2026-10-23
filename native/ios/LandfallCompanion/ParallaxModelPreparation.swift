import SceneKit
import simd

/// The camera-free portion of the existing AR owner's model preparation.
/// Authored child matrices, geometry and materials stay intact; no recentering or unit guessing.
enum ParallaxModelPreparation {
    static func prototype(from imported: SCNScene) -> SCNNode {
        let prototype = SCNNode()
        imported.rootNode.childNodes.forEach { prototype.addChildNode($0.clone()) }
        prototype.enumerateChildNodes { node, _ in
            node.removeAllAnimations(); node.camera = nil; node.light = nil
        }
        return prototype
    }

    static func modelNode(prototype: SCNNode, widthMeters: Double, sourceWidthMeters: Double) -> SCNNode {
        let node = prototype.clone()
        let sourceScale = Float(widthMeters / sourceWidthMeters)
        node.scale = SCNVector3(sourceScale, sourceScale, sourceScale)
        return node
    }

    static func entityRoot(content: SCNNode, id: String, entityPose: simd_float4x4,
                           anchorFrame: simd_float4x4, scale: Double,
                           opacity: Double, hidden: Bool) -> SCNNode {
        let root = SCNNode(); root.name = id; root.addChildNode(content)
        root.simdTransform = simd_inverse(anchorFrame) * entityPose
        root.scale = SCNVector3(Float(scale), Float(scale), Float(scale))
        root.opacity = opacity; root.isHidden = hidden
        return root
    }
}
