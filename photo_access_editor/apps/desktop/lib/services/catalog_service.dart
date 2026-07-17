import 'dart:convert';
import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:uuid/uuid.dart';

/// Local catalog manager using JSON files as lightweight storage
/// In production, this connects to the Rust catalog_engine via flutter_rust_bridge
class CatalogService {
  static Directory? _appDir;
  static Directory? _catalogsDir;
  
  static const _catalogsFile = 'catalogs.json';
  static const _photosFile = 'photos.json';

  /// Initialize the catalog service
  static Future<void> initialize() async {
    _appDir = await getApplicationSupportDirectory();
    _catalogsDir = Directory(p.join(_appDir!.path, 'catalogs'));
    if (!_catalogsDir!.existsSync()) {
      _catalogsDir!.createSync(recursive: true);
    }
  }

  /// Get the default catalog, creating one if needed
  static Future<CatalogModel> getDefaultCatalog() async {
    final catalogs = await listCatalogs();
    if (catalogs.isNotEmpty) return catalogs.first;
    return await createCatalog('My Catalog');
  }

  /// Create a new catalog
  static Future<CatalogModel> createCatalog(String name) async {
    final id = const Uuid().v4();
    final now = DateTime.now().toUtc();
    
    final catalog = CatalogModel(
      catalogId: id,
      name: name,
      createdAt: now,
      updatedAt: now,
    );

    // Create catalog directory
    final catalogDir = Directory(p.join(_catalogsDir!.path, id));
    catalogDir.createSync(recursive: true);

    // Create thumbnails directory
    Directory(p.join(catalogDir.path, 'thumbnails')).createSync();

    // Save catalog metadata
    await _saveCatalogMeta(catalog);
    
    return catalog;
  }

  /// List all catalogs
  static Future<List<CatalogModel>> listCatalogs() async {
    if (_catalogsDir == null || !_catalogsDir!.existsSync()) return [];
    
    final catalogs = <CatalogModel>[];
    for (final dir in _catalogsDir!.listSync().whereType<Directory>()) {
      final metaFile = File(p.join(dir.path, 'meta.json'));
      if (metaFile.existsSync()) {
        final json = jsonDecode(await metaFile.readAsString());
        final photos = await _listPhotosForCatalog(json['catalog_id']);
        catalogs.add(CatalogModel(
          catalogId: json['catalog_id'],
          name: json['name'],
          description: json['description'],
          version: json['version'],
          createdAt: DateTime.parse(json['created_at']),
          updatedAt: DateTime.parse(json['updated_at']),
          status: json['status'] ?? 'active',
          photoCount: photos.length,
        ));
      }
    }
    
    catalogs.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return catalogs;
  }

  /// Add photos to a catalog
  static Future<void> addPhotos(String catalogId, List<PhotoModel> photos) async {
    final photosFile = File(p.join(_catalogsDir!.path, catalogId, _photosFile));
    
    List<Map<String, dynamic>> existing = [];
    if (photosFile.existsSync()) {
      existing = List<Map<String, dynamic>>.from(jsonDecode(await photosFile.readAsString()));
    }

    for (final photo in photos) {
      existing.add(_photoToJson(photo));
    }

    await photosFile.writeAsString(jsonEncode(existing));
  }

  /// List photos in a catalog
  static Future<List<PhotoModel>> listPhotos(String catalogId, {PhotoFilter? filter}) async {
    return _listPhotosForCatalog(catalogId, filter: filter);
  }

  /// Update photo rating
  static Future<void> updatePhotoRating(String catalogId, String photoId, int rating) async {
    final photos = await _listPhotosForCatalog(catalogId);
    for (final photo in photos) {
      if (photo.photoId == photoId) {
        // Update in file
        final photosFile = File(p.join(_catalogsDir!.path, catalogId, _photosFile));
        final List<Map<String, dynamic>> data = jsonDecode(await photosFile.readAsString());
        for (final item in data) {
          if (item['photo_id'] == photoId) {
            item['rating'] = rating;
            break;
          }
        }
        await photosFile.writeAsString(jsonEncode(data));
        break;
      }
    }
  }

