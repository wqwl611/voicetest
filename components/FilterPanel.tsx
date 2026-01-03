import React from 'react';
import { SortOption, SortDirection } from '../types';
import { SearchIcon, SortIcon } from './Icons';

interface FilterPanelProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  sortDirection: SortDirection;
  onSortChange: (option: SortOption) => void;
  onDirectionToggle: () => void;
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  searchQuery,
  onSearchChange,
  sortBy,
  sortDirection,
  onSortChange,
  onDirectionToggle,
  startDate,
  endDate,
  onDateChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="bg-[#fbfbfd] px-4 pb-4 animate-in slide-in-from-top-2 duration-200 border-b border-gray-100">
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#e3e3e8] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 placeholder-gray-500"
          />
        </div>

        {/* Filters Row */}
        <div className="flex items-center justify-between">
            {/* Sort */}
            <div className="flex items-center space-x-1">
                {(['date', 'name', 'duration'] as SortOption[]).map((option) => (
                    <button
                        key={option}
                        onClick={() => onSortChange(option)}
                        className={`
                            px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors
                            ${sortBy === option ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                        `}
                    >
                        {option}
                    </button>
                ))}
                <button 
                    onClick={onDirectionToggle}
                    className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                    <SortIcon size={14} className={`transform transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Date Simple */}
            <div className="flex items-center space-x-2">
                 <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => onDateChange(e.target.value, endDate)}
                    className="bg-transparent text-[10px] text-gray-500 border-b border-gray-300 w-20 focus:outline-none focus:border-blue-500"
                 />
            </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;