/**
 * Agent 接入测试脚本
 * 模拟 AI Agent 连接游戏服务器并参与打牌
 * 
 * 运行方式: npx ts-node scripts/test-agent-connect.ts
 */

import { io, Socket } from 'socket.io-client';

// 测试配置
const SERVER_URL = 'http://localhost:3000';
const TEST_ROOM_ID = 'test-room';

// Agent 配置
interface AgentConfig {
  id: string;
  name: string;
  type: 'ai-agent' | 'ai-auto';
}

// 创建测试 Agent
function createTestAgent(config: AgentConfig): Socket {
  const socket = io(SERVER_URL, {
    auth: {
      type: config.type,
      agentId: config.id,
      agentName: config.name,
    },
  });

  socket.on('connect', () => {
    console.log(`[${config.name}] 已连接到服务器`);
  });

  socket.on('disconnect', () => {
    console.log(`[${config.name}] 断开连接`);
  });

  // 接收轮次通知
  socket.on('agent:your_turn', (data: any) => {
    console.log(`[${config.name}] 收到轮次通知:`, data.phase);
    console.log(`[${config.name}] 手牌:`, data.hand?.map((t: any) => t.display).join(', '));
    
    // 模拟决策：摸牌阶段
    if (data.phase === 'draw') {
      socket.emit('agent:command', { cmd: 'draw' }, (res: any) => {
        console.log(`[${config.name}] 摸牌结果:`, res);
      });
    }
    // 打牌阶段
    else if (data.phase === 'discard' && data.hand?.length > 0) {
      // 随机打一张
      const randomTile = data.hand[Math.floor(Math.random() * data.hand.length)];
      console.log(`[${config.name}] 打出: ${randomTile.display}`);
      socket.emit('agent:command', { cmd: 'discard', tileId: randomTile.id }, (res: any) => {
        console.log(`[${config.name}] 打牌结果:`, res);
      });
    }
  });

  // 接收房间更新
  socket.on('room:updated', (data: any) => {
    console.log(`[${config.name}] 房间更新，玩家数: ${data.room?.players?.length}`);
  });

  // 接收游戏状态
  socket.on('game:state', (data: any) => {
    console.log(`[${config.name}] 游戏状态更新`);
  });

  // 接收错误
  socket.on('error', (err: any) => {
    console.error(`[${config.name}] 错误:`, err);
  });

  return socket;
}

// 主测试流程
async function runTest() {
  console.log('=== AI Agent 接入测试 ===\n');

  // 创建 4 个测试 Agent
  const agents: AgentConfig[] = [
    { id: 'agent-1', name: '紫璃', type: 'ai-agent' },
    { id: 'agent-2', name: '白泽', type: 'ai-agent' },
    { id: 'agent-3', name: '李瞳', type: 'ai-agent' },
    { id: 'agent-4', name: '自动托管', type: 'ai-auto' },
  ];

  const sockets: Socket[] = [];

  // 等待所有连接
  console.log('正在连接服务器...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 创建连接
  for (const agent of agents) {
    const socket = createTestAgent(agent);
    sockets.push(socket);
  }

  // 等待连接建立
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Agent 1 创建房间
  console.log('\n[紫璃] 创建房间...');
  sockets[0].emit('room:create', { playerName: '紫璃' }, (res: any) => {
    console.log('[紫璃] 创建房间结果:', res);
    if (res.roomId) {
      const roomId = res.roomId;
      
      // 其他 Agent 加入房间
      setTimeout(() => {
        sockets[1].emit('room:joinAI', {
          roomId,
          agentId: 'agent-2',
          agentName: '白泽',
          type: 'ai-agent',
        }, (res: any) => {
          console.log('[白泽] 加入结果:', res);
        });
      }, 500);

      setTimeout(() => {
        sockets[2].emit('room:joinAI', {
          roomId,
          agentId: 'agent-3',
          agentName: '李瞳',
          type: 'ai-agent',
        }, (res: any) => {
          console.log('[李瞳] 加入结果:', res);
        });
      }, 1000);

      setTimeout(() => {
        sockets[3].emit('room:joinAI', {
          roomId,
          agentId: 'agent-4',
          agentName: '自动托管',
          type: 'ai-auto',
        }, (res: any) => {
          console.log('[自动托管] 加入结果:', res);
        });
      }, 1500);

      // 开始游戏
      setTimeout(() => {
        console.log('\n[紫璃] 开始游戏...');
        sockets[0].emit('game:start', {}, (res: any) => {
          console.log('[紫璃] 开始游戏结果:', res);
        });
      }, 3000);
    }
  });

  // 运行 60 秒后退出
  setTimeout(() => {
    console.log('\n测试结束，断开所有连接...');
    sockets.forEach(s => s.disconnect());
    process.exit(0);
  }, 60000);
}

// 运行测试
runTest().catch(console.error);
