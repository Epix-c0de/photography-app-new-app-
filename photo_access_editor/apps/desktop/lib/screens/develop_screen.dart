import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';
import 'package:photo_access_editor/widgets/adjustment_slider.dart';

class DevelopScreen extends ConsumerWidget {
  const DevelopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return Row(
      children: [
        // ─── Left Panel: Presets & History ──────────────
        Container(
          width: 220,
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: AppTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHeader(title: 'PRESETS'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _PresetCategory(title: 'Favorites', items: []),
                    const SizedBox(height: 12),
                    _PresetCategory(
                      title: 'Wedding',
                      items: ['Warm Glow', 'Soft Light', 'Golden Hour'],
                    ),
                    const SizedBox(height: 12),
                    _PresetCategory(
                      title: 'Portrait',
                      items: ['Skin Tone', 'Studio Light', 'Dramatic'],
                    ),
                    const SizedBox(height: 12),
                    _PresetCategory(
                      title: 'Landscape',
                      items: ['Vivid', 'HDR', 'Sunset'],
                    ),
                  ],
                ),
              ),
              
              const Divider(height: 1),
              
              _PanelHeader(title: 'HISTORY'),
              Expanded(
                flex: 1,
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _HistoryItem(label: 'Original', timestamp: 'Now', isActive: true),
                    _HistoryItem(label: 'Exposure +0.5', timestamp: '2s ago'),
                    _HistoryItem(label: 'Contrast +15', timestamp: '5s ago'),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // ─── Center: Photo Viewer ───────────────────────
        Expanded(
          child: Column(
            children: [
              // Viewer toolbar
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppTheme.border)),
                ),
                child: Row(
                  children: [
                    // Zoom controls
                    IconButton(
                      icon: const Icon(Icons.zoom_out, size: 16),
                      onPressed: () {},
                      tooltip: 'Zoom Out',
                    ),
                    const Text(
                      '100%',
                      style: TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                    ),
                    IconButton(
                      icon: const Icon(Icons.zoom_in, size: 16),
                      onPressed: () {},
                      tooltip: 'Zoom In',
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.fit_screen, size: 16),
                      onPressed: () {},
                      tooltip: 'Fit to Screen',
                    ),
                    const Spacer(),
                    // Before/After toggle
                    _ToolbarButton(
                      icon: Icons.compare,
                      label: 'Compare',
                      isActive: false,
                      onTap: () {},
                    ),
                    const SizedBox(width: 8),
                    // Reset button
                    _ToolbarButton(
                      icon: Icons.restart_alt,
                      label: 'Reset',
                      onTap: () {
                        ref.read(editStateProvider.notifier).reset();
                      },
                    ),
                  ],
                ),
              ),
              
              // Photo viewer
              Expanded(
                child: Container(
                  color: AppTheme.background,
                  child: Center(
                    child: selectedPhoto == null
                        ? const Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.tune, size: 48, color: AppTheme.textTertiary),
                              SizedBox(height: 12),
                              Text(
                                'Select a photo to edit',
                                style: TextStyle(color: AppTheme.textSecondary),
                              ),
                            ],
                          )
                        : const Text(
                            'Photo Viewer (GPU Preview)',
                            style: TextStyle(color: AppTheme.textTertiary),
                          ),
                  ),
                ),
              ),
              
              // Filmstrip
              const Filmstrip(),
            ],
          ),
        ),
        
        // ─── Right Panel: Editing Tools ─────────────────
        Container(
          width: AppTheme.panelWidth,
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: AppTheme.border)),
          ),
          child: const _EditingToolsPanel(),
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

