# 个人开发私服搭建与运维完全手册

> **硬件基础**：AMD 9800X3D / RTX 5070Ti / 48GB DDR5 / 2TB PCIe 5.0 + 1TB 三星 980
> **技术栈**：Win11 + VMware Workstation Pro + Ubuntu Server 24.04 LTS
> **目标**：开发与娱乐物理隔离，远程开发零负担

---

## 目录

- [一、硬件概览与架构设计](#一硬件概览与架构设计)
- [二、资源分配方案](#二资源分配方案)
- [三、软件安装与配置](#三软件安装与配置)
  - [3.1 VMware Workstation Pro](#31-vmware-workstation-pro)
  - [3.2 Ubuntu Server 24.04 LTS](#32-ubuntu-server-2404-lts)
  - [3.3 虚拟机初始配置](#33-虚拟机初始配置)
- [四、网络配置](#四网络配置)
  - [4.1 Tailscale 内网穿透](#41-tailscale-内网穿透)
  - [4.2 Cloudflare Tunnel](#42-cloudflare-tunnel)
- [五、开发环境搭建](#五开发环境搭建)
  - [5.1 Docker 与 Docker Compose](#51-docker-与-docker-compose)
  - [5.2 运行时环境](#52-运行时环境)
  - [5.3 数据库服务](#53-数据库服务)
- [六、远程开发配置](#六远程开发配置)
  - [6.1 VS Code Remote SSH](#61-vs-code-remote-ssh)
  - [6.2 文件传输与管理](#62-文件传输与管理)
- [七、AI 编码助手（OpenCode）](#七ai-编码助手opencode)
- [八、日常操作手册](#八日常操作手册)
  - [8.1 开发与娱乐模式切换](#81-开发与娱乐模式切换)
  - [8.2 快照与备份策略](#82-快照与备份策略)
- [九、费用测算](#九费用测算)
- [十、常见问题](#十常见问题)

---

## 一、硬件概览与架构设计

### 1.1 硬件清单

| 组件 | 型号 | 开发场景评价 |
|------|------|-------------|
| CPU | AMD 9800X3D（8C/16T） | 单核极强，分配 6 核给虚拟机 |
| 显卡 | NVIDIA RTX 5070Ti 16G | 仅 Win11 游戏使用，不直通 |
| 内存 | DDR5 48GB | 32G 给虚拟机，16G 留宿主 |
| 系统盘 | 2TB PCIe 5.0 SSD | Win11 系统 + 游戏 |
| 数据盘 | 1TB 三星 980 | **整块给虚拟机（开发数据）** |

### 1.2 架构设计原则

采用**"宿主机负责娱乐，虚拟机负责开发"**的物理隔离策略：

- **Win11 宿主**：仅安装游戏、影音娱乐软件，**零开发环境**
- **Ubuntu 虚拟机**：承载全部开发环境（JDK、Node、Docker、数据库）
- **1TB SSD 整块划给虚拟机**：开发数据与娱乐数据物理分离
- **32GB 内存 + 6 核 CPU 给虚拟机**：开发体验碾压办公笔记本
- **5070Ti 显卡不直通虚拟机**：游戏时 100% 释放

### 1.3 整体架构图

```
笔记本（远程终端） → Tailscale 虚拟网络 → 家中 Ubuntu 虚拟机（开发私服）

家中显示器 → Win11 宿主 → VMware → Ubuntu 虚拟机（本地操作）
```

---

## 二、资源分配方案

### 2.1 虚拟机资源分配表

| 资源 | 虚拟机（开发） | Win11 宿主（娱乐） | 说明 |
|------|---------------|-------------------|------|
| CPU | 6 核 / 12 线程 | 2 核 / 4 线程 | 保留核心给游戏 |
| 内存 | 32 GB | 16 GB | 虚拟机独享 |
| 硬盘 | 1TB 三星 980 | 2TB PCIe 5.0 | 物理隔离 |
| 显卡 | 无（纯 CPU） | 5070Ti 16G | 游戏独占 |
| 网络 | NAT + Tailscale | 直连 | 内网穿透 |

### 2.2 关键配置说明

- **CPU**：分配 6 核（12 线程），保留 2 核给 Win11 宿主确保游戏流畅
- **内存**：分配 32GB，保留 16GB 给 Win11 宿主及 5070Ti 显存交换
- **硬盘**：1TB 三星 980 整体作为虚拟机存储，代码+数据库+Docker 镜像全在里面
- **显卡**：**不勾选 3D 加速，不直通 GPU**，纯 CPU 渲染即可

---

## 三、软件安装与配置

### 3.1 VMware Workstation Pro

**费用**：个人用户完全免费（17.5.2+ 版本）

**下载**：
1. 访问 https://support.broadcom.com
2. 注册 Broadcom 账号（免费）
3. 搜索 "VMware Workstation Pro"
4. 选择 **Personal Use** 版本下载安装

**安装**：全部默认下一步，完成后重启电脑。

**关键设置**（编辑 → 首选项）：
```
内存 → 额外内存 → 选择"调整所有虚拟机内存使其适应预留的主机 RAM"
优先级 → 抓取输入的内容 → 选择"高"
显示器 → 取消勾选"自动适应客户机"
```

### 3.2 Ubuntu Server 24.04 LTS

**费用**：永久免费（LTS 支持到 2034 年）

**下载**：https://ubuntu.com/download/server
- 选择：**Ubuntu Server 24.04.2 LTS（64-bit，无桌面版）**

**创建虚拟机**（VMware → 文件 → 新建虚拟机 → 典型）：

| 步骤 | 选择 |
|------|------|
| 安装来源 | 稍后安装操作系统 |
| 客户机系统 | Linux → Ubuntu 64-bit |
| 虚拟机名称 | DevServer |
| 存储位置 | `D:\VMware\DevServer`（指向 1TB SSD） |
| 处理器 | 6 核 |
| 内存 | 32768 MB（32GB） |
| 网络 | NAT |
| I/O 控制器 | LSI Logic（默认） |
| 磁盘类型 | NVMe |
| 磁盘 | 创建新虚拟磁盘，最大 800GB，存储为单个文件 |

**安装 Ubuntu Server**（启动虚拟机，加载 ISO）：

| 选项 | 推荐设置 |
|------|---------|
| 语言 | English 或 中文 |
| 网络 | DHCP（安装后再固定 IP） |
| 代理 | 留空 |
| 镜像地址 | `mirror.tuna.tsinghua.edu.cn`（清华源） |
| 存储 | Use Entire Disk → 确认分区 |
| 用户名/主机名 | `dev` / `devserver` |
| SSH | **勾选 Install OpenSSH server** |
| Featured Snaps | **全不选**（后续手动安装） |

### 3.3 虚拟机初始配置

登录系统后依次执行：

**固定 IP 地址**：
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```

写入以下内容：
```yaml
network:
  ethernets:
    ens33:
      dhcp4: false
      addresses: [192.168.182.100/24]
      routes:
        - to: default
          via: 192.168.182.2
      nameservers:
        addresses: [223.5.5.5, 119.29.29.29]
  version: 2
```

应用配置：
```bash
sudo netplan apply
```

**更换国内软件源**：
```bash
sudo sed -i 's/archive.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/ubuntu.sources
sudo sed -i 's/security.ubuntu.com/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update && sudo apt upgrade -y
```

**拍摄第一个快照**：`Clean-Base`（Ubuntu 纯净状态）

---

## 四、网络配置

### 4.1 Tailscale 内网穿透（首选）

Tailscale 基于 WireGuard，创建虚拟局域网，所有设备获得固定虚拟 IP，P2P 直连延迟最低。

**虚拟机端**：
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
按提示访问链接登录，记录虚拟机的 Tailscale IP（如 `100.x.x.x`）。

**笔记本端**：
- 下载：tailscale.com/download
- 安装后登录**同一账号**

**使用**：
```bash
# 笔记本直接通过 Tailscale IP SSH 连接
ssh dev@100.x.x.x
```

### 4.2 Cloudflare Tunnel（公网展示）

需要给同事/朋友展示项目时使用，可获得固定域名。

```bash
# 安装 cloudflared
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 登录并创建隧道
cloudflared tunnel login
cloudflared tunnel create devserver
cloudflared tunnel route dns devserver devserver.yourdomain.com
```

---

## 五、开发环境搭建

所有服务通过 Docker Compose 统一管理。

### 5.1 Docker 与 Docker Compose

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

**配置国内镜像加速**：
```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<EOF
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
sudo systemctl restart docker
```

### 5.2 运行时环境

```bash
# JDK 21
sudo apt install -y openjdk-21-jdk
java -version

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# Git
sudo apt install -y git
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Python 3
sudo apt install -y python3 python3-pip
```

### 5.3 数据库服务

创建 `~/docker/docker-compose.yml`：

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: pg
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: devdb
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          memory: 2G

  mysql:
    image: mysql:8
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: devdb
      MYSQL_USER: dev
      MYSQL_PASSWORD: devpass
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          memory: 512M

volumes:
  pg_data:
  mysql_data:
```

启动：
```bash
cd ~/docker
docker compose up -d
```

常用命令：
```bash
docker compose ps           # 查看运行状态
docker compose logs -f      # 查看日志
docker compose stop         # 停止服务
docker compose down         # 停止并删除容器
docker system prune -a      # 清理所有缓存（省空间）
```

**拍摄第二个快照**：`Dev-Ready`（开发环境基准）

---

## 六、远程开发配置

### 6.1 VS Code Remote SSH

**笔记本端**（只装这些）：
1. 安装 VS Code
2. 安装 **Remote Development** 扩展包
3. 按 `Ctrl+Shift+P` → "Remote-SSH: Open SSH Configuration File" → 选择 config
4. 添加：

```
Host devserver
    HostName 100.x.x.x          # Tailscale IP
    User dev
    Port 22
    IdentityFile ~/.ssh/id_ed25519
```

**SSH 免密登录**：
```bash
# 笔记本端生成密钥（如没有）
ssh-keygen -t ed25519 -C "your@email.com"

# 复制公钥到虚拟机
ssh-copy-id dev@100.x.x.x
```

**连接开发**：
- 点击 VS Code 左下角绿色按钮 → "Connect to Host..." → 选择 `devserver`
- 连接成功后，文件树 = 虚拟机文件系统，终端 = 虚拟机 bash
- 代码补全、调试、Git 全在虚拟机执行，笔记本只负责渲染 UI

### 6.2 文件传输与管理

| 场景 | 推荐方案 | 操作方式 |
|------|---------|---------|
| 日常代码编辑 | VS Code Remote | 直接拖拽文件到文件树 |
| 大文件传输（>500MB） | VMware 共享文件夹 | `D:/Share` ↔ `/mnt/hgfs/Share` |
| 自动同步 | Syncthing | 后台 P2P 同步 |
| 云端备份 | rclone + 阿里云盘 | 定时脚本同步 |

**VMware 共享文件夹设置**：
虚拟机 → 设置 → 选项 → 共享文件夹 → 总是启用 → 添加 `D:/Share`

虚拟机内访问：
```bash
ls /mnt/hgfs/Share
```

> ⚠️ **重要**：代码放在 `/home/dev/projects`（ext4 文件系统），**不要在共享文件夹中直接开发项目**（`node_modules` IO 性能差）。

---

## 七、AI 编码助手（OpenCode）

OpenCode 是终端型 AI 编码代理，需直接读取代码、执行命令，因此**必须安装在虚拟机中**。

### 7.1 安装

```bash
# 虚拟机中执行
npm install -g opencode-ai
```

### 7.2 配置 API Key（BYOK 模式）

```bash
export ANTHROPIC_API_KEY="sk-ant-..."     # Claude
# 或
export OPENAI_API_KEY="sk-..."            # GPT
# 或
export GOOGLE_API_KEY="..."               # Gemini
```

### 7.3 使用

```bash
cd ~/projects/your-repo
opencode
```

支持自然语言指令：
- `"重构这个函数，提取重复逻辑"`
- `"给这个模块写单元测试"`
- `"解释这段代码的作用"`

### 7.4 VS Code 集成

VS Code Remote 连接虚拟机后，在集成终端运行 `opencode`，会自动安装 VS Code 扩展。

### 7.5 费用

- OpenCode 本身：**免费**
- API 调用费：**约 $2-8/月**（取决于使用频率）

---

## 八、日常操作手册

### 8.1 开发与娱乐模式切换

| 场景 | 操作步骤 | 耗时 |
|------|---------|------|
| 开始开发 | VMware → 恢复虚拟机 → VS Code 连接 | 约 15 秒 |
| 暂停开发（去玩游戏） | VS Code 断开 → VMware 挂起 | 约 5 秒 |
| 彻底关机 | VMware → 关机 | 约 10 秒 |
| 恢复开发 | VMware → 从挂起恢复 | 约 5 秒 |

**挂起 vs 关机**：
- **挂起（Suspend）**：开发状态完全保留（打开的终端、运行的服务），恢复只需 5 秒。适合临时切换去玩游戏。
- **关机（Shut Down）**：完全释放资源。适合当天不再开发。

### 8.2 快照与备份策略

**VMware 快照管理**：

| 快照名称 | 拍摄时机 | 用途 |
|---------|---------|------|
| `Clean-Base` | Ubuntu 初始安装完成 | 系统玩坏了秒回滚 |
| `Dev-Ready` | JDK + Node + Docker + 数据库全配好 | 开发环境基准 |
| `Project-X` | 重要项目里程碑前 | 项目级回滚 |

操作：虚拟机 → 快照 → 拍摄快照 / 管理 → 转到

**数据自动备份**（添加到 `crontab -e`）：

```bash
# 数据库每日凌晨 2 点备份
0 2 * * * docker exec pg pg_dump -U dev devdb > ~/backup/devdb_$(date +\%Y\%m\%d).sql
0 2 * * * docker exec mysql mysqldump -u dev -pdevpass devdb > ~/backup/mysql_$(date +\%Y\%m\%d).sql

# 代码备份到云盘
rclone sync ~/projects aliyun:backup/dev-projects
```

---

## 九、费用测算

### 9.1 电费（上海居民电价：0.617 元/度）

| 使用模式 | 假设条件 | 月耗电量 | 月电费 |
|---------|---------|---------|--------|
| 正常使用 | 每天开发 4h + 待机 20h | 78 度 | **约 48 元** |
| 优化模式 | 夜间关机 8h | 54 度 | **约 33 元** |
| 极致模式 | 仅开发时开机 | 18 度 | **约 11 元** |

> 💡 建议申请分时电表，谷电（22:00-6:00）仅 **0.307 元/度**

### 9.2 网络费用

| 项目 | 费用 |
|------|------|
| Tailscale | 免费 |
| Cloudflare Tunnel | 免费 |
| 上海家用宽带上行（30-50Mbps） | 已有，沉没成本 |

### 9.3 与云服务器对比

| 配置 | 云服务器月费 | 家庭方案月费 |
|------|-------------|-------------|
| 6核 16G + 200G SSD | 200-300 元 | - |
| 6核 32G + 1T SSD | 500-800 元 | **约 40 元电费** |
| GPU 实例（5070Ti 同级） | 1500-3000 元 | **0 元（已有）** |
| **年度节省** | - | **5000-10000 元** |

---

## 十、常见问题

### Q1：虚拟化损耗大吗？性能还剩多少？

VMware 虚拟化损耗约 5-10%。9800X3D 虚拟化后单核性能仍远超 i5-1340P 办公本，整体体验碾压。

### Q2：500GB Win11 空间够吗？

Win11 系统约 80-100G，剩余 400G 给游戏。注意定期清理临时文件。

### Q3：Tailscale 连不上怎么办？

确保两边都登录同一账号，且虚拟机防火墙放行：
```bash
sudo ufw allow 41641/udp
```

### Q4：虚拟机内能跑 GPU 加速吗？

本方案不直通 GPU。如需 GPU 加速（如本地 AI 推理），需在 Win11 宿主操作，虚拟机无法使用 5070Ti。

### Q5：同事访问我的项目需要什么？

配置 Cloudflare Tunnel 后，你会获得一个固定域名（如 `devserver.yourdomain.com`），同事直接浏览器访问即可，无需任何客户端。

### Q6：代码放在虚拟机哪里？

统一放在 `/home/dev/projects` 下（ext4 文件系统），**不要在 VMware 共享文件夹或 Windows 挂载盘中开发**。

### Q7：如何防止虚拟机后台吃资源？

VMware → 编辑 → 首选项 → 内存 → 选择"调整所有虚拟机内存使其适应预留的主机 RAM"。**挂起虚拟机后内存完全释放**。

### Q8：Win11 自动更新重启怎么办？

设置 → Windows 更新 → 高级选项 → 暂停更新（最多 5 周）。建议手动控制更新时机。

---

> **Happy Coding** — 让每一行代码都跑在属于自己的服务器上
