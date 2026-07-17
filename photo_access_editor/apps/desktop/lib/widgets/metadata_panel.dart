import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:intl/intl.dart';

class MetadataPanel extends ConsumerWidget {
  const MetadataPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photo = ref.watch(selectedPhotoProvider);
    if (photo == null) return const SizedBox.shrink();

    return Container(
      width: AppTheme.panelWidth,
      decoration: const BoxDecoration(color: AppTheme.surface, border: Border(left: BorderSide(color: AppTheme.border))),
      child: Column(
        children: [
          Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
            child: const Row(children: [
              Icon(Icons.info_outline, size: 14, color: AppTheme.textSecondary),
              SizedBox(width: 8),
              Text('Metadata', style: TextStyle(color: AppTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w600)),
            ]),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                _Section(title: 'FILE', children: [
                  _Row(label: 'Name', value: photo.filename),
                  _Row(label: 'Type', value: photo.extension),
                  _Row(label: 'Format', value: photo.isRaw ? 'RAW' : 'Standard'),
                ]),
                const SizedBox(height: 16),
                _Section(title: 'CAMERA', children: [
                  _Row(label: 'Make', value: photo.cameraMake ?? '—'),
                  _Row(label: 'Model', value: photo.cameraModel ?? '—'),
                  _Row(label: 'Lens', value: photo.lens ?? '—'),
                  _Row(label: 'ISO', value: photo.iso?.toString() ?? '—'),
                  _Row(label: 'Aperture', value: photo.aperture != null ? 'f/${photo.aperture}' : '—'),
                  _Row(label: 'Shutter', value: photo.shutterSpeed ?? '—'),
                  _Row(label: 'Focal Length', value: photo.focalLength != null ? '${photo.focalLength}mm' : '—'),
                ]),
                const SizedBox(height: 16),
                _Section(title: 'DATE', children: [
                  _Row(label: 'Captured', value: photo.captureDate != null ? DateFormat('MMM d, yyyy HH:mm').format(photo.captureDate!) : '—'),
                ]),
                const SizedBox(height: 16),
                _Section(title: 'RATING', child: Row(
                  children: List.generate(5, (i) => GestureDetector(
                    onTap: () => ref.read(photosProvider.notifier).updateRating(photo.photoId, i + 1),
                    child: Icon(Icons.star, size: 20, color: i < photo.rating ? AppTheme.gold : AppTheme.textTertiary),
                  )),
                )),
                const SizedBox(height: 16),
                _Section(title: 'FLAG', child: Row(children: [
                  _FlagBtn(icon: Icons.flag, color: AppTheme.green, isActive: photo.flag == 'pick', onTap: () => ref.read(photosProvider.notifier).updateFlag(photo.photoId, photo.flag == 'pick' ? 'none' : 'pick')),
                  const SizedBox(width: 8),
                  _FlagBtn(icon: Icons.flag, color: AppTheme.red, isActive: photo.flag == 'reject', onTap: () => ref.read(photosProvider.notifier).updateFlag(photo.photoId, photo.flag == 'reject' ? 'none' : 'reject')),
                  const SizedBox(width: 8),
                  _FlagBtn(icon: Icons.help_outline, color: AppTheme.orange, isActive: photo.flag == 'review', onTap: () => ref.read(photosProvider.notifier).updateFlag(photo.photoId, photo.flag == 'review' ? 'none' : 'review')),
                ])),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget>? children;
  final Widget? child;
  const _Section({required this.title, this.children, this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        if (child != null) child!,
        if (children != null) ...children!,
      ],
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  const _Row({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 11)),
          Flexible(child: Text(value, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 11), overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

class _FlagBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final bool isActive;
  final VoidCallback onTap;
  const _FlagBtn({required this.icon, required this.color, required this.isActive, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32, height: 32,
        decoration: BoxDecoration(
          color: isActive ? color.withAlpha(50) : AppTheme.surfaceLight,
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          border: Border.all(color: isActive ? color : AppTheme.border),
        ),
        child: Icon(icon, size: 14, color: isActive ? color : AppTheme.textTertiary),
      ),
    );
  }
}
