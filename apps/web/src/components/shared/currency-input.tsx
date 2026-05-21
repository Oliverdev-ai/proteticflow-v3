import { parseBRL } from '@proteticflow/shared/utils/format';
import { cn } from '../../lib/utils';

export type CurrencyInputProps = {
  value: number;
  onChange: (cents: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: CurrencyInputProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={currencyFormatter.format(value / 100)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn('input-field font-tabular', className)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => onChange(parseBRL(event.currentTarget.value))}
    />
  );
}
