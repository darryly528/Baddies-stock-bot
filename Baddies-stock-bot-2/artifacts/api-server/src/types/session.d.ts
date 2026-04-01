import "express-session";

declare module "express-session" {
  interface SessionData {
    discordUser?: {
      id: string;
      username: string;
      discriminator: string;
      avatar: string | null;
      accessToken: string;
    };
  }
}