class _ToolbarButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _ToolbarButton({
    required this.icon,
    required this.label,
    this.isActive = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppTheme.gold.withValues(alpha:0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: isActive ? AppTheme.gold : AppTheme.textSecondary),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: isActive ? AppTheme.gold : AppTheme.textSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Preset Category ───────────────────────────────────────

class _PresetCategory extends StatelessWidget {
  final String title;
  final List<String> items;

  const _PresetCategory({required this.title, required this.items});

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
        if (items.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
              'No presets saved',
              style: TextStyle(color: AppTheme.textTertiary, fontSize: 11),
            ),
          )
        else
          ...items.map((item) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Material(
                  color: AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  child: InkWell(
                    onTap: () {},
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      child: Text(
                        item,
                        style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
                      ),
                    ),
                  ),
                ),
              )),
      ],
    );
  }
}

// ─── History Item ──────────────────────────────────────────

class _HistoryItem extends StatelessWidget {
  final String label;
  final String timestamp;
  final bool isActive;

  const _HistoryItem({
    required this.label,
    required this.timestamp,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isActive ? AppTheme.gold.withValues(alpha:0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 4,
            decoration: BoxDecoration(
              color: isActive ? AppTheme.gold : AppTheme.textTertiary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary,
                fontSize: 11,
              ),
            ),
          ),
          Text(
            timestamp,
            style: const TextStyle(color: AppTheme.textTertiary, fontSize: 9),
          ),
        ],
      ),
    );
  }
}

// ─── Editing Tools Panel ───────────────────────────────────

class _EditingToolsPanel extends ConsumerWidget {
  const _EditingToolsPanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final editState = ref.watch(editStateProvider);

    return Column(
      children: [
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: AppTheme.border)),
          ),
          child: const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'DEVELOP',
              style: TextStyle(
                color: AppTheme.textTertiary,
                fontSize: 10,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ),
        
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              // Histogram placeholder
              Container(
                height: 100,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceLight,
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  border: Border.all(color: AppTheme.border),
                ),
                child: const Center(
                  child: Text(
                    'Histogram',
                    style: TextStyle(color: AppTheme.textTertiary, fontSize: 11),
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Basic Adjustments
              AdjustmentSlider(
                label: 'Exposure',
                value: editState.exposure,
                min: -5.0,
                max: 5.0,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateExposure(value);
                },
              ),
              AdjustmentSlider(
                label: 'Contrast',
                value: editState.contrast,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateContrast(value);
                },
              ),
              AdjustmentSlider(
                label: 'Highlights',
                value: editState.highlights,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateHighlights(value);
                },
              ),
              AdjustmentSlider(
                label: 'Shadows',
                value: editState.shadows,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateShadows(value);
                },
              ),
              AdjustmentSlider(
                label: 'Whites',
                value: editState.whites,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateWhites(value);
                },
              ),
              AdjustmentSlider(
                label: 'Blacks',
                value: editState.blacks,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateBlacks(value);
                },
              ),
              
              const SizedBox(height: 12),
              const Divider(color: AppTheme.border),
              const SizedBox(height: 12),
              
              // Presence
              AdjustmentSlider(
                label: 'Texture',
                value: editState.texture,
                min: 0,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateTexture(value);
                },
              ),
              AdjustmentSlider(
                label: 'Clarity',
                value: editState.clarity,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateClarity(value);
                },
              ),
              AdjustmentSlider(
                label: 'Dehaze',
                value: editState.dehaze,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateDehaze(value);
                },
              ),
              
              const SizedBox(height: 12),
              const Divider(color: AppTheme.border),
              const SizedBox(height: 12),
              
              // Color
              AdjustmentSlider(
                label: 'Temperature',
                value: editState.temperature,
                min: 2000,
                max: 50000,
                defaultValue: 5500,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateTemperature(value);
                },
              ),
              AdjustmentSlider(
                label: 'Tint',
                value: editState.tint,
                min: -150,
                max: 150,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateTint(value);
                },
              ),
              AdjustmentSlider(
                label: 'Vibrance',
                value: editState.vibrance,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateVibrance(value);
                },
              ),
              AdjustmentSlider(
                label: 'Saturation',
                value: editState.saturation,
                min: -100,
                max: 100,
                defaultValue: 0,
                onChanged: (value) {
                  ref.read(editStateProvider.notifier).updateSaturation(value);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}
