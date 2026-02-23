import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AdminService } from '@/services/admin';
import { supabase } from '@/lib/supabase';

// Mock Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn<any>()
  }
}));

describe('AdminService.gallery.getPhotos', () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation
    mockFrom.mockReset();
  });

  it('should fetch photos for multiple gallery IDs with pagination', async () => {
    const galleryIds = ['gallery-1', 'gallery-2'];
    const page = 0;
    const limit = 50;

    const mockData = [{ id: 'photo-1' }, { id: 'photo-2' }];
    const mockCount = 2;

    // Mock chain: from -> select -> in -> eq -> range -> order
    const mockOrder = jest.fn<() => Promise<any>>().mockResolvedValue({ data: mockData, count: mockCount, error: null });
    const mockRange = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEq = jest.fn().mockReturnValue({ range: mockRange });
    const mockIn = jest.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = jest.fn().mockReturnValue({ in: mockIn });

    mockFrom.mockReturnValue({ select: mockSelect });

    const result = await AdminService.gallery.getPhotos(galleryIds, page, limit);

    expect(mockFrom).toHaveBeenCalledWith('photos');
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(mockIn).toHaveBeenCalledWith('gallery_id', galleryIds);
    expect(mockEq).toHaveBeenCalledWith('variant', 'watermarked');
    expect(mockRange).toHaveBeenCalledWith(0, 49);
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result).toEqual({ data: mockData, count: mockCount });
  });

  it('should fetch photos for single gallery ID', async () => {
    const galleryId = 'gallery-1';
    
    // Mock chain for single ID: from -> select -> eq (id) -> eq (variant) -> range -> order
    const mockOrder = jest.fn<() => Promise<any>>().mockResolvedValue({ data: [], count: 0, error: null });
    const mockRange = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEqVariant = jest.fn().mockReturnValue({ range: mockRange });
    const mockEqId = jest.fn().mockReturnValue({ eq: mockEqVariant });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEqId });

    mockFrom.mockReturnValue({ select: mockSelect });

    await AdminService.gallery.getPhotos(galleryId);

    expect(mockFrom).toHaveBeenCalledWith('photos');
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact' });
    expect(mockEqId).toHaveBeenCalledWith('gallery_id', galleryId);
    expect(mockEqVariant).toHaveBeenCalledWith('variant', 'watermarked');
  });

  it('should handle pagination correctly for page 2', async () => {
    const galleryIds = ['gallery-1'];
    const page = 1;
    const limit = 50;
    
    // Expected range: 50 to 99
    
    const mockOrder = jest.fn<() => Promise<any>>().mockResolvedValue({ data: [], count: 0, error: null });
    const mockRange = jest.fn().mockReturnValue({ order: mockOrder });
    const mockEq = jest.fn().mockReturnValue({ range: mockRange });
    const mockIn = jest.fn().mockReturnValue({ eq: mockEq });
    const mockSelect = jest.fn().mockReturnValue({ in: mockIn });

    mockFrom.mockReturnValue({ select: mockSelect });

    await AdminService.gallery.getPhotos(galleryIds, page, limit);

    expect(mockRange).toHaveBeenCalledWith(50, 99);
  });
});
