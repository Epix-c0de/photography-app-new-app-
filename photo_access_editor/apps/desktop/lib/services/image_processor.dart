import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:image/image.dart' as img;
import 'package:photo_access_editor/models/models.dart';

/// Pure Dart image processor — applies all adjustments pixel-by-pixel.
/// In production, this delegates to Rust render_engine via flutter_rust_bridge.
class ImageProcessor {
  /// Apply full edit state to an image file, write result to outputPath.
  static Future<String> process({
    required String sourcePath,
    required EditStateModel edits,
    required String outputPath,
    int maxSize = 1024,
  }) async {
    return compute(_processIsolate, _ProcessParams(sourcePath, edits, outputPath, maxSize));
  }

  /// Compute histogram from image file.
  static Future<HistogramData> computeHistogram(String filePath) async {
    return compute(_histogramIsolate, filePath);
  }

  // ─── Isolate entry points ────────────────────────────────

  static String _processIsolate(_ProcessParams p) {
    final bytes = File(p.sourcePath).readAsBytesSync();
    var image = img.decodeImage(bytes);
    if (image == null) return p.sourcePath;

    // Resize for preview
    image = _resize(image, p.maxSize);

    final edits = p.edits;

    // Apply adjustments in order (matching Lightroom pipeline)
    image = _applyExposure(image, edits.exposure);
    image = _applyContrast(image, edits.contrast);
    image = _applyHighlightsShadows(image, edits.highlights, edits.shadows, edits.whites, edits.blacks);
    image = _applyWhiteBalance(image, edits.temperature, edits.tint);
    image = _applyVibrance(image, edits.vibrance);
    image = _applySaturation(image, edits.saturation);
    image = _applyClarityTexture(image, edits.clarity, edits.texture);
    image = _applyDehaze(image, edits.dehaze);
    image = _applyCurves(image, edits.curves);
    image = _applyHsl(image, edits.hsl);
    image = _applyColorGrading(image, edits.colorGrading);
    image = _applyLensCorrections(image, edits.lensCorrections);
    image = _applyCrop(image, edits.crop);

    // Write output
    final outputFile = File(p.outputPath);
    outputFile.parent.createSync(recursive: true);
    outputFile.writeAsBytesSync(img.encodeJpg(image, quality: 92));
    return p.outputPath;
  }

  static HistogramData _histogramIsolate(String filePath) {
    final bytes = File(filePath).readAsBytesSync();
    final image = img.decodeImage(bytes);
    if (image == null) {
      return HistogramData(
        red: List.filled(256, 0), green: List.filled(256, 0),
        blue: List.filled(256, 0), luminance: List.filled(256, 0),
      );
    }

    final resized = _resize(image, 512);
    final r = List<int>.filled(256, 0);
    final g = List<int>.filled(256, 0);
    final b = List<int>.filled(256, 0);
    final l = List<int>.filled(256, 0);

    for (int y = 0; y < resized.height; y++) {
      for (int x = 0; x < resized.width; x++) {
        final pixel = resized.getPixel(x, y);
        final rv = pixel.r.toInt();
        final gv = pixel.g.toInt();
        final bv = pixel.b.toInt();
        r[rv]++;
        g[gv]++;
        b[bv]++;
        final lum = (0.299 * rv + 0.587 * gv + 0.114 * bv).round().clamp(0, 255);
        l[lum]++;
      }
    }

    return HistogramData(
      red: r, green: g, blue: b, luminance: l,
    );
  }

  // ─── Resize ──────────────────────────────────────────────

  static img.Image _resize(img.Image image, int maxSize) {
    if (image.width <= maxSize && image.height <= maxSize) return image;
    return img.copyResize(
      image,
      width: image.width > image.height ? maxSize : null,
      height: image.height >= image.width ? maxSize : null,
      interpolation: img.Interpolation.linear,
    );
  }

  // ─── Exposure ────────────────────────────────────────────

