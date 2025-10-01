// src/config/levels.ts

export const levelConfig = {
  // Progi procentowe dla różnych czasów na VC
  voiceXPMultipliers: [
    { minMinutes: 0, maxMinutes: 30, multiplier: 1.0 },
    { minMinutes: 30, maxMinutes: 60, multiplier: 0.8 },
    { minMinutes: 60, maxMinutes: 120, multiplier: 0.6 },
    { minMinutes: 120, maxMinutes: 180, multiplier: 0.4 },
    { minMinutes: 180, maxMinutes: Infinity, multiplier: 0.2 },
  ],

  minVoiceMembers: 2,
  maxVoiceSessionMinutes: 360,
  messageCooldown: 60,
  defaultXPPerMessage: 15,
  defaultXPVariance: 10,
  defaultXPPerVoiceMinute: 5,
  batchUpdateInterval: 30,
  maxMessagesPerMinute: 5,
  spamTimeWindow: 60,
};

export default levelConfig;