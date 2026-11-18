import { useId } from 'react';
import type { IntervalUnit } from '../types';
import { useI18n } from '../i18n';
import { COLOR_CHOICES, ICON_CHOICES } from '../data/presets';

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="field picker">
      <legend>{t('icon')}</legend>
      <div className="picker-grid">
        {ICON_CHOICES.map((icon) => (
          <label key={icon} className="picker-option icon-option">
            <input
              type="radio"
              name={name}
              value={icon}
              checked={value === icon}
              onChange={() => onChange(icon)}
              className="visually-hidden"
            />
            <span aria-hidden="true">{icon}</span>
            <span className="visually-hidden">{icon}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="field picker">
      <legend>{t('color')}</legend>
      <div className="picker-grid">
        {COLOR_CHOICES.map((color, idx) => (
          <label key={color} className="picker-option color-option" style={{ '--swatch': color } as React.CSSProperties}>
            <input
              type="radio"
              name={name}
              value={color}
              checked={value === color}
              onChange={() => onChange(color)}
              className="visually-hidden"
            />
            <span className="visually-hidden">{t('colorN', { n: idx + 1 })}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function IntervalInput({
  every,
  unit,
  onChange,
  label,
}: {
  every: number;
  unit: IntervalUnit;
  onChange: (every: number, unit: IntervalUnit) => void;
  label?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <fieldset className="field interval">
      <legend>{label ?? t('task.repeat')}</legend>
      <div className="interval-row">
        <label htmlFor={`${id}-n`} className="visually-hidden">
          {t('task.amount')}
        </label>
        <input
          id={`${id}-n`}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          required
          value={every || ''}
          onChange={(e) => onChange(Math.max(0, Math.min(999, Number(e.target.value) || 0)), unit)}
        />
        <label htmlFor={`${id}-u`} className="visually-hidden">
          {t('task.unit')}
        </label>
        <select id={`${id}-u`} value={unit} onChange={(e) => onChange(every, e.target.value as IntervalUnit)}>
          <option value="day">{t('unit.day')}</option>
          <option value="week">{t('unit.week')}</option>
          <option value="month">{t('unit.month')}</option>
          <option value="year">{t('unit.year')}</option>
        </select>
      </div>
    </fieldset>
  );
}
