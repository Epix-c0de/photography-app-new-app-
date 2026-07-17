import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';
import 'package:photo_access_editor/widgets/adjustment_slider.dart';
import 'package:photo_access_editor/widgets/histogram_widget.dart';
import 'package:photo_access_editor/widgets/curves_panel.dart';
import 'package:photo_access_editor/widgets/hsl_panel.dart';
import 'package:photo_access_editor/widgets/color_grading_panel.dart';
import 'package:photo_access_editor/widgets/crop_tool.dart';

class DevelopScreen extends ConsumerWidget {
  const DevelopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPhoto = ref.watch(selectedPhotoProvider);
    final editState = ref.watch(editStateProvider);
    final activeTool = ref.watch(activeDevelopToolProvider);

    return Row(
      children: [
        // ─── Left: Presets & History ────────────────────
        Container(
          width: 220,
          decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppTheme.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(title: 'PRESETS'),
              Expanded(
                flex: 2,
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _PresetCat(title: 'Favorites', items: const []),
                    const SizedBox(height: 12),
                    _PresetCat(title: 'Wedding', items: const ['Warm Glow', 'Soft Light', 'Golden Hour']),
                    const SizedBox(height: 12),
                    _PresetCat(title: 'Portrait', items: const ['Skin Tone', 'Studio Light', 'Dramatic']),
                    const SizedBox(height: 12),
                    _PresetCat(title: 'Landscape', items: const ['Vivid', 'HDR', 'Sunset']),
                  ],
                ),
              ),
              const Divider(height: 1),
              _Header(title: 'HISTORY'),
              Expanded(flex: 1, child: _HistoryList()),
            ],
          ),
        ),

        // ─── Center: Photo Viewer ───────────────────────
        Expanded(
          child: Column(
            children: [
              // Toolbar
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
                child: Row(
                  children: [
                    IconButton(icon: const Icon(Icons.zoom_out, size: 16), onPressed: () {}),
                    const Text('100%', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                    IconButton(icon: const Icon(Icons.zoom_in, size: 16), onPressed: () {}),
                    const SizedBox(width: 8),
                    IconButton(icon: const Icon(Icons.fit_screen, size: 16), onPressed: () {}),
                    const Spacer(),
                    _TbBtn(icon: Icons.compare, label: 'Compare', onTap: () {}),
                    const SizedBox(width: 8),
                    _TbBtn(icon: Icons.restart_alt, label: 'Reset', onTap: () => ref.read(editStateProvider.notifier).reset()),
                  ],
                ),
              ),
              // Photo viewer with crop overlay
              Expanded(
                child: Container(
                  color: AppTheme.background,
                  child: selectedPhoto == null
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.tune, size: 48, color: AppTheme.textTertiary),
                              SizedBox(height: 12),
                              Text('Select a photo to edit', style: TextStyle(color: AppTheme.textSecondary)),
                            ],
                          ),
                        )
                      : _AdjustedPhotoViewer(
                          photoPath: selectedPhoto.filePath,
                          photoId: selectedPhoto.photoId,
                          showCropOverlay: activeTool == DevelopTool.crop,
                        ),
                ),
              ),
              const Filmstrip(),
            ],
          ),
        ),

        // ─── Right: Editing Tools ───────────────────────
        Container(
          width: AppTheme.panelWidth,
          decoration: const BoxDecoration(border: Border(left: BorderSide(color: AppTheme.border))),
          child: _EditingToolsPanel(),
        ),
      ],
    );
  }
}

// ─── Adjusted Photo Viewer (shows processed image) ────────

class _AdjustedPhotoViewer extends ConsumerWidget {
  final String photoPath;
  final String photoId;
  final bool showCropOverlay;

