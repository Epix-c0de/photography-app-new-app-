import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';
import 'package:photo_access_editor/widgets/filmstrip.dart';
import 'package:photo_access_editor/widgets/adjustment_slider.dart';

class RetouchScreen extends ConsumerWidget {
  const RetouchScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        // ─── Left Panel: Retouch Categories ─────────────
        Container(
          width: 200,
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: AppTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHeader(title: 'RETOUCH'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(8),
                  children: [
                    _RetouchCategory(
                      icon: Icons.face,
                      label: 'Face',
                      isActive: true,
                    ),
                    _RetouchCategory(
                      icon: Icons.visibility,
                      label: 'Eyes',
                    ),
                    _RetouchCategory(
                      icon: Icons.sentiment_satisfied_alt,
                      label: 'Teeth',
                    ),
                    _RetouchCategory(
                      icon: Icons.content_cut,
                      label: 'Hair',
                    ),
                    _RetouchCategory(
                      icon: Icons.accessibility_new,
                      label: 'Body',
                    ),
                    _RetouchCategory(
                      icon: Icons.checkroom,
                      label: 'Clothing',
                    ),
                    _RetouchCategory(
                      icon: Icons.landscape,
                      label: 'Background',
                    ),
                    const SizedBox(height: 16),
                    const Divider(color: AppTheme.border),
                    const SizedBox(height: 8),
                    _RetouchCategory(
                      icon: Icons.healing,
                      label: 'Healing',
                    ),
                    _RetouchCategory(
                      icon: Icons.content_copy,
                      label: 'Clone',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // ─── Center: Image Viewer ───────────────────────
        Expanded(
          child: Column(
            children: [
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppTheme.border)),
                ),
                child: const Row(
                  children: [
                    Text(
                      'RETOUCH',
                      style: TextStyle(
                        color: AppTheme.textTertiary,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Spacer(),
                    // Brush size
                    Icon(Icons.circle, size: 12, color: AppTheme.textSecondary),
                    SizedBox(width: 8),
                    Icon(Icons.circle, size: 16, color: AppTheme.textSecondary),
                    SizedBox(width: 8),
                    Icon(Icons.circle, size: 20, color: AppTheme.textSecondary),
                  ],
                ),
              ),
              
              Expanded(
                child: Container(
                  color: AppTheme.background,
                  child: const Center(
                    child: Text(
                      'Retouch Viewer',
                      style: TextStyle(color: AppTheme.textTertiary),
                    ),
                  ),
                ),
              ),
              
              const Filmstrip(),
            ],
          ),
        ),
        
        // ─── Right Panel: Retouch Controls ──────────────
        Container(
          width: AppTheme.panelWidth,
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: AppTheme.border)),
          ),
          child: const _RetouchControlsPanel(),
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

class _RetouchCategory extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;

  const _RetouchCategory({
    required this.icon,
    required this.label,
    this.isActive = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? AppTheme.gold.withValues(alpha:0.1) : Colors.transparent,
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: isActive
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                  border: Border.all(color: AppTheme.gold.withValues(alpha:0.3)),
                )
              : null,
          child: Row(
            children: [
              Icon(
                icon,
                size: 16,
                color: isActive ? AppTheme.gold : AppTheme.textSecondary,
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  color: isActive ? AppTheme.textPrimary : AppTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetouchControlsPanel extends StatelessWidget {
  const _RetouchControlsPanel();

  @override
  Widget build(BuildContext context) {
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
              'FACE RETOUCH',
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
              AdjustmentSlider(
                label: 'Skin Smoothing',
                value: 0,
                min: 0,
                max: 100,
                defaultValue: 0,
                onChanged: (v) {},
              ),
              AdjustmentSlider(
                label: 'Blemish Removal',
                value: 0,
                min: 0,
                max: 100,
                defaultValue: 0,
                onChanged: (v) {},
              ),
              AdjustmentSlider(
                label: 'Pore Refinement',
                value: 0,
                min: 0,
                max: 100,
                defaultValue: 0,
                onChanged: (v) {},
              ),
              AdjustmentSlider(
                label: 'Shine Reduction',
                value: 0,
                min: 0,
                max: 100,
                defaultValue: 0,
                onChanged: (v) {},
              ),
              
              const SizedBox(height: 12),
              const Divider(color: AppTheme.border),
              const SizedBox(height: 12),
              
              const Text(
                'TEXTURE PROTECTION',
                style: TextStyle(
                  color: AppTheme.textTertiary,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),
              AdjustmentSlider(
                label: 'Detail Preservation',
                value: 50,
                min: 0,
                max: 100,
                defaultValue: 50,
                onChanged: (v) {},
              ),
            ],
          ),
        ),
      ],
    );
  }
}
