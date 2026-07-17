import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/models/models.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';
import 'package:photo_access_editor/widgets/adjustment_slider.dart';

class RetouchScreen extends ConsumerWidget {
  const RetouchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedPhoto = ref.watch(selectedPhotoProvider);
    final retouch = ref.watch(retouchStateProvider);

    return Row(
      children: [
        // ─── Left: Categories ───────────────────────────
        Container(
          width: 200,
          decoration: const BoxDecoration(border: Border(right: BorderSide(color: AppTheme.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Hdr(title: 'RETOUCH'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(8),
                  children: const [
                    _Cat(icon: Icons.face, label: 'Face', isActive: true),
                    _Cat(icon: Icons.visibility, label: 'Eyes'),
                    _Cat(icon: Icons.sentiment_satisfied_alt, label: 'Teeth'),
                    _Cat(icon: Icons.content_cut, label: 'Hair'),
                    _Cat(icon: Icons.accessibility_new, label: 'Body'),
                    _Cat(icon: Icons.checkroom, label: 'Clothing'),
                    _Cat(icon: Icons.landscape, label: 'Background'),
                    SizedBox(height: 16),
                    Divider(color: AppTheme.border),
                    SizedBox(height: 8),
                    _Cat(icon: Icons.healing, label: 'Healing'),
                    _Cat(icon: Icons.content_copy, label: 'Clone'),
                  ],
                ),
              ),
            ],
          ),
        ),

        // ─── Center: Viewer ─────────────────────────────
        Expanded(
          child: Column(
            children: [
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppTheme.border))),
                child: const Row(children: [
                  Text('RETOUCH', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                  Spacer(),
                  Icon(Icons.circle, size: 12, color: AppTheme.textSecondary),
                  SizedBox(width: 8),
                  Icon(Icons.circle, size: 16, color: AppTheme.textSecondary),
                  SizedBox(width: 8),
                  Icon(Icons.circle, size: 20, color: AppTheme.textSecondary),
                ]),
              ),
              Expanded(
                child: Container(
                  color: AppTheme.background,
                  child: selectedPhoto == null
                      ? const Center(child: Text('Select a photo to retouch', style: TextStyle(color: AppTheme.textTertiary)))
                      : Center(
                          child: InteractiveViewer(
                            maxScale: 5.0,
                            child: Image.file(
                              File(selectedPhoto.filePath),
                              fit: BoxFit.contain,
                              gaplessPlayback: true,
                              errorBuilder: (ctx, e, s) => const Icon(Icons.broken_image, size: 48, color: AppTheme.textTertiary),
                            ),
                          ),
                        ),
                ),
              ),
              const Filmstrip(),
            ],
          ),
        ),

        // ─── Right: Controls ────────────────────────────
        Container(
          width: AppTheme.panelWidth,
          decoration: const BoxDecoration(border: Border(left: BorderSide(color: AppTheme.border))),
          child: Column(
            children: [
              _Hdr(title: 'FACE RETOUCH'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    AdjustmentSlider(label: 'Skin Smoothing', value: retouch.skinSmoothing, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateSkinSmoothing(v)),
                    AdjustmentSlider(label: 'Blemish Removal', value: retouch.blemishRemoval, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateBlemishRemoval(v)),
                    AdjustmentSlider(label: 'Pore Refinement', value: retouch.poreRefinement, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updatePoreRefinement(v)),
                    AdjustmentSlider(label: 'Shine Reduction', value: retouch.shineReduction, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateShineReduction(v)),
                    const SizedBox(height: 12),
                    const Divider(color: AppTheme.border),
                    const SizedBox(height: 12),
                    const Text('TEXTURE PROTECTION', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    AdjustmentSlider(label: 'Detail Preservation', value: retouch.detailPreservation, min: 0, max: 100, defaultValue: 50, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateDetailPreservation(v)),
                    const SizedBox(height: 12),
                    const Divider(color: AppTheme.border),
                    const SizedBox(height: 12),
                    const Text('EYES', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    AdjustmentSlider(label: 'Eye Whitening', value: retouch.eyeWhitening, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateEyeWhitening(v)),
                    AdjustmentSlider(label: 'Eye Sharpening', value: retouch.eyeSharpening, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateEyeSharpening(v)),
                    const SizedBox(height: 12),
                    const Divider(color: AppTheme.border),
                    const SizedBox(height: 12),
                    const Text('TEETH', style: TextStyle(color: AppTheme.textTertiary, fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    AdjustmentSlider(label: 'Teeth Whitening', value: retouch.teethWhitening, min: 0, max: 100, defaultValue: 0, onChanged: (v) => ref.read(retouchStateProvider.notifier).updateTeethWhitening(v)),
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

class _Cat extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  const _Cat({required this.icon, required this.label, this.isActive = false});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppTheme.gold.withAlpha(25) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: isActive ? BoxDecoration(borderRadius: BorderRadius.circular(AppTheme.borderRadius), border: Border.all(color: AppTheme.gold.withAlpha(75))) : null,
          child: Row(children: [
            Icon(icon, size: 16, color: isActive ? AppTheme.gold : AppTheme.textSecondary),
            const SizedBox(width: 10),
            Text(label, style: TextStyle(color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary, fontSize: 12, fontWeight: isActive ? FontWeight.w500 : FontWeight.normal)),
          ]),
        ),
      ),
    );
  }
}
