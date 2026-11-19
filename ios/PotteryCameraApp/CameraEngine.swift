import AVFoundation
import Foundation
import PotteryCameraCore

struct CameraSnapshot: Sendable {
    var token: Int
    var emittedAtUptime = ProcessInfo.processInfo.systemUptime
    var running = false
    var message: String
    var markers: [Marker] = []
    var markerStatus: MarkerTrackingStatus = .searching
    var width = 0
    var height = 0
    var processedFrames = 0
    var droppedFrames = 0
    var elapsedSeconds = 0.0
    var processingMs = 0.0
    var frameAgeMs: Double? = nil
    var controlsLocked = false
}

/// All capture configuration, detection, and teardown is serialized on one queue.
/// AVFoundation drops late frames instead of building an unbounded work queue.
final class CameraEngine: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate, @unchecked Sendable {
    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "org.potterycoach.camera", qos: .userInitiated)
    private let update: @Sendable (CameraSnapshot) -> Void
    private var device: AVCaptureDevice?
    private var detector: MarkerDetector?
    private var tracker = BoardTracker()
    private var output: AVCaptureVideoDataOutput?
    private var observers: [NSObjectProtocol] = []
    private var token = 0
    private var desired = false
    private var lastFrame = -Double.infinity
    private var startedAt = 0.0
    private var processedFrames = 0
    private var droppedFrames = 0
    private var controlsLocked = false

    init(update: @escaping @Sendable (CameraSnapshot) -> Void) {
        self.update = update
        super.init()
        for name in [AVCaptureSession.wasInterruptedNotification, AVCaptureSession.runtimeErrorNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: session, queue: nil) { [weak self] _ in
                guard let self else { return }
                self.queue.async { self.stopInternal(message: "Camera interrupted. Tap Start to reacquire markers.") }
            })
        }
    }
    deinit { observers.forEach(NotificationCenter.default.removeObserver) }

    func start(token: Int) {
        queue.async {
            self.token = token
            self.desired = true
            self.tracker.reset()
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: self.configureAndStart(token: token)
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { granted in
                    self.queue.async {
                        guard self.desired, self.token == token else { return }
                        if granted { self.configureAndStart(token: token) }
                        else { self.stopInternal(message: "Camera permission denied. Enable Camera in Settings to retry.") }
                    }
                }
            default: self.stopInternal(message: "Camera permission unavailable. Check this app’s Camera access in Settings.")
            }
        }
    }
    func stop(token: Int, message: String) {
        queue.async { self.token = token; self.stopInternal(message: message) }
    }
    func setControlsLocked(_ locked: Bool) {
        queue.async {
            guard self.desired, self.session.isRunning, let device = self.device else { return }
            do {
                try device.lockForConfiguration()
                defer { device.unlockForConfiguration() }
                let focus: AVCaptureDevice.FocusMode = locked ? .locked : .continuousAutoFocus
                let exposure: AVCaptureDevice.ExposureMode = locked ? .locked : .continuousAutoExposure
                guard device.isFocusModeSupported(focus), device.isExposureModeSupported(exposure) else {
                    self.update(CameraSnapshot(token: self.token, running: true, message: "Focus/exposure lock is unavailable on this camera."))
                    return
                }
                device.focusMode = focus
                device.exposureMode = exposure
                self.controlsLocked = locked
                self.tracker.reset()
            } catch {
                self.update(CameraSnapshot(token: self.token, running: true, message: "Could not change camera controls. Marker lock reset."))
                self.tracker.reset()
            }
        }
    }
    private func configureAndStart(token: Int) {
        guard desired, self.token == token else { return }
        guard let detector = MarkerDetector() else { stopInternal(message: "Local marker detector could not initialize."); return }
        self.detector = detector
        session.beginConfiguration()
        session.inputs.forEach(session.removeInput)
        session.outputs.forEach(session.removeOutput)
        session.sessionPreset = .hd1280x720
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else {
            session.commitConfiguration()
            stopInternal(message: "No rear camera is available. Simulator cannot validate real capture.")
            return
        }
        session.addInput(input)
        let video = AVCaptureVideoDataOutput()
        video.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
        video.alwaysDiscardsLateVideoFrames = true
        video.setSampleBufferDelegate(self, queue: queue)
        guard session.canAddOutput(video) else {
            session.commitConfiguration(); stopInternal(message: "Camera output is unavailable."); return
        }
        session.addOutput(video)
        if let connection = video.connection(with: .video), connection.isVideoOrientationSupported {
            connection.videoOrientation = .landscapeRight
        }
        session.commitConfiguration()
        device = camera
        output = video
        controlsLocked = false
        if let _ = try? camera.lockForConfiguration() {
            if camera.isFocusModeSupported(.continuousAutoFocus) { camera.focusMode = .continuousAutoFocus }
            if camera.isExposureModeSupported(.continuousAutoExposure) { camera.exposureMode = .continuousAutoExposure }
            camera.unlockForConfiguration()
        }
        processedFrames = 0; droppedFrames = 0; lastFrame = -.infinity
        startedAt = ProcessInfo.processInfo.systemUptime
        tracker.reset()
        session.startRunning()
        guard session.isRunning else { stopInternal(message: "Camera failed to start. Tap Start to retry."); return }
        update(CameraSnapshot(token: token, running: true, message: "Place board-v1 flat and show all four markers."))
    }
    private func stopInternal(message: String) {
        desired = false
        output?.setSampleBufferDelegate(nil, queue: nil)
        if session.isRunning { session.stopRunning() }
        session.beginConfiguration()
        session.inputs.forEach(session.removeInput)
        session.outputs.forEach(session.removeOutput)
        session.commitConfiguration()
        device = nil; output = nil; detector = nil
        tracker.reset()
        update(CameraSnapshot(token: token, message: message))
    }

    func captureOutput(_ output: AVCaptureOutput, didDrop sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard desired, output === self.output else { return }
        droppedFrames += 1
    }
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard desired, output === self.output, let detector, let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let now = ProcessInfo.processInfo.systemUptime
        guard now - lastFrame >= 0.1 else { return }
        lastFrame = now
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        guard CVPixelBufferGetPlaneCount(pixelBuffer) > 0, let base = CVPixelBufferGetBaseAddressOfPlane(pixelBuffer, 0) else { return }
        let sourceWidth = CVPixelBufferGetWidthOfPlane(pixelBuffer, 0)
        let sourceHeight = CVPixelBufferGetHeightOfPlane(pixelBuffer, 0)
        let stride = CVPixelBufferGetBytesPerRowOfPlane(pixelBuffer, 0)
        guard sourceWidth > 0, sourceHeight > 0 else { return }
        let width = min(640, sourceWidth)
        let height = max(1, sourceHeight * width / sourceWidth)
        let bytes = base.assumingMemoryBound(to: UInt8.self)
        var gray = [UInt8](repeating: 0, count: width * height)
        for y in 0..<height {
            let sourceY = y * sourceHeight / height
            for x in 0..<width { gray[y * width + x] = bytes[sourceY * stride + x * sourceWidth / width] }
        }
        let markers = detector.detect(grayscale: gray, width: width, height: height)
        let status = tracker.observe(markers, at: now)
        processedFrames += 1
        let finish = ProcessInfo.processInfo.systemUptime
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        // Capture PTS uses the session synchronization clock, not an assumed host clock.
        let age = session.synchronizationClock.map { clock in
            CMTimeGetSeconds(CMTimeSubtract(CMClockGetTime(clock), timestamp)) * 1000
        }
        update(CameraSnapshot(token: token, running: true,
                              message: "Detection only. Physical calibration and clay measurements are not enabled.",
                              markers: markers, markerStatus: status, width: width, height: height,
                              processedFrames: processedFrames, droppedFrames: droppedFrames,
                              elapsedSeconds: finish - startedAt, processingMs: (finish - now) * 1000,
                              frameAgeMs: age.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }, controlsLocked: controlsLocked))
    }
}
