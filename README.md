# Node.js Proxy Server

Node.js 代理服务器，支持 Vless、Vmess、Trojan 协议，集成 Cloudflare Argo 隧道和 Nezha 监控。

## 📁 项目文件

- `server.js` - 主程序文件
- `package.json` - Node.js 依赖配置
- `Dockerfile` - Docker 容器配置
- `.dockerignore` - Docker 构建忽略文件

## 🚀 部署到 Apply.build

### 方式一：使用 Dockerfile 部署（推荐）

1. 将所有文件上传到你的 Git 仓库
2. 在 apply.build 创建新项目
3. 选择 "Dockerfile" 部署方式
4. 设置以下配置：

**健康检查路径**: `/health` 或 `/`

**环境变量**（可选）:
```
PORT=3000
UUID=你的UUID
ARGO_DOMAIN=你的域名
ARGO_AUTH=你的认证信息
NEZHA_SERVER=你的服务器
NEZHA_KEY=你的密钥
CFIP=cdns.doon.eu.org
CFPORT=443
```

5. 点击部署

### 方式二：本地构建测试

```bash
# 构建镜像
docker build -t node-proxy-server .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e UUID=你的UUID \
  --name proxy-server \
  node-proxy-server

# 查看日志
docker logs -f proxy-server

# 停止容器
docker stop proxy-server
```

## 🔍 健康检查端点

- `GET /` - 主页，显示服务状态
- `GET /health` - 健康检查（JSON 格式）
- `GET /healthz` - 健康检查（简单文本）
- `GET /status` - 详细状态信息

## 📊 测试健康检查

部署后访问以下地址测试：

```bash
# 测试健康检查
curl https://your-domain.com/health

# 预期返回
{"status":"ok","timestamp":"2024-01-30T..."}
```

## ⚙️ 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | HTTP 服务端口 | 3000 |
| UUID | 用户唯一标识 | 自动生成 |
| ARGO_DOMAIN | Cloudflare 域名 | - |
| ARGO_AUTH | Argo 认证信息 | - |
| ARGO_PORT | Argo 内部端口 | 8001 |
| NEZHA_SERVER | Nezha 监控服务器 | - |
| NEZHA_KEY | Nezha 密钥 | - |
| NEZHA_PORT | Nezha 端口 | - |
| CFIP | Cloudflare IP | cdns.doon.eu.org |
| CFPORT | Cloudflare 端口 | 443 |
| SUB_PATH | 订阅路径 | sb |
| FILE_PATH | 临时文件路径 | ./tmp |
| AUTO_ACCESS | 自动保活 | false |
| PROJECT_URL | 项目 URL | - |
| UPLOAD_URL | 上传 URL | - |
| NAME | 节点名称 | - |

## 🐛 故障排查

### 健康检查失败

1. 检查容器日志：`docker logs <container-id>`
2. 确认端口映射正确
3. 测试健康检查端点：`curl http://localhost:3000/health`

### 服务启动慢

- Dockerfile 中已设置 `--start-period=40s`，给予足够的启动时间
- 健康检查会在 40 秒后才开始

### 文件下载失败

- 检查网络连接
- 查看日志中的下载错误信息
- 确认系统架构（ARM/AMD）正确

## 📝 注意事项

1. **健康检查**：服务启动后立即响应健康检查，不会阻塞
2. **后台初始化**：文件下载、进程启动在后台进行
3. **容器优化**：使用 Alpine 镜像，体积小，启动快
4. **自动清理**：90 秒后自动清理临时文件

## 📄 许可证

MIT License
