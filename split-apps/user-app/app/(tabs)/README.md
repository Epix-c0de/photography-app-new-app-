# Client App Documentation

## 1. Client Journeys
The client experience is focused on simplicity and speed.

### Onboarding
- **Invitation**: Client receives SMS with app link.
- **Login**: Phone number verification (OTP) or Email link.
- **Profile**: Minimal setup (Name, Avatar).

### Gallery Viewing
- **Dashboard**: Lists all accessible galleries.
- **Preview**:
  - If `is_locked = true`: View watermarked photos.
  - If `is_locked = false`: View clean, high-res photos.

## 2. Payments & Unlocking
1. **Trigger**: Client taps "Unlock Gallery" or "Buy".
2. **Process**:
   - App requests phone number.
   - Triggers M-Pesa STK Push.
   - Client enters PIN on phone.
3. **Completion**:
   - App listens for payment confirmation.
   - Gallery unlocks automatically.
   - "Download" button becomes active.

## 3. Sharing Behavior
- **Deep Links**: Galleries have unique `access_code` or links.
- **Social**: "Share" button generates a preview link.
- **Restrictions**: Unpaid galleries share watermarked previews only.

## 4. Offline Capabilities
- **Caching**: Viewed photos are cached locally.
- **Sync**: Status updates (e.g., gallery unlocked) sync when online.
