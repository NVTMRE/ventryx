# 🤖 Ventryx

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)

**A modern Discord bot built with TypeScript featuring dynamic module loading, PostgreSQL database integration, and a powerful worker system.**

[Features](#-features) • [Installation](#-installation) • [Configuration](#-configuration) • [Project Structure](#-project-structure) • [Development](#-development) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🔧 Core Features
- **Dynamic Module Loading** - Commands, events, and workers are automatically loaded from their respective folders
- **Hot Reload** - Add new features without restarting the bot
- **TypeScript** - Full type safety for better code quality and developer experience
- **Modern Slash Commands** - Fully compatible with Discord's latest interaction system

### 📊 Database & Storage
- **PostgreSQL Integration** - Powered by Drizzle ORM
- **Type-Safe Queries** - Full TypeScript support for database operations
- **Migration System** - Easy database schema management
- **Drizzle Studio** - Visual database management tool

### ⚙️ Background Processing
- **Worker System** - Execute scheduled tasks in the background
- **Configurable Intervals** - Set custom execution intervals for each worker
- **Automatic Execution** - Workers run independently without blocking bot operations

### 🛠️ Developer Experience
- **Modular Architecture** - Clean separation of concerns
- **Easy to Extend** - Simple file-based module system
- **Comprehensive Logging** - Detailed logs for debugging and monitoring
- **Production Ready** - Built with scalability in mind

---

## 📋 Requirements

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14.0
- **npm** or **pnpm** (recommended)
- **Discord Bot Token** - [Create one here](https://discord.com/developers/applications)

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/NVTMRE/ventryx.git
cd ventryx
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_test_guild_id_here

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/ventryx_db

# Environment
NODE_ENV=development
```

### 4. Setup the database

```bash
# Generate migration files
npm run db:generate

# Run migrations
npm run db:migrate
```

### 5. Start the bot

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

---

## 📁 Project Structure

```
ventryx/
├── src/
│   ├── src_modules/
│   │   └── commands/          # Slash commands
│   │       ├── autopie.ts
│   │       ├── info.ts
│   │       ├── levels.ts
│   │       ├── levelconfigs.ts
│   │       ├── music.ts
│   │       ├── ping.ts
│   │       └── reactions.ts
│   │
│   ├── config/
│   │   └── levels.ts          # Level system configuration
│   │
│   ├── database/              # Database layer
│   │   ├── connections.ts     # Database connection
│   │   └── schema.ts          # Drizzle ORM schema
│   │
│   ├── events/                # Discord event handlers
│   │   ├── client-ready.ts
│   │   ├── guild-member-add.ts
│   │   ├── message-create.ts
│   │   ├── message-reaction-add.ts
│   │   └── voice-state-update.ts
│   │
│   ├── managers/              # Bot managers
│   │   └── xp-manager.ts      # XP/Level management
│   │
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   │
│   ├── utils/                 # Utility functions
│   │   ├── embed-color.ts
│   │   ├── level-calculator.ts
│   │   └── user-card.ts
│   │
│   ├── workers/               # Background workers
│   │   ├── ip-flush.ts
│   │   ├── status-check.ts
│   │   └── xp-check.ts
│   │
│   └── index.ts               # Main entry point
│
├── .env.example               # Environment variables template
├── .gitignore
├── bun.lock
├── ecosystem.config.js        # PM2 configuration
├── package.json
└── README.md
```

---

## 🔨 Development

### Creating a New Command

Create a new file in `src/src_modules/commands/`:

```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('My awesome command'),
  
  execute: async (interaction: CommandInteraction) => {
    await interaction.reply('Hello from my command!');
  }
};

export default command;
```

### Creating a New Event

Create a new file in `src/events/`:

```typescript
import { Event } from '../types';
import { Message } from 'discord.js';

const event: Event = {
  name: 'messageCreate',
  once: false,
  
  execute: async (message: Message) => {
    console.log(`Message received: ${message.content}`);
  }
};

export default event;
```

### Creating a New Worker

Create a new file in `src/workers/`:

```typescript
import { Worker } from '../types';

const worker: Worker = {
  name: 'my-worker',
  interval: 60000, // Run every 60 seconds
  
  execute: async () => {
    console.log('Worker executed!');
    // Your background task logic here
  }
};

export default worker;
```

---

## 🗄️ Database Management

### Using Drizzle ORM

```typescript
import { db } from './database/connections';
import { users } from './database/schema';
import { eq } from 'drizzle-orm';

// Insert data
await db.insert(users).values({
  id: '123456789',
  username: 'John Doe',
});

// Query data
const user = await db.query.users.findFirst({
  where: eq(users.id, '123456789'),
});

// Update data
await db.update(users)
  .set({ username: 'Jane Doe' })
  .where(eq(users.id, '123456789'));
```

### Database Commands

```bash
# Open Drizzle Studio (visual database manager)
npm run db:studio

# Generate new migrations after schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate
```

---

## 📜 Available Scripts

```bash
# Development
npm run dev              # Start with hot reload

# Production
npm run build           # Compile TypeScript
npm start               # Run compiled code

# Database
npm run db:generate     # Generate migrations
npm run db:migrate      # Run migrations
npm run db:studio       # Open Drizzle Studio

# Utilities
npm run lint            # Run linter
npm run clean           # Clean build files
```

---

## 🎯 Current Features

- ✅ **Slash Commands** - Modern Discord interactions
- ✅ **Level System** - XP and leveling with configurable rewards
- ✅ **Music System** - Play music in voice channels
- ✅ **Reaction Roles** - Assign roles via reactions
- ✅ **Auto-moderation** - Message filtering and moderation tools
- ✅ **Welcome System** - Greet new members
- ✅ **Voice Tracking** - Track voice channel activity
- ✅ **Worker System** - Background task execution

---

## 🔮 Planned Features

- 🚧 **Web Dashboard** - Manage bot settings via web interface
- 🚧 **Economy System** - Virtual currency and shop
- 🚧 **Ticket System** - Support ticket management
- 🚧 **Moderation Tools** - Advanced moderation features
- 🚧 **Custom Commands** - User-defined commands
- 🚧 **Analytics** - Server statistics and insights

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code structure
- Add comments for complex logic
- Test your changes thoroughly

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**NVTMRE (Ksawier Malkiewicz)**

- GitHub: [@NVTMRE](https://github.com/NVTMRE)

---

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Powerful Discord API library
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM for SQL databases
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/NVTMRE/ventryx/issues) page
2. Create a new issue with detailed information

---

<div align="center">

**Made with ❤️ and TypeScript**

⭐ Star this repository if you find it helpful!

</div>
