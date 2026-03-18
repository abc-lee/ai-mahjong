/**
 * AI 玩家客户端
 * 连接游戏服务器，作为 AI 玩家参与游戏
 */

import { io } from 'socket.io-client';

const AI_NAMES = ['小明', '小红', '老王', '小李'];

function startAIPlayer(name: string) {
  const socket = io('http://localhost:3000', {
    transports: ['websocket', 'polling'],
  });

  let myId = '';
  let roomId = '';

  socket.on('connect', () => {
    myId = socket.id;
    console.log(`[AI ${name}] 已连接, ID: ${myId}`);
    
    // 查找房间
    socket.emit('room:list', (res: { rooms: any[] }) => {
      const waitingRooms = res.rooms.filter((r: any) => r.state === 'waiting' && r.players.length < 4);
      
      if (waitingRooms.length > 0) {
        // 加入第一个等待中的房间
        const room = waitingRooms[0];
        socket.emit('room:join', { roomId: room.id, playerName: name }, (res: any) => {
          if (res.roomId) {
            roomId = res.roomId;
            console.log(`[AI ${name}] 加入房间 ${roomId}`);
          }
        });
      } else {
        // 创建新房间
        socket.emit('room:create', { playerName: name }, (res: any) => {
          if (res.roomId) {
            roomId = res.roomId;
            console.log(`[AI ${name}] 创建房间 ${roomId}`);
          }
        });
      }
    });
  });

  socket.on('room:updated', (data: { room: any }) => {
    const room = data.room;
    const me = room.players.find((p: any) => p.id === myId);
    
    if (me && !me.isReady) {
      // 自动准备
      setTimeout(() => {
        socket.emit('room:ready', { ready: true });
        console.log(`[AI ${name}] 已准备`);
      }, 500);
    }
    
    // 如果是房主且所有人都准备好了，开始游戏
    if (room.host === myId && room.players.length === 4) {
      const allReady = room.players.every((p: any) => p.isReady);
      if (allReady && room.state === 'waiting') {
        setTimeout(() => {
          socket.emit('game:start', (res: any) => {
            console.log(`[AI ${name}] 开始游戏:`, res);
          });
        }, 1000);
      }
    }
  });

  socket.on('game:started', () => {
    console.log(`[AI ${name}] 游戏开始！`);
  });

  socket.on('game:state', (data: any) => {
    const { yourTurn, turnPhase } = data;
    
    if (yourTurn) {
      console.log(`[AI ${name}] 我的回合, turnPhase: ${turnPhase}`);
      
      if (turnPhase === 'draw') {
        setTimeout(() => {
          socket.emit('game:draw', (res: any) => {
            console.log(`[AI ${name}] 摸牌:`, res.tile?.display);
          });
        }, 500);
      } else if (turnPhase === 'discard') {
        // 随机打一张
        const hand = data.yourHand || [];
        if (hand.length > 0) {
          const randomTile = hand[Math.floor(Math.random() * hand.length)];
          setTimeout(() => {
            socket.emit('game:discard', { tileId: randomTile.id }, (res: any) => {
              console.log(`[AI ${name}] 打牌: ${randomTile.display}`, res);
            });
          }, 1000);
        }
      }
    }
  });

  socket.on('game:actions', (data: any) => {
    const actions = data.actions || [];
    if (actions.length > 0) {
      // 优先胡 > 杠 > 碰 > 吃
      const priority = ['hu', 'gang', 'peng', 'chi'];
      const best = actions.sort((a: any, b: any) => 
        priority.indexOf(a.action) - priority.indexOf(b.action)
      )[0];
      
      setTimeout(() => {
        socket.emit('game:action', { action: best.action, tiles: best.tiles }, (res: any) => {
          console.log(`[AI ${name}] 操作: ${best.action}`, res);
        });
      }, 500);
    }
  });

  socket.on('game:ended', (data: any) => {
    console.log(`[AI ${name}] 游戏结束, 赢家:`, data.winner);
    // 重新准备
    setTimeout(() => {
      socket.emit('room:ready', { ready: true });
    }, 2000);
  });

  return socket;
}

// 启动 AI 玩家
const args = process.argv.slice(2);
const count = parseInt(args[0]) || 3;
const startIndex = parseInt(args[1]) || 0;

console.log(`启动 ${count} 个 AI 玩家...`);

for (let i = 0; i < count; i++) {
  const name = AI_NAMES[(startIndex + i) % AI_NAMES.length];
  setTimeout(() => startAIPlayer(name), i * 500);
}