  static img.Image _applyExposure(img.Image image, double exposure) {
    if (exposure == 0) return image;
    final factor = pow(2.0, exposure).toDouble();
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        image.setPixelRgba(
          x, y,
          _clamp((p.r * factor).round()),
          _clamp((p.g * factor).round()),
          _clamp((p.b * factor).round()),
          p.a.toInt(),
        );
      }
    }
    return image;
  }

  // ─── Contrast ────────────────────────────────────────────

  static img.Image _applyContrast(img.Image image, double contrast) {
    if (contrast == 0) return image;
    final factor = (259.0 * (contrast + 255)) / (255.0 * (259 - contrast));
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        image.setPixelRgba(
          x, y,
          _clamp((factor * (p.r - 128) + 128).round()),
          _clamp((factor * (p.g - 128) + 128).round()),
          _clamp((factor * (p.b - 128) + 128).round()),
          p.a.toInt(),
        );
      }
    }
    return image;
  }

  // ─── Highlights / Shadows / Whites / Blacks ──────────────

  static img.Image _applyHighlightsShadows(img.Image image, double highlights, double shadows, double whites, double blacks) {
    if (highlights == 0 && shadows == 0 && whites == 0 && blacks == 0) return image;
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
        double r = p.r / 255.0;
        double g = p.g / 255.0;
        double b = p.b / 255.0;

        // Highlights: affect bright areas
        if (highlights != 0 && lum > 128) {
          final t = (lum - 128) / 127.0;
          final adj = highlights / 100.0 * t * 0.5;
          r = r + adj * (1.0 - r);
          g = g + adj * (1.0 - g);
          b = b + adj * (1.0 - b);
        }

        // Shadows: affect dark areas
        if (shadows != 0 && lum < 128) {
          final t = (128 - lum) / 128.0;
          final adj = shadows / 100.0 * t * 0.5;
          r = r + adj * r;
          g = g + adj * g;
          b = b + adj * b;
        }

        // Whites: stretch bright end
        if (whites != 0) {
          final t = lum / 255.0;
          final adj = whites / 100.0 * t * t * 0.3;
          r += adj;
          g += adj;
          b += adj;
        }

        // Blacks: crush dark end
        if (blacks != 0) {
          final t = 1.0 - lum / 255.0;
          final adj = blacks / 100.0 * t * t * 0.3;
          r += adj;
          g += adj;
          b += adj;
        }

        image.setPixelRgba(x, y, _clamp((r * 255).round()), _clamp((g * 255).round()), _clamp((b * 255).round()), p.a.toInt());
      }
    }
    return image;
  }

  // ─── White Balance (Temperature + Tint) ──────────────────

  static img.Image _applyWhiteBalance(img.Image image, double temperature, double tint) {
    if (temperature == 5500 && tint == 0) return image;
    final tempShift = (temperature - 5500) / 5500.0; // -1 to +1 range
    final tintShift = tint / 150.0; // -1 to +1 range
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        double r = p.r / 255.0;
        double g = p.g / 255.0;
        double b = p.b / 255.0;
        // Temperature: warm = +red/-blue, cool = -red/+blue
        r += tempShift * 0.15;
        b -= tempShift * 0.15;
        // Tint: +green/-magenta
        g += tintShift * 0.1;
        r -= tintShift * 0.05;
        b -= tintShift * 0.05;
        image.setPixelRgba(x, y, _clamp((r * 255).round()), _clamp((g * 255).round()), _clamp((b * 255).round()), p.a.toInt());
      }
    }
    return image;
  }

  // ─── Vibrance ────────────────────────────────────────────

  static img.Image _applyVibrance(img.Image image, double vibrance) {
    if (vibrance == 0) return image;
    final factor = vibrance / 100.0;
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final r = p.r / 255.0;
        final g = p.g / 255.0;
        final b = p.b / 255.0;
        final maxC = max(r, max(g, b));
        final minC = min(r, min(g, b));
        final sat = maxC == 0 ? 0.0 : (maxC - minC) / maxC;
        // Boost less-saturated colors more
        final adj = factor * (1.0 - sat);
        final gray = 0.299 * r + 0.587 * g + 0.114 * b;
        final nr = gray + (r - gray) * (1.0 + adj);
        final ng = gray + (g - gray) * (1.0 + adj);
        final nb = gray + (b - gray) * (1.0 + adj);
        image.setPixelRgba(x, y, _clamp((nr * 255).round()), _clamp((ng * 255).round()), _clamp((nb * 255).round()), p.a.toInt());
      }
    }
    return image;
  }

  // ─── Saturation ──────────────────────────────────────────

  static img.Image _applySaturation(img.Image image, double saturation) {
    if (saturation == 0) return image;
    final factor = 1.0 + saturation / 100.0;
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final gray = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
        image.setPixelRgba(
          x, y,
          _clamp((gray + (p.r - gray) * factor).round()),
          _clamp((gray + (p.g - gray) * factor).round()),
          _clamp((gray + (p.b - gray) * factor).round()),
          p.a.toInt(),
        );
      }
    }
    return image;
  }

  // ─── Clarity + Texture (local contrast) ──────────────────

  static img.Image _applyClarityTexture(img.Image image, double clarity, double texture) {
    if (clarity == 0 && texture == 0) return image;
    // Simplified: apply midtone contrast boost
    final clarityFactor = clarity / 100.0 * 0.3;
    final textureFactor = texture / 100.0 * 0.15;
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
        // Midtone mask: peak at 128, falls off at extremes
        final midtoneMask = 1.0 - (lum - 128.0).abs() / 128.0;
        final adj = (clarityFactor + textureFactor) * midtoneMask;
        final factor = 1.0 + adj;
        final nr = ((lum + (p.r - lum) * factor)).clamp(0.0, 255.0);
        final ng = ((lum + (p.g - lum) * factor)).clamp(0.0, 255.0);
        final nb = ((lum + (p.b - lum) * factor)).clamp(0.0, 255.0);
        image.setPixelRgba(x, y, nr.round(), ng.round(), nb.round(), p.a.toInt());
      }
    }
    return image;
  }

  // ─── Dehaze ──────────────────────────────────────────────

  static img.Image _applyDehaze(img.Image image, double dehaze) {
    if (dehaze == 0) return image;
    final factor = dehaze / 100.0;
    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final darkChannel = min(p.r, min(p.g, p.b)) / 255.0;
        final transmission = (1.0 - factor * darkChannel).clamp(0.1, 1.0);
        final atmLight = 255.0;
        final r = ((p.r / transmission - atmLight * (1 - transmission)) / transmission).clamp(0.0, 255.0);
        final g = ((p.g / transmission - atmLight * (1 - transmission)) / transmission).clamp(0.0, 255.0);
        final b = ((p.b / transmission - atmLight * (1 - transmission)) / transmission).clamp(0.0, 255.0);
        image.setPixelRgba(x, y, r.round(), g.round(), b.round(), p.a.toInt());
      }
    }
    return image;
  }

  // ─── Curves ──────────────────────────────────────────────

  static img.Image _applyCurves(img.Image image, CurvesAdjustment curves) {
    if (curves.rgb.isEmpty && curves.red.isEmpty && curves.green.isEmpty && curves.blue.isEmpty) return image;

    // Build LUTs
    final rgbLut = _buildLut(curves.rgb);
    final rLut = _buildLut(curves.red);
    final gLut = _buildLut(curves.green);
    final bLut = _buildLut(curves.blue);

    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        var r = rgbLut[rLut[p.r.toInt()]];
        var g = rgbLut[gLut[p.g.toInt()]];
        var b = rgbLut[bLut[p.b.toInt()]];
        image.setPixelRgba(x, y, r, g, b, p.a.toInt());
      }
    }
    return image;
  }

  static List<int> _buildLut(List<CurvePoint> points) {
    final lut = List<int>.generate(256, (i) => i);
    if (points.isEmpty) return lut;
    for (int i = 0; i < 256; i++) {
      final x = i / 255.0;
      final y = CurvesAdjustment.evaluate(points, x);
      lut[i] = (y * 255).round().clamp(0, 255);
    }
    return lut;
  }

  // ─── HSL ─────────────────────────────────────────────────

  static img.Image _applyHsl(img.Image image, HslAdjustment adj) {
    final allZero = adj.hueRed == 0 && adj.hueOrange == 0 && adj.hueYellow == 0 &&
        adj.hueGreen == 0 && adj.hueAqua == 0 && adj.hueBlue == 0 &&
        adj.huePurple == 0 && adj.hueMagenta == 0 &&
        adj.satRed == 0 && adj.satOrange == 0 && adj.satYellow == 0 &&
        adj.satGreen == 0 && adj.satAqua == 0 && adj.satBlue == 0 &&
        adj.satPurple == 0 && adj.satMagenta == 0 &&
        adj.lumRed == 0 && adj.lumOrange == 0 && adj.lumYellow == 0 &&
        adj.lumGreen == 0 && adj.lumAqua == 0 && adj.lumBlue == 0 &&
        adj.lumPurple == 0 && adj.lumMagenta == 0;
    if (allZero) return image;

    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final hslVal = _rgbToHsl(p.r / 255.0, p.g / 255.0, p.b / 255.0);
        double hue = hslVal[0];
        double sat = hslVal[1];
        double lum = hslVal[2];

        final idx = _hueToColorIndex(hue);
        hue += _hueShiftForIndex(adj, idx);
        if (hue < 0) hue += 360;
        if (hue >= 360) hue -= 360;
        sat = (sat + _satAdjForIndex(adj, idx) / 100.0).clamp(0.0, 1.0);
        lum = (lum + _lumAdjForIndex(adj, idx) / 100.0).clamp(0.0, 1.0);

        final rgb = _hslToRgb(hue, sat, lum);
        image.setPixelRgba(x, y, _clamp((rgb[0] * 255).round()), _clamp((rgb[1] * 255).round()), _clamp((rgb[2] * 255).round()), p.a.toInt());
      }
    }
    return image;
  }

  static int _hueToColorIndex(double hue) {
    if (hue < 15 || hue >= 345) return 0;
    if (hue < 45) return 1;
    if (hue < 75) return 2;
    if (hue < 165) return 3;
    if (hue < 195) return 4;
    if (hue < 255) return 5;
    if (hue < 285) return 6;
    return 7;
  }

  static double _hueShiftForIndex(HslAdjustment a, int i) {
    switch (i) {
      case 0: return a.hueRed;
      case 1: return a.hueOrange;
      case 2: return a.hueYellow;
      case 3: return a.hueGreen;
      case 4: return a.hueAqua;
      case 5: return a.hueBlue;
      case 6: return a.huePurple;
      default: return a.hueMagenta;
    }
  }

  static double _satAdjForIndex(HslAdjustment a, int i) {
    switch (i) {
      case 0: return a.satRed;
      case 1: return a.satOrange;
      case 2: return a.satYellow;
      case 3: return a.satGreen;
      case 4: return a.satAqua;
      case 5: return a.satBlue;
      case 6: return a.satPurple;
      default: return a.satMagenta;
    }
  }

  static double _lumAdjForIndex(HslAdjustment a, int i) {
    switch (i) {
      case 0: return a.lumRed;
      case 1: return a.lumOrange;
      case 2: return a.lumYellow;
      case 3: return a.lumGreen;
      case 4: return a.lumAqua;
      case 5: return a.lumBlue;
      case 6: return a.lumPurple;
      default: return a.lumMagenta;
    }
  }

  // ─── Color Grading ───────────────────────────────────────

  static img.Image _applyColorGrading(img.Image image, ColorGradingAdjustment cg) {
    if (cg.shadows.saturation == 0 && cg.midtones.saturation == 0 && cg.highlights.saturation == 0) return image;

    for (int y = 0; y < image.height; y++) {
      for (int x = 0; x < image.width; x++) {
        final p = image.getPixel(x, y);
        final lum = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255.0;
        double r = p.r / 255.0;
        double g = p.g / 255.0;
        double b = p.b / 255.0;

        // Shadows (lum < 0.33)
        if (lum < 0.33 && cg.shadows.saturation > 0) {
          final weight = (0.33 - lum) / 0.33;
          final adj = weight * cg.shadows.saturation / 100.0;
          final hr = cg.shadows.hue * pi / 180.0;
          r += adj * cos(hr) * 0.15;
          g += adj * cos(hr - 2.094) * 0.15;
          b += adj * cos(hr - 4.189) * 0.15;
        }

        // Midtones (0.33 <= lum <= 0.66)
        if (lum >= 0.33 && lum <= 0.66 && cg.midtones.saturation > 0) {
          final weight = 1.0 - (lum - 0.33).abs() / 0.33;
          final adj = weight * cg.midtones.saturation / 100.0;
          final hm = cg.midtones.hue * pi / 180.0;
          r += adj * cos(hm) * 0.15;
          g += adj * cos(hm - 2.094) * 0.15;
          b += adj * cos(hm - 4.189) * 0.15;
        }

        // Highlights (lum > 0.66)
        if (lum > 0.66 && cg.highlights.saturation > 0) {
          final weight = (lum - 0.66) / 0.34;
          final adj = weight * cg.highlights.saturation / 100.0;
          final hh = cg.highlights.hue * pi / 180.0;
          r += adj * cos(hh) * 0.15;
          g += adj * cos(hh - 2.094) * 0.15;
          b += adj * cos(hh - 4.189) * 0.15;
        }

        image.setPixelRgba(x, y, _clamp((r * 255).round()), _clamp((g * 255).round()), _clamp((b * 255).round()), p.a.toInt());
      }
    }
    return image;
  }

  // ─── Lens Corrections ────────────────────────────────────

  static img.Image _applyLensCorrections(img.Image image, LensCorrections lc) {
    if (lc.distortion == 0 && lc.vignetting == 0 && !lc.chromaticAberration) return image;
    // Placeholder — full barrel distortion + vignetting requires per-pixel coordinate transform
    // For now, apply vignetting as a simple radial darken
    if (lc.vignetting != 0) {
      final cx = image.width / 2.0;
      final cy = image.height / 2.0;
      final maxDist = sqrt(cx * cx + cy * cy);
      final strength = lc.vignetting / 100.0;
      for (int y = 0; y < image.height; y++) {
        for (int x = 0; x < image.width; x++) {
          final dx = x - cx;
          final dy = y - cy;
          final dist = sqrt(dx * dx + dy * dy) / maxDist;
          final vignette = 1.0 - strength * dist * dist;
          final p = image.getPixel(x, y);
          image.setPixelRgba(x, y,
            _clamp((p.r * vignette).round()),
            _clamp((p.g * vignette).round()),
            _clamp((p.b * vignette).round()),
            p.a.toInt(),
          );
        }
      }
    }
    return image;
  }

  // ─── Crop ────────────────────────────────────────────────

  static img.Image _applyCrop(img.Image image, CropSettings crop) {
    if (crop.x == 0 && crop.y == 0 && crop.width == 1 && crop.height == 1) return image;
    final x = (crop.x * image.width).round().clamp(0, image.width - 1);
    final y = (crop.y * image.height).round().clamp(0, image.height - 1);
    final w = (crop.width * image.width).round().clamp(1, image.width - x);
    final h = (crop.height * image.height).round().clamp(1, image.height - y);
    return img.copyCrop(image, x: x, y: y, width: w, height: h);
  }

  // ─── Color Space Helpers ─────────────────────────────────

  static List<double> _rgbToHsl(double r, double g, double b) {
    final maxC = max(r, max(g, b));
    final minC = min(r, min(g, b));
    final l = (maxC + minC) / 2.0;

    if (maxC == minC) return [0, 0, l];

    final d = maxC - minC;
    final s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);

    double h;
    if (maxC == r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6.0;
    } else if (maxC == g) {
      h = ((b - r) / d + 2) / 6.0;
    } else {
      h = ((r - g) / d + 4) / 6.0;
    }

    return [h * 360, s, l];
  }

  static List<double> _hslToRgb(double h, double s, double l) {
    if (s == 0) return [l, l, l];

    final q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    final p = 2 * l - q;
    final hNorm = h / 360.0;

    return [
      _hueToRgb(p, q, hNorm + 1 / 3),
      _hueToRgb(p, q, hNorm),
      _hueToRgb(p, q, hNorm - 1 / 3),
    ];
  }

  static double _hueToRgb(double p, double q, double t) {
    var tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  }

  static int _clamp(int v) => v.clamp(0, 255);
}

class _ProcessParams {
  final String sourcePath;
  final EditStateModel edits;
  final String outputPath;
  final int maxSize;
  _ProcessParams(this.sourcePath, this.edits, this.outputPath, this.maxSize);
}
