import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/widgets/photo_grid_item.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';
import 'package:photo_access_editor/widgets/metadata_panel.dart';
import 'package:photo_access_editor/widgets/import_wizard.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(filteredPhotosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return Row(
      children: [
        Expanded(
          child: Column(
            children: [
              _LibraryToolbar(photoCount: photos.length),
              Expanded(
                child: photos.isEmpty ? _EmptyState() : _PhotoGrid(photos: photos),
              ),
              const Filmstrip(),
            ],
          ),
        ),
        if (selectedPhoto != null) const MetadataPanel(),
      ],
    );
  }
}

// ─── Toolbar ───────────────────────────────────────────────

class _LibraryToolbar extends ConsumerWidget {
  final int photoCount;
  const _LibraryToolbar({required this.photoCount});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gridSize = ref.watch(gridSizeProvider);

    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
      child: Row(
        children: [
          Text('$photoCount photos', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          const SizedBox(width: 16),
          _ToolbarDropdown(value: 'Date', items: const ['Date', 'Name', 'Rating', 'Camera'], onChanged: (v) {}),
          const SizedBox(width: 8),
          IconButton(icon: const Icon(Icons.grid_view, size: 16), onPressed: () {}, tooltip: 'Grid View'),
          IconButton(icon: const Icon(Icons.view_timeline_outlined, size: 16), onPressed: () {}, tooltip: 'Timeline View'),
          const Spacer(),
          const Icon(Icons.grid_on, size: 14, color: AppTheme.textTertiary),
          SizedBox(
            width: 100,
            child: Slider(value: gridSize, min: 80, max: 400, onChanged: (v) => ref.read(gridSizeProvider.notifier).state = v),
          ),
          const Icon(Icons.grid_on, size: 20, color: AppTheme.textTertiary),
          const SizedBox(width: 12),
          // Rating filter
          Row(
            children: List.generate(5, (i) => GestureDetector(
              onTap: () {},
              child: Icon(Icons.star, size: 14, color: i < 3 ? AppTheme.gold : AppTheme.textTertiary),
            )),
          ),
        ],
      ),
    );
  }
}

class _ToolbarDropdown extends StatelessWidget {
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  const _ToolbarDropdown({required this.value, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: AppTheme.surfaceLight, borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.border)),
      child: DropdownButton<String>(
        value: value,
        items: items.map((item) => DropdownMenuItem(value: item, child: Text(item, style: const TextStyle(fontSize: 11)))).toList(),
        onChanged: onChanged,
        underline: const SizedBox(),
        isDense: true,
        icon: const Icon(Icons.arrow_drop_down, size: 14, color: AppTheme.textTertiary),
        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
        dropdownColor: AppTheme.surface,
      ),
    );
  }
}

// ─── Empty State ───────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.photo_library_outlined, size: 64, color: AppTheme.textTertiary.withAlpha(75)),
          const SizedBox(height: 16),
          const Text('No photos in catalog', style: TextStyle(color: AppTheme.textSecondary, fontSize: 16, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          const Text('Import photos to get started', style: TextStyle(color: AppTheme.textTertiary, fontSize: 13)),
          const SizedBox(height: 24),
          Material(
            color: AppTheme.gold,
            borderRadius: BorderRadius.circular(AppTheme.borderRadius),
            child: InkWell(
              onTap: () => ImportWizard.show(context),
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.add, size: 16, color: Colors.black),
                  SizedBox(width: 8),
                  Text('Import Photos', style: TextStyle(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 13)),
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Photo Grid ────────────────────────────────────────────

class _PhotoGrid extends ConsumerWidget {
  final List<PhotoModel> photos;
  const _PhotoGrid({required this.photos});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gridSize = ref.watch(gridSizeProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: gridSize,
        childAspectRatio: 1,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: photos.length,
      itemBuilder: (context, index) {
        final photo = photos[index];
        final isSelected = selectedPhoto?.photoId == photo.photoId;
        return PhotoGridItem(
          photo: photo,
          isSelected: isSelected,
          onTap: () => ref.read(selectedPhotoProvider.notifier).state = photo,
          onRatingChanged: (rating) => ref.read(photosProvider.notifier).updateRating(photo.photoId, rating),
        );
      },
    );
  }
}
