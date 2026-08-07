# ACM 打卡板

一个纯静态的 ACM 刷题打卡网站：每天记录做了多少题、是否补题，可以加备注，数据保存在浏览器本地，也可以导出 JSON 备份。

## 本地打开

直接双击 `index.html` 就能用，不需要服务器。

## 免费部署到 GitHub Pages

1. 在 [github.com](https://github.com) 新建一个仓库，例如 `acm-site`，选择 Public。
2. 在这个文件夹里打开终端，依次执行：

```bash
git add .
git commit -m "ACM 打卡板"
git branch -M main
git remote add origin https://github.com/你的用户名/acm-site.git
git push -u origin main
```

如果提示仓库已存在（比如在 GitHub 上勾选了 README），先执行 `git pull --rebase origin main` 再 push。

3. 打开仓库页面：Settings → Pages → Source 选择 **Deploy from a branch**，Branch 选 `main`，目录选 `/ (root)`，保存。
4. 等 1 到 2 分钟，访问：

```text
https://你的用户名.github.io/acm-site/
```

之后每次修改代码，重复 `git add .`、`git commit`、`git push` 三行，网站会自动更新。

如果仓库名直接叫 `你的用户名.github.io`，那么访问地址就是 `https://你的用户名.github.io/`。
