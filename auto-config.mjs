#!/usr/bin/env node

/**
 * WPS协作通道自动配置脚本
 *
 * 此脚本帮助用户自动获取WPS应用的companyId和其他相关信息
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('WPS协作通道自动配置助手\n');

  // 从环境变量或用户输入获取配置
  let appId = process.env.WPS_APP_ID;
  let secretKey = process.env.WPS_SECRET_KEY;
  let encryptKey = process.env.WPS_ENCRYPT_KEY;
  let apiUrl = process.env.WPS_API_URL || 'https://openapi.wps.cn';

  if (!appId) {
    appId = await promptUser('请输入WPS应用ID (App ID): ');
  }

  if (!secretKey) {
    secretKey = await promptUser('请输入WPS应用密钥 (Secret Key): ');
  }

  if (!encryptKey) {
    encryptKey = await promptUser('请输入WPS加密密钥 (Encrypt Key): ');
  }

  try {
    console.log('\n正在获取用户信息...');

    // 使用tsx运行TypeScript代码来获取公司ID
    const tsCode = `
      import { WPSClient } from './src/wps-api.ts';

      async function fetchCompanyInfo() {
        const client = new WPSClient('${appId}', '${secretKey}', '${apiUrl}');

        try {
          const userInfo = await client.getCurrentUser();
          console.log(JSON.stringify(userInfo));
        } catch (error) {
          console.error('ERROR:' + error.message);
          process.exit(1);
        }
      }

      fetchCompanyInfo();
    `;

    const tempFilePath = path.join(process.cwd(), 'temp-fetch-user.ts');
    await fs.writeFile(tempFilePath, tsCode);

    // 使用tsx运行TypeScript代码
    const result = await runCommand('tsx', [tempFilePath]);

    // 删除临时文件
    await fs.unlink(tempFilePath);

    if (result.startsWith('ERROR:')) {
      throw new Error(result.substring(6)); // Remove 'ERROR:' prefix
    }

    const userInfo = JSON.parse(result.trim());
    const companyId = userInfo.company_id;

    console.log('\n✅ 成功获取到以下信息:');
    console.log(`Company ID: ${companyId}`);
    console.log(`User Name: ${userInfo.user_name}`);
    console.log(`User ID: ${userInfo.id}`);
    console.log(`App ID: ${appId}`);
    console.log(`API URL: ${apiUrl}`);

    // 显示建议的配置
    const config = {
      channels: {
        "wps-xiezuo": {
          enabled: true,
          appId: appId,
          secretKey: secretKey,
          encryptKey: encryptKey,
          companyId: companyId,
          apiUrl: apiUrl
        }
      }
    };

    console.log('\n📋 建议的配置如下:');
    console.log(JSON.stringify(config, null, 2));

    // 询问是否写入配置文件
    const shouldWrite = await promptUser('\n是否将配置写入 ~/.openclaw/config.json? (y/N): ');

    if (shouldWrite.toLowerCase() === 'y' || shouldWrite.toLowerCase() === 'yes') {
      await writeConfigToFile(config);
      console.log('\n✅ 配置已写入 ~/.openclaw/config.json');
    }

    console.log('\n🎉 配置完成！现在您可以启动OpenClaw服务了。');

  } catch (error) {
    console.error('\n❌ 配置失败:', error.message);
    process.exit(1);
  }
}

async function promptUser(question) {
  const { createInterface } = await import('readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function runCommand(command, args) {
  return new Promise(async (resolve, reject) => {
    const { spawn } = await import('child_process');

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--loader=tsx' } // 使用tsx作为loader
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(errorOutput || `Command exited with code ${code}`));
      }
    });
  });
}

async function writeConfigToFile(config) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const configPath = path.join(homeDir, '.openclaw', 'config.json');

  let existingConfig = {};

  // 读取现有配置
  try {
    const configFile = await fs.readFile(configPath, 'utf8');
    existingConfig = JSON.parse(configFile);
  } catch (error) {
    // 如果配置文件不存在，则创建新的
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // 合并配置
  const newConfig = {
    ...existingConfig,
    ...config
  };

  // 确保目录存在
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });

  // 写入新配置
  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
}

// 运行主函数
main().catch(console.error);