import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/screens/home_screen.dart';
import 'package:photo_access_editor/screens/library_screen.dart';
import 'package:photo_access_editor/screens/cull_screen.dart';
import 'package:photo_access_editor/screens/develop_screen.dart';
import 'package:photo_access_editor/screens/retouch_screen.dart';
import 'package:photo_access_editor/screens/export_screen.dart';
import 'package:photo_access_editor/screens/settings_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/library',
    routes: [
      ShellRoute(
        builder: (context, state, child) {
          return HomeScreen(child: child);
        },
        routes: [
          GoRoute(
            path: '/library',
            name: 'library',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LibraryScreen(),
            ),
          ),
          GoRoute(
            path: '/cull',
            name: 'cull',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CullScreen(),
            ),
          ),
          GoRoute(
            path: '/develop',
            name: 'develop',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DevelopScreen(),
            ),
          ),
          GoRoute(
            path: '/retouch',
            name: 'retouch',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: RetouchScreen(),
            ),
          ),
          GoRoute(
            path: '/export',
            name: 'export',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ExportScreen(),
            ),
          ),
          GoRoute(
            path: '/settings',
            name: 'settings',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
