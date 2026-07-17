import 'dart:io';
import 'dart:math';

class PhotoModel {
  final String photoId;
  final String catalogId;
  final String filename;
  final String filePath;
  final String? fileHash;
  final DateTime? captureDate;
  final String? cameraMake;
  final String? cameraModel;
  final String? lens;
  final int? iso;
  final double? aperture;
  final String? shutterSpeed;
  final double? focalLength;
  final int rating;
  final String flag;
  final DateTime createdAt;
  final DateTime updatedAt;

  PhotoModel({
    required this.photoId,
    required this.catalogId,
    required this.filename,
    required this.filePath,
    this.fileHash,
    this.captureDate,
    this.cameraMake,
    this.cameraModel,
    this.lens,
    this.iso,
    this.aperture,
    this.shutterSpeed,
    this.focalLength,
    this.rating = 0,
    this.flag = 'none',
    required this.createdAt,
    required this.updatedAt,
  });

  File get file => File(filePath);

  bool get isRaw {
    final ext = filename.split('.').last.toLowerCase();
    return ['cr2', 'cr3', 'nef', 'nrw', 'arw', 'raf', 'dng', 'orf', 'rw2', 'pef'].contains(ext);
  }

  String get displayName {
    final parts = filename.split('.');
    if (parts.length > 1) {
      parts.removeLast();
      return parts.join('.');
    }
    return filename;
  }

  String get extension {
    final parts = filename.split('.');
    return parts.length > 1 ? parts.last.toUpperCase() : '';
  }

  PhotoModel copyWith({
    int? rating,
    String? flag,
  }) {
    return PhotoModel(
      photoId: photoId,
      catalogId: catalogId,
      filename: filename,
      filePath: filePath,
      fileHash: fileHash,
      captureDate: captureDate,
      cameraMake: cameraMake,
      cameraModel: cameraModel,
      lens: lens,
      iso: iso,
      aperture: aperture,
      shutterSpeed: shutterSpeed,
      focalLength: focalLength,
      rating: rating ?? this.rating,
      flag: flag ?? this.flag,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }
}

class CatalogModel {
  final String catalogId;
  final String name;
  final String? description;
  final String? version;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String status;
  final int photoCount;

  CatalogModel({
    required this.catalogId,
    required this.name,
    this.description,
    this.version,
    required this.createdAt,
    required this.updatedAt,
    this.status = 'active',
    this.photoCount = 0,
  });
}

class AlbumModel {
  final String albumId;
  final String catalogId;
  final String name;
  final DateTime createdAt;
  final int photoCount;

  AlbumModel({
    required this.albumId,
    required this.catalogId,
    required this.name,
    required this.createdAt,
    this.photoCount = 0,
  });
}

class PhotoFilter {
  final String? catalogId;
  final int? rating;
  final String? flag;
  final String? search;

  PhotoFilter({this.catalogId, this.rating, this.flag, this.search});
}

// ─── Curves ────────────────────────────────────────────────

class CurvePoint {
  final double x;
  final double y;
  const CurvePoint(this.x, this.y);
}

class CurvesAdjustment {
  final List<CurvePoint> rgb;
  final List<CurvePoint> red;
  final List<CurvePoint> green;
  final List<CurvePoint> blue;

  const CurvesAdjustment({
    this.rgb = const [],
    this.red = const [],
    this.green = const [],
    this.blue = const [],
  });

  CurvesAdjustment copyWith({
    List<CurvePoint>? rgb,
    List<CurvePoint>? red,
    List<CurvePoint>? green,
    List<CurvePoint>? blue,
  }) {
    return CurvesAdjustment(
      rgb: rgb ?? this.rgb,
      red: red ?? this.red,
      green: green ?? this.green,
      blue: blue ?? this.blue,
    );
  }

  /// Evaluate curve at input value using cubic spline interpolation
  static double evaluate(List<CurvePoint> points, double x) {
    if (points.isEmpty) return x;
    if (points.length == 1) return points[0].y;

    final sorted = List<CurvePoint>.from(points)..sort((a, b) => a.x.compareTo(b.x));

    if (x <= sorted.first.x) return sorted.first.y;
    if (x >= sorted.last.x) return sorted.last.y;

    for (int i = 0; i < sorted.length - 1; i++) {
      final p0 = sorted[i];
      final p1 = sorted[i + 1];
      if (x >= p0.x && x <= p1.x) {
        final t = (x - p0.x) / (p1.x - p0.x);
        // Smooth cubic interpolation
        final t2 = t * t;
        final t3 = t2 * t;
        return p0.y + (p1.y - p0.y) * (3 * t2 - 2 * t3);
      }
    }
    return x;
  }
}

// ─── HSL ───────────────────────────────────────────────────

class HslAdjustment {
  final double hueRed;
  final double hueOrange;
  final double hueYellow;
  final double hueGreen;
  final double hueAqua;
  final double hueBlue;
  final double huePurple;
  final double hueMagenta;
  final double satRed;
  final double satOrange;
  final double satYellow;
  final double satGreen;
  final double satAqua;
  final double satBlue;
  final double satPurple;
  final double satMagenta;
  final double lumRed;
  final double lumOrange;
  final double lumYellow;
  final double lumGreen;
  final double lumAqua;
  final double lumBlue;
  final double lumPurple;
  final double lumMagenta;

