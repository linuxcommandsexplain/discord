export const config = {
	name: "encryptionPlugin",
	nameTitle: "Encryption",
	description: "Experimental message encryption using AES-GCM",
	author: {
		name: "Harry Merritt & Sleek",
		github_username: "s4dic",
	},
	version: {
		current: "2.1.2",
		latest: "",
		update: false,
		ignoreUpdate: false
	},
	link: {
		repository: "https://github.com/s4dic/discord/new/main/BetterDiscord%20Plugins/encryption",
		source: "https://raw.githubusercontent.com/s4dic/discord/refs/heads/main/BetterDiscord%20Plugins/encryption/encryption.plugin.js",
		sourceConfig:
			"https://raw.githubusercontent.com/s4dic/discord/refs/heads/main/BetterDiscord%20Plugins/encryption/master/src/lib/config.ts"
	}
};

export type Config = typeof config;
export type UserData = Record<string, { password: string; state: boolean }>;
