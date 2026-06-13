# Admin App Navigation Implementation Guide

## Current Issues
- 8+ top-level navigation items in sidebar/tabs
- Hard to find specific features
- No logical grouping
- Cluttered settings screen
- No visual hierarchy

## Solution: 3-Tier Navigation System

### Tier 1: Bottom Tab Bar (5 items max)
```tsx
📊 Dashboard
📸 Content (Upload/Galleries)
👥 Clients
📅 Bookings
⚙️ Settings
```

### Tier 2: In-Screen Navigation
Each screen has its own sub-navigation

**Content Screen** (Upload):
- My Galleries
- Upload New
- Behind The Scenes
- Portfolio

**Clients Screen**:
- All Clients
- Add Client
- Messages

**Settings Screen**:
- Profile
- Payment Setup
- Links & QR
- Watermark
- Delivery

### Tier 3: Quick Actions (Dashboard)
Floating action buttons for common tasks

## Implementation Steps

### Step 1: Update Tab Bar Layout
**File**: `split-apps/admin-app/app/(admin)/_layout.tsx`

```tsx
<Tabs
  screenOptions={{
    tabBarActiveTintColor: '#D4AF37',
    tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
    tabBarStyle: {
      backgroundColor: '#0A0A12',
      borderTopColor: 'rgba(255,255,255,0.05)',
    },
  }}>
  
  <Tabs.Screen
    name="dashboard"
    options={{
      title: 'Dashboard',
      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📊</Text>,
    }}
  />
  
  <Tabs.Screen
    name="upload"
    options={{
      title: 'Content',
      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📸</Text>,
    }}
  />
  
  <Tabs.Screen
    name="clients"
    options={{
      title: 'Clients',
      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👥</Text>,
      tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
    }}
  />
  
  <Tabs.Screen
    name="admin-bookings"
    options={{
      title: 'Bookings',
      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📅</Text>,
    }}
  />
  
  <Tabs.Screen
    name="settings"
    options={{
      title: 'Settings',
      tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>⚙️</Text>,
    }}
  />
</Tabs>
```

### Step 2: Create Content Hub Screen
**File**: `split-apps/admin-app/app/(admin)/upload/index.tsx`

```tsx
export default function ContentHub() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Content Management</Text>
      
      {/* Quick Upload */}
      <TouchableOpacity style={styles.primaryCard} onPress={() => router.push('/upload/new')}>
        <Text style={styles.primaryIcon}>📸</Text>
        <View>
          <Text style={styles.primaryTitle}>Upload New Gallery</Text>
          <Text style={styles.primarySubtitle}>Add photos for your clients</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </TouchableOpacity>
      
      {/* Content Sections */}
      <View style={styles.grid}>
        <ContentCard
          icon="🖼️"
          title="My Galleries"
          subtitle={`${galleryCount} galleries`}
          onPress={() => router.push('/galleries')}
        />
        
        <ContentCard
          icon="🎬"
          title="Behind The Scenes"
          subtitle="Share your process"
          onPress={() => router.push('/bts-announcements')}
        />
        
        <ContentCard
          icon="✨"
          title="Portfolio"
          subtitle="Public showcase"
          onPress={() => router.push('/clients/gallery')}
        />
        
        <ContentCard
          icon="📊"
          title="Analytics"
          subtitle="View insights"
          onPress={() => router.push('/analytics')}
        />
      </View>
    </ScrollView>
  );
}
```

### Step 3: Redesign Settings Screen
**File**: `split-apps/admin-app/app/(admin)/settings/index.tsx`

```tsx
const settingsGroups = [
  {
    title: 'Account',
    icon: '👤',
    color: '#D4AF37',
    items: [
      { label: 'Profile', description: 'Edit your info', route: '/settings/profile' },
      { label: 'Security', description: 'Password & login', route: '/settings/security' },
    ]
  },
  {
    title: 'Business',
    icon: '💼',
    color: '#34C759',
    items: [
      { label: 'Payment Setup', description: 'M-Pesa & billing', route: '/settings/payments', badge: 'Required' },
      { label: 'Packages', description: 'Pricing tiers', route: '/settings/package-editor' },
      { label: 'Delivery', description: 'Download settings', route: '/settings/delivery' },
    ]
  },
  {
    title: 'Sharing',
    icon: '🔗',
    color: '#5856D6',
    items: [
      { label: 'Links & QR Codes', description: 'Your photographer code', route: '/settings/links' },
      { label: 'Watermark', description: 'Branding settings', route: '/settings/watermark' },
    ]
  },
  {
    title: 'Notifications',
    icon: '🔔',
    color: '#FF9F0A',
    items: [
      { label: 'SMS Management', description: 'Auto-send codes', route: '/settings/sms-management' },
      { label: 'Manual Payments', description: 'Review submissions', route: '/settings/manual-payments', badge: pendingCount },
    ]
  }
];

return (
  <ScrollView style={styles.container}>
    <Text style={styles.title}>Settings</Text>
    
    {settingsGroups.map(group => (
      <View key={group.title} style={styles.group}>
        <View style={styles.groupHeader}>
          <Text style={styles.groupIcon}>{group.icon}</Text>
          <Text style={styles.groupTitle}>{group.title}</Text>
        </View>
        
        {group.items.map(item => (
          <TouchableOpacity
            key={item.route}
            style={styles.settingRow}
            onPress={() => router.push(item.route)}>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>{item.label}</Text>
              <Text style={styles.settingDescription}>{item.description}</Text>
            </View>
            {item.badge && (
              <View style={[styles.badge, { backgroundColor: group.color }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    ))}
  </ScrollView>
);
```

