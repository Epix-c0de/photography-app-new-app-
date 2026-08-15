# Photography WhatsApp Bot

WhatsApp Business Bot for the Photography Ecosystem. Acts as an intelligent assistant for photographers, clients, and administrators.

## Features

- **Client Registration** - Register clients via WhatsApp and send app invitations
- **Booking Queries** - View today's bookings, upcoming schedule
- **Client Management** - List clients, count, view status
- **Gallery Notifications** - Notify clients when galleries are ready
- **AI Intent Detection** - Natural language understanding for commands
- **Support Escalation** - Create tickets when AI confidence is low
- **Broadcast Messages** - Send announcements to all users
- **Activity Logs** - Track all bot interactions

## Setup

### 1. Install Dependencies

```bash
cd whatsapp-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Supabase URL and keys
- WhatsApp Business API credentials
- App configuration

### 3. Run Database Migration

Go to Supabase Dashboard > SQL Editor and run:
```sql
-- Paste contents of src/database/schema.sql
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Configure WhatsApp Webhook

In Meta Developer Dashboard:
- Set Webhook URL: `https://your-domain.com/api/webhook`
- Verify Token: Value from `WHATSAPP_VERIFY_TOKEN`
- Subscribe to: `messages` field

## Commands

### Photographer Commands

| Command | Description |
|---------|-------------|
| Register Client | Add a new client |
| My Bookings | View all bookings |
| Today's Bookings | See today's schedule |
| My Clients | View client list |
| Client Count | Total registered clients |
| Pending Payments | Outstanding payments |
| Delivered Galleries | Completed galleries |
| Upload Status | Check pending uploads |
| Recent Activity | Latest updates |
| Help | Show all commands |
| Support | Contact support |

### Natural Language

The bot understands natural language:
- "Show me tomorrow's bookings"
- "How many clients do I have?"
- "Send gallery reminder to Mary"

## Project Structure

```
whatsapp-bot/
├── src/
│   ├── api/
│   │   └── routes.ts          # API routes
│   ├── ai/
│   │   └── intent.ts          # AI intent detection
│   ├── config/
│   │   └── index.ts           # Environment config
│   ├── database/
│   │   └── schema.sql         # DB migration
│   ├── handlers/
│   │   ├── message.ts         # Main message router
│   │   ├── register.ts        # Client registration
│   │   └── queries.ts         # Data queries
│   ├── services/
│   │   ├── supabase.ts        # Supabase client
│   │   ├── conversation.ts    # Conversation state
│   │   └── notification.ts    # Notification service
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── utils/
│   │   ├── logger.ts          # Winston logger
│   │   └── phone.ts           # Phone utilities
│   ├── webhooks/
│   │   └── handler.ts         # WhatsApp webhook
│   └── index.ts               # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/webhook` | Webhook verification |
| POST | `/api/webhook` | Incoming messages |
| POST | `/api/send` | Send message |
| POST | `/api/broadcast` | Broadcast message |

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Integration with Mobile Apps

The bot connects to the same Supabase database as the mobile apps. When a photographer registers a client via WhatsApp:
1. Client record is created in `clients` table
2. Invitation message is sent via WhatsApp
3. Client downloads app and registers
4. Phone number links the account automatically

## License

Private - Epix Visuals
