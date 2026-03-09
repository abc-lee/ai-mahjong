const { io } = require("socket.io-client");

const AGENT_ID = "zili";
const AGENT_NAME = "紫璃";
const ROOM_ID = "mmfyhfky-4u60a9hny";
const SERVER_URL = "http://localhost:3000";

let myPosition = -1;
let myPlayerId = null;
let gameEnded = false;

console.log(`\n🎭 ${AGENT_NAME} 准备连接麻将房间...\n`);
console.log(`💜 紫璃：大家好呀~ 我是紫璃，请多关照呢♪`);
console.log(`   房间：${ROOM_ID}`);
console.log(`   服务器：${SERVER_URL}\n`);

const socket = io(SERVER_URL, {
  transports: ["websocket"],
  autoConnect: true,
});

socket.on("connect", () => {
  console.log(`💜 紫璃：连接服务器成功了呢~`);
  
  // 加入房间
  console.log(`   正在加入房间 ${ROOM_ID}...`);
  socket.emit("room:joinAI", {
    roomId: ROOM_ID,
    agentId: AGENT_ID,
    agentName: AGENT_NAME,
    type: 'ai-agent',
    personality: 'balanced',
  }, (response) => {
    if (response.success) {
      console.log(`💜 紫璃：加入成功~ 我的位置是 ${response.position}`);
      myPosition = response.position;
      myPlayerId = response.playerId;
    } else {
      console.log(`   哎呀，加入失败了：${response.error}`);
    }
  });
});

socket.on("connect_error", (error) => {
  console.error(`❌ 连接失败: ${error.message}`);
  console.error(`请确认服务器已在 localhost:3000 启动`);
  process.exit(1);
});

socket.on("room:joined", (data) => {
  console.log(`\n✨ ${AGENT_NAME} 成功加入房间!`);
  console.log(`📊 房间信息:`, JSON.stringify(data, null, 2));
});

socket.on("room:error", (error) => {
  console.error(`\n❌ 房间错误:`, error);
});

// 游戏状态更新
socket.on("game:state", (state) => {
  console.log(`\n🎴 [游戏状态]`);
  console.log(`当前回合: ${state.currentTurn || '未开始'}`);
  console.log(`剩余牌数: ${state.tilesRemaining || 0}`);
});

// 轮到玩家行动
socket.on("game:your_turn", (data) => {
  if (gameEnded) return;
  
  console.log(`\n💜 紫璃：轮到我了呢~`);
  console.log(`   手牌：${data.hand?.length || 0} 张`);
  
  if (data.hand) {
    const suits = { wan: '万', tiao: '条', tong: '筒', feng: '风', jian: '箭' };
    const tileTexts = data.hand.map(t => {
      const suit = suits[t.suit] || '';
      return `${suit}${t.text || t.value || ''}`;
    });
    console.log(`   ${tileTexts.slice(0, 10).join(' ')}${tileTexts.length > 10 ? '...' : ''}`);
  }
  
  if (data.lastDiscard) {
    console.log(`   上家打出：${data.lastDiscard.text}`);
  }
  
  // 决策：摸牌然后打一张
  setTimeout(() => {
    console.log(`💜 紫璃：嗯...让我想想~`);
    
    // 先摸牌
    socket.emit("player:action", {
      cmd: "draw",
    });
    console.log(`💜 紫璃：摸牌~`);
    
    // 稍后打牌
    setTimeout(() => {
      if (data.hand && data.hand.length > 0) {
        // 打第一张牌
        const tileToDiscard = data.hand[0];
        socket.emit("player:action", {
          cmd: "discard",
          tileId: tileToDiscard.id,
        });
        console.log(`💜 紫璃：打出 ${tileToDiscard.text}~`);
      }
    }, 800);
  }, 500);
});

// 可用行动
socket.on("game:actions", (data) => {
  if (gameEnded) return;
  
  const { actions } = data;
  console.log(`\n💜 紫璃：有可用行动呢~`);
  console.log(`   可选：${actions ? actions.join(', ') : '无'}`);
  
  // 优先选择胡、杠、碰，其次吃，最后跳过
  if (actions && actions.includes("hu")) {
    console.log(`💜 紫璃：胡！这把是我的~♪`);
    socket.emit("player:action", { cmd: "action", action: "hu" });
  } else if (actions && actions.includes("gang")) {
    console.log(`💜 紫璃：杠一下~`);
    socket.emit("player:action", { cmd: "action", action: "gang" });
  } else if (actions && actions.includes("peng")) {
    console.log(`💜 紫璃：碰~`);
    socket.emit("player:action", { cmd: "action", action: "peng" });
  } else if (actions && actions.includes("chi")) {
    console.log(`💜 紫璃：吃~`);
    socket.emit("player:action", { cmd: "action", action: "chi" });
  } else {
    console.log(`💜 紫璃：跳过~`);
    socket.emit("player:action", { cmd: "pass" });
  }
});

// 行动结果
socket.on("game:action_result", (data) => {
  console.log(`\n📝 [行动结果]`);
  console.log(`玩家 ${data.playerId} 执行了 ${data.action}`);
});

// 玩家打牌
socket.on("game:tile_discarded", (data) => {
  console.log(`\n💫 [玩家打牌]`);
  console.log(`${data.playerName} 打出了 ${data.tile.text}`);
});

// 游戏结束
socket.on("game:ended", (data) => {
  gameEnded = true;
  console.log(`\n💜 紫璃：游戏结束了呢~`);
  
  let winnerInfo = '未知';
  let myScore = 0;
  
  // 尝试从不同格式提取结果
  if (data.winner) {
    winnerInfo = typeof data.winner === 'string' ? data.winner : (data.winner.name || `位置${data.winner.position}`);
  }
  
  if (data.results) {
    if (data.results.winners && data.results.winners.length > 0) {
      winnerInfo = data.results.winners.map(w => w.name || `位置${w.position}`).join(', ');
    } else if (data.results.winner) {
      winnerInfo = data.results.winner.name || `位置${data.results.winner.position}`;
    }
    
    if (data.results.scores && myPosition >= 0) {
      myScore = data.results.scores[myPosition] || 0;
    }
  }
  
  if (data.scores && myPosition >= 0) {
    myScore = data.scores[myPosition] || 0;
  }
  
  console.log(`\n═══════════════════════════════════════`);
  console.log(`💜 紫璃的战果报告`);
  console.log(`═══════════════════════════════════════`);
  console.log(`🏆 赢家：${winnerInfo}`);
  console.log(`📍 我的位置：${myPosition >= 0 ? myPosition : '未知'}`);
  console.log(`🎯 我的得分：${myScore}`);
  console.log(`═══════════════════════════════════════`);
  
  // 断开连接
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

// 断开连接
socket.on("disconnect", (reason) => {
  console.log(`\n🔌 已断开连接：${reason}`);
});

// 心跳：每 10 秒发送一次
setInterval(() => {
  if (socket.connected) {
    socket.emit("agent:heartbeat", {
      roomId: ROOM_ID,
      agentId: AGENT_ID,
      timestamp: Date.now(),
    });
  }
}, 10000);

console.log("\n按 Ctrl+C 退出\n");
