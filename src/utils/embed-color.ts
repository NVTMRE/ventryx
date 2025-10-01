import { ColorResolvable } from "discord.js";

export const embedColor: ColorResolvable =
  (process.env.EMBEDED_COLOR as ColorResolvable) || "#6f00ffff";
