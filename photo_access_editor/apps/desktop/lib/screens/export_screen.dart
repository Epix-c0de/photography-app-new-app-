import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path/path.dart' as p;
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';

class ExportScreen extends ConsumerWidget {
  const ExportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(photosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return Row(
      children: [
        // ─── Left: Settings ─────────────────────────────
        Container(
          width: 320,
          decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppTheme.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Hdr(title: 'EXPORT SETTINGS'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _Sec(title: 'FORMAT', child: _Dropdown(value: 'JPEG', items: const ['JPEG', 'PNG', 'TIFF', 'WebP'], onChanged: (v) {})),
                    const SizedBox(height: 16),
                    _Sec(title: 'QUALITY', child: Row(children: [
                      Expanded(child: Slider(value: 85, min: 1, max: 100, onChanged: (v) {})),
                      const SizedBox(width: 8),
                      const Text('85%', style: TextStyle(color: AppTheme.textPrimary, fontSize: 12)),
                    ])),
                    const SizedBox(height: 16),
                    _Sec(title: 'RESIZE', child: _Dropdown(value: 'Original', items: const ['Original', '2048px', '1080px', 'Custom'], onChanged: (v) {})),
                    const SizedBox(height: 16),
                    _Sec(title: 'COLOR SPACE', child: _Dropdown(value: 'sRGB', items: const ['sRGB', 'Adobe RGB', 'ProPhoto RGB'], onChanged: (v) {})),
                    const SizedBox(height: 16),
                    _Sec(title: 'OUTPUT FOLDER', child: _OutputFolder()),
                    const SizedBox(height: 16),
                    _Sec(title: 'NAMING', child: _Dropdown(value: 'Original Name', items: const ['Original Name', 'Custom Prefix', 'Sequence'], onChanged: (v) {})),
                    const SizedBox(height: 24),
                    _Sec(title: 'PROFILES', child: Column(children: [
                      _ProfileBtn(label: 'Web', desc: 'JPEG, sRGB, 2048px, 85%', icon: Icons.language),
                      const SizedBox(height: 6),
                      _ProfileBtn(label: 'Print', desc: 'TIFF, Adobe RGB, Full res', icon: Icons.print),
                      const SizedBox(height: 6),
                      _ProfileBtn(label: 'Social', desc: 'JPEG, sRGB, 1080px, 80%', icon: Icons.share),
                      const SizedBox(height: 6),
                      _ProfileBtn(label: 'Archive', desc: 'TIFF, ProPhoto, Full res', icon: Icons.archive),
                    ])),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.border))),
                child: Material(
                  color: AppTheme.gold,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  child: InkWell(
                    onTap: () => _exportPhoto(context, ref),
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Center(
                        child: Text(
                          selectedPhoto != null ? 'Export ${selectedPhoto.filename}' : 'Export ${photos.length} Photos',
                          style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        // ─── Center: Preview ────────────────────────────
        Expanded(
          child: Column(
            children: [
              Expanded(
                flex: 2,
                child: Container(
                  color: AppTheme.background,
                  child: Center(
                    child: selectedPhoto == null
                        ? const Text('Select a photo to preview export', style: TextStyle(color: AppTheme.textTertiary))
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                                child: Image.file(
                                  File(selectedPhoto.filePath),
                                  height: 300,
                                  fit: BoxFit.contain,
                                  gaplessPlayback: true,
                                  errorBuilder: (ctx, e, s) => const Icon(Icons.broken_image, size: 48, color: AppTheme.textTertiary),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(selectedPhoto.filename, style: const TextStyle(color: AppTheme.textSecondary)),
                            ],
                          ),
                  ),
                ),
              ),
              Container(
                height: 200,
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppTheme.border))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 36,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
                      child: Row(children: [
                        const Text('EXPORT QUEUE', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                        const Spacer(),
                        Text('${photos.length} photos in catalog', style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10)),
                      ]),
                    ),
                    const Expanded(
                      child: Center(child: Text('No exports in queue', style: TextStyle(color: AppTheme.textTertiary, fontSize: 12))),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _exportPhoto(BuildContext context, WidgetRef ref) async {
    final selected = ref.read(selectedPhotoProvider);
    if (selected == null) return;

    final outputPath = await FilePicker.platform.saveFile(
      dialogTitle: 'Export Photo',
      fileName: '${p.basenameWithoutExtension(selected.filename)}.jpg',
    );

    if (outputPath != null) {
      // Copy file for now (real export would use Rust export_engine)
      await File(selected.filePath).copy(outputPath);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Exported to $outputPath'), backgroundColor: AppTheme.green),
        );
      }
    }
  }
}

class _Hdr extends StatelessWidget {
  final String title;
  const _Hdr({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
      child: Align(alignment: Alignment.centerLeft, child: Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5))),
    );
  }
}

class _Sec extends StatelessWidget {
  final String title;
  final Widget child;
  const _Sec({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

class _Dropdown extends StatelessWidget {
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;
  const _Dropdown({required this.value, required this.items, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.border)),
      child: DropdownButton<String>(
        value: value, isExpanded: true, underline: const SizedBox(),
        icon: const Icon(Icons.arrow_drop_down, size: 14, color: AppTheme.textTertiary),
        style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12),
        dropdownColor: AppTheme.surface,
        items: items.map((i) => DropdownMenuItem(value: i, child: Text(i))).toList(),
        onChanged: onChanged,
      ),
    );
  }
}

class _OutputFolder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.border)),
      child: const Row(children: [
        Icon(Icons.folder_outlined, size: 14, color: AppTheme.textTertiary),
        SizedBox(width: 8),
        Expanded(child: Text('~/Desktop/Exports', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11), overflow: TextOverflow.ellipsis)),
        Icon(Icons.edit_outlined, size: 12, color: AppTheme.textTertiary),
      ]),
    );
  }
}

class _ProfileBtn extends StatelessWidget {
  final String label;
  final String desc;
  final IconData icon;
  const _ProfileBtn({required this.label, required this.desc, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppTheme.surfaceLight,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.border)),
          child: Row(children: [
            Icon(icon, size: 16, color: AppTheme.gold),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12, fontWeight: FontWeight.w500)),
              Text(desc, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10)),
            ])),
            const Icon(Icons.arrow_forward_ios, size: 10, color: AppTheme.textTertiary),
          ]),
        ),
      ),
    );
  }
}
