import { Search } from 'lucide-react';

interface SearchInputProps {
  /** 입력칸의 접근성 이름. 예: '참가자 검색'. */
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** 표 위 도구 줄의 검색칸. 행사 출결 화면의 검색칸과 같은 모양이고, FilterDropdown과 높이가 같다. */
export function SearchInput({
  ariaLabel,
  value,
  onChange,
  placeholder = '검색',
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search
        size={13}
        aria-hidden="true"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-44 rounded-sm border border-slate-200 bg-white pl-8 pr-3 text-xs font-medium text-slate-800 shadow-2xs outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400"
      />
    </div>
  );
}
