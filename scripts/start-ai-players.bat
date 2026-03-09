@echo off
REM 一键启动 3 个 AI 玩家
REM 用法: start-ai-players.bat <roomId>

set ROOM_ID=%1

if "%ROOM_ID%"=="" (
  echo 用法: start-ai-players.bat ^<roomId^>
  exit /b 1
)

echo 启动 AI 玩家加入房间: %ROOM_ID%

cd /d E:\game\ai-mahjong

echo 启动紫璃...
node scripts/bridge.js %ROOM_ID% zili 紫璃 --file zili-%ROOM_ID%

echo 启动小明...
node scripts/bridge.js %ROOM_ID% xiaoming 小明 --file xiaoming-%ROOM_ID%

echo 启动阿杰...
node scripts/bridge.js %ROOM_ID% ajie 阿杰 --file ajie-%ROOM_ID%

echo.
echo ========================================
echo 三个 AI 玩家已启动！
echo 请在 OpenCode 中派发子 Agent 监控事件文件
echo ========================================
pause