  const _AdjustedPhotoViewer({required this.photoPath, required this.photoId, this.showCropOverlay = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final previewAsync = ref.watch(previewImageProvider(photoId));
    final crop = ref.watch(editStateProvider).crop;

    return Stack(
      children: [
        Center(
          child: InteractiveViewer(
            maxScale: 5.0,
            minScale: 0.1,
            child: previewAsync.when(
              data: (file) {
                if (file == null) return _buildOriginal(photoPath);
                return Image.file(
                  file,
                  fit: BoxFit.contain,
                  gaplessPlayback: true,
                  errorBuilder: (_, __, ___) => _buildOriginal(photoPath),
                );
              },
              loading: () => Stack(
                alignment: Alignment.center,
                children: [
                  _buildOriginal(photoPath),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(8)),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.gold)),
                        SizedBox(width: 8),
                        Text('Processing...', style: TextStyle(color: Colors.white, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
              error: (_, __) => _buildOriginal(photoPath),
            ),
          ),
        ),
        if (showCropOverlay) CropGridOverlay(crop: crop),
      ],
    );
  }

  Widget _buildOriginal(String path) {
    return Image.file(
      File(path),
      fit: BoxFit.contain,
      gaplessPlayback: true,
      errorBuilder: (_, __, ___) => const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.broken_image, size: 48, color: AppTheme.textTertiary),
            SizedBox(height: 8),
            Text('Failed to load image', style: TextStyle(color: AppTheme.textTertiary)),
          ],
        ),
      ),
    );
  }
}

// ─── Editing Tools Panel ───────────────────────────────────

class _EditingToolsPanel extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final es = ref.watch(editStateProvider);
    final activeTool = ref.watch(activeDevelopToolProvider);

    return Column(
      children: [
        // Tool tabs
        Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
          child: Row(
            children: [
              _ToolTab(label: 'Basic', tool: DevelopTool.basic, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.basic),
              _ToolTab(label: 'Curves', tool: DevelopTool.curves, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.curves),
              _ToolTab(label: 'HSL', tool: DevelopTool.hsl, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.hsl),
              _ToolTab(label: 'Grading', tool: DevelopTool.colorGrading, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.colorGrading),
              _ToolTab(label: 'Crop', tool: DevelopTool.crop, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.crop),
              _ToolTab(label: 'Lens', tool: DevelopTool.lens, active: activeTool, onTap: () => ref.read(activeDevelopToolProvider.notifier).state = DevelopTool.lens),
            ],
          ),
        ),
        // Tool content
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              if (activeTool == DevelopTool.basic) ...[
                const HistogramWidget(),
                const SizedBox(height: 16),
                AdjustmentSlider(label: 'Exposure', value: es.exposure, min: -5, max: 5, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateExposure(v)),
                AdjustmentSlider(label: 'Contrast', value: es.contrast, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateContrast(v)),
                AdjustmentSlider(label: 'Highlights', value: es.highlights, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateHighlights(v)),
                AdjustmentSlider(label: 'Shadows', value: es.shadows, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateShadows(v)),
                AdjustmentSlider(label: 'Whites', value: es.whites, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateWhites(v)),
                AdjustmentSlider(label: 'Blacks', value: es.blacks, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateBlacks(v)),
                const SizedBox(height: 12),
                const Divider(color: AppTheme.border),
                const SizedBox(height: 12),
                AdjustmentSlider(label: 'Texture', value: es.texture, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateTexture(v)),
                AdjustmentSlider(label: 'Clarity', value: es.clarity, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateClarity(v)),
                AdjustmentSlider(label: 'Dehaze', value: es.dehaze, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateDehaze(v)),
                const SizedBox(height: 12),
                const Divider(color: AppTheme.border),
                const SizedBox(height: 12),
                AdjustmentSlider(label: 'Temperature', value: es.temperature, min: 2000, max: 50000, defaultValue: 5500, onChanged: (v) => ref.read(editStateProvider.notifier).updateTemperature(v)),
                AdjustmentSlider(label: 'Tint', value: es.tint, min: -150, max: 150, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateTint(v)),
                AdjustmentSlider(label: 'Vibrance', value: es.vibrance, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateVibrance(v)),
                AdjustmentSlider(label: 'Saturation', value: es.saturation, min: -100, max: 100, defaultValue: 0, onChanged: (v) => ref.read(editStateProvider.notifier).updateSaturation(v)),
              ],
              if (activeTool == DevelopTool.curves) const CurvesPanel(),
              if (activeTool == DevelopTool.hsl) const HslPanel(),
              if (activeTool == DevelopTool.colorGrading) const ColorGradingPanel(),
              if (activeTool == DevelopTool.crop) const CropOverlay(),
              if (activeTool == DevelopTool.lens) ...[
                const Text('LENS CORRECTIONS', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                const SizedBox(height: 12),
                AdjustmentSlider(label: 'Distortion', value: es.lensCorrections.distortion, min: -100, max: 100, defaultValue: 0,
                  onChanged: (v) => ref.read(editStateProvider.notifier).updateLensCorrections(es.lensCorrections.copyWith(distortion: v))),
                AdjustmentSlider(label: 'Vignetting', value: es.lensCorrections.vignetting, min: -100, max: 100, defaultValue: 0,
                  onChanged: (v) => ref.read(editStateProvider.notifier).updateLensCorrections(es.lensCorrections.copyWith(vignetting: v))),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Chromatic Aberration', style: TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
                    const Spacer(),
                    Switch(
                      value: es.lensCorrections.chromaticAberration,
                      onChanged: (v) => ref.read(editStateProvider.notifier).updateLensCorrections(es.lensCorrections.copyWith(chromaticAberration: v)),
                      activeColor: AppTheme.gold,
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Tool Tab ──────────────────────────────────────────────

class _ToolTab extends StatelessWidget {
  final String label;
  final DevelopTool tool;
  final DevelopTool active;
  final VoidCallback onTap;
  const _ToolTab({required this.label, required this.tool, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isSelected = tool == active;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: isSelected ? AppTheme.gold : Colors.transparent, width: 2)),
        ),
        child: Text(label, style: TextStyle(
          color: isSelected ? AppTheme.gold : AppTheme.textTertiary,
          fontSize: 10, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
        )),
      ),
    );
  }
}

