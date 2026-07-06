import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/theme/app_theme.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      children: [
        // ─── Left: Settings Navigation ──────────────────
        Container(
          width: 220,
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: AppTheme.border)),
          ),
          child: ListView(
            padding: const EdgeInsets.all(8),
            children: const [
              _SettingsNavItem(label: 'General', icon: Icons.settings, isActive: true),
              _SettingsNavItem(label: 'Performance', icon: Icons.speed),
              _SettingsNavItem(label: 'GPU', icon: Icons.memory),
              _SettingsNavItem(label: 'AI', icon: Icons.psychology),
              _SettingsNavItem(label: 'Catalog', icon: Icons.folder),
              _SettingsNavItem(label: 'Plugins', icon: Icons.extension),
              _SettingsNavItem(label: 'Shortcuts', icon: Icons.keyboard),
              _SettingsNavItem(label: 'Appearance', icon: Icons.palette),
            ],
          ),
        ),
        
        // ─── Right: Settings Content ────────────────────
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Text(
                'General Settings',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 24),
              
              _SettingsSection(
                title: 'Application',
                children: [
                  _SettingsToggle(
                    label: 'Auto-save edits',
                    description: 'Automatically save edit changes',
                    value: true,
                    onChanged: (v) {},
                  ),
                  const SizedBox(height: 12),
                  _SettingsToggle(
                    label: 'Show startup dashboard',
                    description: 'Open catalog selection on launch',
                    value: true,
                    onChanged: (v) {},
                  ),
                  const SizedBox(height: 12),
                  _SettingsToggle(
                    label: 'Check for updates',
                    description: 'Automatically check for new versions',
                    value: true,
                    onChanged: (v) {},
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              _SettingsSection(
                title: 'File Handling',
                children: [
                  _SettingsToggle(
                    label: 'Copy files on import',
                    description: 'Copy RAW files to catalog instead of linking',
                    value: false,
                    onChanged: (v) {},
                  ),
                  const SizedBox(height: 12),
                  _SettingsToggle(
                    label: 'Generate previews on import',
                    description: 'Create preview images during import',
                    value: true,
                    onChanged: (v) {},
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              _SettingsSection(
                title: 'Account',
                children: [
                  _SettingsRow(
                    label: 'Email',
                    value: 'photographer@example.com',
                  ),
                  const SizedBox(height: 8),
                  _SettingsRow(
                    label: 'License',
                    value: 'Professional',
                    valueColor: AppTheme.gold,
                  ),
                  const SizedBox(height: 8),
                  _SettingsRow(
                    label: 'Subscription',
                    value: 'Active',
                    valueColor: AppTheme.green,
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsNavItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isActive;

  const _SettingsNavItem({
    required this.label,
    required this.icon,
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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

class _SettingsSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SettingsSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.borderRadiusLg),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
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
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _SettingsToggle extends StatelessWidget {
  final String label;
  final String description;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingsToggle({
    required this.label,
    required this.description,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 12,
                ),
              ),
              Text(
                description,
                style: const TextStyle(
                  color: AppTheme.textTertiary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: AppTheme.gold,
        ),
      ],
    );
  }
}

class _SettingsRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _SettingsRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: AppTheme.textSecondary,
            fontSize: 12,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? AppTheme.textPrimary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
