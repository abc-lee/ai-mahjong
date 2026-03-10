/**
 * 游戏结束战果显示组件
 */

import React from 'react';
import { WinningHand } from '@shared/types';
import TileComponent from '../Tile/Tile';
import './GameResult.css';

interface PlayerScore {
  id: string;
  name: string;
  score: number;
}

interface GameResultProps {
  winner: number | null;
  winningHand: WinningHand;
  players: PlayerScore[];
  onClose: () => void;
}

const GameResult: React.FC<GameResultProps> = ({
  winner,
  winningHand,
  players,
  onClose,
}) => {
  const isDraw = winner === null;
  const winnerPlayer = winner !== null ? players[winner] : null;

  return (
    <div className="game-result-overlay" onClick={onClose}>
      <div className="game-result-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="result-title">
          {isDraw ? '🤝 流局' : '🎉 胡牌！'}
        </h2>

        {winnerPlayer && (
          <div className="winner-info">
            <span className="winner-name">{winnerPlayer.name}</span>
            <span className="winner-label">
              {winningHand?.isSelfDraw ? '自摸' : '胡牌'}
            </span>
          </div>
        )}

        {winningHand && (
          <div className="winning-hand">
            <h3>胡牌手牌</h3>
            <div className="hand-tiles">
              {winningHand.tiles.map((tile) => (
                <TileComponent key={tile.id} tile={tile} size="small" />
              ))}
            </div>

            {winningHand.melds.length > 0 && (
              <div className="melds-section">
                <h4>副露</h4>
                <div className="melds">
                  {winningHand.melds.map((meld, idx) => (
                    <div key={idx} className="meld">
                      {meld.tiles.map((tile) => (
                        <TileComponent key={tile.id} tile={tile} size="small" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {winningHand.fans && winningHand.fans.length > 0 && (
              <div className="fans-section">
                <h4>番型</h4>
                <div className="fans">
                  {winningHand.fans.map((fan) => (
                    <span key={fan.id} className="fan-tag">
                      {fan.name} ({fan.fan}番)
                    </span>
                  ))}
                </div>
                <div className="total-score">
                  总分: <strong>{winningHand.score}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="players-scores">
          <h3>玩家得分</h3>
          {players.map((player, idx) => (
            <div
              key={player.id}
              className={`player-score ${winner === idx ? 'winner' : ''}`}
            >
              <span className="player-position">{idx + 1}</span>
              <span className="player-name">{player.name}</span>
              <span className="player-score-value">{player.score || 0}</span>
            </div>
          ))}
        </div>

        <button className="close-button" onClick={onClose}>
          继续游戏
        </button>
      </div>
    </div>
  );
};

export default GameResult;
