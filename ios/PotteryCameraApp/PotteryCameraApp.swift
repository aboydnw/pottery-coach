import SwiftUI
import AVFoundation
import PotteryCameraCore

@MainActor
final class CameraModel: ObservableObject {
    @Published var snapshot = CameraSnapshot(token: 0, message: "Camera stays off until you tap Start. No microphone or network connection is used.")
    @Published var starting = false
    private var token = 0
    private var lastUpdate = Date.distantPast
    private var watchdog: Timer?
    private var previousIdleTimerDisabled: Bool?
    lazy var engine = CameraEngine { [weak self] result in
        DispatchQueue.main.async {
            guard let self, result.token == self.token else { return }
            if result.running && (ProcessInfo.processInfo.systemUptime - result.emittedAtUptime > 2 || UIApplication.shared.applicationState != .active) {
                self.stop(message: "Camera view paused or became stale. Tap Start to reacquire markers.")
                return
            }
            self.snapshot = result
            self.setKeepAwake(result.running)
            self.starting = false
            self.lastUpdate = Date()
        }
    }
    init() {
        watchdog = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.snapshot.running, Date().timeIntervalSince(self.lastUpdate) > 2 else { return }
                self.stop(message: "Camera frames stopped. Tap Start to reacquire markers.")
            }
        }
    }
    deinit { watchdog?.invalidate() }
    func start() {
        guard !starting, !snapshot.running else { return }
        token += 1
        starting = true
        snapshot = CameraSnapshot(token: token, message: "Requesting camera access…")
        engine.start(token: token)
    }
    func stop(message: String = "Camera stopped. Marker tracking cleared.") {
        token += 1
        setKeepAwake(false)
        starting = false
        snapshot = CameraSnapshot(token: token, message: message)
        engine.stop(token: token, message: message)
    }
    private func setKeepAwake(_ running: Bool) {
        if running {
            if previousIdleTimerDisabled == nil { previousIdleTimerDisabled = UIApplication.shared.isIdleTimerDisabled }
            UIApplication.shared.isIdleTimerDisabled = true
        } else if let previous = previousIdleTimerDisabled {
            UIApplication.shared.isIdleTimerDisabled = previous
            previousIdleTimerDisabled = nil
        }
    }
}

@main
struct PotteryCameraApp: App {
    var body: some Scene { WindowGroup { CameraScreen() } }
}

struct CameraScreen: View {
    @StateObject private var camera = CameraModel()
    @Environment(\.scenePhase) private var phase
    var body: some View {
        HStack(spacing: 0) {
            ZStack {
                Color.black
                CameraPreview(session: camera.engine.session)
                MarkerOverlay(markers: camera.snapshot.markers, imageWidth: camera.snapshot.width, imageHeight: camera.snapshot.height,
                              stable: camera.snapshot.markerStatus == .stable)
                if !camera.snapshot.running {
                    VStack(spacing: 12) {
                        Image(systemName: "camera.viewfinder").font(.system(size: 44))
                        Text("Private camera preview").font(.headline)
                        Text("Rear camera · landscape · on-device detection").font(.caption)
                    }.foregroundStyle(.white).padding()
                }
            }
            .accessibilityLabel("Camera preview with detected marker outlines")
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Pottery Coach").font(.title2.bold())
                    Text("iPhone camera lab").font(.subheadline).foregroundStyle(.secondary)
                    Text("EXPERIMENTAL · NO MEASUREMENTS").font(.caption.bold()).foregroundStyle(.orange)
                    Text(camera.snapshot.markerStatus.rawValue).font(.headline)
                    Text(camera.snapshot.message).font(.callout)
                    Button(camera.snapshot.running || camera.starting ? "Stop camera" : "Start camera") {
                        if camera.snapshot.running || camera.starting { camera.stop() } else { camera.start() }
                    }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("cameraToggle")
                    if camera.snapshot.running {
                        Button(camera.snapshot.controlsLocked ? "Use auto focus/exposure" : "Lock focus/exposure") {
                            camera.engine.setControlsLocked(!camera.snapshot.controlsLocked)
                        }.buttonStyle(.bordered)
                        Text(String(format: "%.1f processed fps · %.0f ms detection\n%@ frame age · %d late frames dropped",
                                    Double(camera.snapshot.processedFrames) / max(0.001, camera.snapshot.elapsedSeconds),
                                    camera.snapshot.processingMs, camera.snapshot.frameAgeMs.map { String(format: "%.0f ms", $0) } ?? "Unavailable", camera.snapshot.droppedFrames))
                            .font(.caption.monospacedDigit())
                    }
                    Divider()
                    Text("Use the existing board-v1 print at 100%; verify the 100 mm line. Show IDs 0–3 and hold still. Green outlines mean stable detection only, not calibrated size.")
                        .font(.caption)
                    Text("Frames stay in memory on this phone and are discarded. Nothing is recorded, saved, or uploaded. No voice, account, or analytics in this prototype.")
                        .font(.caption).foregroundStyle(.secondary)
                }.padding(20)
            }.frame(width: 300).background(Color(.systemBackground))
        }
        .onChange(of: phase) { _, newPhase in
            if newPhase == .background || (newPhase == .inactive && !camera.starting) {
                camera.stop(message: "Camera paused when the app left the foreground. Tap Start to resume.")
            }
        }
        .onDisappear { camera.stop() }
    }
}

private final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    override func layoutSubviews() {
        super.layoutSubviews()
        if let connection = previewLayer.connection, connection.isVideoOrientationSupported { connection.videoOrientation = .landscapeRight }
    }
}
private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspect
        return view
    }
    func updateUIView(_ uiView: PreviewView, context: Context) { uiView.setNeedsLayout() }
}
private struct MarkerOverlay: View {
    let markers: [Marker]
    let imageWidth: Int
    let imageHeight: Int
    let stable: Bool
    var body: some View {
        GeometryReader { geometry in
            if imageWidth > 0, imageHeight > 0 {
                let scale = min(geometry.size.width / Double(imageWidth), geometry.size.height / Double(imageHeight))
                let width = Double(imageWidth) * scale
                let height = Double(imageHeight) * scale
                let xOffset = (geometry.size.width - width) / 2
                let yOffset = (geometry.size.height - height) / 2
                ForEach(Array(markers.enumerated()), id: \.offset) { _, marker in
                    Path { path in
                        for (index, point) in marker.corners.enumerated() {
                            let position = CGPoint(x: xOffset + point.x * width, y: yOffset + point.y * height)
                            if index == 0 { path.move(to: position) } else { path.addLine(to: position) }
                        }
                        path.closeSubpath()
                    }.stroke(stable ? .green : .yellow, lineWidth: 3)
                }
            }
        }.allowsHitTesting(false).accessibilityHidden(true)
    }
}