  /// Update photo flag
  static Future<void> updatePhotoFlag(String catalogId, String photoId, String flag) async {
    final photosFile = File(p.join(_catalogsDir!.path, catalogId, _photosFile));
    if (!photosFile.existsSync()) return;
    
    final List<Map<String, dynamic>> data = jsonDecode(await photosFile.readAsString());
    for (final item in data) {
      if (item['photo_id'] == photoId) {
        item['flag'] = flag;
        break;
      }
    }
    await photosFile.writeAsString(jsonEncode(data));
  }

  /// Delete photos from catalog
  static Future<void> deletePhotos(String catalogId, List<String> photoIds) async {
    final photosFile = File(p.join(_catalogsDir!.path, catalogId, _photosFile));
    if (!photosFile.existsSync()) return;
    
    final List<Map<String, dynamic>> data = jsonDecode(await photosFile.readAsString());
    data.removeWhere((item) => photoIds.contains(item['photo_id']));
    await photosFile.writeAsString(jsonEncode(data));
  }

  /// Get catalog directory path
  static String getCatalogPath(String catalogId) {
    return p.join(_catalogsDir!.path, catalogId);
  }

  /// Get thumbnail directory for a catalog
  static String getThumbnailDir(String catalogId) {
    return p.join(_catalogsDir!.path, catalogId, 'thumbnails');
  }

  // ─── Private Helpers ──────────────────────────────────────

  static Future<void> _saveCatalogMeta(CatalogModel catalog) async {
    final metaFile = File(p.join(_catalogsDir!.path, catalog.catalogId, 'meta.json'));
    await metaFile.writeAsString(jsonEncode({
      'catalog_id': catalog.catalogId,
      'name': catalog.name,
      'description': catalog.description,
      'version': catalog.version,
      'created_at': catalog.createdAt.toIso8601String(),
      'updated_at': catalog.updatedAt.toIso8601String(),
      'status': catalog.status,
    }));
  }

  static Future<List<PhotoModel>> _listPhotosForCatalog(
    String catalogId, {
    PhotoFilter? filter,
  }) async {
    final photosFile = File(p.join(_catalogsDir!.path, catalogId, _photosFile));
    if (!photosFile.existsSync()) return [];
    
    final List<Map<String, dynamic>> data = jsonDecode(await photosFile.readAsString());
    var photos = data.map((json) => PhotoModel(
      photoId: json['photo_id'],
      catalogId: json['catalog_id'],
      filename: json['filename'],
      filePath: json['file_path'],
      fileHash: json['file_hash'],
      captureDate: json['capture_date'] != null ? DateTime.parse(json['capture_date']) : null,
      cameraMake: json['camera_make'],
      cameraModel: json['camera_model'],
      lens: json['lens'],
      iso: json['iso'],
      aperture: json['aperture']?.toDouble(),
      shutterSpeed: json['shutter_speed'],
      focalLength: json['focal_length']?.toDouble(),
      rating: json['rating'] ?? 0,
      flag: json['flag'] ?? 'none',
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
    )).toList();

    // Apply filters
    if (filter != null) {
      if (filter.catalogId != null) {
        photos = photos.where((p) => p.catalogId == filter.catalogId).toList();
      }
      if (filter.rating != null) {
        photos = photos.where((p) => p.rating >= filter.rating!).toList();
      }
      if (filter.flag != null) {
        photos = photos.where((p) => p.flag == filter.flag).toList();
      }
      if (filter.search != null && filter.search!.isNotEmpty) {
        final q = filter.search!.toLowerCase();
        photos = photos.where((p) =>
          p.filename.toLowerCase().contains(q) ||
          (p.cameraModel?.toLowerCase().contains(q) ?? false) ||
          (p.cameraMake?.toLowerCase().contains(q) ?? false)
        ).toList();
      }
    }

    return photos;
  }

  static Map<String, dynamic> _photoToJson(PhotoModel photo) {
    return {
      'photo_id': photo.photoId,
      'catalog_id': photo.catalogId,
      'filename': photo.filename,
      'file_path': photo.filePath,
      'file_hash': photo.fileHash,
      'capture_date': photo.captureDate?.toIso8601String(),
      'camera_make': photo.cameraMake,
      'camera_model': photo.cameraModel,
      'lens': photo.lens,
      'iso': photo.iso,
      'aperture': photo.aperture,
      'shutter_speed': photo.shutterSpeed,
      'focal_length': photo.focalLength,
      'rating': photo.rating,
      'flag': photo.flag,
      'created_at': photo.createdAt.toIso8601String(),
      'updated_at': photo.updatedAt.toIso8601String(),
    };
  }
}
