import {readFileSync} from "node:fs";
import process from "node:process";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const tag = (process.env.GITHUB_REF_NAME ?? "").replace(/^v/, "");
const expected = manifest.version;

if (tag !== expected) {
	console.error(`Release tag ${tag || "(missing)"} must exactly match manifest version ${expected}.`);
	process.exit(1);
}

console.log(`Release tag ${tag} matches manifest version.`);
