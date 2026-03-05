/**
 * 完整游戏流程测试脚本
 * 测试 4 个 Agent 进行完整一局游戏
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

interface AgentState {
  socket: Socket;
  id: string;
  name: string;
  hand: any[];
  roomId: string | null;
  isMyTurn: boolean;
}

// Agent 状态管理
const agents: AgentState[] = [];

function createAgent(id: string, name: string): Promise<AgentState> {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL);
    const state: AgentState = {
      socket,
      id,
      name,
      hand: [],
      roomId: null,
      isMyTurn: false,
    };

    socket.on('connect', () => {
      console.log(`[${name}] 连接成功`);
      resolve(state);
    });

    // 轮次通知
    socket.on('agent:your_turn', (data: any) => {
      state.isMyTurn = true;
      state.hand = data.hand || [];
      console.log(`\n[${name}] 轮到我了! 阶段: ${data.phase}, 手牌: ${state.hand.length}张`);
      
      if (data.phase === 'draw') {
        // 摸牌
        setTimeout(() => {
          socket.emit('agent:command', { cmd: 'draw' }, (res: any) => {
            console.log(`[${name}] 摸牌:`, res.success ? '成功' : res.error);
          });
        }, 500);
      } else if (data.phase === 'discard') {
        // 打牌 - 随机选一张
        if (state.hand.length > 0) {
          setTimeout(() => {
            const tile = state.hand[Math.floor(Math.random() * state.hand.length)];
            console.log(`[${name}] 打出: ${tile.display}`);
            socket.emit('agent:command', { cmd: 'discard', tileId: tile.id }, (res: any) => {
              if (!res.success) {
                console.log(`[${name}] 打牌失败: ${res.error}`);
              }
            });
          }, 1000);
        }
      }
    });

    // 游戏状态更新
    socket.on('game:state', (data: any) => {
      if (data.yourHand) {
        state.hand = data.yourHand;
      }
      state.isMyTurn = data.yourTurn;
    });

    // 游戏结束
    socket.on('game:ended', (data: any) => {
      console.log(`\n=== 游戏结束 ===`);
      console.log(`赢家: ${data.winner}`);
      console.log(`胡牌: ${data.winningHand?.tiles?.map((t: any) => t.display).join(' ')}`);
    });

    // 房间更新
    socket.on('room:updated', (data: any) => {
      // 静默处理
    });

    socket.on('disconnect', () => {
      console.log(`[${name}] 断开连接`);
    });

    socket.on('error', (err: any) => {
      console.error(`[${name}] 错误:`, err);
    });
  });
}

async function main() {
  console.log('=== 完整游戏流程测试 ===\n');

  // 创建 4 个 Agent
  console.log('创建 Agent...');
  agents.push(await createAgent('agent-1', '紫璃'));
  agents.push(await createAgent('agent-2', '白泽'));
  agents.push(await createAgent('agent-3', '李瞳'));
  agents.push(await createAgent('agent-4', '测试员'));

  await sleep(1000);

  // Agent 1 创建房间
  console.log('\n[紫璃] 创建房间...');
  const createRes = await emitPromise(agents[0].socket, 'room:create', { playerName: '紫璃' });
  console.log('[紫璃] 创建房间:', createRes.roomId);
  
  const roomId = createRes.roomId;
  agents[0].roomId = roomId;

  await sleep(500);

  // 其他 Agent 加入
  for (let i = 1; i < 4; i++) {
    const res = await emitPromise(agents[i].socket, 'room:joinAI', {
      roomId,
      agentId: agents[i].id,
      agentName: agents[i].name,
      type: 'ai-agent',
    });
    console.log(`[${agents[i].name}] 加入房间:`, res.success ? '成功' : res.error);
    agents[i].roomId = roomId;
  }

  await sleep(1000);

  // 开始游戏
  console.log('\n[紫璃] 开始游戏...');
  const startRes = await emitPromise(agents[0].socket, 'game:start', {});
  console.log('[紫璃] 开始游戏:', startRes.success ? '成功' : startRes.message);

  // 等待游戏进行
  console.log('\n游戏进行中... (观察日志)');
  await sleep(120000);

  console.log('\n测试结束');
  agents.forEach(a => a.socket.disconnect());
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function emitPromise(socket: Socket, event: string, data: any): Promise<any> {
  return new Promise(resolve => {
    socket.emit(event, data, resolve);
  });
}

main().catch(console.error);