  const HslAdjustment({
    this.hueRed = 0, this.hueOrange = 0, this.hueYellow = 0, this.hueGreen = 0,
    this.hueAqua = 0, this.hueBlue = 0, this.huePurple = 0, this.hueMagenta = 0,
    this.satRed = 0, this.satOrange = 0, this.satYellow = 0, this.satGreen = 0,
    this.satAqua = 0, this.satBlue = 0, this.satPurple = 0, this.satMagenta = 0,
    this.lumRed = 0, this.lumOrange = 0, this.lumYellow = 0, this.lumGreen = 0,
    this.lumAqua = 0, this.lumBlue = 0, this.lumPurple = 0, this.lumMagenta = 0,
  });

  HslAdjustment copyWith({
    double? hueRed, double? hueOrange, double? hueYellow, double? hueGreen,
    double? hueAqua, double? hueBlue, double? huePurple, double? hueMagenta,
    double? satRed, double? satOrange, double? satYellow, double? satGreen,
    double? satAqua, double? satBlue, double? satPurple, double? satMagenta,
    double? lumRed, double? lumOrange, double? lumYellow, double? lumGreen,
    double? lumAqua, double? lumBlue, double? lumPurple, double? lumMagenta,
  }) {
    return HslAdjustment(
      hueRed: hueRed ?? this.hueRed, hueOrange: hueOrange ?? this.hueOrange,
      hueYellow: hueYellow ?? this.hueYellow, hueGreen: hueGreen ?? this.hueGreen,
      hueAqua: hueAqua ?? this.hueAqua, hueBlue: hueBlue ?? this.hueBlue,
      huePurple: huePurple ?? this.huePurple, hueMagenta: hueMagenta ?? this.hueMagenta,
      satRed: satRed ?? this.satRed, satOrange: satOrange ?? this.satOrange,
      satYellow: satYellow ?? this.satYellow, satGreen: satGreen ?? this.satGreen,
      satAqua: satAqua ?? this.satAqua, satBlue: satBlue ?? this.satBlue,
      satPurple: satPurple ?? this.satPurple, satMagenta: satMagenta ?? this.satMagenta,
      lumRed: lumRed ?? this.lumRed, lumOrange: lumOrange ?? this.lumOrange,
      lumYellow: lumYellow ?? this.lumYellow, lumGreen: lumGreen ?? this.lumGreen,
      lumAqua: lumAqua ?? this.lumAqua, lumBlue: lumBlue ?? this.lumBlue,
      lumPurple: lumPurple ?? this.lumPurple, lumMagenta: lumMagenta ?? this.lumMagenta,
    );
  }
}

// ─── Color Grading ─────────────────────────────────────────

class ColorWheel {
  final double hue;
  final double saturation;
  const ColorWheel({this.hue = 0, this.saturation = 0});
}

class ColorGradingAdjustment {
  final ColorWheel shadows;
  final ColorWheel midtones;
  final ColorWheel highlights;
  final double balance;

  const ColorGradingAdjustment({
    this.shadows = const ColorWheel(),
    this.midtones = const ColorWheel(),
    this.highlights = const ColorWheel(),
    this.balance = 0,
  });

  ColorGradingAdjustment copyWith({
    ColorWheel? shadows,
    ColorWheel? midtones,
    ColorWheel? highlights,
    double? balance,
  }) {
    return ColorGradingAdjustment(
      shadows: shadows ?? this.shadows,
      midtones: midtones ?? this.midtones,
      highlights: highlights ?? this.highlights,
      balance: balance ?? this.balance,
    );
  }
}

// ─── Crop ──────────────────────────────────────────────────

class CropSettings {
  final double x;
  final double y;
  final double width;
  final double height;
  final double rotation;
  final String? aspectRatio;

  const CropSettings({
    this.x = 0, this.y = 0, this.width = 1, this.height = 1,
    this.rotation = 0, this.aspectRatio,
  });

  CropSettings copyWith({
    double? x, double? y, double? width, double? height,
    double? rotation, String? aspectRatio, bool clearAspectRatio = false,
  }) {
    return CropSettings(
      x: x ?? this.x, y: y ?? this.y,
      width: width ?? this.width, height: height ?? this.height,
      rotation: rotation ?? this.rotation,
      aspectRatio: clearAspectRatio ? null : (aspectRatio ?? this.aspectRatio),
    );
  }
}

// ─── Lens Corrections ──────────────────────────────────────

class LensCorrections {
  final double distortion;
  final double vignetting;
  final bool chromaticAberration;

  const LensCorrections({
    this.distortion = 0, this.vignetting = 0, this.chromaticAberration = false,
  });

