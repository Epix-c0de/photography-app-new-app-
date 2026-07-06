import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/state/providers.dart';

class CullScreen extends ConsumerWidget {
  const CullScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(filteredPhotosProvider);
    final selectedPhoto = ref.watch(selectedPhotoProvider);

    return Row(
      children: [
        // ─── Left Panel: Session Filters ────────────────
        Container(
          width: 200,
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: AppTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHeader(title: 'SESSION FILTERS'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _FilterSection(
                      title: 'Rating',
                      children: [
                        _FilterChip(label: 'All', count: photos.length, isSelected: true),
                        _FilterChip(label: '★★★★★', count: 0),
                        _FilterChip(label: '★★★★', count: 0),
                        _FilterChip(label: '★★★', count: 0),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _FilterSection(
                      title: 'Flag',
                      children: [
                        _FilterChip(label: 'All', count: photos.length, isSelected: true),
                        _FilterChip(label: 'Pick', count: 0, color: AppTheme.green),
                        _FilterChip(label: 'Reject', count: 0, color: AppTheme.red),
                        _FilterChip(label: 'Review', count: 0, color: AppTheme.orange),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _FilterSection(
                      title: 'AI Score',
                      children: [
                        _FilterChip(label: 'All', count: photos.length, isSelected: true),
                        _FilterChip(label: '90+', count: 0),
                        _FilterChip(label: '70-89', count: 0),
                        _FilterChip(label: 'Below 70', count: 0),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        
        // ─── Center: Comparison View ────────────────────
        Expanded(
          child: Column(
            children: [
              // View mode tabs
              Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: AppTheme.border)),
                ),
                child: Row(
                  children: [
                    _ViewModeTab(label: 'Single', isActive: true),
                    _ViewModeTab(label: '2 Up'),
                    _ViewModeTab(label: '4 Up'),
                    _ViewModeTab(label: '8 Up'),
                    const Spacer(),
                    // AI Actions
                    _ActionButton(label: 'Pick', icon: Icons.check, color: AppTheme.green),
                    const SizedBox(width: 8),
                    _ActionButton(label: 'Reject', icon: Icons.close, color: AppTheme.red),
                    const SizedBox(width: 8),
                    _ActionButton(label: 'Review', icon: Icons.help_outline, color: AppTheme.orange),
                  ],
                ),
              ),
              
              // Main comparison area
              Expanded(
                child: Center(
                  child: selectedPhoto == null
                      ? const Text(
                          'Select a photo to compare',
                          style: TextStyle(color: AppTheme.textTertiary),
                        )
                      : Container(
                          margin: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: AppTheme.surfaceLight,
                            borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                            border: Border.all(color: AppTheme.border),
                          ),
                          child: Center(
                            child: Text(
                              selectedPhoto.filename,
                              style: const TextStyle(color: AppTheme.textSecondary),
                            ),
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
        
        // ─── Right Panel: AI Scores ─────────────────────
        Container(
          width: 220,
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: AppTheme.border)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PanelHeader(title: 'AI SCORES'),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(12),
                  children: [
                    _AiScoreCard(
                      label: 'Sharpness',
                      score: 85,
                      color: AppTheme.green,
                    ),
                    const SizedBox(height: 8),
                    _AiScoreCard(
                      label: 'Eye Quality',
                      score: 92,
                      color: AppTheme.green,
                    ),
                    const SizedBox(height: 8),
                    _AiScoreCard(
                      label: 'Composition',
                      score: 78,
                      color: AppTheme.gold,
                    ),
                    const SizedBox(height: 8),
                    _AiScoreCard(
                      label: 'Duplicate Risk',
                      score: 15,
                      color: AppTheme.green,
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.gold.withValues(alpha:0.1),
                        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                        border: Border.all(color: AppTheme.gold.withValues(alpha:0.3)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'OVERALL SCORE',
                            style: TextStyle(
                              color: AppTheme.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '88',
                            style: TextStyle(
                              color: AppTheme.textPrimary,
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
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

class _FilterSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _FilterSection({required this.title, required this.children});

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
        ...children,
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final Color? color;

  const _FilterChip({
    required this.label,
    required this.count,
    this.isSelected = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Material(
        color: isSelected
            ? (color ?? AppTheme.gold).withValues(alpha:0.1)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: isSelected
                ? BoxDecoration(
                    borderRadius: BorderRadius.circular(AppTheme.borderRadius),
                    border: Border.all(color: (color ?? AppTheme.gold).withValues(alpha:0.3)),
                  )
                : null,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: isSelected ? AppTheme.textPrimary : AppTheme.textSecondary,
                      fontSize: 11,
                    ),
                  ),
                ),
                Text(
                  count.toString(),
                  style: const TextStyle(
                    color: AppTheme.textTertiary,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ViewModeTab extends StatelessWidget {
  final String label;
  final bool isActive;

  const _ViewModeTab({required this.label, this.isActive = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 4),
      child: Material(
        color: isActive ? AppTheme.gold.withValues(alpha:0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(AppTheme.borderRadius),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(
              label,
              style: TextStyle(
                color: isActive ? AppTheme.gold : AppTheme.textSecondary,
                fontSize: 11,
                fontWeight: isActive ? FontWeight.w500 : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha:0.1),
      borderRadius: BorderRadius.circular(AppTheme.borderRadius),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AiScoreCard extends StatelessWidget {
  final String label;
  final int score;
  final Color color;

  const _AiScoreCard({
    required this.label,
    required this.score,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceLight,
        borderRadius: BorderRadius.circular(AppTheme.borderRadius),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                '$score',
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(
            value: score / 100,
            backgroundColor: AppTheme.border,
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 3,
            borderRadius: BorderRadius.circular(2),
          ),
        ],
      ),
    );
  }
}
