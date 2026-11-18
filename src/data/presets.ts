import type { IntervalUnit, Preset, PresetTask } from '../types';

const t = (key: string, every: number, unit: IntervalUnit): PresetTask => ({
  id: key,
  titleKey: `task.${key}`,
  every,
  unit,
});

/** Built-in presets. Every one can be edited, extended or deleted by the user. */
export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'car',
    nameKey: 'preset.car',
    icon: '🚗',
    color: '#2563eb',
    builtIn: true,
    tasks: [
      t('oilChange', 6, 'month'),
      t('tireRotation', 6, 'month'),
      t('tirePressure', 1, 'month'),
      t('brakeCheck', 1, 'year'),
      t('engineAirFilter', 1, 'year'),
      t('cabinFilter', 1, 'year'),
      t('batteryCheck', 6, 'month'),
      t('coolant', 1, 'year'),
      t('carWash', 2, 'week'),
      t('carInspection', 1, 'year'),
      t('carRegistration', 1, 'year'),
      t('carInsurance', 1, 'year'),
    ],
  },
  {
    id: 'garden',
    nameKey: 'preset.garden',
    icon: '🌱',
    color: '#16a34a',
    builtIn: true,
    tasks: [
      t('watering', 2, 'day'),
      t('fertilizing', 1, 'month'),
      t('soilCare', 3, 'month'),
      t('weeding', 2, 'week'),
      t('pruning', 3, 'month'),
      t('mulching', 6, 'month'),
      t('pestCheck', 2, 'week'),
      t('lawnMowing', 1, 'week'),
      t('irrigationCheck', 1, 'month'),
    ],
  },
  {
    id: 'home',
    nameKey: 'preset.home',
    icon: '🏠',
    color: '#ea580c',
    builtIn: true,
    tasks: [
      t('acFilter', 3, 'month'),
      t('acService', 6, 'month'),
      t('smokeDetector', 6, 'month'),
      t('waterFilter', 6, 'month'),
      t('waterTank', 6, 'month'),
      t('pestControl', 6, 'month'),
      t('deepClean', 1, 'month'),
      t('fireExtinguisher', 1, 'year'),
    ],
  },
  {
    id: 'health',
    nameKey: 'preset.health',
    icon: '❤️',
    color: '#dc2626',
    builtIn: true,
    tasks: [
      t('checkup', 1, 'year'),
      t('dental', 6, 'month'),
      t('eyeExam', 1, 'year'),
      t('bloodTest', 6, 'month'),
      t('medsRefill', 1, 'month'),
    ],
  },
  {
    id: 'pet',
    nameKey: 'preset.pet',
    icon: '🐾',
    color: '#9333ea',
    builtIn: true,
    tasks: [
      t('vetVisit', 1, 'year'),
      t('vaccines', 1, 'year'),
      t('deworming', 3, 'month'),
      t('grooming', 1, 'month'),
      t('fleaTreatment', 1, 'month'),
    ],
  },
  {
    id: 'bills',
    nameKey: 'preset.bills',
    icon: '🧾',
    color: '#0d9488',
    builtIn: true,
    tasks: [
      t('electricityBill', 1, 'month'),
      t('waterBill', 1, 'month'),
      t('internetBill', 1, 'month'),
      t('phoneBill', 1, 'month'),
      t('rent', 1, 'month'),
    ],
  },
  {
    id: 'custom',
    nameKey: 'preset.custom',
    icon: '⭐',
    color: '#64748b',
    builtIn: true,
    tasks: [],
  },
];

export const ICON_CHOICES = [
  '🚗', '🚙', '🛻', '🏍️', '🚲', '🚤', '🌱', '🌳', '🌷', '🌴', '🪴', '🏠',
  '🏡', '🏢', '🔧', '🛠️', '❤️', '💊', '🦷', '🐾', '🐈', '🐕', '🐎', '🐑',
  '🧾', '💡', '💧', '🔥', '❄️', '📄', '🧹', '🧺', '🏊', '⭐', '📦', '🕌',
];

export const COLOR_CHOICES = [
  '#2563eb', '#16a34a', '#ea580c', '#dc2626', '#9333ea', '#0d9488',
  '#ca8a04', '#db2777', '#4f46e5', '#64748b',
];
