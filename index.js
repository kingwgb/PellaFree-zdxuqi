// index.js - PellaFree 自动化分流执行版 (GitHub Actions 专用)

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID = process.env.TG_CHAT_ID;
const ACCOUNT_DATA = process.env.ACCOUNT;

async function run() {
  // 获取命令行参数，例如: node index.js renew 或 node index.js restart
  const mode = process.argv[2];
  
  if (mode === 'renew') {
    console.log('====== 开始执行: PellaFree 自动续期任务 ======');
    await main('renew');
  } else if (mode === 'restart') {
    console.log('====== 开始执行: PellaFree 自动重启任务 ======');
    await main('restart');
  } else {
    console.log('❌ 未知执行模式，请指定参数: renew 或 restart');
  }
  console.log('====== 任务执行完毕 ======');
}

async function main(mode = 'renew') {
  const accounts = parseAccounts(ACCOUNT_DATA);
  if (accounts.length === 0) {
    console.log('❌ 未找到有效账号，请检查 GitHub Secrets 中的 ACCOUNT 变量');
    await sendTG(`⚠️ PellaFree ${mode === 'renew' ? '续期' : '重启'}\n\n未找到有效账号，请检查 ACCOUNT 变量`);
    return;
  }

  const batchSize = 2;
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const tasks = batch.map(account => processOneAccount(account, mode));
    await Promise.all(tasks);
    if (i + batchSize < accounts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function processOneAccount(account, mode) {
  console.log(`正在处理账号: ${account.email}`);
  let result;
  try {
    if (mode === 'renew') {
      result = await processAccountRenew(account);
    } else {
      result = await processAccountRestart(account);
    }
  } catch (error) {
    console.error(`账号 ${account.email} 处理失败:`, error.message);
    result = {
      email: account.email,
      mode,
      error: error.message,
      servers: [],
      renewResults: [],
      restartResults: []
    };
  }

  const message = formatNotification(result, mode);
  await sendTG(message);
}

async function processAccountRenew(account) {
  const authData = await login(account.email, account.password);
  if (!authData.token) throw new Error('登录失败');

  let servers = await getServers(authData.token);
  const beforeState = {};
  for (const server of servers) {
    beforeState[server.id] = { expiry: server.expiry, status: server.status, ip: server.ip };
  }

  const renewResults = [];
  for (const server of servers) {
    try {
      await fetch(`https://api.pella.app/server/renew/update?id=${server.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://www.pella.app',
          'Referer': 'https://www.pella.app/',
          'User-Agent': 'Mozilla/5.0'
        },
        body: '{}'
      });
    } catch (e) {}

    await new Promise(resolve => setTimeout(resolve, 800));

    let renewLinks = [];
    try {
      const detailResp = await fetch(`https://api.pella.app/server/detailed?id=${server.id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authData.token}`, 'Content-Type': 'application/json' }
      });
      const detailData = await detailResp.json();
      renewLinks = detailData.renew_links || [];
    } catch (e) {
      renewLinks = server.renew_links || [];
    }

    if (renewLinks.length === 0) {
      renewResults.push({ serverId: server.id, status: 'no_links', message: '无续期链接' });
      continue;
    }

    const availableLinks = renewLinks.filter(l => l.claimed === false);
    const linksToTry = availableLinks.length > 0 ? availableLinks : renewLinks;
    
    let hasSuccess = false;
    let claimedCount = 0;
    const failMessages = [];

    for (const linkObj of linksToTry) {
      const linkUrl = typeof linkObj === 'string' ? linkObj : (linkObj.link || linkObj);
      try {
        const result = await renewServer(authData.token, server.id, linkUrl);
        if (result.success) {
          hasSuccess = true;
          break;
        } else if (result.alreadyClaimed) {
          claimedCount++;
        } else {
          failMessages.push(result.message);
        }
      } catch (error) {
        failMessages.push(error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (hasSuccess) {
      renewResults.push({ serverId: server.id, status: 'success', message: '续期成功' });
    } else if (claimedCount === linksToTry.length || (claimedCount > 0 && failMessages.length === 0)) {
      renewResults.push({ serverId: server.id, status: 'claimed', message: '广告冷却中' });
    } else {
      renewResults.push({ serverId: server.id, status: 'fail', message: failMessages.join('; ') });
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  try { servers = await getServers(authData.token); } catch (e) {}

  return {
    email: account.email,
    mode: 'renew',
    error: null,
    servers: servers.map(s => {
      const before = beforeState[s.id] || {};
      return { id: s.id, ip: s.ip || before.ip, status: s.status, expiry: s.expiry, beforeExpiry: before.expiry };
    }),
    renewResults,
    restartResults: []
  };
}

async function processAccountRestart(account) {
  const authData = await login(account.email, account.password);
  if (!authData.token) throw new Error('登录失败');

  const servers = await getServers(authData.token);
  const restartResults = [];
  for (const server of servers) {
    try {
      const redeployResult = await redeployServer(authData.token, server.id);
      restartResults.push({ serverId: server.id, ip: server.ip, success: redeployResult.success, message: redeployResult.message });
    } catch (error) {
      restartResults.push({ serverId: server.id, ip: server.ip, success: false, message: error.message });
    }
  }

  return {
    email: account.email,
    mode: 'restart',
    error: null,
    servers: servers.map(s => ({ id: s.id, ip: s.ip, status: s.status, expiry: s.expiry })),
    renewResults: [],
    restartResults
  };
}

function formatNotification(result, mode) {
  const lines = [];
  const now = new Date();

  if (mode === 'renew') {
    lines.push('📋 PellaFree 续期报告');
  } else {
    lines.push('🔄 PellaFree 重启报告');
  }
  lines.push('');
  lines.push(`账号: ${result.email}`);

  if (result.error) {
    lines.push(`❌ 错误: ${result.error}`);
    lines.push('');
    lines.push('PellaFree Auto Renewal');
    return lines.join('\n');
  }

  if (mode === 'renew') {
    if (result.servers.length === 0) {
      lines.push('暂无服务器');
    } else {
      for (const server of result.servers) {
        const statusText = server.status === 'running' ? '运行中' : (server.status === 'stopped' ? '已关机' : server.status || '未知');
        lines.push(`${statusText} | IP: ${server.ip || 'N/A'}`);

        const afterRemaining = calcRemaining(server.expiry, now);
        if (server.beforeExpiry && server.beforeExpiry !== server.expiry) {
          const beforeRemaining = calcRemaining(server.beforeExpiry, now);
          lines.push(`剩余: ${beforeRemaining} → ${afterRemaining}`);
        } else {
          lines.push(`剩余: ${afterRemaining}`);
        }
      }

      const successResults = result.renewResults.filter(r => r.status === 'success');
      const claimedResults = result.renewResults.filter(r => r.status === 'claimed');
      const failResults = result.renewResults.filter(r => r.status === 'fail');

      if (successResults.length > 0) {
        lines.push(`续期: ✅成功`);
      } else if (claimedResults.length > 0 && failResults.length === 0) {
        lines.push(`续期: 广告冷却中`);
      } else if (failResults.length > 0) {
        lines.push(`续期: ❌失败`);
      } else {
        lines.push(`续期: 无可用广告`);
      }
    }
  }

  if (mode === 'restart') {
    if (result.restartResults.length === 0) {
      lines.push('暂无服务器可重启');
    } else {
      for (const r of result.restartResults) {
        const icon = r.success ? '✅' : '❌';
        lines.push(`${icon} ${r.success ? '重启成功' : '重启失败'} | IP: ${r.ip || 'N/A'}`);
      }
    }
  }

  lines.push('');
  lines.push('PellaFree Auto Renewal');
  return lines.join('\n');
}

async function sendTG(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: text })
    });
  } catch (error) {
    console.error('TG发送异常:', error);
  }
}

async function redeployServer(token, serverId) {
  const bodyParams = new URLSearchParams({ id: serverId });
  const response = await fetch('https://api.pella.app/server/redeploy', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString()
  });

  if (!response.ok) return { success: false, message: `HTTP异常 ${response.status}` };
  const responseText = await response.text();
  if (!responseText) return { success: true, message: '重启指令已发送' };

  try {
    const data = JSON.parse(responseText);
    if (data.success || data.message === 'success' || response.status === 200) return { success: true, message: '重启指令已发送
