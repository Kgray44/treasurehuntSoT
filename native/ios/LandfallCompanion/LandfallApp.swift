import SwiftUI
import WebKit

@main
struct LandfallApp: App {
    @StateObject private var companion = LandfallCompanion()
    var body: some Scene {
        WindowGroup {
            if companion.origin != nil {
                LandfallWebView(companion: companion).ignoresSafeArea(.container, edges: .bottom)
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
