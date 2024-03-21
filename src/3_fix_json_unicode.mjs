/**
 * 用来修复ccmuyuu的表情包仓库中，JSON 文件的 Unicode 字符。转换成普通字符，方便阅读。
 * 以及转换 JSON 成多行，方便 DIFF 查看。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv.find((arg) => arg.slice(0, 5).includes("-dir="));

if (!dir) throw new Error("需要传入路径参数 -dir={表情仓库文件夹路径}");

if (!existsSync(dir.slice(5))) throw new Error("无效路径");

const files = readdirSync(dir.slice(5), {
  recursive: true,
  withFileTypes: true,
});

files.forEach((file) => {
  if (file.isFile()) {
    if (file.name.split(".").at(-1) === "json") {
      const path = join(file.path, file.name);
      writeFileSync(
        path,
        JSON.stringify(
          JSON.parse(readFileSync(path).toString("utf-8")),
          null,
          2
        )
      );
    }
  }
});
