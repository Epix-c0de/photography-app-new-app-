import 'dart:io';

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
  });

  EditStateModel copyWith({
    double? exposure,
    double? contrast,
    double? highlights,
    double? shadows,
    double? whites,
    double? blacks,
    double? temperature,
    double? tint,
    double? vibrance,
    double? saturation,
    double? clarity,
    double? texture,
    double? dehaze,
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
    );
  }

  EditStateModel reset() => EditStateModel();
}

enum Workspace { library, cull, develop, retouch, export }
