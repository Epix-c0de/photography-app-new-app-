import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/export_engine/profiles.dart' as profiles;

class ExportScreen extends ConsumerWidget {
  const ExportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(photosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return Row(
      children: [
        // ─── Left Panel: Export Settings ────────────────
        Container(
          width: 320,
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: AppTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _PanelHeader(title: 'EXPORT SETTINGS'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    // Format
                    _ExportSection(
                      title: 'FORMAT',
                      child: _ExportDropdown(
                        value: 'JPEG',
                        items: ['JPEG', 'PNG', 'TIFF', 'WebP'],
                        onChanged: (v) {},
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Quality
                    _ExportSection(
                      title: 'QUALITY',
                      child: Row(
                        children: [
                          Expanded(
                            child: Slider(
                              value: 85,
                              min: 1,
                              max: 100,
                              onChanged: (v) {},
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            '85%',
                            style: TextStyle(color: AppTheme.textPrimary, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Resize
                    _ExportSection(
                      title: 'RESIZE',
                      child: _ExportDropdown(
                        value: 'Original',
                        items: ['Original', '2048px', '1080px', 'Custom'],
                        onChanged: (v) {},
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Color Space
                    _ExportSection(
                      title: 'COLOR SPACE',
                      child: _ExportDropdown(
                        value: 'sRGB',
                        items: ['sRGB', 'Adobe RGB', 'ProPhoto RGB'],
                        onChanged: (v) {},
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Output folder
                    _ExportSection(
                      title: 'OUTPUT FOLDER',
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppTheme.background,
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                          border: Border.all(color: AppTheme.border),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.folder_outlined, size: 14, color: AppTheme.textTertiary),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '~/Desktop/Exports',
                                style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Icon(Icons.edit_outlined, size: 12, color: AppTheme.textTertiary),
                          ],
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Naming
                    _ExportSection(
                      title: 'NAMING',
                      child: _ExportDropdown(
                        value: 'Original Name',
                        items: ['Original Name', 'Custom Prefix', 'Sequence'],
                        onChanged: (v) {},
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Preset Profiles
                    _ExportSection(
                      title: 'PROFILES',
                      child: Column(
                        children: [
                          _ProfileButton(
                            label: 'Web',
                            description: 'JPEG, sRGB, 2048px, 85%',
                            icon: Icons.language,
                          ),
                          const SizedBox(height: 6),
                          _ProfileButton(
                            label: 'Print',
                            description: 'TIFF, Adobe RGB, Full res',
                            icon: Icons.print,
                          ),
                          const SizedBox(height: 6),
                          _ProfileButton(
                            label: 'Social',
                            description: 'JPEG, sRGB, 1080px, 80%',
                            icon: Icons.share,
                          ),
                          const SizedBox(height: 6),
                          _ProfileButton(
                            label: 'Archive',
                            description: 'TIFF, ProPhoto, Full res',
                            icon: Icons.archive,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              
              // Export button
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppTheme.border)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Material(
                        color: AppTheme.gold,
                        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                        child: InkWell(
                          onTap: () {},
                          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                          child: const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Center(
                              child: Text(
                                'Export 1 Photo',
                                style: TextStyle(
                                  color: Colors.black,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // ─── Center: Preview & Queue ────────────────────
        Expanded(
          child: Column(
            children: [
              // Preview
              Expanded(
                flex: 2,
                child: Container(
                  color: AppTheme.background,
                  child: Center(
                    child: selectedPhoto == null
                        ? const Text(
                            'Select a photo to preview export',
                            style: TextStyle(color: AppTheme.textTertiary),
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.image_outlined, size: 48, color: AppTheme.textTertiary.withValues(alpha:0.3)),
                              const SizedBox(height: 12),
                              Text(
                                selectedPhoto.filename,
                                style: const TextStyle(color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
              
              // Export Queue
              Container(
                height: 200,
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: AppTheme.border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      height: 36,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: const BoxDecoration(
                        border: Border(bottom: BorderSide(color: AppTheme.border)),
                      ),
                      child: const Row(
                        children: [
                          Text(
                            'EXPORT QUEUE',
                            style: TextStyle(
                              color: AppTheme.textTertiary,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                          Spacer(),
                          Text(
                            '0 items',
                            style: TextStyle(color: AppTheme.textTertiary, fontSize: 10),
                          ),
                        ],
                      ),
                    ),
                    const Expanded(
                      child: Center(
                        child: Text(
                          'No exports in queue',
                          style: TextStyle(color: AppTheme.textTertiary, fontSize: 12),
                        ),
                      ),
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
}

class _PanelHeader extends StatelessWidget {
  final String title;

  const _PanelHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppTheme.border)),
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          title,
          style: const TextStyle(
            color: AppTheme.textTertiary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }
}

class _ExportSection extends StatelessWidget {
  final String title;
  final Widget child;

  const _ExportSection({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: AppTheme.textTertiary,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

class _ExportDropdown extends StatelessWidget {
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  const _ExportDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: AppTheme.border),
      ),
      child: DropdownButton<String>(
        value: value,
        isExpanded: true,
        underline: const SizedBox(),
        icon: const Icon(Icons.arrow_drop_down, size: 14, color: AppTheme.textTertiary),
        style: const TextStyle(color: AppTheme.textPrimary, fontSize: 12),
        dropdownColor: AppTheme.surface,
        items: items.map((item) {
          return DropdownMenuItem(value: item, child: Text(item));
        }).toList(),
        onChanged: onChanged,
      ),
    );
  }
}

class _ProfileButton extends StatelessWidget {
  final String label;
  final String description;
  final IconData icon;

  const _ProfileButton({
    required this.label,
    required this.description,
    required this.icon,
  });

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
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.borderRadius),
            border: Border.all(color: AppTheme.border),
          ),
          child: Row(
            children: [
              Icon(icon, size: 16, color: AppTheme.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: AppTheme.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      description,
                      style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios, size: 10, color: AppTheme.textTertiary),
            ],
          ),
        ),
      ),
    );
  }
}
