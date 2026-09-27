# 柜满载发布说明

柜满载是纯静态网页应用，不需要数据库，也不会上传纸箱和装柜数据。发布后，其他人只要打开网址即可使用；在支持安装的浏览器中，还可以安装到桌面或手机主屏幕。

## 路线一：Cloudflare Pages

适合快速分享给外部客户、同事和海外用户。

1. 在 GitHub 或 GitLab 新建仓库，把当前文件夹中的全部文件上传到仓库。
2. 登录 Cloudflare，进入 `Workers & Pages`。
3. 选择 `Create application`，进入 `Pages`，然后选择 `Connect to Git`。
4. 连接仓库，项目名可填写 `container-loader`。
5. `Build command` 留空。
6. `Build output directory` 填写 `/`。
7. 点击保存并部署。
8. 部署完成后，Cloudflare 会生成一个 `*.pages.dev` 网址，可直接分享。

官方文档：

- https://developers.cloudflare.com/pages/get-started/git-integration/

## 路线二：GitHub Pages

仓库中已经包含自动部署工作流。把当前文件夹作为一个 GitHub 仓库发布到 `main` 分支后：

1. 打开仓库的 `Settings`。
2. 进入 `Pages`。
3. 在 `Build and deployment` 的 `Source` 中选择 `GitHub Actions`。
4. 推送代码后，等待 `Deploy container loader to GitHub Pages` 工作流完成。
5. 在部署结果中取得正式网址。

官方文档：

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 路线三：公司内网

如果需要限制为团队内部使用，可以把整个文件夹放到公司服务器：

- IIS、Nginx 或 Apache 的静态网站目录。
- 建议配置 HTTPS；安装为网页应用必须使用 HTTPS，`localhost` 除外。
- 确认 `.webmanifest` 返回 `application/manifest+json`，`.js` 返回 JavaScript MIME 类型。
- 可以继续保留文件夹内已有的自动更新目录结构。

## 国内公网注意事项

- 如果使用中国大陆服务器、CDN 和自有域名，通常需要先完成域名 ICP 备案。
- 如果只是内部工具，优先使用公司内网域名或私有访问策略。
- 当前应用把录入数据保存在每位用户自己的浏览器中，不需要服务器保存用户数据。
- 分享链接会把当前柜型和货物数据编码在网址中。分享前应确认尺寸和货号不包含不宜公开的信息。

## 更新版本

修改页面后，把 `sw.js` 第一行的 `CACHE_NAME` 改为新的版本号，例如 `container-loader-v2`，再重新部署。这样已经安装过应用的用户会自动获取新版本。
