import type { InputHTMLAttributes } from 'react';

interface AutoWidthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value: string;
}

/**
 * 글자 길이만큼만 넓어지는 입력칸. 같은 글자를 보이지 않게 깔아 두고 그 너비를 입력칸이 따라간다.
 * 컬럼 설정 창의 컬럼 이름처럼, 옆의 글자 칩(이름·출결)과 크기를 맞춰야 할 때 쓴다.
 * 글꼴 크기·굵기는 className으로 넘긴 값을 감싸는 칸에도 똑같이 적용한다.
 */
export function AutoWidthInput({ value, className = '', ...rest }: AutoWidthInputProps) {
  return (
    <span className={`inline-grid ${className}`}>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">
        {value || ' '}
      </span>
      <input
        {...rest}
        value={value}
        size={1}
        // 글꼴·글자 색은 감싸는 칸에서 물려받아, 깔아 둔 글자와 너비가 똑같다.
        style={{ font: 'inherit', color: 'inherit' }}
        className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none"
      />
    </span>
  );
}
