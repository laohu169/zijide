# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖
RUN apk add --no-cache \
    bash \
    curl \
    ca-certificates

# 复制 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm install --production

# 复制应用代码
COPY server.js ./

# 创建临时文件目录
RUN mkdir -p ./tmp

# 暴露端口（默认 3000，可通过环境变量修改）
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "server.js"]
