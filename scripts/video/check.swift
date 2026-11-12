import AVFoundation
let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
let sem = DispatchSemaphore(value: 0)
Task {
  let d = try await asset.load(.duration)
  let t = try await asset.loadTracks(withMediaType: .video).first!
  let size = try await t.load(.naturalSize)
  let fps = try await t.load(.nominalFrameRate)
  let gen = AVAssetImageGenerator(asset: asset)
  gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
  let (img, _) = try await gen.image(at: CMTime(seconds: 12, preferredTimescale: 600))
  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "fotogramma-12s.png") as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, img, nil); CGImageDestinationFinalize(dest)
  print("durata", String(format: "%.1f", d.seconds), "s ·", Int(size.width), "x", Int(size.height), "·", fps, "fps")
  sem.signal()
}
sem.wait()