### Step 4: Add Quick Actions to Dashboard
**File**: `split-apps/admin-app/app/(admin)/dashboard/index.tsx`

```tsx
const QuickActions = () => {
  const actions = [
    { label: 'Upload', icon: '📸', color: '#D4AF37', route: '/upload/new' },
    { label: 'Add Client', icon: '➕', color: '#34C759', route: '/clients/add' },
    { label: 'New Booking', icon: '📅', color: '#5856D6', route: '/admin-bookings/new' },
    { label: 'Share', icon: '🔗', color: '#FF9F0A', onPress: showShareMenu },
  ];
  
  return (
    <View style={styles.quickActions}>
      {actions.map(action => (
        <TouchableOpacity
          key={action.label}
          style={[styles.actionButton, { borderColor: action.color }]}
          onPress={() => action.route ? router.push(action.route) : action.onPress?.()}>
          <Text style={styles.actionIcon}>{action.icon}</Text>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Add to dashboard
<View style={styles.dashboard}>
  <QuickActions />
  {/* Rest of dashboard content */}
</View>
```

### Step 5: Create Links Screen
**File**: `split-apps/admin-app/app/(admin)/settings/links.tsx`

```tsx
export default function LinksScreen() {
  const [photographerCode, setPhotographerCode] = useState('');
  const [links, setLinks] = useState<any>(null);
  
  useEffect(() => {
    loadLinks();
  }, []);
  
  const loadLinks = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('photographer_code')
      .eq('id', user?.id)
      .single();
    
    if (profile?.photographer_code) {
      setPhotographerCode(profile.photographer_code);
      setLinks(generateLinks(profile.photographer_code));
    }
  };
  
  const generateLinks = (code: string) => ({
    invite: `https://app.epixvisuals.com/join?code=${code}`,
    portfolio: `https://portfolio.epixvisuals.com/${code}`,
    booking: `https://app.epixvisuals.com/book?photographer=${code}`,
  });
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Your Sharing Links</Text>
      
      {/* Photographer Code */}
      <View style={styles.codeSection}>
        <Text style={styles.label}>Your Photographer Code</Text>
        <View style={styles.codeDisplay}>
          <Text style={styles.code}>{photographerCode}</Text>
          <TouchableOpacity onPress={() => Clipboard.setString(photographerCode)}>
            <Text style={styles.copyIcon}>📋</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Share this code with new clients</Text>
      </View>
      
      {/* Links */}
      <LinkCard
        icon="👥"
        title="Client Invitation Link"
        description="Send this to new clients to join your studio"
        url={links?.invite}
      />
      
      <LinkCard
        icon="🖼️"
        title="Portfolio Website"
        description="Your public portfolio page"
        url={links?.portfolio}
      />
      
      <LinkCard
        icon="📅"
        title="Booking Link"
        description="Let clients book sessions directly"
        url={links?.booking}
      />
      
      {/* QR Codes */}
      <Text style={styles.sectionTitle}>QR Codes</Text>
      <QRCodeCard title="Client Invitation" value={links?.invite} />
      <QRCodeCard title="Portfolio" value={links?.portfolio} />
    </ScrollView>
  );
}
```

## Visual Style Guide

### Colors
- Primary Gold: `#D4AF37`
- Success Green: `#34C759`
- Warning Orange: `#FF9F0A`
- Error Red: `#FF3B30`
- Purple: `#5856D6`
- Background: `#080810`
- Card Background: `#111118`

### Typography
- Title: 28px, Weight 900
- Subtitle: 16px, Weight 600
- Body: 14px, Weight 400
- Caption: 12px, Weight 400

### Spacing
- Section Padding: 24px
- Card Padding: 16px
- Element Gap: 12px
- Tight Gap: 8px

This implementation provides a clean, organized, and professional admin experience!
