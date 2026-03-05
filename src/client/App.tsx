import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useGameStore, SpeechMessage, EmotionState } from './store';
import { socket, setupSocketListeners, discardTile, drawTile, performAction, passAction, onPlayerSpeech, onPlayerEmotion } from './socket';
import { Room, Tile } from '@shared/types';
import Lobby from './components/Lobby/Lobby';
import RoomComponent from './components/Room/Room';
import GameBoard from './components/GameBoard/GameBoard';
import './App.css';

function App() {
  const navigate = useNavigate();
  const {
    connected,
    setConnected,
    setCurrentRoom,
    updateGameState,
    setAvailableActions,
    setPlayerInfo,
    addSpeechMessage,
    setPlayerEmotion,
    playerId,
    currentRoom,
  } = useGameStore();

  useEffect(() => {
    socket.connect();

    const cleanup = setupSocketListeners({
      onConnect: () => {
        setConnected(true);
        setPlayerInfo(socket.id!, '');
      },
      onDisconnect: () => setConnected(false),
      onRoomUpdate: (room) => setCurrentRoom(room),
      onGameState: (state, hand, yourTurn, lastDrawn, turnPhase) => {
        updateGameState(state, hand, yourTurn, lastDrawn, turnPhase);
        // 如果没有待处理操作，清除 availableActions
        if (!state.hasPendingActions) {
          setAvailableActions([]);
        }
      },
      onActions: (actions) => setAvailableActions(actions),
      onGameEnd: (winner, winningHand) => {
        console.log('游戏结束', winner, winningHand);
        // 清除操作按钮
        setAvailableActions([]);
        // 延迟返回房间页面
        setTimeout(() => {
          if (currentRoom) {
            navigate(`/room/${currentRoom.id}`);
          }
        }, 1500);
      },
      onError: (message) => {
        alert(`错误: ${message}`);
      },
      // 发言系统事件
      onPlayerSpeech: (data) => {
        addSpeechMessage({
          id: `${data.playerId}-${data.timestamp}`,
          playerId: data.playerId,
          playerName: data.playerName,
          content: data.content,
          emotion: data.emotion,
          targetPlayer: data.targetPlayer,
          timestamp: data.timestamp,
        });
      },
      onPlayerEmotion: (data) => {
        setPlayerEmotion(data.playerId, data.emotion);
      },
    });

    return () => {
      cleanup();
      socket.disconnect();
    };
  }, [setConnected, setCurrentRoom, updateGameState, setAvailableActions, setPlayerInfo, addSpeechMessage, setPlayerEmotion]);

  const handleJoinRoom = (roomId: string, room: Room) => {
    setCurrentRoom(room);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="app">
      <Routes>
        <Route
          path="/"
          element={<Lobby onJoinRoom={handleJoinRoom} />}
        />
        <Route path="/room/:roomId" element={<RoomWrapper />} />
        <Route path="/game/:roomId" element={<GameBoardWrapper />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

// Room 组件包装器
function RoomWrapper() {
  const { roomId } = useParams<{ roomId: string }>();
  return <RoomComponent key={roomId} />;
}

// GameBoard 组件包装器
function GameBoardWrapper() {
  const { roomId } = useParams<{ roomId: string }>();
  const {
    gamePublicState,
    myHand,
    myTurn,
    lastDrawnTile,
    turnPhase,
    playerId,
    currentRoom,
    availableActions,
    speechMessages,
    playerEmotions,
  } = useGameStore();

  // 如果没有游戏状态，等待
  useEffect(() => {
    if (!gamePublicState && currentRoom) {
      // 请求游戏状态（通过摸牌来触发状态更新）
      console.log('[GameBoard] 请求游戏状态...');
      socket.emit('game:draw');
    }
  }, [gamePublicState, currentRoom]);

  console.log('[GameBoard] gamePublicState:', gamePublicState);
  console.log('[GameBoard] myHand:', myHand?.length, 'myTurn:', myTurn, 'lastDrawn:', lastDrawnTile?.display);

  const handleDiscard = async (tileId: string) => {
    try {
      await discardTile(tileId);
    } catch (err) {
      console.error('打牌失败:', err);
    }
  };

  const handleDraw = async () => {
    try {
      const result = await drawTile();
      console.log('摸牌结果:', result);
    } catch (err) {
      console.error('摸牌失败:', err);
    }
  };

  const handleAction = async (action: string, tiles?: Tile[]) => {
    try {
      await performAction(action as 'chi' | 'peng' | 'gang' | 'hu', tiles);
    } catch (err) {
      console.error('操作失败:', err);
    }
  };

  const handlePass = async () => {
    try {
      await passAction();
    } catch (err) {
      console.error('过牌失败:', err);
    }
  };

  if (!gamePublicState) {
    return <div className="loading">加载游戏数据...</div>;
  }

  // 找到自己的位置
  const myPlayer = gamePublicState.players.find(p => p.id === playerId);
  const myPosition = myPlayer?.position ?? 0;

  // 转换发言消息为按玩家ID索引
  const speechByPlayer: Record<string, typeof speechMessages[0]> = {};
  speechMessages.forEach(msg => {
    // 只保留每个玩家的最新发言
    speechByPlayer[msg.playerId] = msg;
  });

  return (
    <GameBoard
      key={roomId}
      players={gamePublicState.players}
      currentPlayerIndex={gamePublicState.currentPlayerIndex}
      myPosition={myPosition}
      myHand={myHand}
      lastDiscard={gamePublicState.lastDiscard}
      wallRemaining={gamePublicState.wallRemaining}
      roundNumber={gamePublicState.roundNumber}
      dealerIndex={gamePublicState.dealerIndex}
      isMyTurn={myTurn}
      turnPhase={turnPhase}
      lastDrawnTile={lastDrawnTile}
      pendingActions={availableActions}
      speechMessages={speechByPlayer}
      playerEmotions={playerEmotions}
      onDiscard={handleDiscard}
      onDraw={handleDraw}
      onAction={handleAction}
      onPass={handlePass}
    />
  );
}

export default App;
