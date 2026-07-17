import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;

/// AI photo quality scoring — pure Dart implementation.
/// In production, delegates to Rust ai_engine via flutter_rust_bridge.
class AiScorer {
  /// Score all quality metrics for a photo file.
  static Future<AiScores> scorePhoto(String filePath) {
    return compute(_scoreIsolate, filePath);
  }

  /// Batch score multiple photos.
  static Future<Map<String, AiScores>> scoreBatch(List<String> filePaths) async {
    final results = <String, AiScores>{};
    // Process in parallel batches of 4
    for (var i = 0; i < filePaths.length; i += 4) {
      final batch = filePaths.sublist(i, min(i + 4, filePaths.length));
      final batchResults = await Future.wait(batch.map((p) async {
        final scores = await scorePhoto(p);
        return MapEntry(p, scores);
      }));
      for (final entry in batchResults) {
        results[entry.key] = entry.value;
      }
    }
    return results;
  }

  // ─── Isolate entry point ────────────────────────────────

  static AiScores _scoreIsolate(String filePath) {
    final bytes = File(filePath).readAsBytesSync();
    final image = img.decodeImage(bytes);
    if (image == null) {
      return AiScores(
        sharpness: 0,
        exposure: 0,
        composition: 0,
        colorQuality: 0,
        overall: 0,
      );
    }

    // Downscale for analysis (max 800px on longest side)
    final analysis = _downscale(image, 800);

    final sharpness = _computeSharpness(analysis);
    final exposure = _computeExposure(analysis);
    final composition = _computeComposition(analysis);
    final colorQuality = _computeColorQuality(analysis);

    // Weighted overall: sharpness 35%, exposure 25%, composition 25%, color 15%
    final overall = (sharpness * 0.35 + exposure * 0.25 + composition * 0.25 + colorQuality * 0.15).round();

    return AiScores(
      sharpness: sharpness,
      exposure: exposure,
      composition: composition,
      colorQuality: colorQuality,
      overall: overall,
    );
  }

  // ─── Sharpness (Laplacian variance) ─────────────────────

