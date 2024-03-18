/**
 * 下载阿岚直播间的默认Emoji，包含通用Emoji和UP主大表情
 */
import { parse } from "jsonc-parser";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import download from "download";
import { join } from "path";

const data = parse(readFileSync("./data/45104.jsonc").toString("utf-8"));

for (const pkg of data.data.data) {
  if (pkg.pkg_name !== "装扮表情") {
    const path = `./data/${pkg.pkg_name}`;
    if (!existsSync(path)) {
      mkdirSync(path);
    }
    for (const emoticon of pkg.emoticons) {
      console.log(`保存 emoji: ${emoticon.emoji}`);
      writeFileSync(
        join(path, emoticon.emoji + ".png"),
        await download(emoticon.url)
      );
    }
  }
}
