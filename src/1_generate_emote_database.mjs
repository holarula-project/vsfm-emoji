/**
 * 处理Mikufans装扮表情包仓库，生成SQLite数据库/CSV/JSON
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";
import { stringify } from "csv-stringify/sync";
import download from "download";
import logUpdate from "log-update";

const start = performance.now();

const URL = {
  ORIGIN:
    "https://github.com/ccmuyuu/bilibili-emotes/archive/refs/heads/master.zip",
  FORKED:
    "https://github.com/holarula-project/mikufans-emotes/archive/refs/heads/master.zip",
};
const DB_PATH = "./temp/emote.db"; // 表情包数据库路径
const PACKAGES_FOLDER = "./temp/packages"; // 表情包下载
const EMOTES_FOLDER = "./temp/emotes"; // 表情包数据库
const args = new Set([...process.argv.slice(2)]);

const log = (msg) => {
  logUpdate(
    new Date(performance.now() - start).toISOString().substring(11, 23) +
      "\n" +
      msg
  );
};

// 下载表情包仓库 ZIP, 需要传递 `-dl` 参数
if (args.has("-dl")) {
  await download(
    URL[args.has("-forked") ? "FORKED" : "ORIGIN"],
    PACKAGES_FOLDER,
    {
      extract: true,
      filename: "emotes.zip",
      strip: 1,
    }
  );
}

const db = new Database(DB_PATH, {
  verbose: args.has("-sql-verbose") ? log : undefined,
});
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
  console.log("已初始化 SQLite 数据库。");
}

// 导入表情包数据进入SQLite数据库，需要传递 `-sqlite` 参数
if (args.has("-sqlite")) {
  const packageFolders = readdirSync(PACKAGES_FOLDER);
  const invalid = { emote_name: [], danmaku_name: [] };

  db.prepare("DELETE FROM emotes").run();

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

  for (const packageFolder of packageFolders) {
    const path = join(PACKAGES_FOLDER, packageFolder, packageFolder + ".json");
    if (!existsSync(path)) continue;

    const {
      data: { packages },
    } = JSON.parse(readFileSync(path).toString("utf-8"));

    for (const pkg of packages) {
      insertMany.immediate(
        pkg.emote.reduce((list, emote) => {
          const record = {
            folder_name: packageFolder,
            package_name: pkg.text,
            emote_name: emote.meta.alias,
            danmaku_name: emote.text,
            og_file_name: emote.url.includes(".png")
              ? emote.url.split("/").at(-1)
              : null,
          };
          if (record.og_file_name === null) {
            return list;
          } else if (!emote.meta.alias) {
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

  log(
    `表情包数据已导入，无效表情：无表情名/图片文件名错误(${invalid.emote_name.length}) / 无弹幕名(${invalid.danmaku_name.length})`
  );
}

/**
 * @type {Array<{
 *  id: number;
 *  folder_name: string;
 *  og_file_name: string;
 *  package_name: string;
 *  emote_name: string;
 *  danmaku_name: string;
 * }>}
 */
const ALL_EMOTES = db.prepare(`SELECT *FROM emotes`).all();

if (
  ["-csv", "-json", "-json-min", "-img"].some((arg) => args.has(arg)) &&
  ALL_EMOTES.length === 0
) {
  throw new Error("数据库中无表情数据，请初始化及导入表情数据");
}

// 保存 SQLite 数据库成 CSV 文件，需要传递 `-csv` 参数
if (args.has("-csv")) {
  writeFileSync("./temp/emote.csv", stringify(ALL_EMOTES, { header: true }));

  log("已生成CSV文件");
}

// 保存 SQLite 数据库成 JSON 文件，需要传递 `-json` 参数
if (args.has("-json")) {
  writeFileSync("./temp/emote.json", JSON.stringify(ALL_EMOTES.all(), null, 2));

  log("已生成JSON文件");
}

// 保存 SQLite 数据库成压缩后 JSON 文件，需要传递 `-json-min` 参数
if (args.has("-json-min")) {
  writeFileSync("./temp/emote.min.json", JSON.stringify(ALL_EMOTES));

  log("已生成压缩JSON文件。");
}

if (args.has("-img")) {
  if (existsSync(EMOTES_FOLDER)) {
    rmSync(EMOTES_FOLDER, { recursive: true, force: true });
  }
  mkdirSync(EMOTES_FOLDER);

  const translocate = args.has("-move") ? renameSync : copyFileSync;

  for (const { folder_name, emote_name, danmaku_name } of ALL_EMOTES) {
    const oldEmotePath = join(
      PACKAGES_FOLDER,
      folder_name,
      emote_name + ".png"
    );
    const newEmotePath = join(EMOTES_FOLDER, danmaku_name + ".png");

    if (!existsSync(oldEmotePath)) {
      throw new Error(oldEmotePath + " 路径不存在");
    }

    translocate(oldEmotePath, newEmotePath);
    log("已转存：\n" + oldEmotePath + "\n => \n" + newEmotePath);
  }
}

log(
  `运行时间: ${new Date(performance.now() - start)
    .toISOString()
    .substring(11, 23)}`
);