  static int _computeSharpness(img.Image image) {
    final gray = _toGrayscale(image);
    final w = gray.width;
    final h = gray.height;
    if (w < 3 || h < 3) return 50;

    // Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
    var sumSquared = 0.0;
    var count = 0;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        final center = gray.getPixel(x, y).r.toDouble();
        final top = gray.getPixel(x, y - 1).r.toDouble();
        final bottom = gray.getPixel(x, y + 1).r.toDouble();
        final left = gray.getPixel(x - 1, y).r.toDouble();
        final right = gray.getPixel(x + 1, y).r.toDouble();

        final laplacian = top + bottom + left + right - 4 * center;
        sumSquared += laplacian * laplacian;
        count++;
      }
    }

    if (count == 0) return 50;
    final variance = sumSquared / count;

    // Map variance to 0-100 scale
    // Typical range: 0 (blurry) to 500+ (very sharp)
    // Use log scale for better distribution
    if (variance <= 0) return 0;
    final normalized = (log(variance) / log(500)) * 100;
    return normalized.clamp(0, 100).round();
  }

  // ─── Exposure quality ──────────────────────────────────

  static int _computeExposure(img.Image image) {
    // Build luminance histogram
    final histogram = List.filled(256, 0);
    final totalPixels = image.width * image.height;

    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b).round().clamp(0, 255);
        histogram[lum]++;
      }
    }

    // Check clipping (over/underexposed)
    final shadowClip = histogram[0] + histogram[1] + histogram[2];
    final highlightClip = histogram[253] + histogram[254] + histogram[255];
    final clipRatio = (shadowClip + highlightClip) / totalPixels;

    // Check histogram spread
    var minBin = 255, maxBin = 0;
    for (var i = 0; i < 256; i++) {
      if (histogram[i] > totalPixels * 0.001) {
        if (i < minBin) minBin = i;
        if (i > maxBin) maxBin = i;
      }
    }
    final spread = (maxBin - minBin) / 255.0;

    // Check mean luminance (should be around 128 for well-exposed)
    var meanLum = 0.0;
    for (var i = 0; i < 256; i++) {
      meanLum += i * histogram[i];
    }
    meanLum /= totalPixels;
    final meanDeviation = (meanLum - 128).abs() / 128.0;

    // Score: penalize clipping, reward good spread and mean
    var score = 100.0;
    score -= clipRatio * 200; // Heavy penalty for clipping
    score -= (1 - spread) * 30; // Penalty for narrow histogram
    score -= meanDeviation * 30; // Penalty for off-center mean

    return score.clamp(0, 100).round();
  }

  // ─── Composition (rule of thirds) ──────────────────────

  static int _computeComposition(img.Image image) {
    final w = image.width;
    final h = image.height;
    if (w < 10 || h < 10) return 50;

    // Divide into 3x3 grid
    final gridW = w ~/ 3;
    final gridH = h ~/ 3;
    final gridLuminance = List.filled(9, 0.0);
    final gridCount = List.filled(9, 0);

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final p = image.getPixel(x, y);
        final lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
        final gx = (x / gridW).floor().clamp(0, 2);
        final gy = (y / gridH).floor().clamp(0, 2);
        final idx = gy * 3 + gx;
        gridLuminance[idx] += lum;
        gridCount[idx]++;
      }
    }

    // Average luminance per grid cell
    for (var i = 0; i < 9; i++) {
      if (gridCount[i] > 0) gridLuminance[i] /= gridCount[i];
    }

    // Rule of thirds: check if there's contrast variation at intersection points
    // The 4 intersection points should have notable differences from neighbors
    var thirdsScore = 0.0;
    final intersections = [
      [1, 1], [1, 2], [2, 1], [2, 2]
    ];

    for (final ix in intersections) {
      final center = gridLuminance[ix[1] * 3 + ix[0]];
      var localContrast = 0.0;
      var neighbors = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          final nx = ix[0] + dx;
          final ny = ix[1] + dy;
          if (nx >= 0 && nx < 3 && ny >= 0 && ny < 3) {
            localContrast += (center - gridLuminance[ny * 3 + nx]).abs();
            neighbors++;
          }
        }
      }
      if (neighbors > 0) localContrast /= neighbors;
      thirdsScore += localContrast;
    }
    thirdsScore /= 4;

    // Symmetry score (lower is more symmetric — penalize slight asymmetry)
    final leftRight = gridLuminance[0] + gridLuminance[3] + gridLuminance[6];
    final rightLeft = gridLuminance[2] + gridLuminance[5] + gridLuminance[8];
    final symmetry = 1 - (leftRight - rightLeft).abs() / max(leftRight, rightLeft);

    // Lead room: check if subject (brightest area) is centered or has room
    var brightestIdx = 0;
    var brightestLum = 0.0;
    for (var i = 0; i < 9; i++) {
      if (gridLuminance[i] > brightestLum) {
        brightestLum = gridLuminance[i];
        brightestIdx = i;
      }
    }
    final subjectX = brightestIdx % 3;
    final leadRoomScore = subjectX == 1 ? 1.0 : (subjectX == 0 || subjectX == 2) ? 0.8 : 0.6;

    // Combine scores
    final composition = (thirdsScore * 0.4 + symmetry * 0.3 + leadRoomScore * 0.3) * 100;
    return composition.clamp(0, 100).round();
  }

  // ─── Color quality ─────────────────────────────────────

  static int _computeColorQuality(img.Image image) {
    var totalSat = 0.0;
    var totalVibrance = 0.0;
    var pixelCount = 0;
    final saturationBins = List.filled(100, 0);

    for (var y = 0; y < image.height; y += 2) { // Sample every other pixel
      for (var x = 0; x < image.width; x += 2) {
        final p = image.getPixel(x, y);
        final r = p.r / 255.0;
        final g = p.g / 255.0;
        final b = p.b / 255.0;
        final maxC = max(r, max(g, b));
        final minC = min(r, min(g, b));
        final sat = maxC == 0 ? 0.0 : (maxC - minC) / maxC;
        totalSat += sat;
        final bin = (sat * 99).floor().clamp(0, 99);
        saturationBins[bin]++;
        pixelCount++;
      }
    }

    if (pixelCount == 0) return 50;
    final avgSat = totalSat / pixelCount;

    // Check saturation distribution — good photos have a range of saturation
    var usedBins = 0;
    for (final count in saturationBins) {
      if (count > pixelCount * 0.01) usedBins++;
    }

    // Good color quality: moderate saturation, diverse range
    var score = 0.0;
    score += (1 - (avgSat - 0.3).abs() / 0.7) * 50; // Best at ~0.3 avg sat
    score += (usedBins / 100) * 50; // Reward diverse saturation

    return score.clamp(0, 100).round();
  }

  // ─── Helpers ───────────────────────────────────────────

  static img.Image _downscale(img.Image source, int maxSize) {
    if (source.width <= maxSize && source.height <= maxSize) return source;
    final scale = maxSize / max(source.width, source.height);
    return img.copyResize(source,
      width: (source.width * scale).round(),
      height: (source.height * scale).round(),
      interpolation: img.Interpolation.linear,
    );
  }

  static img.Image _toGrayscale(img.Image image) {
    final gray = img.Image(width: image.width, height: image.height);
    for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b).round().clamp(0, 255);
        gray.setPixelRgba(x, y, lum, lum, lum, p.a.toInt());
      }
    }
    return gray;
  }
}

/// AI scoring results for a photo
class AiScores {
  final int sharpness;
  final int exposure;
  final int composition;
  final int colorQuality;
  final int overall;

  const AiScores({
    required this.sharpness,
    required this.exposure,
    required this.composition,
    required this.colorQuality,
    required this.overall,
  });

  /// Color for a score value (0-100)
  static int scoreColorHex(int score) {
    if (score >= 80) return 0xFF4CAF50; // Green
    if (score >= 60) return 0xFFFFC107; // Gold
    if (score >= 40) return 0xFFFF9800; // Orange
    return 0xFFF44336; // Red
  }
}
