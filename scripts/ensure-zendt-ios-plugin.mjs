#!/usr/bin/env node
/**
 * cap sync regenerates ios/App/App/capacitor.config.json — keep ZendtAppleSignInPlugin registered.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.cwd(), "ios/App/App/capacitor.config.json");
const pluginClass = "ZendtAppleSignInPlugin";
const raw = readFileSync(path, "utf8");
const config = JSON.parse(raw);
const list = config.packageClassList;
if (!Array.isArray(list)) {
  console.warn("ensure-zendt-ios-plugin: no packageClassList in", path);
  process.exit(0);
}
if (!list.includes(pluginClass)) {
  config.packageClassList = [pluginClass, ...list];
  writeFileSync(path, `${JSON.stringify(config, null, "\t")}\n`);
  console.log("ensure-zendt-ios-plugin: added", pluginClass);
} else {
  console.log("ensure-zendt-ios-plugin: ok —", pluginClass, "already registered");
}
