## 开发
```
# 1. 安装依赖
npm install

# 2. 编译
npm run compile

# 3. 按 F5 启动调试

# 4. 打包（平台专属包）
./package-all.sh
# 输出到 sema-vscode-extension-darwin-x64-<version>.vsix 等文件

# 5. 发布所有平台（需提前 vsce login 或使用 --pat <token>）
for vsix in sema-vscode-extension-*.vsix; do vsce publish --packagePath "$vsix"; done
```
