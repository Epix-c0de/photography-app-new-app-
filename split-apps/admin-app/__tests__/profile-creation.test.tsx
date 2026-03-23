import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { 
  createUserProfileWithRetry, 
  isProfileComplete, 
  completeIncompleteProfile,
  isTransientNetworkError,
  doesProfileExist,
  getSignupFailureMessage
} from '@/lib/signup';
import { supabase } from '@/lib/supabase';

// Mock Supabase client with proper typing
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn<any>()
  }
}));

describe('Profile Creation Utilities', () => {
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFrom = supabase.from as jest.Mock;
  const mockProfileData = {
    name: 'John Doe',
    phone: '+254712345678',
    email: 'john@example.com',
    pinHash: 'hashed_pin_123',
    biometricEnabled: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUserProfileWithRetry', () => {
    it('should successfully create a profile and mark it as complete', async () => {
      // Mock successful upsert
      const mockUpsert = jest.fn<any>().mockResolvedValue({ data: null, error: null });
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: true }, 
        error: null 
      });
      
      // Return an object that supports both upsert and select
      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: jest.fn<any>().mockReturnValue({
          eq: jest.fn<any>().mockReturnValue({
            single: mockSelect
          })
        })
      });

      const result = await createUserProfileWithRetry(mockUserId, mockProfileData);

      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith({
        id: mockUserId,
        role: 'client',
        name: mockProfileData.name,
        email: mockProfileData.email,
        phone: mockProfileData.phone,
        pin_hash: mockProfileData.pinHash,
        biometric_enabled: mockProfileData.biometricEnabled,
        updated_at: expect.any(String)
      });
    });

    it('should retry on transient network errors', async () => {
      // Mock first attempt failure (network error), second success
      const mockUpsert = jest.fn<any>()
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({ data: null, error: null });
      
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: true }, 
        error: null 
      });

      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: jest.fn<any>().mockReturnValue({
          eq: jest.fn<any>().mockReturnValue({
            single: mockSelect
          })
        })
      });

      const result = await createUserProfileWithRetry(mockUserId, mockProfileData);

      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
    });

    it('should handle unique phone constraint by retrying without phone', async () => {
      // Mock unique constraint error
      const mockUniqueError = new Error('duplicate key value violates unique constraint "user_profiles_phone_key"');
      (mockUniqueError as any).code = '23505';
      (mockUniqueError as any).message = 'duplicate key value violates unique constraint "user_profiles_phone_key"';
      
      const mockUpsert = jest.fn<any>()
        .mockResolvedValueOnce({ error: mockUniqueError }) // First attempt fails
        .mockResolvedValueOnce({ data: null, error: null }); // Second attempt (retry without phone) succeeds

      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: false }, 
        error: null 
      });

      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: jest.fn<any>().mockReturnValue({
          eq: jest.fn<any>().mockReturnValue({
            single: mockSelect
          })
        })
      });

      const result = await createUserProfileWithRetry(mockUserId, mockProfileData);

      expect(result.success).toBe(true);
      expect(result.warning).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      // Verify second call had phone: null
      expect(mockUpsert).toHaveBeenLastCalledWith(expect.objectContaining({
        phone: null
      }));
    });

    it('should fail immediately for persistent errors', async () => {
      const mockError = new Error('Database constraint violation');
      const mockUpsert = jest.fn<any>().mockRejectedValue(mockError);

      mockFrom.mockReturnValue({
        upsert: mockUpsert
      });

      const result = await createUserProfileWithRetry(mockUserId, mockProfileData);

      expect(result.success).toBe(false);
      expect(result.error).toBe(mockError);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    it('should handle profile created but marked as incomplete', async () => {
      const mockUpsert = jest.fn<any>().mockResolvedValue({ data: null, error: null });
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: false }, 
        error: null 
      });

      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: jest.fn<any>().mockReturnValue({
          eq: jest.fn<any>().mockReturnValue({
            single: mockSelect
          })
        })
      });

      const result = await createUserProfileWithRetry(mockUserId, mockProfileData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(Error));
    });
  });

  describe('doesProfileExist', () => {
    it('should return true if profile exists', async () => {
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        count: 1, 
        error: null 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn<any>().mockReturnValueOnce({
          eq: mockSelect
        })
      });

      const result = await doesProfileExist(mockUserId);
      expect(result).toBe(true);
    });

    it('should return false if profile does not exist', async () => {
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        count: 0, 
        error: null 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn<any>().mockReturnValueOnce({
          eq: mockSelect
        })
      });

      const result = await doesProfileExist(mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('isProfileComplete', () => {
    it('should return true for complete profiles', async () => {
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: true }, 
        error: null 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn<any>().mockReturnValueOnce({
          eq: jest.fn<any>().mockReturnValueOnce({
            single: mockSelect
          })
        })
      });

      const result = await isProfileComplete(mockUserId);
      expect(result).toBe(true);
    });

    it('should return false for incomplete profiles', async () => {
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: false }, 
        error: null 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn<any>().mockReturnValueOnce({
          eq: jest.fn<any>().mockReturnValueOnce({
            single: mockSelect
          })
        })
      });

      const result = await isProfileComplete(mockUserId);
      expect(result).toBe(false);
    });

    it('should return false on database errors', async () => {
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: null, 
        error: new Error('Not found') 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn<any>().mockReturnValueOnce({
          eq: jest.fn<any>().mockReturnValueOnce({
            single: mockSelect
          })
        })
      });

      const result = await isProfileComplete(mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('completeIncompleteProfile', () => {
    it('should successfully complete an incomplete profile', async () => {
      const mockUpdate = jest.fn<any>().mockResolvedValue({ error: null });
      const mockSelect = jest.fn<any>().mockResolvedValue({ 
        data: { profile_complete: true }, 
        error: null 
      });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          update: jest.fn<any>().mockReturnValueOnce({
            eq: mockUpdate
          })
        })
        .mockReturnValueOnce({
          select: jest.fn<any>().mockReturnValueOnce({
            eq: jest.fn<any>().mockReturnValueOnce({
              single: mockSelect
            })
          })
        });

      const result = await completeIncompleteProfile(mockUserId, {
        name: 'John Doe',
        phone: '+254712345678',
        email: 'john@example.com'
      });

      expect(result).toBe(true);
    });

    it('should return false on update errors', async () => {
      const mockUpdate = jest.fn<any>().mockResolvedValue({ 
        error: new Error('Update failed') 
      });

      (supabase.from as jest.Mock).mockReturnValueOnce({
        update: jest.fn<any>().mockReturnValueOnce({
          eq: mockUpdate
        })
      });

      const result = await completeIncompleteProfile(mockUserId, {
        name: 'John Doe',
        phone: '+254712345678',
        email: 'john@example.com'
      });

      expect(result).toBe(false);
    });
  });

  describe('isTransientNetworkError', () => {
    it('should identify network errors as transient', () => {
      const networkError = new Error('Network request failed');
      expect(isTransientNetworkError(networkError)).toBe(true);
    });

    it('should identify non-network errors as non-transient', () => {
      const dbError = new Error('Unique constraint violation');
      expect(isTransientNetworkError(dbError)).toBe(false);
    });

    it('should exclude authentication errors from transient classification', () => {
      const authError = new Error('Unauthorized');
      expect(isTransientNetworkError(authError)).toBe(false);
    });

    it('should exclude rate limit errors from transient classification', () => {
      const rateLimitError = new Error('Too many requests');
      expect(isTransientNetworkError(rateLimitError)).toBe(false);
      
      const rateLimitError2 = new Error('429');
      expect(isTransientNetworkError(rateLimitError2)).toBe(false);
    });
  });

  describe('getSignupFailureMessage', () => {
    it('should return specific message for rate limits', () => {
      const error = new Error('Too many requests');
      expect(getSignupFailureMessage(error)).toContain('Too many signup attempts');
    });

    it('should return default message for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(getSignupFailureMessage(error)).toBe('Unknown error');
    });
  });
});