// ─── Preset Category ───────────────────────────────────────

class _PresetCat extends StatelessWidget {
  final String title;
  final List<String> items;
  const _PresetCat({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
        if (items.isEmpty)
          const Padding(padding: EdgeInsets.only(top: 8), child: Text('No presets saved', style: TextStyle(color: AppTheme.textTertiary, fontSize: 11)))
        else
          ...items.map((item) => Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Material(
              color: AppTheme.surfaceLight,
              borderRadius: BorderRadius.circular(AppTheme.borderRadius),
              child: InkWell(
                onTap: () {},
                borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                child: Container(padding: const EdgeInsets.all(8), child: Text(item, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11))),
              ),
            ),
          )),
      ],
    );
  }
}

// ─── History List ──────────────────────────────────────────

class _HistoryList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.read(editStateProvider.notifier).history;

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: history.count,
      itemBuilder: (context, index) {
        final isCurrent = index == history.count - 1;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: isCurrent ? AppTheme.gold.withAlpha(25) : Colors.transparent,
            borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          ),
          child: Row(
            children: [
              Container(width: 4, height: 4, decoration: BoxDecoration(color: isCurrent ? AppTheme.gold : AppTheme.textTertiary, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  index == 0 ? 'Original' : 'Edit $index',
                  style: TextStyle(color: isCurrent ? AppTheme.textPrimary : AppTheme.textSecondary, fontSize: 11),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Header ────────────────────────────────────────────────

class _Header extends StatelessWidget {
  final String title;
  const _Header({required this.title});

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

// ─── Toolbar Button ────────────────────────────────────────

class _TbBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _TbBtn({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 14, color: AppTheme.textSecondary),
            const SizedBox(width: 4),
            Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
          ]),
        ),
      ),
    );
  }
}