  LensCorrections copyWith({
    double? distortion, double? vignetting, bool? chromaticAberration,
  }) {
    return LensCorrections(
      distortion: distortion ?? this.distortion,
      vignetting: vignetting ?? this.vignetting,
      chromaticAberration: chromaticAberration ?? this.chromaticAberration,
    );
  }
}

// ─── Retouch State ─────────────────────────────────────────

class RetouchState {
  final double skinSmoothing;
  final double blemishRemoval;
  final double poreRefinement;
  final double shineReduction;
  final double detailPreservation;
  final double eyeWhitening;
  final double eyeSharpening;
  final double teethWhitening;

  const RetouchState({
    this.skinSmoothing = 0, this.blemishRemoval = 0, this.poreRefinement = 0,
    this.shineReduction = 0, this.detailPreservation = 50,
    this.eyeWhitening = 0, this.eyeSharpening = 0, this.teethWhitening = 0,
  });

  RetouchState copyWith({
    double? skinSmoothing, double? blemishRemoval, double? poreRefinement,
    double? shineReduction, double? detailPreservation,
    double? eyeWhitening, double? eyeSharpening, double? teethWhitening,
  }) {
    return RetouchState(
      skinSmoothing: skinSmoothing ?? this.skinSmoothing,
      blemishRemoval: blemishRemoval ?? this.blemishRemoval,
      poreRefinement: poreRefinement ?? this.poreRefinement,
      shineReduction: shineReduction ?? this.shineReduction,
      detailPreservation: detailPreservation ?? this.detailPreservation,
      eyeWhitening: eyeWhitening ?? this.eyeWhitening,
      eyeSharpening: eyeSharpening ?? this.eyeSharpening,
      teethWhitening: teethWhitening ?? this.teethWhitening,
    );
  }
}

// ─── Edit State (Full) ─────────────────────────────────────

class EditStateModel {
  final double exposure;
  final double contrast;
  final double highlights;
  final double shadows;
  final double whites;
  final double blacks;
  final double temperature;
  final double tint;
  final double vibrance;
  final double saturation;
  final double clarity;
  final double texture;
  final double dehaze;
  final CurvesAdjustment curves;
  final HslAdjustment hsl;
  final ColorGradingAdjustment colorGrading;
  final CropSettings crop;
  final LensCorrections lensCorrections;

  EditStateModel({
    this.exposure = 0,
    this.contrast = 0,
    this.highlights = 0,
    this.shadows = 0,
    this.whites = 0,
    this.blacks = 0,
    this.temperature = 5500,
    this.tint = 0,
    this.vibrance = 0,
    this.saturation = 0,
    this.clarity = 0,
    this.texture = 0,
    this.dehaze = 0,
    this.curves = const CurvesAdjustment(),
    this.hsl = const HslAdjustment(),
    this.colorGrading = const ColorGradingAdjustment(),
    this.crop = const CropSettings(),
    this.lensCorrections = const LensCorrections(),
  });

  EditStateModel copyWith({
    double? exposure, double? contrast, double? highlights, double? shadows,
    double? whites, double? blacks, double? temperature, double? tint,
    double? vibrance, double? saturation, double? clarity, double? texture,
    double? dehaze, CurvesAdjustment? curves, HslAdjustment? hsl,
    ColorGradingAdjustment? colorGrading, CropSettings? crop,
    LensCorrections? lensCorrections,
  }) {
    return EditStateModel(
      exposure: exposure ?? this.exposure,
      contrast: contrast ?? this.contrast,
      highlights: highlights ?? this.highlights,
      shadows: shadows ?? this.shadows,
      whites: whites ?? this.whites,
      blacks: blacks ?? this.blacks,
      temperature: temperature ?? this.temperature,
      tint: tint ?? this.tint,
      vibrance: vibrance ?? this.vibrance,
      saturation: saturation ?? this.saturation,
      clarity: clarity ?? this.clarity,
      texture: texture ?? this.texture,
      dehaze: dehaze ?? this.dehaze,
      curves: curves ?? this.curves,
      hsl: hsl ?? this.hsl,
      colorGrading: colorGrading ?? this.colorGrading,
      crop: crop ?? this.crop,
      lensCorrections: lensCorrections ?? this.lensCorrections,
    );
  }

  EditStateModel reset() => EditStateModel();
}

enum Workspace { library, cull, develop, retouch, export }

// ─── Histogram Data ────────────────────────────────────────

class HistogramData {
  final List<int> red;
  final List<int> green;
  final List<int> blue;
  final List<int> luminance;

  const HistogramData({
    required this.red,
    required this.green,
    required this.blue,
    required this.luminance,
  });

  int get maxRed => red.reduce(max);
  int get maxGreen => green.reduce(max);
  int get maxBlue => blue.reduce(max);
  int get maxLuminance => luminance.reduce(max);
  int get maxValue => max(max(maxRed, maxGreen), max(maxBlue, 1));
}
