# 🤖 Ventryx Bot

Nowoczesny bot Discord napisany w TypeScript z dynamicznym ładowaniem komend, eventów i workerów oraz integracją z bazą danych PostgreSQL przy użyciu Drizzle ORM.

## 📋 Funkcje

- **Dynamiczne ładowanie**: Komendy, eventy i workery są automatycznie ładowane z odpowiednich folderów
- **Baza danych**: Integracja z PostgreSQL przez Drizzle ORM
- **TypeScript**: Pełne typowanie dla lepszej jakości kodu
- **Hot reload**: Łatwe dodawanie nowych funkcji bez restartowania bota
- **Workers**: System zadań wykonywanych cyklicznie w tle
- **Slash Commands**: Nowoczesne komendy Discord

## 🚀 Instalacja

1. **Sklonuj repozytorium**
```bash
git clone <repo-url>
cd ventryx
```

2. **Zainstaluj zależności**
```bash
npm install
```

3. **Skonfiguruj zmienne środowiskowe**
```bash
cp .env.example .env
```

Wypełnij plik `.env`:
```env
DISCORD_TOKEN=your_discord_bot_token_here
GUILD_ID=your_guild_id_here
DATABASE_URL=postgresql://username:password@localhost:5432/ventryx_db
NODE_ENV=development
```

4. **Skonfiguruj bazę danych**
```bash
# Wygeneruj migracje
npm run db:generate

# Wykonaj migracje
npm run db:migrate
```

5. **Uruchom bota**
```bash
# Development (z hot reload)
npm run dev

# Production
npm run build
npm start
```

## 📁 Struktura projektu

```
src/
├── commands/           # Slash commands
│   ├── ping.ts        # Komenda ping
│   └── info.ts        # Informacje o bocie
├── events/            # Event handlery Discord
│   ├── ready.ts       # Event gotowości bota
│   └── guild-member-add.ts  # Event nowego członka
├── workers/           # Zadania cykliczne
│   ├── status-check.ts     # Sprawdzanie statusu
│   └── database-cleanup.ts # Czyszczenie bazy
├── database/          # Konfiguracja bazy danych
│   ├── schema.ts      # Schema tabel
│   └── connection.ts  # Połączenie z DB
├── types/             # Typy TypeScript
│   └── index.ts
├── utils/             # Narzędzia pomocnicze
│   └── loader.ts      # Dynamiczne ładowanie
└── index.ts           # Główny plik aplikacji
```

## 🔧 Tworzenie nowych funkcji

### Dodanie nowej komendy

Utwórz plik `src/commands/nazwa-komendy.ts`:

```typescript
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Command } from '../types';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nazwa')
    .setDescription('Opis komendy'),

  execute: async (interaction: CommandInteraction) => {
    await interaction.reply('Odpowiedź komendy!');
  }
};

export default command;
```

### Dodanie nowego eventu

Utwórz plik `src/events/nazwa-eventu.ts`:

```typescript
import { Event } from '../types';

const event: Event = {
  name: 'eventName', // Nazwa eventu Discord.js
  once: false,       // true jeśli ma się wykonać tylko raz
  execute: async (...args) => {
    // Logika eventu
  }
};

export default event;
```

### Dodanie nowego workera

Utwórz plik `src/workers/nazwa-workera.ts`:

```typescript
import { Worker } from '../types';

const worker: Worker = {
  name: 'nazwa-workera',
  interval: 60000,     // Interwał w milisekundach
  execute: async () => {
    // Logika wykonywanego zadania
  }
};

export default worker;
```

## 📊 Baza danych

Bot używa Drizzle ORM z PostgreSQL. Schema znajduje się w `src/database/schema.ts`.

### Przydatne komendy:

```bash
# Otwórz Drizzle Studio (GUI do bazy danych)
npm run db:studio

# Wygeneruj nowe migracje po zmianie schema
npm run db:generate

# Wykonaj migracje
npm run db:migrate
```

## 🛠️ Development

```bash
# Uruchom w trybie development z hot reload
npm run dev

# Zbuduj projekt
npm run build

# Uruchom zbudowany projekt
npm start
```

## 📝 Logi

Bot automatycznie loguje:
- ✅ Pomyślnie załadowane moduły
- ❌ Błędy ładowania
- 📊 Statystyki systemowe (workery)
- 🔍 Aktywności bota

## 🤝 Contributing

1. Fork projektu
2. Stwórz branch dla nowej funkcji (`git checkout -b feature/nowa-funkcja`)
3. Commit zmian (`git commit -m 'Dodaj nową funkcję'`)
4. Push do brancha (`git push origin feature/nowa-funkcja`)
5. Otwórz Pull Request

## 📄 Licencja

MIT License

## 👨‍💻 Autor

**NVTMRE (Ksawier Malkiewicz)**

---

*Ventryx Bot - Made with ❤️ and TypeScript*