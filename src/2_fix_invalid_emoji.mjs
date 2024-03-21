/**
 * 修复数据库生成中的无效表情，仅针对没有emote名字，且表情图片文件名可能是哈希的表情。
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv.find((arg) => arg.slice(0, 5).includes("-dir="));

if (!dir) throw new Error("需要传入路径参数 -dir={表情仓库文件夹路径}");

if (!existsSync(dir.slice(5))) throw new Error("无效路径");

const EMOTE_FOLDER = dir.slice(5);

const { emote_name } = JSON.parse(
  readFileSync("./temp/invalid_emotes.json").toString()
);

for (const emote of emote_name) {
  if (!emote.og_file_name) continue;

  const name = emote.danmaku_name
    .replace("_]", "")
    .replace("]", "")
    .replace("[", "")
    .split("_")
    .at(-1);

  renameSync(
    join(EMOTE_FOLDER, emote.folder_name, emote.og_file_name),
    join(EMOTE_FOLDER, emote.folder_name, name + ".png")
  );

  const path = join(EMOTE_FOLDER, emote.folder_name, name + ".json");
  const data = JSON.parse(readFileSync(path).toString());

  for (let i = 0; i < data.data.packages.length; i++) {
    for (let j = 0; j < data.data.packages[i].emote.length; j++) {
      if (data.data.packages[i].emote[j].url.includes(emote.og_file_name)) {
        data.data.packages[i].emote[j].meta.alias = name;
      }
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2));
}
