/**
 * 处理Mikufans装扮表情包仓库，生成SQLite数据库/CSV/JSON
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { stringify } from "csv-stringify/sync";
import download from "download";
import Database from "better-sqlite3";

const start = performance.now();

const URL = {
  ORIGIN:
    "https://github.com/ccmuyuu/bilibili-emotes/archive/refs/heads/master.zip",
  FORKED:
    "https://github.com/holarula-project/mikufans-emotes/archive/refs/heads/master.zip",
};
const DB_PATH = "./temp/emote.db";
const EMOTE_FOLDER = "./temp/emotes";
const args = new Set([...process.argv.slice(2)]);

// 下载表情包仓库 ZIP, 需要传递 `-dl` 参数
if (args.has("-dl")) {
  await download(URL.ORIGIN, EMOTE_FOLDER, {
    extract: true,
    filename: "emotes.zip",
    strip: 1,
  });
}

const db = new Database(DB_PATH, { verbose: console.log });
// 初始化数据库，需要传递 `-initdb` 参数
if (args.has("-initdb")) {
  db.exec(`CREATE TABLE IF NOT EXISTS emotes (
    id INTEGER PRIMARY KEY,
    folder_name TEXT NOT NULL,
    og_file_name TEXT,
    package_name TEXT NOT NULL,
    emote_name TEXT NOT NULL,
    danmaku_name TEXT NOT NULL UNIQUE
  );`);
}

// 导入表情包数据进入SQLite数据库，需要传递 `-sqlite` 参数
if (args.has("-sqlite")) {
  const folders = readdirSync(EMOTE_FOLDER);
  const invalid = { emote_name: [], danmaku_name: [] };

  const select = db.prepare(
    `SELECT count(*) as total FROM emotes WHERE danmaku_name = ?`
  );
  const insert = db.prepare(`INSERT INTO emotes
    (folder_name, og_file_name, package_name, emote_name, danmaku_name)
    VALUES
    (@folder_name, @og_file_name, @package_name, @emote_name, @danmaku_name)
  `);
  const insertMany = db.transaction((emotes) => {
    for (const emote of emotes) {
      if (select.all(emote.danmaku_name)[0].total === 0) {
        insert.run(emote);
      } else {
        invalid.danmaku_name.push(emote);
      }
    }
  });

  for (const folder of folders) {
    const path = join(EMOTE_FOLDER, folder, folder + ".json");
    if (!existsSync(path)) continue;

    const {
      data: { packages },
    } = JSON.parse(readFileSync(path).toString("utf-8"));

    for (const pkg of packages) {
      insertMany.immediate(
        pkg.emote.reduce((list, emote) => {
          const record = {
            folder_name: folder,
            package_name: pkg.text,
            emote_name: emote.meta.alias,
            danmaku_name: emote.text,
            og_file_name: emote.url.includes(".png")
              ? emote.url.split("/").at(-1)
              : null,
          };
          if (!emote.meta.alias) {
            invalid.emote_name.push(record);
            return list;
          } else if (!emote.text) {
            invalid.danmaku_name.push(record);
            return list;
          } else {
            return [...list, record];
          }
        }, [])
      );
    }
  }
  writeFileSync("./temp/invalid_emotes.json", JSON.stringify(invalid, null, 2));
}

// 保存 SQLite 数据库成 CSV 文件，需要传递 `-csv` 参数
if (args.has("-csv")) {
  writeFileSync(
    "./temp/emote.csv",
    stringify(new Database(DB_PATH).prepare(`SELECT *FROM emotes`).all(), {
      header: true,
    })
  );
}

// 保存 SQLite 数据库成 JSON 文件，需要传递 `-json` 参数
if (args.has("-json")) {
  writeFileSync(
    "./temp/emote.json",
    JSON.stringify(
      new Database(DB_PATH).prepare(`SELECT *FROM emotes`).all(),
      null,
      2
    )
  );
}

// 保存 SQLite 数据库成压缩后 JSON 文件，需要传递 `-json-min` 参数
if (args.has("-json-min")) {
  writeFileSync(
    "./temp/emote.min.json",
    JSON.stringify(new Database(DB_PATH).prepare(`SELECT *FROM emotes`).all())
  );
}

const end = performance.now();
console.log(
  `Run time: (${end - start}ms) ${new Date(end - start)
    .toISOString()
    .substring(11, 12)}`
);
