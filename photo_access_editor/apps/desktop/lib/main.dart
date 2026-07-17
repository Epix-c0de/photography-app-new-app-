import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:photo_access_editor/routing/app_router.dart';
import 'package:photo_access_editor/theme/app_theme.dart';
import 'package:photo_access_editor/services/catalog_service.dart';
import 'package:photo_access_editor/services/thumbnail_cache.dart';
import 'package:photo_access_editor/services/rust_bridge.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  await RustBridge.initialize();
  await CatalogService.initialize();
  await ThumbnailCache.initialize();

  runApp(const ProviderScope(child: PhotoAccessEditorApp()));
}

class PhotoAccessEditorApp extends ConsumerWidget {
  const PhotoAccessEditorApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Photo Access Editor',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: router,
    );
  }
}
