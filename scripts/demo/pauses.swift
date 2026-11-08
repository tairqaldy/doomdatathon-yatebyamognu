// Voiceover → block lengths for the short demo cut. AVFoundation only, no ffmpeg.
//   swift scripts/demo/pauses.swift voice.m4a [--blocks 8] [--min 0.35] [--thr -45] > /tmp/t.json
// Reads the audio as 16 kHz mono, measures loudness in 10 ms windows, finds the (blocks − 1) longest pauses
// (silence ≥ --min seconds below a threshold set between the noise floor and the speech level, or --thr dB),
// cuts each pause in the middle and prints JSON for `record.mjs --timings`:
//   {"blocks":[4.1,6.8,…],"total":57.2,"threshold_db":-46.3,"pauses":[{"start":4.0,"end":4.9},…]}
// Leading and trailing silence stays in the first and last block. Read the blocks with a clear pause (~1 s)
// between them and shorter pauses inside them. A human summary goes to stderr.
import AVFoundation
import Foundation

func fail(_ s: String) -> Never { fputs("pauses.swift: \(s)\n", stderr); exit(1) }
var args = Array(CommandLine.arguments.dropFirst())
func flag(_ name: String) -> Double? {
  guard let i = args.firstIndex(of: "--\(name)"), i + 1 < args.count, let v = Double(args[i + 1]) else { return nil }
  args.removeSubrange(i...(i + 1)); return v
}
let nBlocks = Int(flag("blocks") ?? 8)
let minPause = flag("min") ?? 0.35
let thrOverride = flag("thr")
guard let file = args.first else { fputs("usage: swift pauses.swift <voice.m4a> [--blocks 8] [--min 0.35] [--thr dB]\n", stderr); exit(2) }

/* ── decode to 16 kHz mono float ── */
let rate = 16000.0
let asset = AVURLAsset(url: URL(fileURLWithPath: file))
guard let track = try? await asset.loadTracks(withMediaType: .audio).first else { fail("no audio track in \(file)") }
let reader: AVAssetReader
do { reader = try AVAssetReader(asset: asset) } catch { fail("cannot read \(file): \(error)") }
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
  AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true,
  AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false, AVSampleRateKey: rate, AVNumberOfChannelsKey: 1,
])
reader.add(output)
guard reader.startReading() else { fail("startReading: \(String(describing: reader.error))") }
var samples: [Float] = []
while let sb = output.copyNextSampleBuffer() {
  guard let bb = CMSampleBufferGetDataBuffer(sb) else { continue }
  let n = CMBlockBufferGetDataLength(bb) / MemoryLayout<Float>.size
  var chunk = [Float](repeating: 0, count: n)
  chunk.withUnsafeMutableBytes { _ = CMBlockBufferCopyDataBytes(bb, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!) }
  samples += chunk
}
guard reader.status == .completed, !samples.isEmpty else { fail("decode failed: \(String(describing: reader.error))") }
let total = Double(samples.count) / rate

/* ── loudness per 10 ms window ── */
let win = Int(rate / 100)
let db: [Double] = stride(from: 0, to: samples.count, by: win).map { s in
  let e = min(samples.count, s + win); var acc = 0.0
  for i in s..<e { acc += Double(samples[i]) * Double(samples[i]) }
  return 20 * log10(max(sqrt(acc / Double(e - s)), 1e-6))
}
let sorted = db.sorted()
let pct = { (p: Double) in sorted[min(sorted.count - 1, Int(Double(sorted.count) * p))] }
let floorDb = max(pct(0.10), -75), speechDb = pct(0.95)
let thr = thrOverride ?? min(speechDb - 18, floorDb + 0.35 * (speechDb - floorDb))

/* ── silent runs (bridging clicks/breaths shorter than 60 ms), interior only ── */
var silent = db.map { $0 < thr }
let bridge = 6
var i = 0
while i < silent.count {
  if silent[i] { i += 1; continue }
  var j = i; while j < silent.count && !silent[j] { j += 1 }
  if i > 0 && j < silent.count && j - i <= bridge { for k in i..<j { silent[k] = true } }
  i = j
}
struct Pause { let start: Double; let end: Double; var len: Double { end - start } }
var pauses: [Pause] = []
i = 0
while i < silent.count {
  if !silent[i] { i += 1; continue }
  var j = i; while j < silent.count && silent[j] { j += 1 }
  let p = Pause(start: Double(i) / 100, end: min(total, Double(j) / 100))
  if i > 0 && j < silent.count && p.len >= minPause { pauses.append(p) }
  i = j
}
let need = nBlocks - 1
guard pauses.count >= need else {
  fail("found \(pauses.count) pauses ≥ \(minPause) s below \(String(format: "%.1f", thr)) dB, need \(need). "
    + "Pause longer between blocks, or try --min 0.25 / --thr \(Int(thr + 6)). Found: "
    + pauses.map { String(format: "%.2f s at %.2f", $0.len, $0.start) }.joined(separator: ", "))
}
let chosen = pauses.sorted { $0.len > $1.len }.prefix(need).sorted { $0.start < $1.start }
func r2(_ x: Double) -> Double { (x * 100).rounded() / 100 }
var cuts: [Double] = [0]
for p in chosen { cuts.append((p.start + p.end) / 2) }
cuts.append(total)
var blocks: [Double] = []
for k in 0..<nBlocks { blocks.append(r2(cuts[k + 1] - cuts[k])) }

let f2 = { (x: Double) in String(format: "%.2f", x) }
let pauseJson = chosen.map { "{\"start\":\(f2($0.start)),\"end\":\(f2($0.end))}" }.joined(separator: ",")
print("{\"blocks\":[\(blocks.map(f2).joined(separator: ","))],\"total\":\(f2(total)),\"threshold_db\":\(f2(thr)),\"pauses\":[\(pauseJson)]}")

let shortest = chosen.map(\.len).min() ?? 0
let nextBest = pauses.sorted { $0.len > $1.len }.dropFirst(need).first?.len ?? 0
fputs(String(format: "%@: %.2f s, threshold %.1f dB (floor %.1f, speech %.1f), %d pauses ≥ %.2f s\n", file, total, thr, floorDb, speechDb, pauses.count, minPause), stderr)
fputs("blocks: " + blocks.map { String(format: "%.2f", $0) }.joined(separator: " · ") + "\n", stderr)
if nextBest > 0 && shortest - nextBest < 0.15 {
  fputs(String(format: "warning: the shortest block pause (%.2f s) is close to the longest pause inside a block (%.2f s); check the blocks\n", shortest, nextBest), stderr)
}
