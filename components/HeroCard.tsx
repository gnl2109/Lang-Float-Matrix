
import React from 'react';
import { Hero, HeroClass } from '../types';

interface HeroCardProps {
  hero: Hero;
  isSelected: boolean;
  isPlaced: boolean;
  onClick: () => void;
  compact?: boolean;
  onToggleClass?: (hc: HeroClass) => void;
  activeClasses?: HeroClass[];
}

const HeroCard: React.FC<HeroCardProps> = ({ 
  hero, 
  isSelected, 
  isPlaced, 
  onClick, 
  compact,
  onToggleClass,
  activeClasses = []
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (isSelected) {
      e.dataTransfer.setData('heroId', hero.id.toString());
    } else {
      e.preventDefault();
    }
  };

  const baseClasses = `relative group rounded-xl overflow-hidden border transition-all select-none w-full
    ${isSelected 
      ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30' 
      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
    }
    ${isPlaced ? 'opacity-60' : ''}
  `;

  if (compact) {
    return (
      <div
        draggable={isSelected}
        onDragStart={handleDragStart}
        onClick={onClick}
        className={`${baseClasses} py-2 px-1 text-center min-h-[36px] flex items-center justify-center cursor-pointer`}
      >
        <div className={`text-[10px] font-black truncate leading-tight ${isSelected ? 'text-amber-400' : 'text-slate-400'}`}>
          {hero.name}
        </div>
        
        {isPlaced && (
          <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
            <div className="text-[8px] text-amber-500 font-black tracking-tighter uppercase">In Puzzle</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} p-4 flex flex-col h-full gap-3 hover:bg-slate-900/60 transition-all`}
    >
      <div className="flex justify-between items-start">
        <div 
          onClick={onClick}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 cursor-pointer
            ${isSelected ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-600 border-slate-800'}
          `}
        >
          {hero.name.charAt(0)}
        </div>
        {isSelected && (
          <div className="bg-amber-500 text-slate-950 rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1">
        <h3 className={`text-sm font-black mb-2 cursor-pointer ${isSelected ? 'text-amber-400' : 'text-slate-200'}`} onClick={onClick}>
          {hero.name}
        </h3>
        
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {hero.factions.map((f, i) => (
              <span key={`f-${i}`} className="text-[8px] font-black bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800 uppercase tracking-tight">
                {f}
              </span>
            ))}
          </div>
          
          <div className="border-t border-slate-800 pt-2">
            <div className="text-[7px] font-black text-slate-600 uppercase mb-1.5 tracking-wider">클래스 On/Off</div>
            <div className="flex flex-wrap gap-1">
              {hero.classes.map((c, i) => {
                const isActive = activeClasses.includes(c);
                return (
                  <button
                    key={`c-${i}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleClass?.(c);
                    }}
                    className={`text-[9px] font-black px-2 py-1 rounded transition-all border
                      ${isActive 
                        ? 'bg-amber-950/40 text-amber-500 border-amber-900/50' 
                        : 'bg-slate-950 text-slate-700 border-slate-900 hover:text-slate-400'
                      }
                    `}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {activeClasses.length === 0 && (
              <p className="text-[8px] text-red-500/60 font-bold mt-1.5 animate-pulse">클래스 미선택 시 배치 불가</p>
            )}
          </div>
        </div>
      </div>

      {isPlaced && (
        <div className="absolute top-2 right-2">
          <span className="bg-amber-600 text-white text-[7px] px-1.5 rounded-full font-black border border-amber-500 shadow-sm uppercase">배치 완료</span>
        </div>
      )}
    </div>
  );
};

export default HeroCard;
