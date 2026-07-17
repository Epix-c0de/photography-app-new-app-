import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/services/import_service.dart';
import 'package:photo_access_editor/services/catalog_service.dart';
import 'package:photo_access_editor/state/providers.dart';

class ImportWizard extends ConsumerStatefulWidget {
  const ImportWizard({super.key});

  static void show(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const ImportWizard(),
    );
  }

  @override
  ConsumerState<ImportWizard> createState() => _ImportWizardState();
}

class _ImportWizardState extends ConsumerState<ImportWizard> {
  ImportWizardStep _step = ImportWizardStep.selectSource;
  String? _selectedDirectory;
  List<ImportCandidate> _candidates = [];
  bool _isScanning = false;
  bool _isImporting = false;
  int _importedCount = 0;
  int _totalCount = 0;
  String _statusMessage = '';

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: AppTheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.borderRadiusLg),
        side: const BorderSide(color: AppTheme.border),
      ),
      child: SizedBox(
        width: 600,
        height: 500,
        child: Column(
          children: [
            // ─── Header ─────────────────────────────────
            _buildHeader(),
            
            // ─── Content ────────────────────────────────
            Expanded(child: _buildContent()),
            
            // ─── Footer ─────────────────────────────────
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.border)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppTheme.gold, AppTheme.goldLight],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.photo_library, size: 18, color: Colors.black),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Import Photos',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Add photos to your catalog',
                  style: TextStyle(color: AppTheme.textTertiary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            onPressed: () => Navigator.of(context).pop(),
            color: AppTheme.textTertiary,
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    switch (_step) {
      case ImportWizardStep.selectSource:
        return _buildSelectSource();
      case ImportWizardStep.reviewFiles:
        return _buildReviewFiles();
      case ImportWizardStep.importing:
        return _buildImporting();
      case ImportWizardStep.complete:
        return _buildComplete();
    }
  }

  // ─── Step 1: Select Source ─────────────────────────────

  Widget _buildSelectSource() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const SizedBox(height: 20),
          
          // Folder selection
          GestureDetector(
            onTap: _pickFolder,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(40),
              decoration: BoxDecoration(
                color: AppTheme.background,
                borderRadius: BorderRadius.circular(AppTheme.borderRadiusLg),
                border: Border.all(
                  color: AppTheme.gold.withOpacity(0.3),
                  width: 2,
                  style: BorderStyle.solid,
                ),
              ),
              child: Column(
                children: [
                  Icon(
                    Icons.folder_open,
                    size: 48,
                    color: AppTheme.gold.withOpacity(0.6),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Select Folder',
                    style: TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Choose a folder containing your photos',
                    style: TextStyle(color: AppTheme.textTertiary, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
          
          if (_selectedDirectory != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.gold.withOpacity(0.05),
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                border: Border.all(color: AppTheme.gold.withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.folder, size: 16, color: AppTheme.gold),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _selectedDirectory!,
                      style: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 12,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(Icons.check_circle, size: 16, color: AppTheme.green),
                ],
              ),
            ),
          ],
          
          const Spacer(),
          
          // Supported formats
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SUPPORTED FORMATS',
                  style: TextStyle(
                    color: AppTheme.textTertiary,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'RAW: CR2, CR3, NEF, ARW, RAF, DNG, ORF, RW2, PEF\nImage: JPG, JPEG, PNG, TIFF, WebP',
                  style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Step 2: Review Files ──────────────────────────────

  Widget _buildReviewFiles() {
    return Column(
      children: [
        // Stats bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppTheme.border)),
          ),
          child: Row(
            children: [
              _StatBadge(
                label: 'Total',
                value: '${_candidates.length}',
                color: AppTheme.textPrimary,
              ),
              const SizedBox(width: 12),
              _StatBadge(
                label: 'RAW',
                value: '${_candidates.where((c) => c.isRaw).length}',
                color: AppTheme.orange,
              ),
              const SizedBox(width: 12),
              _StatBadge(
                label: 'Image',
                value: '${_candidates.where((c) => !c.isRaw).length}',
                color: AppTheme.blue,
              ),
              const Spacer(),
              Material(
                color: AppTheme.surfaceLight,
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: InkWell(
                  onTap: () => setState(() => _step = ImportWizardStep.selectSource),
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: Text(
                      'Change Folder',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // File list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            itemCount: _candidates.length,
            itemBuilder: (context, index) {
              final candidate = _candidates[index];
              return _FileRow(candidate: candidate);
            },
          ),
        ),
      ],
    );
  }

  // ─── Step 3: Importing ─────────────────────────────────

  Widget _buildImporting() {
    final progress = _totalCount > 0 ? _importedCount / _totalCount : 0.0;

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 200,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: AppTheme.border,
                valueColor: const AlwaysStoppedAnimation(AppTheme.gold),
                minHeight: 6,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Importing $_importedCount of $_totalCount',
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _statusMessage,
            style: const TextStyle(color: AppTheme.textTertiary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // ─── Step 4: Complete ──────────────────────────────────

  Widget _buildComplete() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppTheme.green.withOpacity(0.1),
              shape: BoxShape.circle,
              border: Border.all(color: AppTheme.green.withOpacity(0.3)),
            ),
            child: const Icon(Icons.check, size: 32, color: AppTheme.green),
          ),
          const SizedBox(height: 20),
          Text(
            'Imported $_importedCount photos',
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Photos are ready in your catalog',
            style: TextStyle(color: AppTheme.textTertiary, fontSize: 13),
          ),
        ],
      ),
    );
  }

  // ─── Footer ────────────────────────────────────────────

  Widget _buildFooter() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          if (_step == ImportWizardStep.selectSource)
            Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: InkWell(
                onTap: () => Navigator.of(context).pop(),
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Cancel',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
                ),
              ),
            ),
          
          if (_step == ImportWizardStep.reviewFiles) ...[
            Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: InkWell(
                onTap: () => setState(() => _step = ImportWizardStep.selectSource),
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Back',
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Material(
              color: AppTheme.gold,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: InkWell(
                onTap: _startImport,
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'Import ${_candidates.length} Photos',
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
          ],
          
          if (_step == ImportWizardStep.complete)
            Material(
              color: AppTheme.gold,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: InkWell(
                onTap: () => Navigator.of(context).pop(),
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Text(
                    'Done',
                    style: TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Actions ───────────────────────────────────────────

  Future<void> _pickFolder() async {
    final result = await FilePicker.platform.getDirectoryPath(
      dialogTitle: 'Select Photo Folder',
    );

    if (result != null) {
      setState(() {
        _selectedDirectory = result;
        _isScanning = true;
      });

      final candidates = await ImportService.scanDirectory(result);

      setState(() {
        _candidates = candidates;
        _isScanning = false;
        if (candidates.isNotEmpty) {
          _step = ImportWizardStep.reviewFiles;
        }
      });
    }
  }

  Future<void> _startImport() async {
    setState(() {
      _step = ImportWizardStep.importing;
      _isImporting = true;
      _totalCount = _candidates.length;
      _importedCount = 0;
    });

    try {
      // Get or create default catalog
      final catalog = await CatalogService.getDefaultCatalog();
      
      final thumbnailDir = CatalogService.getThumbnailDir(catalog.catalogId);

      // Import photos
      final photos = await ImportService.importPhotos(
        catalogId: catalog.catalogId,
        candidates: _candidates,
        thumbnailDir: thumbnailDir,
        onProgress: (current, total, filename) {
          setState(() {
            _importedCount = current;
            _statusMessage = filename;
          });
        },
      );

      // Save to catalog
      await CatalogService.addPhotos(catalog.catalogId, photos);

      // Update the app state
      ref.read(photosProvider.notifier).addPhotos(photos);

      setState(() {
        _isImporting = false;
        _step = ImportWizardStep.complete;
      });
    } catch (e) {
      setState(() {
        _isImporting = false;
        _statusMessage = 'Import failed: $e';
      });
    }
  }
}

enum ImportWizardStep {
  selectSource,
  reviewFiles,
  importing,
  complete,
}

class _StatBadge extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatBadge({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          label,
          style: const TextStyle(color: AppTheme.textTertiary, fontSize: 11),
        ),
        const SizedBox(width: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            value,
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}

class _FileRow extends StatelessWidget {
  final ImportCandidate candidate;

  const _FileRow({required this.candidate});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      ),
      child: Row(
        children: [
          // File type icon
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: candidate.isRaw
                  ? AppTheme.orange.withOpacity(0.15)
                  : AppTheme.blue.withOpacity(0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Text(
                candidate.extension.toUpperCase(),
                style: TextStyle(
                  color: candidate.isRaw ? AppTheme.orange : AppTheme.blue,
                  fontSize: 8,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          
          // Filename
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  candidate.filename,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 12,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  candidate.sizeText,
                  style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10),
                ),
              ],
            ),
          ),
          
          // Type badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: candidate.isRaw
                  ? AppTheme.orange.withOpacity(0.1)
                  : AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(4),
              border: Border.all(
                color: candidate.isRaw
                    ? AppTheme.orange.withOpacity(0.3)
                    : AppTheme.border,
              ),
            ),
            child: Text(
              candidate.isRaw ? 'RAW' : 'IMG',
              style: TextStyle(
                color: candidate.isRaw ? AppTheme.orange : AppTheme.textTertiary,
                fontSize: 9,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
