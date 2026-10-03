import SwiftUI
import WebKit

final class LandfallDelegate: NSObject, UIApplicationDelegate {
    // Construct even for an OS region/notification wake without a foreground scene.
    let companion = LandfallCompanion()
}

@main
struct LandfallApp: App {
    @UIApplicationDelegateAdaptor(LandfallDelegate.self) private var delegate
    var body: some Scene {
        WindowGroup {
            if delegate.companion.origin != nil {
                LandfallWebView(companion: delegate.companion).ignoresSafeArea(.container, edges: .bottom)
            } else {
                Text("Landfall companion is not configured. Build with your VoyageWright HTTPS origin.").padding()
            }
        }
    }
}

struct LandfallWebView: UIViewRepresentable {
    let companion: LandfallCompanion
    func makeUIView(context: Context) -> WKWebView { companion.makeWebView() }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
